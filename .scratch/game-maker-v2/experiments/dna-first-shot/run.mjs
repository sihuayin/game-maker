// 票 31 的探针：**出货的那一套**（真提示词 + 真工具说明 + 真契约），4 发真实请求。
//
// ⚠️ **与 08/09/10 的探针同一条纪律**：量的是**出货的表面**，不是「最小说明」——
//   因为本票要量的四件事里有两件**只存在于提示词与装配步**：① 模型会不会老实给非人形写 `"none"`；
//   ② 它会不会把 `VWS.character` 整句抄进某个角色的 DNA（也就是那个**守门人**响不响）。
//
// 两臂各 2 发（n=4，与前三票同一档 —— ⚠️ 这个 n **不构成因果**，只够看出「会不会」）：
//   · normal   —— 票 10 探针**真跑出来过的**那份设计（`p-scavenger` + `e-mutant` 两个角色）
//   · robotic  —— 同一份 + **一条明确写着的非人形敌人**（`e-drone`：悬停的旧警用无人机）
//     ⚠️ 这一条**是人为加的**，为的是把「非人形它怎么写」这件事**量出来**（原设计里两个角色都偏人形）。
//     ⚠️ 所以 robotic 臂的设计**不是**原样的产物 —— 报告里要这么说，别无心地当成「真跑出来的」。
//
// 输入都是**现成的真东西**：设计取票 10 探针第 1 发的入参、世界取票 08 探针第 1 发的入参
// （那份 VWS 的 `character` 五格是填满的 —— 守门人因此**有得比**）。
//
// 跑法：node .scratch/game-maker-v2/experiments/dna-first-shot/run.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const CONTRACTS = path.join(ROOT, "packages/contracts");

const { CharacterDNAFileSchema, GameDesignSpecSchema, VisualWorldSpecSchema, toolInputSchema, parseToolUse, STRUCTURED_CALL_ATTEMPTS } =
  await import(pathToFileURL(path.join(CONTRACTS, "dist/index.js")).href);
const { characterDnaPrompt, CHARACTER_DNA_TOOL_NAME, CHARACTER_DNA_TOOL_DESCRIPTION, buildCharacterDna, characterEntities, COPY_GUARD_PAIRS } =
  await import(pathToFileURL(path.join(ROOT, "packages/game-design/dist/index.js")).href);

const BASE = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY ?? "";
if (!BASE || !KEY) throw new Error("凭据没配：ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN");
const MODEL = "deepseek-v4-pro";
const MAX_TOKENS = 16_000;
const SHOT_TIMEOUT_MS = 180_000;

const readRaw = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

// ── 输入：两份真产物 ─────────────────────────────────────────────────────────
const rawDesign = readRaw(".scratch/game-maker-v2/experiments/design-first-shot/raw/01-normal.json").input;
const rawVws = readRaw(".scratch/game-maker-v2/experiments/vws-first-shot/raw/01-first-shot.json").input;
const VWS = VisualWorldSpecSchema.parse({
  ...rawVws,
  styleReferences: (rawVws.styleReferences ?? []).length > 0 ? rawVws.styleReferences : [{ path: "fixtures/reference/halt-dusk.png", role: "global" }]
});
const DESIGN = GameDesignSpecSchema.parse(rawDesign);

/** ⚠️ **人为加的**一条非人形敌人（见文件头）—— 只加这一条，别的字段一个字不动。 */
const DRONE = { id: "e-drone", behavior: "沿铁轨慢速巡航，扫到人就悬停并闪红灯", threat: "被发现后召唤同伴，接触即伤" };
const DESIGN_ROBOTIC = GameDesignSpecSchema.parse({ ...DESIGN, enemies: [...DESIGN.enemies, DRONE] });

/** 谁是**非人形**（按各自臂的声明，用于量那一格）—— 不是按模型的判断。 */
const NONHUMANOID = { normal: ["e-mutant"], robotic: ["e-drone"] };

const ARMS = [
  { tag: "normal", design: DESIGN, nonhumanoid: NONHUMANOID.normal },
  { tag: "normal", design: DESIGN, nonhumanoid: NONHUMANOID.normal },
  { tag: "robotic", design: DESIGN_ROBOTIC, nonhumanoid: NONHUMANOID.robotic },
  { tag: "robotic", design: DESIGN_ROBOTIC, nonhumanoid: NONHUMANOID.robotic }
];

const schema = toolInputSchema(CharacterDNAFileSchema);

/** 四件事：① 过的了过不了契约 ② 非人形怎么写 ③ 有没有整句抄 ④ 一族多少 token。 */
function inspect(design, file, nonhumanoid) {
  const want = characterEntities(design).map((e) => e.id);
  const have = file.characters.map((c) => c.id);
  const omitted = file.characters.map((c) => ({
    id: c.id,
    missingKeys: ["id", "identity", "silhouette", "face", "clothing", "gear", "palette", "visualConstraints"].filter((k) => !(k in c)),
    blank: ["identity", "silhouette", "face", "clothing"].filter((k) => typeof c[k] === "string" && c[k].trim() === ""),
    gearBlank: (c.gear ?? []).filter((x) => typeof x === "string" && x.trim() === "").length
  })).filter((x) => x.missingKeys.length > 0 || x.blank.length > 0 || x.gearBlank > 0);

  const nonHuman = file.characters.filter((c) => nonhumanoid.includes(c.id))
    .map((c) => ({ id: c.id, face: c.face, clothing: c.clothing, gear: c.gear, visualConstraints: c.visualConstraints }));

  const copies = [];
  for (const c of file.characters)
    for (const pair of COPY_GUARD_PAIRS) {
      const fromWorld = VWS.character?.[pair.vws];
      if (typeof fromWorld !== "string" || fromWorld.trim() === "") continue;
      if (typeof c[pair.dna] === "string" && c[pair.dna].trim() === fromWorld.trim())
        copies.push(`${c.id}.${pair.dna} == vws.character.${pair.vws}`);
    }

  return {
    want, have,
    missing: want.filter((x) => !have.includes(x)),
    extra: have.filter((x) => !want.includes(x)),
    nonHuman, omitted, copies,
    chars: file.characters.length
  };
}

async function shot({ tag, design, nonhumanoid }, i) {
  const label = `${String(i).padStart(2, "0")}-${tag}`;
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), SHOT_TIMEOUT_MS);
  let body = null, http = null, err = null;
  const text = characterDnaPrompt({ design, vws: VWS });
  try {
    const res = await fetch(`${BASE}/v1/messages`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL, max_tokens: MAX_TOKENS, thinking: { type: "disabled" },
        tools: [{ name: CHARACTER_DNA_TOOL_NAME, description: CHARACTER_DNA_TOOL_DESCRIPTION, input_schema: schema }],
        tool_choice: { type: "tool", name: CHARACTER_DNA_TOOL_NAME },
        messages: [{ role: "user", content: [{ type: "text", text }] }]
      })
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
    : parseToolUse(body, CHARACTER_DNA_TOOL_NAME, CharacterDNAFileSchema);

  const rawInput = body?.content?.find?.((b) => b.type === "tool_use" && b.name === CHARACTER_DNA_TOOL_NAME)?.input ?? null;
  const built = parsed.ok ? buildCharacterDna({ fromModel: parsed.value, design, vws: VWS }) : null;
  const rec = {
    label, tag, ms, http, error: err ?? null,
    servedModel: body?.model ?? null, requestedModel: MODEL,
    blockTypes: (body?.content ?? []).map((b) => b.type),
    stopReason: body?.stop_reason ?? null, usage: body?.usage ?? null,
    ok: parsed.ok, failure: parsed.ok ? null : parsed.failure, detail: parsed.ok ? null : parsed.detail,
    inspect: parsed.ok ? inspect(design, parsed.value, nonhumanoid) : null,
    assembled: built === null ? null : (built.ok ? "ok" : "schema(装配后)"),
    assembledDetail: built === null || built.ok ? null : built.detail,
    input: rawInput
  };
  fs.writeFileSync(path.join(HERE, "raw", `${label}.json`), JSON.stringify(rec, null, 2));
  return rec;
}

console.log(`票 31 探针 —— ${ARMS.length} 发（base=${BASE}）`);
console.log(`模型面向的 schema = 契约本身：${Object.keys(CharacterDNAFileSchema.shape).length} 键 · ` +
  `${Buffer.byteLength(JSON.stringify(schema))} B · 说明 ${CHARACTER_DNA_TOOL_DESCRIPTION.length} 字符`);
console.log(`提示词 ${characterDnaPrompt({ design: DESIGN, vws: VWS }).length} 字符 · 重采样地板 ${STRUCTURED_CALL_ATTEMPTS} · max_tokens=${MAX_TOKENS}`);
console.log(`输入：真跑的产物（设计=票 10 raw/01 的入参 · 世界=票 08 raw/01 的入参）· normal×2 / robotic×2（robotic 多一条**人为加的**非人形敌人）`);
console.log(`这一族的角色：${characterEntities(DESIGN).map((e) => e.id).join(" / ")}（robotic 臂再多一个 e-drone）\n`);

const rows = [];
for (let i = 0; i < ARMS.length; i++) {
  const r = await shot(ARMS[i], i + 1);
  rows.push(r);
  const x = r.inspect;
  console.log(`  ${r.label.padEnd(12)}: HTTP ${r.http ?? "—"} · ${r.ms}ms · served=${r.servedModel ?? "?"} · out_tok=${r.usage?.output_tokens ?? "?"} · ` +
    (r.ok ? "✅ 过 Zod" : `❌ ${r.failure}`) + (r.assembled ? ` · 装配=${r.assembled}` : ""));
  if (!r.ok) console.log(`      病因：${String(r.detail).slice(0, 240)}`);
  else console.log(`      ${x.chars} 条 · 少(${x.missing.join(",") || "无"}) 多(${x.extra.join(",") || "无"}) · 省略键(${x.omitted.length ? JSON.stringify(x.omitted) : "无"}) · 整句抄(${x.copies.join(",") || "无"})`);
  if (r.assembledDetail) console.log(`      ⚠️ 装配步的病因：${String(r.assembledDetail).slice(0, 200)}`);
  for (const n of x?.nonHuman ?? []) console.log(`      非人形 \`${n.id}\`：face=${JSON.stringify(n.face)} clothing=${JSON.stringify(n.clothing)} gear=${JSON.stringify(n.gear)}`);
}

const okN = rows.filter((r) => r.ok).length;
console.log("\n── 汇总 ──────────────────────────────────────────────");
console.log(`① 首发过 Zod：**${okN}/${rows.length}**（${(100 * okN / rows.length).toFixed(0)}%）`);
const byFail = {}; for (const r of rows) if (!r.ok) byFail[r.failure] = (byFail[r.failure] ?? 0) + 1;
console.log(`   失败分布：${Object.entries(byFail).map(([k, n]) => `${k}×${n}`).join(" · ") || "（无失败）"}`);
const oks = rows.filter((r) => r.ok);
if (oks.length) {
  console.log(`② **非人形**：${oks.flatMap((r) => (r.inspect.nonHuman ?? []).map((n) => `${n.id}: face=${JSON.stringify(n.face)}/clothing=${JSON.stringify(n.clothing)}/gear=${JSON.stringify(n.gear)}`)).join(" · ") || "（这一臂没有非人形）"}`);
  console.log(`③ **整句抄了世界那五格**：${oks.filter((r) => r.inspect.copies.length > 0).length}/${oks.length} 发` +
    `（命中：${oks.flatMap((r) => r.inspect.copies).join(",") || "无"}）—— ⚠️ 守门人挡的就是这一档`);
  console.log(`③' **省略键 / 空串**：${oks.filter((r) => r.inspect.omitted.length > 0).length}/${oks.length} 发` +
    `（${oks.flatMap((r) => r.inspect.omitted.map((o) => `${o.id}:${o.missingKeys.join("+") || o.blank.join("+") || "空串"}`)).join(",") || "无"}）`);
  console.log(`   **装配步的结论**：${rows.map((r) => `${r.tag}=${r.assembled ?? "—"}`).join(" · ")}`);
  const toks = oks.map((r) => r.usage?.output_tokens ?? 0);
  const perChar = oks.map((r) => `${((r.usage?.output_tokens ?? 0) / Math.max(1, r.inspect.chars)).toFixed(0)}/角色`);
  console.log(`④ **一族一次的输出 token**：${toks.join(" / ")} · 角色数 ${oks.map((r) => r.inspect.chars).join(" / ")} · ` +
    `单角色 ${perChar.join(" / ")} ⇒ 这是 max_tokens 那条「截断要算」的答案（上限 ${MAX_TOKENS}）`);
}
console.log(`\n⚠️ 3 次地板下估计成功率：` +
  (okN === 0 ? "全败 ⇒ 地板撑不住" : `${(100 * (1 - Math.pow(1 - okN / rows.length, STRUCTURED_CALL_ATTEMPTS))).toFixed(1)}%（按首发 ${(100 * okN / rows.length).toFixed(0)}% 独立重抽算）`));
console.log(`raw/ 落 ${rows.length} 份（含模型输出与用量，无凭据）`);
