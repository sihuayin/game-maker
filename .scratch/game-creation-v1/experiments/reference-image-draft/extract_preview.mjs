// 对三个候选**真跑**一次 StyleSpec 提取（用票 15 定下来的那份 prompt），
// 把结果喂给预览页 —— 这样人 react 的不只是「好不好看」，还有「提取器读不读得动」。
import fs from "node:fs";
import { StyleSpecSchema } from "../../../../packages/contracts/dist/index.js";
import { PROMPT } from "../stylespec-extraction/prompt.mjs";

const B = process.env.ANTHROPIC_BASE_URL, K = process.env.ANTHROPIC_AUTH_TOKEN;
const lowerHex = (s) => s.replace(/#[0-9A-Fa-f]{6}\b/g, (h) => h.toLowerCase());
const strip = (s) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

const out = {};
for (const v of ["A", "B", "C"]) {
  const b64 = fs.readFileSync(`out/ref-${v}.png`).toString("base64");
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
  out[v] = { spec: obj, schemaOk: ok, ms: Date.now() - t0 };
  console.log(`[${v}] ${((Date.now() - t0) / 1000).toFixed(1)}s 过schema=${ok} palette=${obj?.palette?.length ?? "?"} 色`);
}
fs.writeFileSync("out/extractions.json", JSON.stringify(out, null, 2) + "\n");
console.log("→ out/extractions.json");
