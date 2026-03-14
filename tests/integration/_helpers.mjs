// @ts-nocheck
/// <reference types="node" />

import pg from "pg";

const { Client } = pg;
const env = globalThis.process?.env ?? {};
const fetchFn = globalThis.fetch;
const sleepFn = globalThis.setTimeout;

if (!fetchFn) {
  throw new Error("Global fetch is not available in this Node runtime");
}

const urls = {
  accountHealth: env.ACCOUNT_HEALTH_URL ?? "http://localhost:3001/health",
  transferHealth: env.TRANSFER_HEALTH_URL ?? "http://localhost:3002/health",
  accountV1Health: env.ACCOUNT_V1_HEALTH_URL ?? "http://localhost:3001/v1/health",
  transferV1Health: env.TRANSFER_V1_HEALTH_URL ?? "http://localhost:3002/v1/health",
  accountPlaceholder: env.ACCOUNTS_PLACEHOLDER_URL ?? "http://localhost:3001/v1/accounts",
  transferPlaceholder: env.TRANSFERS_PLACEHOLDER_URL ?? "http://localhost:3002/v1/transfers"
};

const dbConfig = {
  accounts: {
    host: env.ACCOUNTS_DB_HOST ?? "localhost",
    port: Number(env.ACCOUNTS_DB_HOST_PORT ?? "5433"),
    database: env.ACCOUNTS_DB_NAME ?? "accounts_db",
    user: env.ACCOUNTS_DB_USER ?? "accounts_user",
    password: env.ACCOUNTS_DB_PASSWORD ?? "accounts_pass"
  },
  transfers: {
    host: env.TRANSFERS_DB_HOST ?? "localhost",
    port: Number(env.TRANSFERS_DB_HOST_PORT ?? "5434"),
    database: env.TRANSFERS_DB_NAME ?? "transfers_db",
    user: env.TRANSFERS_DB_USER ?? "transfers_user",
    password: env.TRANSFERS_DB_PASSWORD ?? "transfers_pass"
  }
};

async function waitForHttpOk(url, maxRetries = 30, sleepMs = 1000) {
  for (let i = 0; i < maxRetries; i += 1) {
    try {
      const response = await fetchFn(url);
      if (response.status === 200) return;
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => sleepFn(resolve, sleepMs));
  }
  throw new Error(`Timed out waiting for HTTP 200 at ${url}`);
}

async function tableExists(client, tableName) {
  const result = await client.query(
    "SELECT to_regclass($1) AS table_name",
    [`public.${tableName}`]
  );
  return result.rows[0]?.table_name === tableName;
}

async function getConstraintNames(client, tableName) {
  const result = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = $1::regclass
    `,
    [tableName]
  );
  return result.rows.map((row) => row.conname);
}

function createDbClient(config) {
  return new Client(config);
}

export {
  createDbClient,
  dbConfig,
  fetchFn,
  getConstraintNames,
  tableExists,
  urls,
  waitForHttpOk
};
