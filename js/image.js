/* 圖片壓縮（僅瀏覽器）：縮到最長邊 800px、轉成 JPEG，壓縮後需 ≤ 500KB。
 * 重新繪製到 canvas 也會移除原始照片的 EXIF（含 GPS 位置）資訊。 */
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

export async function compressImage(file, { maxSide = 800, quality = 0.7, maxBytes = 500 * 1024 } = {}) {
  if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    throw new Error("只能上傳 JPG、PNG、WebP 或 GIF 圖片");
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error("原始圖片不能超過 10MB");

  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let q = quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length * 0.75 > maxBytes && q > 0.3) {
    q -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  if (dataUrl.length * 0.75 > maxBytes) throw new Error("圖片壓縮後仍超過 500KB，請換一張較小的圖片");
  return dataUrl;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("無法讀取這張圖片")); };
    img.src = url;
  });
}
