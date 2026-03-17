import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || process.env.TRANSFERS_DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.TRANSFERS_DB_PORT || '5434', 10),
  database: process.env.DB_NAME || process.env.TRANSFERS_DB_NAME || 'transfers_db',
  user: process.env.DB_USER || process.env.TRANSFERS_DB_USER || 'transfers_user',
  password: process.env.DB_PASSWORD || process.env.TRANSFERS_DB_PASSWORD || 'transfers_pass',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export { pool };
