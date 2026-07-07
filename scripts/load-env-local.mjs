import fs from "fs";
import path from "path";

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

/** โหลด .env.local เข้า process.env (ไม่ทับค่าที่มีอยู่แล้ว) */
export function loadEnvLocal(rootDir = process.cwd()) {
  const envPath = path.join(rootDir, ".env.local");

  if (!fs.existsSync(envPath)) return false;

  const content = fs.readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");

    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    const value = stripQuotes(line.slice(eq + 1).trim());

    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }

  return true;
}
