// 04 合成探针：验证候选判据的「会响 / 不误伤」方向（E3）。只读真夹具，内存改 config。
// 运行：node .scratch/level-playability-v1/research/04-synthetic-probe.mjs
import fs from "node:fs";
import path from "node:path";
import {
  auditReachability, entityBox, parseAssetPack, parseGameConfig, playerMoveOf,
} from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const MANIFEST = parseAssetPack(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/packs/last-train/v2/manifest.json"), "utf8")));
const BASE = parseGameConfig(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/game-configs/last-train.json"), "utf8")));
if (!MANIFEST.ok || !BASE.ok) throw new Error("fixture parse failed");
const M = MANIFEST.value, C = BASE.value;
const clone = (f) => { const c = structuredClone(C); f(c); return c; };
const reach = (c) => auditReachability(c, M).map((i) => i.where);
const a = (id) => M.assets.find((x) => x.id === id);
const box = (e) => entityBox(e.at, e.body ?? a(e.asset).size, a(e.asset).anchor);
const move = playerMoveOf(C);

// 1) 静态 hazard 封死唯一通路：把 carriage 的 motion 去掉（它本来就在唯一地面路径上）。
const staticHazard = clone((c) => { const e = c.entities.find((x) => x.id === "carriage"); delete e.motion; });
// 2) 巡逻 hazard（原样）：整段行程当实心会误报；真实时序可等它走开。
const movingHazard = clone((c) => {});
const asSolidSweep = clone((c) => { for (const e of c.entities) if (e.kind === "hazard") { e.kind = "solid"; } });
const asSolidStatic = clone((c) => { for (const e of c.entities) if (e.kind === "hazard") { delete e.motion; e.kind = "solid"; } });

// 3) danger：full-cut（从 y=0 到世界底）且穿越时长 > idle 窗口。
const DANGER_FULL = { id: "laser", kind: "danger", at: { x: 800, y: 250 }, asset: "signal-endlight", anim: "red",
  body: { w: 64, h: 270 }, strike: { periodMs: 300, activeMs: 300 } };
const DANGER_WIDE = { ...DANGER_FULL, strike: { periodMs: 3000, activeMs: 300 } };
const dangerFull = clone((c) => { c.entities = c.entities.filter((e) => e.kind !== "hazard"); c.entities.push(structuredClone(DANGER_FULL)); });
const dangerWide = clone((c) => { c.entities = c.entities.filter((e) => e.kind !== "hazard"); c.entities.push(structuredClone(DANGER_WIDE)); });
// danger 当空气 / 当实心（说明为什么「当实心」不是上界）
const dangerFullAsSolid = clone((c) => { c.entities = c.entities.filter((e) => e.kind !== "hazard"); const d = structuredClone(DANGER_FULL); d.kind = "solid"; delete d.strike; c.entities.push(d); });
const dangerWideAsSolid = clone((c) => { c.entities = c.entities.filter((e) => e.kind !== "hazard"); const d = structuredClone(DANGER_WIDE); d.kind = "solid"; delete d.strike; c.entities.push(d); });

// 4) pickup / chest 被 hazard/danger 完全包住：把 suitcase-2 放进 carriage 盒内 / 一个静态 hazard 盒内。
const hazardAt = (id, cb, x = 800, w = 64, h = 48) => ({ id, kind: "hazard", at: { x, y: 250 }, asset: "hazard-sweeping-carriage",
  body: { w, h }, ...(cb ? { motion: { kind: "cycle", axis: "x", distance: 200, periodMs: 4000 } } : {}) });
const pickupInStaticHazard = clone((c) => {
  c.entities = c.entities.filter((e) => e.id !== "carriage");
  c.entities.push(hazardAt("h", false, 700, 120, 120));
  c.entities.find((e) => e.id === "suitcase-2").at = { x: 700, y: 250 }; // 在 h 盒内
});
const pickupBehindStaticHazard = clone((c) => { c.entities.find((e) => e.id === "carriage").kind; delete c.entities.find((e) => e.id === "carriage").motion; });

// 5) 允许错题目的：moving solid 的静态原位 vs 整段行程（运行时是静态原位）
const motionSolid = clone((c) => {
  c.entities = c.entities.filter((e) => e.kind !== "hazard");
  c.entities.push({ id: "lift", kind: "solid", at: { x: 800, y: 250 }, asset: "prop-awning-steps",
    motion: { kind: "cycle", axis: "x", distance: 200, periodMs: 4000 } });
});
const motionSolidStatic = clone((c) => {
  c.entities = c.entities.filter((e) => e.kind !== "hazard");
  c.entities.push({ id: "lift", kind: "solid", at: { x: 800, y: 250 }, asset: "prop-awning-steps" });
});

// 6) 宽巡逻反例：last-train carriage distance=200 是合法宽巡逻（票 18）。把它变窄/变宽看判据反应。
const carriageBox = box(C.entities.find((e) => e.id === "carriage"));
const crossingMs = ((carriageBox.w + a("player-traveler").size.w) / move.speed) * 1000;

console.log(JSON.stringify({
  fixture: "fixtures/game-configs/last-train.json",
  baseReach: reach(C),
  staticHazard_asSolidReach: reach(asSolidStatic),
  staticHazard_added: reach(asSolidStatic).filter((w) => !reach(C).includes(w)),
  movingHazard_sweptSolid_naive: reach(asSolidSweep),
  movingHazard_sweptSolid_added: reach(asSolidSweep).filter((w) => !reach(C).includes(w)),
  dangerFull_idleMs: DANGER_FULL.strike.periodMs,
  dangerFull_crossingMs: Math.round(crossingMs),
  dangerFull_baseReach: reach(dangerFull),
  dangerFull_asSolidReach: reach(dangerFullAsSolid),
  dangerWide_baseReach: reach(dangerWide),
  dangerWide_asSolidReach: reach(dangerWideAsSolid),
  pickupInStaticHazard_baseReach: reach(pickupInStaticHazard),
  pickupBehindStaticHazard_added: reach(pickupBehindStaticHazard).filter((w) => !reach(C).includes(w)),
  movingSolid_baseReach: reach(motionSolid),
  movingSolid_staticOriginalReach: reach(motionSolidStatic),
  movingSolid_addedByStaticOriginal: reach(motionSolidStatic).filter((w) => !reach(motionSolid).includes(w)),
  playerSpeed: move.speed,
  playerWidth: a("player-traveler").size.w,
}, null, 2));
