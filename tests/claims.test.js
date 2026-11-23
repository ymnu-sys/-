import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createClaim, validateClaimForm, transition, applyTransition, supplement, listAllClaims,
  CLAIM_STATUS as S, ClaimError, allowedActions
} from "../js/claims.js";
import { derivePublicStatus, PUBLIC_STATUS, setItemHidden } from "../js/items.js";
import { listForUser } from "../js/notifications.js";
import { freshStore, studentA, studentB, admin, validClaim } from "./helpers.js";

beforeEach(freshStore);

function newClaim(user = studentB, itemId = "i1") {
  const r = createClaim(itemId, validClaim, user);
  assert.equal(r.ok, true, r.error);
  return r.claim;
}

test("缺必填或描述太短、未同意現場核對時驗證失敗", () => {
  const blank = validateClaimForm({});
  for (const f of ["applicantName", "studentId", "contact", "description", "agreeOnsite"]) assert.ok(blank.errors[f], f);
  assert.ok(validateClaimForm({ ...validClaim, description: "黑色的" }).errors.description);
  assert.ok(validateClaimForm({ ...validClaim, agreeOnsite: false }).errors.agreeOnsite);
  assert.equal(validateClaimForm(validClaim).ok, true);
});

test("新申請一定是待審核，並產生「已送出」通知", () => {
  const c = newClaim();
  assert.equal(c.status, S.PENDING);
  assert.equal(c.history.length, 1);
  assert.equal(listForUser(studentB.id)[0].type, "SUBMITTED");
  assert.equal(derivePublicStatus("i1"), PUBLIC_STATUS.PROCESSING);
});

test("規則：不能認領自己刊登的物品", () => {
  assert.equal(createClaim("i1", validClaim, studentA).code, "OWN_ITEM");
});

test("規則：同一物品不能重複提出進行中的申請", () => {
  newClaim();
  assert.equal(createClaim("i1", validClaim, studentB).code, "DUPLICATE");
});

test("規則：已領回或已下架的物品不能申請，管理員與訪客不能申請", () => {
  assert.equal(createClaim("i7", validClaim, studentB).code, "RETURNED");
  setItemHidden("i2", true, admin);
  assert.equal(createClaim("i2", validClaim, studentB).code, "NOT_FOUND");
  assert.equal(createClaim("i1", validClaim, admin).code, "NOT_STUDENT");
  assert.equal(createClaim("i1", validClaim, null).code, "NOT_LOGGED_IN");
});

test("學生不能執行審核動作", () => {
  const c = newClaim();
  assert.throws(() => transition(c.id, "approve", studentB), ClaimError);
  assert.throws(() => transition(c.id, "approve", studentA), ClaimError);
  assert.throws(() => transition(c.id, "approve", null), ClaimError);
});

test("待審核不能直接變成已完成領取", () => {
  const c = newClaim();
  assert.throws(() => transition(c.id, "complete", admin, { onsiteVerified: true }), /不能執行/);
  assert.deepEqual(allowedActions(S.PENDING).sort(), ["approve", "reject", "request_info"]);
});

test("拒絕與要求補充必須填說明", () => {
  const c = newClaim();
  assert.throws(() => transition(c.id, "reject", admin, { note: " " }), /理由/);
  assert.throws(() => transition(c.id, "request_info", admin, {}), /補充/);
});

test("每次轉換都新增歷程與通知", () => {
  const c = newClaim();
  const after = transition(c.id, "request_info", admin, { note: "請描述錢包內的卡片" });
  assert.equal(after.status, S.NEED_INFO);
  assert.equal(after.history.length, 2);
  assert.equal(after.history[1].actorId, admin.id);
  const n = listForUser(studentB.id)[0];
  assert.equal(n.type, "NEED_INFO");
  assert.match(n.body, /請描述錢包內的卡片/);
});

test("補充資料只允許 NEED_INFO → PENDING，且只有申請人本人", () => {
  const c = newClaim();
  assert.throws(() => supplement(c.id, studentB, "補充一些內容"), /不需要補充/);
  transition(c.id, "request_info", admin, { note: "請補充" });
  assert.throws(() => supplement(c.id, studentA, "補充一些內容"), /本人/);
  assert.throws(() => supplement(c.id, studentB, "短"), /至少/);
  const back = supplement(c.id, studentB, "裡面有一張咖啡集點卡");
  assert.equal(back.status, S.PENDING);
  assert.equal(back.supplements.length, 1);
});

test("審核通過不等於已完成領取：完成領取需現場核對", () => {
  const c = newClaim();
  const approved = transition(c.id, "approve", admin);
  assert.equal(approved.status, S.APPROVED);
  assert.equal(derivePublicStatus("i1"), PUBLIC_STATUS.PROCESSING);
  assert.throws(() => transition(c.id, "complete", admin, {}), /現場核對/);
  const done = transition(c.id, "complete", admin, { onsiteVerified: true });
  assert.equal(done.status, S.COMPLETED);
  assert.equal(derivePublicStatus("i1"), PUBLIC_STATUS.RETURNED);
  assert.equal(listForUser(studentB.id)[0].type, "COMPLETED");
});

test("審核通過後現場核對不符可以改為未通過", () => {
  const c = newClaim();
  transition(c.id, "approve", admin);
  assert.equal(transition(c.id, "reject", admin, { note: "現場核對不符" }).status, S.REJECTED);
});

test("終止狀態不能再轉換", () => {
  const c = newClaim();
  transition(c.id, "reject", admin, { note: "描述不符" });
  for (const a of ["approve", "reject", "request_info", "complete"]) {
    assert.throws(() => transition(c.id, a, admin, { note: "x", onsiteVerified: true }), ClaimError);
  }
});

test("同物品只能有一筆審核通過；完成領取後其他進行中申請自動結案", () => {
  // 建立另一個學生身分（模擬第二位申請人）
  const studentC = { id: "u_student_c", role: "student", name: "測試學生 C" };
  const b = newClaim(studentB);
  const c = newClaim(studentC);
  transition(b.id, "approve", admin);
  assert.throws(() => transition(c.id, "approve", admin), /另一筆審核通過/);
  transition(b.id, "complete", admin, { onsiteVerified: true });
  const closed = listAllClaims(admin).find((x) => x.id === c.id);
  assert.equal(closed.status, S.REJECTED);
  assert.equal(listForUser(studentC.id)[0].type, "REJECTED");
});

test("applyTransition 是純函式，不修改原本的申請", () => {
  const c = newClaim();
  const copy = structuredClone(c);
  applyTransition(c, "approve", admin);
  assert.deepEqual(c, copy);
});

test("只有管理員可以列出所有申請", () => {
  assert.throws(() => listAllClaims(studentB), ClaimError);
  assert.ok(listAllClaims(admin).length >= 2);
});
