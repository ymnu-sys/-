/* 模擬登入（課堂展示用，非正式身分驗證）
 * 密碼比對在前端進行、session 存在 localStorage，任何人都能透過開發者工具修改。
 * 正式上線必須改為伺服器端驗證（例如學校 SSO）與伺服器端權限檢查。 */
import { DEMO_USERS } from "./data.js";
import { load, save, remove, KEYS } from "./storage.js";
import { clean } from "./utils.js";

export const ROLE_LABEL = Object.freeze({ student: "學生", admin: "管理員" });

function withoutPassword(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

export function login(username, password) {
  const user = DEMO_USERS.find((u) => u.username === clean(username));
  if (!user || user.password !== String(password ?? "")) {
    return { ok: false, error: "帳號或密碼錯誤" };
  }
  save(KEYS.session, { userId: user.id, loginAt: new Date().toISOString() });
  return { ok: true, user: withoutPassword(user) };
}

export function logout() {
  remove(KEYS.session);
}

export function currentUser() {
  const session = load(KEYS.session);
  if (!session) return null;
  return withoutPassword(DEMO_USERS.find((u) => u.id === session.userId));
}

export function getUserById(id) {
  return withoutPassword(DEMO_USERS.find((u) => u.id === id));
}

export function isAdmin(user) {
  return !!user && user.role === "admin";
}

export function requireLogin(user = currentUser()) {
  return user ? { ok: true, user } : { ok: false, reason: "NOT_LOGGED_IN" };
}

export function requireRole(role, user = currentUser()) {
  if (!user) return { ok: false, reason: "NOT_LOGGED_IN" };
  if (user.role !== role) return { ok: false, reason: "FORBIDDEN", user };
  return { ok: true, user };
}
