/* 管理員後台：認領審核與物品管理（只有 admin 角色可進入） */
import { mountLayout, guardPage, escapeHtml, claimStatusBadge, publicStatusBadge, emptyState, toast } from "../ui.js";
import {
  listAllClaims, countByStatus, transition, CLAIM_STATUS as S, CLAIM_STATUS_LABEL, CLAIM_LIMITS
} from "../claims.js";
import { getPublicItem, getItemRecord, getItemSecret, listItemsForAdmin, setItemHidden, categoryOf, derivePublicStatus } from "../items.js";
import { getUserById } from "../auth.js";
import { PICKUP_INFO } from "../data.js";
import { formatDateTime } from "../utils.js";

mountLayout("admin");
const admin = guardPage({ role: "admin" });
const panel = document.getElementById("admin-panel");

const state = { filter: S.PENDING, selectedId: null, openSecrets: new Set() };
const FILTERS = ["ALL", S.PENDING, S.NEED_INFO, S.APPROVED, S.REJECTED, S.COMPLETED];

if (admin) {
  window.addEventListener("hashchange", render);
  document.querySelector(".tabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) location.hash = t.dataset.tab;
  });
  panel.addEventListener("click", onClick);
  panel.addEventListener("change", (e) => {
    if (e.target.id === "onsite-check") document.getElementById("btn-complete").disabled = !e.target.checked;
  });
  render();
}

function currentTab() {
  return location.hash === "#items" ? "items" : "claims";
}

function render() {
  const tab = currentTab();
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tab);
    t.setAttribute("aria-selected", String(t.dataset.tab === tab));
  });
  tab === "claims" ? renderClaims() : renderItems();
}

/* ---------- 認領審核 ---------- */
function renderClaims() {
  const counts = countByStatus(admin);
  const all = listAllClaims(admin);
  const list = state.filter === "ALL" ? all : all.filter((c) => c.status === state.filter);
  if (!list.some((c) => c.id === state.selectedId)) state.selectedId = list[0]?.id || null;

  const chips = FILTERS.map((f) => `
    <button type="button" class="chip-btn ${state.filter === f ? "active" : ""}" data-filter="${f}" aria-pressed="${state.filter === f}">
      ${f === "ALL" ? "全部" : CLAIM_STATUS_LABEL[f]}（${counts[f]}）
    </button>`).join("");

  const rows = list.map((c) => {
    const item = getPublicItem(c.itemId);
    return `
      <button type="button" class="claim-row ${c.id === state.selectedId ? "active" : ""}" data-select="${escapeHtml(c.id)}">
        <span class="row-top"><b>${escapeHtml(item?.name || "（物品已移除）")}</b>${claimStatusBadge(c.status)}</span>
        <small>申請人：${escapeHtml(c.applicantName)}・${escapeHtml(formatDateTime(c.updatedAt))}</small>
      </button>`;
  }).join("");

  panel.innerHTML = `
    <div class="chip-row" style="margin:0 0 18px">${chips}</div>
    <div class="admin-grid">
      <div class="claim-list" aria-label="認領申請列表">
        ${rows || `<div class="panel">${emptyState("✅", "沒有符合條件的申請")}</div>`}
      </div>
      <div id="claim-detail">${state.selectedId ? claimDetail(all.find((c) => c.id === state.selectedId)) : `<div class="panel">${emptyState("👈", "請從左側選擇一筆申請")}</div>`}</div>
    </div>`;
}

function kv(label, value) {
  return `<dl class="kv"><dt>${escapeHtml(label)}</dt><dd>${value ? escapeHtml(value) : '<span class="muted">（未填寫）</span>'}</dd></dl>`;
}

function claimDetail(c) {
  const item = getPublicItem(c.itemId);
  const secret = getItemSecret(c.itemId, admin) || {};
  const cat = item ? categoryOf(item.category) : null;
  const finder = getUserById(getItemRecord(c.itemId)?.finderId);

  let actionBox = "";
  if (c.status === S.PENDING) {
    actionBox = `
      <div class="action-box">
        <h3>審核決定</h3>
        <div class="field">
          <label for="admin-note">給申請人的說明<span class="opt">（拒絕或要求補充時必填）</span></label>
          <textarea id="admin-note" rows="3" maxlength="${CLAIM_LIMITS.note}" placeholder="例如：請描述錢包內部有哪些卡片。"></textarea>
          <p class="hint">⚠️ 說明會傳給申請人，<strong>請勿透露任何驗證特徵</strong>（例如不要寫「是不是有紅色細線？」）。</p>
          <p class="field-error" id="note-error"></p>
        </div>
        <div class="btn-row">
          <button class="btn btn-success" data-action="approve">✅ 核准</button>
          <button class="btn btn-warning" data-action="request_info">📝 要求補充資料</button>
          <button class="btn btn-danger" data-action="reject">❌ 拒絕</button>
        </div>
      </div>`;
  } else if (c.status === S.APPROVED) {
    actionBox = `
      <div class="action-box">
        <h3>現場領取確認</h3>
        <div class="alert alert-info"><span class="alert-icon">🤝</span><div>審核通過 ≠ 已完成領取。${escapeHtml(PICKUP_INFO)}</div></div>
        <label class="check"><input type="checkbox" id="onsite-check"> 我已在現場核對申請人的學生證（身分）與物品特徵，並將物品交還。</label>
        <div class="btn-row"><button class="btn btn-primary" id="btn-complete" data-action="complete" disabled>🎉 確認完成領取</button></div>
        <div class="field">
          <label for="admin-note">現場核對不符時的說明</label>
          <textarea id="admin-note" rows="2" maxlength="${CLAIM_LIMITS.note}" placeholder="例如：現場核對身分不符"></textarea>
          <p class="field-error" id="note-error"></p>
        </div>
        <div class="btn-row"><button class="btn btn-danger" data-action="reject">❌ 現場核對不符，改為審核未通過</button></div>
      </div>`;
  } else if (c.status === S.NEED_INFO) {
    actionBox = `<div class="action-box"><div class="alert alert-warning"><span class="alert-icon">⏳</span><div>已要求申請人補充資料：「${escapeHtml(c.adminNote)}」。申請人補充後會回到待審核。</div></div></div>`;
  } else {
    actionBox = `<div class="action-box"><div class="alert alert-info"><span class="alert-icon">🔒</span><div>此申請已結案（${escapeHtml(CLAIM_STATUS_LABEL[c.status])}），不能再變更狀態。</div></div></div>`;
  }

  return `
    <div class="panel">
      <div class="claim-head">
        <div>
          <h2 style="margin:0">${escapeHtml(item?.name || "（物品已移除）")}</h2>
          <span class="muted small">申請編號 ${escapeHtml(c.id)}・送出於 ${escapeHtml(formatDateTime(c.createdAt))}</span>
        </div>
        ${claimStatusBadge(c.status)}
      </div>
      ${item ? `<p class="small muted" style="margin-top:8px">${cat.icon} ${escapeHtml(cat.name)}・${escapeHtml(item.color)}・${escapeHtml(item.campus)} ${escapeHtml(item.location)}・拾獲 ${escapeHtml(item.foundDate)}・公開狀態 ${publicStatusBadge(derivePublicStatus(item.id))}
        <a href="item.html?id=${encodeURIComponent(item.id)}" target="_blank" rel="noopener">公開頁 ↗</a></p>` : ""}

      <div class="compare-grid">
        <section class="compare-col claimant">
          <h3>📝 申請人描述</h3>
          ${kv("申請人姓名", c.applicantName)}
          ${kv("學號（模擬）", c.studentId)}
          ${kv("聯絡方式", c.contact)}
          ${kv("物品特殊特徵描述", c.description)}
          ${kv("其他證明資訊", c.extraInfo)}
          ${c.supplements.map((s, i) => kv(`補充資料 ${i + 1}（${formatDateTime(s.at)}）`, s.text)).join("")}
        </section>
        <section class="compare-col secret">
          <h3>🔒 拾獲者登記的非公開驗證特徵</h3>
          ${kv("特殊標記", secret.marks)}
          ${kv("內部物品或特殊配件", secret.contents)}
          ${kv("其他特徵", secret.other)}
          ${kv("拾獲者", finder ? `${finder.name}（${finder.username}）` : "")}
          <p class="hint">比對重點：申請人是否主動說出未公開的細節，而不只是重複公開描述。</p>
        </section>
      </div>

      ${actionBox}

      <div class="action-box">
        <h3>處理歷程</h3>
        <ol class="timeline">${c.history.map((h) => {
          const actor = getUserById(h.actorId);
          return `<li><time>${escapeHtml(formatDateTime(h.at))}</time><strong>${escapeHtml(h.from ? CLAIM_STATUS_LABEL[h.from] + " → " : "")}${escapeHtml(CLAIM_STATUS_LABEL[h.to])}</strong>
            <span class="note">${escapeHtml(actor?.name || h.actorId)}${h.note ? "：" + escapeHtml(h.note) : ""}</span></li>`;
        }).join("")}</ol>
      </div>
    </div>`;
}

const CONFIRM = {
  approve: "確定核准此認領申請嗎？\n核准後物品仍需現場核對身分與物品才算領回。",
  request_info: "確定要求申請人補充資料嗎？",
  reject: "確定將此申請改為「審核未通過」嗎？此動作無法復原。",
  complete: "確定已現場核對身分與物品並交還嗎？\n確認後狀態將改為「已完成領取」，同物品其他申請會自動結案。"
};

const SUCCESS = {
  approve: "已核准，已通知申請人至現場領取",
  request_info: "已要求補充資料，已通知申請人",
  reject: "已改為審核未通過，已通知申請人",
  complete: "已完成領取，物品狀態更新為「已領回」"
};

function onClick(e) {
  const filterBtn = e.target.closest("[data-filter]");
  if (filterBtn) { state.filter = filterBtn.dataset.filter; state.selectedId = null; return render(); }

  const sel = e.target.closest("[data-select]");
  if (sel) {
    state.selectedId = sel.dataset.select;
    render();
    if (window.matchMedia("(max-width: 1024px)").matches) document.getElementById("claim-detail").scrollIntoView({ behavior: "smooth" });
    return;
  }

  const act = e.target.closest("[data-action]");
  if (act) return runAction(act.dataset.action);

  const hideBtn = e.target.closest("[data-hide]");
  if (hideBtn) {
    const hide = hideBtn.dataset.hidden !== "true";
    if (hide && !confirm("確定要下架此物品嗎？下架後不會出現在公開列表與搜尋結果。")) return;
    setItemHidden(hideBtn.dataset.hide, hide, admin);
    toast(hide ? "物品已下架" : "物品已重新上架", "success");
    return render();
  }

  const secBtn = e.target.closest("[data-secret]");
  if (secBtn) {
    const id = secBtn.dataset.secret;
    state.openSecrets.has(id) ? state.openSecrets.delete(id) : state.openSecrets.add(id);
    return render();
  }
}

function runAction(action) {
  const note = document.getElementById("admin-note")?.value || "";
  const onsite = document.getElementById("onsite-check")?.checked === true;
  const errEl = document.getElementById("note-error");
  if (errEl) errEl.textContent = "";
  if (!confirm(CONFIRM[action])) return;
  try {
    transition(state.selectedId, action, admin, { note, onsiteVerified: action === "complete" ? onsite : undefined });
    toast(SUCCESS[action], "success");
    render();
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
    toast(err.message, "error");
  }
}

/* ---------- 物品管理 ---------- */
function renderItems() {
  const items = listItemsForAdmin(admin);
  const rows = items.map((it) => {
    const cat = categoryOf(it.category);
    const finder = getUserById(it.finderId);
    const open = state.openSecrets.has(it.id);
    const s = it.secret || {};
    return `
      <tr class="${it.hidden ? "is-hidden" : ""}">
        <td>${cat.icon} <strong>${escapeHtml(it.name)}</strong><br><span class="small muted">${escapeHtml(cat.name)}・${escapeHtml(it.color)}</span></td>
        <td>${escapeHtml(it.campus)}<br><span class="small muted">${escapeHtml(it.location)}</span></td>
        <td>${escapeHtml(it.foundDate)}</td>
        <td>${escapeHtml(finder?.name || "—")}</td>
        <td>${publicStatusBadge(it.publicStatus)} ${it.hidden ? publicStatusBadge("已下架") : ""}</td>
        <td>
          <div class="btn-row">
            <button class="btn btn-sm btn-outline" data-secret="${escapeHtml(it.id)}" aria-expanded="${open}">🔒 ${open ? "隱藏" : "查看"}驗證特徵</button>
            <button class="btn btn-sm ${it.hidden ? "btn-success" : "btn-danger"}" data-hide="${escapeHtml(it.id)}" data-hidden="${it.hidden}">${it.hidden ? "重新上架" : "下架"}</button>
            <a class="btn btn-sm btn-outline" href="item.html?id=${encodeURIComponent(it.id)}">公開頁</a>
          </div>
        </td>
      </tr>
      ${open ? `<tr class="secret-row"><td colspan="6">
        <strong>特殊標記：</strong>${escapeHtml(s.marks || "—")}<br>
        <strong>內部物品或特殊配件：</strong>${escapeHtml(s.contents || "—")}<br>
        <strong>其他特徵：</strong>${escapeHtml(s.other || "—")}
      </td></tr>` : ""}`;
  }).join("");

  panel.innerHTML = `
    <div class="panel">
      <div class="section-head" style="margin-bottom:12px">
        <div><h2>📦 所有拾獲物品（${items.length}）</h2><p>含已下架物品。紫色區塊為非公開驗證特徵，只有管理員看得到。</p></div>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>物品</th><th>拾獲地點</th><th>拾獲日期</th><th>拾獲者</th><th>狀態</th><th>操作</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
