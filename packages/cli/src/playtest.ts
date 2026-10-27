// `game-maker playtest <run 目录>`（Playtest V1 · 票 08）—— 交付接入的执行层。
//
// ⚠️ 仅 CLI、不加 MCP（票 06 Q2）。只吃 run 目录，不提供 --pack/--site/--config/--scenario。
// ⚠️ 创建链（create/build）**不启动浏览器**；这一步显式、可追溯。
// ⚠️ 退出码（票 06 Q5）：0 = SUCCESS + 写回成功；1 = 非 SUCCESS 或写回失败；
//   4 = 准备拒绝/输入不合法；2 = 用法错。准备拒绝写 `playtest/rejections/`，不伪造 attempt。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  CommandError, PLAYTEST_HARNESS_VERSION, PLAYTEST_REPORT_VERSION, PLAYTEST_RULES_VERSION,
  PLAYTEST_SCENARIO_VERSION, PlaytestReportSchema, PlaytestScenarioSchema, QAReportSchema,
  aggregateAssertions, attribute, attributeReport,
  type DeliveryCheckStatus, type DeliveryEvidence, type DeliveryReport, type PlaytestAttributionEvidence,
  type PlaytestAttributionResult, type PlaytestOutcome, type PlaytestReport, type PlaytestScenarioReport,
  type PlaytestScenario,
} from "@game-maker/contracts";
import { manifestChecksumOf, writePlaytestToReport, writePlaytestWritebackError } from "@game-maker/pipeline";
import { RUN_ARTIFACT } from "@game-maker/pipeline";
import type { CommandResult } from "@game-maker/contracts";

const SCENARIO_DIR = path.resolve(process.cwd(), "packages/demo/probe/playtest/scenarios/five-state");
const HARNESS_SCRIPT = path.resolve(process.cwd(), "packages/demo/probe/playtest/playtest.mjs");
const HARNESS_TIMEOUT_MS = 10 * 60 * 1000;

const rel = (outRoot: string, p: string): string => path.relative(outRoot, p).split(path.sep).join("/");
const sha256File = (p: string): string => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;
const readJson = (p: string): unknown => JSON.parse(fs.readFileSync(p, "utf8"));

type Target = {
  outRoot: string;
  runDir: string;
  gameId: string;
  siteDir: string;
  siteVersion: number;
  shellVersion: string;
  packDir: string;
  packVersion: number;
  configPath: string;
  configChecksum: string;
  qaReport: ReturnType<typeof QAReportSchema.parse>;
  delivery: DeliveryReport;
  scenarios: { file: string; scenario: PlaytestScenario }[];
};

function requireUnder(outRoot: string, p: string): string {
  const relPath = path.relative(outRoot, p);
  if (relPath.startsWith("..") || path.isAbsolute(relPath))
    throw new CommandError("invalid", `run 目录必须在 out 根内：${p} 不在 ${outRoot} 下`);
  return relPath;
}

/** 票 06 Q4 的六项准备校验；任何一项不满足都不执行试玩。 */
function resolveTarget(outRoot: string, runDirInput: string): Target {
  const runDir = path.resolve(runDirInput);
  if (!/\/v\d+$/.test(runDir))
    throw new CommandError("usage", `"${runDirInput}" 不是一次运行的目录（要 <gameId>/run/v<N> 的形状）`);
  requireUnder(outRoot, runDir);
  const gameId = path.basename(path.dirname(path.dirname(runDir)));

  const qaPath = path.join(runDir, RUN_ARTIFACT.qaReport);
  if (!fs.existsSync(qaPath)) throw new CommandError("invalid", `找不到 QA 报告：${rel(outRoot, qaPath)} —— 先跑 build`);
  const qaReport = QAReportSchema.parse(readJson(qaPath));
  if (qaReport.delivery === undefined)
    throw new CommandError("invalid", "这份 QA 报告没有 delivery（站点/交付收尾尚未完成）—— 不能试玩一个身份不明的交付");
  const delivery = qaReport.delivery;
  if (delivery.site === undefined)
    throw new CommandError("invalid", "站点尚未装配（delivery.site 缺席）—— 没有可试玩的 site 版本");
  if (delivery.checks.find((c) => c.key === "qa")?.status !== "pass")
    throw new CommandError("invalid", "QA 检查项不是 pass —— 不满足启动试玩的既定前置条件");
  if (delivery.checks.find((c) => c.key === "site")?.status !== "pass")
    throw new CommandError("invalid", "site 检查项不是 pass —— 站点装配未成功");

  const siteVersion = delivery.site.version;
  const siteDir = path.join(outRoot, gameId, "site", `v${siteVersion}`);
  if (!fs.existsSync(siteDir)) throw new CommandError("invalid", `delivery.site 指向的站点不存在：${rel(outRoot, siteDir)}`);
  const siteJson = readJson(path.join(siteDir, "site.json")) as { shell?: unknown; pack?: unknown; config?: unknown };
  if (String(siteJson.shell) !== delivery.site.shell)
    throw new CommandError("invalid", `site.json 的 shell=${String(siteJson.shell)} 与 delivery.site.shell=${delivery.site.shell} 不一致`);
  if (String(siteJson.pack) !== `v${delivery.pack.packVersion}`)
    throw new CommandError("invalid", `site.json 的 pack=${String(siteJson.pack)} 与 delivery.pack v${delivery.pack.packVersion} 不一致`);
  if (typeof siteJson.config !== "string" || siteJson.config.length === 0)
    throw new CommandError("invalid", "site.json 缺 config 文件名");
  const configPath = path.join(siteDir, siteJson.config);
  if (!fs.existsSync(configPath)) throw new CommandError("invalid", `站点配置不存在：${rel(outRoot, configPath)}`);

  // pack 身份 + 完整性
  const packDir = path.join(outRoot, gameId, "pack", `v${delivery.pack.packVersion}`);
  if (!fs.existsSync(packDir)) throw new CommandError("invalid", `delivery.pack 指向的包不存在：${rel(outRoot, packDir)}`);
  const manifestPath = path.join(packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("invalid", `包缺 manifest.json：${rel(outRoot, manifestPath)}`);
  const manifest = readJson(manifestPath) as { id?: unknown; version?: unknown };
  if (manifest.id !== delivery.pack.packId || manifest.version !== delivery.pack.packVersion)
    throw new CommandError("invalid", `包 manifest 身份与 delivery.pack 不一致：manifest ${String(manifest.id)} v${String(manifest.version)} / delivery ${delivery.pack.packId} v${delivery.pack.packVersion}`);
  if (delivery.pack.manifestChecksum !== undefined && manifestChecksumOf(packDir) !== delivery.pack.manifestChecksum)
    throw new CommandError("invalid", "包 manifest checksum 与 delivery.pack 不一致（包被改动过？）");

  // run 的 config 必须与站点实际消费的那份一致
  const runConfig = path.join(runDir, RUN_ARTIFACT.config);
  if (!fs.existsSync(runConfig)) throw new CommandError("invalid", `run 缺 ${RUN_ARTIFACT.config}`);
  const configChecksum = sha256File(configPath);
  if (sha256File(runConfig) !== configChecksum)
    throw new CommandError("invalid", `run 的 ${RUN_ARTIFACT.config} 与站点实际消费的配置不一致（config 走 site 依赖验证）`);
  const deliveryConfig = path.resolve(outRoot, delivery.config.file);
  if (!fs.existsSync(deliveryConfig) || sha256File(deliveryConfig) !== configChecksum)
    throw new CommandError("invalid", "delivery.config 指向的配置与站点实际消费的配置不一致");

  // 场景契约：只取游戏场景（harness 条件场景不进交付聚合）
  const scenarios: { file: string; scenario: PlaytestScenario }[] = [];
  for (const file of fs.readdirSync(SCENARIO_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const parsed = PlaytestScenarioSchema.safeParse(readJson(path.join(SCENARIO_DIR, file)));
    if (!parsed.success) throw new CommandError("invalid", `场景契约不过 schema：${file}\n${parsed.error.issues.map((i) => `  · ${i.path.join(".")}: ${i.message}`).join("\n")}`);
    const scenario = parsed.data;
    if (scenario.harnessCondition !== "none") continue;
    // `required:false` = 覆盖/诊断场景（故意失败/限制注入），不进交付命令的必需场景集。
    if (!scenario.required) continue;
    if (scenario.target.siteVersion !== siteVersion)
      throw new CommandError("invalid", `场景 ${scenario.id} 目标 site v${scenario.target.siteVersion} 与实际 v${siteVersion} 不匹配`);
    scenarios.push({ file: path.join(SCENARIO_DIR, file), scenario });
  }
  if (scenarios.length === 0) throw new CommandError("invalid", "没有可执行的游戏场景（五个场景里只有 harness 条件场景？）");

  return {
    outRoot, runDir, gameId, siteDir, siteVersion, shellVersion: delivery.site.shell,
    packDir, packVersion: delivery.pack.packVersion, configPath, configChecksum, qaReport, delivery, scenarios,
  };
}

function writeRejection(t: Target, reason: string): void {
  const dir = path.join(t.runDir, "playtest", "rejections");
  fs.mkdirSync(dir, { recursive: true });
  const at = new Date().toISOString();
  const file = path.join(dir, `${at.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ at, reason, runDir: rel(t.outRoot, t.runDir) }, null, 2) + "\n");
}

function nextAttemptVersion(runDir: string): number {
  const root = path.join(runDir, "playtest");
  if (!fs.existsSync(root)) return 1;
  const versions = fs.readdirSync(root)
    .map((n) => /^v(\d+)$/.exec(n)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  return versions.length === 0 ? 1 : Math.max(...versions) + 1;
}

function runHarness(siteDir: string, scenarioDir: string, outDir: string) {
  if (!fs.existsSync(HARNESS_SCRIPT))
    throw new CommandError("invalid", `找不到 playtest harness：${HARNESS_SCRIPT} —— 先 pnpm build（仓库布局下运行）`);
  const r = spawnSync(process.execPath, [HARNESS_SCRIPT, "--site", siteDir, "--scenario-dir", scenarioDir, "--out", outDir], {
    cwd: process.cwd(), encoding: "utf8", timeout: HARNESS_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    timedOut: r.error !== undefined && (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT",
    error: r.error,
  };
}

function parseJsonl(p: string): Record<string, unknown>[] {
  if (!fs.existsSync(p)) return [];
  const out: Record<string, unknown>[] = [];
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    try { out.push(JSON.parse(line) as Record<string, unknown>); } catch { /* 坏行不进证据；报告 schema 不依赖它 */ }
  }
  return out;
}

function originOf(text: string): "game" | "environment" | "unknown" {
  // ⚠️ 启发式只用于**分流**；无法确定 ⇒ unknown ⇒ 归因 UNKNOWN（绝不默认游戏失败）。
  if (/(net::ERR|Failed to load|404|Could not load|texture|atlas|asset|WebGL|AudioContext|Phaser\.Loader|ERR_|CORS|fetch|load error)/i.test(text))
    return "environment";
  if (/(TypeError|ReferenceError|RangeError|SyntaxError|Cannot read|is not a function|undefined is not|NaN|Uncaught)/i.test(text))
    return "game";
  return "unknown";
}

function attributionEvidence(t: Target, dir: string, scenario: PlaytestScenarioReport): PlaytestAttributionEvidence {
  const events = parseJsonl(path.join(dir, "events.jsonl"));
  const trace = parseJsonl(path.join(dir, "trace.jsonl"));
  const runtimeErrors = events
    .filter((e) => e.type === "runtime-error")
    .map((e) => {
      const params = (e.params ?? {}) as { kind?: unknown; text?: unknown };
      const text = String(params.text ?? "");
      return { kind: (params.kind === "exception" ? "exception" : "console") as "console" | "exception", text, origin: originOf(text) };
    });
  const pollGaps = trace.filter((x) => x.gap === true).length;
  const sceneReady = events.some((e) => e.type === "scene-ready");
  const envErrors = runtimeErrors.filter((e) => e.origin === "environment");
  const notExecuted = scenario.execution !== "executed";
  const reason = typeof scenario.execution === "string" ? "" : scenario.execution.reason;
  const stage: PlaytestAttributionEvidence["stage"] = notExecuted
    ? (/boot|scene|ready|启动|没有拿到/i.test(reason) ? "boot" : "prepare")
    : "execute";
  const envFailures = [
    ...(notExecuted ? [reason] : []),
    ...envErrors.map((e) => e.text),
  ].filter((s) => s.length > 0);
  const healthy = !notExecuted && sceneReady && pollGaps === 0 && envErrors.length === 0;
  const actions = scenario.actions;
  const attempted = actions.length;
  const completed = actions.filter((a) => a.outcome === "completed").length;
  const timedOut = actions.filter((a) => a.outcome === "timeout").length;
  const explorationExhausted = attempted > 0 && actions.every((a) => a.outcome === "completed" || a.outcome === "timeout");
  const progressPx = (scenario.endState.playerX ?? 0) - (scenario.initialState.playerX ?? 0);
  const stuck = ((scenario.steps ?? 0) >= 200 && progressPx <= 10) || (scenario.eventCounts.reset ?? 0) >= 3;
  const structuralUndecidable = pollGaps > 0 ||
    scenario.assertions.some((a) => a.insufficientEvidence?.ruleId === "poll-gap" || a.insufficientEvidence?.ruleId === "event-unjudgeable");
  return {
    scenario, stage,
    environment: { healthy, chromeAvailable: true, sceneReadyObserved: sceneReady, pollGaps, failures: envFailures },
    runtimeErrors,
    action: { attempted, completed, timedOut, explorationExhausted, stuck, progressPx },
    deadlineHit: timedOut > 0,
    structuralUndecidable,
    evidence: ["playtest-events", "playtest-trace"],
  };
}

function scenarioRefs(id: string): string[] {
  return ["events", "trace", "input", "console", "exceptions"].map((k) => `playtest-${id}-${k}`);
}

function finalizeReport(t: Target, raw: PlaytestReport, attemptDir: string): { report: PlaytestReport; results: Map<string, PlaytestAttributionResult> } {
  const evidences = raw.scenarios.map((s) => attributionEvidence(t, path.join(attemptDir, s.scenarioId), s));
  const attribution = attributeReport(evidences);
  const results = new Map(attribution.results.map((r) => [r.scenarioId, r.result]));
  const scenarios = raw.scenarios.map((s) => {
    const result = results.get(s.scenarioId);
    if (result === undefined) return s;
    const refs = scenarioRefs(s.scenarioId);
    if (result.execution === "not-executed") return { ...s, execution: result.execution, evidence: refs };
    return {
      ...s,
      // boot 失败时 raw 是 not-executed；归因把它判成环境故障/UNKNOWN ⇒ 记「已尝试执行」以承载 outcome。
      execution: "executed" as const,
      outcome: result.outcome,
      ...(result.insufficientEvidence === undefined ? {} : { insufficientEvidence: result.insufficientEvidence }),
      evidence: refs,
    };
  });
  const allRefs = scenarios.flatMap((s) => s.evidence);
  const report = PlaytestReportSchema.parse({
    ...raw,
    execution: attribution.execution,
    ...(attribution.aggregate === undefined ? {} : { aggregate: attribution.aggregate }),
    scenarios,
    evidence: ["playtest-result", "playtest-site-integrity", "playtest-chrome", ...allRefs],
  });
  return { report, results };
}

function deliveryEvidence(t: Target, attemptDir: string, report: PlaytestReport): DeliveryEvidence[] {
  const out: DeliveryEvidence[] = [
    { ref: "playtest-result", path: rel(t.outRoot, path.join(attemptDir, "result.json")) },
    { ref: "playtest-site-integrity", path: rel(t.outRoot, path.join(attemptDir, "site-integrity.json")) },
    { ref: "playtest-chrome", path: rel(t.outRoot, path.join(attemptDir, "chrome.log")) },
  ];
  for (const s of report.scenarios) {
    const dir = path.join(attemptDir, s.scenarioId);
    const files: Record<string, string> = {
      events: "events.jsonl", trace: "trace.jsonl", input: "input.jsonl",
      console: "console.json", exceptions: "exceptions.json",
    };
    for (const [k, file] of Object.entries(files)) {
      const p = path.join(dir, file);
      if (fs.existsSync(p)) out.push({ ref: `playtest-${s.scenarioId}-${k}`, path: rel(t.outRoot, p) });
    }
  }
  return out;
}

export function runPlaytestCommand(opts: { outRoot: string; runDirInput: string }): { result: CommandResult; exitCode: number } {
  const outRoot = path.resolve(opts.outRoot);
  let target: Target;
  try {
    target = resolveTarget(outRoot, opts.runDirInput);
  } catch (e) {
    // 准备拒绝：如果 run 目录 + qa-report 已经可读，留一条拒绝记录（不伪造 attempt、不写 delivery）。
    try {
      const runDir = path.resolve(opts.runDirInput);
      const qa = path.join(runDir, RUN_ARTIFACT.qaReport);
      if (fs.existsSync(qa)) {
        fs.mkdirSync(path.join(runDir, "playtest", "rejections"), { recursive: true });
        const at = new Date().toISOString();
        fs.writeFileSync(path.join(runDir, "playtest", "rejections", `${at.replace(/[:.]/g, "-")}.json`),
          JSON.stringify({ at, reason: e instanceof Error ? e.message : String(e), runDir: path.relative(outRoot, runDir) }, null, 2) + "\n");
      }
    } catch { /* 记录失败不掩盖原始准备错误 */ }
    throw e;
  }

  const k = nextAttemptVersion(target.runDir);
  const workRoot = path.join(target.runDir, "playtest", `.tmp-${process.pid}-${Date.now()}`);
  const scenarioDir = path.join(workRoot, "scenarios");
  const harnessOut = path.join(workRoot, "harness");
  fs.mkdirSync(scenarioDir, { recursive: true });
  for (const { file } of target.scenarios) fs.copyFileSync(file, path.join(scenarioDir, path.basename(file)));

  const harness = runHarness(target.siteDir, scenarioDir, harnessOut);
  const rawAttempt = path.join(harnessOut, "attempt-v1");
  const rawResultPath = path.join(rawAttempt, "result.json");
  if (!fs.existsSync(rawResultPath)) {
    // 没有可消费的报告：留一个可追踪的 harness 错误记录，**不**伪造成功/失败归因。
    fs.mkdirSync(rawAttempt, { recursive: true });
    fs.writeFileSync(path.join(rawAttempt, "harness-error.json"), JSON.stringify({
      at: new Date().toISOString(), status: harness.status, timedOut: harness.timedOut,
      error: harness.error === undefined ? undefined : String(harness.error),
      stderr: harness.stderr.slice(0, 8000), stdout: harness.stdout.slice(0, 2000),
    }, null, 2) + "\n");
    fs.renameSync(rawAttempt, path.join(target.runDir, "playtest", `v${k}`));
    throw new CommandError("invalid", `playtest harness 没有产出 result.json（status=${harness.status}）。证据：${rel(outRoot, path.join(target.runDir, "playtest", `v${k}`, "harness-error.json"))}`);
  }

  const raw = PlaytestReportSchema.parse(readJson(rawResultPath));
  const { report } = finalizeReport(target, raw, rawAttempt);

  // 把 harness 的汇总/确定性记录一并保留在 attempt 里。
  for (const name of ["summary.json", "determinism.json", "rejections.json", "exit.json"]) {
    const src = path.join(harnessOut, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(rawAttempt, `harness-${name}`));
  }
  const finalDir = path.join(target.runDir, "playtest", `v${k}`);
  fs.writeFileSync(path.join(rawAttempt, "result.json"), JSON.stringify(report, null, 2) + "\n");
  fs.renameSync(rawAttempt, finalDir);
  try { fs.rmSync(workRoot, { recursive: true, force: true }); } catch {}

  const evidence = deliveryEvidence(target, finalDir, report);
  let delivery: DeliveryReport | undefined;
  let writebackError: unknown;
  try {
    delivery = writePlaytestToReport({ outRoot, runDir: target.runDir, report, evidence });
  } catch (e) {
    writebackError = e;
    writePlaytestWritebackError(finalDir, e, rel(outRoot, path.join(target.runDir, RUN_ARTIFACT.qaReport)));
  }

  const executedOutcomes = report.scenarios.filter((s) => s.execution === "executed" && s.outcome !== undefined).map((s) => s.outcome!);
  const success = report.execution === "executed" && executedOutcomes.length > 0 && executedOutcomes.every((o) => o === "SUCCESS");
  const exitCode = writebackError !== undefined ? 1 : success ? 0 : 1;
  const summary: string[] = [
    `试玩：${rel(outRoot, target.runDir)} · attempt v${k}`,
    ...report.scenarios.map((s) => {
      const where = s.execution === "executed" ? (s.outcome ?? "UNKNOWN") : `not-executed（${s.execution.reason}）`;
      return `  · ${s.scenarioId}: ${where} · 断言=${s.assertionAggregate}${s.terminationReached ? " · 终止达成" : ""}`;
    }),
    delivery === undefined
      ? `  ⚠️ 交付写回失败：${writebackError instanceof Error ? writebackError.message : String(writebackError)}`
      : `  交付：${delivery.verdict}（playable-smoke=${delivery.checks.find((c) => c.key === "playable-smoke")?.status}）${delivery.playtest?.baseline ? ` · 基线比较：${delivery.playtest.baseline.result}` : ""}`,
    `  证据：${rel(outRoot, finalDir)}`,
  ];
  return {
    result: {
      command: "playtest",
      summary,
      data: {
        runDir: rel(outRoot, target.runDir), attempt: rel(outRoot, finalDir),
        execution: report.execution, aggregate: report.aggregate ?? null,
        scenarios: report.scenarios.map((s) => ({
          scenarioId: s.scenarioId, execution: s.execution,
          outcome: s.outcome ?? null, assertionAggregate: s.assertionAggregate,
          terminationReached: s.terminationReached,
        })),
        deliveryVerdict: delivery?.verdict ?? null,
        writebackError: writebackError instanceof Error ? writebackError.message : writebackError === undefined ? null : String(writebackError),
      },
      artifacts: [
        { path: rel(outRoot, path.join(finalDir, "result.json")), kind: "playtest-report" },
        { path: rel(outRoot, path.join(target.runDir, RUN_ARTIFACT.qaReport)), kind: "qa-report" },
      ],
    },
    exitCode,
  };
}
