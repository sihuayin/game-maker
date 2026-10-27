#!/usr/bin/env node
// Harness 自测（票 10）：gate / pickup / input / hazard-legacy。
// ⚠️ 不进五态交付场景集；只验证「探针/解释器仍能抓住已知的坏」。
// ⚠️ 复用 `probe-harness.mjs` 的 CDP/Chrome；不复制第三套浏览器基础设施。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PHASER_HOOK, StageError, assembleSiteForProbe, connectCdp, delay, findChrome,
  launchChrome, makePage, slimState, startServer, writeJson,
} from "../probe-harness.mjs";
import { runReport } from "./runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const DATE = new Date().toISOString().slice(0, 10);
const OUT = path.join(ROOT, `.scratch/playtest-v1/runs/${DATE}-self-test`);
const PACK = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7");
const CONFIG = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20e-site/game-config.json");
const RESET_MS = 30000;

const results = [];
const record = (name, ok, reason) => { results.push({ name, ok, reason }); console.log(`${ok ? "✅" : "❌"} ${name}${reason ? ` · ${reason}` : ""}`); };

function assemble(packDir, configPath, gameId) {
  return assembleSiteForProbe({ packDir, configPath, outRoot: path.join(OUT, "out"), gameId });
}

// ── gate：装配期拒绝 ────────────────────────────────────────────────────────
async function testGate() {
  const dir = path.join(OUT, "gate");
  fs.mkdirSync(dir, { recursive: true });
  const cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  cfg.objective = { ...cfg.objective, gate: "no-such-gate-for-self-test" };
  const cfgPath = path.join(dir, "config-gate-missing.json");
  writeJson(cfgPath, cfg);
  try {
    await assemble(PACK, cfgPath, "self-test-gate");
    return record("gate", false, "gate 指向不存在的 id，装配却成功了");
  } catch (e) {
    return record("gate", true, `按预期在装配期拒绝：${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── pickup / input：新 harness 的场景级自测 ─────────────────────────────────
async function testScenarios() {
  const site = await assemble(PACK, CONFIG, "self-test-scenarios");
  const scenarioDir = path.join(OUT, "scenarios");
  fs.mkdirSync(scenarioDir, { recursive: true });
  const pickup = JSON.parse(fs.readFileSync(path.join(HERE, "scenarios/five-state/failure-missing-pickup.json"), "utf8"));
  pickup.timeoutMs = 8000;
  // 自测夹具（旧 smoke 的 3 个 pickup）与 fpvs 真实配置的 4 个不同：断言值按夹具校准。
  const missingAssertion = pickup.assertions.find((a) => a.id === "missing-pickup");
  if (missingAssertion) missingAssertion.expect.value = 3;
  for (const a of pickup.actions) if (a.kind === "wait_until") a.timeoutMs = 8000;
  writeJson(path.join(scenarioDir, "failure-missing-pickup.json"), pickup);
  fs.copyFileSync(path.join(HERE, "scenarios/self-test/input-blocked.json"), path.join(scenarioDir, "input-blocked.json"));

  const out = path.join(OUT, "report");
  const result = await runReport({ siteDir: site.siteDir, scenarioDir, outDir: out, command: "self-test", repeat: 1 });
  const report = JSON.parse(fs.readFileSync(path.join(out, "attempt-v1/result.json"), "utf8"));
  const byId = Object.fromEntries(report.scenarios.map((s) => [s.scenarioId, s]));

  const p = byId["failure-missing-pickup"];
  const missing = p?.assertions.find((a) => a.id === "missing-pickup");
  record("pickup", missing?.result === "fail" && p?.initialState.activePickups === 2,
    `initialActivePickups=${p?.initialState.activePickups} · missing-pickup=${missing?.result}`);

  const i = byId["input-blocked"];
  const progress = (i?.endState.playerX ?? 0) - (i?.initialState.playerX ?? 0);
  record("input", i !== undefined && i.terminationReached === false && Math.abs(progress) < 5,
    `progress=${progress.toFixed(1)}px · termination=${i?.terminationReached}`);
  return result;
}

// ── hazard-legacy：页面会话猴子补丁旧 hitHazard，验证 reset-floor 仍能抓住 ──
function shouldJump(st, ctx) {
  if (!st.onFloor) return false;
  if (Date.now() - ctx.lastJumpAt < 240) return false;
  const onRaised = st.bottom < ctx.floorY - 10;
  const blocked = st.blockedRight || st.touchingRight;
  const climbable = !onRaised && st.solids.some((s) => s.x > st.x && s.x - st.x < 80 && s.y < st.bottom - 10 && s.y > st.bottom - 90);
  if (climbable) return blocked || ctx.stuck;
  if (onRaised) {
    const under = st.solids.filter((s) => Math.abs(s.y - st.bottom) <= 2 && s.x < st.right && s.x + s.w > st.left).sort((a, b) => (a.x + a.w) - (b.x + b.w))[0];
    if (under) {
      const rightEdge = under.x + under.w;
      const pickupBelow = st.pickups.some((p) => p.active && Math.abs(p.x - st.x) < 48 && p.y > st.bottom + 5);
      if (pickupBelow) return false;
      const next = st.hazards.filter((h) => h.x > st.x).sort((a, b) => a.x - b.x)[0];
      const hazardOverPlatform = next && next.x <= rightEdge + 30 && next.x - st.x < 60;
      if (hazardOverPlatform) return true;
      return st.x >= rightEdge + 8 || blocked || ctx.stuck;
    }
    return blocked || ctx.stuck;
  }
  const probe = st.right + 18;
  const groundAhead = st.solids.some((s) => s.y <= st.bottom + 8 && s.y >= st.bottom - 90 && s.x <= probe && s.x + s.w >= probe);
  const hazardAhead = st.hazards.some((h) => {
    if (!(h.x > st.x && h.x - st.x < 100 && Math.abs(h.y - st.y) < 90)) return false;
    if (h.distance > 0 && h.periodMs > 0) {
      const phase = ((h.t0 ?? 0) % h.periodMs) / h.periodMs;
      if (phase >= 0.5) return false;
    }
    return true;
  });
  const pickupAbove = st.pickups.some((p) => p.active && p.x > st.x && p.x - st.x < 130 && p.y < st.bottom - 20);
  return blocked || !groundAhead || hazardAhead || pickupAbove || ctx.stuck;
}
function shouldJumpForHazard(st, ctx) {
  if (!st.onFloor) return false;
  if (Date.now() - ctx.lastJumpAt < 240) return false;
  const onRaised = st.bottom < ctx.floorY - 10;
  if (onRaised) {
    const next = st.hazards.filter((h) => h.x > st.x).sort((a, b) => a.x - b.x)[0];
    return next ? st.x >= next.x - 60 : shouldJump(st, ctx);
  }
  return shouldJump(st, ctx);
}

async function triggerReset(page, dir, { floorY, attempt }) {
  const t0 = Date.now();
  const trace = [];
  const first = await page.readState();
  const ctx = {
    floorY, lastJumpAt: 0, stuck: false, prevX: first.x, progressX: first.x, progressAt: Date.now(),
    jumpedElevated: false, lastAirborneAt: 0, lastState: first, resetState: null, resetAirborne: false,
  };
  await page.keyDownRight();
  try {
    const deadline = Date.now() + RESET_MS;
    while (Date.now() < deadline) {
      const st = await page.readState();
      if (!st) { await delay(40); continue; }
      trace.push({ t: Date.now() - t0, ...slimState(st) });
      if (ctx.prevX > 200 && st.x < 100) {
        ctx.resetState = st;
        ctx.resetAirborne = !!(ctx.jumpedElevated && ctx.lastAirborneAt && Date.now() - ctx.lastAirborneAt <= 250);
        break;
      }
      if (st.x > ctx.progressX + 0.5) { ctx.progressX = st.x; ctx.progressAt = Date.now(); }
      ctx.stuck = Date.now() - ctx.progressAt > 450;
      if (ctx.jumpedElevated && !st.onFloor) ctx.lastAirborneAt = Date.now();
      if (shouldJumpForHazard(st, ctx)) {
        const onRaised = st.onFloor && st.bottom < floorY - 10;
        if (onRaised) ctx.jumpedElevated = true;
        await page.jump(ctx);
      }
      ctx.lastState = st; ctx.prevX = st.x;
      await delay(35);
    }
  } finally {
    await page.keyUpRight().catch(() => {});
  }
  if (!ctx.resetState) throw new StageError("reset-sequence", `第 ${attempt} 次：${RESET_MS}ms 内没有触发 hazard 重置（trace samples=${trace.length}）`);
  if (!ctx.resetAirborne) throw new StageError("reset-sequence", `第 ${attempt} 次：重置发生了，但不是「从抬高面起跳、空中撞 hazard」的序列`);
  const frames = await page.sampleFrames(30);
  const baseline = ctx.lastState ?? ctx.resetState;
  const failures = [];
  const maxBottom = Math.max(...frames.map((f) => f.bottom));
  if (maxBottom > floorY + 1) failures.push({ stage: "reset-floor", reason: `重置后 30 帧内 body.bottom 最大 ${maxBottom.toFixed(2)} > floorY+1 (${(floorY + 1).toFixed(2)})` });
  if (!frames.some((f) => f.onFloor)) failures.push({ stage: "reset-floor", reason: "重置后 30 帧内 onFloor 没有变真" });
  const stateChanged = frames.find((f) => f.collected !== baseline.collected || f.won !== baseline.won);
  if (stateChanged) failures.push({ stage: "reset-state", reason: `重置后 collected/won 变了：${baseline.collected}/${baseline.won} → ${stateChanged.collected}/${stateChanged.won}` });
  const rest = frames.filter((f) => f.onFloor);
  await page.shot(dir, `reset-${attempt}.png`).catch(() => {});
  return { attempt, failures, restBottom: rest.length ? rest[rest.length - 1].bottom : null, maxBottom };
}

async function testHazardLegacy() {
  const site = await assemble(PACK, CONFIG, "self-test-hazard");
  const chrome = findChrome();
  const server = await startServer(site.gameRoot);
  const browser = await launchChrome(chrome, path.join(OUT, "chrome.log"));
  let cdp;
  try {
    cdp = await connectCdp(browser.page.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PHASER_HOOK });
    const page = makePage(cdp);
    const urlPath = path.relative(site.gameRoot, path.join(site.siteDir, "index.html")).split(path.sep).join("/");
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/${urlPath}` });
    const start = await page.waitForScene(20000);
    const floorY = await page.waitForFloor();
    const patched = await page.evaluate(`(()=>{
      const g = window.__gmGame;
      const s = g && g.scene && g.scene.getScene('shell');
      if (!s) return false;
      const sx = ${JSON.stringify(start.x)}, sy = ${JSON.stringify(start.y)};
      s.hitHazard = function () {
        if (!this.player || this.won) return;
        this.player.setPosition(sx, sy);
        this.player.setVelocity(0, 0);
      };
      return true;
    })()`);
    if (!patched) throw new Error("拿不到 shell 场景，无法补丁 hitHazard");
    const dir = path.join(OUT, "hazard-legacy");
    fs.mkdirSync(dir, { recursive: true });
    const b = await triggerReset(page, dir, { floorY, attempt: 1 });
    record("hazard-legacy", b.failures.length > 0, b.failures.length > 0
      ? `旧实现按预期在 reset-floor 失败：${b.failures.map((f) => f.reason).join("；")}`
      : "旧实现竟然通过了 30 帧检查 —— 自测失去判别力");
  } catch (e) {
    record("hazard-legacy", false, e instanceof Error ? e.message : String(e));
  } finally {
    if (cdp) cdp.close();
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // 每次自测重新装配，保证 site 版本是 v1（场景契约绑定 v1）。
  fs.rmSync(path.join(OUT, "out"), { recursive: true, force: true });
  console.log(`Playtest self-test · 证据 ${OUT}`);
  await testGate();
  await testScenarios();
  await testHazardLegacy();
  const allOk = results.every((r) => r.ok);
  writeJson(path.join(OUT, "summary.json"), { at: new Date().toISOString(), ok: allOk, results });
  console.log(allOk ? "\n✅ 自测全绿" : "\n❌ 自测有失败项");
  process.exitCode = allOk ? 0 : 1;
}

main().catch((e) => { console.error(`❌ self-test 失败：${e instanceof Error ? e.stack ?? e.message : String(e)}`); process.exitCode = 1; });
