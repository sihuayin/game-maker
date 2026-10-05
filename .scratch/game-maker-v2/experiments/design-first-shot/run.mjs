// 票 10 的探针：**出货的那一套**（真提示词 + 真工具说明 + 真契约），4 发真实请求。
//
// ⚠️ **与 08 / 09 的探针有一处刻意的不同**：那两发量的是「**原始契约 + 最小说明**」
//   （纪律：「不加任何提示词补丁」）。本票量的是**出货的表面** —— 因为这一步最要紧的两个问题
//   **只存在于提示词里**：① 意图层的 `id` 有没有被照抄下来（id 延续）；② 词表里没有对家的机制，
//   模型是**整条省掉**（对）还是**挑个近似的**（静默损失）。最小说明量不出这两件事。
//   ⇒ 代价：**「纯契约」的首发率本票没量**。要说它，得单独再来一发。
//
// 两臂各 2 发：
//   · normal    —— `03 §27` 那份 fixture 的意图（外壳全做得了）
//   · hostile   —— 同一份，外加一条**外壳做不了**的机制（`m-double-jump` /「二段跳」）
//
// 跑法：node .scratch/game-maker-v2/experiments/design-first-shot/run.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const CONTRACTS = path.join(ROOT, "packages/contracts");
const req = createRequire(path.join(CONTRACTS, "package.json"));

const { GameDesignSpecSchema, VisualWorldSpecSchema } = await import(pathToFileURL(path.join(CONTRACTS, "dist/game-design.js")).href);
const { VisualWorldSpecSchema: VWS } = await import(pathToFileURL(path.join(CONTRACTS, "dist/visual-world.js")).href);
const { toolInputSchema, parseToolUse, STRUCTURED_CALL_ATTEMPTS, PLATFORMER_V1, ENTITY_BUCKETS } =
  await import(pathToFileURL(path.join(CONTRACTS, "dist/index.js")).href);
const { designPrompt, DESIGN_TOOL_NAME, DESIGN_TOOL_DESCRIPTION, buildDesign } =
  await import(pathToFileURL(path.join(ROOT, "packages/game-design/dist/index.js")).href);

const BASE = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY ?? "";
if (!BASE || !KEY) throw new Error("凭据没配：ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN");
const MODEL = "deepseek-v4-pro";
const MAX_TOKENS = 16_000;
const SHOT_TIMEOUT_MS = 180_000;

// ── 输入：一份**真跑出来过的** VWS（取自 08 探针的 raw）+ 两份意图 ────────────────
const rawVws = JSON.parse(fs.readFileSync(path.join(ROOT, ".scratch/game-maker-v2/experiments/vws-first-shot/raw/01-first-shot.json"), "utf8")).input;
const vws = VWS.parse({ ...rawVws, styleReferences: [{ path: "fixtures/reference/halt-dusk.png", role: "global" }] });

const baseIntent = {
  format: "game-intent/v1",
  title: "拾荒者",
  genre: "platformer",
  subgenre: "action-platformer",
  camera: "2D 横向卷轴",
  targetExperience: "荒凉、压抑，但一直向上",
  coreLoop: ["在废土平台上跳跃移动", "收集废料与净水", "抵达区域终点"],
  player: { role: "拾荒者", goals: ["在天黑前抵达安全区"] },
  world: { theme: "后启示录废土", setting: "被沙暴侵蚀的废弃都市", atmosphere: "荒凉、孤寂，偶有暗红天光" },
  mechanics: [{ id: "m-run", name: "左右移动" }, { id: "m-jump", name: "跳跃" }, { id: "m-collect", name: "收集废料" }],
  entities: [
    { id: "e-mutant", type: "enemy", role: "游荡的变异体" },
    { id: "e-scrap", type: "resource", role: "可拾取的废料" },
    { id: "e-terminal", type: "interactable", role: "消耗资源开门的终端" }
  ],
  winConditions: ["开启并进入最终安全区"],
  loseConditions: ["生命值归零"],
  ambiguity: []
};
const hostileIntent = { ...baseIntent, mechanics: [...baseIntent.mechanics, { id: "m-double-jump", name: "二段跳" }] };

const ASSERTED = [baseIntent, baseIntent, hostileIntent, hostileIntent].map((intent, i) => ({ tag: i < 2 ? "normal" : "hostile", intent }));

const schema = toolInputSchema(GameDesignSpecSchema);

/** 出货的提示词 + 说明 */
const promptFor = (intent) => designPrompt({
  intent, vws,
  echo: { runtimeProfile: `${PLATFORMER_V1.id}/v${PLATFORMER_V1.version}`, genre: PLATFORMER_V1.id, camera: vws.camera.mode, ...(intent.title ? { gameTitleHint: intent.title } : {}) }
});

/** 三件事：id 有没有被照抄 · 命名空间对不对 · 做不了的机制是省了还是被近似了 */
function inspect(intent, design) {
  const intentEntityIds = intent.entities.map((e) => e.id);
  const buckets = ["enemies", "npcs", "interactables", "resources"];
  const designIds = buckets.flatMap((b) => (design[b] ?? []).map((x) => x.id));
  const invented = designIds.filter((id) => !intentEntityIds.includes(id));
  const lost = intentEntityIds.filter((id) => !designIds.includes(id));
  const wrongBucket = intent.entities.filter((e) => !(design[ENTITY_BUCKETS[e.type]] ?? []).some((x) => x.id === e.id)).map((e) => e.id);
  const intentMechIds = intent.mechanics.map((m) => m.id);
  const designMechIds = (design.mechanics ?? []).map((m) => m.id);
  const MECHANICS = ["run", "jump", "gravity", "collide-terrain", "collect-pickup", "moving-platform", "hazard-contact", "reach-goal"];
  const approximated = designMechIds.filter((id) => !intentMechIds.includes(id));
  const dropped = intentMechIds.filter((id) => !designMechIds.includes(id));
  return {
    invented, lost, wrongBucket, dropped,
    approximated,
    mechanics: designMechIds.map((id) => `${id}:${(design.mechanics ?? []).find((m) => m.id === id)?.mechanic}`),
    knownEnum: MECHANICS.length
  };
}

async function shot({ tag, intent }, i) {
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
        tools: [{ name: DESIGN_TOOL_NAME, description: DESIGN_TOOL_DESCRIPTION, input_schema: schema }],
        tool_choice: { type: "tool", name: DESIGN_TOOL_NAME },
        messages: [{ role: "user", content: [{ type: "text", text: promptFor(intent) }] }],
      }),
    });
    http = res.status;
    const t = await res.text();
    try { body = JSON.parse(t); } catch (e) { body = { __notJson: t.slice(0, 800), __err: e.message }; }
  } catch (e) {
    err = ctl.signal.aborted ? `超时（${SHOT_TIMEOUT_MS / 1000}s）` : String(e?.message ?? e);
  } finally { clearTimeout(timer); }
  const ms = Date.now() - t0;

  const parsed = err ? { ok: false, failure: "timeout", detail: err }
    : http !== 200 ? { ok: false, failure: "http", detail: `HTTP ${http}` }
    : parseToolUse(body, DESIGN_TOOL_NAME, GameDesignSpecSchema);

  const rawInput = body?.content?.find?.((b) => b.type === "tool_use" && b.name === DESIGN_TOOL_NAME)?.input ?? null;
  // 顺带跑一遍装配：R12 会不会拒（**不重采样**那档），以及三个照抄值被覆盖后的样子
  const built = parsed.ok ? buildDesign({ fromModel: parsed.value, intent, vws, profile: PLATFORMER_V1 }) : null;
  const rec = {
    label, tag, ms, http, error: err ?? null,
    servedModel: body?.model ?? null, requestedModel: MODEL,
    blockTypes: (body?.content ?? []).map((b) => b.type),
    stopReason: body?.stop_reason ?? null, usage: body?.usage ?? null,
    ok: parsed.ok, failure: parsed.ok ? null : parsed.failure, detail: parsed.ok ? null : parsed.detail,
    inspect: parsed.ok ? inspect(intent, parsed.value) : null,
    assembled: built === null ? null : (built.ok ? "ok" : built.kind === "rejected" ? `rejected:${built.rejections.map((r) => r.reason).join("+")}` : "schema(装配后)"),
    input: rawInput,
  };
  fs.writeFileSync(path.join(HERE, "raw", `${label}.json`), JSON.stringify(rec, null, 2));
  return rec;
}

console.log(`票 10 探针 —— ${ASSERTED.length} 发（base=${BASE}）`);
console.log(`模型面向的 schema = 契约本身：${Object.keys(GameDesignSpecSchema.shape).length} 键 · ${Buffer.byteLength(JSON.stringify(schema))} B · 说明 ${DESIGN_TOOL_DESCRIPTION.length} 字符`);
console.log(`提示词 ${promptFor(baseIntent).length} 字符 · 重采样地板 ${STRUCTURED_CALL_ATTEMPTS} · max_tokens=${MAX_TOKENS}`);
console.log(`输入：真跑出来过的 VWS（08 探针 raw/01）· 意图 normal×2 / hostile×2（hostile 多一条「二段跳」）\n`);

const rows = [];
for (let i = 0; i < ASSERTED.length; i++) {
  const r = await shot(ASSERTED[i], i + 1);
  rows.push(r);
  const x = r.inspect;
  console.log(`  ${r.label.padEnd(12)}: HTTP ${r.http ?? "—"} · ${r.ms}ms · served=${r.servedModel ?? "?"} · out_tok=${r.usage?.output_tokens ?? "?"} · ` +
    (r.ok ? "✅ 过 Zod" : `❌ ${r.failure}`) + (r.assembled ? ` · 装配=${r.assembled}` : ""));
  if (!r.ok) console.log(`      病因：${String(r.detail).slice(0, 240)}`);
  else console.log(`      实体：发明(${x.invented.join(",") || "无"}) 丢失(${x.lost.join(",") || "无"}) 串桶(${x.wrongBucket.join(",") || "无"}) · 机制：${x.mechanics.join(" ")} · 近似(${x.approximated.join(",") || "无"}) 丢掉(${x.dropped.join(",") || "无"})`);
}

const okN = rows.filter((r) => r.ok).length;
console.log("\n── 汇总 ──────────────────────────────────────────────");
console.log(`① 首发过 Zod：**${okN}/${rows.length}**（${(100 * okN / rows.length).toFixed(0)}%）`);
const byFail = {}; for (const r of rows) if (!r.ok) byFail[r.failure] = (byFail[r.failure] ?? 0) + 1;
console.log(`   失败分布：${Object.entries(byFail).map(([k, n]) => `${k}×${n}`).join(" · ") || "（无失败）"}`);
const oks = rows.filter((r) => r.ok);
if (oks.length) {
  console.log(`② **id 延续**：发明 ${oks.filter((r) => r.inspect.invented.length).length}/${oks.length} 发 · 丢失 ${oks.filter((r) => r.inspect.lost.length).length}/${oks.length} 发 · 串桶 ${oks.filter((r) => r.inspect.wrongBucket.length).length}/${oks.length} 发`);
  console.log(`③ **R12 的拒绝会不会响**：${rows.map((r) => `${r.tag}=${r.assembled ?? "—"}`).join(" · ")}`);
  const hostile = oks.filter((r) => r.tag === "hostile");
  if (hostile.length) console.log(`④ hostile 臂（「二段跳」）：**整条省掉** ${hostile.filter((r) => r.inspect.dropped.includes("m-double-jump")).length}/${hostile.length} 发 · **换个近似值顶上去** ${hostile.filter((r) => r.inspect.mechanics.some((s) => s.startsWith("m-double-jump"))).length}/${hostile.length} 发`);
}
console.log(`\n⚠️ 3 次地板下估计成功率：` +
  (okN === 0 ? "全败 ⇒ 地板撑不住" : `${(100 * (1 - Math.pow(1 - okN / rows.length, STRUCTURED_CALL_ATTEMPTS))).toFixed(1)}%（按首发 ${(100 * okN / rows.length).toFixed(0)}% 独立重抽算）`));
console.log(`raw/ 落 ${rows.length} 份（含模型输出与用量，无凭据）`);
