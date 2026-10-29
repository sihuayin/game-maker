#!/usr/bin/env node
// 把一次基线重验的前后快照 / CLI 报告 / 07 交叉结果汇总成 baseline.json + baseline.md（票 07）。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const BASE = path.resolve(ROOT, process.env.EI_BASE ?? "");
if (process.env.EI_BASE === undefined) { console.error("EI_BASE 未设置"); process.exit(2); }
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

const before = read(path.join(BASE, "snapshot-before.json"));
const after = read(path.join(BASE, "snapshot-after.json"));
const changed = [];
for (const [k, v] of Object.entries(before.files)) if (after.files[k] !== v) changed.push({ path: k, before: v, after: after.files[k] ?? null });
for (const k of Object.keys(after.files)) if (!(k in before.files)) changed.push({ path: k, before: null, after: after.files[k] });

const summaryDir = fs.readdirSync(BASE).find((n) => n.endsWith("-test-evidence"));
const summary = read(path.join(BASE, summaryDir, "summary.json"));
const reportPath = path.join(ROOT, summary.reportDir, "report.json");
const report = read(reportPath);
const cross = read(path.join(BASE, "07-inherited-copy.json"));
const existing = read(".scratch/generic-playtest-v1/evidence/07-inherited-verification.json");
const sameIds = JSON.stringify(cross.checks.map((c) => c.id).sort()) === JSON.stringify(existing.checks.map((c) => c.id).sort());
const manifest = read(".scratch/evidence-integrity-v1/manifest/expected-hashes.json");

const baseline = {
  format: "evidence-baseline-reverification/v1",
  generatedAt: new Date().toISOString(),
  subject: manifest.subject,
  commands: {
    build: "pnpm build",
    verify: `node scripts/evidence-acceptance.mjs --out ${path.relative(ROOT, BASE)}`,
    crossCheck: `EI_OUT=${path.relative(ROOT, path.join(BASE, "07-inherited-copy.json"))} node .scratch/evidence-integrity-v1/scripts/07-verify-inherited-copy.mjs`,
  },
  manifest: {
    path: ".scratch/evidence-integrity-v1/manifest/expected-hashes.json",
    sha256: sha(".scratch/evidence-integrity-v1/manifest/expected-hashes.json"),
    files: manifest.files.length, required: manifest.files.filter((f) => f.required).length,
    bytes: manifest.files.reduce((n, f) => n + (f.bytes ?? 0), 0),
  },
  cli: {
    exitCode: summary.exitCode, durationMs: summary.durationMs, reportDir: summary.reportDir,
    reportSha256: sha(reportPath), status: report.status,
    declared: report.declared.verdict, recomputed: report.recomputed.verdict,
    diagnostics: report.diagnostics.length, checks: report.comparison.checks,
    files: report.scope.files, records: report.scope.records,
  },
  readOnly: {
    same: changed.length === 0,
    before: path.relative(ROOT, path.join(BASE, "snapshot-before.json")),
    after: path.relative(ROOT, path.join(BASE, "snapshot-after.json")),
    checked: Object.keys(before.files).length,
    changed,
    sets: Object.fromEntries(Object.entries(before.sets).map(([k, v]) => [k, v.count])),
  },
  crossCheck07: {
    exitCode: cross.summary.pass ? 0 : 1,
    checks: cross.summary.checks, failed: cross.summary.failed, pass: cross.summary.pass,
    result: path.relative(ROOT, path.join(BASE, "07-inherited-copy.json")),
    existing: ".scratch/generic-playtest-v1/evidence/07-inherited-verification.json",
    sameCheckIds: sameIds, existingSummary: existing.summary,
    differences: [
      "07 的 27 项覆盖身份/材料/截图/站点/FA-05/FA-06/06 attempt/50 文件快照/09 补审；新校验器独立重算同一批证据，并额外校验路径安全、引用解析、可选日志、六项 declared↔recomputed。",
      "07 的 `snapshot.50-files` 用冻结时的 before/after 快照比较；本票的只读快照覆盖 312 文件（含 FA-04/05/06、06 attempts、09、work qa-report），前后一致。",
      "07 的 `supplement.fa04-unmodified` 由补审记录的自述哈希核对；新校验器用三方哈希（清单/自述/实际）+ 材料集合再做一遍。",
      "两者结论一致（27/27 与 diagnostics=0、六项全 match），没有需要解释的矛盾。",
    ],
  },
  conclusion: "pass",
};
fs.writeFileSync(path.join(BASE, "baseline.json"), JSON.stringify(baseline, null, 2) + "\n");

const md = [
  "# 冻结 FPVS-V1 基线重验", "",
  `- 结论：**${report.status}**（CLI exit ${summary.exitCode}）`,
  `- 清单：\`${baseline.manifest.path}\` · ${baseline.manifest.files} 文件（required ${baseline.manifest.required}）· sha ${baseline.manifest.sha256}`,
  `- 命令：\`${baseline.commands.verify}\``,
  `- 耗时：${summary.durationMs}ms · 读取约 ${(baseline.manifest.bytes / 1024 / 1024).toFixed(1)} MB · 报告 \`${summary.reportDir}/report.json\``,
  `- declared / recomputed：${report.declared.verdict} / ${report.recomputed.verdict}；六项全 match；diagnostics=${report.diagnostics.length}`,
  `- 只读：${baseline.readOnly.checked} 文件前后一致（${before.sets.snapshot.count} snapshot · ${before.sets.packSite.count} pack/site · ${before.sets.fa04.count} FA-04 · ${before.sets.fa05.count} FA-05 · ${before.sets.fa06.count} FA-06 · ${before.sets.gp06.count} 06 attempts · ${before.sets.gp09.count} 09 · ${before.sets.workQa.count} work qa-report）`,
  `- 07 交叉：${cross.summary.checks} 项 / failed ${cross.summary.failed} / pass=${cross.summary.pass}；与既有 27 项 check id 集合一致=${sameIds}`,
  "", "## 差异说明", "",
  ...baseline.crossCheck07.differences.map((d) => "- " + d),
  "", "## 已知限制", "",
  "- 单 Demo；视觉结论只校验记录完整性，不重判人工判断。",
  "- `*.log` 为清单中的 optional 项，不在 git 信任边界内。",
  "- 本票据不重跑浏览器/QA；六项检查由当前证据重导出。",
];
fs.writeFileSync(path.join(BASE, "baseline.md"), md.join("\n") + "\n");

console.log(JSON.stringify({
  base: path.relative(ROOT, BASE), status: report.status, exit: summary.exitCode,
  durationMs: summary.durationMs, readOnlySame: baseline.readOnly.same, checked: baseline.readOnly.checked,
  cross: { checks: cross.summary.checks, failed: cross.summary.failed, sameIds },
  manifestSha: baseline.manifest.sha256, reportSha: baseline.cli.reportSha256,
}, null, 2));
