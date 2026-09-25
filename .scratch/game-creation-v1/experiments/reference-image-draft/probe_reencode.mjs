// 决定性测试：给一张**纯单色**的图，问它是什么颜色。
// 如果答案不是那个精确的 hex，那「读不准」就与图的色数无关 —— 是上游重编码。
import fs from "node:fs";
import { canvas } from "./draw.mjs";

const B = process.env.ANTHROPIC_BASE_URL, K = process.env.ANTHROPIC_AUTH_TOKEN;
const CASES = [[0x4a,0x60,0x76], [0xd9,0xa4,0x41], [0x6b,0x4a,0x33], [0xe6,0xe2,0xd6], [0x2e,0x3b,0x4e]];
const hex = (c) => "#" + c.map((n) => n.toString(16).padStart(2, "0")).join("");

for (const col of CASES) {
  const c = canvas(64, 64, col);
  const b64 = c.png().toString("base64");
  const r = await fetch(`${B}/v1/messages`, { method: "POST",
    headers: { "content-type": "application/json", "x-api-key": K },
    body: JSON.stringify({ model: "deepseek-v4-pro", max_tokens: 200, thinking: { type: "disabled" },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
        { type: "text", text: "这张图是纯色的。只回答它的 hex 色值，形如 #rrggbb，不要其他任何字。" }] }] }) });
  const j = await r.json();
  const got = ((j.content || []).filter((x) => x.type === "text").map((x) => x.text).join("").match(/#[0-9a-fA-F]{6}/) || ["?"])[0].toLowerCase();
  const t = [1,3,5].map((i) => parseInt(got.slice(i, i+2), 16));
  const d = got === "?" ? NaN : Math.sqrt(col.reduce((s, v, i) => s + (v - t[i]) ** 2, 0));
  console.log(`  送 ${hex(col)}  →  答 ${got}   ΔRGB=${d.toFixed(1)}  ${d === 0 ? "✅ 精确" : "❌ 不精确"}`);
}
