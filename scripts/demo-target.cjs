/* eslint-disable @typescript-eslint/no-require-imports -- Node.js startup and packaging use CommonJS directly. */
const fs = require("node:fs");
const path = require("node:path");
const demoMarker = "corndog-demo-data-v1";
function assertDemoTarget(env = process.env) {
  if (env.HRIS_DEMO_MODE !== "1") throw Error("Demo harus diaktifkan secara eksplisit.");
  let target;
  try {
    target = new URL(env.DATABASE_URL || "");
  } catch {
    throw Error("Konfigurasi database demo belum valid.");
  }
  if (!["postgres:", "postgresql:"].includes(target.protocol))
    throw Error("Database demo harus PostgreSQL.");
  const database = decodeURIComponent(target.pathname.slice(1));
  const localTest =
    ["localhost", "127.0.0.1"].includes(target.hostname) &&
    /^corndog_hris_verify_\d+$/.test(database) &&
    env.HRIS_DEMO_TEST_DATABASE === database;
  if (!localTest) {
    const ref = env.HRIS_DEMO_PROJECT_REF || "";
    const direct =
      target.hostname === `db.${ref}.supabase.co` &&
      decodeURIComponent(target.username) === "postgres";
    const pooler =
      /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(target.hostname) &&
      decodeURIComponent(target.username) === `postgres.${ref}`;
    if (
      !/^[a-z0-9]{20}$/.test(ref) ||
      (!direct && !pooler) ||
      database !== "postgres" ||
      (target.port && target.port !== "5432")
    )
      throw Error(
        "Target harus project Supabase demo terpisah, melalui direct/session pooler port 5432.",
      );
    if (
      target.searchParams.getAll("sslmode").length !== 1 ||
      [...target.searchParams.keys()].some(
        (key) => !["sslmode", "application_name"].includes(key),
      ) ||
      !["require", "verify-full"].includes(target.searchParams.get("sslmode"))
    )
      throw Error("Koneksi database demo harus memakai TLS.");
  }
  const email = env.DEMO_ADMIN_EMAIL || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw Error("Email administrator demo belum valid.");
  const password = env.DEMO_ADMIN_PASSWORD || "";
  if (password.length < 12 || password.length > 128)
    throw Error("Password administrator demo harus 12–128 karakter.");
  return { database, localTest };
}
function applicationTables() {
  const schema = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");
  return [...schema.matchAll(/@@map\("([a-z0-9_]+)"\)/g)].map((m) => m[1]);
}
async function assertDemoDatabase(db, env = process.env) {
  const target = assertDemoTarget(env);
  const actual = (await db.query("SELECT current_database() AS name")).rows[0].name;
  if (actual !== target.database) throw Error("Identitas database demo tidak sesuai.");
  const existing = (
    await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")
  ).rows.map((row) => row.tablename);
  if (existing.includes("sequence_counters")) {
    const marker = (
      await db.query("SELECT value FROM sequence_counters WHERE name=$1", [demoMarker])
    ).rows[0];
    if (marker?.value === 1) return { seeded: true };
  }
  for (const table of existing) {
    if (["_prisma_migrations", "access_roles"].includes(table)) continue;
    if (!/^[a-z0-9_]+$/.test(table))
      throw Error("Database demo memuat tabel yang tidak diharapkan.");
    if ((await db.query(`SELECT 1 FROM public."${table}" LIMIT 1`)).rowCount)
      throw Error("Inisialisasi ditolak: target memuat data tanpa penanda demo.");
  }
  return { seeded: false };
}
async function protectDemoTables(db) {
  const tables = [...applicationTables(), "_prisma_migrations"];
  const actual = (
    await db.query(
      "SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1)",
      [tables],
    )
  ).rows;
  const role = (
    await db.query(
      "SELECT current_user AS name, rolbypassrls FROM pg_roles WHERE rolname=current_user",
    )
  ).rows[0];
  if (!role.rolbypassrls && actual.some((t) => t.tableowner !== role.name))
    throw Error("Role database demo belum dapat mengelola proteksi tabelnya.");
  const apiRoles = (
    await db.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')")
  ).rows.map((r) => r.rolname);
  for (const table of actual) {
    await db.query(`ALTER TABLE public."${table.tablename}" ENABLE ROW LEVEL SECURITY`);
    for (const apiRole of apiRoles)
      await db.query(`REVOKE ALL ON TABLE public."${table.tablename}" FROM "${apiRole}"`);
  }
}
module.exports = { assertDemoTarget, assertDemoDatabase, protectDemoTables, demoMarker };
