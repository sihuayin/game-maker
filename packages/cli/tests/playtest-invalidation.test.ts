// 票 05 / 票 11：准备拒绝也必须先撤销旧 pass（CLI 集成，不启 Chrome）。
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { EXIT, QA_JUDGEMENTS, QA_REPORT_FORMAT, buildDeliveryReport } from "@game-maker/contracts";
import { run, type CliIo } from "../src/cli.js";

const dirs: string[] = [];
const tmp = (): string => { const d = mkdtempSync(path.join(tmpdir(), "gm-playtest-invalidate-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};
const runC = (argv: string[]) => { const io = capture(); return run(argv, io).then((code) => ({ code, io })); };
const writeJson = (p: string, v: unknown) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;

function setup(): { base: string; runDir: string } {
  const base = tmp();
  const runDir = path.join(base, "g", "run", "v1");
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
    visualReview: { status: "pass" },
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
    ],
  });
  writeJson(path.join(runDir, "qa-report.json"), {
    format: QA_REPORT_FORMAT,
    subject: { packId: "g", packVersion: 1 },
    checked: [...QA_JUDGEMENTS],
    failures: [],
    observations: [
      { source: "inspect", outcome: "ok", lines: [] },
      { source: "review", outcome: "unavailable", reason: "测试" },
    ],
    delivery,
  });
  return { base, runDir };
}

describe("playtest 失败重跑撤销（CLI）", () => {
  it("准备拒绝（site 目录缺失）→ exit 4，旧 pass 已先撤销为 blocked", async () => {
    const { base, runDir } = setup();
    const { code } = await runC(["playtest", runDir, "--out", base]);
    expect(code).toBe(EXIT.invalid);

    const qa = readJson(path.join(runDir, "qa-report.json"));
    const d = qa.delivery as Record<string, unknown>;
    expect(d.playtest).toBeUndefined();
    expect((d.checks as Array<Record<string, unknown>>).find((c) => c.key === "playable-smoke")).toMatchObject({ status: "blocked" });
    expect(d.verdict).toBe("blocked");

    const invDir = path.join(runDir, "playtest", "invalidations");
    expect(existsSync(invDir)).toBe(true);
    const invName = readdirSync(invDir).find((f) => f.endsWith(".json"));
    const inv = readJson(path.join(invDir, invName!));
    expect(inv.before).toMatchObject({ playableSmoke: "pass", verdict: "pass" });
    expect(inv.after).toMatchObject({ playableSmoke: "blocked", verdict: "blocked" });

    const rejDir = path.join(runDir, "playtest", "rejections");
    expect(existsSync(rejDir)).toBe(true);
    const rejName = readdirSync(rejDir).find((f) => f.endsWith(".json"));
    const rej = readJson(path.join(rejDir, rejName!));
    expect(rej.invalidation).toMatchObject({ after: { playableSmoke: "blocked" } });
  });
});
