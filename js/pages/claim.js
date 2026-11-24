/* 認領申請：不提供選擇題、不顯示非公開驗證資訊、不要求上傳證件 */
import { mountLayout, guardPage, escapeHtml, itemVisual, emptyState, showFieldErrors, toast, params } from "../ui.js";
import { getPublicItem, categoryOf } from "../items.js";
import { isExternal } from "../auth.js";
import { createClaim, checkClaimEligibility, validateClaimForm, CLAIM_LIMITS } from "../claims.js";

mountLayout("items");
const user = guardPage();
const root = document.getElementById("claim-root");
const itemId = params().get("item") || "";

if (user) {
  const item = getPublicItem(itemId);
  const elig = checkClaimEligibility(itemId, user);

  if (!item || item.hidden) {
    root.innerHTML = `<div class="panel">${emptyState("🔎", "找不到這件物品", "物品可能已下架，或網址不正確。", '<a class="btn btn-primary" href="items.html">回到失物列表</a>')}</div>`;
  } else if (!elig.ok) {
    const link = elig.code === "DUPLICATE" ? '<a class="btn btn-primary" href="my.html#claims">查看我的申請</a>' : `<a class="btn btn-primary" href="item.html?id=${encodeURIComponent(item.id)}">回到物品頁</a>`;
    root.innerHTML = `<div class="panel">${emptyState("🚫", "目前無法提出認領申請", elig.error, link)}</div>`;
  } else {
    renderForm(item);
  }
}

function itemSummary(item) {
  const cat = categoryOf(item.category);
  return `
    <div class="panel">
      <h2>欲認領的物品</h2>
      ${itemVisual(item)}
      <h3 style="margin-top:14px">${escapeHtml(item.name)}</h3>
      <dl class="info-list">
        <dt>類別</dt><dd>${cat.icon} ${escapeHtml(cat.name)}</dd>
        <dt>大致顏色</dt><dd>${escapeHtml(item.color)}</dd>
        <dt>拾獲日期</dt><dd>${escapeHtml(item.foundDate)}</dd>
        <dt>拾獲地點</dt><dd>${escapeHtml(item.campus)}・${escapeHtml(item.location)}</dd>
      </dl>
      <p class="hint">此處只顯示公開資訊。</p>
    </div>`;
}

function renderForm(item) {
  const external = isExternal(user);
  root.innerHTML = `
    <div class="detail-grid">
      <form id="claim-form" class="panel" novalidate>
        <h2>申請資料</h2>
        <div class="alert alert-info"><span class="alert-icon">ℹ️</span><div>課堂原型請使用<strong>模擬資料</strong>，不要填寫真實學號或電話。正式系統只會向審核所需人員顯示這些資料。</div></div>
        <br>
        <div class="form-grid">
          <div class="field" data-field="applicantName">
            <label for="applicantName">申請人姓名<span class="req">*</span></label>
            <input id="applicantName" type="text" maxlength="${CLAIM_LIMITS.name}" value="${escapeHtml(user.name)}" required>
            <p class="field-error" id="err-applicantName"></p>
          </div>
          <div class="field" data-field="studentId">
            <label for="studentId">學號${external ? '<span class="opt">（校外人士免填）</span>' : '<span class="req">*</span><span class="opt">（模擬資料）</span>'}</label>
            <input id="studentId" type="text" maxlength="12" value="${escapeHtml(user.studentId || "")}" required>
            <p class="field-error" id="err-studentId"></p>
          </div>
          <div class="field full" data-field="contact">
            <label for="contact">聯絡方式<span class="req">*</span></label>
            <input id="contact" type="text" maxlength="${CLAIM_LIMITS.contact}" placeholder="例如：LINE ID：demo_xxx（模擬）" required>
            <p class="hint">只會提供給管理員安排領取，不會公開。</p>
            <p class="field-error" id="err-contact"></p>
          </div>
          <div class="field full">
            <label for="item-name">欲認領的物品</label>
            <input id="item-name" type="text" value="${escapeHtml(item.name)}（${escapeHtml(item.campus)}・${escapeHtml(item.foundDate)}）" readonly>
          </div>
          <div class="field full" data-field="description">
            <label for="description">物品特殊特徵描述<span class="req">*</span></label>
            <textarea id="description" rows="5" maxlength="${CLAIM_LIMITS.descMax}" required
              placeholder="請描述只有失主才知道的細節，例如：內部有哪些東西、特殊標記、刻字、吊飾、刮痕位置、品牌型號等。"></textarea>
            <p class="counter" id="desc-counter">0 字（至少 ${CLAIM_LIMITS.descMin} 字）</p>
            <p class="field-error" id="err-description"></p>
          </div>
          <div class="field full" data-field="extraInfo">
            <label for="extraInfo">其他能協助證明所有權的資訊<span class="opt">（選填）</span></label>
            <textarea id="extraInfo" rows="3" maxlength="${CLAIM_LIMITS.extra}" placeholder="例如：遺失的時間與經過、購買地點。不需要上傳證件照片。"></textarea>
            <p class="field-error" id="err-extraInfo"></p>
          </div>
          <div class="field full" data-field="agreeOnsite">
            <label class="check"><input type="checkbox" id="agreeOnsite"> 我了解送出申請不代表認領成功；審核通過後，需攜帶學生證（校外人士請帶附照片的身分證件）到現場核對身分與物品才能領回。<span class="req">*</span></label>
            <p class="field-error" id="err-agreeOnsite"></p>
          </div>
        </div>
        <br>
        <div class="btn-row">
          <button class="btn btn-primary btn-lg" type="submit">送出認領申請</button>
          <a class="btn btn-outline btn-lg" href="item.html?id=${encodeURIComponent(item.id)}">取消</a>
        </div>
      </form>
      <div>${itemSummary(item)}</div>
    </div>`;

  const form = document.getElementById("claim-form");
  const $ = (id) => document.getElementById(id);
  const collect = () => ({
    applicantName: $("applicantName").value,
    studentId: $("studentId").value,
    contact: $("contact").value,
    description: $("description").value,
    extraInfo: $("extraInfo").value,
    agreeOnsite: $("agreeOnsite").checked
  });

  $("description").addEventListener("input", () => {
    const len = $("description").value.trim().length;
    $("desc-counter").textContent = `${len} 字（至少 ${CLAIM_LIMITS.descMin} 字）`;
    $("desc-counter").classList.toggle("over", len > 0 && len < CLAIM_LIMITS.descMin);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = collect();
    const check = validateClaimForm(data, { requireStudentId: !external });
    showFieldErrors(form, check.errors);
    if (!check.ok) {
      toast("必填欄位尚未完成，無法送出", "error");
      return;
    }
    const r = createClaim(item.id, data, user);
    if (!r.ok) {
      if (r.errors) showFieldErrors(form, r.errors);
      toast(r.error || "送出失敗，請檢查欄位", "error");
      return;
    }
    toast("認領申請已送出，等待管理員審核", "success");
    root.innerHTML = `
      <div class="panel" style="max-width:720px;margin:0 auto;text-align:center">
        <div style="font-size:3.5rem">📨</div>
        <h2>認領申請已送出，等待管理員審核</h2>
        <p class="muted">申請編號：${escapeHtml(r.claim.id)}</p>
        <div class="alert alert-warning" style="text-align:left">
          <span class="alert-icon">⚠️</span>
          <div><strong>送出申請不代表認領成功。</strong>管理員會比對你的描述與拾獲者登記的特徵，結果會以站內通知告訴你。如果審核通過，仍需到現場核對身分與物品才能領回。</div>
        </div>
        <br>
        <div class="btn-row" style="justify-content:center">
          <a class="btn btn-primary" href="my.html#claims">查看申請進度</a>
          <a class="btn btn-outline" href="items.html">繼續瀏覽失物</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
