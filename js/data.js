/* 高科大智慧失物招領平台：種子資料（課堂展示原型）
 * 全部為虛構模擬資料，不含任何真實學生的姓名、學號、電話或 Email。
 * secret 欄位為「非公開驗證資訊」，初始化時會被拆存到 lf_secrets，只有管理員介面可讀取。 */
import { todayStr } from "./utils.js";

export const CATEGORIES = Object.freeze([
  { id: "3c", name: "3C 產品", icon: "📱" },
  { id: "wallet", name: "錢包", icon: "👛" },
  { id: "id", name: "證件", icon: "🪪" },
  { id: "clothes", name: "衣物及配件", icon: "🧥" },
  { id: "books", name: "書籍及文具", icon: "📚" },
  { id: "key", name: "鑰匙", icon: "🔑" },
  { id: "other", name: "其他", icon: "📦" }
]);

export const CAMPUSES = Object.freeze(["建工校區", "燕巢校區", "第一校區", "楠梓校區", "旗津校區"]);
export const COLORS = Object.freeze(["黑色", "白色", "灰色", "紅色", "藍色", "綠色", "黃色", "棕色", "粉紅色", "紫色", "多色", "其他"]);

/** 可能含個人資料的類別：預設不上傳照片 */
export const SENSITIVE_CATEGORIES = Object.freeze(["3c", "wallet", "id"]);

export const CLAIM_STATUS = Object.freeze({
  PENDING: "PENDING",
  NEED_INFO: "NEED_INFO",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  COMPLETED: "COMPLETED"
});

export const CLAIM_STATUS_LABEL = Object.freeze({
  PENDING: "待審核",
  NEED_INFO: "需要補充資料",
  APPROVED: "審核通過",
  REJECTED: "審核未通過",
  COMPLETED: "已完成領取"
});

/** 示範帳號（虛構，僅供課堂展示；正式系統不可把密碼寫在前端） */
export const DEMO_USERS = Object.freeze([
  { id: "u_student_a", username: "student_a", password: "demo1234", role: "student", affiliation: "nkust", name: "測試學生 A", studentId: "DEMO0001" },
  { id: "u_student_b", username: "student_b", password: "demo1234", role: "student", affiliation: "nkust", name: "測試學生 B", studentId: "DEMO0002" },
  { id: "u_external", username: "visitor", password: "demo1234", role: "student", affiliation: "external", name: "校外人士（示範）", studentId: "" },
  { id: "u_admin", username: "admin", password: "admin1234", role: "admin", affiliation: "staff", name: "示範管理員", studentId: "" }
]);

export const PICKUP_INFO =
  "請於辦公時間（週一至週五 09:00–17:00）攜帶學生證或附照片的身分證件，至學務處服務台（模擬地點）由管理員現場核對身分與物品後領取。";

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayStr(d);
}

function isoDaysAgo(n, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function seedItem(id, name, category, color, campus, location, ago, publicDesc, secret) {
  return {
    id, name, category, color, campus, location,
    foundDate: daysAgo(ago),
    publicDesc,
    photo: null,
    finderId: "u_student_a",
    hidden: false,
    createdAt: isoDaysAgo(ago, 12),
    secret
  };
}

export function buildSeed() {
  const items = [
    seedItem("i1", "黑色短夾", "wallet", "黑色", "建工校區", "圖書館附近", 1, "黑色短夾，於圖書館附近拾獲。",
      { marks: "內側夾層有一張手寫便條紙，寫著「加油」", contents: "學生證（模擬）、一張咖啡集點卡、一張 100 元發票", other: "拉鍊拉頭綁有紅色細線" }),
    seedItem("i2", "藍牙耳機盒", "3c", "白色", "燕巢校區", "資訊大樓一樓", 2, "白色耳機盒，於資訊大樓附近拾獲。",
      { marks: "盒蓋內側貼有一小張星星貼紙", contents: "只有左耳耳機，右耳遺失", other: "品牌與型號：模擬品牌 AirX-200，序號尾碼 7Q" }),
    seedItem("i3", "學生證件夾", "id", "藍色", "第一校區", "學生餐廳", 3, "藍色證件夾，於餐廳附近拾獲。",
      { marks: "證件夾背面有手繪小貓圖案", contents: "學生證一張（模擬）、悠遊卡一張", other: "悠遊卡背面貼有一個英文縮寫貼紙" }),
    seedItem("i4", "灰色連帽外套", "clothes", "灰色", "建工校區", "體育館附近", 4, "灰色外套，於體育館附近拾獲。",
      { marks: "左袖口內側有簽字筆寫的名字縮寫", contents: "左口袋內有一包薄荷糖", other: "拉鍊頭已更換成金屬材質" }),
    seedItem("i5", "微積分課本", "books", "藍色", "燕巢校區", "共同教室大樓", 5, "藍色封面課本，於教室附近拾獲。",
      { marks: "第 120 頁夾有一張紫色書籤", contents: "內頁有大量螢光筆標記，扉頁有姓名縮寫", other: "書背下緣有一道撕裂痕跡" }),
    seedItem("i6", "機車鑰匙", "key", "多色", "楠梓校區", "停車場入口", 6, "一串鑰匙，於停車場附近拾獲。",
      { marks: "掛有一個木製魚形吊飾", contents: "共三把鑰匙，其中一把為宿舍鑰匙", other: "鑰匙圈上有小型手電筒" }),
    seedItem("i7", "保溫瓶", "other", "綠色", "第一校區", "行政大樓前", 8, "綠色保溫瓶，於行政大樓附近拾獲。",
      { marks: "瓶底有一處明顯凹痕", contents: "瓶內有半瓶麥茶", other: "瓶身貼有兩張動物貼紙" }),
    seedItem("i8", "筆記型電腦充電器", "3c", "黑色", "建工校區", "電機大樓走廊", 9, "黑色充電器，於大樓走廊拾獲。",
      { marks: "線材上纏有一圈白色膠帶", contents: "無", other: "適用瓦數 65W，接頭附近有輕微磨損" }),
    seedItem("i9", "黑色折疊傘", "other", "黑色", "旗津校區", "海洋大樓一樓", 10, "黑色雨傘，於大樓一樓拾獲。",
      { marks: "傘骨有一支被折彎過", contents: "傘套內有一張折起來的衛生紙", other: "傘柄底部貼有白色名字貼紙" }),
    seedItem("i10", "行動電源", "3c", "白色", "旗津校區", "研討室走廊", 11, "白色行動電源，於走廊拾獲。",
      { marks: "外殼側邊有一道長刮痕", contents: "附一條短的充電線", other: "容量約 10000mAh，背面貼有星星圖案貼紙" }),
    seedItem("i11", "悠遊卡套", "id", "粉紅色", "旗津校區", "學生活動中心", 12, "粉紅色卡套，於活動中心拾獲。",
      { marks: "卡套掛繩綁有一顆小鈴鐺", contents: "一張悠遊卡、一張影印店集點卡", other: "卡套內側有手寫的英文縮寫" }),
    seedItem("i12", "運動水壺", "other", "藍色", "楠梓校區", "體育場看台", 13, "藍色水壺，於看台附近拾獲。",
      { marks: "壺蓋有咬痕", contents: "壺內有半壺運動飲料", other: "壺身貼有一張球隊貼紙" }),
    seedItem("i13", "英文字典", "books", "紅色", "楠梓校區", "教學大樓三樓", 14, "紅色封面字典，於教室附近拾獲。",
      { marks: "封面左下角有咖啡漬", contents: "夾有一張單字記憶卡", other: "扉頁寫有一句座右銘" }),
    seedItem("i14", "黑色棒球帽", "clothes", "黑色", "楠梓校區", "操場入口", 15, "黑色帽子，於操場附近拾獲。",
      { marks: "帽簷內側有簽字筆寫的暱稱", contents: "無", other: "帽子正面縫有一個小徽章" }),
    seedItem("i15", "平板保護殼", "3c", "灰色", "燕巢校區", "電腦教室", 16, "灰色保護殼，於電腦教室拾獲。",
      { marks: "背面貼有一張手繪貼紙", contents: "殼內夾有一支觸控筆", other: "適用 11 吋機型，右下角有裂痕" }),
    seedItem("i16", "黃色筆袋", "books", "黃色", "燕巢校區", "學生宿舍交誼廳", 17, "黃色筆袋，於交誼廳拾獲。",
      { marks: "拉鍊頭掛有一個小布偶", contents: "三支螢光筆、一支紅色自動鉛筆", other: "筆袋內側繡有姓名縮寫" }),
    seedItem("i17", "紅色圍巾", "clothes", "紅色", "燕巢校區", "校車站牌", 18, "紅色圍巾，於站牌附近拾獲。",
      { marks: "一端有一小塊補丁", contents: "無", other: "標籤上用筆寫有名字" }),
    seedItem("i18", "棕色零錢包", "wallet", "棕色", "第一校區", "福利社附近", 19, "棕色小錢包，於福利社附近拾獲。",
      { marks: "拉鍊內側有一張小貼紙", contents: "數枚硬幣、一張電影票根", other: "提把上綁有一條藍色緞帶" }),
    seedItem("i19", "宿舍鑰匙", "key", "黃色", "第一校區", "宿舍大門", 20, "一把鑰匙，於宿舍門口拾獲。",
      { marks: "鑰匙圈掛有一個橡膠恐龍", contents: "兩把鑰匙", other: "其中一把鑰匙被磨損得特別明顯" }),
    seedItem("i20", "工程計算機", "books", "黑色", "第一校區", "商管大樓教室", 21, "黑色計算機，於教室拾獲。",
      { marks: "背面用立可白寫了一個字母", contents: "蓋子內側夾有一張公式小抄", other: "電池蓋已用膠帶固定" }),
    seedItem("i21", "棕色皮革手錶", "other", "棕色", "建工校區", "機械館", 22, "棕色錶帶手錶，於機械館拾獲。",
      { marks: "錶帶第三個孔有明顯折痕", contents: "無", other: "錶面右上角有一道細裂痕" }),
    seedItem("i22", "黑色眼鏡盒", "other", "黑色", "建工校區", "工學院中庭", 23, "黑色眼鏡盒，於中庭拾獲。",
      { marks: "盒蓋貼有一張小熊貼紙", contents: "盒內有一副細框眼鏡和擦拭布", other: "擦拭布角落繡有英文字母" })
  ];

  const c1 = isoDaysAgo(1, 14);
  const c2a = isoDaysAgo(6, 9);
  const c2b = isoDaysAgo(5, 11);
  const c2c = isoDaysAgo(4, 15);

  const claims = [
    {
      id: "c_seed1", itemId: "i5", claimantId: "u_student_b",
      applicantName: "測試學生 B", studentId: "DEMO0002", contact: "LINE ID：demo_student_b（模擬）",
      description: "藍色封面的微積分課本，裡面有很多我用螢光筆畫的重點，扉頁寫了我的姓名縮寫，書背下面有一點破掉。",
      extraInfo: "上週在共同教室上完課後遺失。",
      status: "PENDING", adminNote: "", supplements: [],
      history: [{ from: null, to: "PENDING", actorId: "u_student_b", note: "送出認領申請", at: c1 }],
      createdAt: c1, updatedAt: c1
    },
    {
      id: "c_seed2", itemId: "i7", claimantId: "u_student_b",
      applicantName: "測試學生 B", studentId: "DEMO0002", contact: "LINE ID：demo_student_b（模擬）",
      description: "綠色保溫瓶，瓶底有被我摔出來的凹痕，瓶身有貼兩張動物貼紙，遺失時裡面裝著麥茶。",
      extraInfo: "",
      status: "COMPLETED", adminNote: "", supplements: [],
      history: [
        { from: null, to: "PENDING", actorId: "u_student_b", note: "送出認領申請", at: c2a },
        { from: "PENDING", to: "APPROVED", actorId: "u_admin", note: "描述與登記特徵相符，請至現場領取", at: c2b },
        { from: "APPROVED", to: "COMPLETED", actorId: "u_admin", note: "已現場核對身分與物品，完成交還", at: c2c }
      ],
      createdAt: c2a, updatedAt: c2c
    }
  ];

  const notifications = [
    { id: "n_seed1", userId: "u_student_b", type: "SUBMITTED", claimId: "c_seed1", itemId: "i5",
      title: "認領申請已送出", body: "你對「微積分課本」的認領申請已送出，等待管理員審核。送出申請不代表認領成功。", read: false, createdAt: c1 },
    { id: "n_seed2", userId: "u_student_b", type: "SUBMITTED", claimId: "c_seed2", itemId: "i7",
      title: "認領申請已送出", body: "你對「保溫瓶」的認領申請已送出，等待管理員審核。送出申請不代表認領成功。", read: true, createdAt: c2a },
    { id: "n_seed3", userId: "u_student_b", type: "APPROVED", claimId: "c_seed2", itemId: "i7",
      title: "認領申請審核通過", body: "你對「保溫瓶」的認領申請已審核通過，但尚未完成領取。" + PICKUP_INFO, read: true, createdAt: c2b },
    { id: "n_seed4", userId: "u_student_b", type: "COMPLETED", claimId: "c_seed2", itemId: "i7",
      title: "物品已完成領取", body: "「保溫瓶」已於現場核對後完成領取，本申請結案。", read: true, createdAt: c2c }
  ];

  return { items, claims, notifications };
}
