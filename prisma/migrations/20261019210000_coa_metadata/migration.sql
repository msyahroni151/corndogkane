ALTER TABLE financial_accounts
 ADD COLUMN "groupName" VARCHAR(80) NOT NULL DEFAULT '',
 ADD COLUMN "subGroup" VARCHAR(120) NOT NULL DEFAULT 'Lainnya',
 ADD COLUMN "normalBalance" VARCHAR(6) NOT NULL DEFAULT 'DEBIT',
 ADD COLUMN "reportType" VARCHAR(80) NOT NULL DEFAULT '',
 ADD COLUMN "defaultLevel" VARCHAR(80) NOT NULL DEFAULT '',
 ADD COLUMN "sourceStatus" VARCHAR(20) NOT NULL DEFAULT 'AKTIF',
 ADD COLUMN "coaVersion" VARCHAR(30),
 ADD COLUMN "sourceType" VARCHAR(10) NOT NULL DEFAULT 'CUSTOM',
 ADD COLUMN "notes" VARCHAR(2000) NOT NULL DEFAULT '';
UPDATE financial_accounts SET "normalBalance"='CREDIT' WHERE kind IN ('KEWAJIBAN','MODAL','PENDAPATAN');
ALTER TABLE financial_accounts DROP CONSTRAINT financial_accounts_kind;
ALTER TABLE financial_accounts ADD CONSTRAINT financial_accounts_kind CHECK (kind IN ('ASET','KEWAJIBAN','MODAL','PENDAPATAN','HPP','BEBAN'));
ALTER TABLE financial_accounts ADD CONSTRAINT financial_accounts_normal_balance CHECK ("normalBalance" IN ('DEBIT','CREDIT','BOTH'));
ALTER TABLE financial_accounts ADD CONSTRAINT financial_accounts_source_type CHECK ("sourceType" IN ('SYSTEM','CUSTOM'));
