/**
 * PM2 Ecosystem Configuration
 * สำหรับจัดการ Next.js application
 * Port: 3006
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'procurement',
      // ใช้ cmd.exe เพื่อรัน npm.cmd ใน Windows
      script: 'npm.cmd',
      args: 'start',
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3006',
      },
      // Auto restart settings
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Logging - ใช้ relative path
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Advanced settings
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      // ใช้ cmd.exe เป็น interpreter สำหรับ Windows
      interpreter: 'cmd.exe',
      interpreter_args: '/c',
    },
  ],
};
