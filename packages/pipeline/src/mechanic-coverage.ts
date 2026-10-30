// **机制覆盖报告 v2 的落盘层**（P0-02 v2 票 02 / 票 08）。
//
// ⚠️ 契约与纯函数在 `@game-maker/contracts`：`buildMechanicCoverage` 只吃设计 + config + probe 结果；
//   本文件补 **subject**（六字段身份）、原子写盘、probe 摘要搬运与身份比对。
// ⚠️ 报告住在 `run/vN/mechanic-coverage.json`；probe 摘要只保留 `run/vN/mechanic-probe/summary.json`
//   （probe 的 assembled 站点是临时产物，不进 run）。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  MechanicCoverageReportSchema,
  type MechanicCoverageCore, type MechanicCoverageReport, type MechanicCoverageSubject,
} from "@game-maker/contracts";
import { RUN_ARTIFACT, jstr } from "./artifacts.js";
import { manifestChecksumOf } from "./publish-gate.js";

export const MECHANIC_PROBE_SUMMARY_PATH = "mechanic-probe/summary.json";

const sha256File = (p: string): string => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;

/** 从一次 run 的实际产物算 subject。⚠️ pack checksum 用 `manifestChecksumOf` 重算，不信可选字段。 */
export function mechanicCoverageSubjectFor(opts: {
  manifest: { id: string; version: number };
  packDir: string;
  configPath: string;
  siteVersion: number;
  shellVersion: string;
}): MechanicCoverageSubject {
  return {
    packId: opts.manifest.id,
    packVersion: opts.manifest.version,
    siteVersion: opts.siteVersion,
    shellVersion: opts.shellVersion,
    manifestChecksum: manifestChecksumOf(opts.packDir),
    configChecksum: sha256File(opts.configPath),
  };
}

/** 核心 + subject → 过 `mechanic-coverage/v2` 的完整报告。 */
export function buildMechanicCoverageReport(core: MechanicCoverageCore, subject: MechanicCoverageSubject): MechanicCoverageReport {
  return MechanicCoverageReportSchema.parse({ ...core, subject });
}

export const mechanicCoveragePath = (runDir: string): string => path.join(runDir, RUN_ARTIFACT.mechanicCoverage);
export const mechanicProbeSummaryPath = (runDir: string): string => path.join(runDir, MECHANIC_PROBE_SUMMARY_PATH);

/** 原子写 `run/vN/mechanic-coverage.json`（临时文件 + rename）。 */
export function writeMechanicCoverageReport(runDir: string, report: MechanicCoverageReport): string {
  const p = mechanicCoveragePath(runDir);
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, jstr(report));
  fs.renameSync(tmp, p);
  return p;
}

/** 读回并校验一份报告；读不出/不过 schema ⇒ 抛。 */
export function readMechanicCoverageReport(p: string): MechanicCoverageReport {
  const raw: unknown = JSON.parse(fs.readFileSync(p, "utf8"));
  return MechanicCoverageReportSchema.parse(raw);
}

/** 把 probe 的 summary.json 复制到 `run/vN/mechanic-probe/summary.json`（原子 rename）。 */
export function copyMechanicProbeSummary(runDir: string, source: string): string {
  const dest = mechanicProbeSummaryPath(runDir);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp-${process.pid}`;
  fs.copyFileSync(source, tmp);
  fs.renameSync(tmp, dest);
  return dest;
}

/** 报告 subject 与期望身份逐字段比对；不一致返回可诊断文本，全等返回 `undefined`。 */
export function mechanicCoverageSubjectProblem(report: MechanicCoverageReport, expected: MechanicCoverageSubject): string | undefined {
  const fields = ["packId", "packVersion", "siteVersion", "shellVersion", "manifestChecksum", "configChecksum"] as const;
  const bad = fields.filter((f) => String(report.subject[f]) !== String(expected[f]));
  if (bad.length === 0) return undefined;
  return bad.map((f) => `${f}：报告 ${String(report.subject[f])} / 当前 ${String(expected[f])}`).join("；");
}
