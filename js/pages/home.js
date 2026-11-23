import { mountLayout, renderItemCard, emptyState } from "../ui.js";
import { getLatestPublicItems, listPublicItems, statusMap, PUBLIC_STATUS } from "../items.js";
import { CATEGORIES } from "../data.js";

mountLayout("home");

const items = listPublicItems();
const statuses = statusMap();

// 類別入口
document.getElementById("cat-grid").innerHTML = CATEGORIES.map((c) => {
  const count = items.filter((i) => i.category === c.id).length;
  return `<a class="cat-tile" href="items.html?category=${c.id}">
      <span class="cat-icon" aria-hidden="true">${c.icon}</span>
      <span>${c.name}</span>
      <small>${count} 件</small>
    </a>`;
}).join("");

// 平台概況
const countOf = (label) => items.filter((i) => statuses[i.id] === label).length;
document.getElementById("stat-available").textContent = countOf(PUBLIC_STATUS.AVAILABLE);
document.getElementById("stat-processing").textContent = countOf(PUBLIC_STATUS.PROCESSING);
document.getElementById("stat-returned").textContent = countOf(PUBLIC_STATUS.RETURNED);

// 最新物品
const latest = getLatestPublicItems(6);
document.getElementById("latest-grid").innerHTML = latest.length
  ? latest.map((it) => renderItemCard(it, statuses[it.id])).join("")
  : emptyState("📭", "目前還沒有拾獲物品", "撿到東西了嗎？歡迎刊登。");
