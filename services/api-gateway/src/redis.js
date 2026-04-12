// src/redis.js
const Redis = require('ioredis');
const { REDIS_URL } = require('./config');
const { logger } = require('./logger');

const client = new Redis(REDIS_URL, { lazyConnect: false });

client.on('error', (err) => {
  logger.error('redis connection error', { error: err.message });
});

module.exports = client;
