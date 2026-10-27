// 试玩 harness 的执行层（票 07）：站点身份 → 场景契约 → Chrome → 观测产物 → 报告。
//
// ⚠️ 本层**不实现五态归因**（票 08）：`result.json` 里的 `outcome` / `aggregate` 缺席，
//   由 08 的归因器填入。这里只保证「同一场景 + 同版本绑定 + 同判定规则 ⇒ 判定确定的证据」。
// ⚠️ 外壳零改动：只通过 CDP 注入只读探针（`READ_STATE` / `PHASER_HOOK`），不写站点字节。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  PLAYTEST_HARNESS_VERSION, PLAYTEST_RULES_VERSION, PLAYTEST_SCENARIO_VERSION,
  PlaytestEventSchema, PlaytestInputEventSchema, PlaytestReportSchema, PlaytestScenarioSchema, aggregateAssertions, playtestProjectionOf, samePlaytestProjection,
} from "@game-maker/contracts";
import {
  CHROME_FLAGS, INPUT_BLOCKER, connectCdp, delay, findChrome, launchChrome, makePage, startServer, writeJson,
} from "../probe-harness.mjs";
import { PHASER_HOOK } from "../probe-harness.mjs";
import { createObserver } from "./observe.mjs";
import { createPolicy, markJump, noteObservation, shouldJump, targetReached } from "./policy.mjs";

const ZERO_END = { collected: 0, won: false, hits: 0, chestsOpened: 0, activePickups: 0, playerX: null };
const ZERO_INITIAL = { collected: 0, won: false, hits: 0, chestsOpened: 0, activePickups: 0 };
const ALL_EVENT_TYPES = [
  "scene-ready", "spawn", "pickup", "win", "chest-open", "danger-hit", "danger-erupt",
  "land", "jump", "reset", "runtime-error",
];
const SCENARIO_EVIDENCE = ["playtest-events", "playtest-trace", "playtest-input", "playtest-console", "playtest-exceptions"];

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha256File = (p) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;
const msgOf = (e) => (e instanceof Error ? e.message : String(e));

/** 从 site 目录解析实际产物身份（票 02 Q3：主绑 site，pack/config 从 site 依赖解析）。 */
export function resolveTarget({ siteDir, packDir }) {
  const siteVersion = Number(/^v(\d+)$/.exec(path.basename(siteDir))?.[1]);
  if (!Number.isInteger(siteVersion) || siteVersion <= 0) throw new Error(`site 目录名不是 v<N>：${siteDir}`);
  const site = readJson(path.join(siteDir, "site.json"));
  const gameRoot = path.dirname(path.dirname(siteDir)); // <gameId>/site/v<N> → <gameId>
  const packVersion = Number(String(site.pack ?? "").replace(/^v/, ""));
  if (!Number.isInteger(packVersion) || packVersion <= 0) throw new Error(`site.json 的 pack 不是 v<N>：${JSON.stringify(site.pack)}`);
  const resolvedPack = packDir ?? path.join(gameRoot, "pack", `v${packVersion}`);
  const manifest = readJson(path.join(resolvedPack, "manifest.json"));
  const configPath = path.join(siteDir, site.config);
  return {
    siteDir, gameRoot, site, siteVersion, packDir: resolvedPack, packVersion, manifest, configPath,
    configChecksum: sha256File(configPath),
    packChecksum: sha256File(path.join(resolvedPack, "manifest.json")),
    shellVersion: String(site.shell),
  };
}

/** 加载场景目录；版本/绑定不匹配进 `rejections`，不伪装成已执行。 */
export function loadScenarios({ scenarioDir, target }) {
  const files = fs.readdirSync(scenarioDir).filter((f) => f.endsWith(".json")).sort();
  const scenarios = [];
  const rejections = [];
  for (const file of files) {
    let raw;
    try { raw = readJson(path.join(scenarioDir, file)); }
    catch (e) { rejections.push({ file, reason: `读不出 JSON：${msgOf(e)}` }); continue; }
    if (raw?.formatVersion !== PLAYTEST_SCENARIO_VERSION) {
      rejections.push({ file, scenarioId: raw?.id, reason: `不支持的场景格式版本：${JSON.stringify(raw?.formatVersion)}（支持 ${PLAYTEST_SCENARIO_VERSION}）` });
      continue;
    }
    const parsed = PlaytestScenarioSchema.safeParse(raw);
    if (!parsed.success) {
      rejections.push({ file, scenarioId: raw?.id, reason: "场景契约不过 schema", issues: parsed.error.issues });
      continue;
    }
    if (parsed.data.target.siteVersion !== target.siteVersion) {
      rejections.push({ file, scenarioId: parsed.data.id, reason: `目标 site v${parsed.data.target.siteVersion} 与实际 v${target.siteVersion} 不匹配` });
      continue;
    }
    scenarios.push({ file, scenario: parsed.data });
  }
  return { scenarios, rejections };
}

function notExecutedScenario(scenario, reason) {
  return {
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    required: scenario.required,
    harnessCondition: scenario.harnessCondition,
    expectedOutcome: scenario.expectedOutcome,
    baselineEligible: scenario.baselineEligible,
    execution: { status: "not-executed", reason },
    terminationReached: false,
    assertions: [],
    assertionAggregate: "unknown",
    endState: { ...ZERO_END },
    initialState: { ...ZERO_INITIAL },
    actions: [],
    comparableEvents: [...scenario.comparableEvents],
    eventCounts: Object.fromEntries(ALL_EVENT_TYPES.map((t) => [t, 0])),
    evidence: [],
    durationMs: 0,
    steps: 0,
  };
}

function createKeyboard(page, sink) {
  let seq = 0;
  const t0 = Date.now();
  const send = async (type, key, code, vk, source) => {
    sink.push({ type, key, code, t: Date.now() - t0, seq: seq++, source });
    await page.key(type, key, code, vk);
  };
  return {
    downRight: (source) => send("keyDown", "ArrowRight", "ArrowRight", 39, source),
    upRight: (source) => send("keyUp", "ArrowRight", "ArrowRight", 39, source),
    jump: async (source) => {
      await send("keyDown", " ", "Space", 32, source);
      await delay(50);
      await send("keyUp", " ", "Space", 32, source);
    },
  };
}

async function applySetup(page, setup) {
  if (setup.kind === "none") return { kind: "none", applied: true };
  if (setup.kind === "remove-pickup") {
    const out = await page.evaluate(`(()=>{
      const g = window.__gmGame;
      const s = g && g.scene && g.scene.getScene('shell');
      if (!s) return { ok:false, reason:'拿不到 shell 场景' };
      const active = (s.pickups || []).filter((p) => p.active);
      const p = active[${setup.index}];
      if (!p) return { ok:false, reason:'没有第 ${setup.index} 个 active pickup' };
      const where = { x: p.x, y: p.y };
      p.destroy();
      return { ok:true, removed: where, left: (s.pickups || []).filter((q) => q.active).length };
    })()`);
    return out?.ok ? { kind: "remove-pickup", applied: true, ...out } : { kind: "remove-pickup", applied: false, reason: out?.reason ?? "未知" };
  }
  if (setup.kind === "mutate-hazard") {
    const out = await page.evaluate(`(()=>{
      const g = window.__gmGame;
      const s = g && g.scene && g.scene.getScene('shell');
      if (!s) return { ok:false, reason:'拿不到 shell 场景' };
      const h = (s.hazards || [])[${setup.index}];
      if (!h) return { ok:false, reason:'没有第 ${setup.index} 个 hazard' };
      const before = { distance: h.distance, periodMs: h.periodMs };
      h.distance = ${setup.distance};
      ${setup.periodMs === undefined ? "" : `h.periodMs = ${setup.periodMs};`}
      h.t0 = 0;
      return { ok:true, before, after: { distance: h.distance, periodMs: h.periodMs } };
    })()`);
    return out?.ok ? { kind: "mutate-hazard", applied: true, ...out } : { kind: "mutate-hazard", applied: false, reason: out?.reason ?? "未知" };
  }
  return { kind: setup.kind, applied: false, reason: "不认识的 setup" };
}

async function runMoveTo({ page, scenario, action, target, deadline, obs, policy, kb, errorsOf, elapsed }) {
  await kb.downRight(action.kind);
  try {
    while (Date.now() < deadline) {
      const st = await page.readState();
      obs.record(st, elapsed(), errorsOf());
      if (!st) { await delay(scenario.stepDelayMs); continue; }
      noteObservation(st, policy);
      if (targetReached(st, target) || obs.terminationReached(scenario.termination)) return "completed";
      if (shouldJump(st, policy)) { markJump(policy); await kb.jump(action.kind); }
      await delay(scenario.stepDelayMs);
    }
    return "timeout";
  } finally {
    await kb.upRight(action.kind);
  }
}

async function runWaitUntil({ page, scenario, action, deadline, obs, policy, errorsOf, elapsed }) {
  const actionDeadline = Math.min(deadline, Date.now() + action.timeoutMs);
  while (Date.now() < actionDeadline) {
    const st = await page.readState();
    obs.record(st, elapsed(), errorsOf());
    if (st) {
      noteObservation(st, policy);
      if (action.condition.kind === "won" && st.won) return "completed";
      if (action.condition.kind === "collected" && st.collected >= action.condition.value) return "completed";
    }
    await delay(scenario.stepDelayMs);
  }
  return "timeout";
}

async function runScenario({ page, scenario, dir, target, command }) {
  fs.mkdirSync(dir, { recursive: true });
  const startedAt = Date.now();
  page.clearLog();
  let start;
  try {
    start = scenario.harnessCondition === "input-blocked"
      ? await page.reload({ preScripts: [INPUT_BLOCKER] })
      : await page.reload();
  } catch (e) {
    const report = notExecutedScenario(scenario, `boot 失败：${msgOf(e)}`);
    writeJson(path.join(dir, "console.json"), page.consoleEntries);
    writeJson(path.join(dir, "exceptions.json"), page.exceptions);
    return report;
  }
  let floorY;
  try {
    floorY = await page.waitForFloor();
  } catch (e) {
    const report = notExecutedScenario(scenario, `spawn 失败：${msgOf(e)}`);
    writeJson(path.join(dir, "console.json"), page.consoleEntries);
    writeJson(path.join(dir, "exceptions.json"), page.exceptions);
    return report;
  }

  const setup = await applySetup(page, scenario.setup);
  writeJson(path.join(dir, "setup.json"), setup);
  if (!setup.applied) return notExecutedScenario(scenario, `setup 失败：${setup.reason ?? "未知"}`);

  // ⚠️ 初始观测必须在 setup **之后**：`failure-missing-pickup` 的证据就落在初始态 pickup 缺失上。
  const initial = await page.readState();
  if (!initial) return notExecutedScenario(scenario, "setup 后读不到状态");
  const t0 = Date.now();
  const elapsed = () => Date.now() - t0;
  const obs = createObserver({ scenario, spawn: { x: initial.x, y: initial.y } });
  const policy = createPolicy({ floorY, spawn: { x: initial.x, y: initial.y } });
  const input = [];
  const kb = createKeyboard(page, input);
  const errorsOf = () => ({ console: page.consoleErrors(), exceptions: page.exceptions });
  const deadline = t0 + scenario.timeoutMs;
  const actions = [];

  obs.record(initial, 0, errorsOf());

  if (scenario.harnessCondition === "hang") {
    const a0 = Date.now();
    while (Date.now() < deadline) {
      const st = await page.readState();
      obs.record(st, elapsed(), errorsOf());
      if (st) noteObservation(st, policy);
      await delay(scenario.stepDelayMs);
    }
    actions.push({ kind: "hang", outcome: "timeout", durationMs: Date.now() - a0, steps: obs.steps });
  } else {
    for (const action of scenario.actions) {
      if (Date.now() >= deadline) {
        actions.push({ kind: action.kind, outcome: "skipped", durationMs: 0, steps: 0 });
        continue;
      }
      const a0 = Date.now();
      let outcome = "failed";
      if (action.kind === "move_to") outcome = await runMoveTo({ page, scenario, action, target: action.target, deadline, obs, policy, kb, errorsOf, elapsed });
      else if (action.kind === "reach_goal") outcome = await runMoveTo({ page, scenario, action, target: { kind: "gate" }, deadline, obs, policy, kb, errorsOf, elapsed });
      else if (action.kind === "jump_over") outcome = await runMoveTo({ page, scenario, action, target: { kind: "gate" }, deadline, obs, policy, kb, errorsOf, elapsed });
      else if (action.kind === "wait_until") outcome = await runWaitUntil({ page, scenario, action, deadline, obs, policy, errorsOf, elapsed });
      else if (action.kind === "assert_state") outcome = "completed";
      actions.push({ kind: action.kind, outcome, durationMs: Date.now() - a0, steps: obs.steps });
      if (outcome === "timeout") break;
    }
  }

  await kb.upRight("cleanup");
  const final = await page.readState();
  obs.record(final, elapsed(), errorsOf());

  const assertions = obs.assertionResults();
  const scenarioReport = {
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    required: scenario.required,
    harnessCondition: scenario.harnessCondition,
    expectedOutcome: scenario.expectedOutcome,
    baselineEligible: scenario.baselineEligible,
    execution: "executed",
    terminationReached: obs.terminationReached(scenario.termination),
    assertions,
    assertionAggregate: aggregateAssertions(assertions),
    endState: obs.endState(),
    initialState: obs.initialState(),
    actions,
    comparableEvents: [...scenario.comparableEvents],
    eventCounts: obs.eventCounts(),
    evidence: [...SCENARIO_EVIDENCE],
    durationMs: Date.now() - startedAt,
    steps: obs.steps,
  };

  // 落盘前按契约校验：params 按事件类型、source 真实性、input 字段集（票 03 Q5 / 票 05 Q1）。
  for (const ev of obs.events) PlaytestEventSchema.parse(ev);
  for (const ev of input) PlaytestInputEventSchema.parse(ev);
  const lines = (xs) => xs.map((x) => JSON.stringify(x)).join("\n") + "\n";
  fs.writeFileSync(path.join(dir, "events.jsonl"), lines(obs.events));
  fs.writeFileSync(path.join(dir, "trace.jsonl"), lines(obs.history));
  fs.writeFileSync(path.join(dir, "input.jsonl"), lines(input));
  writeJson(path.join(dir, "console.json"), page.consoleEntries);
  writeJson(path.join(dir, "exceptions.json"), page.exceptions);
  return scenarioReport;
}

function finalizeReport({ target, command, startedAt, reports, scenarioTimeoutMs }) {
  const executed = reports.filter((s) => s.execution === "executed");
  const execution = executed.length > 0
    ? "executed"
    : { status: "not-executed", reason: reports.find((s) => s.execution !== "executed")?.execution.reason ?? "没有场景执行" };
  return PlaytestReportSchema.parse({
    reportVersion: "playtest-report/v1",
    identity: {
      scenarioFormatVersion: PLAYTEST_SCENARIO_VERSION,
      siteVersion: target.siteVersion,
      packId: target.manifest.id,
      packVersion: target.manifest.version,
      packChecksum: target.packChecksum,
      configChecksum: target.configChecksum,
      shellVersion: target.shellVersion,
      harnessVersion: PLAYTEST_HARNESS_VERSION,
      rulesVersion: PLAYTEST_RULES_VERSION,
    },
    command,
    exitCode: 0,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    execution,
    scenarios: reports,
    runtime: {
      pollIntervalMs: 50, stepDelayMs: 35,
      scenarioTimeoutMs: scenarioTimeoutMs ?? Math.max(1, ...reports.map((s) => s.durationMs ?? 1)),
      viewport: { w: 1000, h: 600 }, deviceScaleFactor: 1, chromeFlags: [...CHROME_FLAGS],
    },
    evidence: executed.length > 0
      ? ["playtest-events", "playtest-trace", "playtest-input", "playtest-console", "playtest-exceptions", "playtest-chrome"]
      : [],
  });
}

function notExecutedReport({ target, scenarios, command, reason, startedAt }) {
  const reports = scenarios.map(({ scenario }) => notExecutedScenario(scenario, reason));
  return finalizeReport({ target, command, startedAt, reports, scenarioTimeoutMs: Math.max(1, ...scenarios.map((s) => s.scenario.timeoutMs)) });
}

async function runOnce({ target, scenarios, attemptDir, command }) {
  const startedAt = Date.now();
  fs.mkdirSync(attemptDir, { recursive: true });

  // `no-chrome` 是 harness 条件场景：不启动浏览器，直接记 not-executed（票 02 分层）。
  const noChrome = scenarios.filter(({ scenario }) => scenario.harnessCondition === "no-chrome");
  const runnable = scenarios.filter(({ scenario }) => scenario.harnessCondition !== "no-chrome");
  if (runnable.length === 0) {
    const reports = scenarios.map(({ scenario }) => notExecutedScenario(scenario, "harness 条件：no-chrome（不启动浏览器）"));
    return finalizeReport({ target, command, startedAt, reports, scenarioTimeoutMs: Math.max(1, ...scenarios.map((s) => s.scenario.timeoutMs)) });
  }

  let chrome;
  try { chrome = findChrome(); }
  catch (e) { return notExecutedReport({ target, scenarios, command, reason: `环境故障：${msgOf(e)}`, startedAt }); }

  let server;
  let browser;
  let cdp;
  try {
    server = await startServer(target.gameRoot);
    browser = await launchChrome(chrome, path.join(attemptDir, "chrome.log"));
    cdp = await connectCdp(browser.page.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: PHASER_HOOK });
    const page = makePage(cdp);
    const urlPath = path.relative(target.gameRoot, path.join(target.siteDir, "index.html")).split(path.sep).join("/");
    const url = `http://127.0.0.1:${server.address().port}/${urlPath}`;
    await cdp.send("Page.navigate", { url });
    try { await page.waitForScene(20000); }
    catch (e) { return notExecutedReport({ target, scenarios, command, reason: `boot 失败：${msgOf(e)}`, startedAt }); }

    const byId = new Map();
    for (const { scenario } of noChrome)
      byId.set(scenario.id, notExecutedScenario(scenario, "harness 条件：no-chrome（不启动浏览器）"));
    for (const { scenario } of runnable) {
      const dir = path.join(attemptDir, scenario.id);
      byId.set(scenario.id, await runScenario({ page, scenario, dir, target, command }));
    }
    const reports = scenarios.map(({ scenario }) => byId.get(scenario.id));
    return finalizeReport({ target, command, startedAt, reports, scenarioTimeoutMs: Math.max(1, ...scenarios.map((s) => s.scenario.timeoutMs)) });
  } catch (e) {
    return notExecutedReport({ target, scenarios, command, reason: `harness 环境故障：${msgOf(e)}`, startedAt });
  } finally {
    if (cdp) cdp.close();
    if (browser) await browser.close();
    if (server) await new Promise((r) => server.close(r));
  }
}

/** 运行一次或多次；每次一个新 attempt 目录，绝不覆盖历史 attempt。 */
export async function runReport({ siteDir, packDir, scenarioDir, outDir, command, repeat = 1 }) {
  const startedAt = new Date().toISOString();
  const target = resolveTarget({ siteDir, packDir });
  const { scenarios, rejections } = loadScenarios({ scenarioDir, target });
  fs.mkdirSync(outDir, { recursive: true });
  writeJson(path.join(outDir, "rejections.json"), rejections);
  if (scenarios.length === 0) throw new Error("没有可执行的场景（全部被拒绝或目录为空）—— 见 rejections.json");

  const attempts = [];
  for (let i = 1; i <= repeat; i++) {
    const attemptDir = path.join(outDir, `attempt-v${i}`);
    fs.mkdirSync(attemptDir, { recursive: true });
    const before = siteHashes(target);
    const report = await runOnce({ target, scenarios, attemptDir, command });
    const after = siteHashes(target);
    const integrity = { before, after, unchanged: JSON.stringify(before) === JSON.stringify(after) };
    writeJson(path.join(attemptDir, "site-integrity.json"), integrity);
    writeJson(path.join(attemptDir, "result.json"), report);
    attempts.push({ dir: attemptDir, report, integrity });
  }

  const projectionByScenario = new Map();
  for (const a of attempts)
    for (const s of a.report.scenarios) {
      if (!projectionByScenario.has(s.scenarioId)) projectionByScenario.set(s.scenarioId, []);
      projectionByScenario.get(s.scenarioId).push(playtestProjectionOf(s));
    }
  const comparisons = [...projectionByScenario.entries()].map(([scenarioId, ps]) => ({
    scenarioId,
    runs: ps.length,
    same: ps.every((p) => samePlaytestProjection(ps[0], p)),
    projections: ps,
  }));
  const determinism = { repeat, same: comparisons.every((c) => c.same), comparisons };
  writeJson(path.join(outDir, "determinism.json"), determinism);
  writeJson(path.join(outDir, "summary.json"), {
    startedAt,
    command, siteDir, packDir: target.packDir, scenarioDir, outDir, repeat,
    identity: { siteVersion: target.siteVersion, packId: target.manifest.id, packVersion: target.manifest.version, shellVersion: target.shellVersion },
    rejections,
    attempts: attempts.map((a) => ({
      dir: a.dir,
      execution: a.report.execution,
      scenarios: a.report.scenarios.map((s) => ({
        scenarioId: s.scenarioId, execution: s.execution, assertionAggregate: s.assertionAggregate,
        terminationReached: s.terminationReached, steps: s.steps,
      })),
      siteUnchanged: a.integrity.unchanged,
    })),
    determinism,
  });
  return { target, attempts, rejections, determinism };
}

function siteHashes(target) {
  const files = ["index.html", "shell.js", "site.json", target.site.config];
  return Object.fromEntries(files.map((f) => [f, sha256File(path.join(target.siteDir, f))]));
}
