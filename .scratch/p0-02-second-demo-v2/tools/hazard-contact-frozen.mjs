#!/usr/bin/env node
// 票 09 的 effort-local E3：在**只读冻结快照**上驱动玩家撞上 patroller-1，断言命中计数与复位。
//
//   node .scratch/p0-02-second-demo-v2/tools/hazard-contact-frozen.mjs [--diagnostic]
//
// ⚠️ 默认原样使用冻结 config（patroller-1 在 x=340、往返 100px / 3s）：按住右键进入巡逻带，
//   松开后等待一个周期。只有实测相位不可控时才允许 `--diagnostic`：在内存里把第一个 hazard
//   改成静止并移到 x=160，产物与 summary 会明确标记 diagnostic。
// ⚠️ 只读快照，绝不写入；装配站点、诊断 config、summary 都写本 effort 的 runs/。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ROOT, delay, writeJson, slimState, findChrome, launchChrome, connectCdp, makePage,
  PHASER_HOOK, startServer, assembleSiteForProbe,
} from '../../../packages/demo/probe/probe-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EFFORT = path.resolve(HERE, '..');
const SNAPSHOT = path.resolve(ROOT, '.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe');
const PACK = path.join(SNAPSHOT, 'pack', 'v1');
const CONFIG = path.join(SNAPSHOT, 'run', 'v1', 'game-config.json');
const OUT = path.join(EFFORT, 'runs', '09-hazard-contact-frozen');
const DIAGNOSTIC = process.argv.includes('--diagnostic');

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(root, d.name);
    return d.isDirectory() ? walk(p) : d.isFile() ? [p] : [];
  });
}
function snapshotHash() {
  const entries = walk(SNAPSHOT).sort().map((p) => {
    const rel = path.relative(SNAPSHOT, p).split(path.sep).join('/');
    return `${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}  ${rel}\n`;
  });
  return crypto.createHash('sha256').update(entries.join('')).digest('hex');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const before = snapshotHash();

  // ⚠️ ESM 里没有 require；这里用 spawnSync 读 Chrome 版本（与 probe 同一条路径）。
  const chrome = findChrome();
  let version = '';
  try {
    const r = spawnSync(chrome, ['--version'], { encoding: 'utf8', timeout: 15000 });
    version = (r.stdout ?? '').trim();
  } catch { version = '(读不到 --version)'; }

  let configPath = CONFIG;
  if (DIAGNOSTIC) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    const h = (cfg.entities ?? []).find((e) => e.kind === 'hazard');
    if (!h) throw new Error('冻结 config 没有 hazard，无法构造诊断变体');
    h.at = { ...(h.at ?? {}), x: 160 };
    delete h.motion;
    configPath = path.join(OUT, 'diagnostic-config.json');
    writeJson(configPath, cfg);
  }

  const assembleRoot = path.join(OUT, 'assembled');
  const site = await assembleSiteForProbe({ packDir: PACK, configPath, outRoot: assembleRoot, gameId: 'hazard-frozen' });
  const server = await startServer(assembleRoot);
  const addr = server.address();
  const browser = await launchChrome(chrome, path.join(OUT, 'chrome.log'));
  let cdp = null;
  const samples = [];
  let failures = [];
  let maxX = 0;
  let hazardHits = 0;
  let resetObserved = false;
  try {
    cdp = await connectCdp(browser.page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PHASER_HOOK });
    const page = makePage(cdp);
    const urlPath = path.relative(assembleRoot, path.join(site.siteDir, 'index.html')).split(path.sep).join('/');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${addr.port}/${urlPath}` });
    await page.waitForScene(20000);

    const st0 = await page.readState();
    if (!st0) throw new Error('首次读取状态失败');
    const spawnX = st0.x;
    const record = async (st) => { if (!st) return; samples.push(slimState(st)); maxX = Math.max(maxX, st.x); };
    await record(st0);

    // 按住右键进入巡逻带（或已经命中），然后松开等待一个周期。
    await page.keyDownRight();
    try {
      const t0 = Date.now();
      while (Date.now() - t0 < 15000) {
        const st = await page.readState();
        await record(st);
        const hits = (st?.hazards ?? []).reduce((n, h) => n + (h.hits ?? 0), 0);
        hazardHits = Math.max(hazardHits, hits);
        if (hits > 0) break;
        if (st && st.x >= (spawnX + 340)) break; // 进入巡逻带
        await delay(40);
      }
    } finally {
      await page.keyUpRight().catch(() => {});
    }
    // 等一个 3s 周期；如果还没命中，继续采样到超时。
    {
      const t0 = Date.now();
      while (Date.now() - t0 < 4000) {
        const st = await page.readState();
        await record(st);
        const hits = (st?.hazards ?? []).reduce((n, h) => n + (h.hits ?? 0), 0);
        hazardHits = Math.max(hazardHits, hits);
        if (hits > 0) break;
        await delay(40);
      }
    }
    await delay(200);
    const final = await page.readState();
    await record(final);

    // 复位：命中之后出现一帧回到 spawn（±5px）。
    const hitIdx = samples.findIndex((s) => (s.hazards ?? []).some((h) => (h.hits ?? 0) > 0));
    resetObserved = hitIdx >= 0 && samples.slice(hitIdx).some((s) => Math.abs(s.x - spawnX) <= 5);
    if (hazardHits < 1) failures.push(`hazard 命中计数=${hazardHits} < 1`);
    if (!resetObserved) failures.push(`命中后没有观察到复位到 spawn（spawn x=${spawnX}）`);
    if (page.consoleErrors().length > 0 || page.exceptions.length > 0)
      failures.push(`页面有错误：console.error ${page.consoleErrors().length} / 异常 ${page.exceptions.length}`);
    await page.writeLogs(OUT).catch(() => {});

    const after = snapshotHash();
    writeJson(path.join(OUT, 'summary.json'), {
      at: new Date().toISOString(),
      mode: DIAGNOSTIC ? 'diagnostic' : 'frozen-config',
      pack: PACK, config: configPath, snapshot: SNAPSHOT,
      chrome: version, node: process.version,
      spawnX, maxX, hazardHits, resetObserved,
      failures,
      snapshotSha256Before: before, snapshotSha256After: after, snapshotUnchanged: before === after,
      samples,
    });
    console.log(`${failures.length === 0 ? '✅' : '❌'} hazard-contact frozen · mode=${DIAGNOSTIC ? 'diagnostic' : 'frozen-config'}`);
    console.log(`  spawn x=${spawnX} · maxX=${maxX} · hazardHits=${hazardHits} · reset=${resetObserved}`);
    console.log(`  snapshot unchanged=${before === after} · samples=${samples.length}`);
    if (failures.length) console.log(`  failures: ${failures.join('；')}`);
    console.log(`  证据：${OUT}`);
    process.exitCode = failures.length === 0 ? 0 : 1;
  } catch (e) {
    failures.push(e instanceof Error ? e.message : String(e));
    writeJson(path.join(OUT, 'summary.json'), {
      at: new Date().toISOString(), mode: DIAGNOSTIC ? 'diagnostic' : 'frozen-config',
      pack: PACK, config: configPath, snapshot: SNAPSHOT, failures, samples,
      snapshotSha256Before: before, snapshotSha256After: snapshotHash(),
    });
    console.error(`❌ ${failures.join('；')}`);
    process.exitCode = 1;
  } finally {
    if (cdp) cdp.close();
    await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
