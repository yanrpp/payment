import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveDistDir() {
  if (process.env.NEXT_DIST_DIR) {
    return process.env.NEXT_DIST_DIR;
  }

  const argv = process.argv;
  const npmScript = process.env.npm_lifecycle_event ?? "";
  const isDevCommand =
    argv.includes("dev") || npmScript === "dev" || npmScript === "dev:clean";

  return isDevCommand ? ".next-dev" : ".next";
}

const distDir = resolveDistDir();
const isWindows = process.platform === "win32";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // แยก cache dev (.next-dev) กับ production (.next) เพื่อกัน manifest พังบน Windows
  distDir,
  reactStrictMode: true,
  // อนุญาตให้ build ได้แม้มี ESLint/Prettier warning (แนะนำให้รัน lint แยกเอง)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ให้ mysql2, oracledb ใช้เฉพาะฝั่ง server (รองรับทั้ง Webpack และ Turbopack)
  serverExternalPackages: ["mysql2", "oracledb"],
  webpack: (config, { isServer, dev }) => {
    // Exclude mysql2 และ oracledb จาก client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        crypto: false,
      };
    }

    // ลด race condition ของ manifest บน Windows (antivirus / file watcher)
    if (dev && isWindows) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ["**/node_modules/**"],
      };
    }

    return config;
  },
  // ตั้งค่า Turbopack ให้สอดคล้องกับ webpack (client ไม่ bundle Node built-ins)
  turbopack: {
    resolveAlias: {
      net: { browser: path.join(__dirname, "lib", "empty-module.js") },
      tls: { browser: path.join(__dirname, "lib", "empty-module.js") },
      fs: { browser: path.join(__dirname, "lib", "empty-module.js") },
      crypto: { browser: path.join(__dirname, "lib", "empty-module.js") },
    },
  },
};

export default nextConfig;
