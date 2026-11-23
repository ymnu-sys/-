/* 儲存層：包裝 localStorage。
 * 注意：這是課堂展示原型。localStorage 的內容可用瀏覽器開發者工具直接查看與修改，
 * 不具正式系統等級的資料保護。正式上線必須改用伺服器端資料庫與權限控管。 */
import { buildSeed } from "./data.js";

export const KEYS = Object.freeze({
  items: "lf_items",
  secrets: "lf_secrets",
  claims: "lf_claims",
  notifications: "lf_notifications",
  session: "lf_session"
});

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear()
  };
}

let backend = null;

function getBackend() {
  if (!backend) {
    backend = typeof window !== "undefined" && window.localStorage ? window.localStorage : createMemoryStorage();
  }
  return backend;
}

/** 測試時注入記憶體儲存 */
export function setBackend(b) {
  backend = b;
}

export function load(key, fallback = null) {
  try {
    const raw = getBackend().getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    getBackend().setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("瀏覽器儲存空間不足，請刪除部分照片或重置示範資料後再試。");
  }
}

export function remove(key) {
  getBackend().removeItem(key);
}

export function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** 把種子資料拆成「公開物品」與「非公開驗證資訊」兩份分開存放 */
export function resetDemoData() {
  const seed = buildSeed();
  const items = [];
  const secrets = {};
  for (const it of seed.items) {
    const { secret, ...publicPart } = it;
    items.push(publicPart);
    secrets[it.id] = secret;
  }
  save(KEYS.items, items);
  save(KEYS.secrets, secrets);
  save(KEYS.claims, seed.claims);
  save(KEYS.notifications, seed.notifications);
}

export function initIfEmpty() {
  if (load(KEYS.items) == null) resetDemoData();
}
