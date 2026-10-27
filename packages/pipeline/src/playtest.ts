// 试玩结果的**写回层**（Playtest V1 · 票 08）—— 唯一有 I/O 的一层。
//
// ⚠️ 契约与纯函数在 `@game-maker/contracts`：`applyPlaytest` 只合并内存里的 delivery；
//   本文件负责重新读取当前 `qa-report.json`、重新验证身份、原子提交。
// ⚠️ **身份不匹配绝不污染当前 delivery**：版本/站点/配置对不上就拒写，留
//   `writeback-error.json`，退出码由 CLI 决定（4 = 准备拒绝）。
// ⚠️ 只动三处：`playable-smoke` 检查项、`delivery.playtest`、`verdict`；QA 层字段原样保留。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  applyPlaytest, CommandError, QAReportSchema,
  type DeliveryEvidence, type DeliveryReport, type PlaytestReport,
} from "@game-maker/contracts";
import { jstr } from "./artifacts.js";

const sha256File = (p: string): string => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;

/**
 * 把一份**已归因**的试玩报告写回 `run/v<N>/qa-report.json` 的 `delivery`。
 *
 * 失败语义（票 06 Q8）：
 *   · 读不出 / schema 不过 / 没有 delivery / 身份不匹配 ⇒ **抛**（调用方退出 4，写 `writeback-error.json`）；
 *   · 写临时文件或 rename 失败 ⇒ **抛**（调用方保留 attempt 报告、退出 1）；
 *   · 幂等：同一 attempt 重复写回结果相同，证据按 ref 去重，不无限堆叠。
 */
export function writePlaytestToReport(opts: {
  outRoot: string;
  runDir: string;
  report: PlaytestReport;
  evidence: readonly DeliveryEvidence[];
}): DeliveryReport {
  const qaPath = path.join(opts.runDir, "qa-report.json");
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(qaPath, "utf8"));
  } catch (e) {
    throw new CommandError("invalid", `读不出 qa-report.json（${qaPath}）：${e instanceof Error ? e.message : String(e)}`);
  }
  const qa = QAReportSchema.parse(raw);
  if (qa.delivery === undefined)
    throw new CommandError("invalid", "这份 qa-report 没有 delivery（站点/交付收尾尚未完成）—— 不能写回试玩结果");

  const resultEvidence = opts.evidence.find((e) => e.ref === "playtest-result");
  if (resultEvidence === undefined)
    throw new CommandError("invalid", "写回缺少 playtest-result 证据条目（报告路径）");
  const resultPath = path.resolve(opts.outRoot, resultEvidence.path);
  if (!fs.existsSync(resultPath))
    throw new CommandError("invalid", `playtest-result 指向的报告不存在：${resultEvidence.path}`);

  // 身份：报告 vs 当前 delivery + 当前 run 的 config 字节。
  const d = qa.delivery;
  const configPath = path.resolve(opts.outRoot, d.config.file);
  if (!fs.existsSync(configPath))
    throw new CommandError("invalid", `delivery.config 指向的配置不存在：${d.config.file}`);
  const configChecksum = sha256File(configPath);
  if (opts.report.identity.configChecksum !== undefined && opts.report.identity.configChecksum !== configChecksum)
    throw new CommandError("invalid",
      `试玩报告的 config 身份与当前 run 不一致：报告 ${opts.report.identity.configChecksum} / 当前 ${configChecksum}`);
  if (d.pack.manifestChecksum !== undefined && opts.report.identity.packChecksum !== undefined &&
      d.pack.manifestChecksum !== opts.report.identity.packChecksum)
    throw new CommandError("invalid", "试玩报告的 pack checksum 与当前 delivery 不一致");

  const next = applyPlaytest(d, opts.report, opts.evidence);

  // 原子替换：同一目录的临时文件 → rename；rename 前 schema 校验与 verdict 重算已在 applyPlaytest/buildDeliveryReport 内完成。
  const tmp = path.join(opts.runDir, `.qa-report.json.tmp-${process.pid}`);
  try {
    fs.writeFileSync(tmp, jstr({ ...qa, delivery: next }));
    fs.renameSync(tmp, qaPath);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    throw e;
  }
  return next;
}

/** 写回失败的独立诊断证据；尽量原子，写不下也不掩盖原始错误。返回是否写成功。 */
export function writePlaytestWritebackError(attemptDir: string, error: unknown, target: string): boolean {
  const p = path.join(attemptDir, "writeback-error.json");
  const tmp = `${p}.tmp-${process.pid}`;
  const body = {
    at: new Date().toISOString(),
    target,
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack !== undefined ? { stack: error.stack } : {}),
  };
  try {
    fs.writeFileSync(tmp, jstr(body));
    fs.renameSync(tmp, p);
    return true;
  } catch {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    return false;
  }
}
