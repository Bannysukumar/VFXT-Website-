/** PM2 config — serves the Vite production build as an SPA. */
module.exports = {
  apps: [
    {
      name: 'vfxt-website',
      cwd: __dirname,
      script: 'npx',
      args: 'serve -s dist -l 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
