import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const limitKb = Number(process.env.BUNDLE_LIMIT_KB || 1200);
const assetsDir = path.resolve("dist/assets");

async function listJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(full);
    return entry.name.endsWith(".js") ? [full] : [];
  }));
  return files.flat();
}

const files = await listJsFiles(assetsDir);
const totalBytes = (await Promise.all(files.map(async file => (await stat(file)).size))).reduce((sum, size) => sum + size, 0);
const totalKb = totalBytes / 1024;

if (totalKb > limitKb) {
  console.error(`Bundle budget exceeded: ${totalKb.toFixed(1)} kB JS > ${limitKb} kB.`);
  process.exit(1);
}

console.log(`Bundle budget ok: ${totalKb.toFixed(1)} kB JS <= ${limitKb} kB.`);
