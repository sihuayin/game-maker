// 票 34 的定向盘点：**还有哪些「单数名的数组字段」**，以及「模型实际吐的是什么」。
//
// 人类给的规矩：**只有有实验证据才改**。所以这份脚本分两步：
//   ① **从契约里**扫出候选 —— 顶层属性、类型是 array、而**键名不是复数**的；
//      （硬编码一张名单必然漏；从 schema 现扫，契约改了它跟着改）
//   ② **拿仓库里已有的真输出**对每个候选数类型分布 —— 那些 `experiments/*/raw/` 是
//      历次探针落下的**真往返**，不是复刻。零新调用、零花钱。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/singular-array-inventory.mjs
import fs from "node:fs";
import path from "node:path";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const C = await import(path.join(ROOT, "packages/contracts/dist/index.js"));
// ⚠️ 本脚本住在 `.scratch/`，在 pnpm workspace **之外** ⇒ `import "zod/v4"` 解析不了。
//    按 `packages/contracts` 的视角解析，拿到的就是出厂代码在用的同一个 zod。
const { createRequire } = await import("node:module");
const req = createRequire(path.join(ROOT, "packages/contracts/src/x.js"));
const { toJSONSchema } = await import(req.resolve("zod/v4"));

const PLURALISH = /s$|^(.*)(List|Items|Steps|Conditions|Goals|Rules|Options|Buckets|Entries)$/;

/** 递归走一遍 JSON Schema，收「类型是 array、键名不是复数」的属性 —— **嵌套的也要**。
 *  （票 34 点名的 `shapeLanguage` / `material` 那一簇就藏在 `VisualWorldSpec` 的子对象里。） */
function candidates(schema, where) {
  let js;
  // ⚠️ 别吞异常：上一版 `catch { return [] }` 把「根本转化不了」伪装成了「一个候选都没有」。
  try { js = toJSONSchema(schema); } catch (e) {
    console.log(`   ⚠️ ${where} 转不成 JSON Schema：${e?.message}`);
    return [];
  }
  const out = [];
  const seen = new Set();
  const walk = (node, prefix) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    for (const [key, def] of Object.entries(node.properties ?? {})) {
      if (!def || typeof def !== "object") continue;
      const at = prefix ? `${prefix}.${key}` : key;
      if (def.type === "array" && !PLURALISH.test(key)) out.push({ where, key, 路径: at });
      if (def.type === "object") walk(def, at);
    }
  };
  walk(js, "");
  return out;
}

// ⚠️ 名字猜错就**当场说**，别像上一版那样悄悄跳过（那会让盘点看起来「只有 5 个」）。
const SCHEMAS = {};
for (const [n, v] of Object.entries(C)) {
  if (!/Schema$/.test(n)) continue;
  if (/^(VisualWorld|CharacterDNA|CharacterDna|GameIntent|GameDesign|Asset|GameConfig|QA|Qa|Runtime|Master)/.test(n)) {
    SCHEMAS[n] = v;
  }
}
console.log(`解析到的契约 schema：${Object.keys(SCHEMAS).length} 个 —— ${Object.keys(SCHEMAS).join(" · ")}\n`);

const cands = Object.entries(SCHEMAS).flatMap(([n, s]) => (s ? candidates(s, n) : []));
console.log(`候选（数组 · 键名非复数，含嵌套）：${cands.length} 个`);
for (const c of cands) console.log(`   ${c.where}.${c.路径}`);

// ---- ② 拿已有的真输出数形状 ----
const RAWROOTS = [];
const exp = path.join(ROOT, ".scratch/game-maker-v2/experiments");
for (const d of fs.readdirSync(exp)) {
  const r = path.join(exp, d, "raw");
  if (fs.existsSync(r)) RAWROOTS.push(r);
}
// v1 那批探针也算证据（同一批契约的前身，形状习惯一脉相承）
const v1 = path.join(ROOT, ".scratch/game-creation-v1/experiments");
if (fs.existsSync(v1)) for (const d of fs.readdirSync(v1)) {
  const r = path.join(v1, d, "raw");
  if (fs.existsSync(r)) RAWROOTS.push(r);
}

/** 递归找出所有 tool_use 入参。**两种存法都要认**：
 *   ① 上游原文：`content: [{ type: "tool_use", input: {...} }]`
 *   ② 本仓库探针的存法：顶层直接放一个 `input: {...}`（见 `.scratch/…/vws-first-shot/raw/*.json`）
 *  ⚠️ 只认 ① 会让整批视觉层探针「看起来一次都没被覆盖」。 */
function* toolInputs(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const x of node) yield* toolInputs(x); return; }
  if (node.type === "tool_use" && node.input) yield node.input;
  if (node.input && typeof node.input === "object" && !Array.isArray(node.input)) yield node.input;
  for (const v of Object.values(node)) yield* toolInputs(v);
}

const files = [];
for (const root of RAWROOTS) {
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".json")) files.push(p);
    }
  };
  walk(root);
}

const tally = new Map(); // "Schema.路径" -> {array,string,object,other}
/** 顺着候选的**路径**取值 —— 只查顶层键会把嵌套的那一簇全数成「没被覆盖」（上一版就是这样）。 */
const dig = (obj, at) => at.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);

// ⚠️ **只数「这一发真的是这份契约」的那些**。少了这道闸，`VisualWorldSpec` 那发里的
//    `palette`（一个对象）会被记到 `CharacterDNA.palette`（一个数组）头上 —— 上一版就这么错了。
const FORMAT = {
  GameIntentSpecSchema: "game-intent/", GameDesignSpecSchema: "game-design/",
  VisualWorldSpecSchema: "visual-world/", CharacterDNASchema: "character-dna/",
  QAReportSchema: "qa-report/", AssetSpecSchema: "asset-spec/",
  GameConfigSchema: "game-config/", RuntimeProfileSchema: "runtime-profile/",
};
const belongsTo = (inp, where) => {
  const want = FORMAT[where];
  if (!want) return false;               // 认不出的契约：宁可不数，也不冤枉
  const got = inp?.format;
  return typeof got === "string" && got.startsWith(want);
};

for (const f of files) {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
  for (const inp of toolInputs(doc)) {
    for (const { where, 路径 } of cands) {
      if (!belongsTo(inp, where)) continue;
      const v = dig(inp, 路径);
      if (v === undefined) continue;
      const k = `${where}.${路径}`;
      const t = tally.get(k) ?? { array: 0, string: 0, object: 0, other: 0 };
      if (Array.isArray(v)) t.array += 1;
      else if (typeof v === "string") t.string += 1;
      else if (v && typeof v === "object") t.object += 1;
      else t.other += 1;
      tally.set(k, t);
    }
  }
}

console.log(`\n扫了 ${files.length} 份 raw JSON（${RAWROOTS.length} 个 raw 目录）\n`);
console.log("字段".padEnd(44), "array", "string", "object", "other");
let covered = 0, bad = 0;
for (const { where, 路径 } of cands) {
  const t = tally.get(`${where}.${路径}`);
  const shots = t ? t.array + t.string + t.object + t.other : 0;
  if (shots > 0) covered += 1;
  if (t && (t.string > 0 || t.other > 0)) bad += 1;
  console.log(
    `${where.replace(/Schema$/, "")}.${路径}`.padEnd(44),
    String(t?.array ?? 0).padStart(5), String(t?.string ?? 0).padStart(6),
    String(t?.object ?? 0).padStart(6), String(t?.other ?? 0).padStart(5),
    (t ? "" : "  ⚠️ 一次都没被真输出覆盖过"));
}
console.log(`\n${cands.length} 个候选里：有真输出覆盖的 ${covered} 个 · ` +
  `**形状出过错的 ${bad} 个** · 从没被覆盖的 ${cands.length - covered} 个`);
fs.writeFileSync(path.join(HERE, "raw", "singular-array-inventory.json"),
  JSON.stringify({ 候选: cands, 计数: Object.fromEntries(tally), 扫过的文件数: files.length }, null, 1));
