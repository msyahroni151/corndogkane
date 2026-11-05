/* eslint-disable @typescript-eslint/no-require-imports -- Production bootstrap. */
const { Client } = require("pg"),
  { spawn } = require("node:child_process"),
  path = require("node:path");
async function main() {
  if (!/^[a-f0-9]{64}$/.test(process.env.SECURITY_ENCRYPTION_KEY || ""))
    throw Error("Encryption configuration unavailable.");
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 30000,
  });
  try {
    await db.connect();
    const r = (
      await db.query(
        "SELECT current_user name,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,has_schema_privilege(current_user,'public','CREATE') ddl,has_table_privilege(current_user,'security_events','DELETE') audit_delete FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    if (
      r.name !== "corndog_runtime" ||
      r.rolsuper ||
      r.rolcreatedb ||
      r.rolcreaterole ||
      r.rolbypassrls ||
      r.ddl ||
      r.audit_delete
    )
      throw Error("Restricted database runtime required.");
    await db.query("SELECT id FROM public.security_settings LIMIT 1");
    await db.query('SELECT "tokenHash" FROM public.mfa_challenges LIMIT 0');
  } finally {
    await db.end();
  }
  const port = process.env.PORT || "10000";
  if (!/^\d{2,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
    throw Error("Invalid port.");
  console.log("Restricted runtime verified; migrations and seed are not executed by the website.");
  const child = spawn(
    process.execPath,
    [
      path.join(__dirname, "../node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      port,
    ],
    { stdio: "inherit", windowsHide: true },
  );
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
main().catch(() => {
  console.error(
    "Secure startup failed. Check private configuration and database grants; details withheld.",
  );
  process.exitCode = 1;
});
