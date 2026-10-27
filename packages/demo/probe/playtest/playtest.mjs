#!/usr/bin/env node
// Playtest V1 harness 入口（票 07）。⚠️ 这不是交付 CLI（票 08）：这里只跑 harness、
// 落观测报告；`delivery` 写回与 0/1/2/4 的交付语义归 08。
//
// 用法：
//   node packages/demo/probe/playtest/playtest.mjs --site <site/vN> [--pack <pack/vN>] \
//     [--scenario-dir <目录>] [--out <目录>] [--repeat 2] [--json]
//
// 依赖：Node 22（内置 fetch/WebSocket）、系统 Chrome、已构建的 `pnpm build`。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeJson } from "../probe-harness.mjs";
import { runReport } from "./runner.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SCENARIO_DIR = path.join(HERE, "scenarios/five-state");
const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_OUT = path.join(HERE, "../../../..", ".scratch/playtest-v1/runs", `${TODAY}-playtest`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    out[key] = val;
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));
if (!ARGS.site || ARGS.site === true) {
  console.error("用法：node packages/demo/probe/playtest/playtest.mjs --site <site/vN> [--pack <pack/vN>] [--scenario-dir <目录>] [--out <目录>] [--repeat 2] [--json]");
  process.exit(2);
}
const siteDir = path.resolve(ARGS.site);
const packDir = typeof ARGS.pack === "string" ? path.resolve(ARGS.pack) : undefined;
const scenarioDir = path.resolve(typeof ARGS.scenarioDir === "string" ? ARGS.scenarioDir : DEFAULT_SCENARIO_DIR);
const outDir = path.resolve(typeof ARGS.out === "string" ? ARGS.out : DEFAULT_OUT);
const repeat = typeof ARGS.repeat === "string" ? Number(ARGS.repeat) : 1;
const command = `node ${process.argv.slice(1).join(" ")}`;

function printSummary(result) {
  const { target, attempts, rejections, determinism } = result;
  console.log(`\nPlaytest V1 · ${target.manifest.id} v${target.manifest.version} · site v${target.siteVersion}`);
  console.log(`  site: ${target.siteDir}`);
  console.log(`  pack: ${target.packDir}`);
  console.log(`  场景: ${scenarioDir}`);
  console.log(`  证据: ${outDir}`);
  if (rejections.length) {
    console.log(`  ⚠️ 拒绝 ${rejections.length} 个场景：`);
    for (const r of rejections) console.log(`    · ${r.file}: ${r.reason}`);
  }
  for (const a of attempts) {
    console.log(`  attempt ${path.basename(a.dir)} · ${a.report.execution === "executed" ? "executed" : "not-executed"} · 站点字节未改=${a.integrity.unchanged}`);
    for (const s of a.report.scenarios) {
      const exec = s.execution === "executed" ? "executed" : `not-executed (${s.execution.reason})`;
      console.log(`    · ${s.scenarioId}: ${exec} · 断言=${s.assertionAggregate} · 终止=${s.terminationReached} · steps=${s.steps}`);
    }
  }
  console.log(`  判定确定性（${determinism.repeat} 次）: ${determinism.same ? "✅ 一致" : "❌ 不一致"}`);
  for (const c of determinism.comparisons) console.log(`    · ${c.scenarioId}: ${c.same ? "一致" : "不一致"}`);
}

try {
  const result = await runReport({ siteDir, packDir, scenarioDir, outDir, command, repeat });
  if (ARGS.json) console.log(JSON.stringify({
    siteDir, packDir: result.target.packDir, scenarioDir, outDir, repeat,
    rejections: result.rejections, determinism: result.determinism,
    attempts: result.attempts.map((a) => ({ dir: a.dir, report: a.report, integrity: a.integrity })),
  }, null, 2));
  else printSummary(result);
  const executed = result.attempts.some((a) => a.report.execution === "executed");
  const exitCode = executed && result.determinism.same ? 0 : 1;
  writeJson(path.join(outDir, "exit.json"), { command, exitCode, at: new Date().toISOString(), outDir });
  process.exitCode = exitCode;
} catch (e) {
  const msg = e instanceof Error ? e.stack ?? e.message : String(e);
  console.error(`\n❌ playtest harness 失败：${msg}`);
  process.exitCode = /没有可执行的场景/.test(String(e?.message ?? e)) ? 4 : 1;
}
