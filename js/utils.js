/* 共用純函式（不存取 DOM，可在 Node 測試） */

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

/** 將任意值轉成可安全放進 HTML 的字串，避免 XSS */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"'`]/g, (ch) => HTML_ESCAPES[ch]);
}

/** 以「本地時間」產生 YYYY-MM-DD（避免 toISOString 的 UTC 時差問題） */
export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${todayStr(d)} ${hh}:${mm}`;
}

export function clean(value) {
  return String(value ?? "").trim();
}

/** 全形英數轉半形，讓敏感資料偵測不會被全形字繞過 */
export function toHalfWidth(value) {
  return String(value ?? "")
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
}

/** 只允許站內相對頁面作為登入後導回網址，防止開放式重新導向 */
export function safeReturnUrl(value) {
  if (typeof value !== "string") return null;
  return /^[a-z]+\.html(\?[A-Za-z0-9_=&%.\-]*)?(#[A-Za-z0-9_-]*)?$/.test(value) ? value : null;
}
