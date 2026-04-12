import { Pool } from 'pg';
import { logger } from './logger';

const pool = new Pool({
  host: process.env.DB_HOST || process.env.ACCOUNTS_DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.ACCOUNTS_DB_PORT || '5433', 10),
  database: process.env.DB_NAME || process.env.ACCOUNTS_DB_NAME || 'accounts_db',
  user: process.env.DB_USER || process.env.ACCOUNTS_DB_USER || 'accounts_user',
  password: process.env.DB_PASSWORD || process.env.ACCOUNTS_DB_PASSWORD || 'accounts_pass',
});

pool.on('error', (err) => {
  logger.error('unexpected error on idle PostgreSQL client', { error: err.message });
});

export { pool };
