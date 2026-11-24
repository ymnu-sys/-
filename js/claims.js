/* 認領申請與審核狀態機
 * 規則：
 * 1. 送出申請只會進入「待審核」，任何人都不能直接認領成功。
 * 2. 只有管理員可以核准、拒絕、要求補充、完成領取。
 * 3. 「審核通過」≠「已完成領取」：必須現場核對身分與物品後，才能改為已完成領取。 */
import { CLAIM_STATUS, CLAIM_STATUS_LABEL } from "./data.js";
import { load, save, KEYS, genId } from "./storage.js";
import { getItemRecord, derivePublicStatus, PUBLIC_STATUS } from "./items.js";
import { createNotification, NOTIFY_TYPE } from "./notifications.js";
import { clean } from "./utils.js";

export { CLAIM_STATUS, CLAIM_STATUS_LABEL };

const S = CLAIM_STATUS;
export const ACTIVE_STATUSES = Object.freeze([S.PENDING, S.NEED_INFO, S.APPROVED]);
export const FINAL_STATUSES = Object.freeze([S.REJECTED, S.COMPLETED]);

export const CLAIM_LIMITS = Object.freeze({ name: 20, contact: 50, descMin: 15, descMax: 500, extra: 500, note: 300, supplementMin: 5 });

export class ClaimError extends Error {}

/** 管理員動作與允許的狀態轉換 */
export const ACTIONS = Object.freeze({
  request_info: { label: "要求補充資料", from: [S.PENDING], to: S.NEED_INFO, noteRequired: "請填寫需要申請人補充的內容", notify: NOTIFY_TYPE.NEED_INFO },
  approve: { label: "核准", from: [S.PENDING], to: S.APPROVED, notify: NOTIFY_TYPE.APPROVED },
  reject: { label: "拒絕", from: [S.PENDING, S.APPROVED], to: S.REJECTED, noteRequired: "請填寫拒絕理由", notify: NOTIFY_TYPE.REJECTED },
  complete: { label: "確認完成領取", from: [S.APPROVED], to: S.COMPLETED, requireOnsite: true, notify: NOTIFY_TYPE.COMPLETED }
});

export function allowedActions(status) {
  return Object.keys(ACTIONS).filter((k) => ACTIONS[k].from.includes(status));
}

function allClaims() {
  return load(KEYS.claims, []);
}

/** 純函式：依狀態機計算轉換後的申請，不合法時丟出 ClaimError */
export function applyTransition(claim, action, actor, payload = {}, now = new Date().toISOString()) {
  if (!actor || actor.role !== "admin") throw new ClaimError("只有管理員可以執行審核操作");
  const rule = ACTIONS[action];
  if (!rule) throw new ClaimError(`未知的審核動作：${action}`);
  if (!rule.from.includes(claim.status)) {
    throw new ClaimError(`目前狀態「${CLAIM_STATUS_LABEL[claim.status]}」不能執行「${rule.label}」`);
  }
  const note = clean(payload.note);
  if (rule.noteRequired && !note) throw new ClaimError(rule.noteRequired);
  if (note.length > CLAIM_LIMITS.note) throw new ClaimError(`說明最多 ${CLAIM_LIMITS.note} 字`);
  if (rule.requireOnsite && payload.onsiteVerified !== true) {
    throw new ClaimError("必須先現場核對申請人身分與物品，才能確認完成領取");
  }
  return {
    ...claim,
    status: rule.to,
    adminNote: note || claim.adminNote,
    updatedAt: now,
    history: [...claim.history, { from: claim.status, to: rule.to, actorId: actor.id, note, at: now }]
  };
}

/** 執行審核動作並儲存、通知申請人 */
export function transition(claimId, action, actor, payload = {}) {
  const claims = allClaims();
  const idx = claims.findIndex((c) => c.id === claimId);
  if (idx < 0) throw new ClaimError("找不到認領申請");
  const current = claims[idx];

  if (action === "approve" && claims.some((c) => c.itemId === current.itemId && c.id !== current.id && c.status === S.APPROVED)) {
    throw new ClaimError("此物品已有另一筆審核通過的申請，請先完成或拒絕該申請");
  }

  const next = applyTransition(current, action, actor, payload);
  claims[idx] = next;
  const itemName = getItemRecord(next.itemId)?.name || "物品";
  const toNotify = [{ claim: next, type: ACTIONS[action].notify, note: next.history.at(-1).note }];

  // 完成領取後，同物品的其他進行中申請自動結案
  if (next.status === S.COMPLETED) {
    const now = new Date().toISOString();
    const autoNote = "物品已由他人完成領取";
    claims.forEach((c, i) => {
      if (c.itemId === next.itemId && c.id !== next.id && ACTIVE_STATUSES.includes(c.status)) {
        claims[i] = {
          ...c, status: S.REJECTED, adminNote: autoNote, updatedAt: now,
          history: [...c.history, { from: c.status, to: S.REJECTED, actorId: actor.id, note: autoNote, at: now }]
        };
        toNotify.push({ claim: claims[i], type: NOTIFY_TYPE.REJECTED, note: autoNote });
      }
    });
  }

  save(KEYS.claims, claims);
  for (const n of toNotify) {
    createNotification({ userId: n.claim.claimantId, type: n.type, claimId: n.claim.id, itemId: n.claim.itemId, itemName, note: n.note });
  }
  return next;
}

/* ---------- 認領者 ---------- */
/** requireStudentId：高科大學生必填；校外人士沒有學號，可以不填（有填就檢查格式） */
export function validateClaimForm(data = {}, { requireStudentId = true } = {}) {
  const v = {
    applicantName: clean(data.applicantName),
    studentId: clean(data.studentId).toUpperCase(),
    contact: clean(data.contact),
    description: clean(data.description),
    extraInfo: clean(data.extraInfo),
    agreeOnsite: data.agreeOnsite === true
  };
  const errors = {};
  if (!v.applicantName) errors.applicantName = "請填寫申請人姓名";
  else if (v.applicantName.length > CLAIM_LIMITS.name) errors.applicantName = `姓名最多 ${CLAIM_LIMITS.name} 字`;

  if (!v.studentId) {
    if (requireStudentId) errors.studentId = "請填寫學號（課堂原型請使用模擬學號）";
  } else if (!/^[A-Z0-9]{4,12}$/.test(v.studentId)) errors.studentId = "學號格式為 4–12 個英文字母或數字";

  if (!v.contact) errors.contact = "請填寫聯絡方式";
  else if (v.contact.length > CLAIM_LIMITS.contact) errors.contact = `聯絡方式最多 ${CLAIM_LIMITS.contact} 字`;

  if (!v.description) errors.description = "請自行描述物品的特殊特徵";
  else if (v.description.length < CLAIM_LIMITS.descMin) errors.description = `特徵描述至少 ${CLAIM_LIMITS.descMin} 字，請盡量具體`;
  else if (v.description.length > CLAIM_LIMITS.descMax) errors.description = `特徵描述最多 ${CLAIM_LIMITS.descMax} 字`;

  if (v.extraInfo.length > CLAIM_LIMITS.extra) errors.extraInfo = `其他資訊最多 ${CLAIM_LIMITS.extra} 字`;
  if (!v.agreeOnsite) errors.agreeOnsite = "請勾選同意審核通過後至現場核對身分與物品";

  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export function getActiveClaimForUser(itemId, userId, claims = allClaims()) {
  return claims.find((c) => c.itemId === itemId && c.claimantId === userId && ACTIVE_STATUSES.includes(c.status)) || null;
}

/** 檢查使用者是否可以對此物品提出申請 */
export function checkClaimEligibility(itemId, user) {
  if (!user) return { ok: false, code: "NOT_LOGGED_IN", error: "請先登入後再提出認領申請" };
  if (user.role !== "student") return { ok: false, code: "NOT_STUDENT", error: "管理員帳號不能提出認領申請" };
  const item = getItemRecord(itemId);
  if (!item || item.hidden) return { ok: false, code: "NOT_FOUND", error: "找不到此物品，或物品已下架" };
  if (item.finderId === user.id) return { ok: false, code: "OWN_ITEM", error: "不能認領自己刊登的物品" };
  const claims = allClaims();
  if (derivePublicStatus(itemId, claims) === PUBLIC_STATUS.RETURNED) return { ok: false, code: "RETURNED", error: "此物品已完成領取，無法再提出申請" };
  if (getActiveClaimForUser(itemId, user.id, claims)) {
    return { ok: false, code: "DUPLICATE", error: "你已經對此物品提出申請，請到「我的專區」查看進度" };
  }
  return { ok: true };
}

export function createClaim(itemId, data, user) {
  const elig = checkClaimEligibility(itemId, user);
  if (!elig.ok) return { ok: false, error: elig.error, code: elig.code };
  const { ok, errors, value } = validateClaimForm(data, { requireStudentId: user.affiliation !== "external" });
  if (!ok) return { ok: false, errors };

  const now = new Date().toISOString();
  const claim = {
    id: genId("c"),
    itemId,
    claimantId: user.id,
    applicantName: value.applicantName,
    studentId: value.studentId,
    contact: value.contact,
    description: value.description,
    extraInfo: value.extraInfo,
    status: S.PENDING,
    adminNote: "",
    supplements: [],
    history: [{ from: null, to: S.PENDING, actorId: user.id, note: "送出認領申請", at: now }],
    createdAt: now,
    updatedAt: now
  };
  const claims = allClaims();
  claims.push(claim);
  save(KEYS.claims, claims);
  createNotification({ userId: user.id, type: NOTIFY_TYPE.SUBMITTED, claimId: claim.id, itemId, itemName: getItemRecord(itemId).name });
  return { ok: true, claim };
}

/** 申請人補充資料：只允許 NEED_INFO → PENDING */
export function supplement(claimId, user, text) {
  const claims = allClaims();
  const idx = claims.findIndex((c) => c.id === claimId);
  if (idx < 0) throw new ClaimError("找不到認領申請");
  const c = claims[idx];
  if (!user || c.claimantId !== user.id) throw new ClaimError("只有申請人本人可以補充資料");
  if (c.status !== S.NEED_INFO) throw new ClaimError("目前狀態不需要補充資料");
  const t = clean(text);
  if (t.length < CLAIM_LIMITS.supplementMin) throw new ClaimError(`補充內容至少 ${CLAIM_LIMITS.supplementMin} 字`);
  if (t.length > CLAIM_LIMITS.descMax) throw new ClaimError(`補充內容最多 ${CLAIM_LIMITS.descMax} 字`);
  const now = new Date().toISOString();
  claims[idx] = {
    ...c,
    status: S.PENDING,
    updatedAt: now,
    supplements: [...c.supplements, { text: t, at: now }],
    history: [...c.history, { from: S.NEED_INFO, to: S.PENDING, actorId: user.id, note: "申請人已補充資料，重新送審", at: now }]
  };
  save(KEYS.claims, claims);
  return claims[idx];
}

function newestFirst(list) {
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.updatedAt.localeCompare(a.c.updatedAt) || b.i - a.i)
    .map(({ c }) => c);
}

export function listClaimsForUser(userId) {
  return newestFirst(allClaims().filter((c) => c.claimantId === userId));
}

/* ---------- 管理員 ---------- */
function assertAdmin(actor) {
  if (!actor || actor.role !== "admin") throw new ClaimError("權限不足：只有管理員可以查看所有認領申請");
}

export function listAllClaims(actor) {
  assertAdmin(actor);
  return newestFirst(allClaims());
}

export function countByStatus(actor) {
  const counts = { ALL: 0 };
  Object.keys(S).forEach((k) => { counts[k] = 0; });
  for (const c of listAllClaims(actor)) { counts[c.status]++; counts.ALL++; }
  return counts;
}
