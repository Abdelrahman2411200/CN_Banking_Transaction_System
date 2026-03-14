// @ts-nocheck
/// <reference types="node" />

import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchFn, urls, waitForHttpOk } from "./_helpers.mjs";

test("account and transfer health endpoints return 200", async () => {
  await waitForHttpOk(urls.accountHealth);
  await waitForHttpOk(urls.transferHealth);

  const accountResponse = await fetchFn(urls.accountHealth);
  const transferResponse = await fetchFn(urls.transferHealth);

  assert.equal(accountResponse.status, 200);
  assert.equal(transferResponse.status, 200);
});

test("versioned health endpoints return 200", async () => {
  await waitForHttpOk(urls.accountV1Health);
  await waitForHttpOk(urls.transferV1Health);

  const accountResponse = await fetchFn(urls.accountV1Health);
  const transferResponse = await fetchFn(urls.transferV1Health);

  assert.equal(accountResponse.status, 200);
  assert.equal(transferResponse.status, 200);
});
