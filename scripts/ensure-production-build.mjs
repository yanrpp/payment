import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
const root = process.cwd();
const distDir = path.join(root, ".next");

const requiredPaths = [
  "BUILD_ID",
  path.join("server", "pages-manifest.json"),
  path.join("server", "pages", "_app", "build-manifest.json"),
];

function productionBuildIsReady() {
  if (!fs.existsSync(distDir)) return false;

  return requiredPaths.every((relativePath) => fs.existsSync(path.join(distDir, relativePath)));
}

if (productionBuildIsReady()) {
  console.log("[build] production artifacts found in .next");
  process.exit(0);
}

console.log("[build] production build missing or incomplete — running npm run build...");
const result = spawnSync("npm", ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next",
  },
});

process.exit(result.status ?? 1);
