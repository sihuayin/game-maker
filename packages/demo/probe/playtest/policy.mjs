// 语义动作的**状态感知策略**（票 02 的薄解释器里的「怎么驱动」那一半）。
//
// ⚠️ 决策只看**读到的状态 + 观测步计数**，不看墙钟（票 05 Q2）：
//   起跳冷却 / stuck 检测原来用 `Date.now()`，这里改成步数 —— 同一状态序列在快慢机器上做同样的决定。
// ⚠️ 这不是「通关保证」：它只是 v1 的保守策略；走不通时由票 08 从证据归因（代理限制/超时），
//   不在这里把「没通关」判成游戏失败。

const JUMP_COOLDOWN_STEPS = 7; // 7 × 35ms ≈ 245ms
const STUCK_STEPS = 12;        // 12 × 35ms ≈ 420ms

export function createPolicy({ floorY, spawn }) {
  return { floorY, spawn, step: 0, lastJumpStep: -999, stuckSteps: 0, prevX: spawn.x };
}

/** 每个观测步调用一次；只更新「走了多远 / 卡了多久」。 */
export function noteObservation(st, ctx) {
  ctx.step += 1;
  if (st.x > ctx.prevX + 0.5) { ctx.prevX = st.x; ctx.stuckSteps = 0; }
  else ctx.stuckSteps += 1;
}

export function markJump(ctx) { ctx.lastJumpStep = ctx.step; }

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
  const hazardAhead = st.hazards.some((h) => {
    if (!(h.x > st.x && h.x - st.x < 100 && Math.abs(h.y - st.y) < 90)) return false;
    // 巡逻 hazard 是三角波；只在它远离玩家时跳（phase < 0.5）。t0 由外壳逐帧累加。
    if (h.distance > 0 && h.periodMs > 0) {
      const phase = ((h.t0 ?? 0) % h.periodMs) / h.periodMs;
      if (phase >= 0.5) return false;
    }
    return true;
  });
  const pickupAbove = st.pickups.some((p) =>
    p.active && p.x > st.x && p.x - st.x < 130 && p.y < st.bottom - 20,
  );
  return blocked || !groundAhead || hazardAhead || pickupAbove || ctx.stuckSteps > STUCK_STEPS;
}

/** 语义目标是否到达。 */
export function targetReached(st, target) {
  if (!st) return false;
  if (target.kind === "gate") return !!(st.gate && st.x >= st.gate.x - 20);
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
