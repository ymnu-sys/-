/* 共用畫面元件：原型橫幅、導覽列、頁尾、Toast、物品卡片、權限守門 */
import { initIfEmpty, resetDemoData } from "./storage.js";
import { currentUser, logout, requireLogin, requireRole, userTypeLabel } from "./auth.js";
import { unreadCount } from "./notifications.js";
import { categoryOf, categoryName, PUBLIC_STATUS } from "./items.js";
import { CLAIM_STATUS_LABEL } from "./data.js";
import { escapeHtml } from "./utils.js";

export { escapeHtml };

const FLASH_KEY = "lf_flash";

/* ---------- 版面 ---------- */
export function mountLayout(active = "") {
  initIfEmpty();
  const user = currentUser();
  const here = currentPageRef();

  const navLinks = [
    { key: "home", href: "index.html", label: "首頁" },
    { key: "items", href: "items.html", label: "瀏覽失物" },
    { key: "post", href: "post.html", label: "刊登拾獲物品" }
  ];
  if (user) {
    const n = unreadCount(user.id);
    navLinks.push({ key: "my", href: "my.html", label: "我的專區", extra: n ? `<span class="count-dot" aria-label="${n} 則未讀通知">${n}</span>` : "" });
  }
  if (user?.role === "admin") navLinks.push({ key: "admin", href: "admin.html", label: "審核後台" });

  const userBox = user
    ? `<div class="nav-user">
         <span>👤 ${escapeHtml(user.name)} <span class="role-tag ${user.role}">${userTypeLabel(user)}</span></span>
         <button type="button" class="btn btn-sm btn-ghost" id="logout-btn">登出</button>
       </div>`
    : `<div class="nav-user"><a class="btn btn-sm btn-light" href="login.html?return=${encodeURIComponent(here)}">登入</a></div>`;

  const header = document.createElement("div");
  header.innerHTML = `
    <div class="proto-banner" role="note"><strong>⚠️ 課堂展示原型</strong>資料存在瀏覽器 localStorage，登入為模擬，不具正式資料保護與權限驗證。請勿輸入真實個人資料。</div>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="index.html" aria-label="高科大智慧失物招領平台 首頁">
          <span class="brand-mark" aria-hidden="true">🔍</span>
          <span class="brand-text"><strong>高科大智慧失物招領平台</strong><small>系統分析與設計課程專題</small></span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="開啟選單">☰</button>
        <nav id="site-nav" class="site-nav" aria-label="主要導覽">
          ${navLinks.map((l) => `<a href="${l.href}" class="${l.key === active ? "active" : ""}" ${l.key === active ? 'aria-current="page"' : ""}>${l.label}${l.extra || ""}</a>`).join("")}
          ${userBox}
        </nav>
      </div>
    </header>`;
  document.body.prepend(...header.children);

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <strong>高科大智慧失物招領平台</strong>
          <p class="small">讓真正的失主容易找到物品，但不讓冒領者取得認領所需的關鍵資訊。</p>
        </div>
        <div>
          <p class="small">展示用工具：</p>
          <button type="button" class="btn btn-sm btn-ghost" id="reset-demo">↺ 重置示範資料</button>
        </div>
      </div>
      <p class="footer-note">本網站為「系統分析與設計」課程專題作品（課堂展示原型），非國立高雄科技大學官方系統。所有物品、帳號與學號皆為虛構模擬資料。正式上線前必須改用伺服器端身分驗證、權限控管及安全的資料儲存機制。</p>
    </div>`;
  document.body.append(footer);

  const toastArea = document.createElement("div");
  toastArea.className = "toast-area";
  toastArea.setAttribute("aria-live", "polite");
  document.body.append(toastArea);

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "✕" : "☰";
  });

  document.getElementById("logout-btn")?.addEventListener("click", () => {
    logout();
    setFlash("已登出", "success");
    location.href = "index.html";
  });

  document.getElementById("reset-demo").addEventListener("click", () => {
    if (!confirm("確定要重置示範資料嗎？\n所有新刊登的物品、認領申請與通知都會清除（登入狀態保留）。")) return;
    resetDemoData();
    setFlash("示範資料已重置", "success");
    location.reload();
  });

  showFlash();
  return user;
}

export function currentPageRef() {
  const page = location.pathname.split("/").pop() || "index.html";
  return page + location.search;
}

/* ---------- 權限守門 ---------- */
/** 未登入導向登入頁；角色不符時顯示「權限不足」。通過時回傳使用者。 */
export function guardPage({ role } = {}) {
  const r = role ? requireRole(role) : requireLogin();
  if (r.ok) return r.user;
  if (r.reason === "NOT_LOGGED_IN") {
    location.replace(`login.html?return=${encodeURIComponent(currentPageRef())}`);
    return null;
  }
  const main = document.querySelector("main");
  main.innerHTML = `
    <div class="container section">
      <div class="panel empty">
        <div class="empty-icon">⛔</div>
        <h3>權限不足</h3>
        <p>此頁面僅限管理員使用。你目前以「${escapeHtml(r.user.name)}」身分登入。</p>
        <a class="btn btn-primary" href="index.html">回首頁</a>
      </div>
    </div>`;
  return null;
}

/* ---------- Toast 與跨頁提示 ---------- */
export function toast(message, type = "info", ms = 3500) {
  const area = document.querySelector(".toast-area");
  if (!area) return;
  const icon = { success: "✅", error: "⛔", warning: "⚠️", info: "ℹ️" }[type] || "ℹ️";
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  area.append(el);
  setTimeout(() => { el.classList.add("leaving"); setTimeout(() => el.remove(), 300); }, ms);
}

export function setFlash(message, type = "info") {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type }));
}

function showFlash() {
  const raw = sessionStorage.getItem(FLASH_KEY);
  if (!raw) return;
  sessionStorage.removeItem(FLASH_KEY);
  try {
    const { message, type } = JSON.parse(raw);
    toast(message, type);
  } catch { /* 忽略 */ }
}

/* ---------- 徽章與卡片 ---------- */
const BADGE_CLASS = {
  [PUBLIC_STATUS.AVAILABLE]: "badge-available",
  [PUBLIC_STATUS.PROCESSING]: "badge-processing",
  [PUBLIC_STATUS.RETURNED]: "badge-returned",
  已下架: "badge-hidden",
  PENDING: "badge-pending",
  NEED_INFO: "badge-needinfo",
  APPROVED: "badge-approved",
  REJECTED: "badge-rejected",
  COMPLETED: "badge-completed"
};

export function publicStatusBadge(label) {
  return `<span class="badge ${BADGE_CLASS[label] || ""}">${escapeHtml(label)}</span>`;
}

export function claimStatusBadge(status) {
  return `<span class="badge ${BADGE_CLASS[status] || ""}">${escapeHtml(CLAIM_STATUS_LABEL[status] || status)}</span>`;
}

/** 有照片用照片（已驗證為 data:image），否則顯示類別圖示 */
export function itemVisual(item, { big = false } = {}) {
  const cat = categoryOf(item.category);
  const cls = big ? "detail-photo" : "item-thumb";
  if (item.photo) {
    return `<div class="${cls} cat-${cat.id}"><img src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.name)} 的外觀照片" loading="lazy"></div>`;
  }
  return `<div class="${cls} cat-${cat.id}" role="img" aria-label="${escapeHtml(cat.name)} 類別圖示"><span aria-hidden="true">${cat.icon}</span><span class="thumb-note">未提供照片</span></div>`;
}

export function renderItemCard(item, status) {
  const cat = categoryOf(item.category);
  return `
    <a class="item-card" href="item.html?id=${encodeURIComponent(item.id)}">
      ${itemVisual(item)}
      <div class="item-body">
        <div class="item-top">
          <span class="chip">${cat.icon} ${escapeHtml(categoryName(item.category))}</span>
          ${status ? publicStatusBadge(status) : ""}
        </div>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="item-desc">${escapeHtml(item.publicDesc)}</p>
        <ul class="item-meta">
          <li>📍 ${escapeHtml(item.campus)}・${escapeHtml(item.location)}</li>
          <li>📅 拾獲日期 ${escapeHtml(item.foundDate)}</li>
          <li>🎨 ${escapeHtml(item.color)}</li>
        </ul>
      </div>
    </a>`;
}

export function emptyState(icon, title, body = "", action = "") {
  return `<div class="empty"><div class="empty-icon">${icon}</div><h3>${escapeHtml(title)}</h3>${body ? `<p>${escapeHtml(body)}</p>` : ""}${action}</div>`;
}

/* ---------- 表單錯誤顯示 ---------- */
/** errors: { fieldName: message }；欄位容器需有 data-field 屬性，錯誤訊息元素 id 為 err-欄位名 */
export function showFieldErrors(form, errors) {
  form.querySelectorAll("[data-field]").forEach((wrap) => {
    const name = wrap.dataset.field;
    const msg = errors[name] || "";
    wrap.classList.toggle("invalid", !!msg);
    const errEl = form.querySelector(`#err-${name}`);
    if (errEl) errEl.textContent = msg;
    wrap.querySelectorAll("input, select, textarea").forEach((el) => el.setAttribute("aria-invalid", msg ? "true" : "false"));
  });
  const first = Object.keys(errors)[0];
  if (first) {
    const wrap = form.querySelector(`[data-field="${first}"]`);
    wrap?.scrollIntoView({ behavior: "smooth", block: "center" });
    wrap?.querySelector("input, select, textarea")?.focus({ preventScroll: true });
  }
}

export function params() {
  return new URLSearchParams(location.search);
}
