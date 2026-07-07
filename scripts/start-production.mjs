import { spawn, spawnSync } from "child_process";
import { createRequire } from "module";
import path from "path";

import { loadEnvLocal } from "./load-env-local.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();
loadEnvLocal(root);
const nextBin = require.resolve("next/dist/bin/next");
const ensureBuildScript = path.join(root, "scripts", "ensure-production-build.mjs");
const underPm2 = Boolean(process.env.PM2_HOME || process.env.pm_id);

function pipeChildLogs(child) {
  child.stdout?.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });
}

function spawnNode(args, { env = process.env, stdio = underPm2 ? "pipe" : "inherit" } = {}) {
  return spawn(process.execPath, args, {
    cwd: root,
    stdio,
    windowsHide: true,
    env,
  });
}

const ensure = spawnSync(process.execPath, [ensureBuildScript], {
  cwd: root,
  stdio: underPm2 ? "pipe" : "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next",
  },
});

if (underPm2 && ensure.stdout) {
  process.stdout.write(ensure.stdout);
}
if (underPm2 && ensure.stderr) {
  process.stderr.write(ensure.stderr);
}

if ((ensure.status ?? 1) !== 0) {
  process.exit(ensure.status ?? 1);
}

const port = process.env.PORT || "3012";

console.log(`[start] production server on http://localhost:${port}`);

const child = spawnNode([nextBin, "start", "-p", port], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next",
  },
});

if (underPm2) {
  pipeChildLogs(child);
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
