// 票 10 给 `review-verdict` CLI 命令立的判据 —— 视觉评审结论怎么**校验归属**并写进报告。
//
//   ⚠️ 这一组**不跑上游、不花钱**：报告在临时目录里手写，`run` 是内存里的薄壳（`run(argv, io)`）。
//     写盘那半（只动视觉评审三处 / 不覆盖 QA 层 / 初始化不伪造站点版本）由
//     `packages/pipeline/tests/delivery.test.ts` 盯；这里盯的是**CLI 的归属校验**那一层。
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { EXIT, QA_JUDGEMENTS, QA_REPORT_FORMAT } from "@game-maker/contracts";
import { run, type CliIo } from "../src/cli.js";

const dirs: string[] = [];
const tmp = (): string => { const d = mkdtempSync(path.join(tmpdir(), "gm-review-verdict-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};
const runC = (argv: string[]) => { const io = capture(); return run(argv, io).then((code) => ({ code, io })); };

/** 一份六条全跑的绿报告（QA 层，带 subject、无 delivery）。 */
const qaReport = (): Record<string, unknown> => ({
  format: QA_REPORT_FORMAT,
  checked: [...QA_JUDGEMENTS],
  failures: [],
  observations: [
    { source: "inspect", outcome: "ok", lines: [] },
    { source: "review", outcome: "unavailable", reason: "测试" },
  ],
  subject: { packId: "last-train", packVersion: 2 },
});

/** 建一个 run 目录并写好报告，返回它的绝对路径。 */
function makeRun(base: string, n: number): string {
  const runDir = path.join(base, "last-train", "run", `v${n}`);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qaReport(), null, 2) + "\n");
  return runDir;
}

const deliveryOf = (base: string, n: number): Record<string, unknown> => {
  const raw = JSON.parse(readFileSync(path.join(base, "last-train", "run", `v${n}`, "qa-report.json"), "utf8")) as Record<string, unknown>;
  return raw.delivery as Record<string, unknown>;
};

describe("review-verdict（票 10）", () => {
  it("pass 写入：exit 0，delivery.visualReview.status = pass", async () => {
    const base = tmp();
    const runDir = makeRun(base, 1);
    const { code } = await runC(["review-verdict", runDir, "--verdict", "pass", "--reviewer", "人", "--out", base]);
    expect(code).toBe(EXIT.ok);
    expect((deliveryOf(base, 1).visualReview as Record<string, unknown>).status).toBe("pass");
  });

  it("fail 写入：visualReview.status = fail，且不碰 QA 层", async () => {
    const base = tmp();
    const runDir = makeRun(base, 1);
    const { code } = await runC(["review-verdict", runDir, "--verdict", "fail", "--note", "风格对不上", "--out", base]);
    expect(code).toBe(EXIT.ok);
    const raw = JSON.parse(readFileSync(path.join(runDir, "qa-report.json"), "utf8")) as Record<string, unknown>;
    expect(raw.format).toBe(QA_REPORT_FORMAT); // QA 层还在
    expect((raw.delivery as Record<string, unknown>).visualReview).toMatchObject({ status: "fail", note: "风格对不上" });
  });

  it("归属校验：非法 runDir（不是 v<N>）→ exit 2", async () => {
    const base = tmp();
    const { code } = await runC(["review-verdict", path.join(base, "not-a-run"), "--verdict", "pass", "--out", base]);
    expect(code).toBe(EXIT.usage);
  });

  it("归属校验：缺 qa-report → exit 2", async () => {
    const base = tmp();
    const runDir = path.join(base, "last-train", "run", "v1");
    mkdirSync(runDir, { recursive: true }); // 有 run 目录、没有报告
    const { code } = await runC(["review-verdict", runDir, "--verdict", "pass", "--out", base]);
    expect(code).toBe(EXIT.usage);
  });

  it("归属校验：--verdict 不是 pass|fail → exit 2", async () => {
    const base = tmp();
    const runDir = makeRun(base, 1);
    const { code } = await runC(["review-verdict", runDir, "--verdict", "pending", "--out", base]);
    expect(code).toBe(EXIT.usage);
  });

  it("跨 run 不继承：写 v1 不动 v2 的报告", async () => {
    const base = tmp();
    const run1 = makeRun(base, 1);
    const run2 = makeRun(base, 2);
    await runC(["review-verdict", run1, "--verdict", "pass", "--out", base]);
    expect(deliveryOf(base, 2)).toBeUndefined(); // 结论不跨 run 复制
    expect(existsSync(path.join(run2, "qa-report.json"))).toBe(true);
  });
});
