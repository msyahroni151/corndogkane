// Import the verified MASTER_COA snapshot. Explicit --apply is required to write.
const fs=require('node:fs'),path=require('node:path');const localEnv=require('dotenv').config({path:path.join(__dirname,'../.env.local'),quiet:true});const {Client}=require('pg');
async function run(){
 const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../integrations/coa/master-coa-v1.json'),'utf8'));
 if(source.accounts.length!==133||new Set(source.accounts.map(a=>a.code)).size!==133)throw Error('Invalid COA snapshot');
 const includeOutletAccounts = process.argv.includes('--with-outlet-mapping');
 const accounts = [...source.accounts];
 if (includeOutletAccounts) {
  const outlet = JSON.parse(fs.readFileSync(path.join(__dirname,'../integrations/coa/outlet-accounts-v1.json'),'utf8'));
  accounts.push(...outlet.accounts);
  if (outlet.accounts.length !== 18 || new Set(accounts.map(account => account.code)).size !== accounts.length) {
   throw Error('Invalid outlet COA mapping');
  }
 }
 if(!process.argv.includes('--apply')){console.log('Dry run: '+accounts.length+' verified accounts; use --apply to import.');return;}
 const connectionString = includeOutletAccounts ? localEnv.parsed?.DATABASE_URL : process.env.DATABASE_URL;
 if (includeOutletAccounts) {
  const target = new URL(connectionString);
  if (target.hostname !== '127.0.0.1' || target.port !== '5433' || target.pathname !== '/corndog_hris') {
   throw Error('Outlet COA mapping can only be applied to the local corndog_hris database');
  }
 }
 const db=new Client({connectionString});await db.connect();try{await db.query('BEGIN');await db.query('LOCK TABLE financial_accounts IN SHARE ROW EXCLUSIVE MODE');
 const owner=(await db.query(`SELECT u.id FROM users u JOIN access_roles r ON r.id=u."roleId" WHERE u.active AND r.active AND r."systemKey"='OWNER' ORDER BY u.id LIMIT 1`)).rows[0];if(!owner)throw Error('Active owner required for import audit');
 let inserted=0,existing=0;
 for(const account of accounts){const prior=(await db.query('SELECT * FROM financial_accounts WHERE code=$1',[account.code])).rows[0];if(prior){if(Object.entries(account).some(([key,value])=>prior[key]!==value))throw Error('COA code conflict: '+account.code+'; existing data preserved');existing++;continue;}
 const fields=Object.keys(account),columns=fields.map(f=>'"'+f+'"'),params=fields.map((_,i)=>'$'+(i+3));
 await db.query('INSERT INTO financial_accounts (id,"createdById",'+columns.join(',')+',"updatedAt") VALUES ($1,$2,'+params.join(',')+',NOW())',['COA-V1-'+account.code,owner.id,...Object.values(account)]);inserted++;
 }
 await db.query('COMMIT');console.log('COA import verified: '+inserted+' inserted, '+existing+' unchanged. No transactions or opening balances imported.');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
