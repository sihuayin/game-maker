/**
 * P0-02 原型单元测试 —— ⚠️ THROWAWAY，不进 `pnpm test`。
 * 运行：node --test .scratch/level-playability-v1.1-p0/prototype/
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  hazardSpanAt,
  pointCollides,
  segmentCollides,
  trianglePosition,
  verifyWitness,
  Verdict,
} from "./temporal-model.mjs";

function makeConfig(overrides = {}) {
  return {
    world: { xMin: -20, xMax: 180 },
    player: { startX: 0, goalX: 100, width: 4, height: 16, y: 0, maxSpeed: 0.5 },
    hazard: {
      startX: 50,
      distance: 100,
      periodMs: 2000,
      width: 20,
      height: 100,
      anchorX: 0.5,
      anchorY: 1,
      y: 0,
      axis: "x",
    },
    certainty: { phase: "known", hitbox: "known" },
    assumptions: { verticalEvasionImpossible: true },
    options: {
      lagMs: 20,
      phaseSteps: 200,
      xStep: 2,
      limits: { maxStates: 500000, timeBudgetMs: 10000 },
    },
    ...overrides,
  };
}

test("Q1: periodMs is the full round trip; t=0 at start; t=P/2 at start+distance", () => {
  assert.equal(trianglePosition(10, 100, 2000, 0), 10);
  assert.equal(trianglePosition(10, 100, 2000, 500), 60);
  assert.equal(trianglePosition(10, 100, 2000, 1000), 110);
  assert.equal(trianglePosition(10, 100, 2000, 1500), 60);
  assert.equal(trianglePosition(10, 100, 2000, 2000), 10);
  assert.equal(trianglePosition(10, 100, 2000, 2500), 60);
});

test("A: waiting for a safe window then crossing yields a verified witness", () => {
  const cfg = makeConfig();
  const result = analyze(cfg);
  assert.equal(result.verdict, Verdict.SAFE, result.reason);
  assert.ok(result.witness, "witness required for a safety verdict");
  // The witness must contain at least one stationary (waiting) segment.
  assert.ok(
    result.witness.segments.some((s) => Math.abs(s.x1 - s.x0) < 1e-9),
    "the witness must wait somewhere before crossing",
  );
  assert.ok(result.witness.arriveAt > result.witness.departAt);
  assert.equal(verifyWitness(cfg, result.witness, cfg.options.lagMs), null);
  assert.ok(result.stats.statesVisited > 0);
});

test("B: a hazard permanently covering a gate proves PROVEN_UNPLAYABLE", () => {
  const cfg = makeConfig({
    hazard: {
      startX: 40,
      distance: 20,
      periodMs: 2000,
      width: 20,
      height: 100,
      anchorX: 0.5,
      anchorY: 1,
      y: 0,
      axis: "x",
    },
  });
  const result = analyze(cfg);
  assert.equal(result.verdict, Verdict.UNPLAYABLE, result.reason);
  assert.equal(result.proof.kind, "permanent-gate");
  assert.ok(result.proof.gateLo <= 50 && 50 <= result.proof.gateHi);
});

test("B without the vertical-evasion assumption must not claim unplayable", () => {
  const cfg = makeConfig({
    hazard: {
      startX: 40,
      distance: 20,
      periodMs: 2000,
      width: 20,
      height: 100,
      anchorX: 0.5,
      anchorY: 1,
      y: 0,
      axis: "x",
    },
    assumptions: { verticalEvasionImpossible: false },
  });
  const result = analyze(cfg);
  assert.equal(result.verdict, Verdict.INSUFFICIENT);
  assert.match(result.reason, /vertical-evasion/);
  assert.notEqual(result.verdict, Verdict.UNPLAYABLE);
});

test("C: uncertain phase or hitbox is INSUFFICIENT_EVIDENCE", () => {
  const uncertainPhase = makeConfig({ certainty: { phase: "unknown", hitbox: "known" } });
  assert.equal(analyze(uncertainPhase).verdict, Verdict.INSUFFICIENT);
  assert.equal(analyze(uncertainPhase).reason, "phase-uncertain");

  const uncertainHitbox = makeConfig({ certainty: { phase: "known", hitbox: "unverifiable" } });
  assert.equal(analyze(uncertainHitbox).verdict, Verdict.INSUFFICIENT);
  assert.equal(analyze(uncertainHitbox).reason, "hitbox-uncertain");
});

test("sampling trap: collision between samples is caught by the continuous check", () => {
  const cfg = makeConfig({
    hazard: {
      startX: 50,
      distance: 0,
      periodMs: 2000,
      width: 10,
      height: 100,
      anchorX: 0.5,
      anchorY: 1,
      y: 0,
      axis: "x",
    },
    player: { startX: 0, goalX: 100, width: 4, height: 16, y: 0, maxSpeed: 1 },
  });
  // Only the endpoints are sampled: both are clear.
  assert.equal(pointCollides(cfg, 0, 0, 20), false);
  assert.equal(pointCollides(cfg, 100, 100, 20), false);
  // The continuous segment crosses the hazard at t=50.
  const hit = segmentCollides({ t0: 0, t1: 100, x0: 0, x1: 100 }, cfg, 20);
  assert.ok(hit, "the collision between samples must be detected");
  assert.ok(hit.t > 0 && hit.t < 100);

  // The analyser must never call this safe.
  const result = analyze(cfg);
  assert.notEqual(result.verdict, Verdict.SAFE, "a sampled-clear path is not a safety proof");
});

test("one-frame lag: the sweep band covers the delayed collision pose", () => {
  const cfg = makeConfig({
    hazard: {
      startX: 0,
      distance: 100,
      periodMs: 2000,
      width: 10,
      height: 100,
      anchorX: 0.5,
      anchorY: 1,
      y: 0,
      axis: "x",
    },
  });
  // At t=100, P=10, exact span [5,15]; player box [20,24] is clear.
  assert.equal(pointCollides(cfg, 20, 100, 0), false);
  // With lagMs=100, the hazard could have been 10px earlier: span [-5,25] ⇒ collision.
  assert.equal(pointCollides(cfg, 20, 100, 100), true);
  const span = hazardSpanAt(cfg.hazard, 100, 100);
  assert.ok(span.left <= 20 && span.right >= 24);
});

test("budget exhaustion returns INSUFFICIENT_EVIDENCE, never PROVEN_UNPLAYABLE", () => {
  const cfg = makeConfig({
    options: {
      ...makeConfig().options,
      limits: { maxStates: 10, timeBudgetMs: 10000 },
    },
  });
  const result = analyze(cfg);
  assert.equal(result.verdict, Verdict.INSUFFICIENT);
  assert.equal(result.reason, "search-budget-exhausted");
  assert.equal(result.stats.budgetExceeded, true);
  assert.notEqual(result.verdict, Verdict.UNPLAYABLE);
});

test("a missing lag bound is INSUFFICIENT_EVIDENCE (no exact-frame assumptions)", () => {
  const cfg = makeConfig({ options: { ...makeConfig().options, lagMs: undefined } });
  const result = analyze(cfg);
  assert.equal(result.verdict, Verdict.INSUFFICIENT);
  assert.equal(result.reason, "lag-bound-unspecified");
});
