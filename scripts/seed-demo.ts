import { Client } from "pg";
import { randomBytes, pbkdf2Sync } from "node:crypto";
// Guard code is shared with the startup process and never loads .env.local.
/* eslint-disable @typescript-eslint/no-require-imports -- Shared guard runs in the plain Node.js startup process. */
const {
  assertDemoTarget,
  assertDemoDatabase,
  protectDemoTables,
  demoMarker,
} = require("./demo-target.cjs");
async function main() {
  assertDemoTarget();
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 30000,
  });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtext('corndog-demo-bootstrap'))");
    const state = await assertDemoDatabase(db);
    if (!state.seeded) {
      const owner = "DEMO-OWNER",
        password = process.env.DEMO_ADMIN_PASSWORD!,
        salt = randomBytes(16).toString("hex");
      const hash =
        "pbkdf2-sha256:600000:" +
        salt +
        ":" +
        pbkdf2Sync(password, salt, 600000, 32, "sha256").toString("hex");
      await db.query(
        'INSERT INTO users(id,email,name,"passwordHash","roleId","updatedAt") VALUES($1,$2,$3,$4,$5,NOW())',
        [owner, process.env.DEMO_ADMIN_EMAIL!.toLowerCase(), "Owner Demo", hash, "ROLE-OWNER"],
      );
      // Start empty: business data is entered by the owner through the application.
      await db.query("INSERT INTO sequence_counters(name,value) VALUES($1,1)", [demoMarker]);
    }
    await protectDemoTables(db);
    await db.query("COMMIT");
    console.log(
      state.seeded
        ? "Data demo dipertahankan; proteksi database diverifikasi."
        : "Akun owner disiapkan. Data isian bisnis tetap kosong.",
    );
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}
main().catch((error: { code?: string; table?: string; column?: string }) => {
  console.error(
    "DEMO_SEED_FAILED",
    error.code || "configuration",
    error.table || "",
    error.column || "",
  );
  console.error(
    "Inisialisasi demo ditolak atau gagal. Data asli tidak diimpor; periksa target database dan konfigurasi demo.",
  );
  process.exitCode = 1;
});
