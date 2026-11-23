import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createNotification, listForUser, unreadCount, markRead, markAllRead } from "../js/notifications.js";
import { freshStore, studentA, studentB } from "./helpers.js";

beforeEach(freshStore);

test("依使用者篩選通知並計算未讀數", () => {
  const before = unreadCount(studentB.id);
  createNotification({ userId: studentB.id, type: "APPROVED", itemName: "黑色短夾" });
  createNotification({ userId: studentA.id, type: "SUBMITTED", itemName: "保溫瓶" });
  assert.equal(unreadCount(studentB.id), before + 1);
  assert.ok(listForUser(studentB.id).every((n) => n.userId === studentB.id));
  assert.match(listForUser(studentB.id)[0].body, /尚未完成領取/);
});

test("只能把自己的通知標為已讀", () => {
  const n = createNotification({ userId: studentB.id, type: "SUBMITTED", itemName: "x" });
  assert.equal(markRead(n.id, studentA.id), false);
  assert.equal(markRead(n.id, studentB.id), true);
  markAllRead(studentB.id);
  assert.equal(unreadCount(studentB.id), 0);
});

test("未知通知類型會丟出錯誤", () => {
  assert.throws(() => createNotification({ userId: studentB.id, type: "HACKED" }));
});
