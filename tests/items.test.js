import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  toPublicItem, getItemRecord, getLatestPublicItems, searchPublicItems, derivePublicStatus, PUBLIC_STATUS,
  detectSensitiveText, validateItemForm, createItem, getItemSecret, setItemHidden, listPublicItems
} from "../js/items.js";
import { load, KEYS } from "../js/storage.js";
import { escapeHtml } from "../js/utils.js";
import { freshStore, studentA, studentB, admin, validItem } from "./helpers.js";

beforeEach(freshStore);

test("toPublicItem 不輸出 secret 與 finderId", () => {
  const pub = toPublicItem({ ...getItemRecord("i1"), secret: { marks: "x" } });
  assert.equal("secret" in pub, false);
  assert.equal("finderId" in pub, false);
  assert.equal(pub.name, "黑色短夾");
});

test("toPublicItem 會丟棄不是 data:image 的照片", () => {
  assert.equal(toPublicItem({ id: "x", photo: "javascript:alert(1)" }).photo, null);
});

test("escapeHtml 會轉義 HTML 特殊字元", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("最新物品依拾獲日期排序並限制筆數", () => {
  const latest = getLatestPublicItems(3);
  assert.deepEqual(latest.map((i) => i.id), ["i1", "i2", "i3"]);
});

test("用非公開驗證特徵的文字搜尋，結果為 0 筆", () => {
  for (const kw of ["便條紙", "星星貼紙", "小貓", "薄荷糖", "紫色書籤", "魚形吊飾", "AirX", "7Q"]) {
    assert.equal(searchPublicItems({ keyword: kw }).length, 0, `「${kw}」不應搜尋到結果`);
  }
});

test("依名稱、地點、類別名稱搜尋公開欄位", () => {
  assert.deepEqual(searchPublicItems({ keyword: "短夾" }).map((i) => i.id), ["i1"]);
  assert.deepEqual(searchPublicItems({ keyword: "圖書館" }).map((i) => i.id), ["i1"]);
  assert.equal(searchPublicItems({ keyword: "3C" }).length, 4);
});

test("類別、校區與關鍵字可以組合，英文不分大小寫", () => {
  assert.deepEqual(searchPublicItems({ category: "3c", campus: "建工校區" }).map((i) => i.id), ["i8"]);
  assert.deepEqual(searchPublicItems({ category: "3c", keyword: "耳機" }).map((i) => i.id), ["i2"]);
  assert.equal(searchPublicItems({ keyword: "3c" }).length, 4);
  assert.equal(searchPublicItems({ category: "wallet", keyword: "耳機" }).length, 0);
});

test("已下架物品不出現在公開列表與搜尋", () => {
  setItemHidden("i1", true, admin);
  assert.equal(searchPublicItems({ keyword: "短夾" }).length, 0);
  assert.equal(listPublicItems().some((i) => i.id === "i1"), false);
});

test("derivePublicStatus：待認領、認領處理中、已領回", () => {
  assert.equal(derivePublicStatus("i1"), PUBLIC_STATUS.AVAILABLE);
  assert.equal(derivePublicStatus("i5"), PUBLIC_STATUS.PROCESSING); // 種子：待審核申請
  assert.equal(derivePublicStatus("i7"), PUBLIC_STATUS.RETURNED); // 種子：已完成領取
  assert.equal(derivePublicStatus("i1", [{ itemId: "i1", status: "REJECTED" }]), PUBLIC_STATUS.AVAILABLE);
  assert.equal(derivePublicStatus("i1", [{ itemId: "i1", status: "APPROVED" }]), PUBLIC_STATUS.PROCESSING);
});

test("detectSensitiveText 偵測號碼、Email、手機（含全形）", () => {
  assert.ok(detectSensitiveText("學號 1112345678").length);
  assert.ok(detectSensitiveText("聯絡 demo@example.com").length);
  assert.ok(detectSensitiveText("電話 0912-345-678").length);
  assert.ok(detectSensitiveText("卡號１２３４５６７８").length);
  assert.equal(detectSensitiveText("黑色短夾，於圖書館附近拾獲。").length, 0);
});

test("刊登驗證：缺必填、超過字數、含個資、未來日期、缺驗證特徵", () => {
  const blank = validateItemForm({});
  for (const f of ["name", "category", "color", "campus", "location", "foundDate", "publicDesc", "secret"]) {
    assert.ok(blank.errors[f], `應檢查 ${f}`);
  }
  assert.ok(validateItemForm(validItem({ publicDesc: "很".repeat(51) })).errors.publicDesc);
  assert.ok(validateItemForm(validItem({ publicDesc: "請打 0912345678" })).errors.publicDesc);
  assert.ok(validateItemForm(validItem({ publicDesc: "寄到 demo@example.com" })).errors.publicDesc);
  assert.ok(validateItemForm(validItem({ foundDate: "2026-06-02" }), "2026-06-01").errors.foundDate);
  assert.ok(validateItemForm(validItem({ secret: { marks: "", contents: " ", other: "" } })).errors.secret);
  assert.equal(validateItemForm(validItem()).ok, true);
});

test("敏感類別上傳照片必須勾選確認", () => {
  const photo = "data:image/jpeg;base64,AAAA";
  assert.ok(validateItemForm(validItem({ category: "wallet", photo })).errors.photo);
  assert.equal(validateItemForm(validItem({ category: "wallet", photo, photoConfirmed: true })).ok, true);
  assert.equal(validateItemForm(validItem({ category: "other", photo })).ok, true);
});

test("合法資料可以建立物品，驗證特徵只存在 lf_secrets", () => {
  assert.equal(createItem(validItem(), null).ok, false);
  const r = createItem(validItem(), studentB);
  assert.equal(r.ok, true);
  assert.equal("secret" in r.item, false);
  const stored = load(KEYS.items).find((i) => i.id === r.item.id);
  assert.equal(stored.finderId, studentB.id);
  assert.equal("secret" in stored, false);
  assert.equal(load(KEYS.secrets)[r.item.id].marks, "傘柄有藍色膠帶");
  assert.equal(searchPublicItems({ keyword: "藍色膠帶" }).length, 0);
});

test("只有管理員可以讀取驗證特徵與下架物品", () => {
  assert.throws(() => getItemSecret("i1", studentA));
  assert.throws(() => getItemSecret("i1", null));
  assert.throws(() => setItemHidden("i1", true, studentA));
  assert.ok(getItemSecret("i1", admin).marks.includes("便條紙"));
});

test("五個校區都有物品，且依校區篩選只回傳該校區", () => {
  const campuses = ["第一校區", "建工校區", "燕巢校區", "楠梓校區", "旗津校區"];
  let total = 0;
  for (const campus of campuses) {
    const r = searchPublicItems({ campus });
    assert.ok(r.length >= 3, `${campus} 至少 3 筆`);
    assert.ok(r.every((i) => i.campus === campus));
    total += r.length;
  }
  assert.equal(total, listPublicItems().length);
  assert.equal(searchPublicItems({ campus: "旗津校區", category: "3c" }).length, 1);
});
