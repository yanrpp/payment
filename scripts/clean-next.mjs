import fs from "fs";
import path from "path";

const targets =
  process.argv.length > 2 ? process.argv.slice(2) : [".next", ".next-dev"];

for (const dir of targets) {
  const fullPath = path.resolve(process.cwd(), dir);

  if (!fs.existsSync(fullPath)) {
    console.log(`[clean] skip ${dir} (not found)`);
    continue;
  }

  fs.rmSync(fullPath, { recursive: true, force: true });
  console.log(`[clean] removed ${dir}`);
}
