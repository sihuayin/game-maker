// 票 27 的探针。**七发**，回答「R16 要不要改成 tool_choice」这一件事。
//
//   第 1~5 发：**同一发真实请求 × 5** —— 真参考图 + VisualWorldSpec 全 14 键的 tool schema
//              + 强制 tool_choice。量的是「照 (a) 做，第一发成功的比例」。
//              ⚠️ 5 发都一样，所以它量的是**率**（票 25 只量了「能不能」，n=1）。
//   第 6 发：`strict: true` —— 隔离「代理实不实现真 Anthropic 的 strict」。
//   第 7 发：`output_config.format` —— 隔离「代理实不实现 structured outputs」。
//
// ⚠️ 每发都记**失败病因**（no-tool-use / schema / truncated / http），
//    这正是票 27 的 Q4(ii) 刚定的那条纪律；否则「率」是个假的数。
// ⚠️ 探针**不入 packages/**（仓库惯例，见 out/__probe*）。凭据从环境读，**不落盘**。
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? "";
if (!BASE || !KEY) throw new Error("凭据没配：ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN");
const MODEL = "deepseek-v4-pro";
const HERE = import.meta.dirname;
const RAW = path.join(HERE, "raw");
fs.mkdirSync(RAW, { recursive: true });

async function call(label, body, { timeoutMs = 180_000 } = {}) {
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/v1/messages`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    const ms = Date.now() - t0;
    const text = await res.text();
    let j = null; let jerr = null;
    try { j = JSON.parse(text); } catch (e) { jerr = e.message; }
    const blocks = j?.content ?? [];
    const out = {
      label, ms, status: res.status, ok: res.ok,
      servedModel: j?.model ?? null, requestedModel: MODEL,
      blockTypes: blocks.map((b) => b.type),
      stopReason: j?.stop_reason ?? null,
      usage: j?.usage ?? null,
      textLen: blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").length,
      textHead: blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").slice(0, 300),
      toolUse: blocks.filter((b) => b.type === "tool_use").map((b) => ({ name: b.name, input: b.input })),
      rawIfNotJson: j ? undefined : text.slice(0, 500),
      jsonErr: jerr ?? undefined,
    };
    fs.writeFileSync(path.join(RAW, `${label}.json`), JSON.stringify(out, null, 2));
    return out;
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = ctl.signal.aborted ? `超时（${Math.round(timeoutMs / 1000)}s）` : String(e?.message ?? e);
    fs.writeFileSync(path.join(RAW, `${label}.json`), JSON.stringify({ label, ms, error: msg }, null, 2));
    return { label, ms, error: msg };
  } finally { clearTimeout(timer); }
}

const b64 = (buf) => buf.toString("base64");
const real = fs.readFileSync(path.resolve(HERE, "../../../../fixtures/reference/halt-dusk.png"));
const realBlock = { type: "image", source: { type: "base64", media_type: "image/png", data: b64(real) } };

// ── VisualWorldSpec 的 schema，逐键照抄 docs/v2/01-contracts.md §2 ──────────
// 必填的只有 §2 里没有 `?` 的那些：schemaVersion / identity{keywords,description}
// / rendering{style} / camera{mode} / palette{六个数组} / materials / character{}
// / environment{} / animation{} / readability{} / references{styleImages} / confidence
const STR = { type: "string" };
const STRARR = { type: "array", items: { type: "string" } };
const VWS_SCHEMA = {
  type: "object",
  properties: {
    schemaVersion: STR,
    identity: { type: "object", properties: { styleName: STR, keywords: STRARR, description: STR }, required: ["keywords", "description"] },
    rendering: { type: "object", properties: {
      style: STR, pixelDensity: { type: "number" }, antialiasing: { type: "boolean" },
      outline: STR, shading: STR, texture: STR, dithering: STR }, required: ["style"] },
    camera: { type: "object", properties: {
      mode: { type: "string", enum: ["side", "top-down", "isometric", "first-person", "other"] },
      projection: STR, angle: { type: "number" }, elevation: { type: "number" }, perspective: STR }, required: ["mode"] },
    composition: { type: "object", properties: {
      foreground: STR, midground: STR, background: STR, objectScale: STR, characterScale: STR, density: STR } },
    palette: { type: "object", properties: {
      primary: STRARR, secondary: STRARR, accent: STRARR, background: STRARR, shadow: STRARR, highlight: STRARR },
      required: ["primary", "secondary", "accent", "background", "shadow", "highlight"] },
    lighting: { type: "object", properties: { direction: STR, softness: STR, contrast: STR, mood: STR } },
    materials: { type: "object", additionalProperties: { type: "object", properties: {
      appearance: STR, texture: STR, color: STRARR }, required: ["appearance"] } },
    character: { type: "object", properties: { proportions: STR, silhouette: STR, poseLanguage: STR, clothing: STR, faceAbstraction: STR } },
    environment: { type: "object", properties: { architecture: STR, terrain: STR, props: STR, textureDensity: STR } },
    animation: { type: "object", properties: { frameStyle: STR, poseExaggeration: STR, timing: STR } },
    readability: { type: "object", properties: { silhouette: STR, contrast: STR, gameplayScale: STR } },
    references: { type: "object", properties: { styleImages: STRARR, characterImages: STRARR, materialImages: STRARR }, required: ["styleImages"] },
    confidence: { type: "number" },
  },
  required: ["schemaVersion", "identity", "rendering", "camera", "palette", "materials",
             "character", "environment", "animation", "readability", "references", "confidence"],
};
const VWS_TOP = Object.keys(VWS_SCHEMA.properties);
const VWS_REQUIRED_TOP = VWS_SCHEMA.required;

const PROMPT = `看这张风格参考图，用 emit_visual_world 工具输出一份 VisualWorldSpec。
要求：palette 里六个数组每项用 #rrggbb；materials 至少给 3 种材质；
references.styleImages 填 ["fixtures/reference/halt-dusk.png"]；confidence 给 0~1 的数。
只调工具，不要解释。`;

// ── 病因判定 —— 票 27 Q4(ii) 的那条纪律，探针自己先按它记 ────────────────
function diagnose(r) {
  if (r.error) return "timeout/网络";
  if (!r.ok) return "http";
  if (r.jsonErr) return "http（body 不是 JSON）";
  if (!r.toolUse?.length) return "no-tool-use";
  const input = r.toolUse[0].input;
  if (input === null || typeof input !== "object" || Array.isArray(input)) return "schema（input 不是对象）";
  const missing = VWS_REQUIRED_TOP.filter((k) => !(k in input));
  if (missing.length) return `schema（缺顶层必填：${missing.join(",")}）`;
  return null; // 成功
}

console.log(`票 27 探针 —— 7 发（base=${BASE}）\n`);
console.log("第 1~5 发：真图 + 14 键 tool schema + 强制 tool_choice（量率）");
const results = [];
for (let i = 1; i <= 5; i++) {
  const label = `0${i}-tool-choice-r${i}`;
  const r = await call(label, {
    model: MODEL, max_tokens: 8000, thinking: { type: "disabled" },
    tools: [{ name: "emit_visual_world", description: "输出一份 VisualWorldSpec", input_schema: VWS_SCHEMA }],
    tool_choice: { type: "tool", name: "emit_visual_world" },
    messages: [{ role: "user", content: [realBlock, { type: "text", text: PROMPT }] }],
  });
  const why = diagnose(r);
  results.push({ i, r, why });
  const input = r.toolUse?.[0]?.input;
  console.log(`  r${i}: HTTP ${r.status ?? "—"} · ${r.ms}ms · served=${r.servedModel ?? "?"} · blocks=[${(r.blockTypes ?? []).join(",")}] · stop=${r.stopReason ?? "?"} · out_tok=${r.usage?.output_tokens ?? "?"} · keys=${input ? Object.keys(input).length : "—"} · ${why ? "❌ " + why : "✅ 成功"}`);
}

console.log("\n第 6 发：strict: true（隔离代理实不实现 strict）");
const p6 = await call("06-strict-true", {
  model: MODEL, max_tokens: 500, thinking: { type: "disabled" },
  tools: [{ name: "emit_style", description: "给出一个风格名与三个关键词", strict: true,
    input_schema: { type: "object", additionalProperties: false,
      properties: { styleName: STR, keywords: STRARR }, required: ["styleName", "keywords"] } }],
  tool_choice: { type: "tool", name: "emit_style" },
  messages: [{ role: "user", content: "一个黄昏山间列车小站的像素画风格。" }],
});
console.log(`  HTTP ${p6.status ?? "—"} · ${p6.ms}ms · blocks=[${(p6.blockTypes ?? []).join(",")}] · stop=${p6.stopReason ?? "?"} · ${p6.error ? "❌ " + p6.error : p6.toolUse?.length ? "✅ 工具被调 · input=" + JSON.stringify(p6.toolUse[0].input).slice(0, 120) : "❌ no-tool-use"}`);
if (!p6.ok) console.log(`     body: ${JSON.stringify(p6.rawIfNotJson ?? p6.textHead).slice(0, 300)}`);

console.log("\n第 7 发：output_config.format（隔离代理实不实现 structured outputs）");
const p7 = await call("07-output-config-format", {
  model: MODEL, max_tokens: 500, thinking: { type: "disabled" },
  output_config: { format: { type: "json_schema", schema: {
    type: "object", additionalProperties: false,
    properties: { styleName: STR, keywords: STRARR }, required: ["styleName", "keywords"] } } },
  messages: [{ role: "user", content: "一个黄昏山间列车小站的像素画风格。" }],
});
console.log(`  HTTP ${p7.status ?? "—"} · ${p7.ms}ms · blocks=[${(p7.blockTypes ?? []).join(",")}] · stop=${p7.stopReason ?? "?"} · ${p7.error ? "❌ " + p7.error : ""}`);
if (p7.ok) console.log(`     text(${p7.textLen}字符): ${JSON.stringify(p7.textHead.slice(0, 200))}`);
else console.log(`     body: ${JSON.stringify(p7.rawIfNotJson ?? p7.textHead).slice(0, 300)}`);

// ── 汇总 ────────────────────────────────────────────────────────────────
console.log("\n── 汇总 ──────────────────────────────────────────────");
const ok = results.filter((x) => !x.why).length;
console.log(`tool_choice 率：${ok}/5 成功`);
for (const { i, why } of results) if (why) console.log(`  r${i} 病因：${why}`);
const models = [...new Set(results.map((x) => x.r.servedModel).filter(Boolean))];
console.log(`servedModel 集合：${models.join(", ") || "—"}（请求的是 ${MODEL}）`);
console.log(`strict:true → ${p6.ok ? (p6.toolUse?.length ? "被接受（工具被调）" : "被接受但没调工具") : "被拒 HTTP " + p6.status}`);
console.log(`output_config.format → ${p7.ok ? "被接受" : "被拒 HTTP " + p7.status}`);
