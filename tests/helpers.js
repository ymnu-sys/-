import { setBackend, createMemoryStorage, resetDemoData } from "../js/storage.js";
import { DEMO_USERS } from "../js/data.js";

export function freshStore() {
  setBackend(createMemoryStorage());
  resetDemoData();
}

function user(username) {
  const { password, ...rest } = DEMO_USERS.find((u) => u.username === username);
  return rest;
}

export const studentA = user("student_a"); // 種子物品的拾獲者
export const studentB = user("student_b");
export const admin = user("admin");
export const visitor = user("visitor"); // 校外人士

export const validClaim = {
  applicantName: "測試學生 B",
  studentId: "DEMO0002",
  contact: "LINE ID：demo_b（模擬）",
  description: "黑色短夾，內側夾層應該有一張手寫的便條紙。",
  extraInfo: "",
  agreeOnsite: true
};

export function validItem(overrides = {}) {
  return {
    name: "白色雨傘",
    category: "other",
    color: "白色",
    campus: "建工校區",
    location: "圖書館門口",
    foundDate: "2026-01-01",
    publicDesc: "白色雨傘，於圖書館門口拾獲。",
    secret: { marks: "傘柄有藍色膠帶", contents: "", other: "" },
    ...overrides
  };
}
