// 票 12 的探针：**资产规划**那一发，4 次真实请求。
//
// ⚠️ 与前三发同款形状（08/09/10）：打**真请求**、把模型的输出整个留下来，量的是**出货的那一套**
//   （真提示词 + 真工具说明 + 真镜像）。区别只在于这一发的输入是**两份产物**而不是文本。
//
// 四件事：
//   ① **两层判据各自的率**：过线形状（v4 镜像）与过契约（v3 `parseRecipe`）**是两个数** ——
//      它们的差就是那几条 gate 的贡献。
//   ② **策略分布**：它给什么资产选 image / drawlist / import。
//   ③ **图约束**：环 / 悬空 id / 母版比例不一致，各几发（那三条正是票 11 的判据）。
//   ④ **母版那一环**：`authoring[]` 填不填得出、`masterAsset` / `characterId` 指得解不解得开。
//
// 跑法：node .scratch/game-maker-v2/experiments/plan-first-shot/run.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const CONTRACTS = path.join(ROOT, "packages/contracts");
const req = createRequire(path.join(CONTRACTS, "package.json"));
const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { GameDesignSpecSchema, VisualWorldSpecSchema, parseRecipe } = await load("packages/contracts/dist/index.js");
const { RecipeToolSchema } = await load("packages/contracts/dist/recipe-tool.js");
const { toolInputSchema, parseToolUse, STRUCTURED_CALL_ATTEMPTS } = await load("packages/contracts/dist/structured-call.js");
const { assetPlanPrompt, PLAN_TOOL_DESCRIPTION, PLAN_TOOL_NAME } = await load("packages/assets/dist/prompt.js");

const BASE = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY ?? "";
if (!BASE || !KEY) throw new Error("凭据没配：ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN");
const MODEL = "deepseek-v4-pro";
const MAX_TOKENS = 16_000;
const SHOT_TIMEOUT_MS = 180_000;
const SHOTS = 4;

// ── 输入：**真跑出来过**的两份产物（票 10 的探针与票 08 的探针各留了一份）────────────────
const rawDesign = JSON.parse(fs.readFileSync(path.join(ROOT, ".scratch/game-maker-v2/experiments/design-first-shot/raw/01-normal.json"), "utf8")).input;
const rawWorld = JSON.parse(fs.readFileSync(path.join(ROOT, ".scratch/game-maker-v2/experiments/vws-first-shot/raw/01-first-shot.json"), "utf8")).input;

/** ⚠️ 三个「调用方才知道」的值要**照真流程注入**（票 10 的 Q5）—— 探针量的是这一发，不是那一发。 */
const design = GameDesignSpecSchema.parse({
  ...rawDesign,
  game: { ...rawDesign.game, genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } }
});
const REF_PNG = path.join(ROOT, "fixtures/reference/halt-dusk.png");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "plan-probe-"));
const world = VisualWorldSpecSchema.parse({
  ...rawWorld,
  styleReferences: [{ path: path.relative(tmp, REF_PNG), role: "global" }]
});

const schema = toolInputSchema(RecipeToolSchema);
const PROMPT = assetPlanPrompt({ design, vws: world, echo: { styleRef: "stylespec.json", styleId: world.style.id, referenceImage: "reference.png" } });

/** ③ 图约束 + ② 策略分布 + ④ 母版那一环 —— **都在模型那颗球落地之后才看得到**。 */
function inspect(recipe) {
  const assets = recipe.assets ?? [];
  const strategies = {};
  for (const a of assets) strategies[a?.source?.kind] = (strategies[a?.source?.kind] ?? 0) + 1;
  const kinds = {};
  for (const a of assets) kinds[a?.spec?.kind] = (kinds[a?.spec?.kind] ?? 0) + 1;

  const ids = new Set(assets.map((a) => a?.spec?.id).filter(Boolean));
  const authors = new Map((recipe.authoring ?? []).map((a) => [a.id, a]));
  const dangling = [];
  const selfRef = [];
  const adj = new Map();
  for (const a of assets) {
    const s = a?.spec ?? {};
    const edges = [...(s.dependsOn ?? []), ...(s.masterAsset === undefined ? [] : [s.masterAsset])];
    adj.set(s.id, edges);
    for (const d of s.dependsOn ?? []) {
      if (d === s.id) selfRef.push(d);
      else if (!ids.has(d)) dangling.push(`${s.id}→${d}`);
    }
    if (s.masterAsset !== undefined && !authors.has(s.masterAsset)) dangling.push(`${s.id}→母版 ${s.masterAsset}`);
  }
  // 环（DFS，与契约同款）
  const state = new Map();
  let cycle = null;
  const walk = (n) => {
    const st = state.get(n) ?? 0;
    if (st === 2) return;
    if (st === 1) { cycle = cycle ?? n; return; }
    state.set(n, 1);
    for (const m of adj.get(n) ?? []) walk(m);
    state.set(n, 2);
  };
  for (const id of adj.keys()) if (cycle === null) walk(id);

  const ratioBad = [];
  for (const a of assets) {
    const m = authors.get(a?.spec?.masterAsset);
    if (m === undefined) continue;
    const s = a.spec.size, c = m.size;
    if (s.w * c.h !== c.w * s.h) ratioBad.push(`${a.spec.id}(${s.w}×${s.h} vs ${c.w}×${c.h})`);
  }
  const withChar = assets.filter((a) => a?.spec?.characterId !== undefined).length;
  return { strategies, kinds, dangling, selfRef, cycle, ratioBad, withChar, authors: authors.size };
}

async function shot(i) {
  const label = `${String(i).padStart(2, "0")}-plan`;
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
        tools: [{ name: PLAN_TOOL_NAME, description: PLAN_TOOL_DESCRIPTION, input_schema: schema }],
        tool_choice: { type: "tool", name: PLAN_TOOL_NAME },
        messages: [{ role: "user", content: [{ type: "text", text: PROMPT }] }],
      }),
    });
    http = res.status;
    const t = await res.text();
    try { body = JSON.parse(t); } catch (e) { body = { __notJson: t.slice(0, 800), __err: e.message }; }
  } catch (e) {
    err = ctl.signal.aborted ? `超时（${SHOT_TIMEOUT_MS / 1000}s）` : String(e?.message ?? e);
  } finally { clearTimeout(timer); }
  const ms = Date.now() - t0;

  // ⚠️ **两个数分开数**：过线形状（v4 镜像）与过契约（v3 `parseRecipe`）是**两层**。
  const wire = err ? { ok: false, failure: "timeout", detail: err }
    : http !== 200 ? { ok: false, failure: "http", detail: `HTTP ${http}` }
    : parseToolUse(body, PLAN_TOOL_NAME, RecipeToolSchema);
  const truth = wire.ok ? parseRecipe(wire.value) : null;

  const rec = {
    label, ms, http, error: err ?? null,
    servedModel: body?.model ?? null, requestedModel: MODEL,
    stopReason: body?.stop_reason ?? null, usage: body?.usage ?? null,
    wireOk: wire.ok, wireFailure: wire.ok ? null : wire.failure, wireDetail: wire.ok ? null : wire.detail,
    truthOk: truth === null ? null : truth.ok, truthErrors: truth !== null && !truth.ok ? truth.errors.slice(0, 6) : null,
    inspect: truth !== null && truth.ok ? inspect(truth.value) : null,
    input: body?.content?.find?.((b) => b.type === "tool_use" && b.name === PLAN_TOOL_NAME)?.input ?? null,
  };
  fs.writeFileSync(path.join(HERE, "raw", `${label}.json`), JSON.stringify(rec, null, 2));
  return rec;
}

console.log(`票 12 探针 —— ${SHOTS} 发（base=${BASE}）`);
console.log(`工具 schema（v4 镜像）：7 键 · ${Buffer.byteLength(JSON.stringify(schema))} B · 说明 ${PLAN_TOOL_DESCRIPTION.length} 字符`);
console.log(`提示词 ${PROMPT.length} 字符 · 地板 ${STRUCTURED_CALL_ATTEMPTS} · max_tokens=${MAX_TOKENS}`);
console.log(`输入：票 10 探针的真设计 + 票 08 探针的真 VWS（都是真跑出来过的）\n`);

const rows = [];
for (let i = 1; i <= SHOTS; i++) {
  const r = await shot(i);
  rows.push(r);
  console.log(`  ${r.label}: HTTP ${r.http ?? "—"} · ${r.ms}ms · served=${r.servedModel ?? "?"} · out_tok=${r.usage?.output_tokens ?? "?"} · ` +
    (r.wireOk ? "✅ 过线形状" : `❌ ${r.wireFailure}`) + (r.truthOk === null ? "" : r.truthOk ? " · ✅ 过契约" : " · ❌ 不过契约"));
  if (!r.wireOk) console.log(`      病因：${String(r.wireDetail).slice(0, 200)}`);
  else if (!r.truthOk) console.log(`      契约的病因：${(r.truthErrors ?? []).join(" ｜ ").slice(0, 240)}`);
  else {
    const x = r.inspect;
    console.log(`      策略 ${JSON.stringify(x.strategies)} · 四类 ${JSON.stringify(x.kinds)} · 母版 ${x.authors} 张 · 带 characterId 的资产 ${x.withChar}`);
    console.log(`      图：环=${x.cycle ?? "无"} 悬空=${x.dangling.join(",") || "无"} 自指=${x.selfRef.join(",") || "无"} 比例不符=${x.ratioBad.join(",") || "无"}`);
  }
}

const wireN = rows.filter((r) => r.wireOk).length;
const truthN = rows.filter((r) => r.truthOk === true).length;
console.log("\n── 汇总 ──────────────────────────────────────────────");
console.log(`① 过线形状 **${wireN}/${rows.length}** · 过契约 **${truthN}/${rows.length}**（两个数的差 = 那几条 gate 的贡献）`);
const byFail = {}; for (const r of rows) if (!r.wireOk) byFail[r.wireFailure] = (byFail[r.wireFailure] ?? 0) + 1;
console.log(`   线形状的失败分布：${Object.entries(byFail).map(([k, n]) => `${k}×${n}`).join(" · ") || "（无失败）"}`);
const ok = rows.filter((r) => r.truthOk === true);
if (ok.length) {
  const strat = {}; for (const r of ok) for (const [k, n] of Object.entries(r.inspect.strategies)) strat[k] = (strat[k] ?? 0) + n;
  console.log(`② 策略分布（合计）：${JSON.stringify(strat)}`);
  console.log(`③ 图约束：环 ${ok.filter((r) => r.inspect.cycle !== null).length}/${ok.length} 发 · 悬空 ${ok.filter((r) => r.inspect.dangling.length).length}/${ok.length} 发 · 比例不符 ${ok.filter((r) => r.inspect.ratioBad.length).length}/${ok.length} 发`);
  console.log(`④ 母版：填了 authoring[] 的 ${ok.filter((r) => r.inspect.authors > 0).length}/${ok.length} 发 · 有 characterId 的 ${ok.filter((r) => r.inspect.withChar > 0).length}/${ok.length} 发`);
}
console.log(`\n⚠️ 3 次地板下估计成功率：` +
  (wireN === 0 ? "全败 ⇒ 地板撑不住" : `${(100 * (1 - Math.pow(1 - wireN / rows.length, STRUCTURED_CALL_ATTEMPTS))).toFixed(1)}%（按首发 ${(100 * wireN / rows.length).toFixed(0)}% 独立重抽算）`));
console.log(`raw/ 落 ${rows.length} 份（含模型输出与用量，无凭据）`);
