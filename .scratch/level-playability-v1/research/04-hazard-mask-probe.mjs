// 04 合成探针 2：把「静态 hazard 当**不可站立的禁区**」而不是 solid，验证方向。
// 只读真夹具；算法镜像 reachability.ts 的脚点网格/跳跃弧模型，加一层 hazardMask。
// 运行：node .scratch/level-playability-v1/research/04-hazard-mask-probe.mjs
import fs from "node:fs";
import path from "node:path";
import { entityBox, FALLBACK_ANCHOR, jumpSpan, maxJumpHeight, parseAssetPack, parseGameConfig, playerMoveOf } from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const M = parseAssetPack(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/packs/last-train/v2/manifest.json"), "utf8"))).value;
const C = parseGameConfig(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/game-configs/last-train.json"), "utf8"))).value;
const sizeOf = (id) => (id ? M.assets.find((a) => a.id === id)?.size : undefined) ?? null;
const anchorOf = (id) => (id ? M.assets.find((a) => a.id === id)?.anchor : undefined) ?? FALLBACK_ANCHOR;
const move = playerMoveOf(C);
const pSize = sizeOf(C.player.asset), pAnchor = anchorOf(C.player.asset);

function reachWithHazardMask(config, { hazardMaskOn = true } = {}) {
  const { w: W, h: H } = config.world.size;
  const solids = config.terrain.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
  const hazardRects = [];
  for (const e of config.entities) {
    if (e.kind !== "solid") continue;
    const s = e.body ?? sizeOf(e.asset); if (!s) continue;
    const b = entityBox(e.at, s, anchorOf(e.asset));
    if (!e.motion) { solids.push(b); continue; }
    const d = e.motion.distance;
    solids.push(e.motion.axis === "x"
      ? { x: Math.min(b.x, b.x + d), y: b.y, w: b.w + Math.abs(d), h: b.h }
      : { x: b.x, y: Math.min(b.y, b.y + d), w: b.w, h: b.h + Math.abs(d) });
  }
  for (const e of config.entities) {
    if (e.kind !== "hazard") continue;
    const s = e.body ?? sizeOf(e.asset); if (!s) continue;
    if (e.motion && hazardMaskOn) continue; // 移动 hazard 不用静态掩码
    hazardRects.push(entityBox(e.at, s, anchorOf(e.asset)));
  }
  const stride = H + 1;
  const blocked = new Uint8Array((W + 1) * stride);
  const hazard = new Uint8Array((W + 1) * stride);
  const fill = (arr, s) => {
    const x0 = Math.max(0, Math.floor(s.x - pSize.w / 2) + 1);
    const x1 = Math.min(W, Math.ceil(s.x + s.w + pSize.w / 2) - 1);
    const y0 = Math.max(0, Math.floor(s.y) + 1);
    const y1 = Math.min(H, Math.ceil(s.y + s.h + pSize.h) - 1);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) arr[x * stride + y] = 1;
  };
  for (const s of solids) fill(blocked, s);
  for (const s of hazardRects) fill(hazard, s);
  const freeAt = new Uint8Array((W + 1) * stride);
  for (let x = 0; x <= W; x++) for (let y = 0; y <= H; y++) {
    const i = x * stride + y;
    freeAt[i] = blocked[i] === 0 && hazard[i] === 0 && y + 1 <= H && blocked[i + 1] === 1 ? 1 : 0;
  }
  const cols = [];
  for (let x = 0; x <= W; x++) { const ys = []; for (let y = 0; y <= H; y++) if (freeAt[x * stride + y] === 1) ys.push(y); cols.push(ys); }
  const gate = config.entities.find((e) => e.kind === "goal" && e.id === config.objective.gate);
  const targets = [...config.entities.filter((e) => e.kind === "pickup").map((e) => ({ id: e.id, at: e.at })), ...(gate ? [{ id: gate.id, at: gate.at }] : [])];
  const covered = targets.map(() => false);
  const covers = (x, y) => { for (const [i, t] of targets.entries()) if (!covered[i] && Math.abs(x - t.at.x) <= pSize.w && Math.abs(y - t.at.y) <= pSize.h) covered[i] = true; };
  const allCovered = () => covered.every(Boolean);
  const apex = maxJumpHeight(move), maxDx = Math.ceil(jumpSpan(move, H));
  const hop = (ax, ay, bx, by) => {
    const dh = ay - by; if (dh > apex || dh < -H) return false;
    const disc = move.jumpVelocity ** 2 - 2 * move.gravity * dh; if (disc < 0) return false;
    const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
    if (Math.abs(bx - ax) > move.speed * t) return false;
    const n = Math.max(6, Math.min(120, Math.ceil(t * 60)));
    for (let i = 0; i <= n; i++) {
      const f = i / n, tt = t * f;
      const x = Math.round(ax + (bx - ax) * f);
      const y = Math.round(ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2));
      if (y < 0 || y > H || x < 0 || x > W) continue;
      if (blocked[x * stride + y] === 1 || hazard[x * stride + y] === 1) return false;
      covers(x, y);
    }
    return true;
  };
  const spawn = { x: C.player.at.x + (0.5 - pAnchor.x) * pSize.w, y: C.player.at.y + (1 - pAnchor.y) * pSize.h };
  const seen = new Uint8Array((W + 1) * stride), queue = [];
  const seedAt = (x, y) => { const i = x * stride + y; if (seen[i]) return; seen[i] = 1; queue.push({ x, y }); covers(x, y); };
  for (let x = Math.max(0, Math.round(spawn.x - pSize.w)); x <= Math.min(W, Math.round(spawn.x + pSize.w)); x++) for (const y of cols[x]) if (y >= spawn.y - pSize.h) seedAt(x, y);
  if (queue.length === 0) return { targets, errs: [] };
  covers(Math.round(spawn.x), Math.round(spawn.y));
  for (let head = 0; head < queue.length && !allCovered(); head++) {
    const { x: ax, y: ay } = queue[head];
    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const bx = ax + dx; if (bx < 0 || bx > W) continue;
      for (const by of cols[bx]) { if (seen[bx * stride + by]) continue; if (!hop(ax, ay, bx, by)) continue; seen[bx * stride + by] = 1; queue.push({ x: bx, y: by }); }
    }
  }
  const errs = targets.filter((_, i) => !covered[i]).map((t) => `entity "${t.id}"`);
  return { targets, errs };
}
const clone = (f) => { const c = structuredClone(C); f(c); return c; };
const staticCarriage = clone((c) => { delete c.entities.find((e) => e.id === "carriage").motion; });
const tallStatic = clone((c) => { const e = c.entities.find((x) => x.id === "carriage"); delete e.motion; e.body = { w: 64, h: 270 }; e.at = { x: 800, y: 270 }; });
const movingCarriage = clone(() => {});
const pickupInStaticHazard = clone((c) => { const e = c.entities.find((x) => x.id === "carriage"); delete e.motion; e.body = { w: 150, h: 120 }; c.entities.find((x) => x.id === "suitcase-2").at = { x: 800, y: 250 }; });
console.log(JSON.stringify({
  base: reachWithHazardMask(C),
  staticCarriage_48px: reachWithHazardMask(staticCarriage),
  tallStaticCarriage_fullHeight: reachWithHazardMask(tallStatic),
  movingCarriage_maskOnForStaticOnly: reachWithHazardMask(movingCarriage),
  pickupInStaticHazard: reachWithHazardMask(pickupInStaticHazard),
}, null, 2));
