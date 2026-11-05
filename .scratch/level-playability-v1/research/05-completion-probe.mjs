// 05 关卡完成性探针（E3，零付费、只读）。不写生产代码、不调上游。
// 运行：node .scratch/level-playability-v1/research/05-completion-probe.mjs
// 用途：
//   1) 在历史语料 96 个配对（20 份唯一 config）上，按「必需 pickup/chest + gate」跑完成性分析；
//   2) 在 last-train 真夹具上做合成正/负例，验证判据会响且合法边界不误伤。
//
// 本脚本**不是**生产实现：它把 `auditReachability` 的移动上界（跳跃弧 + 落脚点 + 脚点）
// 原样搬过来，只额外记录「每次跳跃/每个落脚点收了哪些目标」，再做完成性 DP。
// ⚠️ 它没有 walk 边 / 没有 air-control 反向 / 没有 hazard 时序 —— 这些边界写进报告，不在这里补。

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  FALLBACK_ANCHOR, entityBox, jumpSpan, maxJumpHeight, parseAssetPack, parseGameConfig, playerMoveOf,
} from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SKIP = new Set(["node_modules", ".git", "dist", ".vite", "coverage"]);
const JSON_DIRS = ["out", "fixtures", ".scratch", "packages/demo/fixtures"];
const CAP_K = 12; // 超过这个目标数，完成顺序退回 INSUFFICIENT_EVIDENCE（报告 §4）

const walk = (dir, out) => {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const d of ents) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { if (!SKIP.has(d.name)) walk(p, out); }
    else if (d.isFile() && d.name.endsWith(".json")) out.push(p);
  }
};

const sizeOfAsset = (manifest, id) => manifest.assets.find((a) => a.id === id)?.size ?? null;
const anchorOfAsset = (manifest, id) => manifest.assets.find((a) => a.id === id)?.anchor ?? FALLBACK_ANCHOR;
const intersects = (a, b) => a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;

/** 玩家脚点 (x,y) 的 body 盒；与 `scene.ts` 的 arcade body 同几何。 */
const playerRect = (x, y, pw, ph) => ({ x: x - pw / 2, y: y - ph, w: pw, h: ph });

/** 运行时的目标盒：
 *  - pickup / goal：`physics.add.existing(sprite, true)` 用**帧尺寸 + 锚点**，忽略 `body`（S7）；
 *  - chest：不进 physics，`advanceChests` 用 `e.box`（= body ?? 帧尺寸）外扩 `range`。
 *  ⚠️ 这是「收集判定」的几何，不是 `auditReachability.covers` 的宽松 |dx|/|dy|。
 */
function targetRect(e, manifest) {
  const assetSize = sizeOfAsset(manifest, e.asset);
  const anchor = anchorOfAsset(manifest, e.asset);
  if (e.kind === "chest") {
    const s = e.body ?? assetSize;
    if (s === null) return null;
    const box = entityBox(e.at, s, anchor);
    const r = e.range ?? 0;
    return { x: box.x - r, y: box.y - r, w: box.w + 2 * r, h: box.h + 2 * r };
  }
  // pickup / goal：runtime physics body = 帧尺寸，`e.body` 被忽略。
  if (assetSize === null) return null;
  return entityBox(e.at, assetSize, anchor);
}

/**
 * 在一个 config 上做完成性分析。返回可 JSON 化的诊断，不抛。
 */
export function analyzeCompletion(config, manifest, opts = {}) {
  const { w: W, h: H } = config.world.size;
  const move = playerMoveOf(config);
  const pSize = sizeOfAsset(manifest, config.player.asset);
  if (pSize === null) return { skipped: "player-asset-missing" };
  const pAnchor = anchorOfAsset(manifest, config.player.asset);

  // ── 实心体：与 reachability.ts 完全一致（terrain + solid；solid.motion 用整段行程）──
  const solids = config.terrain.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
  for (const e of config.entities) {
    if (e.kind !== "solid") continue;
    const s = e.body ?? sizeOfAsset(manifest, e.asset);
    if (s === null) continue;
    const b = entityBox(e.at, s, anchorOfAsset(manifest, e.asset));
    if (!e.motion) { solids.push(b); continue; }
    const d = e.motion.distance;
    solids.push(e.motion.axis === "x"
      ? { x: Math.min(b.x, b.x + d), y: b.y, w: b.w + Math.abs(d), h: b.h }
      : { x: b.x, y: Math.min(b.y, b.y + d), w: b.w, h: b.h + Math.abs(d) });
  }

  // ── hazard / danger 的**复位接触区**（完成性专用，不是 reachability 的实心体）──
  //   runtime：hazard 接触 → 复位到出生点，`collected` 保留（scene.ts:342-362）。
  //   ⇒ 对完成性来说，任何可达的 hazard/danger 接触都是「回出生点」的边；忽略它会误报
  //     「掉进坑里收完东西回不来」的合法设计（见 synthetic case 15）。
  //   ⚠️ hazard 的 physics body 用帧尺寸（`body` 被忽略，S7）；danger 用 `e.box`（body 生效）。
  //   带 motion 的 hazard 取**整段行程**作为可接触区（玩家可以等它经过）。
  const resetRects = [];
  for (const e of config.entities) {
    if (e.kind === "hazard") {
      const s0 = sizeOfAsset(manifest, e.asset);
      if (s0 === null) continue;
      const b = entityBox(e.at, s0, anchorOfAsset(manifest, e.asset));
      if (!e.motion) { resetRects.push(b); continue; }
      const d = e.motion.distance;
      resetRects.push(e.motion.axis === "x"
        ? { x: Math.min(b.x, b.x + d), y: b.y, w: b.w + Math.abs(d), h: b.h }
        : { x: b.x, y: Math.min(b.y, b.y + d), w: b.w, h: b.h + Math.abs(d) });
    } else if (e.kind === "danger") {
      const s0 = e.body ?? sizeOfAsset(manifest, e.asset);
      if (s0 === null) continue;
      resetRects.push(entityBox(e.at, s0, anchorOfAsset(manifest, e.asset)));
      // danger 总有一个 active 窗口（strike 保证 periodMs/activeMs > 0）⇒ 接触可等。
    }
  }
  const resetShadows = resetRects.map((r) => ({ x: r.x - pSize.w / 2, y: r.y, w: r.w + pSize.w, h: r.h + pSize.h }));

  const stride = H + 1;
  const blocked = new Uint8Array((W + 1) * stride);
  for (const s of solids) {
    const x0 = Math.max(0, Math.floor(s.x - pSize.w / 2) + 1);
    const x1 = Math.min(W, Math.ceil(s.x + s.w + pSize.w / 2) - 1);
    const y0 = Math.max(0, Math.floor(s.y) + 1);
    const y1 = Math.min(H, Math.ceil(s.y + s.h + pSize.h) - 1);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) blocked[x * stride + y] = 1;
  }
  const freeAt = new Uint8Array((W + 1) * stride);
  for (let x = 0; x <= W; x++)
    for (let y = 0; y <= H; y++) {
      const i = x * stride + y;
      freeAt[i] = blocked[i] === 0 && y + 1 <= H && blocked[i + 1] === 1 ? 1 : 0;
    }
  const cols = [];
  for (let x = 0; x <= W; x++) {
    const ys = [];
    for (let y = 0; y <= H; y++) if (freeAt[x * stride + y] === 1) ys.push(y);
    cols.push(ys);
  }

  const footOf = (at, size, anchor) => ({
    x: at.x + (0.5 - anchor.x) * size.w,
    y: at.y + (1 - anchor.y) * size.h,
  });
  const spawn = footOf(config.player.at, pSize, pAnchor);

  // ── 目标：必需收集物 = pickup + chest；gate 是终局目标（不计入必需收集位）──
  const declaredCollectables = config.entities.filter((e) => e.kind === "pickup" || e.kind === "chest").length;
  const collectables = config.entities
    .filter((e) => e.kind === "pickup" || e.kind === "chest")
    .map((e, i) => ({ id: e.id, kind: e.kind, index: i, rect: targetRect(e, manifest) }))
    .filter((t) => t.rect !== null);
  const gateEntity = config.entities.find((e) => e.kind === "goal" && e.id === config.objective.gate);
  const gateRect = gateEntity ? targetRect(gateEntity, manifest) : null;
  const k = collectables.length;
  const full = k === 0 ? 0 : (1 << k) - 1;

  // 影子目标盒 → 只用于 bbox 预筛（避免每条弧都对所有目标逐采样点判定）
  const shadow = (r) => ({ x: r.x - pSize.w / 2, y: r.y, w: r.w + pSize.w, h: r.h + pSize.h });
  const targetShadows = collectables.map((t) => shadow(t.rect));
  const gateShadow = gateRect ? shadow(gateRect) : null;

  const nodeIndex = new Map();
  const nodeX = [], nodeY = [];
  const nodeCollect = []; // bitset：站在该落脚点即可收集的必需目标
  const adj = [];         // { b, s }：s = 该次有效跳跃顺路收集的必需目标 bitset（含落点 N(b)）
  let edgeCount = 0;
  const gatePre = [];     // 可在该落脚点起跳/站立时碰到 gate
  const resetNodes = [];  // 可在该落脚点接触 hazard/danger（→ 复位到出生点，计数保留）
  let spawnGate = false;

  const ensureNode = (x, y) => {
    const key = x * stride + y;
    let idx = nodeIndex.get(key);
    if (idx !== undefined) return idx;
    idx = nodeX.length;
    nodeIndex.set(key, idx);
    nodeX.push(x); nodeY.push(y);
    adj.push([]);
    let bits = 0;
    const pr = playerRect(x, y, pSize.w, pSize.h);
    for (const t of collectables) if (intersects(pr, t.rect)) bits |= 1 << t.index;
    nodeCollect.push(bits);
    if (gateRect && intersects(pr, gateRect)) gatePre.push(idx);
    if (resetRects.some((r) => intersects(pr, r))) resetNodes.push(idx);
    return idx;
  };

  // 出生点本身的收集/终局重叠（可能落在非落脚点上）
  let spawnBits = 0;
  {
    const pr = playerRect(spawn.x, spawn.y, pSize.w, pSize.h);
    for (const t of collectables) if (intersects(pr, t.rect)) spawnBits |= 1 << t.index;
    if (gateRect && intersects(pr, gateRect)) spawnGate = true;
  }

  const apex = maxJumpHeight(move);
  const maxDx = Math.ceil(jumpSpan(move, H));

  /** 有效跳跃 a→b：返回顺路收集的目标 bitset；撞实心体返回 null。 */
  const hop = (ax, ay, bx, by) => {
    const dh = ay - by;
    if (dh > apex) return null;
    if (dh < -H) return null;
    const disc = move.jumpVelocity ** 2 - 2 * move.gravity * dh;
    if (disc < 0) return null;
    const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
    if (Math.abs(bx - ax) > move.speed * t) return null;
    const n = Math.max(6, Math.min(120, Math.ceil(t * 60)));

    // 弧的脚点包围盒 —— 只在有目标盒与它相交时才逐采样点判定目标。
    const footYAt = (tt) => ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2);
    const yApex = move.jumpVelocity / move.gravity;
    const ys = [footYAt(0), footYAt(t)];
    if (yApex > 0 && yApex < t) ys.push(footYAt(yApex));
    const arc = {
      x: Math.min(ax, bx), y: Math.min(...ys),
      w: Math.abs(bx - ax), h: Math.max(...ys) - Math.min(...ys),
    };
    const candidates = [];
    for (const [i, sh] of targetShadows.entries()) if (intersects(arc, sh)) candidates.push(collectables[i]);
    if (gateShadow && intersects(arc, gateShadow)) candidates.push({ gate: true });
    const resetCandidates = resetShadows
      .map((sh, i) => (intersects(arc, sh) ? resetRects[i] : null))
      .filter((r) => r !== null);

    let bits = 0;
    let hitGate = false;
    let hitReset = false;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const tt = t * f;
      const x = Math.round(ax + (bx - ax) * f);
      const y = Math.round(ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2));
      if (y < 0 || y > H || x < 0 || x > W) continue;
      if (blocked[x * stride + y] === 1) return null;
      if (candidates.length > 0) {
        const pr = playerRect(x, y, pSize.w, pSize.h);
        for (const c of candidates) {
          if (c.gate) { if (intersects(pr, gateRect)) hitGate = true; }
          else if (intersects(pr, c.rect)) bits |= 1 << c.index;
        }
        if (!hitReset) for (const r of resetCandidates) if (intersects(pr, r)) { hitReset = true; break; }
      }
    }
    return { bits, hitGate, hitReset };
  };

  // ── 全图 BFS：与 reachability 的种子一致，但**不因目标收齐而提前停** ──
  const seen = new Uint8Array((W + 1) * stride);
  const queue = [];
  const seeds = [];
  const seedAt = (x, y) => {
    const i = x * stride + y;
    if (seen[i] === 1) return;
    seen[i] = 1;
    const idx = ensureNode(x, y);
    seeds.push(idx);
    queue.push(idx);
  };
  for (let x = Math.max(0, Math.round(spawn.x - pSize.w)); x <= Math.min(W, Math.round(spawn.x + pSize.w)); x++)
    for (const y of cols[x]) if (y >= spawn.y - pSize.h) seedAt(x, y);
  if (queue.length === 0) {
    return {
      id: opts.id, skipped: "no-spawn-footing",
      k, kChest: collectables.filter((t) => t.kind === "chest").length,
    };
  }

  // 逐节点枚举全部出边（包括指向已发现节点的回边）—— completion 需要完整有向图。
  for (let head = 0; head < queue.length; head++) {
    const a = queue[head];
    const ax = nodeX[a], ay = nodeY[a];
    const out = adj[a];
    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const bx = ax + dx;
      if (bx < 0 || bx > W) continue;
      for (const by of cols[bx]) {
        const r = hop(ax, ay, bx, by);
        if (r === null) continue;
        const b = ensureNode(bx, by);
        const s = r.bits | nodeCollect[b];
        out.push({ b, s });
        if (r.hitGate) { gatePre.push(a); gatePre.push(b); }
        if (r.hitReset) resetNodes.push(a);
        edgeCount++;
        if (seen[bx * stride + by] !== 1) {
          // 节点已在 ensureNode 里登记；用独立 seen 标记是否入队。
          seen[bx * stride + by] = 1;
          queue.push(b);
        }
      }
    }
  }
  const nodeCount = nodeX.length;
  // 复位边：可达的 hazard/danger 接触 → 出生点落脚点，mask 不变（collected 保留）。
  for (const a of new Set(resetNodes)) for (const b of seeds) adj[a].push({ b, s: 0 });
  const gatePreSet = [...new Set(gatePre)];
  const seedBits = spawnBits | seeds.reduce((m, i) => m | nodeCollect[i], 0);

  // ── 每个必需目标的「可收集」判定（存在可达节点/出边就能收）──
  const collectable = new Array(k).fill(false);
  for (const i of seeds) if (nodeCollect[i]) for (let t = 0; t < k; t++) if (nodeCollect[i] & (1 << t)) collectable[t] = true;
  for (let a = 0; a < nodeCount; a++) {
    if (nodeCollect[a]) for (let t = 0; t < k; t++) if (nodeCollect[a] & (1 << t)) collectable[t] = true;
    for (const e of adj[a]) if (e.s) for (let t = 0; t < k; t++) if (e.s & (1 << t)) collectable[t] = true;
  }
  const unreachable = collectables.filter((t) => !collectable[t.index]).map((t) => ({ id: t.id, kind: t.kind }));

  // ── 完成性 DP：R[mask] = 在某条已收 mask 的走法之后可能站到的落脚点集合 ──
  // ⚠️ 这是**完成可能性的上界**：R 把不同顺序的落点并在一起（会漏报，不会误报）。
  //    对「证明不可玩」是安全方向。
  const reachableMasks = new Map();
  let dp = { status: "unchecked", reason: "too-many-targets" };
  if (k <= CAP_K) {
    const masks = full + 1;
    const R = Array.from({ length: masks }, () => null);
    const startMask = seedBits;
    R[startMask] = new Uint8Array(nodeCount);
    for (const i of seeds) R[startMask][i] = 1;
    let fullReach = null;

    for (let mask = 0; mask < masks; mask++) {
      // 升序不一定按 popcount；用迭代到不动点处理同 mask 内由「已收目标」边带来的移动。
      let changed = true;
      // 闭包：只走「不会新增目标」的边（s ⊆ mask）。
      while (changed) {
        changed = false;
        const arr = R[mask];
        if (arr === null) break;
        for (let a = 0; a < nodeCount; a++) {
          if (arr[a] !== 1) continue;
          for (const e of adj[a]) {
            if ((e.s & ~mask) !== 0) continue;
            if (arr[e.b] !== 1) { arr[e.b] = 1; changed = true; }
          }
        }
      }
      const arr = R[mask];
      if (arr === null) continue;
      reachableMasks.set(mask, arr.reduce((n, v) => n + v, 0));
      if ((mask & full) === full) {
        fullReach = gatePreSet.some((i) => arr[i] === 1) || (spawnGate && mask === startMask);
        continue;
      }
      // 转移：走一条会新增目标的边。
      for (let a = 0; a < nodeCount; a++) {
        if (arr[a] !== 1) continue;
        for (const e of adj[a]) {
          if ((e.s & ~mask) === 0) continue;
          const nm = mask | (e.s & full);
          if (nm === mask) continue;
          if (R[nm] === null) R[nm] = new Uint8Array(nodeCount);
          R[nm][e.b] = 1;
        }
      }
    }
    dp = fullReach === null
      ? { status: "no-walk", reason: "no-order-visits-all" }
      : fullReach
        ? { status: "completable" }
        : { status: "no-walk", reason: "gate-not-reachable-after-collection" };
  }

  return {
    id: opts.id,
    world: { w: W, h: H },
    player: pSize,
    k,
    kChest: collectables.filter((t) => t.kind === "chest").length,
    declaredCollectables,
    skippedTargets: declaredCollectables - collectables.length,
    nodeCount, edgeCount,
    gate: gateEntity ? gateEntity.id : null,
    gatePreCount: gatePreSet.length,
    spawnBits,
    unreachable,
    collectable: collectables.map((t) => ({ id: t.id, kind: t.kind, ok: collectable[t.index] })),
    dp,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 语料扫描（与 02-corpus-scan.mjs 相同的配对口径；只跑唯一配对）
// ─────────────────────────────────────────────────────────────────────────────
function corpus() {
  const files = [];
  for (const d of JSON_DIRS) walk(path.join(ROOT, d), files);
  const configs = [], manifests = [];
  for (const f of files) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
    if (raw === null || typeof raw !== "object") continue;
    if (raw.format === "game-config/v1") configs.push({ file: f, raw });
    if (raw.format === "assetpack/v1" || (Array.isArray(raw.assets) && raw.id !== undefined && raw.version !== undefined && raw.files !== undefined)) {
      if (Array.isArray(raw.assets)) manifests.push({ file: f, value: { ...raw, assets: raw.assets.filter((a) => a !== null && typeof a === "object" && typeof a.id === "string") } });
    }
  }
  const sha = (v) => "sha256:" + crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
  const refsOf = (c) => {
    const ids = new Set([c.player.asset, c.scene.background.asset, c.hud.panel.asset, c.hud.pip.asset]);
    for (const e of c.entities) ids.add(e.asset);
    return ids;
  };
  const covers = (m, ids) => {
    const have = new Set(m.assets.map((a) => a.id));
    for (const id of ids) if (!have.has(id)) return false;
    return true;
  };
  const versionOfFile = (p) => {
    const m = /\/v(\d+)\/manifest\.json$/.exec(p.split(path.sep).join("/"));
    return m ? Number(m[1]) : 0;
  };
  const candidatesFor = (file) => {
    const dirs = [];
    let d = path.dirname(file);
    for (let i = 0; i < 4; i++) { dirs.push(d); d = path.dirname(d); }
    const packing = [];
    for (const root of dirs) {
      const packRoot = path.join(root, "pack");
      let vs = [];
      try { vs = fs.readdirSync(packRoot); } catch {}
      for (const v of vs) {
        const mp = path.join(packRoot, v, "manifest.json");
        if (fs.existsSync(mp)) {
          const hit = manifests.find((x) => x.file === mp);
          if (hit) packing.push(hit);
        }
      }
      for (const rel of ["manifest.json", "pack/manifest.json"]) {
        const mp = path.join(root, rel);
        const hit = manifests.find((x) => x.file === mp);
        if (hit) packing.push(hit);
      }
    }
    return packing.sort((a, b) => versionOfFile(b.file) - versionOfFile(a.file));
  };

  const out = [];
  const seenPair = new Set();
  for (const c of configs) {
    const parsed = parseGameConfig(c.raw);
    if (!parsed.ok) continue;
    const config = parsed.value;
    const ids = refsOf(config);
    const cands = candidatesFor(c.file);
    let manifest = cands.find((m) => covers(m.value, ids));
    if (!manifest) {
      const common = (a, b) => {
        const aa = a.split(path.sep), bb = b.split(path.sep);
        let i = 0; while (i < aa.length && i < bb.length && aa[i] === bb[i]) i += 1;
        return i;
      };
      manifest = manifests.filter((m) => covers(m.value, ids))
        .sort((a, b) => common(b.file, c.file) - common(a.file, c.file))[0];
    }
    if (!manifest) continue;
    // 与 02-corpus-scan.mjs 同一去重口径：config 内容 hash + manifest 文件。
    const key = sha(config) + "|" + manifest.file;
    if (seenPair.has(key)) continue;
    seenPair.add(key);
    const t0 = Date.now();
    const res = analyzeCompletion(config, manifest.value, { id: path.relative(ROOT, c.file) });
    res.manifest = path.relative(ROOT, manifest.file);
    res.configHash = sha(config);
    res.ms = Date.now() - t0;
    out.push(res);
    process.stderr.write(`[${out.length}] ${res.id} k=${res.k} nodes=${res.nodeCount ?? "-"} edges=${res.edgeCount ?? "-"} dp=${res.dp?.status ?? res.skipped} ${res.ms}ms\n`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 合成正/负例（last-train 真夹具 + 一处改动）
// ─────────────────────────────────────────────────────────────────────────────
function synthetic() {
  const manifest = parseAssetPack(JSON.parse(fs.readFileSync(`${ROOT}/fixtures/packs/last-train/v2/manifest.json`, "utf8"))).value;
  const base = parseGameConfig(JSON.parse(fs.readFileSync(`${ROOT}/fixtures/game-configs/last-train.json`, "utf8"))).value;
  const clone = () => structuredClone(base);
  const player = manifest.assets.find((a) => a.id === base.player.asset);
  const playerAtForFoot = (foot) => ({
    x: foot.x - (0.5 - player.anchor.x) * player.size.w,
    y: foot.y - (1 - player.anchor.y) * player.size.h,
  });
  const cases = [];
  const add = (id, expect, c) => cases.push({ id, expect, result: analyzeCompletion(c, manifest, { id }) });

  // 0. 真夹具：通的
  add("baseline-last-train", "completable", clone());

  // 1. 单向坑（02 probe B）：从出生点每个目标都够得到，但拿到坑里的 pickup 后回不到 gate。
  {
    const c = clone();
    c.world = { size: { w: 480, h: 270 } };
    c.terrain = [
      { x: 0, y: 150, w: 300, h: 20 },
      { x: 340, y: 150, w: 140, h: 20 },
      { x: 300, y: 250, w: 40, h: 20 },
    ];
    c.player = { ...c.player, at: { x: 40, y: 150 } };
    c.entities = [
      { id: "pit-pickup", kind: "pickup", at: { x: 320, y: 250 }, asset: "pickup-suitcase" },
      { id: "gate", kind: "goal", at: { x: 440, y: 150 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("one-way-pit-pickup", "no-walk", c);
  }

  // 2. 坑底 chest：能开，但开完回不到 gate。
  {
    const c = clone();
    c.world = { size: { w: 480, h: 270 } };
    c.terrain = [
      { x: 0, y: 150, w: 300, h: 20 },
      { x: 340, y: 150, w: 140, h: 20 },
      { x: 300, y: 250, w: 40, h: 20 },
    ];
    c.player = { ...c.player, at: { x: 40, y: 150 } };
    c.entities = [
      { id: "pit-chest", kind: "chest", at: { x: 320, y: 250 }, asset: "pickup-suitcase", range: 0 },
      { id: "gate", kind: "goal", at: { x: 440, y: 150 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("one-way-pit-chest", "no-walk", c);
  }

  // 3. chest 被实心体完全包住（且 range=0）—— 永远 overlap 不到。
  {
    const c = clone();
    c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }];
    c.player = { ...c.player, at: { x: 40, y: 250 } };
    c.entities = [
      { id: "vault", kind: "solid", at: { x: 700, y: 250 }, asset: "prop-luggage-pile", body: { w: 120, h: 80 } },
      { id: "sealed-chest", kind: "chest", at: { x: 700, y: 250 }, asset: "pickup-suitcase", range: 0 },
      { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("chest-sealed-in-solid", "unreachable", c);
  }

  // 4. 合法边界：chest 在墙后，但 `range` 足够大 ⇒ 运行时隔墙也能开（无 LoS 要求）。
  {
    const c = clone();
    c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }];
    c.player = { ...c.player, at: { x: 40, y: 250 } };
    c.entities = [
      { id: "wall", kind: "solid", at: { x: 700, y: 250 }, asset: "prop-luggage-pile", body: { w: 20, h: 120 } },
      { id: "behind-wall-chest", kind: "chest", at: { x: 740, y: 250 }, asset: "pickup-suitcase", range: 60 },
      { id: "gate", kind: "goal", at: { x: 300, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("chest-behind-wall-with-range", "completable", c);
  }

  // 5. 合法边界：chest 悬空，只能跳起来穿过交互区（不要求「站得住」）。
  {
    const c = clone();
    c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }];
    c.player = { ...c.player, at: { x: 40, y: 250 } };
    c.entities = [
      { id: "air-chest", kind: "chest", at: { x: 300, y: 210 }, asset: "pickup-suitcase", range: 0 },
      { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("chest-midair-jumpthrough", "completable", c);
  }

  // 6. 两个 pickup 在两条互不连通的单向坑里：各自可达，但一次游玩收不齐。
  {
    const c = clone();
    c.world = { size: { w: 560, h: 270 } };
    c.terrain = [
      { x: 0, y: 150, w: 100, h: 20 },     // 出生平台
      { x: 100, y: 250, w: 80, h: 20 },    // 左坑底（深 100）
      { x: 180, y: 150, w: 20, h: 120 },   // 两坑之间的隔墙
      { x: 200, y: 250, w: 80, h: 20 },    // 右坑底（深 100）
      { x: 340, y: 150, w: 140, h: 20 },   // gate 平台（比坑高 100）
    ];
    c.player = { ...c.player, at: { x: 40, y: 150 } };
    c.entities = [
      { id: "left-pickup", kind: "pickup", at: { x: 140, y: 250 }, asset: "pickup-suitcase" },
      { id: "right-pickup", kind: "pickup", at: { x: 240, y: 250 }, asset: "pickup-suitcase" },
      { id: "gate", kind: "goal", at: { x: 460, y: 150 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("two-one-way-branches", "no-walk", c);
  }

  // 7. 合法边界：两个 pickup 同一次跳跃就能一起收（同一弧线）—— 不应误报「顺序不可满足」。
  {
    const c = clone();
    c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }];
    c.player = { ...c.player, at: { x: 40, y: 250 } };
    c.entities = [
      { id: "arc-a", kind: "pickup", at: { x: 300, y: 220 }, asset: "pickup-suitcase" },
      { id: "arc-b", kind: "pickup", at: { x: 330, y: 220 }, asset: "pickup-suitcase" },
      { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("two-pickups-one-arc", "completable", c);
  }

  // 8. gate 埋在实心体内部（现有 covers 会放行；完成性 overlap 模型应报不可完成）。
  {
    const c = clone();
    c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }];
    c.player = { ...c.player, at: { x: 40, y: 250 } };
    c.entities = [
      { id: "suitcase-1", kind: "pickup", at: { x: 300, y: 250 }, asset: "pickup-suitcase" },
      { id: "vault", kind: "solid", at: { x: 700, y: 250 }, asset: "prop-luggage-pile", body: { w: 120, h: 120 } },
      { id: "gate", kind: "goal", at: { x: 700, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("gate-sealed-in-solid", "no-walk", c);
  }

  // 9. 合法边界：gate 悬空，跳起来穿过也算到（不要求站得住）。
  {
    const c = clone();
    c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }];
    c.player = { ...c.player, at: { x: 40, y: 250 } };
    c.entities = [
      { id: "suitcase-1", kind: "pickup", at: { x: 300, y: 250 }, asset: "pickup-suitcase" },
      { id: "gate", kind: "goal", at: { x: 700, y: 210 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("gate-midair-jumpthrough", "completable", c);
  }

  // 10. 低天花板走廊（02 probe F）：现有图本身误报 —— 完成性判据会继承这个误报。
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
    add("low-ceiling-walkable", "completable(true-design)", c);
  }

  // 11. pickup 带 `body` 覆盖，但 runtime 忽略它（S7）：视觉上更大，判定必须按帧尺寸。
  {
    const c = clone();
    c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }];
    c.player = { ...c.player, at: { x: 40, y: 250 } };
    c.entities = [
      { id: "pickup-body-override", kind: "pickup", at: { x: 300, y: 250 }, asset: "pickup-suitcase", body: { w: 400, h: 16 } },
      { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("pickup-body-override-runtime-ignores", "completable", c);
  }

  // 12. 合法边界：同样是「掉下去就上不来」的坑，但 gate 就在坑底同一层 ⇒ 完成顺序存在。
  {
    const c = clone();
    c.world = { size: { w: 480, h: 270 } };
    c.terrain = [
      { x: 0, y: 150, w: 300, h: 20 },     // 出生平台
      { x: 300, y: 250, w: 180, h: 20 },   // 坑底（深 100，上来不）
    ];
    c.player = { ...c.player, at: { x: 40, y: 150 } };
    c.entities = [
      { id: "pit-pickup", kind: "pickup", at: { x: 320, y: 250 }, asset: "pickup-suitcase" },
      { id: "gate", kind: "goal", at: { x: 460, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("one-way-pit-gate-on-pit-floor", "completable", c);
  }

  // 13. 合法边界：必须先上高台收 A、再掉到低层收 B 并到 gate —— 顺序存在，不应误报。
  {
    const c = clone();
    c.world = { size: { w: 640, h: 270 } };
    c.terrain = [
      { x: 0, y: 150, w: 200, h: 20 },     // 出生平台
      { x: 200, y: 100, w: 60, h: 20 },    // 高台（高 50，跳得上）
      { x: 300, y: 250, w: 340, h: 20 },   // 低层（从高台掉下去）
    ];
    c.player = { ...c.player, at: { x: 40, y: 150 } };
    c.entities = [
      { id: "high-pickup", kind: "pickup", at: { x: 230, y: 100 }, asset: "pickup-suitcase" },
      { id: "low-pickup", kind: "pickup", at: { x: 400, y: 250 }, asset: "pickup-suitcase" },
      { id: "gate", kind: "goal", at: { x: 600, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("order-required-high-then-low", "completable", c);
  }

  // 14. 合法边界：chest 在 moving solid 的**扫过行程**里、但不在它的静态初始盒里。
  //     runtime 的 solid 从不推进 motion（scene.ts:149-150）；现有 reachability 把整段行程当实心（S5）。
  //     期望：completable（运行时静态体不挡 chest）。
  {
    const c = clone();
    c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }];
    c.player = { ...c.player, at: { x: 40, y: 250 } };
    c.entities = [
      { id: "sweeping-solid", kind: "solid", at: { x: 600, y: 250 }, asset: "prop-luggage-pile",
        body: { w: 20, h: 40 }, motion: { kind: "cycle", axis: "x", distance: 400, periodMs: 4000 } },
      { id: "chest-in-sweep", kind: "chest", at: { x: 900, y: 250 }, asset: "pickup-suitcase", range: 0 },
      { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("chest-inside-moving-solid-sweep", "completable", c);
  }

  // 15. 合法边界：坑底 chest + 坑底 hazard —— 收完被复位回出生点，计数保留，再去 gate。
  //     忽略 hazard 复位边的完成性模型会误报「回不来」。
  {
    const c = clone();
    c.world = { size: { w: 480, h: 270 } };
    c.terrain = [
      { x: 0, y: 150, w: 300, h: 20 },     // 出生平台（gate 在这边）
      { x: 300, y: 250, w: 180, h: 20 },   // 坑底
    ];
    c.player = { ...c.player, at: { x: 40, y: 150 } };
    c.entities = [
      { id: "pit-chest", kind: "chest", at: { x: 320, y: 250 }, asset: "pickup-suitcase", range: 0 },
      { id: "pit-hazard", kind: "hazard", at: { x: 420, y: 250 }, asset: "hazard-sweeping-carriage" },
      { id: "gate", kind: "goal", at: { x: 260, y: 150 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("pit-chest-with-reset-hazard", "completable", c);
  }

  // 16. 合法边界：chest 与 hazard 重叠 —— 开箱后立刻被复位，计数保留，仍能去 gate。
  //     「被机制封死」不是完成性阻断：hazard/danger 不阻挡、只复位。
  {
    const c = clone();
    c.terrain = [{ x: 0, y: 250, w: 1440, h: 20 }];
    c.player = { ...c.player, at: { x: 40, y: 250 } };
    c.entities = [
      { id: "chest-on-hazard", kind: "chest", at: { x: 700, y: 250 }, asset: "pickup-suitcase", range: 0 },
      { id: "hazard-on-chest", kind: "hazard", at: { x: 700, y: 250 }, asset: "hazard-sweeping-carriage" },
      { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "signal-endlight" },
    ];
    c.objective = { kind: "collect-then-reach", gate: "gate" };
    add("chest-overlapping-hazard", "completable", c);
  }

  void playerAtForFoot;
  return cases;
}

const mode = process.argv[2] ?? "all";
const result = {};
if (mode === "all" || mode === "synthetic") result.synthetic = synthetic();
if (mode === "all" || mode === "corpus") result.corpus = corpus();
console.log(JSON.stringify(result, null, 2));
