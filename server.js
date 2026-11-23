/* 零套件靜態檔案伺服器（ES Modules 不能用 file:// 開啟，所以需要本機伺服器）
 * 啟動：npm start  →  http://localhost:3000
 * 讓手機在同一個區網測試：PowerShell 執行  $env:HOST="0.0.0.0"; npm start */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".md": "text/plain; charset=utf-8"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff" });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method Not Allowed");

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    return send(res, 400, "Bad Request");
  }
  if (pathname.endsWith("/")) pathname += "index.html";

  const filePath = path.normalize(path.join(ROOT, pathname));
  // 防止路徑穿越，並拒絕存取隱藏檔（例如 .git）
  if (!filePath.startsWith(ROOT + path.sep) || pathname.split("/").some((seg) => seg.startsWith("."))) {
    return send(res, 403, "Forbidden");
  }

  try {
    const data = await readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    send(res, 404, "<!doctype html><meta charset=utf-8><title>404</title><p>找不到頁面。<a href='/index.html'>回首頁</a></p>", "text/html; charset=utf-8");
  }
});

server.listen(PORT, HOST, () => {
  const shown = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`高科大智慧失物招領平台（課堂展示原型）已啟動：http://${shown}:${PORT}`);
  console.log("按 Ctrl + C 停止伺服器");
});
