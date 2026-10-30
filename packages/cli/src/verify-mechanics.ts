// `game-maker verify-mechanics <run 目录>`（P0-02 v2 票 02 / 票 08）—— 独立的机制 probe 执行层。
//
// ⚠️ 只吃 run 目录（与 playtest 同一条纪律）：身份从报告与产物关系解析；不提供 --pack/--site/--config 覆盖。
// ⚠️ 它**启动本地 Chrome**（mechanic-probe 自带 last-train 夹具 + 合成 config），零付费。
// ⚠️ 产物：`run/vN/mechanic-coverage.json`（v2，probe.executed=true）与
//   `run/vN/mechanic-probe/summary.json`（只保留摘要；assembled 站点是临时产物）。
// 退出码：0 = probe 全绿且覆盖 verdict satisfied；1 = probe 失败/缺结果/verdict failed（报告照写）；
//   2 = 用法错；4 = 输入/身份不合法（不写报告）。
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  CommandError, GameDesignSpecSchema, MechanicSchema, QAReportSchema, buildMechanicCoverage, parseGameConfig,
  type CommandResult, type MechanicProbeResult,
} from "@game-maker/contracts";
import {
  RUN_ARTIFACT, buildMechanicCoverageReport, copyMechanicProbeSummary, mechanicCoverageSubjectFor,
  writeMechanicCoverageReport,
} from "@game-maker/pipeline";

const rel = (root: string, p: string): string => path.relative(root, p).split(path.sep).join("/");
const sha256File = (p: string): string => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;
const readJson = (p: string): unknown => JSON.parse(fs.readFileSync(p, "utf8"));
const PROBE_SCRIPT = "packages/demo/probe/mechanic-probe.mjs";
const PROBE_TIMEOUT_MS = 5 * 60 * 1000;

function requireUnder(outRoot: string, p: string): void {
  const r = path.relative(outRoot, p);
  if (r.startsWith("..") || path.isAbsolute(r))
    throw new CommandError("invalid", `run 目录必须在 out 根内：${p} 不在 ${outRoot} 下`);
}

type Target = {
  outRoot: string; runDir: string; gameId: string; packDir: string; packVersion: number;
  siteVersion: number; shellVersion: string; configPath: string; configChecksum: string;
  manifest: { id: string; version: number };
};

function resolveTarget(outRootInput: string, runDirInput: string): Target {
  const outRoot = path.resolve(outRootInput);
  const runDir = path.resolve(runDirInput);
  if (!/\/v\d+$/.test(runDir))
    throw new CommandError("usage", `"${runDirInput}" 不是一次运行的目录（要 <gameId>/run/v<N> 的形状）`);
  requireUnder(outRoot, runDir);
  const gameId = path.basename(path.dirname(path.dirname(runDir)));

  const qaPath = path.join(runDir, RUN_ARTIFACT.qaReport);
  if (!fs.existsSync(qaPath)) throw new CommandError("invalid", `找不到 QA 报告：${rel(outRoot, qaPath)} —— 先跑 build`);
  let qa;
  try { qa = QAReportSchema.parse(readJson(qaPath)); }
  catch (e) { throw new CommandError("invalid", `qa-report.json 不可解析或不过 qa-report/v1：${e instanceof Error ? e.message : String(e)}`); }
  const delivery = qa.delivery;
  if (delivery === undefined) throw new CommandError("invalid", "这份 QA 报告没有 delivery —— 不能核验一个身份不明的交付");
  if (delivery.site === undefined) throw new CommandError("invalid", "delivery.site 缺席 —— 站点尚未装配，不能核验机制");

  const siteVersion = delivery.site.version;
  const siteDir = path.join(outRoot, gameId, "site", `v${siteVersion}`);
  if (!fs.existsSync(siteDir)) throw new CommandError("invalid", `delivery.site 指向的站点不存在：${rel(outRoot, siteDir)}`);
  const siteJson = readJson(path.join(siteDir, "site.json")) as Record<string, unknown>;
  if (String(siteJson["shell"]) !== delivery.site.shell)
    throw new CommandError("invalid", `site.json 的 shell=${String(siteJson["shell"])} 与 delivery.site.shell=${delivery.site.shell} 不一致`);
  if (String(siteJson["pack"]) !== `v${delivery.pack.packVersion}`)
    throw new CommandError("invalid", `site.json 的 pack=${String(siteJson["pack"])} 与 delivery.pack v${delivery.pack.packVersion} 不一致`);
  if (typeof siteJson["config"] !== "string" || siteJson["config"].length === 0)
    throw new CommandError("invalid", "site.json 缺 config 文件名");
  const configPath = path.join(siteDir, siteJson["config"]);
  if (!fs.existsSync(configPath)) throw new CommandError("invalid", `站点配置不存在：${rel(outRoot, configPath)}`);
  const configChecksum = sha256File(configPath);

  const runConfig = path.join(runDir, RUN_ARTIFACT.config);
  if (!fs.existsSync(runConfig)) throw new CommandError("invalid", `run 缺 ${RUN_ARTIFACT.config}`);
  if (sha256File(runConfig) !== configChecksum)
    throw new CommandError("invalid", `run 的 ${RUN_ARTIFACT.config} 与站点实际消费的配置不一致`);
  const deliveryConfig = path.resolve(outRoot, delivery.config.file);
  if (!fs.existsSync(deliveryConfig) || sha256File(deliveryConfig) !== configChecksum)
    throw new CommandError("invalid", "delivery.config 指向的配置与站点实际消费的配置不一致");

  const packDir = path.join(outRoot, gameId, "pack", `v${delivery.pack.packVersion}`);
  if (!fs.existsSync(packDir)) throw new CommandError("invalid", `delivery.pack 指向的包不存在：${rel(outRoot, packDir)}`);
  const manifestPath = path.join(packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("invalid", `包缺 manifest.json：${rel(outRoot, manifestPath)}`);
  const manifest = readJson(manifestPath) as { id?: unknown; version?: unknown };
  if (manifest.id !== delivery.pack.packId || manifest.version !== delivery.pack.packVersion)
    throw new CommandError("invalid", `包 manifest 身份与 delivery.pack 不一致：manifest ${String(manifest.id)} v${String(manifest.version)} / delivery ${delivery.pack.packId} v${delivery.pack.packVersion}`);

  return {
    outRoot, runDir, gameId, packDir, packVersion: delivery.pack.packVersion,
    siteVersion, shellVersion: delivery.site.shell, configPath, configChecksum,
    manifest: { id: String(manifest.id), version: Number(manifest.version) },
  };
}

function probeResultsFrom(summaryPath: string): { results: MechanicProbeResult[]; allOk: boolean } | undefined {
  let raw: unknown;
  try { raw = readJson(summaryPath); } catch { return undefined; }
  const probes = (raw as { probes?: unknown }).probes;
  if (!Array.isArray(probes)) return undefined;
  const results: MechanicProbeResult[] = [];
  for (const p of probes) {
    if (typeof p !== "object" || p === null) continue;
    const m = MechanicSchema.safeParse((p as { mechanicId?: unknown }).mechanicId);
    if (!m.success) continue;
    results.push({ mechanic: m.data, passed: (p as { passed?: unknown }).passed === true });
  }
  return { results, allOk: (raw as { allOk?: unknown }).allOk === true };
}

export function runVerifyMechanicsCommand(opts: {
  outRoot: string; runDirInput: string; cwd?: string;
}): { result: CommandResult; exitCode: number } {
  const target = resolveTarget(opts.outRoot, opts.runDirInput);
  let design;
  try { design = GameDesignSpecSchema.parse(readJson(path.join(target.runDir, RUN_ARTIFACT.gameDesign))); }
  catch (e) { throw new CommandError("invalid", `game-design.json 不可解析或不过 game-design/v1：${e instanceof Error ? e.message : String(e)}`); }
  const config = parseGameConfig(readJson(target.configPath));
  if (!config.ok) throw new CommandError("invalid", `站点 config 不过 game-config/v1：${config.errors.slice(0, 3).join("；")}`);

  const subject = mechanicCoverageSubjectFor({
    manifest: target.manifest, packDir: target.packDir, configPath: target.configPath,
    siteVersion: target.siteVersion, shellVersion: target.shellVersion,
  });

  const cwd = opts.cwd ?? process.cwd();
  const probeScript = path.resolve(cwd, PROBE_SCRIPT);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "gm-mechanic-probe-"));
  let probeExit = 1;
  let summarySource: string | undefined;
  let probe: { results: MechanicProbeResult[]; allOk: boolean } | undefined;
  try {
    if (fs.existsSync(probeScript)) {
      const r = spawnSync(process.execPath, [probeScript, "--out", temp], {
        cwd, encoding: "utf8", timeout: PROBE_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 16 * 1024 * 1024,
      });
      probeExit = typeof r.status === "number" ? r.status : 1;
      const summary = path.join(temp, "summary.json");
      if (fs.existsSync(summary)) {
        summarySource = summary;
        probe = probeResultsFrom(summary);
      }
    }
    if (summarySource !== undefined) {
      try { copyMechanicProbeSummary(target.runDir, summarySource); }
      catch { /* 摘要复制失败不阻止失败报告落盘；报告里不写 summaryPath */ summarySource = undefined; }
    }
  } finally {
    try { fs.rmSync(temp, { recursive: true, force: true }); } catch {}
  }

  const core = buildMechanicCoverage(design, config.value, probe?.results ?? []);
  core.probe.ranAt = new Date().toISOString();
  if (summarySource !== undefined) core.probe.summaryPath = "mechanic-probe/summary.json";
  const report = buildMechanicCoverageReport(core, subject);
  const reportPath = writeMechanicCoverageReport(target.runDir, report);

  const verdictOk = report.verdict === "satisfied";
  const exitCode = verdictOk && probeExit === 0 ? 0 : 1;
  const failed = report.mechanics.filter((m) => m.qa === "failed" || m.config.status === "missing");
  return {
    result: {
      command: "verify-mechanics",
      summary: [
        `${exitCode === 0 ? "✅" : "✗"} 机制覆盖：${report.verdict}（退出码 ${exitCode}）`,
        `  run：${rel(target.outRoot, target.runDir)} · probe.exit=${probeExit}`,
        `  probe：executed=${report.probe.executed} · 结果 ${report.probe.results.length} 条` +
          (summarySource === undefined ? " · 没有摘要" : " · mechanic-probe/summary.json"),
        ...(failed.length === 0 ? [] : failed.map((m) => `  · ${m.mechanic}：config=${m.config.status} / qa=${m.qa}`)),
        `  报告：${rel(target.outRoot, reportPath)}`,
      ],
      data: {
        runDir: rel(target.outRoot, target.runDir),
        verdict: report.verdict,
        probeExit,
        probeExecuted: report.probe.executed,
        probeResults: report.probe.results,
        mechanics: report.mechanics.map((m) => ({
          mechanic: m.mechanic, design: m.design, runtime: m.runtime, config: m.config.status, qa: m.qa,
        })),
      },
      artifacts: [{ path: rel(target.outRoot, reportPath), kind: "mechanic-coverage" }],
    },
    exitCode,
  };
}
