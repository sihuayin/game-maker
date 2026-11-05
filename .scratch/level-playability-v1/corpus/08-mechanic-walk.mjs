// 08 机制 A 复核：把 04 的 hop-only 禁区模型加上 03 的 walk 边，看 4 个命中是否消失。
// 只读；零付费。运行：node .scratch/level-playability-v1/corpus/08-mechanic-walk.mjs
import fs from "node:fs";
import path from "node:path";
import { entityBox, FALLBACK_ANCHOR, jumpSpan, maxJumpHeight, playerMoveOf, parseGameConfig } from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const INV = JSON.parse(fs.readFileSync(path.join(ROOT, ".scratch/level-playability-v1/corpus/inventory.json"), "utf8"));
const CASES = [
  ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/game-config.json",
  ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/site/v1/game-config.json",
  ".scratch/p0-02-second-demo-v2/runs/09-probe-hazard/hazard-contact/config.json",
  ".scratch/visual-design-impl-v1/runs/2026-10-25-e2e-v4pro-promptfix/wasteland-scavenger/run/v1/game-config.json",
];
const sizeOf = (m, id) => m.assets.find((a) => a.id === id)?.size ?? null;
const anchorOf = (m, id) => m.assets.find((a) => a.id === id)?.anchor ?? FALLBACK_ANCHOR;

function reachMask(config, M, { walk }) {
  const { w: W, h: H } = config.world.size;
  const move = playerMoveOf(config);
  const pSize = sizeOf(M, config.player.asset), pAnchor = anchorOf(M, config.player.asset);
  if (!pSize) return { errs: [], gaps: ["player-asset-missing"] };
  const solids = config.terrain.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
  const hazardRects = [];
  for (const e of config.entities) {
    if (e.kind === "solid") {
      const s = e.body ?? sizeOf(M, e.asset); if (!s) continue;
      solids.push(entityBox(e.at, s, anchorOf(M, e.asset)));
    }
    if (e.kind === "hazard" && !e.motion) {
      const s = sizeOf(M, e.asset); if (s) hazardRects.push(entityBox(e.at, s, anchorOf(M, e.asset)));
    }
  }
  const stride = H + 1;
  const blocked = new Uint8Array((W + 1) * stride), hazard = new Uint8Array((W + 1) * stride);
  const fill = (arr, s) => {
    const x0 = Math.max(0, Math.floor(s.x - pSize.w / 2) + 1), x1 = Math.min(W, Math.ceil(s.x + s.w + pSize.w / 2) - 1);
    const y0 = Math.max(0, Math.floor(s.y) + 1), y1 = Math.min(H, Math.ceil(s.y + s.h + pSize.h) - 1);
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
  for (let x = 0; x <= W; x++) { const ys = []; for (let y = 0; y <= H; y++) if (freeAt[x * stride + y]) ys.push(y); cols.push(ys); }
  const gate = config.entities.find((e) => e.kind === "goal" && e.id === config.objective.gate);
  const targets = [
    ...config.entities.filter((e) => e.kind === "pickup").map((e) => ({ id: e.id, at: e.at })),
    ...config.entities.filter((e) => e.kind === "chest").map((e) => ({ id: e.id, at: e.at })),
    ...(gate ? [{ id: gate.id, at: gate.at }] : []),
  ];
  const covered = targets.map(() => false);
  const covers = (x, y) => { for (const [i, t] of targets.entries()) if (!covered[i] && Math.abs(x - t.at.x) <= pSize.w && Math.abs(y - t.at.y) <= pSize.h) covered[i] = true; };
  const apex = maxJumpHeight(move), maxDx = Math.ceil(jumpSpan(move, H));
  const hop = (ax, ay, bx, by) => {
    const dh = ay - by; if (dh > apex || dh < -H) return false;
    const disc = move.jumpVelocity ** 2 - 2 * move.gravity * dh; if (disc < 0) return false;
    const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
    if (Math.abs(bx - ax) > move.speed * t) return false;
    const n = Math.max(6, Math.min(120, Math.ceil(t * 60)));
    for (let i = 0; i <= n; i++) {
      const f = i / n, tt = t * f; const x = Math.round(ax + (bx - ax) * f);
      const y = Math.round(ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2));
      if (y < 0 || y > H || x < 0 || x > W) continue;
      if (blocked[x * stride + y] === 1 || hazard[x * stride + y] === 1) return false;
      covers(x, y);
    }
    return true;
  };
  const spawn = { x: config.player.at.x + (0.5 - pAnchor.x) * pSize.w, y: config.player.at.y + (1 - pAnchor.y) * pSize.h };
  const seen = new Uint8Array((W + 1) * stride), queue = [];
  const seedAt = (x, y) => { const i = x * stride + y; if (seen[i]) return; seen[i] = 1; queue.push({ x, y }); covers(x, y); };
  for (let x = Math.max(0, Math.round(spawn.x - pSize.w)); x <= Math.min(W, Math.round(spawn.x + pSize.w)); x++)
    for (const y of cols[x]) if (y >= spawn.y - pSize.h) seedAt(x, y);
  if (queue.length === 0) return { errs: [], gaps: ["spawn-no-foothold"] };
  covers(Math.round(spawn.x), Math.round(spawn.y));
  for (let head = 0; head < queue.length; head++) {
    const { x: ax, y: ay } = queue[head];
    if (walk) {
      for (const bx of [ax - 1, ax + 1]) {
        if (bx < 0 || bx > W || !freeAt[bx * stride + ay]) continue;
        const i = bx * stride + ay; if (seen[i]) continue; seen[i] = 1; queue.push({ x: bx, y: ay }); covers(bx, ay);
      }
    }
    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const bx = ax + dx; if (bx < 0 || bx > W) continue;
      for (const by of cols[bx]) {
        const i = bx * stride + by; if (seen[i]) continue;
        if (!hop(ax, ay, bx, by)) continue;
        seen[i] = 1; queue.push({ x: bx, y: by }); covers(bx, by);
      }
    }
  }
  return { errs: targets.filter((_, i) => !covered[i]).map((t) => `entity "${t.id}"`), gaps: [] };
}

const out = [];
for (const rel of CASES) {
  const cfgEntry = INV.configs.find((c) => c.path === rel);
  if (!cfgEntry) { out.push({ path: rel, error: "not in inventory" }); continue; }
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  const parsed = parseGameConfig(raw);
  if (!parsed.ok) { out.push({ path: rel, error: "config parse failed" }); continue; }
  const manPath = cfgEntry.auditManifest;
  const manRaw = JSON.parse(fs.readFileSync(path.join(ROOT, manPath), "utf8"));
  const M = { assets: manRaw.assets.filter((a) => a && typeof a === "object" && typeof a.id === "string") };
  const hopOnly = reachMask(parsed.value, M, { walk: false });
  const withWalk = reachMask(parsed.value, M, { walk: true });
  out.push({ path: rel, manifest: manPath, staticHazards: parsed.value.entities.filter((e) => e.kind === "hazard" && !e.motion).map((e) => e.id), hopOnly: hopOnly.errs, withWalk: withWalk.errs, gaps: withWalk.gaps });
}
console.log(JSON.stringify({ cases: out }, null, 2));
