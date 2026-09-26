// 第一版失败是 "incomplete multipart stream" —— **是形态错，不是端点不存在**。
// 最可能的原因：Node 的 https.request 给了 Buffer 却没给 content-length，于是走了 chunked，
// 而中转的多部件解析器不吃 chunked。补上 content-length 再试。
import fs from "node:fs";
import path from "node:path";
import { createProxyFetch } from "../../../../packages/assets/dist/index.js";

const cfg = JSON.parse(fs.readFileSync(path.resolve("game-maker.local.json"), "utf8")).image;
const doFetch = cfg.proxy ? createProxyFetch({ proxy: cfg.proxy }) : fetch;
const base = cfg.baseUrl.replace(/\/+$/, "");
const img = fs.readFileSync("inputs/master-to-animation/player-master.png");

const B = "----gm" + Math.random().toString(16).slice(2);
const parts = [
  Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${cfg.model}\r\n`),
  Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\nA single small flat red square, centered, on a pure white background.\r\n`),
  Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="n"\r\n\r\n1\r\n`),
  Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="size"\r\n\r\n1024x1024\r\n`),
  Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="image[]"; filename="player-master.png"\r\nContent-Type: image/png\r\n\r\n`), img, Buffer.from("\r\n"),
  Buffer.from(`--${B}--\r\n`),
];
const body = Buffer.concat(parts);
const t0 = Date.now();
const r = await doFetch(`${base}/images/edits`, {
  method: "POST",
  headers: {
    "content-type": `multipart/form-data; boundary=${B}`,
    "content-length": String(body.length),
    authorization: `Bearer ${cfg.apiKey}`,
  },
  body,
});
const text = await r.text();
const t = ((Date.now() - t0) / 1000).toFixed(1);
let note = text.slice(0, 260);
if (r.ok) { try { const d = JSON.parse(text); note = `有 b64_json=${!!d.data?.[0]?.b64_json} 顶层键=${Object.keys(d).join(",")}`; if (d.data?.[0]?.b64_json) fs.writeFileSync(".scratch/game-creation-v1/experiments/openai-trial/probe-edits.png", Buffer.from(d.data[0].b64_json, "base64")); } catch {} }
console.log(`edits+content-length → http=${r.status} t=${t}s  ${note}`);
