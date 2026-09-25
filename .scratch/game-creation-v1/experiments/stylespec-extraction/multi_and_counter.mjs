// 票 15 的第 5 条（多图语义）与第 7 条（反例验证）。
import fs from "node:fs";
import { StyleSpecSchema } from "../../../../packages/contracts/dist/index.js";
import { PROMPT } from "./prompt.mjs";

const B = process.env.ANTHROPIC_BASE_URL, K = process.env.ANTHROPIC_AUTH_TOKEN;
const b64 = (p) => fs.readFileSync(p).toString("base64");
const lowerHex = (s) => s.replace(/#[0-9A-Fa-f]{6}\b/g, (h) => h.toLowerCase());
const strip = (s) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

async function run(label, images, extra = "") {
  const content = images.map((p) => ({ type: "image", source: { type: "base64", media_type: "image/png", data: b64(p) } }));
  content.push({ type: "text", text: PROMPT + extra });
  const t0 = Date.now();
  const r = await fetch(`${B}/v1/messages`, { method: "POST",
    headers: { "content-type": "application/json", "x-api-key": K },
    body: JSON.stringify({ model: "deepseek-v4-pro", max_tokens: 6000, thinking: { type: "disabled" },
      messages: [{ role: "user", content }] }) });
  const j = await r.json();
  const raw = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
  let obj = null; try { obj = JSON.parse(strip(raw)); } catch {}
  const ok = obj ? StyleSpecSchema.safeParse(JSON.parse(lowerHex(JSON.stringify(obj)))).success : false;
  console.log(`\n===== ${label}  ${((Date.now()-t0)/1000).toFixed(1)}s  HTTP${r.status}  规范化后过schema=${ok} =====`);
  if (!obj) { console.log("解析失败：", raw.slice(0, 300)); return null; }
  console.log("identity    :", JSON.stringify(obj.identity));
  console.log("palette     :", JSON.stringify(obj.palette));
  console.log("shapeLang   :", JSON.stringify(obj.shapeLanguage));
  console.log("material    :", JSON.stringify(obj.material));
  console.log("lighting    :", JSON.stringify(obj.lighting));
  console.log("constraints :", JSON.stringify(obj.constraints).slice(0, 400));
  return obj;
}

const REF = "../../../../fixtures/reference/test.png";
const a = await run("单图：参考图（基线）", [REF]);
const b = await run("反例：霓虹赛博图", ["out/counterexample-neon.png"]);
const c = await run("多图：参考图 + 霓虹图（无额外说明）", [REF, "out/counterexample-neon.png"]);
fs.writeFileSync("out/multi_and_counter.json", JSON.stringify({ single: a, counter: b, multi: c }, null, 2) + "\n");

const set = (o) => new Set((o?.palette ?? []).map((h) => h.toLowerCase()));
const sa = set(a), sb = set(b), sc = set(c);
console.log("\n── 色板交并 ──");
console.log(`参考图 ${sa.size} 色 · 霓虹图 ${sb.size} 色 · 交集 ${[...sa].filter((h) => sb.has(h)).length} 色`);
console.log(`多图 ${sc.size} 色：其中来自参考图 ${[...sc].filter((h) => sa.has(h)).length}，来自霓虹图 ${[...sc].filter((h) => sb.has(h)).length}，两边都不是 ${[...sc].filter((h) => !sa.has(h) && !sb.has(h)).length}`);
