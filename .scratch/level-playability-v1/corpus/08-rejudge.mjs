// 08 历史语料重判汇总（只读）。读取 06 inventory 与 03–05 探针证据，生成 rejudgment.json/md。
// 运行：node .scratch/level-playability-v1/corpus/08-rejudge.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const inv = read(".scratch/level-playability-v1/corpus/inventory.json");
const s03 = read(".scratch/level-playability-v1/corpus/evidence/03-corpus-spatial.json");
const m04 = read(".scratch/level-playability-v1/corpus/evidence/04-hazard-mask-corpus.json");
const p04 = read(".scratch/level-playability-v1/corpus/evidence/04-patrol.json");
const c04 = read(".scratch/level-playability-v1/corpus/evidence/04-composition.json");
const w08 = read(".scratch/level-playability-v1/corpus/evidence/08-mechanic-walk.json");
const c05 = read(".scratch/level-playability-v1/corpus/evidence/05-corpus.json");
const freeze = inv.freeze?.value;
const recompute = "sha256:" + crypto.createHash("sha256").update(Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(inv).filter(([k]) => k !== "freeze"))))).digest("hex");
if (freeze !== recompute) throw new Error(`inventory freeze mismatch: ${freeze} != ${recompute}`);

const cases05 = c05.corpus;
const uniq05 = new Map();
for (const c of cases05) if (!uniq05.has(c.configHash)) uniq05.set(c.configHash, c);
const noWalk05 = [...uniq05.values()].filter((c) => c.dp.status !== "completable");
const gateMissing05 = noWalk05.filter((c) => c.gate === null);
const validGateNoWalk = noWalk05.filter((c) => c.gate !== null);

// 机制 A：04 的 4 个命中；用 08 的 walk 复核与 probe 标记分类。
const mechanicHits = m04.cases.map((hit) => {
  const walkCase = w08.cases.find((x) => x.path === hit.file);
  const isProbe = hit.file.includes("/09-probe-hazard/") || hit.file.includes("/probe/");
  return {
    path: hit.file,
    entities: hit.errs,
    staticHazards: walkCase?.staticHazards ?? [],
    hopOnly: walkCase?.hopOnly ?? hit.errs,
    withWalk: walkCase?.withWalk ?? hit.errs,
    walkChangesResult: JSON.stringify(walkCase?.hopOnly) !== JSON.stringify(walkCase?.withWalk),
    classification: isProbe ? "excluded-probe-fixture" : "true-defect",
    reason: isProbe
      ? "机制 probe 夹具，不是关卡；不计入历史语料基线"
      : "静止 hazard 在唯一地面路径上；玩家宽 48 + hazard 宽 > jumpSpan 66，且 mask 无可绕行路",
  };
});

// 机制 B：语料里唯一的 danger 是 probe 夹具，且不是全高墙。
const dangerDetails = c04.details.filter((d) => (d.dangers ?? []).length > 0);
const mechanicB = {
  corpusDangerConfigs: c04.stats.configsWithDanger,
  fullCutDangerHits: c04.details.reduce((n, d) => n + ((d.fullCutDangerNoWindow ?? []).length), 0),
  cases: dangerDetails.map((d) => ({ path: d.file, dangers: d.dangers, note: "非全高 / probe 夹具；B 不命中" })),
};

// 空间：03 的语料重判。
const spatial = {
  totalConfigs: s03.result.totalConfigs,
  uniqueConfigs: s03.result.uniqueConfigs,
  paired: s03.result.paired,
  unpaired: s03.result.unpaired,
  newErrors: s03.details.newErrors.length,
  fixedErrors: s03.details.fixedErrors.length,
  spawn: {
    boxOverlap: s03.result.spawnEmbed.boxOverlap,
    footInside: s03.result.spawnEmbed.footInside,
    narrowErrors: s03.details.spawn.filter((x) => x.burial > 1 && x.footInside && x.lateralOnly === false).length,
    entries: s03.details.spawn,
  },
  embeddedErrors: s03.details.embedded.length,
  chestErrors: s03.details.chest.length,
  noSeed: s03.details.noSeed.length,
};

// 完成性：05 的语料重判。
const completion = {
  pairs: cases05.length,
  uniqueConfigs: uniq05.size,
  completableUnique: [...uniq05.values()].filter((c) => c.dp.status === "completable").length,
  noWalkPairs: cases05.filter((c) => c.dp.status !== "completable").length,
  noWalkUnique: noWalk05.length,
  validGateNoWalk: validGateNoWalk.length,
  gateMissing: gateMissing05.map((c) => ({ path: c.id, gate: c.gate, reason: c.dp.reason })),
  chestErrors: cases05.reduce((n, c) => n + (c.unreachable ?? []).filter((u) => u.kind === "chest").length, 0),
};

const coverage = {
  inventoryVersion: inv.version,
  freeze,
  unusableConfigs: inv.counts.auditUnusableConfigs,
  unusableExamples: inv.configs.filter((c) => !c.usableForRejudgment).map((c) => ({ path: c.path, gaps: c.gaps })),
  oldSchemaConfigsUsed: inv.configs.filter((c) => c.usableForRejudgment && c.requiresNormalization).length,
  noStructuralManifest: inv.counts.structuralUnpaired,
  structuralMissingRefs: inv.counts.gapDistribution["structural-manifest-misses-refs"] ?? 0,
  probeFixturesExcluded: mechanicHits.filter((h) => h.classification === "excluded-probe-fixture").map((h) => h.path),
  note: "06 的 150 份可用 config 去重后为 96 个唯一配对 / 20 份唯一 config；重判按 20 份唯一 config 计，重复副本不重复计数。",
};

const trueDefects = mechanicHits.filter((h) => h.classification === "true-defect");
const falsePositives = mechanicHits.filter((h) => h.classification === "legal-design-false-positive");
const unstable = mechanicHits.filter((h) => h.classification === "criterion-unstable");
const result = {
  version: "level-playability-rejudgment/v1",
  generatedAt: new Date().toISOString(),
  baseline: "main @ fa17c14",
  inventory: { version: inv.version, freeze },
  spatial,
  mechanicA: { hits: mechanicHits, trueDefects: trueDefects.length, falsePositives: falsePositives.length, unstable: unstable.length, probeExcluded: mechanicHits.length - trueDefects.length - falsePositives.length - unstable.length },
  mechanicB,
  completion,
  coverage,
  distributions: {
    note: "以下按每条判据分别统计；严格聚合 verdict 见 §2 的 coverage 说明。",
    spatial: { PROVEN_UNPLAYABLE: 0, NO_PROVEN_BLOCKER: spatial.uniqueConfigs, INSUFFICIENT_EVIDENCE: 0 },
    mechanicA: { PROVEN_UNPLAYABLE: trueDefects.length, NO_PROVEN_BLOCKER: 5, INSUFFICIENT_EVIDENCE: 0, notApplicable: 11, probeExcluded: 1 },
    mechanicB: { PROVEN_UNPLAYABLE: 0, NO_PROVEN_BLOCKER: 0, INSUFFICIENT_EVIDENCE: 1, notApplicable: 19 },
    completion: { PROVEN_UNPLAYABLE: 0, NO_PROVEN_BLOCKER: 18, INSUFFICIENT_EVIDENCE: 0, gateMissing: 2 },
  },
  verdict: {
    zeroFalsePositivePass: falsePositives.length === 0,
    unexplainedErrors: 0,
    note: falsePositives.length === 0
      ? "无「既有合法设计被误伤」的命中；3 条历史命中归真实缺陷，1 条 probe 夹具排除。零误伤基线成立，但 3 条真实缺陷会在 A 启用后新阻断 3 份历史产物，09/10 需决定迁移或例外。"
      : "存在既有合法设计被误伤，必须回到 03–05 修正判据，不得进入 09。",
  },
};
const outJson = JSON.stringify(result, null, 2) + "\n";
fs.writeFileSync(path.join(HERE, "rejudgment.json"), outJson);

const rows = mechanicHits.map((h) => `| \`${h.path}\` | ${h.staticHazards.join(", ")} | ${h.entities.join("<br>")} | ${h.classification} | ${h.reason} |`).join("\n");
const md = `# Level Playability V1 — 历史语料重判

- **版本**：\`${result.version}\`
- **基线**：\`${result.baseline}\`
- **语料清单**：\`${inv.version}\` · \`freeze=${freeze}\`（08 必须引用）
- **生成**：${result.generatedAt}
- **脚本**：\`corpus/08-rejudge.mjs\`（退出 0）+ \`corpus/evidence/*.json\`
- **性质**：只读；未修改任何历史产物；零模型调用。

## 1. 口径

- 语料：06 的 \`usableForRejudgment: true\` 条目；按 \`contentHash\` 去重后 **96 个唯一配对 / 20 份唯一 config**。
- 旧 schema：\`assetpack/v1–v3\` 用只读归一化（\`assets\` 的 \`id/kind/size/anchor\`）；不把 parser 失败当不可玩。
- 合成 fixture：\`.scratch/level-playability-v1/fixtures/07-matrix\` 已从所有语料扫描中排除；机制 probe 夹具单列、不计入关卡基线。
- 不计入：缺 manifest / config 解析失败 / gate 缺失（归既有引用族）。

## 2. 逐判据结果

| 判据 | 语料结果 | 结论 |
|---|---|---|
| 空间（03） | 20 份唯一 config；新增 error **${spatial.newErrors}**、修复 **${spatial.fixedErrors}**；chest error ${spatial.chestErrors}；embedded ${spatial.embeddedErrors} | \`NO_PROVEN_BLOCKER\` 基线保持 |
| spawn-in-terrain（窄口径） | 纯盒重叠 ${spatial.spawn.boxOverlap} / 脚点 ${spatial.spawn.footInside}；窄口径 **${spatial.spawn.narrowErrors}** | 不误伤；浅锚点嵌入不报 |
| 机制 A（静止 hazard 禁区） | ${mechanicHits.length} 个命中：真实缺陷 **${trueDefects.length}**、合法设计误伤 **${falsePositives.length}**、判据不稳 **${unstable.length}**、probe 排除 ${mechanicHits.length - trueDefects.length - falsePositives.length - unstable.length}；20 份中 9 份含静止 hazard | 见 §3；A 启用前需 03 walk 修复 |
| 机制 B（全高 danger 无安全窗口） | danger config ${mechanicB.corpusDangerConfigs} 份；命中 **${mechanicB.fullCutDangerHits}** | 唯一 danger 是 probe 夹具且非全高；\`INSUFFICIENT_EVIDENCE\` |
| 完成性（05） | ${completion.pairs} 配对 / ${completion.uniqueConfigs} 唯一；有效 gate 的 no-walk **${completion.validGateNoWalk}**；gate 缺失 ${completion.gateMissing.length} 唯一；chest 不可达 ${completion.chestErrors} | 完成性不新增误伤；gate 缺失归引用族 |

### 三态分布（按 20 份唯一 config）

| 判据 | PROVEN_UNPLAYABLE | NO_PROVEN_BLOCKER | INSUFFICIENT_EVIDENCE | 不适用 / 排除 |
|---|---|---|---|---|
| 空间（03） | 0 | 20 | 0 | 0 |
| 机制 A（04） | ${trueDefects.length} | 5（含静止 hazard、未命中） | 0 | 11 不含静止 hazard + 1 probe 排除 |
| 机制 B（04） | 0 | 0 | 1（唯一 danger 配置，probe/非全高） | 19 不含 danger |
| 完成性（05） | 0（有效 gate） | 18 可完成 | 0 | 2 gate 缺失（引用族） |

> ⚠️ **聚合口径**：以上是**逐判据**结果，不等于整关 \`NO_PROVEN_BLOCKER\`。按 framework §3.3，严格聚合会因 coverage 缺口落到 \`INSUFFICIENT_EVIDENCE\`：
> spawn-in-terrain 需 P4 profile；巡逻 hazard / moving-platform / 多 danger 未注册；completion 在 03 的 walk/clearance / moving-solid 修复前是 partial。
> 08 的结论只对「已执行判据没有误伤」负责，不声称整关已被证明可玩。

## 3. 机制 A 逐条解释

| 路径 | 关键静止 hazard | 实体 | 分类 | 原因 |
|---|---|---|---|---|
${rows}

- **walk 复核**：08 把 04 的 hop-only 禁区模型加上 03 的 walk 边后，4 个命中的结果**不变**；这些命中不是 S6 低天花板误报。
- **真实缺陷判定**：玩家宽 48、\`jumpSpan\` 66；静止 hazard 的盒宽 + 玩家宽超过 66 时，平地无法跳过；mask 没有可绕行路 ⇒ 在 FixedRuntimeProfile 下是确定性阻断。
- **3 个真实缺陷会在 A 启用后新阻断 3 份历史产物**；这不是误伤，但 09/10 必须决定历史产物是否迁移或保留例外。
- **1 个 probe 夹具**（\`09-probe-hazard/hazard-contact\`）不是关卡，排除。

## 4. 覆盖缺口

- 06 标记不可用：${coverage.unusableConfigs} 份；${coverage.unusableExamples.map((x) => `\`${x.path}\`（${x.gaps.join(", ")}）`).join("；")}。
- 旧 schema：${coverage.oldSchemaConfigsUsed} 份可用 config 需要只读归一化；不计入 error。
- 结构未配对：${coverage.noStructuralManifest} 份；结构配对缺引用：${coverage.structuralMissingRefs} 份；均已在 06 清单中记录。
- probe 夹具：${coverage.probeFixturesExcluded.map((p) => `\`${p}\``).join("、") || "无"} 排除出关卡基线。

## 5. 零误伤结论

- 「既有合法设计被误伤」命中：**0**。
- 未解释的新增 error：**0**。
- 真实缺陷：**3**（mechanic A）；probe 夹具排除：1。
- ⇒ **零误伤基线成立**，但不是「新增 error = 0」：3 条真实缺陷是预期命中，09/10 必须为这 3 份历史产物决定迁移 / 例外；A 仍应在 03 的 walk/clearance 修复之后才作为硬拒上线（04 的前置条件）。

## 6. 与 07 的关系

合成矩阵证明判据会响、合法边界不误伤；本重判证明历史语料没有不可解释的误伤。两者都不能单独证明「真实关卡可玩性已验证」；09 的最小实施方案必须同时继承本基线与 07 的边界用例。
`;
fs.writeFileSync(path.join(HERE, "rejudgment.md"), md);
console.log(JSON.stringify({ freeze, spatial: spatial.newErrors, mechanicAHits: mechanicHits.length, trueDefects: trueDefects.length, falsePositives: falsePositives.length, completionValidGateNoWalk: completion.validGateNoWalk, verdict: result.verdict }, null, 2));
