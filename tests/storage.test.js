import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { load, save, KEYS, resetDemoData } from "../js/storage.js";
import { buildSeed, DEMO_USERS } from "../js/data.js";
import { freshStore } from "./helpers.js";

beforeEach(freshStore);

test("初始化後公開物品與非公開驗證資訊分開存放", () => {
  const items = load(KEYS.items);
  const secrets = load(KEYS.secrets);
  assert.equal(items.length, 22);
  for (const it of items) {
    assert.equal("secret" in it, false, `${it.id} 不應含 secret`);
    assert.ok(secrets[it.id], `${it.id} 應有對應的驗證資訊`);
  }
});

test("重置後恢復種子資料", () => {
  save(KEYS.items, []);
  save(KEYS.claims, [{ id: "x" }]);
  resetDemoData();
  assert.equal(load(KEYS.items).length, 22);
  assert.deepEqual(load(KEYS.claims).map((c) => c.id), buildSeed().claims.map((c) => c.id));
});

test("種子資料與示範帳號不含 Email 或手機號碼", () => {
  const text = JSON.stringify({ seed: buildSeed(), users: DEMO_USERS });
  assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  assert.doesNotMatch(text, /09\d{8}/);
});
