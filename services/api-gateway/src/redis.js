// src/redis.js
const Redis = require('ioredis');
const { REDIS_URL } = require('./config');

const client = new Redis(REDIS_URL, { lazyConnect: false });

client.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

module.exports = client;
