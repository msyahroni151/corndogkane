/* eslint-disable @typescript-eslint/no-require-imports -- Standalone scheduled backup process. */
const fs = require("node:fs"),
  fsp = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process"),
  { pipeline } = require("node:stream/promises"),
  { Client } = require("pg"),
  assert = require("node:assert/strict");
const magic = Buffer.from("CKBACKUP1");
function run(exe, args, env) {
  const r = spawnSync(exe, args, {
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 300000,
    maxBuffer: 1024 * 1024,
  });
  if (r.status !== 0) {
    const e = new Error("Backup command failed; private database details withheld.");
    e.tool = path.basename(exe);
    e.diagnostic = (r.stderr || "")
      .split("\n")
      .filter((l) => /ERROR:|error:|fatal:/.test(l))
      .map((l) => l.replace(/password[^ ]*/gi, "[redacted]"))
      .slice(0, 3);
    throw e;
  }
}
function pgEnv(uri, config) {
  const u = new URL(uri);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGDATABASE: u.pathname.slice(1),
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGSSLMODE: u.hostname === "127.0.0.1" ? "disable" : "verify-full",
    PGSSLROOTCERT: config.caFile,
    PGGSSENCMODE: "disable",
  };
}
async function fingerprints(db) {
  const tables = (
    await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
  ).rows;
  const result = {};
  for (const { tablename: t } of tables) {
    assert.match(t, /^[a-z_]+$/);
    result[t] = (
      await db.query(
        `SELECT count(*)::text count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) hash FROM public."${t}" t`,
      )
    ).rows[0];
  }
  return result;
}
async function encrypt(input, output, key) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(magic);
  fs.writeFileSync(output, Buffer.concat([magic, iv]), { mode: 0o600 });
  await pipeline(fs.createReadStream(input), cipher, fs.createWriteStream(output, { flags: "a" }));
  fs.appendFileSync(output, cipher.getAuthTag());
}
async function decrypt(input, output, key) {
  const size = fs.statSync(input).size,
    fd = fs.openSync(input, "r"),
    head = Buffer.alloc(magic.length + 12),
    tag = Buffer.alloc(16);
  fs.readSync(fd, head, 0, head.length, 0);
  fs.readSync(fd, tag, 0, 16, size - 16);
  fs.closeSync(fd);
  assert.ok(head.subarray(0, magic.length).equals(magic));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, head.subarray(magic.length));
  decipher.setAAD(magic);
  decipher.setAuthTag(tag);
  await pipeline(
    fs.createReadStream(input, { start: head.length, end: size - 17 }),
    decipher,
    fs.createWriteStream(output, { mode: 0o600 }),
  );
}
async function sha256(file) {
  const hash = crypto.createHash("sha256");
  for await (const c of fs.createReadStream(file)) hash.update(c);
  return hash.digest("hex");
}
async function restoreCheck(dump, expected, config) {
  const name =
    "corndog_security_restore_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
  assert.match(name, /^corndog_security_restore_\d+_[a-f0-9]{8}$/);
  const admin = new Client({
    connectionString: config.restoreAdminUrl,
    connectionTimeoutMillis: 10000,
  });
  await admin.connect();
  let created = false;
  try {
    assert.equal(new URL(config.restoreAdminUrl).hostname, "127.0.0.1");
    await admin.query('CREATE DATABASE "' + name + '"');
    created = true;
    const uri = new URL(config.restoreAdminUrl);
    uri.pathname = "/" + name;
    const empty = new Client({ connectionString: uri.toString() });
    await empty.connect();
    try {
      assert.equal((await empty.query("SELECT current_database() name")).rows[0].name, name);
      assert.equal(
        (await empty.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'"))
          .rows[0].n,
        0,
      );
      await empty.query("DROP SCHEMA public");
    } finally {
      await empty.end();
    }
    run(
      path.join(config.pgBin, "pg_restore" + (process.platform === "win32" ? ".exe" : "")),
      ["--no-owner", "--no-acl", "--exit-on-error", "--dbname", name, dump],
      pgEnv(uri.toString(), config),
    );
    const restored = new Client({ connectionString: uri.toString() });
    await restored.connect();
    try {
      await restored.query("SET TIME ZONE 'UTC'");
      assert.deepEqual(await fingerprints(restored), expected);
    } finally {
      await restored.end();
    }
  } finally {
    if (created) {
      assert.match(name, /^corndog_security_restore_\d+_[a-f0-9]{8}$/);
      await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1", [
        name,
      ]);
      await admin.query('DROP DATABASE "' + name + '"');
    }
    await admin.end();
  }
}
function backupClient(uri, config) {
  const url = new URL(uri);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  url.searchParams.delete("sslmode");
  return new Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 30000,
    ssl: local ? false : { ca: fs.readFileSync(config.caFile, "utf8"), rejectUnauthorized: true },
  });
}
async function backupTarget(target, config) {
  assert.ok(["local", "online"].includes(target.name));
  const base = path.resolve(config.directory);
  fs.mkdirSync(base, { recursive: true, mode: 0o700 });
  const id = crypto.randomUUID(),
    work = path.join(base, ".working-" + id);
  assert.equal(path.dirname(work), base);
  fs.mkdirSync(work, { mode: 0o700 });
  const plain = path.join(work, "snapshot.dump"),
    restored = path.join(work, "verified.dump"),
    archive = path.join(
      base,
      new Date().toISOString().replace(/[^0-9]/g, "") + "-" + target.name + ".ckbackup",
    );
  const db = backupClient(target.url, config);
  let connected = false,
    transaction = false,
    phase = "connect";
  try {
    await db.connect();
    connected = true;
    await db.query(
      "INSERT INTO public.security_backup_runs (id,target,status) VALUES ($1,$2,'RUNNING')",
      [id, target.name],
    );
    phase = "snapshot";
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transaction = true;
    await db.query("SET LOCAL TIME ZONE 'UTC'");
    const snapshot = (await db.query("SELECT pg_export_snapshot() snapshot")).rows[0].snapshot;
    assert.match(snapshot, /^[A-Fa-f0-9-]+$/);
    const expected = await fingerprints(db);
    phase = "dump";
    run(
      path.join(config.pgBin, "pg_dump" + (process.platform === "win32" ? ".exe" : "")),
      [
        "--format=custom",
        "--schema=public",
        "--no-owner",
        "--no-acl",
        "--enable-row-security",
        "--snapshot=" + snapshot,
        "--file",
        plain,
      ],
      pgEnv(target.url, config),
    );
    await db.query("COMMIT");
    transaction = false;
    run(
      path.join(config.pgBin, "pg_restore" + (process.platform === "win32" ? ".exe" : "")),
      ["--list", plain],
      process.env,
    );
    phase = "encryption";
    const key = Buffer.from(config.encryptionKey, "hex");
    assert.equal(key.length, 32);
    await encrypt(plain, archive, key);
    await decrypt(archive, restored, key);
    assert.equal(await sha256(restored), await sha256(plain));
    phase = "restore";
    await restoreCheck(restored, expected, config);
    const sha = await sha256(archive),
      now = new Date();
    await db.query(
      'UPDATE public.security_backup_runs SET status=\'SUCCESS\',sha256=$2,"restoredAt"=$3,"finishedAt"=$3 WHERE id=$1',
      [id, sha, now],
    );
    const manifest = {
      id,
      target: target.name,
      archive: path.basename(archive),
      sha256: sha,
      restoreVerified: true,
      tables: Object.keys(expected).length,
      rows: Object.values(expected).reduce((n, v) => n + Number(v.count), 0),
      finishedAt: now.toISOString(),
    };
    fs.writeFileSync(archive + ".json", JSON.stringify(manifest, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(manifest));
  } catch (error) {
    error.phase = phase;
    if (transaction) await db.query("ROLLBACK").catch(() => {});
    if (connected)
      await db
        .query(
          "UPDATE public.security_backup_runs SET status='FAILED',\"finishedAt\"=CURRENT_TIMESTAMP WHERE id=$1",
          [id],
        )
        .catch(() => {});
    throw error;
  } finally {
    await db.end().catch(() => {});
    for (const f of [plain, restored]) if (fs.existsSync(f)) await fsp.unlink(f);
    await fsp.rmdir(work);
  }
}
async function main() {
  const configFile = process.env.SECURITY_BACKUP_CONFIG || process.argv[2];
  if (!configFile) throw Error("Private backup configuration is required.");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  assert.equal(config.version, 1);
  assert.ok(config.targets.length >= 1 && config.targets.length <= 2);
  let failed = false;
  for (const target of config.targets) {
    try {
      await backupTarget(target, config);
    } catch (error) {
      failed = true;
      console.error(
        JSON.stringify({
          target: target.name,
          status: "FAILED",
          phase: error.phase,
          error: error.name,
          code: error.code,
          tool: error.tool,

          details: "Backup or restore validation failed; no credentials or row values printed.",
        }),
      );
    }
  }
  if (failed) process.exitCode = 1;
}
main().catch(() => {
  console.error("Backup configuration or execution failed; secrets withheld.");
  process.exitCode = 1;
});
