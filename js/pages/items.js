import { mountLayout, renderItemCard, emptyState, escapeHtml, params } from "../ui.js";
import { searchPublicItems, statusMap, categoryName } from "../items.js";
import { CATEGORIES, CAMPUSES } from "../data.js";

mountLayout("items");

const form = document.getElementById("filter-form");
const qInput = document.getElementById("f-q");
const catSelect = document.getElementById("f-category");
const campusSelect = document.getElementById("f-campus");
const chips = document.getElementById("cat-chips");
const campusChips = document.getElementById("campus-chips");
const grid = document.getElementById("result-grid");
const countEl = document.getElementById("result-count");

catSelect.insertAdjacentHTML("beforeend", CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join(""));
campusSelect.insertAdjacentHTML("beforeend", CAMPUSES.map((c) => `<option value="${c}">${c}</option>`).join(""));

// 從網址帶入條件（首頁搜尋框、類別入口）
const p = params();
qInput.value = p.get("q") || "";
if (CATEGORIES.some((c) => c.id === p.get("category"))) catSelect.value = p.get("category");
if (CAMPUSES.includes(p.get("campus"))) campusSelect.value = p.get("campus");

function renderChips() {
  const all = [{ id: "", name: "全部", icon: "✨" }, ...CATEGORIES];
  chips.innerHTML = all.map((c) =>
    `<button type="button" class="chip-btn ${catSelect.value === c.id ? "active" : ""}" data-cat="${c.id}" aria-pressed="${catSelect.value === c.id}">${c.icon} ${c.name}</button>`
  ).join("");
}

/** 校區快速篩選：件數依目前的關鍵字與類別計算（只用公開資料） */
function renderCampusChips() {
  const base = { keyword: qInput.value, category: catSelect.value };
  const counts = {};
  for (const it of searchPublicItems(base)) counts[it.campus] = (counts[it.campus] || 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const all = [{ id: "", name: "全部校區", n: total }, ...CAMPUSES.map((c) => ({ id: c, name: c, n: counts[c] || 0 }))];
  campusChips.innerHTML = all.map((c) =>
    `<button type="button" class="chip-btn ${campusSelect.value === c.id ? "active" : ""}" data-campus="${escapeHtml(c.id)}" aria-pressed="${campusSelect.value === c.id}">🏫 ${escapeHtml(c.name)}（${c.n}）</button>`
  ).join("");
}

function syncUrl() {
  const q = new URLSearchParams();
  if (qInput.value.trim()) q.set("q", qInput.value.trim());
  if (catSelect.value) q.set("category", catSelect.value);
  if (campusSelect.value) q.set("campus", campusSelect.value);
  const s = q.toString();
  history.replaceState(null, "", s ? `items.html?${s}` : "items.html");
}

function render() {
  const filters = { keyword: qInput.value, category: catSelect.value, campus: campusSelect.value };
  const results = searchPublicItems(filters);
  const statuses = statusMap();
  const parts = [];
  if (filters.keyword.trim()) parts.push(`關鍵字「${escapeHtml(filters.keyword.trim())}」`);
  if (filters.category) parts.push(escapeHtml(categoryName(filters.category)));
  if (filters.campus) parts.push(escapeHtml(filters.campus));
  countEl.innerHTML = `${parts.length ? parts.join("・") + "：" : ""}共 <strong>${results.length}</strong> 件物品`;
  grid.innerHTML = results.length
    ? results.map((it) => renderItemCard(it, statuses[it.id])).join("")
    : emptyState("🔍", "找不到符合條件的物品", "試試其他關鍵字、換個類別，或過幾天再回來看看。");
  renderChips();
  renderCampusChips();
  syncUrl();
}

let timer;
qInput.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(render, 200); });
catSelect.addEventListener("change", render);
campusSelect.addEventListener("change", render);
form.addEventListener("submit", (e) => { e.preventDefault(); render(); });
document.getElementById("f-clear").addEventListener("click", () => {
  form.reset();
  render();
  qInput.focus();
});
campusChips.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-campus]");
  if (!btn) return;
  campusSelect.value = btn.dataset.campus;
  render();
});
chips.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-cat]");
  if (!btn) return;
  catSelect.value = btn.dataset.cat;
  render();
});

render();
