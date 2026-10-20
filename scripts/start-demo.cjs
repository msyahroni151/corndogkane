/* eslint-disable @typescript-eslint/no-require-imports -- Node.js startup and packaging use CommonJS directly. */
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const { Client } = require("pg");
const { assertDemoTarget, assertDemoDatabase } = require("./demo-target.cjs");
async function start() {
  assertDemoTarget();
  const root = path.join(__dirname, "..");
  const check = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 30000,
  });
  try {
    await check.connect();
    await assertDemoDatabase(check);
  } finally {
    await check.end();
  }
  console.log("Target database demo sudah diverifikasi.");
  for (const args of [
    [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"],
    [path.join(root, "node_modules/tsx/dist/cli.mjs"), path.join(__dirname, "seed-demo.ts")],
  ]) {
    const result = spawnSync(process.execPath, args, {
      cwd: root,
      env: { ...process.env, CHECKPOINT_DISABLE: "1" },
      encoding: "utf8",
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 5 * 1024 * 1024,
    });
    if (result.status !== 0)
      throw Error(
        "Persiapan database demo gagal. Periksa konfigurasi project demo; detail koneksi tidak dicetak.",
      );
  }
  const port = process.env.PORT || "10000";
  if (!/^\d{2,5}$/.test(port) || Number(port) > 65535 || Number(port) < 1024)
    throw Error("Port hosting demo tidak valid.");
  console.log("Database demo siap. Menjalankan website.");
  const server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      port,
    ],
    { cwd: root, env: process.env, stdio: "inherit", windowsHide: true },
  );
  server.on("error", () => {
    console.error("Website demo belum dapat dijalankan.");
    process.exitCode = 1;
  });
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.kill(signal));
  server.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
