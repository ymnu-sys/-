/* 物品詳情：只顯示公開欄位與公開狀態，永遠不讀取非公開驗證資訊 */
import { mountLayout, escapeHtml, itemVisual, publicStatusBadge, emptyState, params } from "../ui.js";
import { getPublicItem, derivePublicStatus, isFinder, categoryOf, PUBLIC_STATUS } from "../items.js";
import { getActiveClaimForUser, CLAIM_STATUS_LABEL } from "../claims.js";

const user = mountLayout("items");
const root = document.getElementById("detail-root");
const id = params().get("id") || "";
const item = getPublicItem(id);

if (!item || (item.hidden && user?.role !== "admin")) {
  root.innerHTML = `<div class="panel">${emptyState("🔎", "找不到這件物品", "物品可能已下架，或網址不正確。",
    '<a class="btn btn-primary" href="items.html">回到失物列表</a>')}</div>`;
} else {
  document.title = `${item.name}｜高科大智慧失物招領平台（課堂展示原型）`;
  const cat = categoryOf(item.category);
  const status = derivePublicStatus(item.id);
  root.innerHTML = `
    <div class="breadcrumb muted small"><a href="index.html">首頁</a> / <a href="items.html">瀏覽失物</a> / ${escapeHtml(item.name)}</div>
    ${item.hidden ? '<div class="alert alert-warning"><span class="alert-icon">🙈</span><div>此物品已由管理員下架，一般使用者看不到此頁面。</div></div><br>' : ""}
    <div class="detail-grid">
      <div>
        ${itemVisual(item, { big: true })}
        <p class="hint">照片僅呈現大致外觀，不含證件號碼、卡片內容或可辨識的特殊標記。</p>
      </div>
      <div class="panel">
        <div class="detail-title">
          <h1>${escapeHtml(item.name)}</h1>
          ${publicStatusBadge(status)}
        </div>
        <span class="chip">${cat.icon} ${escapeHtml(cat.name)}</span>
        <dl class="info-list">
          <dt>大致顏色</dt><dd>${escapeHtml(item.color)}</dd>
          <dt>拾獲日期</dt><dd>${escapeHtml(item.foundDate)}</dd>
          <dt>拾獲地點</dt><dd>${escapeHtml(item.campus)}・${escapeHtml(item.location)}</dd>
          <dt>目前狀態</dt><dd>${escapeHtml(status)}</dd>
        </dl>
        <div class="public-desc">${escapeHtml(item.publicDesc)}</div>
        <div id="claim-area"></div>
        <div class="alert alert-secret" style="margin-top:16px">
          <span class="alert-icon">🔒</span>
          <div>
            <p><strong>防冒領說明</strong></p>
            <p>物品的內部內容、特殊標記與其他驗證細節不公開。提出認領時請自行描述，管理員審核並於現場核對身分與物品後才能領回。</p>
          </div>
        </div>
      </div>
    </div>`;
  renderClaimArea(status);
}

function renderClaimArea(status) {
  const area = document.getElementById("claim-area");
  const claimHref = `claim.html?item=${encodeURIComponent(item.id)}`;

  if (status === PUBLIC_STATUS.RETURNED) {
    area.innerHTML = `<button class="btn btn-primary btn-lg btn-block" disabled>✅ 此物品已領回</button>`;
    return;
  }
  if (user?.role === "admin") {
    area.innerHTML = `<div class="alert alert-info"><span class="alert-icon">🛡️</span><div>管理員帳號不能提出認領。驗證特徵請至 <a href="admin.html#items">審核後台 › 物品管理</a> 查看。</div></div>`;
    return;
  }
  if (user && isFinder(item.id, user.id)) {
    area.innerHTML = `<div class="alert alert-info"><span class="alert-icon">📝</span><div>這是你刊登的物品，你不能認領自己刊登的物品。可到 <a href="my.html#posts">我的專區</a> 查看狀態。</div></div>`;
    return;
  }
  const mine = user ? getActiveClaimForUser(item.id, user.id) : null;
  if (mine) {
    area.innerHTML = `<div class="alert alert-info"><span class="alert-icon">📨</span><div>你已對此物品提出申請，目前狀態：<strong>${escapeHtml(CLAIM_STATUS_LABEL[mine.status])}</strong>。<a href="my.html#claims">查看進度</a></div></div>`;
    return;
  }
  area.innerHTML = `
    ${status === PUBLIC_STATUS.PROCESSING ? '<p class="hint">已有其他人提出申請，你仍可提出，管理員會逐一比對。</p>' : ""}
    <a class="btn btn-primary btn-lg btn-block" href="${claimHref}">🙋 我要認領</a>
    ${user ? "" : '<p class="hint" style="margin-top:8px">提出認領前需要先登入（示範帳號）。</p>'}`;
}
