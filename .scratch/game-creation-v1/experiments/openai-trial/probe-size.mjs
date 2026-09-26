// 探针：这条中转收不收**非方形** size？
// 形状已知（POST {baseUrl}/images/generations → data[0].b64_json），唯一没验的就是 size 枚举。
// 一次一张图，约 30~50 秒。
import fs from "node:fs";
import path from "node:path";
import { createProxyFetch, decodePNG } from "../../../../packages/assets/dist/index.js";

const cfg = JSON.parse(fs.readFileSync(path.resolve("game-maker.local.json"), "utf8")).image;
const doFetch = cfg.proxy ? createProxyFetch({ proxy: cfg.proxy }) : fetch;
const url = `${cfg.baseUrl.replace(/\/+$/, "")}/images/generations`;

const colorTypeOf = (png) => {
  // IHDR: 8 字节签名 + 4 长度 + 4 类型 → 宽(4) 高(4) 位深(1) 颜色类型(1)
  return { colorType: png[8 + 4 + 4 + 8 + 1], bitDepth: png[8 + 4 + 4 + 8] };
};

for (const size of process.argv.slice(2)) {
  const t0 = Date.now();
  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model, n: 1, size,
        prompt: "A single flat red square, centered, on a pure white background. Nothing else.",
      }),
    });
    const text = await res.text();
    const t = ((Date.now() - t0) / 1000).toFixed(1);
    if (!res.ok) { console.log(`${size} → http=${res.status} t=${t}s ${text.slice(0, 160)}`); continue; }
    const doc = JSON.parse(text);
    const b64 = doc.data?.[0]?.b64_json;
    if (!b64) { console.log(`${size} → http=200 但没有 b64_json：${text.slice(0, 160)}`); continue; }
    const png = Buffer.from(b64, "base64");
    const { colorType, bitDepth } = colorTypeOf(png);
    const img = decodePNG(png);
    const px = (x, y) => { const i = (y * img.width + x) * 4; return "#" + [img.data[i], img.data[i+1], img.data[i+2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };
    console.log(`${size} → http=200 t=${t}s  回显 size=${doc.size}  实际 ${img.width}×${img.height}  位深=${bitDepth} colorType=${colorType}(6=有alpha)  四角 ${px(2,2)} ${px(img.width-3,2)} ${px(2,img.height-3)} ${px(img.width-3,img.height-3)}`);
    fs.writeFileSync(`.scratch/game-creation-v1/experiments/openai-trial/probe-${size}.png`, png);
  } catch (e) {
    console.log(`${size} → 抛了：${e.message}`);
  }
}
