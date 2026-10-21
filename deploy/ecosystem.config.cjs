// PM2 process file. On the server, from the backend folder:
//   npm ci && npm run build && pm2 start deploy/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "hscodematch-api",
      cwd: __dirname + "/..",
      script: "dist/server.js",
      node_args: "--env-file=.env",
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      max_memory_restart: "300M",
      kill_timeout: 10000,
      time: true,
    },
  ],
};
