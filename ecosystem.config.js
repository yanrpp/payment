module.exports = {
  apps: [
    {
      name: "payment",
      // Windows + PM2: เรียกผ่าน cmd เพื่อลดปัญหา npm.cmd ถูกตีความด้วย node
      script: "cmd",
      args: "/c npm run start",
      cwd: ".",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3008,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3008,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 4000,
    },
  ],
};
