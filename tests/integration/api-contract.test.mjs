// @ts-nocheck
/// <reference types="node" />

import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchFn, urls } from "./_helpers.mjs";

test("placeholder endpoints return 501 with standard error payload", async () => {
  const accountResponse = await fetchFn(urls.accountPlaceholder);
  const transferResponse = await fetchFn(urls.transferPlaceholder, { method: "POST" });

  assert.equal(accountResponse.status, 501);
  assert.equal(transferResponse.status, 501);

  const accountBody = await accountResponse.json();
  const transferBody = await transferResponse.json();

  assert.equal(accountBody.success, false);
  assert.equal(accountBody.error?.code, "NOT_IMPLEMENTED");
  assert.equal(transferBody.success, false);
  assert.equal(transferBody.error?.code, "NOT_IMPLEMENTED");
});
