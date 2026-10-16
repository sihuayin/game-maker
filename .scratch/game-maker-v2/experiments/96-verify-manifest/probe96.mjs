// 票 96 探针 —— **只读 · 零付费 · 零网络 · 不写任何产物**。
//
// 量一件事：**「给 verify 一个清单入参」这句话，落到盘上今天已有的包上，会报什么。**
//
// 用的正是 `verify --recipe` 若落地就要跑的那一段（`qa/src/visual.ts:104-124` 的同款循环）：
//   逐条 recipe 资产 → 在包里找同 id 的 entry → 找不到就报「包里没有」→ 找得到就 `auditAssetSpec`。
// ⚠️ 这里**不重写判据**：直接调出货的 `dist` 里的 `auditAssetSpec` / `parseRecipe` / `parseAssetPack`。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../../../..");
const C = await import(pathToFileURL(path.resolve(ROOT, "packages/contracts/dist/index.js")).href);
const A = await import(pathToFileURL(path.resolve(ROOT, "packages/assets/dist/index.js")).href);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const say = (...a) => console.log(...a);
const rule = (t) => say(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`);

const PAIRS = [
  ["fixtures/packs/last-train/v2", "fixtures/recipes/last-train.json"],
  ["fixtures/packs/counter-siege/v4", "fixtures/recipes/counter-siege.json"],
  ["fixtures/packs/counter-siege/v4", "fixtures/recipes/counter-siege-derived.json"],
];

// ── ① verify 今天对这几个包说什么（**不加清单**）────────────────────────────
rule("① `verifyPack({packDir})` 今天说什么 —— 三个包，零清单");
for (const [packRel] of PAIRS.slice(0, 2)) {
  const packDir = path.resolve(ROOT, packRel);
  try {
    const r = A.verifyPack({ packDir });
    say(`  ${packRel} ⇒ ok=${r.data.ok}`);
  } catch (e) { say(`  ${packRel} ⇒ 抛：${e.message}`); }
}

// ── ② 加清单之后会说什么（**这就是 `verify --recipe` 的报文**）──────────────
for (const [packRel, recipeRel] of PAIRS) {
  rule(`② 清单 ${recipeRel} ＋ 包 ${packRel}`);
  const recipe = C.parseRecipe(readJson(path.resolve(ROOT, recipeRel)));
  if (!recipe.ok) { say("  清单不过契约：", recipe.errors.slice(0, 3)); continue; }
  const pack = C.parseAssetPack(readJson(path.resolve(ROOT, packRel, "manifest.json")));
  if (!pack.ok) { say("  包不过契约：", pack.errors.slice(0, 3)); continue; }
  const m = pack.value;

  const missing = [], findings = [];
  for (const { spec } of recipe.value.assets) {
    const entry = m.assets.find((a) => a.id === spec.id);
    if (entry === undefined) { missing.push(spec.id); continue; }
    for (const msg of C.auditAssetSpec(spec, entry, [])) findings.push(msg);
  }
  const ids = new Set(recipe.value.assets.map((s) => s.spec.id));
  const extra = m.assets.filter((a) => !ids.has(a.id)).map((a) => a.id);

  say(`  清单资产 ${recipe.value.assets.length} · 包里资产 ${m.assets.length}`);
  say(`  逐条对账的读数：**缺 ${missing.length}** · **不符 ${findings.length}** · 包里多出 ${extra.length}`);
  if (missing.length) say(`    · 缺（前 6）：${missing.slice(0, 6).join(" · ")}`);
  for (const f of findings.slice(0, 6)) say(`    · ${f}`);
  if (extra.length) say(`    ⚠️ 反向：包里多出而清单里没有的（**这一族今天没有任何判据看得见**）：${extra.slice(0, 6).join(" · ")}${extra.length > 6 ? " …" : ""}`);
}

// ── ③ 包自己记不记得「我是哪份清单做出来的」────────────────────────────────
rule("③ 包里有指回清单的指针吗（决定清单能不能自动找）");
for (const [packRel] of PAIRS.slice(0, 2)) {
  const m = readJson(path.resolve(ROOT, packRel, "manifest.json"));
  say(`  ${packRel}: generator=${JSON.stringify(m.generator)}`);
  say(`    provenance=${JSON.stringify(m.provenance)} · 顶层键=${Object.keys(m).join(",")}`);
}
say("  ⇒ 「清单从哪来」要由**调用方给**；包里没有可自动发现的路。");
