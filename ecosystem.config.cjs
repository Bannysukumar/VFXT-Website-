/** PM2 config — serves the Vite production build as an SPA on a unique port. */
module.exports = {
  apps: [
    {
      name: 'vfxt-website',
      cwd: __dirname,
      script: 'npx',
      args: 'serve -s dist -l 3029',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 3029,
      },
    },
  ],
};
