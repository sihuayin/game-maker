// 试玩基线晋升（Playtest V1 · 票 09）—— **显式人工操作**，普通运行/CI 不走这里。
//
// ⚠️ 晋升要求：① 连续两次干净运行（同身份/同场景/同判定规则；无影响比较的 UNKNOWN、证据断档、
//   未归因 runtime-error）；② 覆盖理由；③ 写入 `fixtures/playtest-baselines/<id>/baseline.json`。
// ⚠️ 已存在默认拒绝；`replace` 必须显式，由人在 git diff 里审计。
// ⚠️ 允许记录非 SUCCESS 的**已接受行为**（如 GAMEPLAY_FAILURE）；它不是自动认可游戏质量。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  CommandError, PlaytestBaselineSchema, PlaytestReportSchema,
  baselineCleanRunIssues, expectedOf, sameBaselineExpected,
  type PlaytestBaseline, type PlaytestBaselineCoverage, type PlaytestBaselineSource,
} from "@game-maker/contracts";
import { jstr } from "./artifacts.js";

const sha256File = (p: string): string => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;

function runIdOf(reportPath: string): string {
  const p = reportPath.split(path.sep).join("/");
  const m = /^(.*\/run\/v\d+)\//.exec(p);
  return m?.[1] ?? path.dirname(p);
}

function sourceOf(reportPath: string, base: Omit<PlaytestBaselineSource, "runId" | "reportPath" | "reportChecksum">): PlaytestBaselineSource {
  return { ...base, runId: runIdOf(reportPath), reportPath, reportChecksum: sha256File(reportPath) };
}

export function promotePlaytestBaseline(opts: {
  baselineDir: string;
  baselineId: string;
  scenarioId: string;
  reportPaths: readonly [string, string];
  coverage: PlaytestBaselineCoverage;
  reason: string;
  promotedBy: string;
  replace?: boolean;
}): PlaytestBaseline {
  if (opts.baselineId.includes("/") || opts.baselineId.includes("\\") || opts.baselineId === "." || opts.baselineId === ".." || opts.baselineId.length === 0)
    throw new CommandError("usage", `baselineId 不能含路径分隔符/空值：${JSON.stringify(opts.baselineId)}`);
  if (opts.reason.trim().length === 0) throw new CommandError("usage", "晋升必须填写覆盖理由（--reason）");

  // source 里存相对路径（入库审计友好）；绝对路径先相对化。
  const normalized = opts.reportPaths.map((p) => path.isAbsolute(p) ? path.relative(process.cwd(), p) : p) as [string, string];
  const reports = normalized.map((p) => {
    if (!fs.existsSync(p)) throw new CommandError("invalid", `找不到报告：${p}`);
    try { return { path: p, report: PlaytestReportSchema.parse(JSON.parse(fs.readFileSync(p, "utf8"))) }; }
    catch (e) { throw new CommandError("invalid", `报告不合法：${p}\n${e instanceof Error ? e.message : String(e)}`); }
  });
  const [a, b] = reports as [(typeof reports)[number], (typeof reports)[number]];

  for (const r of reports) {
    const issues = baselineCleanRunIssues(r.report, opts.scenarioId, opts.coverage);
    if (issues.length > 0)
      throw new CommandError("invalid", `报告不是干净运行：${r.path}\n  · ${issues.join("\n  · ")}`);
  }
  const ea = expectedOf(a.report, opts.scenarioId, opts.coverage);
  const eb = expectedOf(b.report, opts.scenarioId, opts.coverage);
  if (JSON.stringify(ea.identity) !== JSON.stringify(eb.identity))
    throw new CommandError("invalid", "两次运行的身份不一致 —— 不能晋升为同一基线");
  if (!sameBaselineExpected(ea.expected, eb.expected))
    throw new CommandError("invalid", "两次干净运行的规范化投影不一致 —— 覆盖字段不稳定，不能晋升（也不得放宽阈值）");

  const base = {
    promotedBy: opts.promotedBy, promotedAt: new Date().toISOString(), reason: opts.reason,
  };
  const baseline = PlaytestBaselineSchema.parse({
    baselineFormatVersion: "playtest-baseline/v1",
    baselineId: opts.baselineId,
    identity: ea.identity,
    coverage: opts.coverage,
    expected: ea.expected,
    source: {
      ...sourceOf(a.path, { ...base, secondRunId: "", secondReportPath: "", secondReportChecksum: "" }),
      secondRunId: runIdOf(b.path),
      secondReportPath: b.path,
      secondReportChecksum: sha256File(b.path),
    },
  });

  const dir = path.join(opts.baselineDir, opts.baselineId);
  const file = path.join(dir, "baseline.json");
  if (fs.existsSync(file) && opts.replace !== true)
    throw new CommandError("invalid", `基线已存在：${file} —— 普通运行不得自动覆盖；要重定基线请显式 --replace 并在入库 diff 里审计`);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, jstr(baseline));
  fs.renameSync(tmp, file);
  return baseline;
}
