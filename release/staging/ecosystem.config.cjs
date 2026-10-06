module.exports = {
  apps: [
    {
      name: 'market-pos',
      cwd: __dirname,
      script: 'server.mjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5180,
        HOST: '0.0.0.0',
      },
      autorestart: true,
      max_restarts: 10,
      watch: false,
    },
  ],
};
