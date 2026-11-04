// 02 缺口探针（E3）：用现有 contracts 审计函数复现「抓不到 / 误报」的场景。
// 运行：node .scratch/level-playability-v1/research/02-gap-probes.mjs
// 只读：不写盘、不调上游；全部输入来自 fixtures/ 与内存里的 structuredClone。
import fs from "node:fs";
import path from "node:path";
import { auditGameConfig, auditReachability, parseAssetPack, parseGameConfig } from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const manifest = parseAssetPack(JSON.parse(fs.readFileSync(`${ROOT}/fixtures/packs/last-train/v2/manifest.json`, "utf8"))).value;
const base = parseGameConfig(JSON.parse(fs.readFileSync(`${ROOT}/fixtures/game-configs/last-train.json`, "utf8"))).value;
const clone = () => structuredClone(base);
const where = (issues) => issues.map((i) => i.where);
const player = manifest.assets.find((a) => a.id === base.player.asset);
const playerAtForFoot = (foot) => ({
  x: foot.x - (0.5 - player.anchor.x) * player.size.w,
  y: foot.y - (1 - player.anchor.y) * player.size.h,
});

const out = {};

// A. chest 不是 reachability 的 target —— 同一位置放 pickup 会报，chest 不报。
{
  const c = clone();
  c.entities.push({ id: "probe-chest", kind: "chest", at: { x: 700, y: 130 }, asset: "pickup-suitcase", range: 0 });
  c.entities.push({ id: "probe-pickup", kind: "pickup", at: { x: 700, y: 130 }, asset: "pickup-suitcase" });
  out.chestNotATarget = {
    reachabilityWhere: where(auditReachability(c, manifest)),
    requiredCollectibleCount: c.entities.filter((e) => e.kind === "pickup" || e.kind === "chest").length,
  };
}

// B. 单向坑：从出生点每个目标都够得到，但拿到坑里的 pickup 之后回不到 gate。
{
  const c = clone();
  c.world = { size: { w: 480, h: 270 } };
  c.terrain = [
    { x: 0, y: 150, w: 300, h: 20 },     // 出生平台
    { x: 340, y: 150, w: 140, h: 20 },   // 右平台（gate）
    { x: 300, y: 250, w: 40, h: 20 },    // 坑底（深 100px > 跳跃顶点 60.5px）
  ];
  c.player = { ...c.player, at: { x: 40, y: 150 } };
  c.entities = [
    { id: "pit-pickup", kind: "pickup", at: { x: 320, y: 250 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 440, y: 150 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" };
  const fromSpawn = where(auditReachability(c, manifest));
  const after = structuredClone(c);
  after.player = { ...c.player, at: playerAtForFoot({ x: 320, y: 250 }) };
  out.oneWayPit = {
    fromSpawn,
    fromPitAfterPickup: where(auditReachability(after, manifest)),
  };
}

// C. solid + motion：reachability 把整段行程当平台；运行时 solid 是静态体（scene.ts addSolid）。
{
  const mk = (withMotion, pickupY) => {
    const c = clone();
    c.world = { size: { w: 1200, h: 270 } };
    c.terrain = [{ x: 0, y: 250, w: 1200, h: 20 }];
    c.player = { ...c.player, at: { x: 40, y: 250 } };
    c.entities = [
      { id: "moving-solid", kind: "solid", at: { x: 600, y: 240 }, asset: "prop-luggage-pile", body: { w: 20, h: 40 },
        ...(withMotion ? { motion: { kind: "cycle", axis: "x", distance: 400, periodMs: 4000 } } : {}) },
      { id: "high-pickup", kind: "pickup", at: { x: 900, y: pickupY }, asset: "pickup-suitcase" },
      { id: "gate", kind: "goal", at: { x: 1150, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    return c;
  };
  out.movingSolidSweep = {
    withMotion_pickupY100: where(auditReachability(mk(true, 100), manifest)),
    withoutMotion_pickupY100: where(auditReachability(mk(false, 100), manifest)),
    note: "运行时 `case \"solid\"` 只 addSolid(e.box)，从不推进 motion ⇒ 判定应跟 withoutMotion 一致",
  };
}

// D. goal 门被别的可站立点「一个身位内」覆盖 —— 现有 covers() 的宽松边界（附反证）。
{
  const c = clone();
  c.entities.find((e) => e.id === "signal").at = { x: 500, y: 250 };
  out.goalInsideSolid = { reachabilityWhere: where(auditReachability(c, manifest)) };
}

// E. 出生点埋在 terrain 里：auditGameConfig 只查 kind:"solid" 实体，不查 terrain。
{
  const c = clone();
  c.player.at = { x: 40, y: 245 };
  c.terrain = [{ x: 0, y: 240, w: 1440, h: 30 }];
  out.spawnInsideTerrain = {
    auditGameConfigWhere: auditGameConfig(c, manifest).map((i) => i.where),
    reachabilityWhere: where(auditReachability(c, manifest)),
  };
}

// F. 低天花板走廊：走得到，但 reachability 只建「跳跃弧」边 ⇒ 误报不可达。
{
  const c = clone();
  c.world = { size: { w: 600, h: 270 } };
  c.terrain = [{ x: 0, y: 250, w: 600, h: 20 }];
  c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "ceiling", kind: "solid", at: { x: 300, y: 170 }, asset: "prop-luggage-pile", body: { w: 600, h: 20 } },
    { id: "p", kind: "pickup", at: { x: 300, y: 250 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 550, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" };
  out.lowCeilingWalkable = { reachabilityWhere: where(auditReachability(c, manifest)) };
}

console.log(JSON.stringify(out, null, 2));
