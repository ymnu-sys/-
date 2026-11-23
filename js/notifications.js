/* 站內通知（課堂原型以站內訊息取代 Email／簡訊） */
import { load, save, KEYS, genId } from "./storage.js";
import { PICKUP_INFO } from "./data.js";

export const NOTIFY_TYPE = Object.freeze({
  SUBMITTED: "SUBMITTED",
  NEED_INFO: "NEED_INFO",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED"
});

const TEMPLATES = {
  SUBMITTED: (name) => ({
    title: "認領申請已送出",
    body: `你對「${name}」的認領申請已送出，等待管理員審核。送出申請不代表認領成功。`
  }),
  NEED_INFO: (name, note) => ({
    title: "管理員要求補充資料",
    body: `你對「${name}」的認領申請需要補充資料：${note}。請至「我的專區」補充後重新送出。`
  }),
  APPROVED: (name) => ({
    title: "認領申請審核通過",
    body: `你對「${name}」的認領申請已審核通過，但尚未完成領取。${PICKUP_INFO}`
  }),
  REJECTED: (name, note) => ({
    title: "認領申請審核未通過",
    body: `你對「${name}」的認領申請未通過審核。原因：${note}`
  }),
  COMPLETED: (name) => ({
    title: "物品已完成領取",
    body: `「${name}」已於現場核對後完成領取，本申請結案。`
  })
};

function all() {
  return load(KEYS.notifications, []);
}

export function createNotification({ userId, type, claimId = null, itemId = null, itemName = "物品", note = "" }) {
  const tpl = TEMPLATES[type];
  if (!tpl) throw new Error(`未知的通知類型：${type}`);
  const { title, body } = tpl(itemName, note);
  const n = { id: genId("n"), userId, type, claimId, itemId, title, body, read: false, createdAt: new Date().toISOString() };
  const list = all();
  list.push(n);
  save(KEYS.notifications, list);
  return n;
}

/** 新到舊；時間相同時，後寫入的排前面 */
export function listForUser(userId) {
  return all()
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.userId === userId)
    .sort((a, b) => b.n.createdAt.localeCompare(a.n.createdAt) || b.i - a.i)
    .map(({ n }) => n);
}

export function unreadCount(userId) {
  return all().filter((n) => n.userId === userId && !n.read).length;
}

/** 只能把「自己的」通知標為已讀 */
export function markRead(id, userId) {
  const list = all();
  const n = list.find((x) => x.id === id && x.userId === userId);
  if (!n) return false;
  n.read = true;
  save(KEYS.notifications, list);
  return true;
}

export function markAllRead(userId) {
  const list = all();
  list.forEach((n) => { if (n.userId === userId) n.read = true; });
  save(KEYS.notifications, list);
}
