// U5-03 E3：跨进程确定性证据。
//
// 两个独立 Node 进程用同一输入各自调用 `analyzeTemporalInternal`，比较：
//   - `stats.determinismSignature`；
//   - 剔除 `wallClockMs` / `detail` 后的规范化完整序列化。
// 注入时钟速率不同（0 / 1ms per read），用于证明墙钟字段不进入上述两项。
//
// 两个输入：
//   1) 真实 fixture `last-train`（I-02 模型下为 IE，早期缺口路径）；
//   2) 内存 compact NB 世界（完整 `nb-candidate` + Witness 策略，覆盖序列化主体）。
//
// 运行：pnpm build && node .scratch/level-playability-v1.1-u5/scripts/cross-process-determinism.mjs
// 产出：.scratch/level-playability-v1.1-u5/evidence/04-cross-process.json
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, ".scratch/level-playability-v1.1-u5/evidence/04-cross-process.json");
const INDEX = path.join(ROOT, "packages/contracts/dist/index.js");
const TEMPORAL = path.join(ROOT, "packages/contracts/dist/playability/temporal.js");
const CONFIG = path.join(ROOT, "fixtures/game-configs/last-train.json");
const MANIFEST = path.join(ROOT, "fixtures/packs/last-train/v2/manifest.json");

const CHILD = `
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const [indexPath, temporalPath, mode, configPath, manifestPath, rateArg] = process.argv.slice(1);
const { parseGameConfig, parseAssetPack } = await import(pathToFileURL(indexPath).href);
const { analyzeTemporalInternal } = await import(pathToFileURL(temporalPath).href);
let configRaw;
let manifestRaw;
if (mode === "files") {
  configRaw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  manifestRaw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} else {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  configRaw = input.config;
  manifestRaw = input.manifest;
}
const configParsed = parseGameConfig(configRaw);
if (!configParsed.ok) throw new Error("config: " + configParsed.errors.join(";"));
const manifestParsed = parseAssetPack(manifestRaw);
if (!manifestParsed.ok) throw new Error("manifest: " + manifestParsed.errors.join(";"));
const rate = Number(rateArg);
let clock = 0;
const now = () => { clock += rate; return clock; };
const result = analyzeTemporalInternal({
  config: configParsed.value,
  manifest: manifestParsed.value,
  lagMs: 0,
  trustedInput: { frames: new Map(), assets: new Set(), files: [] },
  testHooks: { now },
});
const stable = (value) => JSON.stringify(value, (_key, val) => {
  if (val === null || typeof val !== "object" || Array.isArray(val)) return val;
  const sorted = {};
  for (const key of Object.keys(val).sort()) sorted[key] = val[key];
  return sorted;
});
const view = {
  ...result,
  stats: {
    ...result.stats,
    timing: { timeBudgetCheckpointWork: result.stats.timing.timeBudgetCheckpointWork },
  },
  diagnostics: {
    degradationReason: result.diagnostics.degradationReason,
    secondaryReasons: result.diagnostics.secondaryReasons,
  },
};
process.stdout.write(JSON.stringify({
  signature: result.stats.determinismSignature,
  wallClockMs: result.stats.timing.wallClockMs,
  internalResult: result.internalResult,
  certificateKind: result.certificate.kind,
  normalized: stable(view),
}));
`;

/** 与 `playability-temporal-fixtures.ts` 的 compact NB 世界同形（TEST_ONLY 语义）。 */
const compactWorld = (() => {
  const checksum = "sha256:" + "0".repeat(64);
  const asset = (id, kind, size, frames, animations) => ({
    id, kind, role: `u5 cross-process ${id}`, origin: "generated", paletteBinding: "exact",
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
    asset("bg", "background", { w: 20, h: 60 }, ["bg"]),
    asset("beacon", "sprite", { w: 2, h: 20 }, ["beacon"]),
    asset("hazard", "sprite", { w: 4, h: 12 }, ["hazard"]),
    asset("wall", "sprite", { w: 2, h: 20 }, ["wall"]),
    asset("panel", "ui", { w: 8, h: 8 }, ["panel"]),
    asset("pip", "ui", { w: 2, h: 2 }, ["pip"]),
  ];
  const manifest = {
    format: "assetpack/v4",
    id: "u5-cross-process",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    generator: { name: "u5-cross-process", version: "0.0.0" },
    provenance: { mode: "generated" },
    palette: {
      ref: "authoring/stylespec.json#/palette",
      size: 3,
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
    world: { size: { w: 20, h: 60 } },
    scene: { background: { asset: "bg" } },
    player: {
      asset: "hero",
      anims: { idle: "idle", run: "run", jump: "jump" },
      at: { x: 3, y: 40 },
      move: { speed: 20, jumpVelocity: 330, gravity: 900 },
    },
    terrain: [{ x: 0, y: 40, w: 20, h: 10 }],
    entities: [
      { id: "goal", kind: "goal", at: { x: 15, y: 40 }, asset: "beacon" },
      {
        id: "hazard", kind: "hazard", at: { x: 10, y: 20 }, asset: "hazard",
        motion: { kind: "cycle", axis: "x", distance: 4, periodMs: 200 },
      },
    ],
    hud: {
      panel: { asset: "panel", at: { x: 0, y: 0 }, size: { w: 8, h: 8 } },
      pip: { asset: "pip", at: { x: 0, y: 0 }, step: { x: 2, y: 0 } },
    },
    objective: { kind: "collect-then-reach", gate: "goal" },
  };
  return { config, manifest };
})();

const run = (caseId, rate) => {
  const args = caseId === "last-train"
    ? ["--input-type=module", "-e", CHILD, INDEX, TEMPORAL, "files", CONFIG, MANIFEST, String(rate)]
    : ["--input-type=module", "-e", CHILD, INDEX, TEMPORAL, "stdin", "-", "-", String(rate)];
  const child = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    input: caseId === "last-train" ? undefined : JSON.stringify(compactWorld),
  });
  if (child.status !== 0) {
    throw new Error(`child(${caseId}, rate=${rate}) failed: ${child.stderr || child.stdout}`);
  }
  return JSON.parse(child.stdout);
};

const sha = (text) => "sha256:" + crypto.createHash("sha256").update(text).digest("hex");
const cases = ["last-train", "compact-nb"].map((caseId) => {
  const runs = [run(caseId, 0), run(caseId, 1), run(caseId, 1)];
  return {
    caseId,
    signatureEqual: runs.every((item) => item.signature === runs[0].signature),
    normalizedEqual: runs.every((item) => item.normalized === runs[0].normalized),
    wallClockDiffered: new Set(runs.map((item) => item.wallClockMs)).size > 1,
    internalResult: runs[0].internalResult,
    certificateKind: runs[0].certificateKind,
    runs: runs.map((item, index) => ({
      process: index + 1,
      clockRateMs: [0, 1, 1][index],
      signature: item.signature,
      wallClockMs: item.wallClockMs,
      normalizedSha256: sha(item.normalized),
    })),
  };
});
const ok = cases.every((item) => item.signatureEqual && item.normalizedEqual);
const evidence = {
  version: "level-playability-v1.1-u5/u5-03-cross-process/v1",
  generatedAt: new Date().toISOString(),
  command: "node .scratch/level-playability-v1.1-u5/scripts/cross-process-determinism.mjs",
  lagMs: 0,
  cases,
  ok,
};
fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
if (!ok) process.exitCode = 1;
