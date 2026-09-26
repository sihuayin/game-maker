// 2026-09-26 11:07 起，这条中转**两个端点**都回 500 `image generation service unavailable`，
// 而且是**秒回**（1~2 秒）—— 与正常出图的 28~48 秒形成鲜明对比。
// 量一下：这种 500 是「偶发一次」还是「持续一段时间」？隔多久恢复？
// ⚠️ 这直接决定客户端该不该做退避：秒回失败 + 无退避 = 3 次重试全落在同一次故障里。
import fs from "node:fs";
import path from "node:path";
import { createProxyFetch } from "../../../../packages/assets/dist/index.js";

const cfg = JSON.parse(fs.readFileSync(path.resolve("game-maker.local.json"), "utf8")).image;
const doFetch = cfg.proxy ? createProxyFetch({ proxy: cfg.proxy }) : fetch;
const url = `${cfg.baseUrl.replace(/\/+$/, "")}/images/generations`;

const t0 = Date.now();
for (let i = 1; i <= 20; i++) {
  const s = Date.now();
  let note;
  try {
    const r = await doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, prompt: "a single small flat red square on pure white", n: 1, size: "1024x1024" }),
    });
    const text = await r.text();
    note = r.ok ? `✅ 200（${text.length} 字节）` : `❌ ${r.status} ${JSON.parse(text).error?.message ?? text.slice(0, 60)}`;
  } catch (e) { note = `❌ 抛了 ${e.message}`; }
  const el = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`+${el}s  第 ${i} 次  ${((Date.now() - s) / 1000).toFixed(1)}s  ${note}`);
  if (note.startsWith("✅")) { console.log(`→ 故障持续约 ${el} 秒后恢复`); break; }
  await new Promise((r) => setTimeout(r, 30_000));
}
