// **失败重跑撤销**（P0-02 v2 票 05 / 票 11）。
//
// ⚠️ 语义：只要一次 playtest 调用拿到「runDir 合法 + qa-report 可读 + delivery」，
//   就**先撤销**旧试玩结论 —— 移除 `delivery.playtest`、移除旧 `playtest-*` 证据引用、
//   把 `playable-smoke` 置 `blocked`。之后无论准备拒绝、harness 崩溃、写回失败还是进程被杀，
//   旧 pass 都不会回来；只有成功写回才恢复。
// ⚠️ 旧 attempt 文件留在磁盘，只从当前 delivery 摘要与引用中移除。
// ⚠️ 报告：`run/vN/playtest/invalidations/<timestamp>.json`（原因、前后状态、被移除的 refs）。
import fs from "node:fs";
import path from "node:path";
import {
  buildDeliveryReport, QAReportSchema,
  type DeliveryCheckStatus,
} from "@game-maker/contracts";
import { RUN_ARTIFACT, jstr } from "./artifacts.js";

export type PlaytestInvalidation =
  | {
      ok: true;
      recordPath?: string;
      recordError?: string;
      before: { playableSmoke?: DeliveryCheckStatus; verdict: string; playtestReport?: string; playtestRefs: string[] };
      after: { playableSmoke: DeliveryCheckStatus; verdict: string };
    }
  | { ok: false; reason: string };

function writeInvalidationRecord(runDir: string, body: Record<string, unknown>): string {
  const dir = path.join(runDir, "playtest", "invalidations");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (let i = 1; ; i += 1) {
    const file = path.join(dir, i === 1 ? `${stamp}.json` : `${stamp}-${i}.json`);
    try {
      fs.writeFileSync(file, jstr(body), { flag: "wx" });
      return file;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
}

/**
 * 撤销旧试玩结论。读不出 qa-report / 没有 delivery 时返回 `ok:false`（无法写回的边界，
 * 调用方负责把这个事实写进拒绝记录）。
 */
export function invalidatePlayableSmoke(runDir: string, reason: string): PlaytestInvalidation {
  const qaPath = path.join(runDir, RUN_ARTIFACT.qaReport);
  let report;
  try { report = QAReportSchema.parse(JSON.parse(fs.readFileSync(qaPath, "utf8"))); }
  catch (e) { return { ok: false, reason: `qa-report 不可用：${e instanceof Error ? e.message : String(e)}` }; }
  const d = report.delivery;
  if (d === undefined) return { ok: false, reason: "qa-report 没有 delivery" };

  const smoke = d.checks.find((c) => c.key === "playable-smoke");
  const playtestRefs = d.evidence.filter((e) => e.ref.startsWith("playtest-")).map((e) => e.ref);
  const before = {
    ...(smoke === undefined ? {} : { playableSmoke: smoke.status }),
    verdict: d.verdict,
    ...(d.playtest === undefined ? {} : { playtestReport: d.playtest.report }),
    playtestRefs,
  };

  const checks = d.checks.map((c) => c.key === "playable-smoke"
    ? { key: c.key, status: "blocked" as const, detail: reason }
    : c);
  const next = buildDeliveryReport({
    runId: d.runId,
    pack: d.pack,
    config: d.config,
    ...(d.site === undefined ? {} : { site: d.site }),
    checks,
    visualReview: d.visualReview,
    evidence: d.evidence.filter((e) => !e.ref.startsWith("playtest-")),
    ...(d.knownLimitations === undefined ? {} : { knownLimitations: d.knownLimitations }),
  });

  const tmp = `${qaPath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, jstr({ ...report, delivery: next }));
    fs.renameSync(tmp, qaPath);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    return { ok: false, reason: `撤销写回失败：${e instanceof Error ? e.message : String(e)}` };
  }

  const after = {
    playableSmoke: next.checks.find((c) => c.key === "playable-smoke")?.status ?? "blocked",
    verdict: next.verdict,
  };
  try {
    const recordPath = writeInvalidationRecord(runDir, {
      at: new Date().toISOString(),
      reason,
      before,
      after,
      removedRefs: playtestRefs,
    });
    return { ok: true, recordPath, before, after };
  } catch (e) {
    return { ok: true, recordError: e instanceof Error ? e.message : String(e), before, after };
  }
}
