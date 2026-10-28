// 语义动作的**状态感知策略**（票 02 的薄解释器里的「怎么驱动」那一半）。
//
// ⚠️ 决策只看**读到的状态 + 观测步计数**，不看墙钟（票 05 Q2）：
//   起跳冷却 / stuck 检测原来用 `Date.now()`，这里改成步数 —— 同一状态序列在快慢机器上做同样的决定。
// ⚠️ 这不是「通关保证」：它只是 v1 的保守策略；走不通时由票 08 从证据归因（代理限制/超时），
//   不在这里把「没通关」判成游戏失败。
//
// FA-02（Q2 (i)，用户 2026-10-28 批准）：
//   · 巡逻危险物（横向三角波）不再"见缝就跳"：在**巡逻带外**等待，等危险物朝自己走来，
//     按实时几何 + 相位算出「现在起跳能不能在滞空窗口内越过」的窗口，再跳；
//   · 等待时由 runner 松开右键（`decide` 返回 `advance:false`）；
//   · 危险物在前/在带内时抑制 `pickupAbove` 这类无关起跳，避免主动跳进巡逻区。
//   ⚠️ 硬边界（FA-01C）：不写死本关坐标 / hazard id / 固定通关时间；物理量来自被验收游戏的
//      `player.move`（runner 从同一份 game-config 读入），几何量来自 READ_STATE。

const JUMP_COOLDOWN_STEPS = 7; // 7 × 35ms ≈ 245ms
const STUCK_STEPS = 12;        // 12 × 35ms ≈ 420ms

// 策略侧安全余量：不是"精确刚好"，而是"越过危险物时还留一点"。
export const CROSS_CLEARANCE_PX = 1;     // 危险物盒四周留 1px
export const CROSS_TURN_MARGIN_MS = 10;  // 危险物转向之前还要留出的时间
export const CROSS_WAIT_TARGET_PX = 2;   // 等待点：玩家右边界停在巡逻带左边界**外** 2px
export const CROSS_DEEP_INSIDE_PX = 8;   // 比这更深 ⇒ 认为已被迫进入巡逻带，只向前穿出

export const DEFAULT_MOVE = { speed: 90, jumpVelocity: 330, gravity: 900 };

export function createPolicy({ floorY, spawn, move }) {
  return {
    floorY, spawn,
    move: { ...DEFAULT_MOVE, ...(move ?? {}) },
    step: 0, lastJumpStep: -999, stuckSteps: 0, prevX: spawn.x,
    // FA-02：已起跳越过的危险物（按 hazards 下标）。reset 后清空。
    crossing: new Set(),
  };
}

/** 每个观测步调用一次；只更新「走了多远 / 卡了多久 / 是否被复位」。 */
export function noteObservation(st, ctx) {
  ctx.step += 1;
  if (st.x > ctx.prevX + 0.5) { ctx.prevX = st.x; ctx.stuckSteps = 0; }
  else ctx.stuckSteps += 1;
  // 危险物接触会把玩家送回出生点（复活保留收集数，位置回退）。复位后上一轮的"已起跳"作废。
  if (ctx.prevX > ctx.spawn.x + 100 && st.x < ctx.spawn.x + 15) {
    ctx.crossing.clear();
    ctx.prevX = st.x;
  }
}

export function markJump(ctx) { ctx.lastJumpStep = ctx.step; }

// ── 危险物几何/相位（只读观测，不假设具体的 start/id）────────────────────────

/** 横向巡逻危险物的模型；非巡逻/非横向/缺几何 ⇒ null（交给通用安全预测）。 */
export function hazardModel(h) {
  if (!h || h.axis !== "x" || !(h.distance > 0) || !(h.periodMs > 0)) return null;
  const width = h.width ?? (h.right - h.left);
  if (!(width > 0) || !Number.isFinite(h.x)) return null;
  const period = h.periodMs;
  const phase = (((h.t0 % period) + period) % period) / period;
  const k = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const start = h.x - k * h.distance;          // 三角波起点（锚点）
  return {
    halfW: width / 2,
    width,
    periodMs: period,
    distance: h.distance,
    // 锚点扫过的区间 [start, start+distance]；盒足迹再各外扩半个身位。
    bandLeft: start - width / 2,
    bandRight: start + h.distance + width / 2,
    // 三角波速度恒定，只有方向在两端翻转。px/ms。
    vel: phase < 0.5 ? (2 * h.distance) / period : -(2 * h.distance) / period,
    phase,
  };
}

/** 该危险物是否与玩家当前高度相关（站在平台上时，地面巡逻物不算）。 */
function verticalOverlap(st, h) {
  const top = st.top ?? st.bottom - (st.height ?? 0);
  return h.top < st.bottom - 1 && h.bottom > top + 1;
}

function hazardIndexed(st) {
  return (st.hazards ?? []).map((h, index) => ({ ...h, index }));
}

/**
 * 「现在起跳、一路按右键」能否在滞空窗口内越过该巡逻危险物。
 * 纯几何/纯物理：用玩家自己的 `move` 和 READ_STATE 的盒足迹算，不写死本关数值。
 * 返回 { gMin, gMax, rel }（px、px/ms），gap 必须落在 [gMin, gMax]。
 */
export function crossingWindow(st, ctx, hz) {
  const m = hazardModel(hz);
  if (!m) return null;
  const move = ctx.move;
  const rise0 = st.bottom - hz.top;                // 脚底至少抬过危险物头顶
  if (!(rise0 > 0)) return null;
  // ⚠️ 引擎按固定步长半隐式积分（先加速度、再位移），实际高度比连续解略低：
  //   落地前的额外下沉 ≈ g·Δt·t/2。用一次迭代把它算进需要抬升的高度里，
  //   否则窗口边缘会按连续解"刚好过"，实跑却蹭到危险物。
  const frameSec = 1 / 60;
  let pad = 0, tClear = 0, tFall = 0;
  for (let i = 0; i < 2; i++) {
    const rise = rise0 + pad;
    const disc = move.jumpVelocity ** 2 - 2 * move.gravity * rise;
    if (disc <= 0) return null;                    // 这个高度跳不过去
    tClear = (move.jumpVelocity - Math.sqrt(disc)) / move.gravity; // s，脚底到达危险物头顶
    tFall = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;  // s，脚底落回危险物头顶
    pad = 0.5 * move.gravity * frameSec * tFall;
  }
  const rel = move.speed / 1000 + Math.abs(m.vel); // px/ms，玩家与危险物的相对速度
  const depth = (st.width ?? 0) + m.width;         // 需要拉开的水平距离
  const gMin = rel * tClear * 1000 + CROSS_CLEARANCE_PX;
  const gMax = rel * tFall * 1000 - depth - CROSS_CLEARANCE_PX;
  // 危险物在玩家越过之前不能转向（转向后会朝玩家撞回来）：
  const turnPx = hz.left - m.bandLeft;             // 还要向左走多远才到端点
  const gTurn = (turnPx * rel) / Math.abs(m.vel) - depth - CROSS_TURN_MARGIN_MS * rel;
  const gMaxSafe = Math.min(gMax, gTurn);
  if (gMin > gMaxSafe) return null;                // 本相位没有可行窗口
  return { gMin, gMax: gMaxSafe, rel, m };
}

/**
 * 预测「现在起跳」是否会碰到任何相关危险物（不依赖巡逻相位假设；逐帧推演）。
 * 保守假设：一直按右键、按玩家自己的跳跃/重力落地后继续跑；危险物按三角波走。
 * ⚠️ 落地高度按 `floorY`（出生地面）算：站在平台上时是**保守近似**（会多下落一段），
 *   宁可少跳，不把玩家送进危险物怀里。
 */
export function jumpPredictionSafe(st, ctx, hazards) {
  const move = ctx.move;
  const dtMs = 16;
  const dt = dtMs / 1000;
  const pw = st.width ?? 0;
  const ph = st.height ?? 0;
  let x = st.x, bottom = st.bottom, vy = -move.jumpVelocity;
  const near = (hazards ?? []).filter((h) =>
    verticalOverlap(st, h) && h.right > st.left - 220 && h.left < st.right + 220);
  if (near.length === 0) return true;
  const horizon = (2 * move.jumpVelocity) / move.gravity + 0.6; // 滞空 + 足够跑过
  for (let t = 0; t <= horizon * 1000; t += dtMs) {
    x += move.speed * dt;
    vy += move.gravity * dt;
    bottom += vy * dt;
    if (bottom >= ctx.floorY) { bottom = ctx.floorY; vy = 0; }
    const left = x - pw / 2, right = x + pw / 2;
    for (const h of near) {
      const ax = hazardAnchorAt(h, t);
      const hl = ax - h.width / 2, hr = ax + h.width / 2;
      const overlapX = right > hl - CROSS_CLEARANCE_PX && left < hr + CROSS_CLEARANCE_PX;
      const overlapY = bottom > h.top + CROSS_CLEARANCE_PX && bottom - ph < h.bottom - CROSS_CLEARANCE_PX;
      if (overlapX && overlapY) return false;
    }
  }
  return true;
}

/** 三角波位置（与 `packages/demo/src/hazard.ts` 同一公式；这里只用于推演未来）。 */
export function hazardAnchorAt(h, dtMs) {
  const m = hazardModel(h);
  if (!m) return h.x;
  const t0 = h.t0 + dtMs;
  const phase = (((t0 % m.periodMs) + m.periodMs) % m.periodMs) / m.periodMs;
  const k = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  const start = h.x - (m.phase < 0.5 ? m.phase * 2 : 2 - m.phase * 2) * m.distance;
  return start + k * m.distance;
}

/** 通用（非越障）起跳判断：平台攀爬 / 前方无地 / 拾取物在上方 / 卡住。 */
export function shouldJump(st, ctx) {
  if (!st.onFloor) return false;
  if (ctx.step - ctx.lastJumpStep < JUMP_COOLDOWN_STEPS) return false;
  const onRaised = st.bottom < ctx.floorY - 10;
  const blocked = st.blockedRight || st.touchingRight;
  const climbable = !onRaised && st.solids.some((s) =>
    s.x > st.x && s.x - st.x < 80 && s.y < st.bottom - 10 && s.y > st.bottom - 90,
  );
  if (climbable) return blocked || ctx.stuckSteps > STUCK_STEPS;

  if (onRaised) {
    const under = st.solids
      .filter((s) => Math.abs(s.y - st.bottom) <= 2 && s.x < st.right && s.x + s.w > st.left)
      .sort((a, b) => (a.x + a.w) - (b.x + b.w))[0];
    if (under) {
      const rightEdge = under.x + under.w;
      const pickupBelow = st.pickups.some((p) =>
        p.active && Math.abs(p.x - st.x) < 48 && p.y > st.bottom + 5,
      );
      if (pickupBelow) return false;
      const next = st.hazards.filter((h) => h.x > st.x).sort((a, b) => a.x - b.x)[0];
      const hazardOverPlatform = next && next.x <= rightEdge + 30 && next.x - st.x < 60;
      if (hazardOverPlatform) return true;
      return st.x >= rightEdge + 8 || blocked || ctx.stuckSteps > STUCK_STEPS;
    }
    return blocked || ctx.stuckSteps > STUCK_STEPS;
  }

  const probe = st.right + 18;
  const groundAhead = st.solids.some((s) =>
    s.y <= st.bottom + 8 && s.y >= st.bottom - 90 && s.x <= probe && s.x + s.w >= probe,
  );
  const pickupAbove = st.pickups.some((p) =>
    p.active && p.x > st.x && p.x - st.x < 130 && p.y < st.bottom - 20,
  );
  return blocked || !groundAhead || pickupAbove || ctx.stuckSteps > STUCK_STEPS;
}

/**
 * FA-02 的主决策：本观测步要不要按右键、要不要起跳。
 * 返回 { advance, jump }；runner 负责把 advance 落成 keyDown/keyUp ArrowRight。
 *
 * 状态机（按最近的、可能挡路的巡逻危险物）：
 *   接近 → 走到巡逻带左边界外 CROSS_WAIT_TARGET_PX 处停住；
 *   等待 → 危险物朝自己走来（vel < 0）时，按窗口算能不能跳；能则「前进 + 起跳」；
 *   越过 → 一直前进；过了带右边界后回到「接近」（下一只危险物）。
 * 危险物在身后或与本高度无关时，退回通用 `shouldJump`（拾取/攀爬），
 * 但起跳前先做安全推演，避免把玩家送进危险物怀里。
 */
export function decide(st, ctx) {
  if (!st || !st.onFloor) return { advance: true, jump: false };
  const hazards = hazardIndexed(st);
  const patrolling = hazards.filter((h) => hazardModel(h) !== null && verticalOverlap(st, h));

  // 最近的、还没被甩到身后的巡逻物（按带左边界）。
  const ahead = patrolling
    .filter((h) => h.right > st.left - 2)
    .sort((a, b) => hazardModel(a).bandLeft - hazardModel(b).bandLeft)[0];

  if (ahead) {
    const m = hazardModel(ahead);
    if (ctx.crossing.has(ahead.index) && st.left > m.bandRight + 2) ctx.crossing.delete(ahead.index);
    const crossing = ctx.crossing.has(ahead.index);
    // 等待点：停在巡逻带**外沿**。跨带窗口要求「危险物转向之前玩家已越过」，
    // 离带太远起跳必然来不及；带内又会被扫到。目标右边界 = 带左边界 - 2px
    // （轮询一帧的滑行量约 3px，实际停点落在带外沿 ±2px，仍在可行窗口内）。
    const waitTarget = m.bandLeft - CROSS_WAIT_TARGET_PX;
    // 明显深入巡逻带（复位/外力造成）⇒ 只能继续向前穿出；带边的小幅过冲仍算"等待"。
    const deepInside = st.right > m.bandLeft + CROSS_DEEP_INSIDE_PX;

    if (!crossing && !deepInside) {
      if (st.right < waitTarget) {
        // 还在接近：允许拾取/攀爬跳，但必须先做安全推演，别跳进危险物怀里。
        const jump = shouldJump(st, ctx) && jumpPredictionSafe(st, ctx, hazards);
        return { advance: true, jump };
      }
      const window = crossingWindow(st, ctx, ahead);
      const gap = ahead.left - st.right;
      if (window && m.vel < 0 && gap >= window.gMin && gap <= window.gMax) {
        ctx.crossing.add(ahead.index);
        return { advance: true, jump: true };
      }
      return { advance: false, jump: false }; // 等待安全相位（右键松开）
    }
    // 正在越过 / 被迫在带内：继续前进；拾取/攀爬跳先做安全推演。
    const jump = shouldJump(st, ctx) && jumpPredictionSafe(st, ctx, hazards);
    return { advance: true, jump };
  }

  const jump = shouldJump(st, ctx) && jumpPredictionSafe(st, ctx, hazards);
  return { advance: true, jump };
}

/** 语义目标是否到达。 */
export function targetReached(st, target) {
  if (!st) return false;
  // gate 的锚点是 {0,0}，`gate.x` 就是盒左边界；用玩家右边界判定重叠开始。
  // ⚠️ 不能再用 `gate.x - 20`：FA-01B 实测 x=1360.5 / right=1372.5 停在盒外 7.5px，
  //    即使集齐 6 件也不会触发 tryWin()。
  // 还要垂直重叠：FA-01B 实测玩家会在 gate 盒上方空中经过，只看 right 会停得太早。
  if (target.kind === "gate") return !!(st.gate && st.right >= st.gate.x && st.bottom >= st.gate.y);
  if (target.kind === "pickup") {
    const p = st.pickups[target.index];
    return !p || !p.active;
  }
  return false;
}

/** 场景终止条件（票 02 的 `termination`）。 */
export function terminationReached(st, termination, observer) {
  if (!st || termination.kind === "never") return false;
  if (termination.kind === "won") return !!st.won;
  if (termination.kind === "collected") return (observer?.maxCollected ?? st.collected) >= termination.value;
  return false;
}
