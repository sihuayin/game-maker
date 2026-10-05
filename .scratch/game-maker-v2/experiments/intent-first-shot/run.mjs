// 票 09 的探针：**落地契约的真 schema**（已删顶层 `resources`），4 发真实请求。
//
// 要量三件事（票 09 Q7 授权 n=4，且**不能据此改大结构**）：
//   ① **首发过 Zod 的率** —— 票 08 的 75% 与票 27 的 80% 都是**别的 schema**上量的
//      （08 那份有内嵌开放对象，27 那份是手抄的）⇒ 本 schema 的率没人知道。
//   ② **失败长在哪儿** —— 这份 schema 与 08 形状相反：更平、无开放对象、无 `$ref`，
//      但**数组字段更多**（coreLoop / player.goals / mechanics / entities / winConditions /
//      loseConditions / ambiguity）。若失败集中在数组上，要收窄的就是数组不是对象。
//   ③ **「模型没做决定」的率** —— 即 R2-Q1 要立的那条 gate 的射程表上，每一格各被踩中几次。
//      探针**不立 gate**，只把「空」数出来：那是决定 gate 射程的证据。
//
// ⚠️ **刻意不加任何「提示词补丁」**（不把结构约束写进 description / prompt）——
//    要量的是**原始契约**的率，补丁的收益另算（与票 08 的 vws-first-shot 同一条纪律）。
// ⚠️ 凭据从环境读，**不落盘**；raw/ 里只有模型的输出与用量。
//
// 跑法：node .scratch/game-maker-v2/experiments/intent-first-shot/run.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const CONTRACTS = path.join(ROOT, "packages/contracts");
const req = createRequire(path.join(CONTRACTS, "package.json"));

const { GameIntentSpecSchema } = await import(pathToFileURL(path.join(CONTRACTS, "dist/game-intent.js")).href);
const { toolInputSchema, parseToolUse, STRUCTURED_CALL_ATTEMPTS } =
  await import(pathToFileURL(path.join(CONTRACTS, "dist/structured-call.js")).href);

const BASE = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/$/, "");
const KEY = (process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY ?? "");
if (!BASE || !KEY) throw new Error("凭据没配：ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN");
const MODEL = "deepseek-v4-pro";
const TOOL = "emit_game_intent";
const MAX_TOKENS = 16_000;
const SHOT_TIMEOUT_MS = 180_000;

// 模型面向的 schema == 契约本身（**没有调用方注入的字段** —— 票 09 Q6）
const INPUT_SCHEMA = toolInputSchema(GameIntentSpecSchema);

// 两份输入文本：① 03 §27 的 fixture（结构化、字段几乎点名）② §26 的一句话（什么都没说）
// ⚠️ 本节有**两个** ```text 块（先目录树、后 intent 正文）—— 取含正文的那个。
//   第一版取错了块（拿到 62 字符的目录树），那是**脚本**的假证据，不是模型的。
const SEC27 = fs.readFileSync(path.join(ROOT, "docs/v2/03-claude-code.md"), "utf8")
  .split("# 27. E2E Fixture")[1].split("# 28. E2E 输出")[0];
const VERBOSE = SEC27.split("```text").map((b) => b.split("```")[0].trim())
  .find((b) => b.includes("制作一个横版废土寻宝游戏"));
if (!VERBOSE) throw new Error("§27 里没找到 intent 正文块 —— 先修脚本再跑，别拿假证据当率");
const TERSE = "做一个废土横版寻宝游戏";
const ALL_SHOTS = [
  { tag: "verbose-1", text: VERBOSE },
  { tag: "verbose-2", text: VERBOSE },
  { tag: "terse-1", text: TERSE },
  { tag: "terse-2", text: TERSE },
];
// 「只跑某一臂」：node run.mjs verbose —— 用来补跑被脚本 bug 弄脏的那一半
const ONLY = new Set(process.argv.slice(2));
const SHOTS = ONLY.size ? ALL_SHOTS.filter((s) => ONLY.has(s.tag.split("-")[0])) : ALL_SHOTS;

const promptFor = (text) => `${text}

只调 ${TOOL} 工具，不要解释。`;

// ── 「模型没做决定」的扫描（**只数数，不判生死** —— 射程表由 R2-Q1 定）──────────
const REQ_STRINGS = ["genre", "targetExperience"];
const REQ_NESTED = [["player", "role"], ["world", "theme"], ["world", "setting"], ["world", "atmosphere"]];
const REQ_ARRAYS = ["coreLoop", "winConditions", "loseConditions", "ambiguity"];
const COUNT_ARRAYS = ["coreLoop", "mechanics", "entities", ["player", "goals"]];
const blank = (s) => typeof s !== "string" || s.trim() === "";
function emptiness(v) {
  const out = [];
  for (const k of REQ_STRINGS) if (blank(v[k])) out.push(k);
  for (const [a, b] of REQ_NESTED) if (blank(v?.[a]?.[b])) out.push(`${a}.${b}`);
  for (const k of REQ_ARRAYS) if (!Array.isArray(v[k])) out.push(`${k}(非数组)`); else v[k].forEach((s, i) => blank(s) && out.push(`${k}[${i}]`));
  for (const k of COUNT_ARRAYS) { const arr = Array.isArray(k) ? v?.[k[0]]?.[k[1]] : v[k]; if (!Array.isArray(arr) || arr.length === 0) out.push(`${Array.isArray(k) ? k.join(".") : k}=空数组`); }
  (v.mechanics ?? []).forEach((m, i) => { blank(m?.name) && out.push(`mechanics[${i}].name`); blank(m?.id) && out.push(`mechanics[${i}].id`); });
  (v.entities ?? []).forEach((e, i) => { blank(e?.role) && out.push(`entities[${i}].role`); blank(e?.id) && out.push(`entities[${i}].id`); });
  for (const opt of ["progression", "challenge"]) {
    const o = v?.[opt];
    if (o && typeof o === "object" && !Object.values(o).some((x) => !blank(x))) out.push(`${opt}=空壳`);
  }
  // 重复 id：跨阶段的 id 延续靠它，重了就是歧义
  const dup = (arr, field) => { const s = (arr ?? []).map((x) => x?.[field]); return s.filter((x, i) => x != null && s.indexOf(x) !== i); };
  for (const d of dup(v.entities, "id")) out.push(`entities.id 重复:${d}`);
  for (const d of dup(v.mechanics, "id")) out.push(`mechanics.id 重复:${d}`);
  return out;
}
// Q5 的验收眼：可收集之物有没有落进 `entities[].type === "resource"`
function resourceShape(v) {
  const byType = {};
  for (const e of v?.entities ?? []) byType[e?.type] = (byType[e?.type] ?? 0) + 1;
  return { byType, hasResourceEntity: (byType.resource ?? 0) > 0, ambiguity: v?.ambiguity ?? [] };
}

async function shot({ tag, text }, i) {
  const label = `${String(i).padStart(2, "0")}-${tag}`;
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
        tools: [{ name: TOOL, description: "输出一份 GameIntentSpec", input_schema: INPUT_SCHEMA }],
        tool_choice: { type: "tool", name: TOOL },
        messages: [{ role: "user", content: [{ type: "text", text: promptFor(text) }] }],
      }),
    });
    http = res.status;
    const t = await res.text();
    try { body = JSON.parse(t); } catch (e) { body = { __notJson: t.slice(0, 800), __err: e.message }; }
  } catch (e) {
    err = ctl.signal.aborted ? `超时（${SHOT_TIMEOUT_MS / 1000}s）` : String(e?.message ?? e);
  } finally { clearTimeout(timer); }
  const ms = Date.now() - t0;

  // ⚠️ 判据只有一句：**入参过 Zod 才算成功**（R16）
  const parsed = err ? { ok: false, failure: "timeout", detail: err }
    : http !== 200 ? { ok: false, failure: "http", detail: `HTTP ${http}` }
    : parseToolUse(body, TOOL, GameIntentSpecSchema);

  const rawInput = body?.content?.find?.((b) => b.type === "tool_use" && b.name === TOOL)?.input ?? null;
  const rec = {
    label, tag, ms, http, error: err ?? null,
    servedModel: body?.model ?? null, requestedModel: MODEL,
    blockTypes: (body?.content ?? []).map((b) => b.type),
    stopReason: body?.stop_reason ?? null, usage: body?.usage ?? null,
    ok: parsed.ok, failure: parsed.ok ? null : parsed.failure, detail: parsed.ok ? null : parsed.detail,
    emptiness: parsed.ok ? emptiness(parsed.value) : null,
    resourceShape: parsed.ok ? resourceShape(parsed.value) : null,
    input: rawInput,
  };
  fs.writeFileSync(path.join(HERE, "raw", `${label}.json`), JSON.stringify(rec, null, 2));
  return rec;
}

console.log(`票 09 探针 —— ${SHOTS.length} 发（base=${BASE}）`);
console.log(`模型面向的 schema：${Object.keys(GameIntentSpecSchema.shape).length} 键（**无注入、无 .omit()**）· ${Buffer.byteLength(JSON.stringify(INPUT_SCHEMA))} B`);
console.log(`重采样地板（R16）：${STRUCTURED_CALL_ATTEMPTS} · max_tokens=${MAX_TOKENS}`);
console.log(`输入：verbose（03 §27 的 fixture，${VERBOSE.length} 字符）×2 · terse（「${TERSE}」）×2${ONLY.size ? ` · 本发只跑：${[...ONLY].join(",")}` : ""}\n`);

const rows = [];
for (let i = 0; i < SHOTS.length; i++) {
  const r = await shot(SHOTS[i], i + 1);
  rows.push(r);
  const e = r.emptiness;
  console.log(`  ${r.label.padEnd(12)}: HTTP ${r.http ?? "—"} · ${r.ms}ms · served=${r.servedModel ?? "?"} · stop=${r.stopReason ?? "?"} · out_tok=${r.usage?.output_tokens ?? "?"} · ` +
    (r.ok ? "✅ 过 Zod" : `❌ ${r.failure}`) +
    (e ? `  · 空/缺 ${e.length} 处${e.length ? `：${e.slice(0, 6).join(" ")}` : ""}` : ""));
  if (!r.ok) console.log(`      病因：${String(r.detail).slice(0, 260)}`);
  if (r.ok) console.log(`      实体桶：${JSON.stringify(r.resourceShape.byType)} · ambiguity ${r.resourceShape.ambiguity.length} 条${r.resourceShape.ambiguity.length ? `：${r.resourceShape.ambiguity.slice(0, 3).join(" / ")}` : ""}`);
}

const okN = rows.filter((r) => r.ok).length;
console.log("\n── 汇总 ──────────────────────────────────────────────");
console.log(`① 首发过 Zod：**${okN}/${rows.length}**（${(100 * okN / rows.length).toFixed(0)}%）`);
const byFail = {}; for (const r of rows) if (!r.ok) byFail[r.failure] = (byFail[r.failure] ?? 0) + 1;
console.log(`   失败分布：${Object.entries(byFail).map(([k, n]) => `${k}×${n}`).join(" · ") || "（无失败）"}`);
const eok = rows.filter((r) => r.ok);
if (eok.length) {
  console.log(`② 「过 Zod 但没做决定」：**${eok.filter((r) => r.emptiness.length).length}/${eok.length}**`);
  const tally = {}; for (const r of eok) for (const k of r.emptiness) { const key = k.replace(/\[\d+\]/g, "[]"); tally[key] = (tally[key] ?? 0) + 1; }
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(2)}/${eok.length}  ${k}`);
  console.log(`③ Q5 验收眼（可收集之物落没落进 entities[type=resource]）：${eok.map((r) => `${r.tag}=${r.resourceShape.hasResourceEntity ? "有" : "无"}(${JSON.stringify(r.resourceShape.byType)})`).join(" · ")}`);
  console.log(`④ ambiguity 条数：${eok.map((r) => `${r.tag}=${r.resourceShape.ambiguity.length}`).join(" · ")}`);
  console.log(`   样张：${JSON.stringify(eok[0].resourceShape.ambiguity)}`);
}
console.log(`\n⚠️ 3 次重采样地板下的估计成功率：` +
  (okN === 0 ? "全败 ⇒ 地板撑不住" : `${(100 * (1 - Math.pow(1 - okN / rows.length, STRUCTURED_CALL_ATTEMPTS))).toFixed(1)}%（按首发 ${(100 * okN / rows.length).toFixed(0)}% 独立重抽算）`));
console.log(`raw/ 落 ${rows.length} 份（只含模型输出与用量，无凭据）`);
