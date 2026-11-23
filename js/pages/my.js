import { mountLayout, guardPage, escapeHtml, claimStatusBadge, renderItemCard, emptyState, toast } from "../ui.js";
import { listClaimsForUser, supplement, CLAIM_STATUS as S, CLAIM_STATUS_LABEL, CLAIM_LIMITS } from "../claims.js";
import { getPublicItem, listItemsByFinder, statusMap } from "../items.js";
import { listForUser, unreadCount, markRead, markAllRead } from "../notifications.js";
import { PICKUP_INFO } from "../data.js";
import { formatDateTime } from "../utils.js";

mountLayout("my");
const user = guardPage();
const panel = document.getElementById("tab-panel");
const TABS = ["claims", "notices", "posts"];

const NOTICE_ICON = { SUBMITTED: "📨", NEED_INFO: "📝", APPROVED: "✅", REJECTED: "❌", COMPLETED: "🎉" };

if (user) {
  window.addEventListener("hashchange", render);
  document.querySelector(".tabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) location.hash = t.dataset.tab;
  });
  panel.addEventListener("click", onPanelClick);
  panel.addEventListener("submit", onSupplement);
  render();
}

function currentTab() {
  const h = location.hash.slice(1);
  return TABS.includes(h) ? h : "claims";
}

function updateTabs(active) {
  const unread = unreadCount(user.id);
  document.getElementById("tab-notices").innerHTML = `🔔 通知中心${unread ? ` <span class="count-dot">${unread}</span>` : ""}`;
  document.querySelectorAll(".tab").forEach((t) => {
    const on = t.dataset.tab === active;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", String(on));
  });
  // 同步導覽列的未讀數
  const navDot = document.querySelector('.site-nav a[href="my.html"] .count-dot');
  if (navDot) { unread ? (navDot.textContent = unread) : navDot.remove(); }
}

function render() {
  const tab = currentTab();
  updateTabs(tab);
  if (tab === "claims") renderClaims();
  else if (tab === "notices") renderNotices();
  else renderPosts();
}

/* ---------- 我的認領申請 ---------- */
function statusMessage(c) {
  switch (c.status) {
    case S.PENDING:
      return `<div class="alert alert-info"><span class="alert-icon">⏳</span><div>管理員審核中。送出申請不代表認領成功，結果會以站內通知告訴你。</div></div>`;
    case S.NEED_INFO:
      return `<div class="alert alert-warning"><span class="alert-icon">📝</span><div>
          <p><strong>管理員要求補充資料：</strong>${escapeHtml(c.adminNote)}</p>
          <form class="stack" data-supplement="${escapeHtml(c.id)}" novalidate>
            <label for="sup-${escapeHtml(c.id)}" class="sr-only">補充內容</label>
            <textarea id="sup-${escapeHtml(c.id)}" rows="3" maxlength="${CLAIM_LIMITS.descMax}" placeholder="請依照管理員的要求補充說明（至少 ${CLAIM_LIMITS.supplementMin} 字）"></textarea>
            <p class="field-error" id="sup-err-${escapeHtml(c.id)}"></p>
            <div><button class="btn btn-primary btn-sm" type="submit">送出補充資料</button></div>
          </form>
        </div></div>`;
    case S.APPROVED:
      return `<div class="alert alert-success"><span class="alert-icon">✅</span><div>
          <p><strong>審核通過，但尚未完成領取。</strong></p>
          <p>${escapeHtml(PICKUP_INFO)}</p></div></div>`;
    case S.REJECTED:
      return `<div class="alert alert-danger"><span class="alert-icon">❌</span><div><strong>審核未通過。</strong>原因：${escapeHtml(c.adminNote || "未提供")}</div></div>`;
    case S.COMPLETED:
      return `<div class="alert alert-success"><span class="alert-icon">🎉</span><div><strong>已完成領取。</strong>已於現場核對身分與物品並交還，本申請結案。</div></div>`;
    default:
      return "";
  }
}

function timeline(history) {
  return `<ol class="timeline">${history.map((h) => `
      <li><time>${escapeHtml(formatDateTime(h.at))}</time><strong>${escapeHtml(CLAIM_STATUS_LABEL[h.to])}</strong>
      ${h.note ? `<span class="note">${escapeHtml(h.note)}</span>` : ""}</li>`).join("")}</ol>`;
}

function renderClaims() {
  const claims = listClaimsForUser(user.id);
  if (!claims.length) {
    panel.innerHTML = `<div class="panel">${emptyState("📭", "你還沒有提出任何認領申請", "在失物列表找到你的物品後，點「我要認領」即可提出申請。", '<a class="btn btn-primary" href="items.html">瀏覽失物</a>')}</div>`;
    return;
  }
  panel.innerHTML = claims.map((c) => {
    const item = getPublicItem(c.itemId);
    const name = item ? item.name : "（物品已移除）";
    return `
      <article class="panel claim-card">
        <div class="claim-head">
          <div>
            <h3>${item ? `<a href="item.html?id=${encodeURIComponent(item.id)}">${escapeHtml(name)}</a>` : escapeHtml(name)}</h3>
            <span class="muted small">申請編號 ${escapeHtml(c.id)}・送出於 ${escapeHtml(formatDateTime(c.createdAt))}</span>
          </div>
          ${claimStatusBadge(c.status)}
        </div>
        ${statusMessage(c)}
        <details>
          <summary>我填寫的特徵描述</summary>
          <div class="quote">${escapeHtml(c.description)}</div>
          ${c.extraInfo ? `<div class="quote">${escapeHtml(c.extraInfo)}</div>` : ""}
          ${c.supplements.map((s) => `<div class="quote">【補充 ${escapeHtml(formatDateTime(s.at))}】${escapeHtml(s.text)}</div>`).join("")}
        </details>
        <details ${c.status === S.NEED_INFO ? "" : "open"}>
          <summary>處理歷程</summary>
          <br>${timeline(c.history)}
        </details>
      </article>`;
  }).join("");
}

function onSupplement(e) {
  const form = e.target.closest("[data-supplement]");
  if (!form) return;
  e.preventDefault();
  const id = form.dataset.supplement;
  const text = form.querySelector("textarea").value;
  try {
    supplement(id, user, text);
    toast("補充資料已送出，申請重新進入待審核", "success");
    render();
  } catch (err) {
    document.getElementById(`sup-err-${id}`).textContent = err.message;
    toast(err.message, "error");
  }
}

/* ---------- 通知中心 ---------- */
function renderNotices() {
  const list = listForUser(user.id);
  if (!list.length) {
    panel.innerHTML = `<div class="panel">${emptyState("🔕", "目前沒有通知")}</div>`;
    return;
  }
  panel.innerHTML = `
    <div class="result-info" style="margin-top:0">
      <span>共 ${list.length} 則通知，${unreadCount(user.id)} 則未讀</span>
      <button class="btn btn-sm btn-outline" data-read-all>全部標記已讀</button>
    </div>
    <ul class="notice-list">
      ${list.map((n) => `
        <li class="notice ${n.read ? "" : "unread"}">
          <span class="notice-icon" aria-hidden="true">${NOTICE_ICON[n.type] || "🔔"}</span>
          <div class="notice-body">
            <h4>${n.read ? "" : '<span class="unread-dot" aria-label="未讀"></span>'}${escapeHtml(n.title)}</h4>
            <p>${escapeHtml(n.body)}</p>
            <time>${escapeHtml(formatDateTime(n.createdAt))}</time>
          </div>
          <div class="btn-row">
            <a class="btn btn-sm btn-outline" href="#claims" data-open="${escapeHtml(n.id)}">查看申請</a>
            ${n.read ? "" : `<button class="btn btn-sm btn-outline" data-read="${escapeHtml(n.id)}">標為已讀</button>`}
          </div>
        </li>`).join("")}
    </ul>`;
}

function onPanelClick(e) {
  const read = e.target.closest("[data-read]");
  const open = e.target.closest("[data-open]");
  if (read) {
    markRead(read.dataset.read, user.id);
    render();
  } else if (open) {
    markRead(open.dataset.open, user.id);
  } else if (e.target.closest("[data-read-all]")) {
    markAllRead(user.id);
    toast("已全部標記為已讀", "success");
    render();
  }
}

/* ---------- 我的刊登 ---------- */
function renderPosts() {
  const items = listItemsByFinder(user.id);
  const statuses = statusMap();
  if (!items.length) {
    panel.innerHTML = `<div class="panel">${emptyState("📝", "你還沒有刊登任何物品", "", '<a class="btn btn-accent" href="post.html">刊登拾獲物品</a>')}</div>`;
    return;
  }
  panel.innerHTML = `
    <div class="alert alert-info"><span class="alert-icon">ℹ️</span><div>這裡只顯示公開資訊與公開狀態。認領申請內容與申請人資料只有管理員可以查看。</div></div>
    <br>
    <div class="item-grid">${items.map((it) => renderItemCard(it, it.hidden ? "已下架" : statuses[it.id])).join("")}</div>`;
}
