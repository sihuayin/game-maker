// **交付验收子对象的落盘**（FPVS-V1-P1 · 票 08）。
//
// ⚠️ **契约在 `@game-maker/contracts` 的 `delivery.ts`**，本文件只做两件事：
//   ① 把「这一版这次运行」的身份（runId / pack / config / site）与六项检查装成一份 `delivery`；
//   ② 把它**并进已经落盘的 `qa-report.json`**（QA 层之上补一层，不覆盖 QA 层）。
//
// ⚠️ **两阶段落盘**（票 04 Q3）：QA 步写 QA 层（`create-game.ts` 里 `writeJson(qaReportPath, qa)`）；
//   站点装配成功之后**由壳（CLI/MCP）调**本文件补写 `delivery`（含 `assembleSite` 显式分配的站点版本）。
//   ⚠️ **失败路径**（票 04 Q4 表）：QA 硬失败在 `create-game.ts` **提前**落 `delivery`；
//   站点确定性失败由壳 catch 后落 `delivery`。pack/config 生成失败**不强行造报告**（没有 QA 报告可并）。
//
// ⚠️ **收尾异常不覆盖原始失败**：写 `delivery` 失败只记日志、不掩盖原来的 QA/站点失败（票 04 Q4 末行）。
import fs from "node:fs";
import path from "node:path";
import {
  applyVisualReview, buildDeliveryReport, CommandError, DELIVERY_CHECK_LABELS, QAReportSchema, qaVerdict, visualReviewToCheck,
  type AssetPackManifest, type DeliveryCheckKey, type DeliveryReport, type DeliveryVisualReview, type QAReport,
} from "@game-maker/contracts";
import { RUN_ARTIFACT, writeJson } from "./artifacts.js";
import { manifestChecksumOf } from "./publish-gate.js";

const rel = (outRoot: string, p: string): string => path.relative(outRoot, p).split(path.sep).join("/");

/** 三个 builder 共用的身份：runId（复用 run/v<N> 命名）+ pack（复用 subject）+ config.file。 */
type DeliveryIdentity = {
  runId: string;
  pack: { packId: string; packVersion: number; manifestChecksum: string };
  config: { file: string };
};

function deliveryIdentity(
  outRoot: string, runDir: string, packDir: string, manifest: AssetPackManifest, configPath: string,
): DeliveryIdentity {
  return {
    runId: rel(outRoot, runDir),
    pack: {
      packId: manifest.id,
      packVersion: manifest.version,
      manifestChecksum: manifestChecksumOf(packDir),
    },
    config: { file: rel(outRoot, configPath) },
  };
}

/**
 * **QA 段硬失败 → 提前落 `delivery`**（票 04 Q4：QA fail、下游 blocked、视觉 pending→incomplete、最终 fail）。
 *
 * ⚠️ `qaStatus` 由调用方给：`"fail"` = 确定性硬失败（判据 error 或机制覆盖缺）；`"incomplete"` = 判据没跑全。
 *   两者都让站点/试玩**无法执行**（`assertQaPassed` 阻断）⇒ 记 `blocked`；视觉**未评审 ≠ 前置阻塞** ⇒ 记 `incomplete`。
 */
export function buildQaFailureDelivery(opts: {
  outRoot: string; runDir: string; packDir: string; manifest: AssetPackManifest; configPath: string;
  qaStatus: "fail" | "incomplete";
}): DeliveryReport {
  const id = deliveryIdentity(opts.outRoot, opts.runDir, opts.packDir, opts.manifest, opts.configPath);
  const qaReportPath = path.join(opts.runDir, RUN_ARTIFACT.qaReport);
  return buildDeliveryReport({
    ...id,
    checks: [
      { key: "asset-pack", status: "pass" },
      { key: "config", status: "pass" },
      { key: "qa", status: opts.qaStatus },
      { key: "site", status: "blocked" },
      { key: "playable-smoke", status: "blocked" },
      { key: "visual-review", status: "incomplete" },
    ],
    evidence: [{ ref: "qa-report", path: rel(opts.outRoot, qaReportPath) }],
  });
}

/** 站点装配成功之后补写 `delivery`（票 04 Q3 阶段二）。⚠️ 试玩/视觉此时**还没做** ⇒ 记 `incomplete`，
 *  最终结论 `incomplete`（票 09/10 落地后再各自更新）。 */
export function buildSiteSuccessDelivery(opts: {
  outRoot: string; runDir: string; packDir: string; manifest: AssetPackManifest; configPath: string;
  siteVersion: number; shellVersion: string;
}): DeliveryReport {
  const id = deliveryIdentity(opts.outRoot, opts.runDir, opts.packDir, opts.manifest, opts.configPath);
  return buildDeliveryReport({
    ...id,
    site: { version: opts.siteVersion, shell: opts.shellVersion },
    checks: [
      { key: "asset-pack", status: "pass" },
      { key: "config", status: "pass" },
      { key: "qa", status: "pass" },
      { key: "site", status: "pass" },
      { key: "playable-smoke", status: "incomplete" },
      { key: "visual-review", status: "incomplete" },
    ],
  });
}

/** 站点装配**确定性失败** → 补写 `delivery`（票 04 Q4：站点 fail、试玩 blocked、视觉 incomplete、最终 fail）。 */
export function buildSiteFailureDelivery(opts: {
  outRoot: string; runDir: string; packDir: string; manifest: AssetPackManifest; configPath: string;
}): DeliveryReport {
  const id = deliveryIdentity(opts.outRoot, opts.runDir, opts.packDir, opts.manifest, opts.configPath);
  const qaReportPath = path.join(opts.runDir, RUN_ARTIFACT.qaReport);
  return buildDeliveryReport({
    ...id,
    checks: [
      { key: "asset-pack", status: "pass" },
      { key: "config", status: "pass" },
      { key: "qa", status: "pass" },
      { key: "site", status: "fail" },
      { key: "playable-smoke", status: "blocked" },
      { key: "visual-review", status: "incomplete" },
    ],
    evidence: [{ ref: "qa-report", path: rel(opts.outRoot, qaReportPath) }],
  });
}

/**
 * 把一份 `delivery` **并进** `run/v<N>/qa-report.json`（不覆盖 QA 层字段）。
 *
 * ⚠️ **读回再写**：QA 层字段原样保留，只在顶层加 `delivery`（票 04 Q3「保留 QA 层原始字段、不覆盖/重算」）。
 * ⚠️ 读不出 / 过不了 `qa-report/v1`（现在含可选 `delivery`）⇒ **抛** —— 那是报告坏了，不是能静默吞的。
 */
export function writeDeliveryToReport(runDir: string, delivery: DeliveryReport): void {
  const p = path.join(runDir, RUN_ARTIFACT.qaReport);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`读不出 \`${RUN_ARTIFACT.qaReport}\`（${p}）：${(e as Error).message}`);
  }
  const report = QAReportSchema.parse(raw);
  writeJson(p, { ...report, delivery });
}

/** 供两个壳在 catch 里「尽力写、不掩盖原始失败」的小工具。返回 true = 写成功。 */
export function tryWriteDelivery(runDir: string, delivery: DeliveryReport): boolean {
  try {
    writeDeliveryToReport(runDir, delivery);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 五、视觉评审写回（票 10）
//
//   `review-verdict` 那一支（**仅 CLI**）要写 `delivery.visualReview`。⚠️ 与上面 `writeDeliveryToReport`
//   不同：它**不整体重写** `delivery`，而是**只动视觉评审那三处**（`visualReview` 对象、`visual-review`
//   检查项、`verdict`）—— 其余字段（身份/站点/证据/已知限制）原样保留，QA 层更是一个字都不碰。

/**
 * 把一次视觉评审并进 `run/v<N>/qa-report.json`：
 *   · 已有 `delivery` → `applyVisualReview`（只改视觉评审三处）；
 *   · 没有 `delivery` → 初始化一份（身份从 `subject` + runDir 推，**不伪造站点版本**）。
 * ⚠️ **原子替换**：先写 `.tmp` 再 rename（票 06 Q2「不就地覆写」），中断不会留下半截报告。
 */
export function writeVisualReviewToReport(opts: {
  outRoot: string;
  runDir: string;
  review: DeliveryVisualReview;
}): void {
  const p = path.join(opts.runDir, RUN_ARTIFACT.qaReport);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`读不出 \`${RUN_ARTIFACT.qaReport}\`（${p}）：${(e as Error).message}`);
  }
  const report = QAReportSchema.parse(raw);
  const delivery = report.delivery === undefined
    ? initialDeliveryWithReview(opts.outRoot, opts.runDir, report, opts.review)
    : applyVisualReview(report.delivery, opts.review);
  writeJsonAtomic(p, { ...report, delivery });
}

/** 没有 `delivery` 时初始化一份（票 10 项 1）：构建段三查（资源/配置/QA）按「报告已到 QA」记，
 *  站点/试玩记 `incomplete`（未做）、视觉用本次评审。⚠️ **不伪造站点版本**：`site` 省略、`site` 检查项 `incomplete`。 */
function initialDeliveryWithReview(
  outRoot: string, runDir: string, report: QAReport, review: DeliveryVisualReview,
): DeliveryReport {
  const subject = report.subject;
  if (subject === undefined)
    throw new CommandError("invalid", "这份报告没有 `subject`（包身份），无法初始化交付结论 —— 重跑 `build` 会生成带身份的");
  return buildDeliveryReport({
    runId: rel(outRoot, runDir),
    pack: {
      packId: subject.packId,
      packVersion: subject.packVersion,
      ...(subject.manifestChecksum === undefined ? {} : { manifestChecksum: subject.manifestChecksum }),
    },
    config: { file: rel(outRoot, path.join(runDir, RUN_ARTIFACT.config)) },
    checks: [
      { key: "asset-pack", status: "pass" },
      { key: "config", status: "pass" },
      { key: "qa", status: qaVerdict(report) },
      { key: "site", status: "incomplete" },
      { key: "playable-smoke", status: "incomplete" },
      { key: "visual-review", status: visualReviewToCheck(review.status) },
    ],
    visualReview: review,
  });
}

/** **原子替换**（票 06 Q2「不就地覆写」）：先写 `.tmp` 再 `rename`。 */
function writeJsonAtomic(p: string, o: unknown): void {
  const tmp = `${p}.tmp-${process.pid}`;
  writeJson(tmp, o);
  fs.renameSync(tmp, p);
}

// ─────────────────────────────────────────────────────────────────────────────
// 六、终端交付聚合摘要（票 13 · FR-06，P1）
//
//   从 `delivery` 派生给终端读的那几行 —— ⚠️ **只渲染、不重算**：`verdict` 直接读 `delivery.verdict`
//   （`deriveDeliveryVerdict`/`deliveryVerdictOf` 已经算好了），不另建一套状态计算逻辑（票 04 Q5）。
//   失败 / 未完成 / 阻塞**分开列**（FR-06：不把同一问题在多个阶段的重复记录当多个缺陷）。
//   全文仍在 `qa-report.json`，这里只是聚合。

/** 从 `delivery` 派生终端交付摘要。`delivery` 缺席 ⇒ 明示「尚无交付结论」，**不默认 pass**。 */
export function deliverySummaryOf(delivery: DeliveryReport | undefined): {
  summary: string[]; data: Record<string, unknown>;
} {
  if (delivery === undefined) {
    return {
      summary: ["⚠️ 交付结论：尚无（这份报告没有 delivery 段 —— 不算通过）"],
      data: { deliveryVerdict: null },
    };
  }
  const failed = delivery.checks.filter((c) => c.status === "fail");
  const incomplete = delivery.checks.filter((c) => c.status === "incomplete");
  const blocked = delivery.checks.filter((c) => c.status === "blocked");
  const label = (k: string) => DELIVERY_CHECK_LABELS[k as DeliveryCheckKey] ?? k;
  const verdictLine = {
    pass: "✅ 交付结论：pass —— 六类检查全过、视觉已确认",
    fail: "✗ 交付结论：fail —— 有确定性失败",
    blocked: "⚠️ 交付结论：blocked —— 前置阶段失败",
    incomplete: "⚠️ 交付结论：incomplete —— 尚不满足正式交付条件",
  }[delivery.verdict];
  return {
    summary: [
      verdictLine,
      ...failed.map((c) => `  ✗ ${label(c.key)}${c.detail ? `：${c.detail}` : ""}`),
      ...blocked.map((c) => `  · ${label(c.key)}：被前置阻塞`),
      ...incomplete.map((c) => `  ⚠️ ${label(c.key)}：未完成${c.detail ? `（${c.detail}）` : ""}`),
      `  视觉评审：${delivery.visualReview.status}` +
        (delivery.visualReview.reviewer ? `（${delivery.visualReview.reviewer}）` : ""),
      ...(delivery.knownLimitations ?? []).map((k) => `  已知限制：${k}`),
    ],
    data: {
      deliveryVerdict: delivery.verdict,
      deliveryChecks: delivery.checks.map((c) => ({ key: c.key, status: c.status, ...(c.detail === undefined ? {} : { detail: c.detail }) })),
      visualReview: delivery.visualReview,
      knownLimitations: delivery.knownLimitations ?? [],
    },
  };
}
