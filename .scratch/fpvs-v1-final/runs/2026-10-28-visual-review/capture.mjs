#!/usr/bin/env node
// FA-04 视觉人工审核 · 材料采集（只读站点，零付费）。
//
// 从 FA-01 冻结的**工作区**站点（与只读快照字节一致）执行 FA-02 同一条通关动作序列，
// 在真实运行时截取审核所需的画面：启动 / 移动 / 跳跃 / 收集 / 宝箱 / 危险物等待 / 危险物跨越 / 到达目标。
// ⚠️ 不写站点字节（只通过 CDP 只读探针 + 真实按键）；截图只落本目录；站点完整性前后哈希记录。
// 用法：node .scratch/fpvs-v1-final/runs/2026-10-28-visual-review/capture.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const WORK = path.resolve(ROOT, ".scratch/fpvs-v1-final/work/wasteland-scavenger-recipe");
const SITE = path.join(WORK, "site/v1");
const SHOTS = path.join(HERE, "shots");
const SCENARIO_FILE = path.resolve(ROOT, ".scratch/fpvs-v1-final/scenarios/acceptance/acceptance-win-wasteland-v1.json");

const H = await import(pathToFileURL(path.join(ROOT, "packages/demo/probe/probe-harness.mjs")).href);
const { createObserver } = await import(pathToFileURL(path.join(ROOT, "packages/demo/probe/playtest/observe.mjs")).href);
const { createPolicy, decide, markJump, noteObservation, targetReached } =
  await import(pathToFileURL(path.join(ROOT, "packages/demo/probe/playtest/policy.mjs")).href);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const siteHashes = () => Object.fromEntries(
  fs.readdirSync(SITE).sort().filter((f) => fs.statSync(path.join(SITE, f)).isFile())
    .map((f) => [f, sha(path.join(SITE, f))]),
);
const delay = H.delay;

const scenario = readJson(SCENARIO_FILE);
const site = readJson(path.join(SITE, "site.json"));
const config = readJson(path.join(SITE, site.config));
const manifest = readJson(path.join(WORK, `pack/v${String(site.pack).replace(/^v/, "")}/manifest.json`));

fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

const before = siteHashes();
const shots = [];
const input = [];
let server, browser, cdp, page;

const t0 = Date.now();
const elapsed = () => Date.now() - t0;
const send = async (type, key, code, vk, source) => {
  input.push({ type, key, code, t: elapsed(), seq: input.length, source });
  await page.key(type, key, code, vk);
};
const errorsOf = () => ({ console: page.consoleErrors(), exceptions: page.exceptions });
const captured = new Set();
async function captureOnce(file, st, tag) {
  if (captured.has(file)) return;
  captured.add(file);
  await page.shot(SHOTS, file);
  shots.push({
    file: `shots/${file}`, t: elapsed(), tag,
    state: st === null ? null : {
      x: st.x, y: st.y, bottom: st.bottom, onFloor: st.onFloor,
      collected: st.collected, won: st.won,
      chestsOpened: st.chests.filter((c) => c.opened).length,
      hazards: st.hazards.map((h) => ({ x: +h.x.toFixed(1), y: h.y })),
    },
  });
  console.log(`  📸 ${file} @${elapsed()}ms (${tag})`);
}

try {
  server = await H.startServer(WORK);
  browser = await H.launchChrome(H.findChrome(), path.join(HERE, "chrome.log"));
  cdp = await H.connectCdp(browser.page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: H.PHASER_HOOK });
  page = H.makePage(cdp);
  const url = `http://127.0.0.1:${server.address().port}/site/v1/index.html`;
  console.log(`site: ${SITE}\nurl:  ${url}`);
  await cdp.send("Page.navigate", { url });
  const initial = await page.waitForScene(20000);
  const floorY = await page.waitForFloor();
  await delay(600); // HUD / 动画首帧稳定

  const obs = createObserver({ scenario, spawn: { x: initial.x, y: initial.y } });
  const policy = createPolicy({ floorY, spawn: { x: initial.x, y: initial.y }, move: config?.player?.move });
  obs.record(await page.readState(), 0, errorsOf());

  // 01 · 启动：出生点、HUD、背景（未按任何键）
  await captureOnce("01-startup.png", await page.readState(), "startup");

  const deadline = t0 + Math.min(scenario.timeoutMs, 150000);
  const stepDelay = scenario.stepDelayMs;
  let lastCollected = initial.collected ?? 0;
  let lastChests = (initial.chests ?? []).filter((c) => c.opened).length;

  async function runMoveTo(target, actionKind) {
    let rightDown = false;
    const setRight = async (down) => {
      if (down === rightDown) return;
      rightDown = down;
      await send(down ? "keyDown" : "keyUp", "ArrowRight", "ArrowRight", 39, actionKind);
    };
    await setRight(true);
    try {
      while (Date.now() < deadline) {
        const st = await page.readState();
        obs.record(st, elapsed(), errorsOf());
        if (!st) { await delay(stepDelay); continue; }
        noteObservation(st, policy);
        if (targetReached(st, target) || obs.terminationReached(scenario.termination)) return "completed";

        const d = decide(st, policy);
        const chestsOpened = st.chests.filter((c) => c.opened).length;
        const hazardNear = st.hazards.some((h) => Math.abs(st.x - h.x) <= 70);
        const hazardAhead = st.hazards.find((h) => h.x > st.x && h.x - st.x < 140);

        if (st.onFloor && st.x >= 200) await captureOnce("02-movement.png", st, "moving right");
        if (!st.onFloor) await captureOnce("03-jump.png", st, "airborne (platform/jump)");
        if (st.collected > lastCollected) {
          lastCollected = st.collected;
          await captureOnce("04-pickup.png", st, "pickup collected");
        }
        if (chestsOpened > lastChests) {
          lastChests = chestsOpened;
          await captureOnce("05-chest-open.png", st, "chest opened");
        }
        if (!d.advance && hazardAhead && st.onFloor) {
          await captureOnce("06-hazard-wait.png", st, "waiting outside patrol band");
        }
        if (!st.onFloor && hazardNear) {
          await captureOnce("07-hazard-cross.png", st, "airborne over patroller");
        }
        if (st.won) await captureOnce("08-goal.png", st, "goal reached");

        await setRight(d.advance);
        if (d.jump) { markJump(policy); await send("keyDown", " ", "Space", 32, actionKind); await delay(50); await send("keyUp", " ", "Space", 32, actionKind); }
        await delay(stepDelay);
      }
      return "timeout";
    } finally {
      await setRight(false);
    }
  }

  for (const action of scenario.actions) {
    if (Date.now() >= deadline) break;
    if (action.kind === "move_to") {
      const outcome = await runMoveTo(action.target, action.kind);
      console.log(`  action ${action.kind} → ${outcome}`);
      if (outcome === "timeout") break;
    } else if (action.kind === "reach_goal") {
      const outcome = await runMoveTo({ kind: "gate" }, action.kind);
      console.log(`  action ${action.kind} → ${outcome}`);
      if (outcome === "timeout") break;
    } else if (action.kind === "wait_until") {
      const actionDeadline = Math.min(deadline, Date.now() + action.timeoutMs);
      while (Date.now() < actionDeadline) {
        const st = await page.readState();
        obs.record(st, elapsed(), errorsOf());
        if (st) {
          noteObservation(st, policy);
          if (st.won) { await captureOnce("08-goal.png", st, "goal reached"); break; }
          if (action.condition.kind === "collected" && st.collected >= action.condition.value) break;
        }
        await delay(stepDelay);
      }
    }
  }

  const final = await page.readState();
  obs.record(final, elapsed(), errorsOf());
  await captureOnce("09-final.png", final, "final state");
  await send("keyUp", "ArrowRight", "ArrowRight", 39, "cleanup");

  const after = siteHashes();
  const result = {
    format: "fpvs-visual-review-capture/v1",
    generatedAt: new Date().toISOString(),
    subject: {
      siteDir: path.relative(ROOT, SITE),
      packId: manifest.id, packVersion: manifest.version,
      siteVersion: Number(/^v(\d+)$/.exec(path.basename(SITE))?.[1]), shellVersion: String(site.shell),
      manifestChecksum: sha(path.join(WORK, `pack/v${String(site.pack).replace(/^v/, "")}/manifest.json`)),
      configChecksum: sha(path.join(SITE, site.config)),
    },
    run: {
      scenario: scenario.id,
      won: !!final?.won,
      collected: final?.collected ?? 0,
      chestsOpened: (final?.chests ?? []).filter((c) => c.opened).length,
      resets: obs.eventCounts().reset ?? 0,
      runtimeErrors: obs.eventCounts()["runtime-error"] ?? 0,
      steps: obs.steps,
      durationMs: elapsed(),
    },
    shots,
    siteIntegrity: { before, after, unchanged: JSON.stringify(before) === JSON.stringify(after) },
  };
  fs.writeFileSync(path.join(HERE, "capture.json"), JSON.stringify(result, null, 2) + "\n");
  fs.writeFileSync(path.join(SHOTS, "..", "events.jsonl"), obs.events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  fs.writeFileSync(path.join(SHOTS, "..", "trace.jsonl"), obs.history.map((e) => JSON.stringify(e)).join("\n") + "\n");
  fs.writeFileSync(path.join(SHOTS, "..", "input.jsonl"), input.map((e) => JSON.stringify(e)).join("\n") + "\n");
  fs.writeFileSync(path.join(SHOTS, "..", "console.json"), JSON.stringify(page.consoleEntries, null, 2) + "\n");
  fs.writeFileSync(path.join(SHOTS, "..", "exceptions.json"), JSON.stringify(page.exceptions, null, 2) + "\n");
  console.log(`\n${result.run.won ? "✅ 通关" : "❌ 未通关"} · collected=${result.run.collected} · resets=${result.run.resets} · shots=${shots.length} · site unchanged=${result.siteIntegrity.unchanged}`);
  process.exitCode = result.run.won && result.siteIntegrity.unchanged ? 0 : 1;
} finally {
  if (cdp) cdp.close();
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
}
