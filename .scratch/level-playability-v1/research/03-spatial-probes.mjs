// 03 空间布局判据探针（E3）：只读、零付费。
// 运行：node .scratch/level-playability-v1/research/03-spatial-probes.mjs
// 目的：
//   1) 用最小合成场景验证「走路边 + 下落弧 + 真实盒重叠 + chest 交互区 + solid 静态化」能否
//      修掉低天花板误报、抓到埋进实心体的目标，同时不改变既有正/负例；
//   2) 在 02 用过的同一批历史语料上估算新增 error（不重判、不写盘）。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  auditReachability, auditGameConfig, entityBox, jumpSpan, maxJumpHeight, parseAssetPack,
  parseGameConfig, playerMoveOf, pickupCount,
} from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const MANIFEST = parseAssetPack(JSON.parse(fs.readFileSync(`${ROOT}/fixtures/packs/last-train/v2/manifest.json`, "utf8"))).value;
const BASE = parseGameConfig(JSON.parse(fs.readFileSync(`${ROOT}/fixtures/game-configs/last-train.json`, "utf8"))).value;
const clone = () => structuredClone(BASE);
const where = (issues) => issues.map((i) => i.where);
const assetOf = (m, id) => m.assets.find((a) => a.id === id);
const anchorOf = (m, id) => assetOf(m, id)?.anchor ?? { x: 0.5, y: 1 };
const sizeOf = (m, id) => assetOf(m, id)?.size ?? null;

// ── 原型：空间可达性（可开关的语义）──────────────────────────────────────────
function spatial(config, manifest, opts = {}) {
  const { w: W, h: H } = config.world.size;
  const move = playerMoveOf(config);
  const pa = assetOf(manifest, config.player.asset);
  if (!pa) return { errors: [], gaps: ["player-asset-missing"] };
  const pSize = pa.size, pAnchor = pa.anchor;
  const walk = opts.walk ?? true;
  const fall = opts.fall ?? true;
  const strict = opts.strict ?? true;
  const chestTargets = opts.chest ?? true;
  const staticMotion = opts.staticMotion ?? true;
  const runtimeBody = opts.runtimeBody ?? true; // pickup/goal/hazard 用资源标称盒（运行时忽略 e.body）

  const solids = config.terrain.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
  for (const e of config.entities) {
    if (e.kind !== "solid") continue;
    const s = e.body ?? sizeOf(manifest, e.asset);
    if (!s) continue;
    const b = entityBox(e.at, s, anchorOf(manifest, e.asset));
    if (!e.motion || staticMotion) { solids.push(b); continue; }
    const d = e.motion.distance;
    solids.push(e.motion.axis === "x"
      ? { x: Math.min(b.x, b.x + d), y: b.y, w: b.w + Math.abs(d), h: b.h }
      : { x: b.x, y: Math.min(b.y, b.y + d), w: b.w, h: b.h + Math.abs(d) });
  }

  const stride = H + 1;
  const blocked = new Uint8Array((W + 1) * stride);
  for (const s of solids) {
    const x0 = Math.max(0, Math.floor(s.x - pSize.w / 2) + 1);
    const x1 = Math.min(W, Math.ceil(s.x + s.w + pSize.w / 2) - 1);
    const y0 = Math.max(0, Math.floor(s.y) + 1);
    const y1 = Math.min(H, Math.ceil(s.y + s.h + pSize.h) - 1);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) blocked[x * stride + y] = 1;
  }
  const stand = new Uint8Array((W + 1) * stride);
  for (let x = 0; x <= W; x++) for (let y = 0; y <= H; y++) {
    const i = x * stride + y;
    stand[i] = blocked[i] === 0 && y + 1 <= H && blocked[i + 1] === 1 ? 1 : 0;
  }
  const cols = [];
  for (let x = 0; x <= W; x++) { const ys = []; for (let y = 0; y <= H; y++) if (stand[x * stride + y]) ys.push(y); cols.push(ys); }

  // chest / solid / danger 的运行时几何吃 e.body；pickup / hazard / goal 忽略它（scene.ts:149-198）。
  const boxOf = (e) => {
    const honorsBody = e.kind === "chest" || e.kind === "solid" || e.kind === "danger";
    const s = runtimeBody && !honorsBody ? sizeOf(manifest, e.asset) : (e.body ?? sizeOf(manifest, e.asset));
    return s ? entityBox(e.at, s, anchorOf(manifest, e.asset)) : null;
  };
  const expand = (b, r) => ({ x: b.x - r, y: b.y - r, w: b.w + 2 * r, h: b.h + 2 * r });
  const targets = [];
  for (const e of config.entities) {
    if (e.kind === "pickup") targets.push({ id: e.id, kind: e.kind, rect: boxOf(e) });
    if (e.kind === "chest" && chestTargets) { const b = boxOf(e); if (b) targets.push({ id: e.id, kind: e.kind, rect: expand(b, e.range ?? 0) }); }
  }
  const gate = config.entities.find((e) => e.kind === "goal" && e.id === config.objective.gate);
  if (gate) targets.push({ id: gate.id, kind: "goal", rect: boxOf(gate) });

  const pBox = (x, y) => ({ x: x - pSize.w / 2, y: y - pSize.h, w: pSize.w, h: pSize.h });
  const overlaps = (a, b) => a !== null && b !== null && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const covered = targets.map(() => false);
  const coverAt = (x, y) => {
    const pb = pBox(x, y);
    for (const [i, t] of targets.entries()) if (!covered[i] && overlaps(pb, t.rect)) covered[i] = true;
  };

  const foot = {
    x: config.player.at.x + (0.5 - pAnchor.x) * pSize.w,
    y: config.player.at.y + (1 - pAnchor.y) * pSize.h,
  };
  const seen = new Uint8Array((W + 1) * stride);
  const queue = [];
  const seedAt = (x, y) => { const i = x * stride + y; if (seen[i]) return; seen[i] = 1; queue.push({ x, y }); coverAt(x, y); };
  for (let x = Math.max(0, Math.round(foot.x - pSize.w)); x <= Math.min(W, Math.round(foot.x + pSize.w)); x++)
    for (const y of cols[x]) if (y >= foot.y - pSize.h) seedAt(x, y);
  const gaps = [];
  if (queue.length === 0) gaps.push("spawn-no-foothold");
  coverAt(Math.round(foot.x), Math.round(foot.y));

  const apex = maxJumpHeight(move);
  const maxDx = Math.ceil(jumpSpan(move, H));
  const hop = (ax, ay, bx, by) => {
    const dh = ay - by;
    if (dh > apex || dh < -H) return false;
    const disc = move.jumpVelocity ** 2 - 2 * move.gravity * dh;
    if (disc < 0) return false;
    const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
    if (Math.abs(bx - ax) > move.speed * t) return false;
    const n = Math.max(6, Math.min(120, Math.ceil(t * 60)));
    for (let i = 0; i <= n; i++) {
      const f = i / n, tt = t * f;
      const x = Math.round(ax + (bx - ax) * f);
      const y = Math.round(ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2));
      if (y < 0 || y > H || x < 0 || x > W) continue;
      if (blocked[x * stride + y] === 1) return false;
      coverAt(x, y);
    }
    return true;
  };
  const fallArc = (ax, ay, bx, by) => {
    const dy = by - ay;
    if (dy <= 0) return false;
    const t = Math.sqrt((2 * dy) / move.gravity);
    if (Math.abs(bx - ax) > move.speed * t) return false;
    const n = Math.max(4, Math.min(120, Math.ceil(t * 60)));
    for (let i = 0; i <= n; i++) {
      const f = i / n, tt = t * f;
      const x = Math.round(ax + (bx - ax) * f);
      const y = Math.round(ay + (move.gravity * tt * tt) / 2);
      if (y < 0 || y > H || x < 0 || x > W) continue;
      if (blocked[x * stride + y] === 1) return false;
      coverAt(x, y);
    }
    return true;
  };

  for (let head = 0; head < queue.length; head++) {
    const { x: ax, y: ay } = queue[head];
    if (walk) for (const bx of [ax - 1, ax + 1]) {
      if (bx < 0 || bx > W || !stand[bx * stride + ay]) continue;
      const i = bx * stride + ay; if (seen[i]) continue; seen[i] = 1; queue.push({ x: bx, y: ay }); coverAt(bx, ay);
    }
    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const bx = ax + dx; if (bx < 0 || bx > W) continue;
      for (const by of cols[bx]) {
        const i = bx * stride + by; if (seen[i]) continue;
        if (hop(ax, ay, bx, by) || (fall && by > ay && fallArc(ax, ay, bx, by))) {
          seen[i] = 1; queue.push({ x: bx, y: by }); coverAt(bx, by);
        }
      }
    }
  }

  // 完全埋进实心体：把这个目标「可被玩家盒重叠」的所有脚点算出来；全被 blocked 覆盖 ⇒ 不可能碰到。
  const embedded = [];
  const footRectOf = (r) => ({
    x0: Math.floor(r.x - pSize.w / 2), x1: Math.ceil(r.x + r.w + pSize.w / 2),
    y0: Math.floor(r.y), y1: Math.ceil(r.y + r.h + pSize.h),
  });
  for (const [i, t] of targets.entries()) {
    if (covered[i] || !t.rect) continue;
    const { x0, x1, y0, y1 } = footRectOf(t.rect);
    let anyFree = false;
    for (let x = Math.max(0, x0); x <= Math.min(W, x1) && !anyFree; x++)
      for (let y = Math.max(0, y0); y <= Math.min(H, y1); y++)
        if (blocked[x * stride + y] === 0) { anyFree = true; break; }
    embedded.push({ id: t.id, kind: t.kind, anyFreeFoot: anyFree });
  }

  const errors = [];
  for (const [i, t] of targets.entries()) if (!covered[i]) errors.push({ id: t.id, kind: t.kind, embedded: embedded.find((x) => x.id === t.id)?.anyFreeFoot === false });
  return { errors, gaps, targets: targets.length, strict };
}

// 推荐口径的 spawn-in-terrain 诊断：脚点 + 锚点 offset + nearby standable。
function spawnDiagnosis(config, manifest) {
  const { w: W, h: H } = config.world.size;
  const pa = assetOf(manifest, config.player.asset);
  if (!pa) return { gap: "player-asset-missing" };
  const pSize = pa.size;
  const pb = entityBox(config.player.at, pSize, pa.anchor);
  const foot = { x: pb.x + pb.w / 2, y: pb.y + pb.h };
  const anchorOffset = (1 - pa.anchor.y) * pSize.h;
  const solids = config.terrain.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
  for (const e of config.entities) {
    if (e.kind !== "solid") continue;
    const sz = e.body ?? sizeOf(manifest, e.asset); if (!sz) continue;
    solids.push(entityBox(e.at, sz, anchorOf(manifest, e.asset)));
  }
  const stride = H + 1;
  const blocked = new Uint8Array((W + 1) * stride);
  for (const s of solids) {
    const x0 = Math.max(0, Math.floor(s.x - pSize.w / 2) + 1), x1 = Math.min(W, Math.ceil(s.x + s.w + pSize.w / 2) - 1);
    const y0 = Math.max(0, Math.floor(s.y) + 1), y1 = Math.min(H, Math.ceil(s.y + s.h + pSize.h) - 1);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) blocked[x * stride + y] = 1;
  }
  const stand = (x, y) => x >= 0 && x <= W && y >= 0 && y <= H && blocked[x * stride + y] === 0 && y + 1 <= H && blocked[x * stride + y + 1] === 1;
  let terrainHit = null;
  for (const t of config.terrain) {
    if (foot.x > t.x && foot.x < t.x + t.w && foot.y > t.y && foot.y < t.y + t.h) { terrainHit = t; break; }
  }
  let nearbyStand = false;
  if (terrainHit) {
    for (let x = Math.max(0, Math.ceil(foot.x - pSize.w / 2)); x <= Math.min(W, Math.floor(foot.x + pSize.w / 2)) && !nearbyStand; x++)
      for (let y = Math.max(0, Math.ceil(foot.y - pSize.h)); y <= Math.min(H, Math.floor(foot.y)) && !nearbyStand; y++)
        if (stand(x, y)) nearbyStand = true;
  }
  const depth = terrainHit ? foot.y - terrainHit.y : 0;
  const burial = depth - anchorOffset;
  return { foot, anchorOffset, terrainHit, depth, burial, nearbyStand, error: terrainHit !== null && burial > 1 && !nearbyStand };
}

// ── 合成场景 ────────────────────────────────────────────────────────────────
const P = (m, config) => spatial(config, m);
const out = { scenarios: {} };

const runCase = (name, cfg, m = MANIFEST, opts = {}) => {
  const got = P(m, cfg);
  out.scenarios[name] = {
    current: where(auditReachability(cfg, m)),
    next: got.errors.map((e) => `entity "${e.id}"` + (e.embedded ? " (embedded)" : "")),
    gaps: got.gaps,
  };
};

runCase("baseline-last-train", clone());
runCase("gap-200", (() => { const c = clone(); c.terrain = [{ x: 0, y: 250, w: 200, h: 20 }, { x: 400, y: 250, w: 1040, h: 20 }]; return c; })());
runCase("gap-40", (() => { const c = clone(); c.terrain = [{ x: 0, y: 250, w: 600, h: 20 }, { x: 640, y: 250, w: 800, h: 20 }]; return c; })());
runCase("wall-100", (() => { const c = clone(); c.entities.push({ id: "wall", kind: "solid", at: { x: 600, y: 250 }, asset: "prop-luggage-pile", body: { w: 20, h: 100 } }); return c; })());
runCase("wall-40", (() => { const c = clone(); c.entities.push({ id: "wall", kind: "solid", at: { x: 600, y: 250 }, asset: "prop-luggage-pile", body: { w: 20, h: 40 } }); return c; })());
runCase("pickup-120", (() => { const c = clone(); c.entities.find((e) => e.id === "suitcase-2").at = { x: 700, y: 130 }; return c; })());
runCase("pickup-50", (() => { const c = clone(); c.entities.find((e) => e.id === "suitcase-2").at = { x: 700, y: 200 }; return c; })());
runCase("goal-inside-luggage", (() => { const c = clone(); c.entities.find((e) => e.id === "signal").at = { x: 500, y: 250 }; return c; })());
runCase("low-ceiling", (() => {
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
  return c;
})());
runCase("chest-in-pit", (() => {
  const c = clone();
  c.world = { size: { w: 600, h: 270 } };
  c.terrain = [{ x: 0, y: 250, w: 200, h: 20 }, { x: 260, y: 250, w: 340, h: 20 }];
  c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "chest", kind: "chest", at: { x: 300, y: 130 }, asset: "pickup-suitcase", range: 0 },
    { id: "gate", kind: "goal", at: { x: 550, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" };
  return c;
})());
runCase("chest-range-rescues", (() => {
  const c = clone();
  c.world = { size: { w: 600, h: 270 } };
  c.terrain = [{ x: 0, y: 250, w: 300, h: 20 }, { x: 400, y: 250, w: 200, h: 20 }];
  c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "chest", kind: "chest", at: { x: 340, y: 250 }, asset: "pickup-suitcase", range: 20 },
    { id: "gate", kind: "goal", at: { x: 550, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" };
  return c;
})());
runCase("moving-solid-sweep", (() => {
  const c = clone();
  c.world = { size: { w: 1200, h: 270 } };
  c.terrain = [{ x: 0, y: 250, w: 1200, h: 20 }];
  c.player = { ...c.player, at: { x: 40, y: 250 } };
  c.entities = [
    { id: "moving-solid", kind: "solid", at: { x: 600, y: 240 }, asset: "prop-luggage-pile", body: { w: 20, h: 40 },
      motion: { kind: "cycle", axis: "x", distance: 400, periodMs: 4000 } },
    { id: "high-pickup", kind: "pickup", at: { x: 900, y: 100 }, asset: "pickup-suitcase" },
    { id: "gate", kind: "goal", at: { x: 1150, y: 250 }, asset: "signal-endlight" },
  ];
  c.objective = { kind: "collect-then-reach", gate: "gate" };
  return c;
})());
runCase("pickup-inside-luggage", (() => { const c = clone(); c.entities.push({ id: "p-inside", kind: "pickup", at: { x: 500, y: 250 }, asset: "pickup-suitcase" }); return c; })());
runCase("pickup-on-luggage", (() => { const c = clone(); c.entities.push({ id: "p-top", kind: "pickup", at: { x: 500, y: 210 }, asset: "pickup-suitcase" }); return c; })());
{
  const c = clone();
  c.entities.push({ id: "p-body", kind: "pickup", at: { x: 500, y: 250 }, asset: "pickup-suitcase", body: { w: 200, h: 200 } });
  const runtime = spatial(c, MANIFEST, { runtimeBody: true });
  const declared = spatial(c, MANIFEST, { runtimeBody: false });
  out.scenarios["pickup-body-override-inside"] = {
    current: where(auditReachability(c, MANIFEST)),
    next_runtimeGeometry: runtime.errors.map((e) => `entity "${e.id}"`),
    next_declaredBody: declared.errors.map((e) => `entity "${e.id}"`),
    note: "runtime 用帧尺寸（scene.ts:151-155），忽略 e.body；用 body 会漏报",
  };
}
runCase("chest-inside-luggage-range0", (() => {
  const c = clone();
  c.entities.push({ id: "chest-in", kind: "chest", at: { x: 500, y: 250 }, asset: "pickup-suitcase", range: 0 });
  return c;
})());
runCase("chest-inside-luggage-range30", (() => {
  const c = clone();
  c.entities.push({ id: "chest-in", kind: "chest", at: { x: 500, y: 250 }, asset: "pickup-suitcase", range: 30 });
  return c;
})());
runCase("spawn-in-terrain", (() => { const c = clone(); c.player.at = { x: 40, y: 245 }; c.terrain = [{ x: 0, y: 240, w: 1440, h: 30 }]; return c; })());
runCase("spawn-no-foothold", (() => { const c = clone(); c.terrain = [{ x: 400, y: 250, w: 1040, h: 20 }]; return c; })());

// 出生点埋在 terrain 的穿透深度（用玩家盒 vs terrain 盒）
function spawnEmbedding(config, manifest, tol) {
  const pa = assetOf(manifest, config.player.asset);
  if (!pa) return { depth: null, tol };
  const pb = entityBox(config.player.at, pa.size, pa.anchor);
  let depth = 0;
  for (const t of config.terrain) {
    const hx = Math.min(pb.x + pb.w, t.x + t.w) - Math.max(pb.x, t.x);
    if (hx <= 0) continue;
    const pen = Math.min(pb.y + pb.h, t.y + t.h) - Math.max(pb.y, t.y);
    if (pen > depth) depth = pen;
  }
  return { depth, tol };
}
out.spawnToleranceCases = {
  lastTrain: spawnEmbedding(BASE, MANIFEST, 4),
  deeplyBuried: spawnEmbedding((() => { const c = clone(); c.player.at = { x: 40, y: 255 }; c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }]; return c; })(), MANIFEST, 4),
};
out.spawnDx = {
  "shallow-anchor (last-train)": spawnDiagnosis(clone(), MANIFEST),
  "deep-flat (02 probe E: top 240, at 245)": spawnDiagnosis((() => { const c = clone(); c.player.at = { x: 40, y: 245 }; c.terrain = [{ x: 0, y: 240, w: 1440, h: 30 }]; return c; })(), MANIFEST),
  "deep-buried (top 100, at 200)": spawnDiagnosis((() => { const c = clone(); c.player.at = { x: 40, y: 200 }; c.terrain = [{ x: 0, y: 100, w: 600, h: 170 }]; c.world = { size: { w: 600, h: 270 } }; return c; })(), MANIFEST),
  "lateral-wall (1920 corpus shape)": spawnDiagnosis((() => { const c = clone(); c.world = { size: { w: 600, h: 270 } }; c.player.at = { x: 40, y: 248 }; c.terrain = [{ x: 0, y: 250, w: 600, h: 20 }, { x: 0, y: 0, w: 20, h: 250 }]; return c; })(), MANIFEST),
};

console.log(JSON.stringify(out, null, 2));
