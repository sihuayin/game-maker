/**
 * B1 网格采样不等式方向探针（只读，不修改产品目录）。
 * 目的：区分「碰撞检测可靠性」与「搜索可行性」两个约束，确认不等号方向。
 * 运行：node .scratch/level-playability-v1.1-integration/scripts/b1-grid-sampling-probe.mjs
 */
import { analyze, segmentCollides, hazardSpeed, Verdict } from "../../level-playability-v1.1-p0/prototype/temporal-model.mjs";

const base = (o = {}) => ({
  world: { xMin: -20, xMax: 2200 },
  player: { startX: 0, goalX: 100, width: 4, height: 16, y: 0, maxSpeed: 0.5 },
  hazard: { startX: 50, distance: 100, periodMs: 2000, width: 20, height: 100, anchorX: 0.5, anchorY: 1, y: 0, axis: "x" },
  certainty: { phase: "known", hitbox: "known" },
  assumptions: { verticalEvasionImpossible: true },
  options: { lagMs: 0, phaseSteps: 200, xStep: 2, limits: { maxStates: 500000, timeBudgetMs: 10000 } },
  ...o,
});

const out = { generatedAt: new Date().toISOString(), node: process.version, tests: {} };

// ── T1：Hazard 在两个采样点之间整段穿过玩家，端点安全、中途碰撞 ───────────────
{
  const cfg = base({
    player: { startX: 1000, goalX: 1004, width: 4, height: 16, y: 0, maxSpeed: 0.5 },
    hazard: { startX: 50, distance: 2000, periodMs: 2000, width: 20, height: 100, anchorX: 0.5, anchorY: 1, y: 0, axis: "x" },
    options: { lagMs: 0, phaseSteps: 2, xStep: 2, limits: { maxStates: 500000, timeBudgetMs: 10000 } },
  });
  const seg = { t0: 0, t1: 1000, x0: 1000, x1: 1000 }; // N=2 ⇒ 采样点 t=0,1000,2000
  const hit = segmentCollides(seg, cfg, 0);
  out.tests.T1 = {
    question: "采样点 t=0 与 t=1000 均安全，Hazard 在中途穿过玩家：连续判定是否捕获？",
    hazardSpeedPxPerMs: hazardSpeed(cfg.hazard),
    hazardTravelPerDtPx: hazardSpeed(cfg.hazard) * 1000,
    xStep: 2,
    endpointsSafe: true,
    collisionCaught: hit !== null,
    collisionAt: hit,
  };
}

// ── T2：同一个 T1 场景，粗/细采样下均不应漏检 ────────────────────────────────
{
  const rows = [];
  for (const N of [2, 4, 8, 16]) {
    const cfg = base({
      player: { startX: 1000, goalX: 1004, width: 4, height: 16, y: 0, maxSpeed: 0.5 },
      hazard: { startX: 50, distance: 2000, periodMs: 2000, width: 20, height: 100, anchorX: 0.5, anchorY: 1, y: 0, axis: "x" },
      options: { lagMs: 0, phaseSteps: N, xStep: 2, limits: { maxStates: 500000, timeBudgetMs: 10000 } },
    });
    // 取「包含碰撞瞬间 t≈476 的那个采样对齐线段」，验证粗/细采样都能捕获
    const dt = 2000 / N;
    const k = Math.floor(476 / dt);
    const seg = { t0: k * dt, t1: (k + 1) * dt, x0: 1000, x1: 1000 };
    const hit = segmentCollides(seg, cfg, 0);
    rows.push({
      N,
      dtMs: dt,
      segment: [seg.t0, seg.t1],
      containsCollisionInstant: seg.t0 <= 476 && 476 <= seg.t1,
      hazardTravelPerDtPx: hazardSpeed(cfg.hazard) * dt,
      collisionCaught: hit !== null,
    });
  }
  out.tests.T2 = { question: "采样粗细是否影响「中途穿越」的捕获？", rows };
}

// ── T3：搜索可行性 —— maxStepPx 与 xStep 的关系 ──────────────────────────────
{
  const rows = [];
  for (const maxSpeed of [0.02, 0.05, 0.1, 0.15, 0.2, 0.5]) {
    const cfg = base({
      player: { startX: 0, goalX: 100, width: 4, height: 16, y: 0, maxSpeed },
      options: { lagMs: 0, phaseSteps: 200, xStep: 2, limits: { maxStates: 500000, timeBudgetMs: 10000 } },
    });
    const r = analyze(cfg);
    rows.push({
      maxSpeed,
      maxStepPx: Number((maxSpeed * (2000 / 200)).toFixed(4)),
      xStep: 2,
      movePossible: maxSpeed * (2000 / 200) >= 2,
      verdict: r.verdict,
      reason: r.reason,
      statesVisited: r.stats.statesVisited,
      edgesChecked: r.stats.edgesChecked,
    });
  }
  out.tests.T3 = { question: "maxStepPx < xStep 时搜索是否退化？", rows };
}

// ── T4：固定 maxSpeed 下扫描 N，验证 N_max = maxSpeed*periodMs/xStep ─────────
{
  const rows = [];
  const maxSpeed = 0.1; // N_max = 0.1*2000/2 = 100
  for (const N of [90, 99, 100, 101, 110]) {
    const cfg = base({
      player: { startX: 0, goalX: 100, width: 4, height: 16, y: 0, maxSpeed },
      options: { lagMs: 0, phaseSteps: N, xStep: 2, limits: { maxStates: 500000, timeBudgetMs: 10000 } },
    });
    const r = analyze(cfg);
    rows.push({
      N,
      maxStepPx: Number((maxSpeed * (2000 / N)).toFixed(4)),
      verdict: r.verdict,
      reason: r.reason,
      statesVisited: r.stats.statesVisited,
      edgesChecked: r.stats.edgesChecked,
    });
  }
  out.tests.T4 = { question: "N 超过 maxSpeed*periodMs/xStep 后是否退化？", rows };
}

// ── T5：相位量化 —— 细采样是否影响可靠性（对照：粗采样不产生假安全） ──────────
{
  const rows = [];
  for (const N of [2, 50, 200]) {
    const cfg = base({ options: { lagMs: 0, phaseSteps: N, xStep: 2, limits: { maxStates: 500000, timeBudgetMs: 10000 } } });
    const r = analyze(cfg);
    rows.push({ N, verdict: r.verdict, reason: r.reason, witness: Boolean(r.witness) });
  }
  out.tests.T5 = { question: "P0 A 型案例在不同 N 下结论是否稳定？", rows };
}

console.log(JSON.stringify(out, null, 2));
