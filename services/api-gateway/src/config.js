// src/config.js
const required = (key) => {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
  return process.env[key];
};

module.exports = {
  PORT: process.env.PORT || 8080,

  // Required — will throw if missing
  JWT_ACCESS_SECRET:  required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),

  ACCESS_TOKEN_TTL:  15 * 60,        // 900 seconds
  REFRESH_TOKEN_TTL: 7 * 24 * 3600,  // 604800 seconds

  REDIS_URL: process.env.REDIS_URL || 'redis://redis:6379',

  SERVICES: {
    account:      process.env.ACCOUNT_SERVICE_URL || 'http://account-service:3001',
    transfer:     process.env.TRANSFER_SERVICE_URL || 'http://transfer-service:3002',
    ledger:       process.env.LEDGER_SERVICE_URL || 'http://ledger-service:3003',
    fraud:        process.env.FRAUD_SERVICE_URL || 'http://fraud-service:3004',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3005',
  },
};
