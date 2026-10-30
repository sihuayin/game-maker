// 票 05 / 票 11：失败重跑撤销（旧 pass 在 attempt 开始前就失效）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  QAReportSchema, QA_JUDGEMENTS, buildDeliveryReport,
} from "@game-maker/contracts";
import { invalidatePlayableSmoke } from "../src/playtest-invalidation.js";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-invalidate-")); dirs.push(d); return d; };
const writeJson = (p: string, v: unknown) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;

function setup(): { runDir: string } {
  const outRoot = path.join(tmp(), "out");
  const runDir = path.join(outRoot, "g", "run", "v1");
  const delivery = buildDeliveryReport({
    runId: "g/run/v1",
    pack: { packId: "g", packVersion: 1 },
    config: { file: "g/run/v1/game-config.json" },
    site: { version: 1, shell: "2" },
    checks: [
      { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
      { key: "site", status: "pass" }, { key: "playable-smoke", status: "pass", detail: "SUCCESS" },
      { key: "visual-review", status: "pass" },
    ],
    visualReview: { status: "pass", reviewer: "人", reviewedAt: "2026-10-01T00:00:00.000Z" },
    playtest: {
      report: "g/run/v1/playtest/v1/result.json",
      reportVersion: "playtest-report/v1",
      execution: "executed",
      aggregate: "SUCCESS",
      scenarios: [{ scenarioId: "success-basic", required: true, execution: "executed", outcome: "SUCCESS", evidence: ["playtest-events"] }],
      evidence: ["playtest-result", "playtest-events"],
    },
    evidence: [
      { ref: "playtest-result", path: "g/run/v1/playtest/v1/result.json" },
      { ref: "playtest-events", path: "g/run/v1/playtest/v1/success-basic/events.jsonl" },
      { ref: "config-evidence", path: "g/run/v1/game-config.json" },
    ],
    knownLimitations: ["fixture"],
  });
  writeJson(path.join(runDir, "qa-report.json"), {
    format: "qa-report/v1",
    subject: { packId: "g", packVersion: 1 },
    checked: [...QA_JUDGEMENTS],
    failures: [],
    observations: [
      { source: "inspect", outcome: "ok", lines: [] },
      { source: "review", outcome: "unavailable", reason: "fixture" },
    ],
    delivery,
  });
  return { runDir };
}

describe("invalidatePlayableSmoke（票 05 / 票 11）", () => {
  it("旧 pass → blocked：移除 playtest 摘要与旧 playtest-* 引用，写 invalidation 记录", () => {
    const { runDir } = setup();
    const r = invalidatePlayableSmoke(runDir, "旧试玩结果已撤销：新的 attempt 正在进行");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.before).toMatchObject({ playableSmoke: "pass", verdict: "pass", playtestReport: "g/run/v1/playtest/v1/result.json" });
    expect(r.after).toEqual({ playableSmoke: "blocked", verdict: "blocked" });
    expect(r.recordPath).toBeDefined();
    const record = readJson(r.recordPath!);
    expect(record.reason).toMatch(/撤销/);
    expect(record.removedRefs).toEqual(["playtest-result", "playtest-events"]);
    expect(record.before).toMatchObject({ playableSmoke: "pass", verdict: "pass" });
    expect(record.after).toMatchObject({ playableSmoke: "blocked", verdict: "blocked" });

    const qa = readJson(path.join(runDir, "qa-report.json"));
    const d = qa.delivery as Record<string, unknown>;
    expect(d.playtest).toBeUndefined();
    expect((d.checks as Array<Record<string, unknown>>).find((c) => c.key === "playable-smoke")).toMatchObject({ status: "blocked" });
    expect((d.evidence as Array<Record<string, unknown>>).map((e) => e.ref)).toEqual(["config-evidence"]);
    expect(d.verdict).toBe("blocked");
    expect(fs.readdirSync(runDir).filter((f) => f.includes(".tmp"))).toEqual([]);
  });

  it("重复撤销是幂等的，但每次 attempt 仍留一条记录", () => {
    const { runDir } = setup();
    invalidatePlayableSmoke(runDir, "第一次");
    const second = invalidatePlayableSmoke(runDir, "第二次");
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.before).toMatchObject({ playableSmoke: "blocked", verdict: "blocked" });
    expect(second.after).toMatchObject({ playableSmoke: "blocked", verdict: "blocked" });
    const dir = path.join(runDir, "playtest", "invalidations");
    expect(fs.readdirSync(dir).filter((f) => f.endsWith(".json"))).toHaveLength(2);
  });

  it("qa-report 缺 delivery ⇒ ok:false（无法撤销的边界）", () => {
    const { runDir } = setup();
    const p = path.join(runDir, "qa-report.json");
    const qa = readJson(p);
    delete qa.delivery;
    writeJson(p, qa);
    const r = invalidatePlayableSmoke(runDir, "x");
    expect(r.ok).toBe(false);
  });

  it("qa-report 不存在 ⇒ ok:false", () => {
    const r = invalidatePlayableSmoke(path.join(tmp(), "g", "run", "v1"), "x");
    expect(r.ok).toBe(false);
  });
});
