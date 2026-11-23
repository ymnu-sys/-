/* 拾獲物品：公開資料過濾、搜尋、刊登驗證、公開狀態推算
 * 核心原則：公開頁面只能拿到 toPublicItem() 白名單欄位；搜尋只比對公開欄位；
 * 非公開驗證資訊（lf_secrets）只有管理員函式能讀取。 */
import { CATEGORIES, CAMPUSES, COLORS, SENSITIVE_CATEGORIES, CLAIM_STATUS } from "./data.js";
import { load, save, KEYS, genId } from "./storage.js";
import { todayStr, clean, toHalfWidth } from "./utils.js";

export const PUBLIC_FIELDS = Object.freeze([
  "id", "name", "category", "color", "campus", "location", "foundDate", "publicDesc", "photo", "hidden", "createdAt"
]);

export const PUBLIC_STATUS = Object.freeze({ AVAILABLE: "待認領", PROCESSING: "認領處理中", RETURNED: "已領回" });

export const ITEM_LIMITS = Object.freeze({ name: 20, location: 30, publicDesc: 50, secret: 200 });

const MAX_PHOTO_CHARS = Math.ceil((500 * 1024 * 4) / 3) + 64; // 約 500KB 的 base64

/* ---------- 類別 ---------- */
export function categoryOf(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
export function categoryName(id) {
  return categoryOf(id).name;
}
export function isSensitiveCategory(id) {
  return SENSITIVE_CATEGORIES.includes(id);
}

/* ---------- 讀取 ---------- */
function rawItems() {
  return load(KEYS.items, []);
}
function rawClaims() {
  return load(KEYS.claims, []);
}

/** 內部使用（含 finderId），不可直接輸出到公開頁面 */
export function getItemRecord(id) {
  return rawItems().find((it) => it.id === id) || null;
}

/** 白名單過濾：只保留公開欄位 */
export function toPublicItem(raw) {
  if (!raw) return null;
  const out = {};
  for (const f of PUBLIC_FIELDS) out[f] = raw[f] ?? null;
  out.hidden = !!raw.hidden;
  if (typeof out.photo !== "string" || !out.photo.startsWith("data:image/")) out.photo = null;
  return out;
}

export function sortByNewest(list) {
  return [...list].sort((a, b) =>
    (b.foundDate || "").localeCompare(a.foundDate || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function listPublicItems({ includeHidden = false } = {}) {
  return rawItems().map(toPublicItem).filter((it) => includeHidden || !it.hidden);
}

export function getPublicItem(id) {
  return toPublicItem(getItemRecord(id));
}

export function getLatestPublicItems(n = 6) {
  return sortByNewest(listPublicItems()).slice(0, n);
}

/** 公開搜尋：只比對公開欄位，永遠不讀 lf_secrets */
export function searchPublicItems({ keyword = "", category = "", campus = "" } = {}) {
  const terms = toHalfWidth(keyword).toLowerCase().split(/\s+/).filter(Boolean);
  const results = listPublicItems().filter((it) => {
    if (category && it.category !== category) return false;
    if (campus && it.campus !== campus) return false;
    if (!terms.length) return true;
    const haystack = [it.name, categoryName(it.category), it.color, it.campus, it.location, it.publicDesc]
      .join(" ")
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
  return sortByNewest(results);
}

/* ---------- 公開狀態 ---------- */
/** 由認領申請推算公開狀態（不透露申請人或細節） */
export function derivePublicStatus(itemOrId, claims = rawClaims()) {
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  const related = claims.filter((c) => c.itemId === id);
  if (related.some((c) => c.status === CLAIM_STATUS.COMPLETED)) return PUBLIC_STATUS.RETURNED;
  const active = [CLAIM_STATUS.PENDING, CLAIM_STATUS.NEED_INFO, CLAIM_STATUS.APPROVED];
  if (related.some((c) => active.includes(c.status))) return PUBLIC_STATUS.PROCESSING;
  return PUBLIC_STATUS.AVAILABLE;
}

export function statusMap() {
  const claims = rawClaims();
  const map = {};
  for (const it of rawItems()) map[it.id] = derivePublicStatus(it.id, claims);
  return map;
}

/* ---------- 敏感資料偵測與表單驗證 ---------- */
const SENSITIVE_RULES = [
  { re: /\d{6,}/, msg: "含有 6 位以上連續數字（可能是證件號碼、卡號或學號）" },
  { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, msg: "含有 Email" },
  { re: /09\d{2}[-\s]?\d{3}[-\s]?\d{3}/, msg: "含有手機號碼" }
];

/** 回傳偵測到的問題清單，空陣列代表沒有問題 */
export function detectSensitiveText(text) {
  const s = toHalfWidth(text);
  return SENSITIVE_RULES.filter((r) => r.re.test(s)).map((r) => r.msg);
}

export function validateItemForm(data = {}, today = todayStr()) {
  const v = {
    name: clean(data.name),
    category: clean(data.category),
    color: clean(data.color),
    campus: clean(data.campus),
    location: clean(data.location),
    foundDate: clean(data.foundDate),
    publicDesc: clean(data.publicDesc),
    photo: data.photo || null,
    photoConfirmed: !!data.photoConfirmed,
    secret: {
      marks: clean(data.secret?.marks),
      contents: clean(data.secret?.contents),
      other: clean(data.secret?.other)
    }
  };
  const errors = {};

  if (!v.name) errors.name = "請填寫物品名稱";
  else if (v.name.length > ITEM_LIMITS.name) errors.name = `物品名稱最多 ${ITEM_LIMITS.name} 字`;

  if (!CATEGORIES.some((c) => c.id === v.category)) errors.category = "請選擇物品類別";
  if (!COLORS.includes(v.color)) errors.color = "請選擇大致顏色";
  if (!CAMPUSES.includes(v.campus)) errors.campus = "請選擇拾獲校區";

  if (!v.location) errors.location = "請填寫大致拾獲地點";
  else if (v.location.length > ITEM_LIMITS.location) errors.location = `地點最多 ${ITEM_LIMITS.location} 字`;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.foundDate) || Number.isNaN(new Date(v.foundDate).getTime())) {
    errors.foundDate = "請選擇拾獲日期";
  } else if (v.foundDate > today) {
    errors.foundDate = "拾獲日期不能是未來日期";
  }

  if (!v.publicDesc) errors.publicDesc = "請填寫簡短公開描述";
  else if (v.publicDesc.length > ITEM_LIMITS.publicDesc) errors.publicDesc = `公開描述最多 ${ITEM_LIMITS.publicDesc} 字，請保持簡短模糊`;

  for (const field of ["name", "location", "publicDesc"]) {
    if (errors[field]) continue;
    const found = detectSensitiveText(v[field]);
    if (found.length) errors[field] = `公開欄位不可包含個人資料：${found.join("、")}`;
  }

  const secretValues = Object.values(v.secret);
  if (secretValues.every((s) => !s)) {
    errors.secret = "請至少填寫一項非公開驗證特徵，供管理員比對認領申請";
  } else if (secretValues.some((s) => s.length > ITEM_LIMITS.secret)) {
    errors.secret = `每項驗證特徵最多 ${ITEM_LIMITS.secret} 字`;
  }

  if (v.photo) {
    if (typeof v.photo !== "string" || !v.photo.startsWith("data:image/")) errors.photo = "照片格式不正確";
    else if (v.photo.length > MAX_PHOTO_CHARS) errors.photo = "照片太大，壓縮後需小於 500KB";
    else if (isSensitiveCategory(v.category) && !v.photoConfirmed) {
      errors.photo = "此類別可能含個人資料，請勾選確認照片不含敏感資訊，或移除照片";
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

/* ---------- 刊登 ---------- */
export function createItem(data, user) {
  if (!user) return { ok: false, error: "請先登入後再刊登" };
  const { ok, errors, value } = validateItemForm(data);
  if (!ok) return { ok: false, errors };

  const item = {
    id: genId("item"),
    name: value.name,
    category: value.category,
    color: value.color,
    campus: value.campus,
    location: value.location,
    foundDate: value.foundDate,
    publicDesc: value.publicDesc,
    photo: value.photo,
    finderId: user.id,
    hidden: false,
    createdAt: new Date().toISOString()
  };
  const items = rawItems();
  items.push(item);
  const secrets = load(KEYS.secrets, {});
  secrets[item.id] = value.secret;
  save(KEYS.items, items);
  save(KEYS.secrets, secrets);
  return { ok: true, item: toPublicItem(item) };
}

export function listItemsByFinder(userId) {
  return sortByNewest(rawItems().filter((it) => it.finderId === userId).map(toPublicItem));
}

export function isFinder(itemId, userId) {
  const it = getItemRecord(itemId);
  return !!it && !!userId && it.finderId === userId;
}

/* ---------- 管理員專用 ---------- */
function assertAdmin(actor) {
  if (!actor || actor.role !== "admin") throw new Error("權限不足：只有管理員可以查看或管理此資料");
}

export function getItemSecret(itemId, actor) {
  assertAdmin(actor);
  return load(KEYS.secrets, {})[itemId] || null;
}

export function listItemsForAdmin(actor) {
  assertAdmin(actor);
  const secrets = load(KEYS.secrets, {});
  const claims = rawClaims();
  return sortByNewest(rawItems()).map((it) => ({
    ...toPublicItem(it),
    finderId: it.finderId,
    secret: secrets[it.id] || null,
    publicStatus: derivePublicStatus(it.id, claims)
  }));
}

export function setItemHidden(itemId, hidden, actor) {
  assertAdmin(actor);
  const items = rawItems();
  const it = items.find((x) => x.id === itemId);
  if (!it) throw new Error("找不到物品");
  it.hidden = !!hidden;
  save(KEYS.items, items);
  return toPublicItem(it);
}
