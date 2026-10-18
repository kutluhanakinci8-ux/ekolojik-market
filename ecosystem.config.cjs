const bridgeEnv = {
  POS80_QUEUE_NAME: process.env.POS80_QUEUE_NAME || 'Printer_POS_80C',
  LIMA_RAW_PRINT_PORT: process.env.LIMA_RAW_PRINT_PORT || '18765',
};

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
        RECEIPT_BRIDGE_AUTOSTART: process.env.RECEIPT_BRIDGE_AUTOSTART || '0',
      },
      autorestart: true,
      max_restarts: 10,
      watch: false,
    },
    {
      name: 'lima-receipt-bridge',
      cwd: __dirname,
      script: 'scripts/lima-raw-print-bridge.mjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        ...bridgeEnv,
      },
      autorestart: true,
      max_restarts: 20,
      watch: false,
    },
  ],
};
