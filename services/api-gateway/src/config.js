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
    account:      'http://account-service:3001',
    transfer:     'http://transfer-service:3002',
    ledger:       'http://ledger-service:3003',
    fraud:        'http://fraud-service:3004',
    notification: 'http://notification-service:3005',
  },
};
