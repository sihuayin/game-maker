// 票 08 的探针：**落地契约的真 schema**，8 发真实请求，量两个数。
//
//   ① **首发过 Zod 的率** —— 票 27 的 80% 是在另一份**手抄** schema 上量的
//      （与真契约只有 5 个键重合、且顶层没封口，见 ../vws-schema-probe/）。这个数要重量。
//   ② **越界 / 重色各几发** —— 探针已证明 `toJSONSchema` **静默丢掉 superRefine**
//      ⇒ 模型**看不见**「色板不得重色」，也**看不见**「palette:N 要指得回来」。
//      这两条会静默烧掉几次重采样，而那正是 R16 的 3 次地板撑不撑得住的答案。
//
// ⚠️ **本发刻意不加任何「提示词补丁」**（不把看不见的约束写进 description）——
//    要量的是**原始契约**的率。补丁的收益另算。
// ⚠️ 凭据从环境读，**不落盘**；raw/ 里只有模型的输出与用量。
// ⚠️ 提示词照 `docs/stylespec-extraction.md` 的结构写（票 08 的 Q5 决定：重写 + 迁移两条实测规则）。
//
// 跑法：node .scratch/game-maker-v2/experiments/vws-first-shot/run.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const CONTRACTS = path.join(ROOT, "packages/contracts");
// ⚠️ `.scratch/` 不在任何包的 node_modules 底下 —— 借 contracts 的 require 去 resolve（既有路子）。
const req = createRequire(path.join(CONTRACTS, "package.json"));

const { VisualWorldSpecSchema } = await import(pathToFileURL(path.join(CONTRACTS, "dist/visual-world.js")).href);
const { toolInputSchema, parseToolUse, STRUCTURED_CALL_ATTEMPTS } =
  await import(pathToFileURL(path.join(CONTRACTS, "dist/structured-call.js")).href);

const BASE = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? "";
if (!BASE || !KEY) throw new Error("凭据没配：ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN");
const MODEL = "deepseek-v4-pro";
const TOOL = "emit_visual_world";
const SHOTS = 8;
const MAX_TOKENS = 16_000;
const SHOT_TIMEOUT_MS = 180_000;

// ── 模型面向的 schema：按票 08 第 1 轮 Q2（调用方注入 styleReferences）────────
const ModelFacing = VisualWorldSpecSchema.omit({ styleReferences: true });
const INPUT_SCHEMA = toolInputSchema(ModelFacing);
const styleRefTop = VisualWorldSpecSchema.shape.styleReferences;   // 注入是调用方的事，模型不该被问

const img = fs.readFileSync(path.join(ROOT, "fixtures/reference/halt-dusk.png"));
const imageBlock = { type: "image", source: { type: "base64", media_type: "image/png", data: img.toString("base64") } };
const requirement = fs.readFileSync(path.join(ROOT, "inputs/last-train/PROMPT.md"), "utf8").trim();
const STYLE_ID = "halt-dusk";

const PROMPT = `这是一张游戏截图，将作为**风格参考图**。

提取它的**视觉语法**（视觉语法 = 这个世界长什么样、按什么规则长），
**不要描述画面内容**、不要提 UI 文字、不要复述剧情。

palette 的选择标准是**能不能画出这个世界里的东西**，不是它在图上占多大面积：
- 每个色都**必须真的出现在这张图里** —— 不要补全猜测色、不要凭空发明
- ⚠️ **不要**按画面占比从高到低排序。参考图往往 80% 以上是中性色，
  按占比分配的色板会**全是灰的**，而灰的色板画不出招牌、发光屏、机器外壳、罐子这些**必须画得出来**的东西
- 顺序随意。下面还给了这个世界**将来要画什么**，照它挑能画出那些东西的颜色

constraints 只写**生成新资源时必须遵守的规则**，
⚠️ **不要**写「某色面积 < X%」这类数值上限 —— 那类句子会把**重音色当成污染物**，
而这个色板恰恰需要重音色。

⚠️ style.id 请**照抄**这个值：${STYLE_ID}

# 这个世界将来要画什么
${requirement}

只调 ${TOOL} 工具，不要解释。`;

// ── 违规统计：模型自己看不见的那两条 ─────────────────────────────────────
function violations(v) {
  const pal = v?.style?.palette ?? [];
  const n = pal.length;
  const dupes = [...new Set(pal.filter((c, i) => pal.indexOf(c) !== i))];
  const refs = [];
  const push = (where, s) => { const m = /^palette:(\d+)$/.exec(s ?? ""); if (m) refs.push({ where, idx: Number(m[1]) }); };
  for (const [bucket, arr] of Object.entries(v?.palette ?? {})) for (const s of arr ?? []) push(bucket, s);
  for (const [name, m] of Object.entries(v?.materials ?? {})) for (const s of m?.color ?? []) push(`materials.${name}`, s);
  const oob = refs.filter((r) => r.idx >= n);
  const bucketsEmpty = Object.values(v?.palette ?? {}).every((a) => (a ?? []).length === 0);
  return { paletteLen: n, dupes, refs: refs.length, oob, bucketsEmpty, oobTexts: refs.filter((r) => r.idx >= n).map((r) => `${r.where}=palette:${r.idx}`) };
}

async function shot(i) {
  const label = `${String(i).padStart(2, "0")}-first-shot`;
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), SHOT_TIMEOUT_MS);
  let body = null, http = null, err = null;
  try {
    const res = await fetch(`${BASE}/v1/messages`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL, max_tokens: MAX_TOKENS, thinking: { type: "disabled" },
        tools: [{ name: TOOL, description: "输出一份 VisualWorldSpec", input_schema: INPUT_SCHEMA }],
        tool_choice: { type: "tool", name: TOOL },
        messages: [{ role: "user", content: [imageBlock, { type: "text", text: PROMPT }] }],
      }),
    });
    http = res.status;
    const text = await res.text();
    try { body = JSON.parse(text); } catch (e) { body = { __notJson: text.slice(0, 800), __err: e.message }; }
  } catch (e) {
    err = ctl.signal.aborted ? `超时（${SHOT_TIMEOUT_MS / 1000}s）` : String(e?.message ?? e);
  } finally { clearTimeout(timer); }
  const ms = Date.now() - t0;

  // ⚠️ 判据只有一句：**入参过 Zod 才算成功**（R16）。
  const parsed = err ? { ok: false, failure: "timeout", detail: err }
    : http !== 200 ? { ok: false, failure: "http", detail: `HTTP ${http}` }
    : parseToolUse(body, TOOL, ModelFacing);

  const rawInput = body?.content?.find?.((b) => b.type === "tool_use" && b.name === TOOL)?.input ?? null;
  const rec = {
    label, ms, http, error: err ?? null,
    servedModel: body?.model ?? null, requestedModel: MODEL,
    blockTypes: (body?.content ?? []).map((b) => b.type),
    stopReason: body?.stop_reason ?? null, usage: body?.usage ?? null,
    ok: parsed.ok, failure: parsed.ok ? null : parsed.failure, detail: parsed.ok ? null : parsed.detail,
    violations: parsed.ok ? violations(parsed.value) : null,
    input: rawInput,
  };
  fs.writeFileSync(path.join(HERE, "raw", `${label}.json`), JSON.stringify(rec, null, 2));
  return rec;
}

console.log(`票 08 探针 —— ${SHOTS} 发（base=${BASE}）`);
console.log(`模型面向的 schema：${Object.keys(ModelFacing.shape).length} 键（.omit({styleReferences})）· ${Buffer.byteLength(JSON.stringify(INPUT_SCHEMA))} B`);
console.log(`重采样地板（R16）：${STRUCTURED_CALL_ATTEMPTS} · max_tokens=${MAX_TOKENS} · 图=halt-dusk.png(${img.length}B) · 需求=inputs/last-train/PROMPT.md(${requirement.length}字符)\n`);

const rows = [];
for (let i = 1; i <= SHOTS; i++) {
  const r = await shot(i);
  rows.push(r);
  const v = r.violations;
  console.log(
    `  ${String(i).padStart(2, "0")}: HTTP ${r.http ?? "—"} · ${r.ms}ms · served=${r.servedModel ?? "?"} · stop=${r.stopReason ?? "?"} · out_tok=${r.usage?.output_tokens ?? "?"} · ` +
    (r.ok ? `✅ 过 Zod` : `❌ ${r.failure}`) +
    (v ? `  · 色板${v.paletteLen}色 · 重色${v.dupes.length} · 引用${v.refs} · 越界${v.oob.length}${v.bucketsEmpty ? " · ⚠️六桶全空" : ""}` : "")
  );
  if (!r.ok) console.log(`      病因：${String(r.detail).slice(0, 220)}`);
}

const okN = rows.filter((r) => r.ok).length;
console.log("\n── 汇总 ──────────────────────────────────────────────");
console.log(`① 首发过 Zod：**${okN}/${SHOTS}**（${(100 * okN / SHOTS).toFixed(0)}%）`);
const byFail = {};
for (const r of rows) if (!r.ok) byFail[r.failure] = (byFail[r.failure] ?? 0) + 1;
console.log(`   失败分布：${Object.entries(byFail).map(([k, n]) => `${k}×${n}`).join(" · ") || "（无失败）"}`);
const vios = rows.filter((r) => r.ok).map((r) => r.violations);
if (vios.length) {
  const bad = vios.filter((v) => v.dupes.length || v.oob.length || v.bucketsEmpty);
  console.log(`② 「过 Zod 但有模型看不见的违规」：**${bad.length}/${vios.length}**`);
  console.log(`   重色：${vios.filter((v) => v.dupes.length).length} 发 · 越界：${vios.filter((v) => v.oob.length).length} 发 · 六桶全空：${vios.filter((v) => v.bucketsEmpty).length} 发`);
  for (const v of vios) if (v.dupes.length || v.oob.length) console.log(`     · 重色[${v.dupes.join(",")}] 越界[${v.oobTexts.slice(0, 6).join(" ")}]`);
  console.log(`   色板长度：${vios.map((v) => v.paletteLen).join(", ")}`);
}
console.log(`\n⚠️ 3 次重采样地板下的估计成功率：` +
  (okN === 0 ? "全败 ⇒ 地板撑不住" : `${(100 * (1 - Math.pow(1 - okN / SHOTS, STRUCTURED_CALL_ATTEMPTS))).toFixed(1)}%（按首发 ${(100 * okN / SHOTS).toFixed(0)}% 独立重抽算）`));
console.log(`raw/ 落 ${rows.length} 份（只含模型输出与用量，无凭据）`);
