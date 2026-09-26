// 探针：这条中转收不收**输入图**？
// 直接关系到母版→动画那条路在这个协议下还成不成立。
// /images/generations 明确不收（那是 /images/edits 的多部件形态）—— 验一下 edits 通不通。
import fs from "node:fs";
import path from "node:path";
import { createProxyFetch } from "../../../../packages/assets/dist/index.js";

const cfg = JSON.parse(fs.readFileSync(path.resolve("game-maker.local.json"), "utf8")).image;
const doFetch = cfg.proxy ? createProxyFetch({ proxy: cfg.proxy }) : fetch;
const base = cfg.baseUrl.replace(/\/+$/, "");
const img = fs.readFileSync("inputs/master-to-animation/player-master.png");

function multipart(fields) {
  const B = "----gm" + Math.random().toString(16).slice(2);
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v && typeof v === "object" && v.file) {
      parts.push(Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="${k}"; filename="${v.name}"\r\nContent-Type: image/png\r\n\r\n`), v.file, Buffer.from("\r\n"));
    } else {
      parts.push(Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
  }
  parts.push(Buffer.from(`--${B}--\r\n`));
  return { body: Buffer.concat(parts), type: `multipart/form-data; boundary=${B}` };
}

const cases = [
  ["edits multipart", () => {
    const m = multipart({ model: cfg.model, image: { file: img, name: "player-master.png" }, prompt: "A single small flat red square, centered, on a pure white background.", n: "1", size: "1024x1024" });
    return { url: `${base}/images/edits`, headers: { "content-type": m.type, authorization: `Bearer ${cfg.apiKey}` }, body: m.body };
  }],
  ["generations + image b64 字段", () => ({
    url: `${base}/images/generations`,
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, prompt: "A single small flat red square, centered, on a pure white background.", n: 1, size: "1024x1024", image: img.toString("base64") }),
  })],
];

for (const [name, make] of cases) {
  const t0 = Date.now();
  try {
    const r = await doFetch(make().url, { method: "POST", headers: make().headers, body: make().body });
    const text = await r.text();
    const t = ((Date.now() - t0) / 1000).toFixed(1);
    let note = text.slice(0, 200);
    if (r.ok) { try { const d = JSON.parse(text); note = `有 b64_json=${!!d.data?.[0]?.b64_json} 顶层键=${Object.keys(d).join(",")}`; } catch {} }
    console.log(`${name} → http=${r.status} t=${t}s  ${note}`);
  } catch (e) { console.log(`${name} → 抛了：${e.message}`); }
}
