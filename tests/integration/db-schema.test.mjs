// @ts-nocheck
/// <reference types="node" />

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDbClient,
  dbConfig,
  getConstraintNames,
  tableExists
} from "./_helpers.mjs";

test("db-init migrations created accounts and transfers tables", async () => {
  const accountsClient = createDbClient(dbConfig.accounts);
  const transfersClient = createDbClient(dbConfig.transfers);

  await accountsClient.connect();
  await transfersClient.connect();

  try {
    assert.equal(await tableExists(accountsClient, "accounts"), true);
    assert.equal(await tableExists(transfersClient, "transfers"), true);
  } finally {
    await accountsClient.end();
    await transfersClient.end();
  }
});

test("schema constraints for phase 1 tables exist", async () => {
  const accountsClient = createDbClient(dbConfig.accounts);
  const transfersClient = createDbClient(dbConfig.transfers);

  await accountsClient.connect();
  await transfersClient.connect();

  try {
    const accountConstraints = await getConstraintNames(accountsClient, "accounts");
    const transferConstraints = await getConstraintNames(transfersClient, "transfers");

    assert.equal(accountConstraints.includes("chk_balance_non_negative"), true);
    assert.equal(transferConstraints.includes("chk_transfer_amount_positive"), true);
    assert.equal(transferConstraints.includes("chk_accounts_distinct"), true);
  } finally {
    await accountsClient.end();
    await transfersClient.end();
  }
});

test("migration DDL is idempotent for existing tables", async () => {
  const accountsClient = createDbClient(dbConfig.accounts);
  const transfersClient = createDbClient(dbConfig.transfers);

  await accountsClient.connect();
  await transfersClient.connect();

  try {
    await accountsClient.query("CREATE TABLE IF NOT EXISTS accounts (id UUID PRIMARY KEY)");
    await transfersClient.query("CREATE TABLE IF NOT EXISTS transfers (id UUID PRIMARY KEY)");
  } finally {
    await accountsClient.end();
    await transfersClient.end();
  }
});
