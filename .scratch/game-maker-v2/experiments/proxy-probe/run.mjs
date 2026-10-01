// 票 25 的探针。**三发**，每一发只回答一个问题。
//
//   ① 合成图 + 数数   —— 判别模型**真看见**（不是「收得下图块、看不见图」）
//   ② 真参考图 + 大 JSON —— 判别真图 + 一次性能不能吐出 VisualWorldSpec 那个量级
//   ③ tools + tool_choice —— 判别结构化输出（票 01 的「1/3」今天是否还成立）
//
// ⚠️ 探针**不入 packages/**（仓库惯例，见 out/__probe*）。凭据从环境读，**不落盘**。
import fs from "node:fs";
import path from "node:path";
import { encodePNG } from "../../../../packages/assets/dist/png.js";

const BASE = process.env.ANTHROPIC_BASE_URL ?? "";
const KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? "";
if (!BASE || !KEY) throw new Error("凭据没配：ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN");
const MODEL = "deepseek-v4-pro";
const HERE = import.meta.dirname

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
    let j = null; try { j = JSON.parse(text); } catch {}
    const blocks = j?.content ?? [];
    const out = {
      label, ms, status: res.status, ok: res.ok,
      servedModel: j?.model ?? null,
      blockTypes: blocks.map((b) => b.type),
      stopReason: j?.stop_reason ?? null,
      usage: j?.usage ?? null,
      text: blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join(""),
      toolUse: blocks.filter((b) => b.type === "tool_use").map((b) => ({ name: b.name, input: b.input })),
      rawIfNotJson: j ? undefined : text.slice(0, 400),
    };
    fs.writeFileSync(path.join(HERE, "raw", `${label}.json`), JSON.stringify(out, null, 2));
    console.log(`  ${label}: HTTP ${out.status} · ${ms}ms · model=${out.servedModel} · blocks=[${out.blockTypes}] · stop=${out.stopReason} · out_tokens=${out.usage?.output_tokens ?? "?"}`);
    return out;
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = ctl.signal.aborted ? `超时（${Math.round(timeoutMs/1000)}s）` : String(e?.message ?? e);
    fs.writeFileSync(path.join(HERE, "raw", `${label}.json`), JSON.stringify({ label, ms, error: msg }, null, 2));
    console.log(`  ${label}: ❌ ${msg} · ${ms}ms`);
    return { label, ms, error: msg };
  } finally { clearTimeout(timer); }
}

// ── 合成图：白底，三个实心圆，左红 / 中绿 / 右蓝 ────────────────────────
function synth() {
  const W = 96, H = 48, data = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i*4]=255; data[i*4+1]=255; data[i*4+2]=255; data[i*4+3]=255; }
  const circles = [{ x: 16, c: [220, 30, 30] }, { x: 48, c: [30, 170, 30] }, { x: 80, c: [30, 60, 220] }];
  for (const { x: cx, c } of circles)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if ((x-cx)**2 + (y-H/2)**2 <= 12**2) {
        const i = (y*W+x)*4; data[i]=c[0]; data[i+1]=c[1]; data[i+2]=c[2]; data[i+3]=255;
      }
  return { width: W, height: H, data };
}
const b64 = (buf) => buf.toString("base64");
const imgBlock = (im) => ({ type: "image", source: { type: "base64", media_type: "image/png", data: b64(encodePNG(im)) } });

console.log("票 25 探针 —— 3 发\n");

// ── ① 合成图 + 数数 ───────────────────────────────────────────────────
console.log("① 合成图（白底 3 个圆，左红中绿右蓝）—— 判别「真看见」");
const p1 = await call("01-synthetic-count", {
  model: MODEL, max_tokens: 400, thinking: { type: "disabled" },
  messages: [{ role: "user", content: [
    imgBlock(synth()),
    { type: "text", text: "这张图里有几个圆？从左到右分别是什么颜色？只回一行，格式：N 个；左=颜色 中=颜色 右=颜色，不要解释。" },
  ]}],
});
console.log("     模型答：" + JSON.stringify((p1.text ?? "").trim().slice(0, 120)));
console.log("     真值：" + JSON.stringify("3 个；左=红 中=绿 右=蓝"));

// ── ② 真参考图 + 大 JSON ──────────────────────────────────────────────
console.log("\n② 真参考图 fixtures/reference/halt-dusk.png（480×270）—— 真图 + 大 JSON 极限");
const real = fs.readFileSync(path.resolve(HERE, "../../../../fixtures/reference/halt-dusk.png"));
const p2 = await call("02-real-image-bigjson", {
  model: MODEL, max_tokens: 4000, thinking: { type: "disabled" },
  messages: [{ role: "user", content: [
    { type: "image", source: { type: "base64", media_type: "image/png", data: b64(real) } },
    { type: "text", text: `看这张风格参考图，输出**一个 JSON 对象**（不要 markdown 围栏、不要解释），键恰好这十一个：
identity{styleName,keywords[],description} rendering{style,pixelDensity,outline,shading,texture,dithering}
camera{mode,projection,angle} composition{foreground,midground,background,density}
palette{primary[],secondary[],accent[],background[],shadow[],highlight[]}
lighting{direction,softness,contrast,mood} materials{} character{proportions,silhouette,clothing}
environment{architecture,terrain,props} animation{frameStyle,timing} readability{silhouette,contrast}
色彩一律用 #rrggbb。` },
  ]}],
});
if (p2.text) {
  const fenced = /^\s*```/.test(p2.text);
  let parsed = null, perr = null;
  try { parsed = JSON.parse(p2.text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")); } catch (e) { perr = e.message; }
  console.log(`     输出 ${p2.text.length} 字符 · 围栏=${fenced} · JSON.parse=${parsed ? "✅" : "❌ " + perr} · 顶层键=${parsed ? Object.keys(parsed).length : "?"} · stop=${p2.stopReason}`);
  if (parsed) console.log(`     键：${Object.keys(parsed).join(" ")}`);
} else if (p2.error) console.log(`     ⚠️ ${p2.error}`);

// ── ③ tools + tool_choice ─────────────────────────────────────────────
console.log("\n③ tools + tool_choice（强制走工具）—— 结构化输出");
const p3 = await call("03-tool-choice", {
  model: MODEL, max_tokens: 500, thinking: { type: "disabled" },
  tools: [{ name: "emit_style", description: "给出一个风格名与三个关键词",
    input_schema: { type: "object", properties: {
      styleName: { type: "string" }, keywords: { type: "array", items: { type: "string" } } },
      required: ["styleName", "keywords"] } }],
  tool_choice: { type: "tool", name: "emit_style" },
  messages: [{ role: "user", content: "一个黄昏山间列车小站的像素画风格。" }],
});
console.log(`     blocks=[${(p3.blockTypes ?? []).join(",")}] · tool_use=${p3.toolUse?.length ?? 0} · ${p3.error ?? "HTTP " + p3.status}`);
if (p3.toolUse?.length) console.log("     input=" + JSON.stringify(p3.toolUse[0].input).slice(0, 160));
