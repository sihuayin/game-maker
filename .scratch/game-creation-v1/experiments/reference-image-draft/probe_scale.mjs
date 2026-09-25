// 票 04 问题 3 问「多大分辨率」。上游既然会重编码/缩放，图送大一点会不会多留住细节？
// 用**整数倍最近邻**放大（不引入插值色，像素网格仍是完美的），各提取一次做对照。
import fs from "node:fs";
import { StyleSpecSchema } from "../../../../packages/contracts/dist/index.js";
import { decodePNG, encodePNG } from "../../../../packages/assets/dist/png.js";
import { emptyImage } from "../../../../packages/assets/dist/image.js";
import { PROMPT } from "../stylespec-extraction/prompt.mjs";

const B = process.env.ANTHROPIC_BASE_URL, K = process.env.ANTHROPIC_AUTH_TOKEN;
const lowerHex = (s) => s.replace(/#[0-9A-Fa-f]{6}\b/g, (h) => h.toLowerCase());
const strip = (s) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

function upscale(img, k) {
  const o = emptyImage(img.width * k, img.height * k);
  for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) {
    const s = (Math.floor(y / k) * img.width + Math.floor(x / k)) * 4, d = (y * o.width + x) * 4;
    img.data.copy(o.data, d, s, s + 4);
  }
  return o;
}

const base = decodePNG(fs.readFileSync("out/ref-C.png"));
const sizes = { "480×270 (原生)": base, "960×540 (2× 最近邻)": upscale(base, 2) };
const res = {};
for (const [label, img] of Object.entries(sizes)) {
  const b64 = encodePNG(img).toString("base64");
  const t0 = Date.now();
  const r = await fetch(`${B}/v1/messages`, { method: "POST",
    headers: { "content-type": "application/json", "x-api-key": K },
    body: JSON.stringify({ model: "deepseek-v4-pro", max_tokens: 6000, thinking: { type: "disabled" },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
        { type: "text", text: PROMPT }] }] }) });
  const j = await r.json();
  const raw = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
  let obj = null, ok = false;
  try { obj = JSON.parse(strip(raw)); ok = StyleSpecSchema.safeParse(JSON.parse(lowerHex(JSON.stringify(obj)))).success; } catch {}
  res[label] = { obj, ok, ms: Date.now() - t0, kib: (encodePNG(img).length / 1024).toFixed(1) };
  console.log(`\n── ${label}  ${((Date.now() - t0) / 1000).toFixed(1)}s  过schema=${ok}  文件 ${res[label].kib} KiB`);
  if (obj) {
    console.log("  shapeLanguage:", JSON.stringify(obj.shapeLanguage));
    console.log("  material     :", JSON.stringify(obj.material));
    console.log("  characterStyle:", JSON.stringify(obj.characterStyle));
    console.log("  palette      :", obj.palette.join(" "));
  }
}
fs.writeFileSync("out/scale-probe.json", JSON.stringify(res, null, 2) + "\n");
