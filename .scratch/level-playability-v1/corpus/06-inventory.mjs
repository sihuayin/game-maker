// 06 历史语料清单（只读）。运行：
//   node .scratch/level-playability-v1/corpus/06-inventory.mjs
// 输出：.scratch/level-playability-v1/corpus/inventory.json + inventory.md
// 不修改任何历史产物；零模型调用。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseGameConfig, parseAssetPack } from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT_DIR = path.join(ROOT, ".scratch/level-playability-v1/corpus");
const BASELINE = "main @ fa17c14";
const DIRS = ["out", "fixtures", ".scratch", "packages/demo/fixtures"];
const SKIP = new Set(["node_modules", ".git", "dist", ".vite", "coverage"]);

const walk = (dir, out) => {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const d of ents) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { if (!SKIP.has(d.name) && p !== OUT_DIR) walk(p, out); }
    else if (d.isFile() && d.name.endsWith(".json")) out.push(p);
  }
};
const files = [];
for (const d of DIRS) walk(path.join(ROOT, d), files);

const sha256 = (buf) => "sha256:" + crypto.createHash("sha256").update(buf).digest("hex");
const contentHash = (obj) => sha256(Buffer.from(JSON.stringify(obj)));
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const sourceOf = (p) => {
  const r = rel(p);
  if (r.startsWith("out/")) return "out";
  if (r.startsWith("fixtures/")) return "fixtures";
  if (r.startsWith(".scratch/")) return "scratch";
  if (r.startsWith("packages/demo/fixtures/")) return "packages/demo/fixtures";
  return "other";
};
const sourcePriority = { out: 0, fixtures: 1, "packages/demo/fixtures": 2, scratch: 3, other: 4 };
const commonPrefix = (a, b) => {
  const aa = a.split("/"), bb = b.split("/");
  let i = 0;
  while (i < aa.length && i < bb.length && aa[i] === bb[i]) i += 1;
  return i;
};
const versionOf = (p) => {
  const m = /\/v(\d+)\/manifest\.json$/.exec(rel(p));
  return m ? Number(m[1]) : 0;
};

// ── 1. 分类读取 ──────────────────────────────────────────────────────────────
const configs = [], manifests = [], designs = [], tdConfigs = [];
let parsedJson = 0, objectJson = 0, unreadableJson = 0;
for (const f of files) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(f, "utf8")); } catch { unreadableJson += 1; continue; }
  parsedJson += 1;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
  objectJson += 1;
  const buf = fs.readFileSync(f);
  const record = { path: rel(f), abs: f, sha256: sha256(buf), contentHash: contentHash(raw), raw, source: sourceOf(f) };
  if (raw.format === "game-config/v1") configs.push(record);
  else if (String(raw.format ?? "").startsWith("td-config/")) tdConfigs.push(record);
  else if (raw.format === "game-design/v1") designs.push(record);
  else if (String(raw.format ?? "").startsWith("assetpack/") ||
           (Array.isArray(raw.assets) && raw.id !== undefined && raw.version !== undefined && raw.files !== undefined)) {
    manifests.push(record);
  }
}

// manifest 的可解析 / 只读归一化能力
for (const m of manifests) {
  const p = parseAssetPack(m.raw);
  m.parseableCurrent = p.ok;
  m.schema = String(m.raw.format ?? "(none)");
  m.assetCount = Array.isArray(m.raw.assets) ? m.raw.assets.length : 0;
  m.normalizableReadOnly = Array.isArray(m.raw.assets) &&
    m.raw.assets.some((a) => a !== null && typeof a === "object" && typeof a.id === "string");
  m.assetsMissingSize = m.normalizableReadOnly &&
    m.raw.assets.some((a) => a && typeof a === "object" && typeof a.id === "string" && !a.size);
  m.assetIds = m.normalizableReadOnly
    ? new Set(m.raw.assets.filter((a) => a && typeof a === "object" && typeof a.id === "string").map((a) => a.id))
    : new Set();
  // 与 02 相同的只读归一化形状（只用于判定覆盖，不落盘改文件）
  m.normalizedAssets = m.normalizableReadOnly
    ? m.raw.assets.filter((a) => a !== null && typeof a === "object" && typeof a.id === "string")
    : [];
}

// ── 2. 配对 ──────────────────────────────────────────────────────────────────
const manifestByAbs = new Map(manifests.map((m) => [m.abs, m]));
const manifestByRel = new Map(manifests.map((m) => [m.path, m]));

/** 从 config 目录向上找最近的 manifest（prior 134-pair 口径）。 */
function nearestManifests(configAbs) {
  let dir = path.dirname(configAbs);
  const levels = [];
  const rootAbs = path.parse(dir).root;
  while (true) {
    const hits = [];
    let vs = [];
    try { vs = fs.readdirSync(path.join(dir, "pack")); } catch {}
    for (const v of vs) {
      const mp = path.join(dir, "pack", v, "manifest.json");
      if (manifestByAbs.has(mp)) hits.push(manifestByAbs.get(mp));
    }
    for (const r of ["manifest.json", "pack/manifest.json"]) {
      const mp = path.join(dir, r);
      if (manifestByAbs.has(mp)) hits.push(manifestByAbs.get(mp));
    }
    if (hits.length > 0) levels.push({ dir, hits });
    if (dir === rootAbs) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (levels.length === 0) return { nearest: undefined, distance: null, hitsAtNearest: [] };
  // 先取最近一层；同层优先 id 出现在 config 路径里，再按版本高、路径字典序
  const nearestLevel = levels[0];
  const cfgRel = rel(configAbs);
  const sorted = [...nearestLevel.hits].sort((a, b) => {
    const ai = RelIdHit(a, cfgRel), bi = RelIdHit(b, cfgRel);
    if (ai !== bi) return ai ? -1 : 1;
    const av = versionOf(a.abs), bv = versionOf(b.abs);
    if (av !== bv) return bv - av;
    return a.path.localeCompare(b.path);
  });
  const distance = rel(path.dirname(configAbs)).split("/").length - rel(nearestLevel.dir).split("/").length;
  return { nearest: sorted[0], distance, hitsAtNearest: sorted };
}
function RelIdHit(m, cfgRel) {
  const id = String(m.raw.id ?? "");
  return id.length > 0 && cfgRel.includes(id);
}
/** 近邻 manifest：共享路径前缀 ≥ 3 段；与 prior 134 对口径的宽配对一致。 */
function proximityManifest(configAbs) {
  const cfgRel = rel(configAbs);
  const candidates = manifests
    .map((m) => ({ m, depth: commonPrefix(m.path, cfgRel) }))
    .filter((x) => x.depth >= 3)
    .sort((a, b) => b.depth - a.depth ||
      (RelIdHit(b.m, cfgRel) ? 1 : 0) - (RelIdHit(a.m, cfgRel) ? 1 : 0) ||
      versionOf(b.m.abs) - versionOf(a.m.abs) ||
      a.m.path.localeCompare(b.m.path));
  return candidates[0];
}

const refsOf = (c) => {
  const ids = new Set([c.player.asset, c.scene.background.asset, c.hud.panel.asset, c.hud.pip.asset]);
  for (const e of c.entities) ids.add(e.asset);
  return [...ids];
};
const covers = (m, ids) => ids.every((id) => m.assetIds.has(id));

for (const c of configs) {
  const parsed = parseGameConfig(c.raw);
  c.parseOk = parsed.ok;
  c.parseErrors = parsed.ok ? [] : parsed.errors.slice(0, 5);
  c.refs = parsed.ok ? refsOf(parsed.value) : [];
  const nm = nearestManifests(c.abs);
  const pm = nm.nearest ? undefined : proximityManifest(c.abs);
  const structural = nm.nearest ?? pm?.m;
  c.nearestManifest = nm.nearest?.path ?? null;
  c.nearestDistance = nm.distance;
  c.nearestHits = nm.hitsAtNearest?.length ?? 0;
  c.proximityManifest = pm?.m.path ?? null;
  c.proximityDepth = pm?.depth ?? null;
  c.structuralManifest = structural?.path ?? null;
  c.pairing = nm.nearest ? "ancestor" : pm ? "proximity" : "none";
  c.coversRefs = structural ? covers(structural, c.refs) : false;
  c.structuralManifestId = structural?.raw.id ?? null;

  // 审计可用 manifest：沿用 02 的口径 —— 优先 ancestor 覆盖；否则全仓找覆盖且共享前缀最长者。
  // proximity 配对只用于结构清单，不改变 02 的审计配对基线。
  let auditManifest = nm.nearest && c.coversRefs ? nm.nearest : undefined;
  c.auditPairMethod = auditManifest ? "ancestor-covers" : null;
  if (auditManifest === undefined && c.refs.length > 0) {
    const fallback = manifests.filter((m) => m.normalizableReadOnly && covers(m, c.refs))
      .sort((a, b) => commonPrefix(b.path, c.path) - commonPrefix(a.path, c.path))[0];
    if (fallback) { auditManifest = fallback; c.auditPairMethod = "global-covers"; }
  }
  c.auditManifest = auditManifest?.path ?? null;
  c.auditManifestSchema = auditManifest?.schema ?? null;
  c.auditManifestParseableCurrent = auditManifest?.parseableCurrent ?? null;
  c.requiresNormalization = auditManifest ? !auditManifest.parseableCurrent : null;
  c.auditManifestAssetsMissingSize = auditManifest?.assetsMissingSize ?? null;

  const gaps = [];
  if (!c.parseOk) gaps.push("config-parse-failed");
  if (!structural) gaps.push("no-structural-manifest");
  else if (!c.coversRefs) gaps.push("structural-manifest-misses-refs");
  if (!auditManifest && c.parseOk) gaps.push("no-covering-manifest");
  if (auditManifest && !auditManifest.normalizableReadOnly) gaps.push("manifest-not-normalizable");
  if (auditManifest && !auditManifest.parseableCurrent) gaps.push("manifest-old-schema");
  c.gaps = gaps;
  c.usableForRejudgment = Boolean(c.parseOk && auditManifest && (auditManifest.normalizableReadOnly || auditManifest.parseableCurrent));
}

// design ↔ config 配对：共同路径前缀 ≥ 4 层（prior 口径）
for (const d of designs) {
  d.levels = Array.isArray(d.raw.levels) ? d.raw.levels.length : 0;
  d.levelIds = Array.isArray(d.raw.levels) ? d.raw.levels.map((l) => l?.id ?? null) : [];
  d.configs = configs.filter((c) => commonPrefix(c.path, d.path) >= 4).map((c) => c.path);
}

// ── 3. 去重 ─────────────────────────────────────────────────────────────────
function dedupe(records) {
  const groups = new Map();
  for (const r of records) {
    if (!groups.has(r.contentHash)) groups.set(r.contentHash, []);
    groups.get(r.contentHash).push(r);
  }
  const duplicates = [];
  for (const [hash, group] of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) =>
      (sourcePriority[a.source] ?? 9) - (sourcePriority[b.source] ?? 9) || a.path.localeCompare(b.path));
    const keep = sorted[0];
    for (const r of sorted.slice(1)) {
      r.duplicateOf = keep.path;
      duplicates.push({ contentHash: hash, keep: keep.path, duplicate: r.path, source: r.source });
    }
  }
  return duplicates;
}
const configDuplicates = dedupe(configs);
const manifestDuplicates = dedupe(manifests);
const designDuplicates = dedupe(designs);

// ── 4. 计数与缺口分布 ────────────────────────────────────────────────────────
const bySource = (arr) => arr.reduce((acc, r) => { acc[r.source] = (acc[r.source] ?? 0) + 1; return acc; }, {});
const gapDistribution = {};
for (const c of configs) for (const g of c.gaps) gapDistribution[g] = (gapDistribution[g] ?? 0) + 1;
const manifestSchema = manifests.reduce((acc, m) => { acc[m.schema] = (acc[m.schema] ?? 0) + 1; return acc; }, {});
const uniqueConfigHashes = new Set(configs.map((c) => c.contentHash));
const uniqueManifestHashes = new Set(manifests.map((m) => m.contentHash));
const auditPairs = configs.filter((c) => c.usableForRejudgment);
const uniqueAuditPairKeys = new Set(auditPairs.map((c) => c.contentHash + "|" + c.auditManifest));
const structuralPairCount = configs.filter((c) => c.structuralManifest !== null).length;
const ancestorPairCount = configs.filter((c) => c.pairing === "ancestor").length;
const proximityPairCount = configs.filter((c) => c.pairing === "proximity").length;
const coverageFallbackCount = configs.filter((c) => c.auditPairMethod === "global-covers").length;

const counts = {
  scannedJsonFiles: files.length,
  parsedJsonObjects: parsedJson,
  objectJson,
  unreadableJson,
  horizontalConfigFiles: configs.length,
  tdConfigFiles: tdConfigs.length,
  uniqueHorizontalConfigs: uniqueConfigHashes.size,
  manifestFiles: manifests.length,
  uniqueManifests: uniqueManifestHashes.size,
  manifestSchemas: manifestSchema,
  manifestsParsedCurrent: manifests.filter((m) => m.parseableCurrent).length,
  manifestsOldSchema: manifests.filter((m) => !m.parseableCurrent).length,
  designFiles: designs.length,
  designLevels: designs.reduce((n, d) => n + d.levels, 0),
  ancestorPairs: ancestorPairCount,
  proximityPairs: proximityPairCount,
  structuralPairs: structuralPairCount,
  structuralUnpaired: configs.length - structuralPairCount,
  coverageFallbackPairs: coverageFallbackCount,
  auditUsableConfigs: auditPairs.length,
  auditUsableUniquePairs: uniqueAuditPairKeys.size,
  auditUnusableConfigs: configs.length - auditPairs.length,
  duplicateConfigFiles: configDuplicates.length,
  duplicateManifestFiles: manifestDuplicates.length,
  duplicateDesignFiles: designDuplicates.length,
  bySource: { configs: bySource(configs), manifests: bySource(manifests), designs: bySource(designs) },
  gapDistribution,
};

const payload = {
  version: "level-playability-corpus-inventory/v1",
  generatedAt: new Date().toISOString(),
  baseline: BASELINE,
  roots: DIRS,
  script: rel(path.join(OUT_DIR, "06-inventory.mjs")),
  pairingRule: {
    structural: "先找 config 目录向上最近的 manifest（ancestor）；找不到时取共享路径前缀 ≥ 3 段的近邻 manifest（proximity）；同层优先 manifest.id 出现在 config 路径中，其次版本高、路径字典序。对应前序 134 对口径。",
    auditUsable: "structural 且 manifest 覆盖 config 的全部 asset 引用；否则全仓找覆盖且共享路径前缀最长的 manifest（coverage fallback）。旧 schema 允许只读归一化，但标记 requiresNormalization。",
    design: "共同路径前缀 ≥ 4 层（prior 口径）；本清单不做 design↔config 的强制一对一。",
  },
  counts,
  configs: configs.map((c) => ({
    path: c.path, sha256: c.sha256, contentHash: c.contentHash, source: c.source,
    parseOk: c.parseOk, parseErrors: c.parseErrors,
    nearestManifest: c.nearestManifest, nearestManifestId: c.structuralManifestId,
    nearestDistance: c.nearestDistance, nearestHits: c.nearestHits,
    proximityManifest: c.proximityManifest, proximityDepth: c.proximityDepth,
    structuralManifest: c.structuralManifest, pairing: c.pairing,
    coversRefs: c.coversRefs,
    auditManifest: c.auditManifest, auditPairMethod: c.auditPairMethod,
    auditManifestSchema: c.auditManifestSchema,
    auditManifestParseableCurrent: c.auditManifestParseableCurrent,
    requiresNormalization: c.requiresNormalization,
    auditManifestAssetsMissingSize: c.auditManifestAssetsMissingSize,
    usableForRejudgment: c.usableForRejudgment,
    gaps: c.gaps,
    ...(c.duplicateOf ? { duplicateOf: c.duplicateOf } : {}),
  })),
  manifests: manifests.map((m) => ({
    path: m.path, sha256: m.sha256, contentHash: m.contentHash, source: m.source,
    schema: m.schema, parseableCurrent: m.parseableCurrent,
    normalizableReadOnly: m.normalizableReadOnly, assetCount: m.assetCount,
    assetsMissingSize: m.assetsMissingSize,
    ...(m.duplicateOf ? { duplicateOf: m.duplicateOf } : {}),
  })),
  designs: designs.map((d) => ({
    path: d.path, sha256: d.sha256, contentHash: d.contentHash, source: d.source,
    levels: d.levels, levelIds: d.levelIds, configs: d.configs,
    ...(d.duplicateOf ? { duplicateOf: d.duplicateOf } : {}),
  })),
  duplicates: { configs: configDuplicates, manifests: manifestDuplicates, designs: designDuplicates },
};
const freezeValue = sha256(Buffer.from(JSON.stringify(payload)));
const inventory = { ...payload, freeze: { algorithm: "sha256", value: freezeValue, note: "对不含 freeze 字段的 JSON.stringify(payload) 计算；08 必须引用本值。" } };
const jsonText = JSON.stringify(inventory, null, 2);
fs.writeFileSync(path.join(OUT_DIR, "inventory.json"), jsonText + "\n");

// ── 5. Markdown 摘要 ─────────────────────────────────────────────────────────
const fmtTable = (obj) => Object.entries(obj).map(([k, v]) => `| ${k} | ${v} |`).join("\n");
const md = `# Level Playability 历史语料清单

- **版本**：\`${inventory.version}\`
- **生成**：${inventory.generatedAt}
- **基线**：\`${BASELINE}\`
- **脚本**：\`${inventory.script}\`（只读；exit 0）
- **冻结 hash**：\`${freezeValue}\`（对 \`inventory.json\` 中不含 \`freeze\` 字段的 payload 计算）
- **机器可读**：\`inventory.json\`（08 必须引用本文件与上述 hash）

## 1. 口径

- **范围**：\`${DIRS.join("`、`")}\`；跳过 \`node_modules\` / \`.git\` / \`dist\` 等。
- **横版 config**：\`format === "game-config/v1"\`；\`td-config/*\` 单独计数、不纳入。
- **结构配对**：先找 config 目录向上最近的 manifest（ancestor）；找不到时取共享路径前缀 ≥ 3 段的近邻 manifest（proximity）；同层优先 \`manifest.id\` 出现在 config 路径中，其次版本高、路径字典序。对应前序 134 对口径。
- **审计可用配对**：结构配对且 manifest 覆盖 config 的全部 asset 引用；否则全仓找覆盖且共享路径前缀最长的 manifest。
- **旧 schema**：\`assetpack/v1–v3\` 允许**只读归一化**（\`assets\` 的 \`id/kind/size\`），但标记 \`requiresNormalization\`；不把 parser 失败当不可玩。机器可读列表保留每条的 schema 与归一化标记。
- **design**：\`format === "game-design/v1"\`；\`levels.length\` 即关数；design↔config 仅记录共同路径前缀 ≥ 4 的候选，不做强制一对一。
- **去重**：按 JSON 内容 hash 分组；保留优先级 \`out > fixtures > packages/demo/fixtures > .scratch\`，同优先级按路径字典序。重复副本记 \`duplicateOf\`。

## 2. 计数

| 指标 | 值 |
|---|---|
${Object.entries(counts).filter(([k]) => k !== "manifestSchemas" && k !== "bySource" && k !== "gapDistribution").map(([k, v]) => `| ${k} | ${typeof v === "object" ? JSON.stringify(v) : v} |`).join("\n")}

### manifest schema 分布

| format | 数量 |
|---|---|
${fmtTable(manifestSchema)}

### 来源分布

| 来源 | configs | manifests | designs |
|---|---|---|---|
${["out", "fixtures", "packages/demo/fixtures", "scratch"].map((s) => `| ${s} | ${counts.bySource.configs[s] ?? 0} | ${counts.bySource.manifests[s] ?? 0} | ${counts.bySource.designs[s] ?? 0} |`).join("\n")}

### 覆盖缺口原因分布（按 config 文件计，可多重）

| 原因 | 数量 |
|---|---|
${fmtTable(gapDistribution)}

> 说明：\`manifest-old-schema\` 不等于不可用；它表示该 config 的审计 manifest 需要只读归一化（全仓 81 份 manifest 是旧 schema，其中 ${configs.filter((c) => c.requiresNormalization).length} 份被当前可用 config 选用）。\`structural-manifest-misses-refs\` 表示结构配对存在但当前审计引用解析不上，是 08 必须逐条解释的覆盖缺口。

## 3. 与前序事实的对照

| 前序口径 | 本清单 | 差异解释 |
|---|---|---|
| 151 份 \`game-config/v1\`（B 类审计） | ${configs.length} | 两次审计之间多 1 份；本清单按当前工作树扫描，未逐文件归因这 1 份，不影响可用配对。 |
| 134 对 config+manifest | 结构配对 ${structuralPairCount} 对（ancestor ${ancestorPairCount} + proximity ${proximityPairCount}） | 覆盖前序 134 对；proximity 口径更宽，且涵盖新增的 probe / negative 产物。审计可用 ${auditPairs.length} 份 / 唯一 ${uniqueAuditPairKeys.size} 对与 02 一致。 |
| 117 份配对 config（D 类审计） | 审计可用 ${auditPairs.length} 份（唯一 ${uniqueAuditPairKeys.size} 对） | D 类只统计更窄的配对子集；本清单同时保留结构配对与审计可用两层口径。 |
| 49 份设计 / 77 关 | ${designs.length} 份 / ${designs.reduce((n, d) => n + d.levels, 0)} 关 | 一致。 |
| 171 份 manifest；81 份非 v4 | ${manifests.length} 份；非 v4 ${manifests.filter((m) => !m.parseableCurrent).length} | 与 02 基线一致（v1 ${manifestSchema["assetpack/v1"] ?? 0} · v2 ${manifestSchema["assetpack/v2"] ?? 0} · v3 ${manifestSchema["assetpack/v3"] ?? 0}）。 |

## 4. 使用规则（08 必须遵守）

1. 重判只引用 \`inventory.json\` 中 \`usableForRejudgment: true\` 的 config。
2. 旧 schema manifest 只能用只读归一化读取；若 08 决定不接受归一化，必须把对应 config 记入覆盖缺口，不得静默排除。
3. 同一 \`contentHash\` 的重复 config 只重判保留副本一次；重复副本可用于交叉校验，不重复计数。
4. 任何新增 error 必须按 config \`path\` + \`sha256\` 定位；不得只报总数。
5. 本清单生成后只读；更新清单必须重新生成并记录新 \`freeze.value\`。

## 5. 已知边界

- 不覆盖塔防 \`td-config/v1\`（${tdConfigs.length} 份，单独计数）。
- 不做设计语义 / 布局对账；design 仅作为来源与关数统计。
- 不判断 config 是否可玩；只提供语料事实。
- 扫描是只读的：未修改、移动、重命名任何历史产物。
`;
fs.writeFileSync(path.join(OUT_DIR, "inventory.md"), md);

console.log(JSON.stringify({ freeze: freezeValue, counts }, null, 2));
