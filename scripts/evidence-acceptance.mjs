#!/usr/bin/env node
// `pnpm test:evidence` —— 对冻结交付跑一次**正式**证据完整性验收，并留下本次运行记录。
//
// ⚠️ 它不是单元测试：会读约 18 MB 证据、跑 `verify-delivery` 的完整校验；不要把 `pnpm test` 扩成它。
// ⚠️ 每次运行写到新目录（CLI 原子分配 + 本脚本的 summary 目录都绝不覆盖历史）。
//
// 用法：node scripts/evidence-acceptance.mjs [--manifest <清单>] [--out <目录>]
//   · 默认清单：`.scratch/evidence-integrity-v1/manifest/expected-hashes.json`（票 03 冻结的基线）
//   · 默认输出：`.scratch/evidence-integrity-v1/runs`
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? path.resolve(ROOT, args[i + 1]) : fallback;
};
const MANIFEST = flag("manifest", path.join(ROOT, ".scratch/evidence-integrity-v1/manifest/expected-hashes.json"));
const OUT = flag("out", path.join(ROOT, ".scratch/evidence-integrity-v1/runs"));
const CLI = path.join(ROOT, "packages/cli/dist/cli.mjs");
const sha256 = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

if (!fs.existsSync(CLI)) {
  console.error(`✗ 找不到已构建的 CLI：${CLI} —— 先跑 pnpm build（本命令通常由 pnpm test:evidence 带 build）`);
  process.exit(1);
}
if (!fs.existsSync(MANIFEST)) {
  console.error(`✗ 找不到清单：${MANIFEST}`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const startedAt = new Date();
const t0 = Date.now();
let stdout = "", stderr = "", exitCode = 0;
try {
  stdout = execFileSync(process.execPath, [CLI, "verify-delivery", "--manifest", MANIFEST, "--out", OUT, "--json"], {
    encoding: "utf8", cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
  });
} catch (e) {
  exitCode = typeof e.status === "number" ? e.status : 1;
  stdout = String(e.stdout ?? "");
  stderr = String(e.stderr ?? "");
}
const durationMs = Date.now() - t0;

const reports = fs.existsSync(OUT)
  ? fs.readdirSync(OUT).filter((n) => n.endsWith("-delivery-verification")).sort()
  : [];
const newest = reports.length === 0 ? undefined : path.join(OUT, reports[reports.length - 1]);
const reportPath = newest === undefined ? undefined : path.join(newest, "report.json");
let report;
let problems = [];
if (reportPath === undefined || !fs.existsSync(reportPath)) {
  problems.push("没有找到本次运行生成的 report.json");
} else {
  try { report = JSON.parse(fs.readFileSync(reportPath, "utf8")); }
  catch (e) { problems.push(`report.json 不可解析：${e instanceof Error ? e.message : String(e)}`); }
  if (!fs.existsSync(path.join(newest, "report.md"))) problems.push("缺 report.md");
}
if (exitCode !== 0) problems.push(`CLI 退出码 ${exitCode}（期望 0）`);
if (report !== undefined) {
  if (report.format !== "delivery-verification/v1") problems.push(`report.format=${report.format}`);
  if (report.status !== "pass") problems.push(`report.status=${report.status}（期望 pass）`);
  if (report.recomputed?.verdict !== "pass") problems.push(`recomputed.verdict=${report.recomputed?.verdict}`);
  if (report.comparison?.verdictMatch !== true) problems.push("declared verdict 与 recomputed 不一致");
  if (!Array.isArray(report.comparison?.checks) || report.comparison.checks.some((c) => !c.match))
    problems.push("六项检查存在 declared↔recomputed 不一致");
}

const pass = problems.length === 0;
const summaryDir = (() => {
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  for (let n = 1; ; n += 1) {
    const dir = path.join(OUT, n === 1 ? `${stamp}-test-evidence` : `${stamp}-${n}-test-evidence`);
    try { fs.mkdirSync(dir); return dir; } catch (e) { if (e.code !== "EEXIST") throw e; }
  }
})();
const summary = {
  format: "evidence-acceptance-run/v1",
  generatedAt: new Date().toISOString(),
  command: `node packages/cli/dist/cli.mjs verify-delivery --manifest ${path.relative(ROOT, MANIFEST)} --out ${path.relative(ROOT, OUT)} --json`,
  manifest: path.relative(ROOT, MANIFEST),
  manifestSha256: sha256(MANIFEST),
  exitCode,
  durationMs,
  reportDir: newest === undefined ? null : path.relative(ROOT, newest),
  reportSha256: reportPath === undefined || !fs.existsSync(reportPath) ? null : sha256(reportPath),
  reportJsonBytes: reportPath === undefined || !fs.existsSync(reportPath) ? null : fs.statSync(reportPath).size,
  files: report?.scope?.files ?? null,
  records: report?.scope?.records ?? null,
  manifestFiles: manifest.files.length,
  manifestBytes: manifest.files.reduce((n, f) => n + (f.bytes ?? 0), 0),
  status: report?.status ?? null,
  declaredVerdict: report?.declared?.verdict ?? null,
  recomputedVerdict: report?.recomputed?.verdict ?? null,
  checks: report?.comparison?.checks ?? [],
  diagnostics: report?.diagnostics?.length ?? null,
  pass,
  problems,
  stderr: stderr.trim() === "" ? null : stderr.trim().slice(0, 4000),
};
fs.writeFileSync(path.join(summaryDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");

console.log(`${pass ? "✅" : "❌"} 证据完整性基线验收：${report?.status ?? "(无报告)"} · exit ${exitCode} · ${durationMs}ms`);
console.log(`   清单：${summary.manifest} · ${summary.manifestFiles} 文件 / ${(summary.manifestBytes / 1024 / 1024).toFixed(1)} MB · sha ${summary.manifestSha256.slice(0, 19)}…`);
if (report !== undefined)
  console.log(`   报告：${summary.reportDir}/report.json · ${summary.files.total} 文件（required ${summary.files.required}）· ${summary.records} 条记录 · 诊断 ${summary.diagnostics}`);
for (const p of problems) console.error(`   ✗ ${p}`);
console.log(`   本次运行记录：${path.relative(ROOT, path.join(summaryDir, "summary.json"))}`);
process.exitCode = pass ? 0 : 1;
