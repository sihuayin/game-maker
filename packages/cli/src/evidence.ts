// `verify-delivery` 的 CLI 薄壳（Evidence Integrity V1 · 票 05）。
//
// ⚠️ 判断全在 `@game-maker/pipeline` 的 `evidence-integrity`；本文件只做三件事：
//   ① `--out` 必须在所有声明 root 之外（Q9）—— 在**任何写入之前**拒；
//   ② 调核心跑一次只读校验；
//   ③ 把报告写到原子分配的新目录里（绝不覆盖历史），并渲染成 `CommandResult`。
import path from "node:path";
import type { CommandResult } from "@game-maker/contracts";
import {
  assertOutOutsideRoots, evidenceRootPaths, verifyDeliveryEvidence, writeVerificationReport,
} from "@game-maker/pipeline";

const rel = (root: string, p: string): string => path.relative(root, p).split(path.sep).join("/");

export function runVerifyDeliveryCommand(opts: {
  manifestPath: string;
  outRoot: string;
  cwd?: string;
}): { result: CommandResult; exitCode: number } {
  const cwd = opts.cwd ?? process.cwd();
  const roots = evidenceRootPaths(opts.manifestPath);
  assertOutOutsideRoots(opts.outRoot, roots);

  const report = verifyDeliveryEvidence(opts.manifestPath);
  const written = writeVerificationReport({ report, outDir: opts.outRoot });
  const relDir = rel(opts.outRoot, written.dir);
  const fails = report.diagnostics.filter((d) => d.severity === "fail").length;
  const blocked = report.diagnostics.filter((d) => d.severity === "blocked").length;
  const icon = report.status === "pass" ? "✅" : report.status === "fail" ? "✗" : "⚠️";

  return {
    result: {
      command: "verify-delivery",
      summary: [
        `${icon} 证据完整性验收：${report.status}（退出码 ${report.exitCode}）`,
        `  清单：${rel(cwd, path.resolve(opts.manifestPath))} · sha256 ${report.input.manifest.sha256}`,
        `  subject：${report.input.subject.packId} v${report.input.subject.packVersion} · site v${report.input.subject.siteVersion} · shell ${report.input.subject.shellVersion}`,
        `  范围：${report.scope.files.total} 文件（required ${report.scope.files.required} / optional ${report.scope.files.optional}）· ${report.scope.records} 条记录`,
        `  结论：声明 ${report.declared.verdict ?? "—"} / 重算 ${report.recomputed.verdict}` +
          `（六项一致：${report.comparison.checks.every((c) => c.match) ? "是" : "否"}）`,
        `  诊断：fail ${fails} · blocked ${blocked}`,
        `  报告：${relDir}/report.json · ${relDir}/report.md`,
      ],
      data: {
        status: report.status,
        declaredVerdict: report.declared.verdict,
        recomputedVerdict: report.recomputed.verdict,
        verdictMatch: report.comparison.verdictMatch,
        checks: report.comparison.checks,
        files: report.scope.files,
        records: report.scope.records,
        diagnostics: { total: report.diagnostics.length, fail: fails, blocked },
        report: `${relDir}/report.json`,
        reportMarkdown: `${relDir}/report.md`,
      },
      artifacts: [
        { path: `${relDir}/report.json`, kind: "delivery-verification-report" },
        { path: `${relDir}/report.md`, kind: "delivery-verification-report-markdown" },
      ],
    },
    exitCode: report.exitCode,
  };
}
