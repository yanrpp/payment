import { spawn, spawnSync } from "child_process";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);
const root = process.cwd();
const nextBin = require.resolve("next/dist/bin/next");
const ensureBuildScript = path.join(root, "scripts", "ensure-production-build.mjs");

const ensure = spawnSync(process.execPath, [ensureBuildScript], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next",
  },
});

if ((ensure.status ?? 1) !== 0) {
  process.exit(ensure.status ?? 1);
}

const port = process.env.PORT || "3012";

console.log(`[start] production server on http://localhost:${port}`);

const child = spawn(process.execPath, [nextBin, "start", "-p", port], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
