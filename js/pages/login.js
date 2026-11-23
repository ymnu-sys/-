import { mountLayout, escapeHtml, showFieldErrors, setFlash, toast, params } from "../ui.js";
import { login, ROLE_LABEL } from "../auth.js";
import { DEMO_USERS } from "../data.js";
import { safeReturnUrl } from "../utils.js";

const user = mountLayout("login");
const returnUrl = safeReturnUrl(params().get("return"));

if (user) {
  document.getElementById("login-panel").innerHTML = `
    <h2>你已登入</h2>
    <p>目前身分：<strong>${escapeHtml(user.name)}</strong>（${ROLE_LABEL[user.role]}）。如需切換帳號，請先按右上角「登出」。</p>
    <a class="btn btn-primary" href="${escapeHtml(returnUrl || "index.html")}">繼續</a>`;
}

const DESC = {
  student_a: "種子物品的拾獲者，可示範刊登與「不能認領自己的物品」。",
  student_b: "認領者，可示範提出認領、補充資料、接收通知。",
  admin: "可查看非公開驗證特徵、審核認領、完成領取、下架物品。"
};

document.getElementById("demo-accounts").innerHTML = DEMO_USERS.map((u) => `
  <div class="demo-account">
    <div>
      <strong>${escapeHtml(u.name)}</strong> <span class="chip">${ROLE_LABEL[u.role]}</span><br>
      <span class="small">帳號 <code>${escapeHtml(u.username)}</code>　密碼 <code>${escapeHtml(u.password)}</code></span>
      <div class="hint">${DESC[u.username] || ""}</div>
    </div>
    <button type="button" class="btn btn-sm btn-outline" data-fill="${escapeHtml(u.username)}">帶入</button>
  </div>`).join("");

const form = document.getElementById("login-form");

document.getElementById("demo-accounts").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-fill]");
  if (!btn || !form) return;
  const u = DEMO_USERS.find((x) => x.username === btn.dataset.fill);
  form.username.value = u.username;
  form.password.value = u.password;
  form.querySelector("button[type=submit]").focus();
});

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const errors = {};
  if (!form.username.value.trim()) errors.username = "請輸入帳號";
  if (!form.password.value) errors.password = "請輸入密碼";
  showFieldErrors(form, errors);
  if (Object.keys(errors).length) return;

  const r = login(form.username.value, form.password.value);
  if (!r.ok) {
    showFieldErrors(form, { password: r.error });
    toast(r.error, "error");
    return;
  }
  setFlash(`登入成功，歡迎 ${r.user.name}`, "success");
  location.href = returnUrl || (r.user.role === "admin" ? "admin.html" : "index.html");
});
