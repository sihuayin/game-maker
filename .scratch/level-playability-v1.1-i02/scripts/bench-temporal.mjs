// U5-06：I-02 时序性能证据（**只作 E3 证据，不作 CI 门禁**）。
//
// 运行：pnpm build && node .scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs
// 产出：.scratch/level-playability-v1.1-u5/evidence/06-performance.json
//
// 口径：
//   - 语料以 `.scratch/level-playability-v1/corpus/inventory.json` 为准，记录文件 SHA-256
//     与 inventory freeze；按 contentHash 去重（20 个唯一 config）；
//   - 历史 manifest 允许**只读归一化**（format → assetpack/v4、provenance 只留 mode），
//     与 inventory 的 old-schema 口径一致；
//   - 两档（16.67 / 200ms）各跑一次完整 `analyzeTemporalInternalTwoLag`；
//   - 输出 p50 / max states、visited、edges、cutPoints、segments、wallMs；结果 / 原因 /
//     预算分布；phaseGridCapped 与 N 分布；跨进程确定性摘要；Node / OS / CPU；
//   - **墙钟只作诊断**，不设阈值、不改变任何证明结论、不进 CI；
//   - 历史语料在 I-02 模型下全部在输入 / 几何阶段 IE，搜索指标为 0；另加两个
//     **内存 synthetic 世界**只作脚本 / 分布 sanity，不代表生产预算。
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const INV_PATH = path.join(ROOT, ".scratch/level-playability-v1/corpus/inventory.json");
const OUT_PATH = path.join(ROOT, ".scratch/level-playability-v1.1-u5/evidence/06-performance.json");
const INDEX_PATH = path.join(ROOT, "packages/contracts/dist/index.js");
const TEMPORAL_PATH = path.join(ROOT, "packages/contracts/dist/playability/temporal.js");
const SELF = path.join(ROOT, ".scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs");

for (const required of [INDEX_PATH, TEMPORAL_PATH]) {
  if (!fs.existsSync(required)) throw new Error(`missing ${required}; run pnpm build first`);
}
const { parseGameConfig, parseAssetPack } = await import(pathToFileURL(INDEX_PATH).href);
const { analyzeTemporalInternalTwoLag } = await import(pathToFileURL(TEMPORAL_PATH).href);

const sha256 = (value) => "sha256:" + crypto.createHash("sha256").update(value).digest("hex");
const stable = (value) => JSON.stringify(value, (_key, val) => {
  if (val === null || typeof val !== "object" || Array.isArray(val)) return val;
  const sorted = {};
  for (const key of Object.keys(val).sort()) sorted[key] = val[key];
  return sorted;
});
const digestOf = (result) => sha256(stable({
  ...result,
  stats: {
    ...result.stats,
    timing: { timeBudgetCheckpointWork: result.stats.timing.timeBudgetCheckpointWork },
  },
  diagnostics: {
    degradationReason: result.diagnostics.degradationReason,
    secondaryReasons: result.diagnostics.secondaryReasons,
  },
}));

const TRUSTED_INPUT = { frames: new Map(), assets: new Set(), files: [] };

/** 历史 assetpack（v1–v3）→ v4 的只读归一化；与 inventory 的 old-schema 口径一致。 */
const normalizeManifest = (raw) => {
  const origins = Array.isArray(raw?.assets) ? raw.assets.map((asset) => asset?.origin) : [];
  const allOf = (value) => origins.length > 0 && origins.every((origin) => origin === value);
  const mode = raw?.provenance?.mode ??
    (allOf("generated") ? "generated" : allOf("imported") ? "imported" : "mixed");
  return { ...raw, format: "assetpack/v4", provenance: { mode } };
};

const loadCorpus = () => {
  const bytes = fs.readFileSync(INV_PATH);
  const inventory = JSON.parse(bytes.toString("utf8"));
  const usable = inventory.configs.filter((entry) => entry.usableForRejudgment && entry.parseOk);
  const uniquePairs = new Set(usable.map((entry) => `${entry.contentHash}|${entry.auditManifest}`));
  const unique = new Map();
  for (const entry of usable) if (!unique.has(entry.contentHash)) unique.set(entry.contentHash, entry);
  const entries = [...unique.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    inventory,
    bytes,
    usable,
    uniquePairs: uniquePairs.size,
    entries,
  };
};

const analyzeWorld = (config, manifest) => {
  const result = analyzeTemporalInternalTwoLag({
    config,
    manifest,
    lagMs: 16.67,
    trustedInput: TRUSTED_INPUT,
  });
  const row = (item) => ({
    internalResult: item.internalResult,
    degradationReason: item.diagnostics.degradationReason,
    budgetStatus: item.stats.budget.budgetStatus,
    budgetKind: item.stats.budget.budgetKind,
    grid: item.stats.grid,
    work: item.stats.work,
    wallClockMs: item.stats.timing.wallClockMs,
    determinismSignature: item.stats.determinismSignature,
    digest: digestOf(item),
  });
  return {
    first: row(result.first),
    second: row(result.second),
    combined: row(result.combined),
  };
};

const runCorpus = (corpus) => {
  const rows = [];
  const excluded = [];
  for (const entry of corpus.entries) {
    try {
      const configParsed = parseGameConfig(
        JSON.parse(fs.readFileSync(path.join(ROOT, entry.path), "utf8")),
      );
      const manifestParsed = parseAssetPack(
        normalizeManifest(JSON.parse(fs.readFileSync(path.join(ROOT, entry.auditManifest), "utf8"))),
      );
      if (!configParsed.ok || !manifestParsed.ok) {
        excluded.push({
          path: entry.path,
          errors: configParsed.ok ? manifestParsed.errors.slice(0, 3) : configParsed.errors.slice(0, 3),
        });
        continue;
      }
      rows.push({
        path: entry.path,
        contentHash: entry.contentHash,
        auditManifest: entry.auditManifest,
        ...analyzeWorld(configParsed.value, manifestParsed.value),
      });
    } catch (error) {
      excluded.push({ path: entry.path, errors: [String(error)] });
    }
  }
  return { rows, excluded };
};

// ── synthetic 世界（只作 sanity，不是生产语料） ─────────────────────────────
const syntheticWorld = (options) => {
  const {
    worldW, worldH, footY, spawnX, goalX, goalW, goalH,
    hazardX, hazardY, hazardW, hazardH, hazardDistance, hazardPeriodMs,
  } = options;
  const checksum = "sha256:" + "0".repeat(64);
  const asset = (id, kind, size, frames, animations) => ({
    id, kind, role: `u5-06 ${id}`, origin: "generated", paletteBinding: "exact",
    required: true, size, anchor: { x: 0.5, y: 1 }, atlasId: "sprites",
    frames: frames.map((name) => ({ name })),
    ...(animations === undefined ? {} : { animations }),
    authoring: [{ kind: "drawlist", ref: `authoring/drawlist/${id}.json` }],
  });
  const assets = [
    asset("hero", "animation", { w: 2, h: 20 }, ["hero.idle", "hero.run", "hero.jump"], [
      { name: "idle", frames: ["hero.idle"] },
      { name: "run", frames: ["hero.run"] },
      { name: "jump", frames: ["hero.jump"] },
    ]),
    asset("bg", "background", { w: worldW, h: worldH }, ["bg"]),
    asset("beacon", "sprite", { w: goalW, h: goalH }, ["beacon"]),
    asset("hazard", "sprite", { w: hazardW, h: hazardH }, ["hazard"]),
    asset("panel", "ui", { w: 8, h: 8 }, ["panel"]),
    asset("pip", "ui", { w: 2, h: 2 }, ["pip"]),
  ];
  const manifest = {
    format: "assetpack/v4",
    id: "u5-06-synthetic",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    generator: { name: "u5-06-bench", version: "0.0.0" },
    provenance: { mode: "generated" },
    palette: {
      ref: "authoring/stylespec.json#/palette", size: 3,
      values: ["#000000", "#ffffff", "#ff0000"],
      coverage: { exact: 3, composited: 0, quantized: 0, unbound: 0 },
    },
    atlases: [{
      id: "sprites", kind: "sprite", meta: "delivery/atlas.sprites.json",
      image: "delivery/atlas.sprites.png", size: { w: 32, h: 32 }, frames: 10,
      assets: assets.map((item) => item.id), checksum,
    }],
    assets,
    files: [
      { path: "delivery/atlas.sprites.json", bytes: 1, checksum },
      { path: "delivery/atlas.sprites.png", bytes: 1, checksum },
      ...assets.map((item) => ({ path: `authoring/drawlist/${item.id}.json`, bytes: 1, checksum })),
    ],
  };
  const config = {
    format: "game-config/v1",
    world: { size: { w: worldW, h: worldH } },
    scene: { background: { asset: "bg" } },
    player: {
      asset: "hero",
      anims: { idle: "idle", run: "run", jump: "jump" },
      at: { x: spawnX, y: footY },
      move: { speed: 20, jumpVelocity: 330, gravity: 900 },
    },
    terrain: [{ x: 0, y: footY, w: worldW, h: 10 }],
    entities: [
      { id: "goal", kind: "goal", at: { x: goalX, y: footY }, asset: "beacon" },
      {
        id: "hazard", kind: "hazard", at: { x: hazardX, y: hazardY }, asset: "hazard",
        motion: { kind: "cycle", axis: "x", distance: hazardDistance, periodMs: hazardPeriodMs },
      },
    ],
    hud: {
      panel: { asset: "panel", at: { x: 0, y: 0 }, size: { w: 8, h: 8 } },
      pip: { asset: "pip", at: { x: 0, y: 0 }, step: { x: 2, y: 0 } },
    },
    objective: { kind: "collect-then-reach", gate: "goal" },
  };
  return { config, manifest };
};

const SYNTHETIC = [
  {
    id: "synthetic-nb",
    options: {
      worldW: 20, worldH: 60, footY: 40, spawnX: 3, goalX: 15, goalW: 2, goalH: 20,
      hazardX: 10, hazardY: 20, hazardW: 4, hazardH: 12, hazardDistance: 4, hazardPeriodMs: 200,
    },
  },
  {
    id: "synthetic-pu",
    options: {
      worldW: 100, worldH: 60, footY: 40, spawnX: 5, goalX: 90, goalW: 2, goalH: 20,
      hazardX: 50, hazardY: 40, hazardW: 20, hazardH: 60, hazardDistance: 10, hazardPeriodMs: 200,
    },
  },
];

const runSynthetic = () => {
  const rows = [];
  for (const item of SYNTHETIC) {
    const raw = syntheticWorld(item.options);
    const configParsed = parseGameConfig(raw.config);
    const manifestParsed = parseAssetPack(raw.manifest);
    if (!configParsed.ok || !manifestParsed.ok) {
      rows.push({
        id: item.id,
        error: configParsed.ok ? manifestParsed.errors.slice(0, 3) : configParsed.errors.slice(0, 3),
      });
      continue;
    }
    rows.push({ id: item.id, ...analyzeWorld(configParsed.value, manifestParsed.value) });
  }
  return rows;
};

const runAll = () => {
  const corpus = loadCorpus();
  const corpusRun = runCorpus(corpus);
  const synthetic = runSynthetic();
  return { corpus, corpusRun, synthetic };
};

const digestOfRun = (run) => ({
  corpus: run.corpusRun.rows.map((row) => ({
    path: row.path,
    first: row.first.determinismSignature,
    second: row.second.determinismSignature,
    combined: row.combined.determinismSignature,
    firstDigest: row.first.digest,
    secondDigest: row.second.digest,
  })),
  synthetic: run.synthetic.map((row) => ({
    id: row.id,
    first: row.first?.determinismSignature ?? null,
    second: row.second?.determinismSignature ?? null,
    combined: row.combined?.determinismSignature ?? null,
    firstDigest: row.first?.digest ?? null,
    secondDigest: row.second?.digest ?? null,
  })),
});

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? null : sorted[Math.floor((sorted.length - 1) / 2)];
};
const maxOf = (values) => (values.length === 0 ? null : Math.max(...values));
const metric = (rows, getter) => {
  const values = rows.map(getter);
  return { p50: median(values), max: maxOf(values) };
};

const summarize = (rows) => {
  const first = rows.map((row) => row.first);
  const second = rows.map((row) => row.second);
  const distribution = (items) => {
    const out = {};
    for (const item of items) out[item] = (out[item] ?? 0) + 1;
    return out;
  };
  const nDistribution = (items) => {
    const out = {};
    for (const item of items) out[String(item.grid.phaseSteps)] = (out[String(item.grid.phaseSteps)] ?? 0) + 1;
    return out;
  };
  const summarizeLag = (items) => ({
    states: metric(items, (item) => item.work.statesEnqueued),
    statesVisited: metric(items, (item) => item.work.statesVisited),
    edges: metric(items, (item) => item.work.edgesChecked),
    cutPoints: metric(items, (item) => item.work.cutPointsTotal),
    segments: metric(items, (item) => item.work.segmentsTotal),
    wallMs: metric(items, (item) => item.wallClockMs),
    witnessTransitions: metric(items, (item) => item.work.witnessTransitions),
    witnessBytes: metric(items, (item) => item.work.witnessBytes),
    resultDistribution: distribution(items.map((item) => item.internalResult)),
    reasonDistribution: distribution(items.map((item) => item.degradationReason ?? "none")),
    phaseGridCappedCount: items.filter((item) => item.grid.phaseGridCapped).length,
    nDistribution: nDistribution(items),
    budgetHitCount: items.filter((item) => item.budgetStatus !== "complete").length,
  });
  return {
    samples: rows.length,
    resultDistribution: distribution(rows.map((row) => row.combined.internalResult)),
    first: summarizeLag(first),
    second: summarizeLag(second),
  };
};

// ── 入口 ────────────────────────────────────────────────────────────────────
if (process.argv.includes("--child")) {
  const run = runAll();
  process.stdout.write(stable(digestOfRun(run)));
} else {
  const run = runAll();
  const parentDigest = stable(digestOfRun(run));
  const childDigests = [];
  for (let index = 0; index < 2; index++) {
    const child = spawnSync(process.execPath, [SELF, "--child"], { cwd: ROOT, encoding: "utf8" });
    if (child.status !== 0) throw new Error(`child ${index + 1} failed: ${child.stderr || child.stdout}`);
    childDigests.push(child.stdout);
  }
  const crossProcessEqual = childDigests.every((digest) => digest === parentDigest);

  const inventory = run.corpus.inventory;
  const evidence = {
    version: "level-playability-v1.1-u5/u5-06-bench/v1",
    generatedAt: new Date().toISOString(),
    command: "node .scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs",
    corpus: {
      path: ".scratch/level-playability-v1/corpus/inventory.json",
      sha256: sha256(run.corpus.bytes),
      freeze: inventory.freeze?.value ?? null,
      usableConfigs: run.corpus.usable.length,
      uniquePairs: run.corpus.uniquePairs,
      uniqueConfigs: run.corpus.entries.length,
      analyzed: run.corpusRun.rows.length,
      excluded: run.corpusRun.excluded,
    },
    environment: {
      node: process.version,
      platform: os.type(),
      release: os.release(),
      arch: os.arch(),
      cpu: os.cpus()[0]?.model ?? "unknown",
      cpuCount: os.cpus().length,
      totalMemGiB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    },
    aggregates: summarize(run.corpusRun.rows),
    configs: run.corpusRun.rows,
    synthetic: run.synthetic,
    crossProcess: {
      runs: 3,
      equal: crossProcessEqual,
      digests: [sha256(parentDigest), ...childDigests.map((digest) => sha256(digest))],
    },
    notes: [
      "wallMs is diagnostic only; no pass threshold and no CI gate",
      "the historical corpus under the I-02 model returns IE before the phase-grid / search stage",
      "synthetic worlds are sanity benchmarks only; they are not production corpus or budget evidence",
    ],
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({
    out: OUT_PATH,
    corpus: evidence.corpus,
    aggregates: evidence.aggregates,
    synthetic: run.synthetic.map((row) => ({
      id: row.id,
      result: row.combined?.internalResult ?? "error",
      reason: row.combined?.degradationReason ?? null,
      states: row.first?.work.statesEnqueued ?? null,
      edges: row.first?.work.edgesChecked ?? null,
      wallMs: row.first?.wallClockMs ?? null,
    })),
    crossProcess: evidence.crossProcess,
  }, null, 2));
  if (!crossProcessEqual) process.exitCode = 1;
}
