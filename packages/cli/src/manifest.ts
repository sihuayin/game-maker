// `game-maker build-evidence-manifest --spec <spec.json> --out <manifest.json> [--force]`
// （P0-02 v2 票 07 / 票 13）—— 正式证据清单的生产入口（薄壳；判断全在 pipeline）。
import path from "node:path";
import type { CommandResult } from "@game-maker/contracts";
import { buildEvidenceManifest } from "@game-maker/pipeline";

const rel = (root: string, p: string): string => path.relative(root, p).split(path.sep).join("/");

export function runBuildEvidenceManifestCommand(opts: {
  specPath: string; outPath: string; force: boolean; cwd: string;
}): { result: CommandResult; exitCode: number } {
  const r = buildEvidenceManifest({ specPath: opts.specPath, outPath: opts.outPath, force: opts.force });
  return {
    result: {
      command: "build-evidence-manifest",
      summary: [
        `✅ 证据清单已生成：${rel(opts.cwd, r.outPath)}`,
        `  文件 ${r.files}（required ${r.required}）· records ${r.records} · subject ${r.manifest.subject.packId} v${r.manifest.subject.packVersion} · site v${r.manifest.subject.siteVersion}`,
      ],
      data: {
        manifest: rel(opts.cwd, r.outPath),
        files: r.files,
        required: r.required,
        records: r.records,
        subject: r.manifest.subject,
      },
      artifacts: [{ path: rel(opts.cwd, r.outPath), kind: "delivery-evidence-manifest" }],
    },
    exitCode: 0,
  };
}
