#!/usr/bin/env node
/**
 * 机制化 QA probe（票 15）—— 每个机制一条可运行的运行时断言。
 *
 * 它回答「这条机制**真的在运行时发生**了吗」：不是看 config 里有没有字段，而是 headless Chrome
 * 里读运行时状态逐条断（文档 FR-06 / 风险三）。与 playtest 自测/runner 共用
 * `probe-harness.mjs` 的 Chrome/CDP/状态探针。
 *
 *   node packages/demo/probe/mechanic-probe.mjs [--out <dir>] [--only <mechanicId>]
 *
 * 依赖：Node 22、系统 Chrome、已构建的 `packages/demo/dist`（`pnpm build`）。
 *
 * probe 结果 = 覆盖报告的**QA 层**（票 06 裁定）：`{ mechanicId, passed, failures[] }`，
 * 由 [票 07 的覆盖报告](../...) 消费；它**不进** `deriveMechanicStatus`（status 仍是运行时层）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QA_PROBED_MECHANICS } from '@game-maker/contracts';
import {
  ROOT, delay, writeJson, slimState,
  findChrome, launchChrome, connectCdp, makePage, PHASER_HOOK, startServer, assembleSiteForProbe,
} from './probe-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.dirname(HERE);

/** 已验收的 last-train 包（fixtures/packs/last-train/v2）—— 零付费真包。 */
const PACK = path.join(ROOT, 'fixtures/packs/last-train/v2');

const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_OUT = path.join(ROOT, '.scratch/intent-to-mechanics-v1/runs', `${TODAY}-mechanic-probe`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    out[key] = val;
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ARGS.out ?? process.env.MECHANIC_PROBE_OUT ?? DEFAULT_OUT);
const ONLY = typeof ARGS.only === 'string' ? ARGS.only : null;

// ── 夹具：一份最小但合法的 game-config ──────────────────────────────────────
// 世界 480×270 = 视口；玩家在左、终点在右。所有资源 id 取自 last-train 包。
function baseConfig() {
  return {
    format: 'game-config/v1',
    world: { size: { w: 480, h: 270 } },
    scene: { background: { asset: 'bg-dusk-halt' } },
    player: { asset: 'player-traveler', anims: { idle: 'idle', run: 'run', jump: 'jump' }, at: { x: 40, y: 250 } },
    terrain: [{ x: 0, y: 250, w: 480, h: 20 }],
    entities: [],
    hud: {
      panel: { asset: 'hud-lost-slots', at: { x: 8, y: 262 }, size: { w: 72, h: 32 } },
      pip: { asset: 'hud-pip', at: { x: 12, y: 250 }, step: { x: 20, y: 0 } },
    },
    objective: { kind: 'collect-then-reach', gate: 'goal' },
  };
}

const GOAL = { id: 'goal', kind: 'goal', at: { x: 440, y: 230 }, asset: 'signal-endlight', anim: 'red' };

// ── probe 定义：{ mechanicId, config, run, assert } ─────────────────────────
//   config: () => game-config 对象（runner 落盘 → 装配）
//   run: async (page, ctx) => { samples[] }   —— 驱动 + 采样（读 READ_STATE）
//   assert: (samples) => string[]（失败原因；空数组 = 过）

/** 通用驱动：按住 → 每 50ms 采样 → 命中谓词或超时。 */
async function walkUntil(page, predicate, timeoutMs = 15000) {
  const samples = [];
  const t0 = Date.now();
  await page.keyDownRight();
  try {
    while (Date.now() - t0 < timeoutMs) {
      const st = await page.readState();
      if (st) samples.push(st);
      if (st && predicate(st)) break;
      await delay(50);
    }
  } finally {
    await page.keyUpRight().catch(() => {});
  }
  return samples;
}

const probes = [
  {
    mechanicId: 'collect-pickup',
    config: () => {
      const c = baseConfig();
      c.entities = [
        { id: 'p1', kind: 'pickup', at: { x: 200, y: 240 }, asset: 'pickup-suitcase' },
        GOAL,
      ];
      return c;
    },
    run: (page) => walkUntil(page, (st) => st.won),
    assert: (samples) => {
      const last = samples[samples.length - 1];
      const fail = [];
      if (!last || !last.won) fail.push(`没赢（samples=${samples.length}，last.won=${last?.won ?? 'null'}）`);
      if (!last || last.collected < 1) fail.push(`collected=${last?.collected ?? 'null'} < 1`);
      return fail;
    },
  },

  {
    mechanicId: 'open-chest',
    config: () => {
      const c = baseConfig();
      c.entities = [
        // 宝箱：近距自动触发（range 外扩 24px）。asset 用 carriage 的两帧当 closed/open。
        { id: 'chest-1', kind: 'chest', at: { x: 200, y: 240 }, asset: 'hazard-sweeping-carriage', anim: 'sweep', range: 24 },
        GOAL,
      ];
      return c;
    },
    run: async (page) => {
      const opened = (st) => st.chests.some((c) => c.opened);
      const samples = await walkUntil(page, opened);
      // 打开后再驻留 ~600ms：验证「一次性」—— collected 不该再涨。
      const afterOpen = [];
      const t0 = Date.now();
      while (Date.now() - t0 < 600) { const st = await page.readState(); if (st) afterOpen.push(st); await delay(50); }
      return { samples, afterOpen };
    },
    assert: ({ samples, afterOpen }) => {
      const fail = [];
      const open = samples[samples.length - 1];
      if (!open || !open.chests.some((c) => c.opened)) fail.push(`宝箱没打开（samples=${samples.length}）`);
      if (!open || open.collected !== 1) fail.push(`开箱后 collected=${open?.collected ?? 'null'}，期望 1`);
      const peak = Math.max(0, ...afterOpen.map((st) => st.collected));
      if (peak > 1) fail.push(`一次性失效：驻留后 collected 涨到 ${peak}`);
      return fail;
    },
  },

  {
    mechanicId: 'avoid-danger',
    config: () => {
      const c = baseConfig();
      c.entities = [
        { id: 'p1', kind: 'pickup', at: { x: 300, y: 240 }, asset: 'pickup-suitcase' },
        // danger 用大 body 盖住玩家出生点（box x≈40..160），玩家原地站着即可被喷发命中。
        { id: 'danger-1', kind: 'danger', at: { x: 100, y: 250 }, asset: 'signal-endlight', anim: 'red', body: { w: 120, h: 60 }, strike: { periodMs: 400, activeMs: 400 } },
        GOAL,
      ];
      return c;
    },
    run: async (page) => {
      // 不驱动：玩家站在出生点（danger 盒内）。只采样 2.4s，观察状态周期与命中。
      const samples = [];
      const t0 = Date.now();
      while (Date.now() - t0 < 2400) { const st = await page.readState(); if (st) samples.push(st); await delay(40); }
      return { samples };
    },
    assert: ({ samples }) => {
      const fail = [];
      const states = new Set(samples.map((st) => st.dangers[0]?.state).filter(Boolean));
      if (!states.has('idle') || !states.has('active'))
        fail.push(`danger 状态没有在 idle↔active 之间循环（观察到 ${[...states].join('/') || '无'}）`);
      const hits = Math.max(0, ...samples.map((st) => st.dangers[0]?.hits ?? 0));
      if (hits === 0) fail.push('active 窗口内玩家在 danger 区内却没有命中（hits=0）');
      return fail;
    },
  },
];

// ── 主流程 ──────────────────────────────────────────────────────────────────

async function main() {
  // 自证：probe 清单与 `QA_PROBED_MECHANICS`（词表转录）**同源** —— 加/删一条 probe 忘了改词表，当场响。
  const listed = [...QA_PROBED_MECHANICS].sort();
  const defined = probes.map((p) => p.mechanicId).sort();
  if (JSON.stringify(listed) !== JSON.stringify(defined)) {
    console.error(`probe 清单与 QA_PROBED_MECHANICS 不同源：词表 [${listed}] vs 本文件 [${defined}]`);
    process.exit(2);
  }

  const list = ONLY ? probes.filter((p) => p.mechanicId === ONLY) : probes;
  if (list.length === 0) {
    console.error(`不认识的 --only ${JSON.stringify(ONLY)}（认得的：${probes.map((p) => p.mechanicId).join('|')}）`);
    process.exit(2);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const chrome = findChrome();
  const { execFileSync } = await import('node:child_process');
  let chromeVersion = '';
  try { chromeVersion = execFileSync(chrome, ['--version'], { encoding: 'utf8', timeout: 15000 }).trim(); }
  catch (e) { chromeVersion = `(读不到 --version：${e instanceof Error ? e.message : String(e)})`; }

  const meta = {
    startedAt: new Date().toISOString(), pack: PACK, out: OUT, chrome, chromeVersion, node: process.version,
    mechanics: list.map((p) => p.mechanicId),
  };
  console.log(`Chrome: ${chromeVersion}`);
  console.log(`包: ${PACK}`);
  console.log(`证据: ${OUT}`);

  // 1) 每个 probe 落盘 config + 装配站点（同一 outRoot，各自 gameId）
  const assembled = [];
  const assembleRoot = path.join(OUT, 'assembled');
  for (const p of list) {
    const dir = path.join(OUT, p.mechanicId);
    fs.mkdirSync(dir, { recursive: true });
    const configPath = path.join(dir, 'config.json');
    writeJson(configPath, p.config());
    try {
      const site = await assembleSiteForProbe({ packDir: PACK, configPath, outRoot: assembleRoot, gameId: p.mechanicId });
      assembled.push({ p, dir, site });
      console.log(`  装配 ${p.mechanicId}: ${site.gameRoot}`);
    } catch (e) {
      // 装配期失败本身就是一个失败结果（config 不合法），不静默跳过
      assembled.push({ p, dir, site: null, assembleError: e instanceof Error ? e.message : String(e) });
      console.log(`  ❌ 装配 ${p.mechanicId} 失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2) 起服务 + Chrome
  const server = await startServer(assembleRoot);
  const addr = server.address();
  const browser = await launchChrome(chrome, path.join(OUT, 'chrome.log'));
  let cdp = null;
  const results = [];

  try {
    cdp = await connectCdp(browser.page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PHASER_HOOK });
    const page = makePage(cdp);

    for (const { p, dir, site, assembleError } of assembled) {
      const t0 = Date.now();
      const result = { mechanicId: p.mechanicId, passed: false, failures: [], durationMs: 0, out: dir };
      try {
        if (!site || assembleError) {
          result.failures.push(`装配失败：${assembleError ?? '未知'}`);
        } else {
          const urlPath = path.relative(assembleRoot, path.join(site.siteDir, 'index.html')).split(path.sep).join('/');
          const url = `http://127.0.0.1:${addr.port}/${urlPath}`;
          await cdp.send('Page.navigate', { url });
          await page.waitForScene(20000);
          const out = await p.run(page);
          const failures = p.assert(out);
          result.failures = failures;
          result.passed = failures.length === 0;
          result.samples = out.samples ? out.samples.map(slimState) : undefined;
        }
      } catch (e) {
        result.failures.push(e instanceof Error ? e.message : String(e));
      }
      result.durationMs = Date.now() - t0;
      result.passed = result.failures.length === 0;
      // ⚠️ 运行时不得有 console.error / 未捕获异常（与新 playtest harness 同一条判据）
      const errs = page.consoleErrors();
      if (errs.length || page.exceptions.length) {
        result.failures.push(`页面有错误：console.error ${errs.length} 条 / 未捕获异常 ${page.exceptions.length} 条` + (errs.length ? `；首条：${errs[0].text}` : ''));
        result.passed = false;
      }
      await page.writeLogs(dir).catch(() => {});
      writeJson(path.join(dir, 'result.json'), result);
      results.push(result);
      console.log(`${result.passed ? '✅' : '❌'} ${p.mechanicId} · ${(result.durationMs / 1000).toFixed(1)}s` + (result.failures.length ? ` · ${result.failures.join('；')}` : ''));
    }
  } finally {
    if (cdp) cdp.close();
    await browser.close();
    await new Promise((r) => server.close(r));
  }

  const allOk = results.every((r) => r.passed);
  writeJson(path.join(OUT, 'summary.json'), { ...meta, allOk, probes: results });
  console.log(`\n${allOk ? '✅ 机制 probe 全绿' : '❌ 有失败项'} —— 证据在 ${OUT}`);
  process.exitCode = allOk ? 0 : 1;
}

main().catch((e) => {
  console.error(`\n❌ probe 失败（harness）：${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exit(1);
});
