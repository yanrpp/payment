import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const root = process.cwd();
const devDistDir = path.join(root, ".next-dev");
const prodDistDir = path.join(root, ".next");
const prodDevArtifacts = path.join(prodDistDir, "static", "development");
const nextBin = require.resolve("next/dist/bin/next");

function removeProdDevArtifacts() {
  if (!fs.existsSync(prodDevArtifacts)) return;

  console.log("[dev] removing stale development artifacts from .next (production cache)...");
  fs.rmSync(prodDevArtifacts, { recursive: true, force: true });
}

function devCacheLooksCorrupted() {
  if (!fs.existsSync(devDistDir)) return false;

  const hasDevStatic = fs.existsSync(path.join(devDistDir, "static", "development"));
  const hasProdBuildId = fs.existsSync(path.join(devDistDir, "BUILD_ID"));
  const hasServerPages = fs.existsSync(path.join(devDistDir, "server", "pages"));

  // Dev cache should not contain production-only markers without dev static files.
  if (hasProdBuildId && !hasDevStatic) return true;

  // Partial write after crash: folder exists but server output never materialized.
  if (!hasServerPages) {
    const entries = fs.readdirSync(devDistDir);
    if (entries.length > 0) return true;
  }

  return false;
}

if (devCacheLooksCorrupted()) {
  console.log("[dev] removing corrupted .next-dev cache...");
  fs.rmSync(devDistDir, { recursive: true, force: true });
}

removeProdDevArtifacts();

const port = process.env.PORT || "3012";

console.log(`[dev] starting Next.js dev server on http://localhost:${port}`);
console.log("[dev] cache directory: .next-dev (production uses .next)");

const child = spawn(process.execPath, [nextBin, "dev", "-p", port], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    NODE_ENV: "development",
    NEXT_DIST_DIR: ".next-dev",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
