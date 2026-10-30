/* eslint-disable @typescript-eslint/no-require-imports -- Node.js startup and packaging use CommonJS directly. */
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
async function packageDemo() {
  const destination = path.join(
    root,
    "verification",
    "deployment",
    "corndog-kane-demo-" + new Date().toISOString().replace(/[^0-9]/g, ""),
  );
  await fs.mkdir(destination, { recursive: true });
  const files = [];
  async function copy(relative) {
    if (relative.replaceAll("\\", "/").startsWith("src/generated/")) return;
    const source = path.join(root, relative),
      stat = await fs.lstat(source);
    if (stat.isSymbolicLink()) throw Error("Tautan filesystem tidak boleh masuk paket demo.");
    if (stat.isDirectory()) {
      for (const name of await fs.readdir(source)) await copy(path.join(relative, name));
      return;
    }
    if (
      !stat.isFile() ||
      path.basename(relative).startsWith(".env") ||
      /\.(pem|key|pfx|xlsx|csv|pdf|bak|dump)$/i.test(relative)
    )
      throw Error("Berkas yang tidak diizinkan ditemukan dalam paket demo.");
    const target = path.join(destination, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
    files.push({
      path: relative.replaceAll("\\", "/"),
      sha256: crypto
        .createHash("sha256")
        .update(await fs.readFile(source))
        .digest("hex"),
    });
  }
  for (const relative of [
    "src",
    "prisma",
    "public",
    "docs",
    "integrations/coa/master-coa-v1.json",
    "integrations/catalog/fixed-products-v1.json",
    "integrations/supabase/prod-ca-2021.crt",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "next.config.ts",
    "prisma.config.ts",
    "eslint.config.mjs",
    "render.yaml",
    "DEMO-DEPLOYMENT.md",
    "scripts/demo-target.cjs",
    "scripts/start-demo.cjs",
    "scripts/package-demo.cjs",
    "scripts/seed-demo.ts",
  ])
    await copy(relative);
  await fs.copyFile(path.join(root, ".gitignore"), path.join(destination, ".gitignore"));
  const packagePath = path.join(destination, "package.json");
  const manifest = JSON.parse(await fs.readFile(packagePath, "utf8"));
  for (const name of ["db:stop", "db:start", "db:status", "db:check"])
    delete manifest.scripts[name];
  await fs.writeFile(packagePath, JSON.stringify(manifest, null, 2) + "\n");
  const packageEntry = files.find((f) => f.path === "package.json");
  packageEntry.sha256 = crypto
    .createHash("sha256")
    .update(await fs.readFile(packagePath))
    .digest("hex");
  await fs.writeFile(
    path.join(destination, "README.md"),
    "# Corndog Kane\n\nSource aplikasi HRIS, operasional outlet, payroll, dan keuangan.\n\nUntuk menjalankan demo gratis Render + Supabase, baca [DEMO-DEPLOYMENT.md](DEMO-DEPLOYMENT.md). Data contoh terpisah dari database asli.\n\nPengembangan: Node.js 24, pnpm 11.25.0, PostgreSQL. Pasang dependency dengan pnpm install, isi DATABASE_URL di .env.local, lalu jalankan pnpm dev. Build: pnpm build.\n",
  );
  await fs.writeFile(
    path.join(destination, "DEMO-PACKAGE-MANIFEST.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        containsRealData: false,
        files: files.sort((a, b) => a.path.localeCompare(b.path)),
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      directory: destination,
      sourceFiles: files.length,
      excluded: [
        ".env*",
        ".git",
        "node_modules",
        ".next*",
        "verification",
        "local database",
        "employee imports",
        "local backups",
      ],
    }),
  );
}
packageDemo().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
