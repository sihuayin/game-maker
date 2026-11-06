// **发布闸门**（P0-02b · 票 09）：所有发布路径在装配站点**之前**过同一把闸。
//
// ⚠️ 它回答的是一句话：「**这份 QA 报告属于当前这个包，而且它说可以发布吗？**」
//   两半都必须成立 —— 旧报告说「全绿」也没用（报告里没有身份 ⇒ 无法证明它是这个包的）。
//
// ⚠️ **闸放在壳（CLI / MCP）与 pipeline 的发布入口上，不放进 `assembleSite`**
//   （票 05 §8.2 的测试注意）：`assembleSite` / `assembleFromConfig` 是公开导出的库入口，
//   `packages/demo` 也不许反向依赖 pipeline。库调用方不在本票的「发布路径」定义里。
//
// ⚠️ **报告身份只钉 pack**（票 05 §8.4 的残余风险）：一份绿色 pack 报告仍不能**证明**
//   它属于当前这份 config。P1 · publish-gate 的处理不是绑 config 身份，而是**现场重跑**
//   配置敏感的那条判据（`auditPlayability`，LP-05 已把它放进 `deterministic`）：
//   当前 config 自己过不了可玩性判定 ⇒ 拒。剩余洞是报告身份本身（另有交接，见 Q8）。
//
// ⚠️ **不在这里跑 `verifyPack`**（2026-10-22 裁定）：字节完整性归 P0-04 ——
//   create / build 链在 QA 之前已经逐文件校验过；standalone `site` 不重算 checksum，
//   那是本票的已知边界（要查字节就用 `verify`）。
//
// ⚠️ **TD 显式跳过**（P2）：P0 只做横版；塔防的 QA 等价另立。跳过是**有意的**，
//   不是「忘了」—— 见 `TD_CONFIG_FORMAT` 那一支。
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  auditPlayability, CommandError, formatIssues, parseAssetPack, parseGameConfig, playabilityIssues, QA_JUDGEMENTS, QAReportSchema,
  qaVerdict, TD_CONFIG_FORMAT,
  type AssetPackManifest, type QAReport,
} from "@game-maker/contracts";

/** `manifest.json` 的原始字节指纹。⚠️ 与 `files[].checksum` **不是一回事**：
 *  后者覆盖包内文件（manifest 自身除外，自指），这一个绑住**声明本身**（id / version / files 列表）。 */
export function fileChecksum(p: string): string {
  return "sha256:" + createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

/** 一个包的 `manifest.json` 指纹。包没有 manifest ⇒ 由 `readManifest` 先拒。 */
export function manifestChecksumOf(packDir: string): string {
  return fileChecksum(path.join(packDir, "manifest.json"));
}

export type PublishGateOptions = {
  /** 要发布的包。闸只读它 —— 不改、不拷、不重算 `files[].checksum`。 */
  packDir: string;
  /** 发布用的配置。**只用来识别 TD**（P2 例外）；解不开就按非 TD 处理，让装配器报它自己的错。 */
  configPath?: string;
  /** 显式指定的 QA 报告（CLI `--qa-report` / MCP `qaReportPath`）。
   *  给了就**只用它**；外部包 / 非规范 out 树必须走这一条。 */
  qaReportPath?: string;
  /** 规范 out 树的根：自动查找 `<outRoot>/<packId>/run/v<N>/qa-report.json`。 */
  outRoot?: string;
};

export type PublishGateResult = {
  report: QAReport;
  reportPath: string;
  manifest: AssetPackManifest;
};

const MANIFEST = "manifest.json";
const REPORT = "qa-report.json";

function readManifest(packDir: string): AssetPackManifest {
  const p = path.join(packDir, MANIFEST);
  if (!fs.existsSync(p)) throw new CommandError("usage", `不是资源包（没有 ${MANIFEST}）：${packDir}`);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new CommandError("invalid", `${MANIFEST} 不是合法 JSON：${e instanceof Error ? e.message : String(e)}（${p}）`);
  }
  const parsed = parseAssetPack(raw);
  if (!parsed.ok) throw new CommandError("invalid", `${MANIFEST} 不过 schema：${parsed.errors.slice(0, 6).join("；")}（${p}）`);
  return parsed.value;
}

/** 只认 `format` 这一格；读不到一律当非 TD（**不在这里替装配器报配置错误**）。 */
function formatOf(configPath: string | undefined): string | undefined {
  if (configPath === undefined) return undefined;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as { format?: unknown };
    return typeof raw.format === "string" ? raw.format : undefined;
  } catch {
    return undefined;
  }
}

/** 规范 out 树里的候选报告，**新版本在前**。⚠️ 不从 `packDir` 反推 runDir ——
 *  run 版本与 pack 版本不保证相等（票 05 §3.2），本文件只扫调用方给的 outRoot。 */
function candidateReports(outRoot: string, packId: string): string[] {
  const runRoot = path.join(outRoot, packId, "run");
  if (!fs.existsSync(runRoot)) return [];
  return fs.readdirSync(runRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^v\d+$/.test(d.name))
    .map((d) => path.join(runRoot, d.name, REPORT))
    .filter((p) => fs.existsSync(p))
    .sort((a, b) => Number(/^v(\d+)$/.exec(path.basename(path.dirname(b)))![1])
      - Number(/^v(\d+)$/.exec(path.basename(path.dirname(a)))![1]));
}

function parseReport(p: string): QAReport {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new CommandError("invalid", `QA 报告不是合法 JSON：${e instanceof Error ? e.message : String(e)}（${p}）`);
  }
  const parsed = QAReportSchema.safeParse(raw);
  if (!parsed.success)
    throw new CommandError("invalid", `QA 报告过不了 \`qa-report/v1\`：${formatIssues(parsed.error).slice(0, 4).join("；")}（${p}）`);
  return parsed.data;
}

/** 这份报告是不是当前包的。返回 `undefined` = 是；否则是一句「为什么不是」。 */
function subjectProblem(report: QAReport, manifest: AssetPackManifest, checksum: string): string | undefined {
  const subject = report.subject;
  if (subject === undefined)
    return "报告没有包身份（`subject`）—— **没有身份 = 无法证明它属于当前包**（旧报告一律拒绝；"
      + "重跑 `build` 会生成带身份的报告）";
  if (subject.packId !== manifest.id || subject.packVersion !== manifest.version)
    return `报告属于 "${subject.packId}" v${subject.packVersion}，而当前包是 "${manifest.id}" v${manifest.version}`;
  if (subject.manifestChecksum !== undefined && subject.manifestChecksum !== checksum)
    return "报告的 `manifestChecksum` 与当前 `manifest.json` 不一致 —— 同 id/version 的声明被改过";
  return undefined;
}

/** 当前 config 自身的可玩性（P1 · publish-gate）。返回 `undefined` = 通 / 跳过。
 *
 *  ⚠️ 它回答的是「**这份 config 自己过不过得了可玩性判定**」，不是「报告属不属于这份 config」——
 *    报告身份仍只钉 pack（`subjectProblem`）；这一项补的是「config A 的绿报告 + config B」那个洞。
 *  ⚠️ **解不开的 config 跳过**：schema 错由装配器报它自己的错，不在这里重复 Ownership。
 *  ⚠️ `configPath` 缺省 ⇒ 跳过（库调用 / 既有测试）；四个发布入口都传它（CLI build/site、
 *     MCP create_game/assemble_site）—— 缺省不得成为发布入口的逃逸路径。
 */
function configProblem(configPath: string | undefined, manifest: AssetPackManifest): string | undefined {
  if (configPath === undefined) return undefined;
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(configPath, "utf8")); } catch { return undefined; }
  const parsed = parseGameConfig(raw);
  if (!parsed.ok) return undefined;
  const hard = playabilityIssues(auditPlayability(parsed.value, manifest)).filter((i) => i.severity === "error");
  if (hard.length === 0) return undefined;
  return `**这份 config 过不了可玩性判定**（${hard.length} 条硬失败）：\n`
    + hard.slice(0, 6).map((i) => `  · ${i.where}: ${i.message}`).join("\n");
}

/** 判据层面的放行条件：**没有 error，且六条全跑过**。
 *  ⚠️ 决策只看 `failures` / `checked`，**不看 `qaVerdict` 的字符串** —— 那是派生量，
 *    这里只是用它来把「没跑」与「跑了不行」分成两句话。 */
function verdictProblem(report: QAReport): string | undefined {
  const hard = report.failures.filter((f) => f.severity === "error");
  if (hard.length > 0)
    return `QA 判据没过（${hard.length} 条硬失败，${qaVerdict(report)}）：\n`
      + hard.slice(0, 8).map((f) => `  · [${f.judgement}] ${f.target}：${f.detail.replace(/\n/g, "\n      ")}`).join("\n");
  const missing = QA_JUDGEMENTS.filter((j) => !report.checked.includes(j));
  if (missing.length > 0)
    return `QA 没跑全（${report.checked.length}/${QA_JUDGEMENTS.length}）—— 没跑的：${missing.join(" · ")}。`
      + "**没查不等于通过**";
  return undefined;
}

/**
 * 发布闸：报告存在、属于当前包、且判据全部通过（`warning` 不阻断）。
 *
 * @returns 通过时返回报告与路径；**TD 配置返回 `undefined`**（P2 例外，显式跳过）。
 * @throws `CommandError("invalid")`（退出码 4）—— 缺报告 / 身份不符 / error / incomplete。
 */
export function assertPublishableQa(opts: PublishGateOptions): PublishGateResult | undefined {
  // ── P2 例外：塔防今天没有 QA 等价，显式跳过（不是忘了）────────────────────────
  if (formatOf(opts.configPath) === TD_CONFIG_FORMAT) return undefined;

  const manifest = readManifest(opts.packDir);
  const checksum = manifestChecksumOf(opts.packDir);
  const subjectLine = `当前包："${manifest.id}" v${manifest.version}（${opts.packDir}）`;

  // ── 定位报告：显式优先；否则只扫规范 out 树 ──────────────────────────────────
  let reportPath: string;
  let report: QAReport;
  if (opts.qaReportPath !== undefined) {
    reportPath = path.resolve(opts.qaReportPath);
    if (!fs.existsSync(reportPath))
      throw new CommandError("invalid", `找不到 QA 报告：${reportPath}\n${subjectLine}\n`
        + "⇒ 先跑 `build`（QA 在 build 里跑），或用 `--qa-report` / `qaReportPath` 指一份属于这个包的报告。");
    report = parseReport(reportPath);
    const why = subjectProblem(report, manifest, checksum);
    if (why !== undefined) throw new CommandError("invalid", `QA 报告不能用于发布：${why}。\n报告：${reportPath}\n${subjectLine}`);
  } else {
    const outRoot = opts.outRoot === undefined ? undefined : path.resolve(opts.outRoot);
    const candidates = outRoot === undefined ? [] : candidateReports(outRoot, manifest.id);
    const tried: string[] = [];
    let chosen: { path: string; report: QAReport } | undefined;
    for (const p of candidates) {
      let candidate: QAReport;
      try { candidate = parseReport(p); } catch (e) {
        tried.push(`  · ${p}：读不出来（${e instanceof Error ? e.message : String(e)}）`);
        continue;
      }
      const why = subjectProblem(candidate, manifest, checksum);
      if (why === undefined) { chosen = { path: p, report: candidate }; break; }
      tried.push(`  · ${p}：${why}`);
    }
    if (chosen === undefined) {
      const searched = outRoot === undefined
        ? "（没有给 outRoot —— 无法自动查找）"
        : `${path.join(outRoot, manifest.id, "run", "v*", REPORT)}（${candidates.length} 份候选）`;
      throw new CommandError("invalid",
        `找不到属于当前包的 QA 报告。\n${subjectLine}\n查过：${searched}\n`
        + (tried.length === 0 ? "" : `候选为什么不能用：\n${tried.join("\n")}\n`)
        + "⇒ 先跑 `build`（QA 在 build 里跑），或用 `--qa-report` / `qaReportPath` 指一份属于这个包的报告。");
    }
    reportPath = chosen.path;
    report = chosen.report;
  }

  const bad = verdictProblem(report);
  if (bad !== undefined)
    throw new CommandError("invalid", `${bad}\n报告：${reportPath}\n${subjectLine}\n`
      + "⚠️ 报告已经落盘 —— 那是这一次运行的**诊断**；重抽一次改不了判据说的事实。");

  // ── config 自身的可达性（P1 · publish-gate）：报告全绿也不能替一份走不通的 config 放行 ──
  //   ⚠️ 显式报告与 auto 查找两条分支在这里汇合 ⇒ 只调一次。
  const unreachable = configProblem(opts.configPath, manifest);
  if (unreachable !== undefined)
    throw new CommandError("invalid", `${unreachable}\nconfig：${path.resolve(opts.configPath!)}\n报告：${reportPath}\n${subjectLine}\n`
      + "⚠️ 发布闸会**现场重跑**可达性：报告只钉包身份，不能证明这份 config 走不走得通。");

  return { report, reportPath, manifest };
}
