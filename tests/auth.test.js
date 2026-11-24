import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { login, logout, currentUser, requireRole, requireLogin } from "../js/auth.js";
import { safeReturnUrl } from "../js/utils.js";
import { freshStore } from "./helpers.js";

beforeEach(() => { freshStore(); logout(); });

test("帳號或密碼錯誤時登入失敗", () => {
  assert.equal(login("student_a", "wrong").ok, false);
  assert.equal(login("nobody", "demo1234").ok, false);
  assert.equal(currentUser(), null);
});

test("登入成功後 currentUser 不含密碼", () => {
  const r = login("student_a", "demo1234");
  assert.equal(r.ok, true);
  assert.equal(currentUser().id, "u_student_a");
  assert.equal("password" in currentUser(), false);
});

test("學生無法通過 requireRole('admin')，管理員可以", () => {
  login("student_b", "demo1234");
  assert.deepEqual(requireRole("admin").ok, false);
  assert.equal(requireRole("admin").reason, "FORBIDDEN");
  login("admin", "admin1234");
  assert.equal(requireRole("admin").ok, true);
});

test("登出後 currentUser 為 null，requireLogin 失敗", () => {
  login("student_a", "demo1234");
  logout();
  assert.equal(currentUser(), null);
  assert.equal(requireLogin().reason, "NOT_LOGGED_IN");
});

test("登入後導回網址只接受站內頁面", () => {
  assert.equal(safeReturnUrl("claim.html?item=i1"), "claim.html?item=i1");
  assert.equal(safeReturnUrl("https://evil.example/"), null);
  assert.equal(safeReturnUrl("//evil.example"), null);
  assert.equal(safeReturnUrl("javascript:alert(1)"), null);
});

test("校外人士示範帳號可登入，為學生權限（不是管理員）", async () => {
  const { userTypeLabel, isExternal } = await import("../js/auth.js");
  const r = login("visitor", "demo1234");
  assert.equal(r.ok, true);
  assert.equal(isExternal(r.user), true);
  assert.equal(userTypeLabel(r.user), "校外人士");
  assert.equal(requireRole("admin").ok, false);
  assert.equal(requireRole("student").ok, true);
});
