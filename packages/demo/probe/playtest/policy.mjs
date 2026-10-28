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

/**
 * 有限终止阈值（03 Q4–Q6 锁定，2026-10-28）。单位一律是**观测步**，不是墙钟。
 * ⚠️ 这些是「多久放弃」的上限，不是通关判据：停止 = 执行器主动结束（`terminationReached=false`），
 *   不是游戏失败；原因由 `stop.reason` 记录（票 08 批准）。
 */
export const LIMITS = {
  NO_PROGRESS_STEPS: 300,        // 连续 300 步无复合进展
  RESET_BUDGET: 5,               // 累计 5 次重置（不因进展清零）
  WAIT_STEPS: 120,               // 连续 120 步 `advance:false`
  JUMP_VERIFY_STEPS: 3,          // 发键后 3 步内必须观察到离地
  JUMP_UNVERIFIED_BUDGET: 3,     // 连续 3 次未观察到 ⇒ 降级为不跳
  JUMP_FAILURE_BUDGET: 5,        // 累计 5 次失败且跳跃是唯一推进手段 ⇒ jump-exhaustion
};

// 策略侧安全余量：不是"精确刚好"，而是"越过危险物时还留一点"。
export const CROSS_CLEARANCE_PX = 1;     // 危险物盒四周留 1px
export const CROSS_TURN_MARGIN_MS = 10;  // 危险物转向之前还要留出的时间
export const CROSS_WAIT_TARGET_PX = 2;   // 等待点：玩家右边界停在巡逻带左边界**外** 2px
export const CROSS_DEEP_INSIDE_PX = 8;   // 比这更深 ⇒ 认为已被迫进入巡逻带，只向前穿出

// 03 Q2/Q3 锁定的安全余量：≈ 2×(轮询 50ms + 步进 35ms)。纵向穿越窗口与定时喷发窗口共用。
export const SAFETY_MARGIN_MS = 150;
// 纵向 / 定时喷发形态的决策视距：更远时不约束通用动作（避免整段路程都禁止拾取跳）。
export const HAZARD_LOOKAHEAD_PX = 320;
export const DANGER_LOOKAHEAD_PX = 400;

export const DEFAULT_MOVE = { speed: 90, jumpVelocity: 330, gravity: 900 };

export function createPolicy({ floorY, spawn, move }) {
  return {
    floorY, spawn,
    move: { ...DEFAULT_MOVE, ...(move ?? {}) },
    step: 0, lastJumpStep: -999, stuckSteps: 0, prevX: spawn.x, lastX: spawn.x,
    // FA-02：已起跳越过的危险物（按 hazards 下标）。reset 后清空。
    crossing: new Set(),
    // 05：复合进展 / 有限终止（字段全部可在 trace.jsonl + endState 里复核）。
    progress: { maxX: spawn.x, collected: 0, chests: 0, gate: false, won: false },
    noProgressSteps: 0,
    resets: 0,
    waits: 0,
    jump: { pending: null, failures: 0, unverified: 0, degraded: false },
    unreachable: new Set(),
    noted: new Set(),       // 04：一次性策略注解键（`danger-window-unknown` 等），避免每步刷屏
    notes: [],
    stop: null,
    // harness 条件场景（hang / input-blocked）有自己的期望结局，不套用主动停止规则。
    enforceStop: true,
  };
}

function note(ctx, kind, detail) {
  ctx.notes.push({ step: ctx.step, kind, detail });
}

/** 一次性注解：同一个键只记一次（落 `strategy.json` 的 `notes`，不进 11 类闭事件）。 */
function noteOnce(ctx, key, kind, detail) {
  if (ctx.noted.has(key)) return;
  ctx.noted.add(key);
  note(ctx, kind, detail);
}

/**
 * 每个观测步调用一次。
 * `step` 可选：runner 传 `trace.jsonl` 的累计行号，保证 `stop.atStep` 能在 trace 里对上；
 * 不传则自增（离线测试用）。
 */
export function noteObservation(st, ctx, step) {
  if (typeof step === "number") ctx.step = step;
  else ctx.step += 1;

  if (st.x > ctx.prevX + 0.5) { ctx.prevX = st.x; ctx.stuckSteps = 0; }
  else ctx.stuckSteps += 1;

  // 重置判据与 `observe.mjs` 的 reset 事件**同一套**（03：不得另写一套）。
  const reset = st.x < ctx.lastX - 150 && Math.abs(st.x - ctx.spawn.x) < 15 && ctx.lastX > ctx.spawn.x + 100;
  if (reset) {
    ctx.resets += 1;
    ctx.crossing.clear();
    ctx.prevX = st.x;
    note(ctx, "reset", { fromX: ctx.lastX, toX: st.x, count: ctx.resets });
  }
  ctx.lastX = st.x;

  // 复合进展（03 Q4）：maxX / collected / chestsOpened / gateReached / won 任一**严格增加**。
  const chests = (st.chests ?? []).filter((c) => c.opened).length;
  const gateReached = !!(st.gate && st.right >= st.gate.x && st.bottom >= st.gate.y);
  const advanced =
    st.x > ctx.progress.maxX + 0.5 ||
    (st.collected ?? 0) > ctx.progress.collected ||
    chests > ctx.progress.chests ||
    (gateReached && !ctx.progress.gate) ||
    (!!st.won && !ctx.progress.won);
  ctx.progress.maxX = Math.max(ctx.progress.maxX, st.x);
  ctx.progress.collected = Math.max(ctx.progress.collected, st.collected ?? 0);
  ctx.progress.chests = Math.max(ctx.progress.chests, chests);
  ctx.progress.gate = ctx.progress.gate || gateReached;
  ctx.progress.won = ctx.progress.won || !!st.won;
  if (advanced) { ctx.noProgressSteps = 0; ctx.waits = 0; }
  else ctx.noProgressSteps += 1;

  verifyJump(st, ctx);
}

/**
 * 发键 ≠ 跳跃成功（03 Q6）：发键后 3 个观测步内必须观察到
 * `!onFloor || vy < 0 || bottom 相对发键前下降 ≥ 2px`。
 * 成功一次清零失败计数；连续 3 次未观察到 ⇒ 降级为不跳（必需的跳跃仍会重试，由累计失败终止）。
 */
function verifyJump(st, ctx) {
  const p = ctx.jump.pending;
  if (!p) return;
  const airborne = !st.onFloor || st.vy < -0.5 || st.bottom < p.bottom - 2;
  if (airborne) {
    ctx.jump.pending = null;
    ctx.jump.failures = 0;
    ctx.jump.unverified = 0;
    note(ctx, "jump-verified", { atStep: p.atStep });
    return;
  }
  if (ctx.step - p.atStep >= LIMITS.JUMP_VERIFY_STEPS) {
    ctx.jump.pending = null;
    ctx.jump.failures += 1;
    ctx.jump.unverified += 1;
    if (ctx.jump.unverified >= LIMITS.JUMP_UNVERIFIED_BUDGET) ctx.jump.degraded = true;
    note(ctx, "jump-unverified", {
      atStep: p.atStep, failures: ctx.jump.failures,
      unverified: ctx.jump.unverified, degraded: ctx.jump.degraded,
    });
  }
}

export function markJump(ctx, st) {
  ctx.lastJumpStep = ctx.step;
  ctx.jump.pending = { atStep: ctx.step, bottom: st?.bottom ?? Number.NEGATIVE_INFINITY };
}

/** 单跳包络（03 Q7）：`v²/2g`，用被验收游戏自己的 `player.move`。 */
export function maxJumpHeight(move) {
  return (move.jumpVelocity ** 2) / (2 * move.gravity);
}

/**
 * 拾取物可达性（03 Q7）：直接从当前脚下够得到，或存在一个可跳上去、水平覆盖拾取物 x、
 * 且从该顶面再跳也够得到的 solid 顶面。不可达 ⇒ 不追（非必需目标跳过但不静默）。
 */
export function pickupReachable(st, ctx, p) {
  const h = maxJumpHeight(ctx.move);
  if (st.bottom - p.y <= h + 0.5) return { reachable: true, via: "jump-from-floor", maxJumpHeight: h };
  const platform = (st.solids ?? []).find((s) => {
    const climb = st.bottom - s.y;                              // 当前脚底 → 平台顶
    if (!(climb > 0) || climb > h + 0.5) return false;
    if (!(p.x >= s.x && p.x <= s.x + s.w)) return false;        // 平台水平覆盖拾取物
    return s.y - p.y <= h + 0.5;                                // 平台顶 → 拾取物高度
  });
  if (platform) return {
    reachable: true, via: "platform", maxJumpHeight: h,
    platform: { x: platform.x, y: platform.y, w: platform.w },
  };
  return {
    reachable: false, maxJumpHeight: h, playerBottom: st.bottom,
    missing: "没有顶面在单跳高度内、水平覆盖拾取物且二次起跳也够得到的平台",
  };
}

function pickupAboveIndex(st) {
  return (st.pickups ?? []).findIndex((p) =>
    p.active && p.x > st.x && p.x - st.x < 130 && p.y < st.bottom - 20);
}

/** 跳跃是不是「唯一推进手段」：被挡住，或前方没有可站的地面。 */
export function jumpRequired(st) {
  if (!st || !st.onFloor) return false;
  if (st.blockedRight || st.touchingRight) return true;
  const probe = st.right + 18;
  return !(st.solids ?? []).some((s) =>
    s.y <= st.bottom + 8 && s.y >= st.bottom - 90 && s.x <= probe && s.x + s.w >= probe);
}

/** 降级后只允许「必需的」跳跃；可选跳跃（拾取物 / 越障窗口）一律放弃。 */
export function canAttemptJump(st, ctx) {
  return !ctx.jump.degraded || jumpRequired(st);
}

/**
 * 有限终止检查（03 Q4–Q6）：返回 `null` 或锁定的 `{ reason, atStep }`。
 * 顺序 = 先到先停：重置预算耗尽 > 无进展 > 等待上限 > 跳跃耗尽。
 * ⚠️ 主动停止不是游戏失败：`terminationReached` 保持 false，归因判 `AGENT_LIMITATION`。
 */
export function stopReasonOf(st, ctx) {
  if (!ctx.enforceStop) return null;
  if (ctx.stop) return ctx.stop;
  let reason = null;
  if (ctx.resets >= LIMITS.RESET_BUDGET) reason = "reset-exhaustion";
  else if (ctx.noProgressSteps >= LIMITS.NO_PROGRESS_STEPS) reason = "no-progress";
  else if (ctx.waits >= LIMITS.WAIT_STEPS) reason = "wait-limit";
  else if (ctx.jump.failures >= LIMITS.JUMP_FAILURE_BUDGET && ctx.jump.degraded && jumpRequired(st))
    reason = "jump-exhaustion";
  if (reason !== null) {
    ctx.stop = { reason, atStep: ctx.step };
    note(ctx, "stop", { ...ctx.stop });
  }
  return ctx.stop;
}

// ── 危险物几何/相位（只读观测，不假设具体的 start/id）────────────────────────

function playerTop(st) {
  return st.top ?? st.bottom - (st.height ?? 0);
}

/** 三角波相位：`k` 在周期内 0→1→0（与 `packages/demo/src/hazard.ts` 同一公式）。 */
function triangleOf(t0, periodMs) {
  const phase = (((t0 % periodMs) + periodMs) % periodMs) / periodMs;
  const k = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return { phase, k };
}

/**
 * 巡逻危险物模型（04：横向 `axis:"x"` 与纵向 `axis:"y"` 共用）。
 * 缺必要运动字段 / 几何 ⇒ null（交给保守回落，不猜窗口）。
 *
 * 锚点语义（`scene.ts` + 资源锚点 {0.5,1}）：
 *   · 横向：锚点是精灵中心 x，盒足迹随锚点左右移动；
 *   · 纵向：锚点是盒底（= 精灵 y），盒足迹随锚点上下移动。
 * 反推锚点起点：`start = 观测锚点 - k * distance`（`k` 由 `t0` 相位得出）。
 */
export function hazardModel(h) {
  if (!h || (h.axis !== "x" && h.axis !== "y")) return null;
  if (!(h.distance > 0) || !(h.periodMs > 0)) return null;
  const width = h.width ?? (h.right - h.left);
  const height = h.height ?? (h.bottom - h.top);
  if (!(width > 0) || !(height > 0)) return null;
  const observedAnchor = h.axis === "y"
    ? (Number.isFinite(h.bottom) ? h.bottom : h.y)
    : h.x;
  if (!Number.isFinite(observedAnchor)) return null;
  const period = h.periodMs;
  const { phase, k } = triangleOf(h.t0, period);
  const start = observedAnchor - k * h.distance;
  const speed = (2 * h.distance) / period;   // px/ms，三角波速度恒定，只有端点翻转
  const vel = phase < 0.5 ? speed : -speed;
  const boxLeft = Number.isFinite(h.left) ? h.left : h.x - width / 2;
  const boxRight = Number.isFinite(h.right) ? h.right : h.x + width / 2;
  return {
    axis: h.axis,
    width, height,
    periodMs: period,
    distance: h.distance,
    start,
    phase,
    // 沿自身轴的速度（px/ms）。横向沿用旧字段 `vel`；`velX` / `velY` 消歧。
    vel,
    velX: h.axis === "x" ? vel : 0,
    velY: h.axis === "y" ? vel : 0,
    halfW: width / 2,
    // 横向：盒足迹在 x 上扫过的区间，等待点与跨带窗口都按它算。
    bandLeft: h.axis === "x" ? start - width / 2 : boxLeft,
    bandRight: h.axis === "x" ? start + h.distance + width / 2 : boxRight,
    // 纵向：盒足迹在 y 上扫过的**完整范围**（不是当前帧）—— 03 Q2 的相关性判据。
    sweepTop: h.axis === "y" ? start - height : (h.top ?? h.bottom - height),
    sweepBottom: h.axis === "y" ? start + h.distance : (h.bottom ?? h.top + height),
  };
}

/** 该横向危险物是否与玩家当前高度相关（站在平台上时，地面巡逻物不算）。 */
function verticalOverlap(st, h) {
  return h.top < st.bottom - 1 && h.bottom > playerTop(st) + 1;
}

/**
 * 纵向危险物的相关性（03 Q2）：用**完整扫掠范围**，不得沿用只看当前帧的 `verticalOverlap`
 * —— 高处待命的纵向危险物会再降下来，当前帧不重叠不代表安全。
 */
export function verticalSweepOverlap(st, m) {
  return m.sweepTop < st.bottom - 1 && m.sweepBottom > playerTop(st) + 1;
}

function hazardIndexed(st) {
  return (st.hazards ?? []).map((h, index) => ({ ...h, index }));
}

function dangerIndexed(st) {
  return (st.dangers ?? []).map((d, index) => ({ ...d, index }));
}

/**
 * 「现在起跳、一路按右键」能否在滞空窗口内越过该巡逻危险物。
 * 纯几何/纯物理：用玩家自己的 `move` 和 READ_STATE 的盒足迹算，不写死本关数值。
 * 返回 { gMin, gMax, rel }（px、px/ms），gap 必须落在 [gMin, gMax]。
 */
export function crossingWindow(st, ctx, hz) {
  const m = hazardModel(hz);
  if (!m || m.axis !== "x") return null;
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
  const near = (hazards ?? []).filter((h) => {
    const m = hazardModel(h);
    if (!m) return false;
    // 横向按当前帧高度过滤（地面巡逻物 vs 站在平台上）；纵向按完整扫掠范围。
    const relevant = m.axis === "y" ? verticalSweepOverlap(st, m) : verticalOverlap(st, h);
    return relevant && m.bandRight > st.left - 220 && m.bandLeft < st.right + 220;
  });
  if (near.length === 0) return true;
  const horizon = (2 * move.jumpVelocity) / move.gravity + 0.6; // 滞空 + 足够跑过
  for (let t = 0; t <= horizon * 1000; t += dtMs) {
    x += move.speed * dt;
    vy += move.gravity * dt;
    bottom += vy * dt;
    if (bottom >= ctx.floorY) { bottom = ctx.floorY; vy = 0; }
    const left = x - pw / 2, right = x + pw / 2;
    for (const h of near) {
      const box = hazardBoxAt(h, t);
      if (!box) continue;
      const overlapX = right > box.left - CROSS_CLEARANCE_PX && left < box.right + CROSS_CLEARANCE_PX;
      const overlapY = bottom > box.top + CROSS_CLEARANCE_PX && bottom - ph < box.bottom - CROSS_CLEARANCE_PX;
      if (overlapX && overlapY) return false;
    }
  }
  return true;
}

/** 三角波锚点位置（与 `packages/demo/src/hazard.ts` 同一公式；这里只用于推演未来）。 */
export function hazardAnchorAt(h, dtMs) {
  const m = hazardModel(h);
  if (!m) return h.axis === "y" ? (h.bottom ?? h.y) : h.x;
  const { k } = triangleOf(h.t0 + dtMs, m.periodMs);
  return m.start + k * m.distance;
}

/** 危险物在 `dtMs` 之后的盒足迹（横向：y 静态；纵向：x 静态）。 */
export function hazardBoxAt(h, dtMs = 0) {
  const m = hazardModel(h);
  if (!m) return null;
  const anchor = hazardAnchorAt(h, dtMs);
  if (m.axis === "x") {
    const top = h.top ?? (h.bottom - m.height);
    return { left: anchor - m.width / 2, right: anchor + m.width / 2, top, bottom: top + m.height };
  }
  const left = h.left ?? (h.x - m.width / 2);
  return { left, right: left + m.width, top: anchor - m.height, bottom: anchor };
}

/**
 * 纵向巡逻穿越窗口（03 Q2）：盒底高于玩家头顶的时间窗 ≥ 穿越时间 + 余量才过。
 * 三角波的 `k` 在周期头尾各有一个安全窗；`kMax = (玩家头顶 - 锚点起点) / 行程`。
 * ⚠️ 通过纵向危险**不要求起跳**，也不得把跳跃当作纵向规避手段（跳进运动轨迹更危险）。
 */
export function verticalCrossingWindow(st, ctx, hz) {
  const m = hazardModel(hz);
  if (!m || m.axis !== "y") return null;
  const speed = ctx.move.speed;
  if (!(speed > 0)) return null;
  const crossingMs = ((m.width + (st.width ?? 0) + 2 * CROSS_CLEARANCE_PX) / speed) * 1000;
  const needMs = crossingMs + SAFETY_MARGIN_MS;
  const headroomY = playerTop(st) - CROSS_CLEARANCE_PX; // 盒底低于此值 = 在头顶之上
  const kMax = (headroomY - m.start) / m.distance;
  if (kMax >= 1) {
    // 整段行程都在玩家头顶之上（或高到永远够不着）。
    return { cross: true, mode: "always-clear", kMax, crossingMs, needMs, remainingMs: Infinity };
  }
  if (!(kMax > 0)) {
    // 危险物的最高点也低于玩家头顶：整周期没有安全窗口。
    return { cross: false, mode: "no-window", kMax, crossingMs, needMs, remainingMs: 0 };
  }
  const windowMs = (kMax * m.periodMs) / 2;
  const phaseMs = m.phase * m.periodMs;
  let remainingMs = 0;
  if (phaseMs <= windowMs) remainingMs = windowMs - phaseMs;
  else if (phaseMs >= m.periodMs - windowMs) remainingMs = m.periodMs - phaseMs;
  const cross = remainingMs >= needMs;
  return {
    cross, mode: cross ? "window" : "wait", kMax, crossingMs, needMs, remainingMs, windowMs,
  };
}

/** danger 的盒足迹（静态；`left/top` 来自 config 的打击盒，不是精灵 body）。 */
export function dangerModel(d) {
  if (!d) return null;
  const width = d.width ?? (Number.isFinite(d.left) && Number.isFinite(d.right) ? d.right - d.left : NaN);
  const height = d.height ?? (Number.isFinite(d.top) && Number.isFinite(d.bottom) ? d.bottom - d.top : NaN);
  if (!(width > 0) || !(height > 0)) return null;
  const left = Number.isFinite(d.left) ? d.left : (Number.isFinite(d.x) ? d.x - width / 2 : null);
  const top = Number.isFinite(d.top) ? d.top : (Number.isFinite(d.y) ? d.y - height : null);
  if (left === null || top === null) return null;
  return { left, right: left + width, top, bottom: top + height, width, height };
}

function dangerVerticallyRelevant(st, box) {
  return box.top < st.bottom - 1 && box.bottom > playerTop(st) + 1;
}

/**
 * 定时喷发的安全判据（03 Q3）：
 *   `periodMs` 是安全窗口、`activeMs` 是喷发窗口，完整周期 = 两者之和；
 *   安全区 = 每周期 `[0, periodMs)`，区间两端各留 `SAFETY_MARGIN_MS`。
 * 回落阶梯：缺 `box`/`t`/`periodMs`/`activeMs` 或数值非法 → 只用观测 `state`（idle 才进）；
 *   连 `state` 都没有 → 不穿越。观测到 `active` 时绝不进入（观测优先于推演）。
 */
function dangerIdleThroughout(d, fromMs, toMs) {
  if (!(d.periodMs > 0) || !(d.activeMs > 0) || !Number.isFinite(d.t)) {
    return d.state === "idle"
      ? { safe: true, mode: "state-only" }
      : { safe: false, mode: d.state === "active" ? "observed-active" : "no-state" };
  }
  if (d.state === "active") return { safe: false, mode: "observed-active" };
  const cycle = d.periodMs + d.activeMs;
  const span = toMs - fromMs;
  if (span >= cycle) return { safe: false, mode: "window", phaseMs: null };
  const mod = (x) => ((x % cycle) + cycle) % cycle;
  const start = mod(d.t + fromMs);
  const end = start + span;
  // 安全区是每周期开头的 [0, periodMs]，喷发在周期末尾。区间只要越过 periodMs（含跨周期）
  // 就一定会碰到喷发窗口 —— 不需要再分「是否绕回」两种情况。
  const safe = end <= d.periodMs;
  return { safe, mode: "window", phaseMs: start };
}

/**
 * 逐一路径推演（03 Q3）：从当前位置向前，按玩家自己的速度推算与每个 danger 的 x 足迹
 * 相交的时间区间（含安全余量），全部必须落在 idle 内；任一不满足即等待。
 */
export function dangerPathSafe(st, ctx, dangers) {
  const speed = ctx.move.speed;
  if (!(speed > 0)) return { safe: false, mode: "unknown-speed" };
  const pw = st.width ?? 0;
  let atMs = 0;
  let right = st.right;
  for (const d of dangers) {
    const box = dangerModel(d);
    if (!box) {
      if (d.state !== "idle") return { safe: false, mode: "state-only", index: d.index };
      continue;
    }
    const approachPx = Math.max(0, box.left - CROSS_CLEARANCE_PX - right);
    atMs += (approachPx / speed) * 1000;
    right += approachPx;
    const crossingMs = ((pw + box.width + 2 * CROSS_CLEARANCE_PX) / speed) * 1000;
    const from = Math.max(0, atMs - SAFETY_MARGIN_MS);
    const to = atMs + crossingMs + SAFETY_MARGIN_MS;
    const verdict = dangerIdleThroughout(d, from, to);
    if (!verdict.safe) {
      return { safe: false, ...verdict, index: d.index, atMs, crossingMs };
    }
    right = box.right + CROSS_CLEARANCE_PX;
    atMs += crossingMs;
  }
  return { safe: true, mode: "window" };
}

/** 通用（非越障）起跳判断：平台攀爬 / 前方无地 / 拾取物在上方 / 卡住。 */
export function shouldJump(st, ctx) {
  if (!st.onFloor) return false;
  if (ctx.step - ctx.lastJumpStep < JUMP_COOLDOWN_STEPS) return false;
  // 降级后只保留「必需的」跳跃（被挡 / 前方无地）；拾取物、攀爬、越障窗口一律放弃。
  if (!canAttemptJump(st, ctx)) return false;
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
  // 拾取物（03 Q7）：只在**有足够证据**时追 —— 单跳包络 + 平台几何。
  // 不可达 ⇒ 不跳，但记录 `pickup-unreachable`（拾取物下标 + 缺失几何），不得静默。
  const pickupIndex = pickupAboveIndex(st);
  let pickupJump = false;
  if (pickupIndex >= 0) {
    const p = st.pickups[pickupIndex];
    const r = pickupReachable(st, ctx, p);
    if (r.reachable) pickupJump = true;
    else if (!ctx.unreachable.has(pickupIndex)) {
      ctx.unreachable.add(pickupIndex);
      note(ctx, "pickup-unreachable", {
        index: pickupIndex, pickup: { x: p.x, y: p.y }, ...r,
      });
    }
  }
  return blocked || !groundAhead || pickupJump || ctx.stuckSteps > STUCK_STEPS;
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
  const d = decideInner(st, ctx);
  // 03 Q5：连续 `advance:false` 计等待步；恢复推进（或 noteObservation 看到新进展）清零。
  ctx.waits = d.advance ? 0 : ctx.waits + 1;
  return d;
}

function decideInner(st, ctx) {
  if (!st || !st.onFloor) return { advance: true, jump: false };
  const hazards = hazardIndexed(st);
  const dangers = dangerIndexed(st);
  const horizontal = decideHorizontal(st, ctx, hazards);
  const vertical = decideVertical(st, ctx, hazards);
  const timed = decideDanger(st, ctx, dangers);

  if (horizontal === null && vertical === null && timed === null) {
    const jump = shouldJump(st, ctx) && jumpPredictionSafe(st, ctx, hazards);
    return { advance: true, jump };
  }
  // 三类形态可共存：任一要求等待 ⇒ 等。
  // 有其他形态在场时不跳：跳跃不是纵向/喷发规避手段，跳进运动轨迹只会更危险。
  const advance = [horizontal, vertical, timed].every((p) => p === null || p.advance);
  const jump = vertical === null && timed === null && horizontal !== null && horizontal.jump;
  return { advance, jump };
}

/** 横向巡逻（FA-02，03 Q1 保留）：没有前方巡逻物时返回 null，交给其他形态。 */
function decideHorizontal(st, ctx, hazards) {
  const patrolling = hazards.filter((h) => {
    const m = hazardModel(h);
    return m !== null && m.axis === "x" && verticalOverlap(st, h);
  });

  // 最近的、还没被甩到身后的巡逻物（按带左边界）。
  const ahead = patrolling
    .filter((h) => h.right > st.left - 2)
    .sort((a, b) => hazardModel(a).bandLeft - hazardModel(b).bandLeft)[0];
  if (!ahead) return null;

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
    // 降级后不再为「越障窗口」起跳（跳跃输入未被证明有效）；继续等待 ⇒ 120 步后 wait-limit。
    if (window && m.vel < 0 && gap >= window.gMin && gap <= window.gMax && canAttemptJump(st, ctx)) {
      ctx.crossing.add(ahead.index);
      return { advance: true, jump: true };
    }
    return { advance: false, jump: false }; // 等待安全相位（右键松开）
  }
  // 正在越过 / 被迫在带内：继续前进；拾取/攀爬跳先做安全推演。
  const jump = shouldJump(st, ctx) && jumpPredictionSafe(st, ctx, hazards);
  return { advance: true, jump };
}

/**
 * 纵向巡逻（03 Q2）：没有前方相关的纵向危险物时返回 null。
 * 相关性按完整扫掠范围；缺运动字段时保守当作相关（带外等待，不猜窗口）。
 * 通过纵向危险不要求起跳；等待超 120 步由 `stopReasonOf` 判 `wait-limit`。
 */
function decideVertical(st, ctx, hazards) {
  const ahead = hazards
    .filter((h) => {
      if (h.axis !== "y") return false;
      const m = hazardModel(h);
      if (m === null) {
        // 缺 distance/period/t0/几何：无法判断扫掠范围 ⇒ 保守当作可能相关。
        const rightEdge = Number.isFinite(h.right) ? h.right : h.x;
        return Number.isFinite(rightEdge)
          && rightEdge > st.left - 2
          && rightEdge - st.right <= HAZARD_LOOKAHEAD_PX;
      }
      if (!(m.bandRight > st.left - 2)) return false;
      if (m.bandLeft - st.right > HAZARD_LOOKAHEAD_PX) return false;
      return verticalSweepOverlap(st, m);
    })
    .sort((a, b) => {
      const la = hazardModel(a)?.bandLeft ?? a.left ?? a.x ?? Infinity;
      const lb = hazardModel(b)?.bandLeft ?? b.left ?? b.x ?? Infinity;
      return la - lb;
    })[0];
  if (!ahead) return null;

  const m = hazardModel(ahead);
  const left = m !== null ? m.bandLeft : (Number.isFinite(ahead.left) ? ahead.left : null);
  const rightEdge = m !== null ? m.bandRight : (Number.isFinite(ahead.right) ? ahead.right : null);
  if (left === null || rightEdge === null) {
    noteOnce(ctx, `vertical-window-unknown:${ahead.index}`, "vertical-window-unknown", {
      index: ahead.index, missing: "水平盒边界",
    });
    return { advance: false, jump: false };
  }

  const waitTarget = left - CROSS_WAIT_TARGET_PX;
  if (st.right < waitTarget) return { advance: true, jump: false };         // 接近
  if (st.right > left + CROSS_DEEP_INSIDE_PX) return { advance: true, jump: false }; // 已在带内：向前穿出
  if (m === null) {
    // 运动字段缺失/非法：保守带外等待，不猜窗口（03 Q2 回落）。
    noteOnce(ctx, `vertical-window-unknown:${ahead.index}`, "vertical-window-unknown", {
      index: ahead.index, missing: "distance/periodMs/t0/几何",
    });
    return { advance: false, jump: false };
  }

  const win = verticalCrossingWindow(st, ctx, ahead);
  if (win !== null && win.cross) return { advance: true, jump: false };
  return { advance: false, jump: false };
}

/**
 * 定时喷发（03 Q3）：没有前方相关的 danger 时返回 null。
 * 在等待点逐一路径推演所有相关 danger，任一不满足即等待；
 * 缺字段回落 state-only（`danger-window-unknown` 只落 strategy.json，不进 11 类闭事件）。
 */
function decideDanger(st, ctx, dangers) {
  const relevant = dangers
    .filter((d) => {
      const box = dangerModel(d);
      if (!box) {
        // 盒几何缺失：无法排除它会挡路 ⇒ 只看前方 + 视距。
        const left = Number.isFinite(d.left) ? d.left : d.x;
        const rightEdge = Number.isFinite(d.right) ? d.right : d.x;
        if (!Number.isFinite(left) || !Number.isFinite(rightEdge)) return false;
        return rightEdge > st.left - 2 && left - st.right <= DANGER_LOOKAHEAD_PX;
      }
      if (!(box.right > st.left - 2)) return false;
      if (box.left - st.right > DANGER_LOOKAHEAD_PX) return false;
      return dangerVerticallyRelevant(st, box);
    })
    .sort((a, b) => {
      const la = dangerModel(a)?.left ?? a.left ?? a.x ?? Infinity;
      const lb = dangerModel(b)?.left ?? b.left ?? b.x ?? Infinity;
      return la - lb;
    });
  if (relevant.length === 0) return null;

  const nearest = dangerModel(relevant[0]);
  const left = nearest !== null ? nearest.left : (Number.isFinite(relevant[0].left) ? relevant[0].left : null);
  if (left === null) return { advance: false, jump: false }; // 边界未知：不推进
  if (st.right < left - CROSS_WAIT_TARGET_PX) return { advance: true, jump: false }; // 接近
  if (st.right > left + CROSS_DEEP_INSIDE_PX) return { advance: true, jump: false }; // 已在盒内：向前穿出

  // 到达等待点：先按回落阶梯补记「窗口未知」注解（每只 danger 只记一次）。
  // ⚠️ 只有**数值推演不可用**时才落 state-only；缺 state 本身不是注解理由（数值窗口仍然有效）。
  for (const d of relevant) {
    const box = dangerModel(d);
    const numericKnown = box !== null && d.periodMs > 0 && d.activeMs > 0 && Number.isFinite(d.t);
    if (!numericKnown) {
      const missing = [];
      if (box === null) missing.push("box");
      if (!(d.periodMs > 0)) missing.push("periodMs");
      if (!(d.activeMs > 0)) missing.push("activeMs");
      if (!Number.isFinite(d.t)) missing.push("t");
      if (d.state !== "idle" && d.state !== "active") missing.push("state");
      noteOnce(ctx, `danger-window-unknown:${d.index}`, "danger-window-unknown", {
        index: d.index, missing, state: d.state ?? null,
      });
    }
  }

  const verdict = dangerPathSafe(st, ctx, relevant);
  return { advance: verdict.safe, jump: false };
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
