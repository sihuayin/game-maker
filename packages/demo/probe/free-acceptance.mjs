#!/usr/bin/env node
/**
 * 免费验收闭环（票 10）—— 意图→机制契约的**收口判据**，不碰生图/文本上游。
 *
 * 三样都绿才过（任一失败 = 免费验收失败，留证据、不隐藏）：
 *   ① 单元 + witness 全过（`pnpm test`）；
 *   ② 机制 probe 对 open-chest / avoid-danger 全绿（`mechanic-probe.mjs`）；
 *   ③ 覆盖报告：open-chest / avoid-danger 三层（设计 / 运行时 / QA）全 `satisfied`。
 *
 *   证据：`<out>/vitest.log`（命令 + 退出码）· `<out>/probe/summary.json`（probe 真跑结果）·
 *         `<out>/mechanic-coverage.json`（覆盖报告）· `<out>/free-acceptance.json`（总判据）。
 *
 * 用法：`node packages/demo/probe/free-acceptance.mjs [--out <dir>]`（前置 `pnpm build`）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildMechanicCoverage, mechanicCoverageProblem } from '@game-maker/contracts';
import { ROOT, writeJson } from './probe-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.dirname(HERE);
const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_OUT = path.join(ROOT, '.scratch/intent-to-mechanics-v1/runs', `${TODAY}-free-acceptance`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    out[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ARGS.out ?? process.env.FREE_ACCEPTANCE_OUT ?? DEFAULT_OUT);

/** 废土寻宝那份设计的**机制清单**（W6 同款 + 两条新机制）。覆盖报告只读 `mechanics`。 */
const WASTELAND_MECHANICS = [
  'run', 'jump', 'gravity', 'collide-terrain',
  'collect-pickup', 'open-chest', 'avoid-danger', 'reach-goal',
];
const fixtureDesign = () => ({
  mechanics: WASTELAND_MECHANICS.map((mechanic, i) => ({ id: `m-${i}`, mechanic })),
});

function run(name, cmd, args, logFile) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const t0 = Date.now();
  try {
    const stdout = execFileSync(cmd, args, { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    return { name, ok: true, durationMs: Date.now() - t0, log: logFile, stdout };
  } catch (e) {
    fs.writeFileSync(logFile, String(e.stdout ?? '') + '\n' + String(e.stderr ?? ''));
    return { name, ok: false, durationMs: Date.now() - t0, log: logFile, exit: e.status, stderr: String(e.stderr ?? '') };
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const checks = [];

  // ① 单元 + witness
  checks.push(run('vitest', 'pnpm', ['test'], path.join(OUT, 'vitest.log')));

  // ② 机制 probe（真 Chrome）
  const probeOut = path.join(OUT, 'probe');
  checks.push(run('mechanic-probe', 'node', ['packages/demo/probe/mechanic-probe.mjs', '--out', probeOut], path.join(OUT, 'probe.log')));

  // ③ 覆盖报告：probe 真跑结果 → qa 层；两条新机制三层全 satisfied
  let coverage;
  let coverageProblem;
  let coverageOk = false;
  const summaryPath = path.join(probeOut, 'summary.json');
  try {
    const probeSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const probeResults = (probeSummary.probes ?? []).map((p) => ({ mechanic: p.mechanicId, passed: p.passed }));
    coverage = buildMechanicCoverage(fixtureDesign(), probeResults);
    coverageProblem = mechanicCoverageProblem(coverage);
    const required = ['open-chest', 'avoid-danger'];
    const fullySatisfied = required.every((id) => {
      const m = coverage.mechanics.find((x) => x.mechanic === id);
      return m && m.design === 'satisfied' && m.runtime === 'satisfied' && m.qa === 'satisfied';
    });
    coverageOk = coverage.verdict === 'satisfied' && coverageProblem === undefined && fullySatisfied;
    writeJson(path.join(OUT, 'mechanic-coverage.json'), coverage);
    checks.push({
      name: 'mechanic-coverage',
      ok: coverageOk,
      verdict: coverage.verdict,
      problem: coverageProblem,
      required,
      probeResults,
    });
  } catch (e) {
    coverageOk = false;
    checks.push({ name: 'mechanic-coverage', ok: false, reason: e instanceof Error ? e.message : String(e) });
  }

  const allOk = checks.every((c) => c.ok);
  writeJson(path.join(OUT, 'free-acceptance.json'), {
    startedAt: new Date().toISOString(), out: OUT, allOk,
    checks: checks.map((c) => ({ name: c.name, ok: c.ok, ...(c.exit !== undefined ? { exit: c.exit } : {}), ...(c.verdict !== undefined ? { verdict: c.verdict } : {}), ...(c.problem !== undefined ? { problem: c.problem } : {}) })),
  });

  for (const c of checks) {
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.verdict ? ` · ${c.verdict}` : ''}${c.ok ? '' : c.problem ? ` · ${c.problem.split('\n')[0]}` : ` · ${c.stderr ?? c.reason ?? ''}`.slice(0, 120)}`);
  }
  console.log(`\n${allOk ? '✅ 免费验收闭环全绿' : '❌ 免费验收失败'} —— 证据在 ${OUT}`);
  process.exitCode = allOk ? 0 : 1;
}

main().catch((e) => {
  console.error(`\n❌ 免费验收失败（脚本）：${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exit(1);
});
