import { mountLayout, guardPage, showFieldErrors, setFlash, toast } from "../ui.js";
import { createItem, validateItemForm, detectSensitiveText, isSensitiveCategory, ITEM_LIMITS } from "../items.js";
import { compressImage } from "../image.js";
import { CATEGORIES, CAMPUSES, COLORS } from "../data.js";
import { todayStr } from "../utils.js";

mountLayout("post");
const user = guardPage();

if (user) {
  const form = document.getElementById("post-form");
  const $ = (id) => document.getElementById(id);
  let photoData = null;

  $("category").insertAdjacentHTML("beforeend", CATEGORIES.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join(""));
  $("color").insertAdjacentHTML("beforeend", COLORS.map((c) => `<option>${c}</option>`).join(""));
  $("campus").insertAdjacentHTML("beforeend", CAMPUSES.map((c) => `<option>${c}</option>`).join(""));
  $("foundDate").max = todayStr();
  $("foundDate").value = todayStr();

  const collect = () => ({
    name: $("name").value,
    category: form.category.value,
    color: form.color.value,
    campus: form.campus.value,
    location: form.location.value,
    foundDate: form.foundDate.value,
    publicDesc: form.publicDesc.value,
    photo: photoData,
    photoConfirmed: $("photoConfirmed").checked,
    secret: { marks: $("s-marks").value, contents: $("s-contents").value, other: $("s-other").value }
  });

  /* 敏感類別：預設關閉照片上傳 */
  function updatePhotoAccess() {
    const sensitive = isSensitiveCategory(form.category.value);
    $("sensitive-warning").classList.toggle("hidden", !sensitive);
    const allowed = !sensitive || $("photoConfirmed").checked;
    $("photo").disabled = !allowed;
    $("photo-box").style.opacity = allowed ? "1" : ".5";
    if (!allowed && photoData) clearPhoto();
  }

  function clearPhoto() {
    photoData = null;
    $("photo").value = "";
    $("photo-preview").textContent = "📷";
    $("photo-remove").classList.add("hidden");
  }

  form.category.addEventListener("change", updatePhotoAccess);
  $("photoConfirmed").addEventListener("change", updatePhotoAccess);
  $("photo-remove").addEventListener("click", clearPhoto);

  $("photo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $("photo-preview").textContent = "⏳";
    try {
      photoData = await compressImage(file);
      const img = document.createElement("img");
      img.src = photoData;
      img.alt = "照片預覽";
      $("photo-preview").replaceChildren(img);
      $("photo-remove").classList.remove("hidden");
      $("err-photo").textContent = "";
      toast("照片已壓縮，送出前請再次確認畫面中沒有敏感資訊", "info");
    } catch (err) {
      clearPhoto();
      $("err-photo").textContent = err.message;
      toast(err.message, "error");
    }
  });

  /* 公開描述字數與即時敏感資料提醒 */
  function updateCounter() {
    const len = form.publicDesc.value.trim().length;
    $("desc-counter").textContent = `${len} / ${ITEM_LIMITS.publicDesc}`;
    $("desc-counter").classList.toggle("over", len > ITEM_LIMITS.publicDesc);
  }
  form.publicDesc.addEventListener("input", updateCounter);

  for (const field of ["name", "location", "publicDesc"]) {
    $(field).addEventListener("blur", () => {
      const found = detectSensitiveText($(field).value);
      const wrap = form.querySelector(`[data-field="${field}"]`);
      if (found.length) {
        wrap.classList.add("invalid");
        $(`err-${field}`).textContent = `公開欄位不可包含個人資料：${found.join("、")}`;
      } else if ($(`err-${field}`).textContent.startsWith("公開欄位不可包含")) {
        wrap.classList.remove("invalid");
        $(`err-${field}`).textContent = "";
      }
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = collect();
    const check = validateItemForm(data);
    showFieldErrors(form, check.errors);
    if (!check.ok) {
      toast("有欄位尚未完成或格式不正確，請檢查紅色提示", "error");
      return;
    }
    try {
      const r = createItem(data, user);
      if (!r.ok) {
        showFieldErrors(form, r.errors || {});
        toast(r.error || "刊登失敗，請檢查欄位", "error");
        return;
      }
      setFlash("刊登成功！驗證特徵只有管理員看得到。", "success");
      location.href = `item.html?id=${encodeURIComponent(r.item.id)}`;
    } catch (err) {
      toast(err.message, "error");
    }
  });

  updatePhotoAccess();
  updateCounter();
}
