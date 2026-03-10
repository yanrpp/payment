import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // อนุญาตให้ build ได้แม้มี ESLint/Prettier warning (แนะนำให้รัน lint แยกเอง)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ให้ mysql2, oracledb ใช้เฉพาะฝั่ง server (รองรับทั้ง Webpack และ Turbopack)
  serverExternalPackages: ["mysql2", "oracledb"],
  webpack: (config, { isServer }) => {
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
