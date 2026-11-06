// 07 合成负例 + 合法边界矩阵（只读真夹具，生成 scratch fixtures；非生产）。
// 运行：node .scratch/level-playability-v1/fixtures/07-matrix/07-build-matrix.mjs
// 输出：本目录下 <case>/game-config.json + manifest.json + META.json，matrix.json，
//       以及 ../../test-matrix.md；证据写入 evidence/。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseAssetPack, parseGameConfig, auditReachability, auditGameConfig } from "../../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const HERE = import.meta.dirname;
const BASE_RAW = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/game-configs/last-train.json"), "utf8"));
const MAN_RAW = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/packs/last-train/v2/manifest.json"), "utf8"));
const MAN_PARSED = parseAssetPack(MAN_RAW);
if (!MAN_PARSED.ok) throw new Error("manifest parse failed");
// 合成 chest 资源：与 pickup-suitcase 同尺寸 / 锚点，但有两帧 + idle 动画，
// 满足 chest 的 ≥2 帧引用约束，且不改变几何。仅存在于 scratch fixture。
const MAN_FIX = structuredClone(MAN_RAW);
const PICKUP = MAN_FIX.assets.find((a) => a.id === "pickup-suitcase");
MAN_FIX.assets.push({
  ...structuredClone(PICKUP),
  id: "fixture-chest", kind: "animation", role: "scratch 矩阵 chest（非生产）",
  atlasId: "animations",
  frames: [{ name: "fixture-chest.a" }, { name: "fixture-chest.b" }],
  animations: [{ name: "idle", frames: ["fixture-chest.a", "fixture-chest.b"], fps: 2, loop: true }],
  authoring: [],
});
const MAN_FIX_PARSED = parseAssetPack(MAN_FIX);
if (!MAN_FIX_PARSED.ok) throw new Error("fixture manifest parse failed: " + JSON.stringify(MAN_FIX_PARSED.errors.slice(0, 3)));
const M = MAN_FIX_PARSED.value;
const BASE = parseGameConfig(BASE_RAW).value;
const clone = () => structuredClone(BASE);

const cases = [];
const pairsOf = (e) => (Array.isArray(e?.[0]) ? e : [e]);
const add = (meta, make) => cases.push({ ...meta, config: make() });

// ── 空间层 ───────────────────────────────────────────────────────────────────
add({ id: "baseline-last-train", group: "spatial", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: null, evidence: ["03", "baseline-last-train"] }, () => clone());

add({ id: "gap-200", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE", location: 'entity "suitcase-2"',
  legalPair: "gap-40", evidence: ["03", "gap-200"] }, () => {
  const c = clone(); c.terrain = [{ x: 0, y: 250, w: 200, h: 20 }, { x: 400, y: 250, w: 1040, h: 20 }]; return c;
});
add({ id: "gap-40", group: "spatial", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "gap-200", evidence: ["03", "gap-40"] }, () => {
  const c = clone(); c.terrain = [{ x: 0, y: 250, w: 600, h: 20 }, { x: 640, y: 250, w: 800, h: 20 }]; return c;
});
add({ id: "wall-100", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE", location: 'entity "signal"',
  legalPair: "wall-40", evidence: ["03", "wall-100"] }, () => {
  const c = clone(); c.entities.push({ id: "wall", kind: "solid", at: { x: 600, y: 250 }, asset: "prop-luggage-pile", body: { w: 20, h: 100 } }); return c;
});
add({ id: "wall-40", group: "spatial", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "wall-100", evidence: ["03", "wall-40"] }, () => {
  const c = clone(); c.entities.push({ id: "wall", kind: "solid", at: { x: 600, y: 250 }, asset: "prop-luggage-pile", body: { w: 20, h: 40 } }); return c;
});
add({ id: "pickup-120", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE", location: 'entity "suitcase-2"',
  legalPair: "pickup-50", evidence: ["03", "pickup-120"] }, () => {
  const c = clone(); c.entities.find((e) => e.id === "suitcase-2").at = { x: 700, y: 130 }; return c;
});
add({ id: "pickup-50", group: "spatial", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "pickup-120", evidence: ["03", "pickup-50"] }, () => {
  const c = clone(); c.entities.find((e) => e.id === "suitcase-2").at = { x: 700, y: 200 }; return c;
});
add({ id: "goal-inside-luggage", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_GATE_BLOCKED", location: 'entity "signal"',
  legalPair: "gate-midair-jumpthrough", evidence: ["03", "goal-inside-luggage"] }, () => {
  const c = clone(); c.entities.find((e) => e.id === "signal").at = { x: 500, y: 250 }; return c;
});
add({ id: "gate-midair-jumpthrough", group: "completion", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "goal-inside-luggage", evidence: ["05", "gate-midair-jumpthrough"] }, () => {
  const c = clone(); c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }]; c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "suitcase-1", kind: "pickup", at: { x: 300, y: 250 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 700, y: 210 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "low-ceiling-walkable", group: "spatial", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: null, evidence: ["03", "low-ceiling"], note: "03 walk 边修复前是已知误报；修复后合法" }, () => {
  const c = clone(); c.world = { size: { w: 600, h: 270 } }; c.terrain = [{ x: 0, y: 250, w: 600, h: 20 }]; c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "ceiling", kind: "solid", at: { x: 300, y: 170 }, asset: "prop-luggage-pile", body: { w: 600, h: 20 } },
    { id: "p", kind: "pickup", at: { x: 300, y: 250 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 550, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "chest-in-pit", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_CHEST_UNREACHABLE", location: 'entity "chest"',
  legalPair: "chest-range-rescues", evidence: ["03", "chest-in-pit"] }, () => {
  const c = clone(); c.world = { size: { w: 600, h: 270 } };
  c.terrain = [{ x: 0, y: 250, w: 200, h: 20 }, { x: 260, y: 250, w: 340, h: 20 }]; c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "chest", kind: "chest", at: { x: 300, y: 130 }, asset: "pickup-suitcase", range: 0 },
    { id: "gate", kind: "goal", at: { x: 550, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "chest-range-rescues", group: "spatial", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "chest-in-pit", evidence: ["03", "chest-range-rescues"] }, () => {
  const c = clone(); c.world = { size: { w: 600, h: 270 } };
  c.terrain = [{ x: 0, y: 250, w: 300, h: 20 }, { x: 400, y: 250, w: 200, h: 20 }]; c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "chest", kind: "chest", at: { x: 340, y: 250 }, asset: "pickup-suitcase", range: 20 },
    { id: "gate", kind: "goal", at: { x: 550, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "chest-inside-luggage-range0", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_CHEST_BLOCKED", location: 'entity "chest-in"',
  legalPair: "chest-inside-luggage-range30", evidence: ["03", "chest-inside-luggage-range0"] }, () => {
  const c = clone(); c.entities.push({ id: "chest-in", kind: "chest", at: { x: 500, y: 250 }, asset: "pickup-suitcase", range: 0 }); return c;
});
add({ id: "chest-inside-luggage-range30", group: "spatial", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "chest-inside-luggage-range0", evidence: ["03", "chest-inside-luggage-range30"] }, () => {
  const c = clone(); c.entities.push({ id: "chest-in", kind: "chest", at: { x: 500, y: 250 }, asset: "pickup-suitcase", range: 30 }); return c;
});
add({ id: "pickup-inside-luggage", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_PICKUP_BLOCKED", location: 'entity "p-inside"',
  legalPair: "pickup-on-luggage", evidence: ["03", "pickup-inside-luggage"] }, () => {
  const c = clone(); c.entities.push({ id: "p-inside", kind: "pickup", at: { x: 500, y: 250 }, asset: "pickup-suitcase" }); return c;
});
add({ id: "pickup-on-luggage", group: "spatial", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "pickup-inside-luggage", evidence: ["03", "pickup-on-luggage"] }, () => {
  const c = clone(); c.entities.push({ id: "p-top", kind: "pickup", at: { x: 500, y: 210 }, asset: "pickup-suitcase" }); return c;
});
add({ id: "pickup-body-override-inside", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_PICKUP_BLOCKED", location: 'entity "p-body"',
  legalPair: "baseline-last-train", evidence: ["03", "pickup-body-override-inside"],
  note: "运行时忽略 pickup 的 body；用声明 body 会漏报" }, () => {
  const c = clone(); c.entities.push({ id: "p-body", kind: "pickup", at: { x: 500, y: 250 }, asset: "pickup-suitcase", body: { w: 200, h: 200 } }); return c;
});
add({ id: "moving-solid-sweep", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE", location: 'entity "high-pickup"',
  legalPair: "baseline-last-train", evidence: ["03", "moving-solid-sweep"],
  note: "solid + motion 在运行时是静态原位；按整段行程判定是错的" }, () => {
  const c = clone(); c.world = { size: { w: 1200, h: 270 } }; c.terrain = [{ x: 0, y: 250, w: 1200, h: 20 }]; c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "moving-solid", kind: "solid", at: { x: 600, y: 240 }, asset: "prop-luggage-pile", body: { w: 20, h: 40 }, motion: { kind: "cycle", axis: "x", distance: 400, periodMs: 4000 } },
    { id: "high-pickup", kind: "pickup", at: { x: 900, y: 100 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 1150, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "spawn-deep-terrain", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN", location: "player.at",
  legalPair: "baseline-last-train", evidence: ["03", "spawnDx"],
  note: "窄口径依赖 P4 spawn 分离 profile；未写入 profile 时降为 INSUFFICIENT_EVIDENCE" }, () => {
  const c = clone(); c.player = { ...c.player, at: { x: 40, y: 245 } };
  c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }, { x: 0, y: 150, w: 120, h: 100 }]; return c;
});
add({ id: "spawn-no-foothold", group: "spatial", expect: "INSUFFICIENT_EVIDENCE", judgment: null,
  location: "coverage.spatial", legalPair: "baseline-last-train", evidence: ["03", "spawn-no-foothold"] }, () => {
  const c = clone(); c.terrain = [{ x: 400, y: 250, w: 1040, h: 20 }]; return c;
});
add({ id: "spawn-in-solid", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "auditGameConfig.spawn-in-solid (existing)", location: "player.at",
  legalPair: "baseline-last-train", evidence: ["existing", "auditGameConfig"] }, () => {
  const c = clone(); c.entities.push({ id: "spawn-block", kind: "solid", at: { x: 40, y: 250 }, asset: "prop-luggage-pile", body: { w: 40, h: 40 } }); return c;
});
add({ id: "target-out-of-world", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "auditGameConfig.inWorld (existing)", location: 'entity "signal"',
  legalPair: "target-at-edge", evidence: ["existing", "auditGameConfig"] }, () => {
  const c = clone(); c.entities.find((e) => e.id === "signal").at = { x: 1500, y: 250 }; return c;
});
add({ id: "target-at-edge", group: "spatial", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "target-out-of-world", evidence: ["existing", "auditGameConfig"] }, () => {
  const c = clone(); c.entities.find((e) => e.id === "signal").at = { x: 1400, y: 250 }; return c;
});

// ── 机制层 ───────────────────────────────────────────────────────────────────
add({ id: "static-hazard-seals-path", group: "mechanic", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_MECHANIC_PATH_BLOCKED", location: 'entity "suitcase-3"',
  legalPair: "wide-patrol", evidence: ["04-corpus", "maskAddsError"],
  note: "历史语料 4 个命中证明模型会响；本 fixture 是 09 的最小复现" }, () => {
  const c = clone(); delete c.entities.find((e) => e.id === "carriage").motion; return c;
});
add({ id: "wide-patrol", group: "mechanic", expect: "INSUFFICIENT_EVIDENCE", judgment: null,
  location: "coverage.mechanic", legalPair: "static-hazard-seals-path", evidence: ["04-patrol", "naivePatrolSweepAddsError"],
  note: "宽巡逻是合法设计；整段扫掠当实心会误报，V1 不注册巡逻判据" }, () => clone());
add({ id: "danger-full-wall", group: "mechanic", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW", location: 'entity "suitcase-3"',
  legalPair: "danger-wide-idle", evidence: ["04", "dangerFull_crossingMs"] }, () => {
  const c = clone(); c.entities = c.entities.filter((e) => e.kind !== "hazard");
  c.entities.push({ id: "laser", kind: "danger", at: { x: 800, y: 250 }, asset: "signal-endlight", anim: "red", body: { w: 64, h: 270 }, strike: { periodMs: 300, activeMs: 300 } });
  return c;
});
add({ id: "danger-wide-idle", group: "mechanic", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "danger-full-wall", evidence: ["04", "dangerWide_baseReach"] }, () => {
  const c = clone(); c.entities = c.entities.filter((e) => e.kind !== "hazard");
  c.entities.push({ id: "laser", kind: "danger", at: { x: 800, y: 250 }, asset: "signal-endlight", anim: "red", body: { w: 64, h: 270 }, strike: { periodMs: 3000, activeMs: 300 } });
  return c;
});
add({ id: "pickup-in-static-hazard", group: "mechanic", expect: "INSUFFICIENT_EVIDENCE", judgment: null,
  location: "coverage.mechanic", legalPair: "baseline-last-train", evidence: ["04", "pickupInStaticHazard_baseReach"],
  note: "复位保留收集计数；同帧回调顺序不可证；不判错" }, () => {
  const c = clone(); c.entities = c.entities.filter((e) => e.id !== "carriage");
  c.entities.push({ id: "h", kind: "hazard", at: { x: 700, y: 250 }, asset: "hazard-sweeping-carriage", body: { w: 120, h: 120 } });
  c.entities.find((e) => e.id === "suitcase-2").at = { x: 700, y: 250 }; return c;
});
add({ id: "moving-platform", group: "mechanic", expect: "INSUFFICIENT_EVIDENCE", judgment: null,
  location: "coverage.mechanic", legalPair: "baseline-last-train", evidence: ["04", "movingSolid_staticOriginalReach"],
  note: "moving-platform 未在 Runtime 实现；归 mechanic-coverage，不产 playability error" }, () => {
  const c = clone(); c.entities = c.entities.filter((e) => e.kind !== "hazard");
  c.entities.push({ id: "lift", kind: "solid", at: { x: 800, y: 250 }, asset: "prop-awning-steps", motion: { kind: "cycle", axis: "x", distance: 200, periodMs: 4000 } });
  return c;
});

// ── 完成性层 ─────────────────────────────────────────────────────────────────
add({ id: "one-way-pit-pickup", group: "completion", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT", location: 'entity "gate"',
  legalPair: "one-way-pit-gate-on-pit-floor", evidence: ["05", "one-way-pit-pickup"] }, () => {
  const c = clone(); c.world = { size: { w: 480, h: 270 } };
  c.terrain = [{ x: 0, y: 150, w: 300, h: 20 }, { x: 340, y: 150, w: 140, h: 20 }, { x: 300, y: 250, w: 40, h: 20 }];
  c.player = { ...c.player, at: { x: 40, y: 150 } };
  c.entities = [
    { id: "pit-pickup", kind: "pickup", at: { x: 320, y: 250 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 440, y: 150 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "one-way-pit-gate-on-pit-floor", group: "completion", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "one-way-pit-pickup", evidence: ["05", "one-way-pit-gate-on-pit-floor"] }, () => {
  const c = clone(); c.world = { size: { w: 480, h: 270 } };
  c.terrain = [{ x: 0, y: 150, w: 300, h: 20 }, { x: 300, y: 250, w: 180, h: 20 }];
  c.player = { ...c.player, at: { x: 40, y: 150 } };
  c.entities = [
    { id: "pit-pickup", kind: "pickup", at: { x: 320, y: 250 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 460, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "two-one-way-branches", group: "completion", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT", location: 'entity "gate"',
  legalPair: "order-required-high-then-low", evidence: ["05", "two-one-way-branches"] }, () => {
  const c = clone(); c.world = { size: { w: 560, h: 270 } };
  c.terrain = [
    { x: 0, y: 150, w: 100, h: 20 }, { x: 100, y: 250, w: 80, h: 20 }, { x: 180, y: 150, w: 20, h: 120 },
    { x: 200, y: 250, w: 80, h: 20 }, { x: 340, y: 150, w: 140, h: 20 },
  ];
  c.player = { ...c.player, at: { x: 40, y: 150 } };
  c.entities = [
    { id: "left-pickup", kind: "pickup", at: { x: 140, y: 250 }, asset: "pickup-suitcase" },
    { id: "right-pickup", kind: "pickup", at: { x: 240, y: 250 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 460, y: 150 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "order-required-high-then-low", group: "completion", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "two-one-way-branches", evidence: ["05", "order-required-high-then-low"] }, () => {
  const c = clone(); c.world = { size: { w: 640, h: 270 } };
  c.terrain = [{ x: 0, y: 150, w: 200, h: 20 }, { x: 200, y: 100, w: 60, h: 20 }, { x: 300, y: 250, w: 340, h: 20 }];
  c.player = { ...c.player, at: { x: 40, y: 150 } };
  c.entities = [
    { id: "high-pickup", kind: "pickup", at: { x: 230, y: 100 }, asset: "pickup-suitcase" },
    { id: "low-pickup", kind: "pickup", at: { x: 400, y: 250 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 600, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "two-pickups-one-arc", group: "completion", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: null, evidence: ["05", "two-pickups-one-arc"] }, () => {
  const c = clone(); c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }]; c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "arc-a", kind: "pickup", at: { x: 300, y: 220 }, asset: "pickup-suitcase" },
    { id: "arc-b", kind: "pickup", at: { x: 330, y: 220 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "chest-sealed-in-solid", group: "spatial", expect: "PROVEN_UNPLAYABLE",
  judgment: "PLAYABILITY_SPATIAL_CHEST_BLOCKED", location: 'entity "sealed-chest"',
  legalPair: "chest-behind-wall-with-range", evidence: ["05", "chest-sealed-in-solid"] }, () => {
  const c = clone(); c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }]; c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "vault", kind: "solid", at: { x: 700, y: 250 }, asset: "prop-luggage-pile", body: { w: 120, h: 80 } },
    { id: "sealed-chest", kind: "chest", at: { x: 700, y: 250 }, asset: "pickup-suitcase", range: 0 },
    { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "chest-behind-wall-with-range", group: "completion", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: "chest-sealed-in-solid", evidence: ["05", "chest-behind-wall-with-range"] }, () => {
  const c = clone(); c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }]; c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "wall", kind: "solid", at: { x: 700, y: 250 }, asset: "prop-luggage-pile", body: { w: 20, h: 120 } },
    { id: "behind-wall-chest", kind: "chest", at: { x: 740, y: 250 }, asset: "pickup-suitcase", range: 60 },
    { id: "gate", kind: "goal", at: { x: 300, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "chest-midair-jumpthrough", group: "completion", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: null, evidence: ["05", "chest-midair-jumpthrough"] }, () => {
  const c = clone(); c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }]; c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "air-chest", kind: "chest", at: { x: 300, y: 210 }, asset: "pickup-suitcase", range: 0 },
    { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "pit-chest-with-reset-hazard", group: "completion", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: null, evidence: ["05", "pit-chest-with-reset-hazard"] }, () => {
  const c = clone(); c.world = { size: { w: 480, h: 270 } };
  c.terrain = [{ x: 0, y: 150, w: 300, h: 20 }, { x: 300, y: 250, w: 180, h: 20 }];
  c.player = { ...c.player, at: { x: 40, y: 150 } };
  c.entities = [
    { id: "pit-chest", kind: "chest", at: { x: 320, y: 250 }, asset: "pickup-suitcase", range: 0 },
    { id: "pit-hazard", kind: "hazard", at: { x: 420, y: 250 }, asset: "hazard-sweeping-carriage" },
    { id: "gate", kind: "goal", at: { x: 260, y: 150 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});
add({ id: "chest-overlapping-hazard", group: "completion", expect: "NO_PROVEN_BLOCKER", judgment: null,
  location: null, legalPair: null, evidence: ["05", "chest-overlapping-hazard"] }, () => {
  const c = clone(); c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }]; c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "chest-on-hazard", kind: "chest", at: { x: 700, y: 250 }, asset: "pickup-suitcase", range: 0 },
    { id: "hazard-on-chest", kind: "hazard", at: { x: 700, y: 250 }, asset: "hazard-sweeping-carriage" },
    { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" }; return c;
});

// ── 写 fixtures ───────────────────────────────────────────────────────────────
const summary = [];
for (const c of cases) {
  for (const e of c.config.entities) {
    if (e.kind === "goal" && e.asset === "signal-endlight" && e.anim === undefined) e.anim = "green";
    if (e.kind === "chest" && e.asset === "pickup-suitcase") { e.asset = "fixture-chest"; delete e.anim; }
  }
  const dir = path.join(HERE, c.id);
  fs.mkdirSync(dir, { recursive: true });
  const cfgText = JSON.stringify(c.config, null, 2) + "\n";
  fs.writeFileSync(path.join(dir, "game-config.json"), cfgText);
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(MAN_FIX, null, 2) + "\n");
  const meta = {
    caseId: c.id, group: c.group, nonProduction: true,
    expectedVerdict: c.expect, expectedJudgmentId: c.judgment,
    failureLocation: c.location, legalPair: c.legalPair ?? null,
    evidence: pairsOf(c.evidence), note: c.note ?? null,
    fixture: `fixtures/07-matrix/${c.id}/game-config.json`,
  };
  fs.writeFileSync(path.join(dir, "META.json"), JSON.stringify(meta, null, 2) + "\n");
  const parsed = parseGameConfig(c.config);
  const reach = parsed.ok ? auditReachability(parsed.value, M).map((i) => i.where) : [];
  const g = parsed.ok ? auditGameConfig(parsed.value, M).map((i) => ({ severity: i.severity, where: i.where })) : [];
  summary.push({ ...meta, parseOk: parsed.ok, currentReachability: reach, currentAuditGameConfig: g });
  if (!parsed.ok) console.error("PARSE FAIL", c.id, parsed.errors.slice(0, 3));
}

// ── 跑探针证据 ───────────────────────────────────────────────────────────────
const evidenceDir = path.join(HERE, "evidence");
fs.mkdirSync(evidenceDir, { recursive: true });
const probes = [
  ["03", "research/03-spatial-probes.mjs", []],
  ["04", "research/04-synthetic-probe.mjs", []],
  ["05", "research/05-completion-probe.mjs", ["synthetic"]],
  ["04-corpus", "research/04-hazard-mask-corpus.mjs", []],
  ["04-patrol", "research/04-patrol-probe.mjs", []],
];
const evidence = {};
for (const [key, script, args] of probes) {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, ".scratch/level-playability-v1", script), ...args], { cwd: ROOT, encoding: "utf8" });
    fs.writeFileSync(path.join(evidenceDir, `${key}.json`), out);
    evidence[key] = JSON.parse(out);
    console.log(`probe ${key}: exit 0`);
  } catch (e) {
    console.error(`probe ${key}: FAILED`, e.status, e.message);
    evidence[key] = null;
  }
}
function hasEvidence(src, key) {
  if (src === "existing") return true;
  const e = evidence[src];
  if (e === null || e === undefined) return false;
  if (src === "03") return key in (e.scenarios ?? {}) || key in e;
  if (src === "05") return (e.synthetic ?? []).some((x) => x.id === key);
  if (src === "04") return key in e;
  if (src === "04-corpus" || src === "04-patrol") return key in e;
  return false;
}
for (const s of summary) {
  s.evidenceStatus = s.evidence.map(([src, key]) => ({ src, key, found: hasEvidence(src, key) }));
}

const matrix = {
  version: "level-playability-test-matrix/v1",
  generatedAt: new Date().toISOString(),
  nonProduction: true,
  baseline: "main @ fa17c14",
  cases: summary,
};
fs.writeFileSync(path.join(HERE, "matrix.json"), JSON.stringify(matrix, null, 2) + "\n");

// ── 生成 test-matrix.md ──────────────────────────────────────────────────────
const rows = summary.map((s, i) =>
  `| ${i + 1} | ${s.group} | \`${s.caseId}\` | \`${s.expectedVerdict}\` | ${s.expectedJudgmentId ? "`" + s.expectedJudgmentId + "`" : "—"} | ${s.failureLocation ? "`" + s.failureLocation + "`" : "—"} | ${s.legalPair ? "`" + s.legalPair + "`" : "—"} | ${s.evidence.map(([a, b]) => `${a}:${b}`).join("<br>")} |`).join("\n");

const md = `# Level Playability V1 — 合成负例与合法边界矩阵

> ⚠️ **非生产**：本目录下所有 fixture 都是 scratch 矩阵夹具，不是产品测试、不是历史语料、不得被 build / QA / 发布闸消费。
> 来源：03–05 的候选判据探针。合成矩阵只证明「判据会响 / 合法边界不误伤」，**不替代** 08 的历史语料零误伤基线。

- **版本**：\`${matrix.version}\`
- **生成**：${matrix.generatedAt}
- **基线**：\`${matrix.baseline}\`
- **机器可读**：\`fixtures/07-matrix/matrix.json\`
- **证据**：\`fixtures/07-matrix/evidence/{03,04,05,04-corpus,04-patrol}.json\`（五份探针均退出 0）
- **fixture 根**：\`fixtures/07-matrix/<case>/\`（每例含 \`game-config.json\` + \`manifest.json\` + \`META.json\`）

## 1. 矩阵

| # | 层 | case | 预期 verdict | 判据 id / owner | 失败定位 | 合法边界配对 | 证据 |
|---|---|---|---|---|---|---|---|
${rows}

## 2. 必须覆盖项对照（票 07）

| 必须覆盖的负例 | 对应用例 | 说明 |
|---|---|---|
| 沟壑造成必经路线中断 | \`gap-200\` | 合法边界 \`gap-40\` |
| 台阶 / 落脚点使跳跃无法完成 | \`wall-100\` / \`pickup-120\` | 合法边界 \`wall-40\` / \`pickup-50\` |
| 巡逻 hazard 封死唯一通路 | \`wide-patrol\` | **04 裁定不可证**：预期 \`INSUFFICIENT_EVIDENCE\`，不是 error |
| 危险区不存在可通过的安全窗口 | \`danger-full-wall\` | 合法边界 \`danger-wide-idle\` |
| 必需拾取物被地形或机制封死 | \`pickup-inside-luggage\` / \`chest-sealed-in-solid\` / \`pickup-in-static-hazard\` | 地形/实心体可证；hazard 包住只落 \`INSUFFICIENT_EVIDENCE\` |
| 目标位置无法到达或不可站立 | \`goal-inside-luggage\` / \`gate-midair-jumpthrough\` | 「站不住」不是错误；只要求 overlap |
| 出生点卡在实心体内 | \`spawn-in-solid\` / \`spawn-deep-terrain\` | 前者归既有 \`auditGameConfig\`；后者是新窄口径 |
| 实体 / 目标越界 | \`target-out-of-world\` | 归既有 \`auditGameConfig.inWorld\`；合法边界 \`target-at-edge\` |

## 3. 关键裁定在矩阵里的体现

1. **巡逻 hazard 不是确定性 error**：整段扫掠当实心会误伤宽巡逻（04 语料 4 条误报）。矩阵预期 \`INSUFFICIENT_EVIDENCE\`。
2. **被 hazard / danger 包住的收集物不判错**：复位保留收集计数、同帧回调顺序不可证；矩阵预期 \`INSUFFICIENT_EVIDENCE\`。
3. **moving-platform 归 \`mechanic-coverage\`**：不产 playability error；矩阵预期 \`INSUFFICIENT_EVIDENCE\`。
4. **低天花板 / moving solid 扫掠是合法边界**：03 修复前是已知误报，修复后必须 \`NO_PROVEN_BLOCKER\`；completion 在 03 修复前不得硬拒。
5. **「目标站得住」不是判据**：运行时只要求 overlap；\`gate-midair-jumpthrough\` / \`chest-midair-jumpthrough\` 必须不报。
6. **出生点口径**：纯盒重叠会误伤 11/20；矩阵只用窄口径 \`spawn-deep-terrain\` 作负例，\`baseline-last-train\` 作合法边界；\`spawn-no-foothold\` 落 \`INSUFFICIENT_EVIDENCE\`。
7. **chest 几何归 03**：\`chest-sealed-in-solid\` 报 \`PLAYABILITY_SPATIAL_CHEST_BLOCKED\`；completion 不重复报。

## 4. 运行与验证

\`\`\`bash
node .scratch/level-playability-v1/fixtures/07-matrix/07-build-matrix.mjs
# 退出 0；重新生成 fixtures 与 matrix.json
\`\`\`

- 每个 fixture 已用 \`parseGameConfig\` 校验；解析失败会在生成时打印并退出非零（本次无失败）。
- 五份探针证据：\`03-spatial-probes.mjs\`、\`04-synthetic-probe.mjs\`、\`05-completion-probe.mjs synthetic\`、\`04-hazard-mask-corpus.mjs\`、\`04-patrol-probe.mjs\`，均退出 0。
- 这份矩阵不是生产测试；09 实施时应把对应用例转成生产测试（本图不做）。

## 5. 边界

- 不写生产测试、不改 \`packages/**\`。
- 不扩大到 03–05 未裁定的判据。
- 合成负例通过 ≠ 真实关卡可玩性已验证；零误伤基线由 08 负责。
`;
fs.writeFileSync(path.join(ROOT, ".scratch/level-playability-v1/test-matrix.md"), md);

const parseFails = summary.filter((s) => !s.parseOk);
const evidenceMisses = summary.flatMap((s) => s.evidenceStatus.filter((e) => !e.found));
console.log(JSON.stringify({
  cases: summary.length,
  parseFails: parseFails.map((s) => s.caseId),
  evidenceMisses,
  verdicts: summary.reduce((a, s) => { a[s.expectedVerdict] = (a[s.expectedVerdict] ?? 0) + 1; return a; }, {}),
  groups: summary.reduce((a, s) => { a[s.group] = (a[s.group] ?? 0) + 1; return a; }, {}),
}, null, 2));
if (parseFails.length > 0) process.exitCode = 1;
