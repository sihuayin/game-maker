// 票 10 / P0-02 v2 票 04：`review-verdict` 的归属校验与审核记录写回。
// ⚠️ 不跑上游、不花钱：run 目录、pack/site/config、qa-report 与审核记录都在临时目录里手写。
import crypto from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  EXIT, QA_JUDGEMENTS, QA_REPORT_FORMAT, VISUAL_REVIEW_RECORD_FORMAT, buildDeliveryReport,
} from "@game-maker/contracts";
import { manifestChecksumOf } from "@game-maker/pipeline";
import { run, type CliIo } from "../src/cli.js";

const dirs: string[] = [];
const tmp = (): string => { const d = mkdtempSync(path.join(tmpdir(), "gm-review-verdict-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};
const runC = (argv: string[]) => { const io = capture(); return run(argv, io).then((code) => ({ code, io })); };
const writeJson = (p: string, v: unknown) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };
const sha = (p: string) => `sha256:${crypto.createHash("sha256").update(readFileSync(p)).digest("hex")}`;

type Fx = { base: string; runDir: string; packChecksum: string; configChecksum: string };

function makeRun(base: string, n = 1): Fx {
  const gameRoot = path.join(base, "last-train");
  const runDir = path.join(gameRoot, "run", `v${n}`);
  const packDir = path.join(gameRoot, "pack", "v1");
  const siteDir = path.join(gameRoot, "site", "v1");
  const configText = JSON.stringify({ format: "game-config/v1", entities: [], terrain: [], objective: { kind: "collect-then-reach", gate: "g" } }, null, 2) + "\n";
  writeJson(path.join(packDir, "manifest.json"), { id: "last-train", version: 1, assets: [], files: [] });
  mkdirSync(siteDir, { recursive: true });
  writeFileSync(path.join(siteDir, "game-config.json"), configText);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(path.join(runDir, "game-config.json"), configText);
  writeJson(path.join(siteDir, "site.json"), { shell: "2", pack: "v1", config: "game-config.json" });
  const packChecksum = manifestChecksumOf(packDir);
  const configChecksum = sha(path.join(runDir, "game-config.json"));
  const delivery = buildDeliveryReport({
    runId: `last-train/run/v${n}`,
    pack: { packId: "last-train", packVersion: 1, manifestChecksum: packChecksum },
    config: { file: `last-train/run/v${n}/game-config.json` },
    site: { version: 1, shell: "2" },
    checks: [
      { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
      { key: "site", status: "pass" }, { key: "playable-smoke", status: "pass" }, { key: "visual-review", status: "pass" },
    ],
    visualReview: { status: "pass", reviewer: "旧评审", reviewedAt: "2026-10-01T00:00:00.000Z" },
  });
  writeJson(path.join(runDir, "qa-report.json"), {
    format: QA_REPORT_FORMAT,
    checked: [...QA_JUDGEMENTS],
    failures: [],
    observations: [
      { source: "inspect", outcome: "ok", lines: [] },
      { source: "review", outcome: "unavailable", reason: "测试" },
    ],
    subject: { packId: "last-train", packVersion: 1, manifestChecksum: packChecksum },
    delivery,
  });
  return { base, runDir, packChecksum, configChecksum };
}

const record = (fx: Fx, over: Record<string, unknown> = {}) => ({
  format: VISUAL_REVIEW_RECORD_FORMAT,
  reviewedAt: "2026-10-30T00:00:00.000Z",
  reviewer: "人（本次会话用户）",
  overall: "pass",
  subject: {
    packId: "last-train", packVersion: 1, siteVersion: 1, shellVersion: "2",
    manifestChecksum: fx.packChecksum, configChecksum: fx.configChecksum,
  },
  note: "六项人工对照通过",
  ...over,
});

function writeRecord(fx: Fx, over: Record<string, unknown> = {}): string {
  const p = path.join(fx.base, "review-record.json");
  writeJson(p, record(fx, over));
  return p;
}

const deliveryOf = (fx: Fx): Record<string, unknown> => {
  const raw = JSON.parse(readFileSync(path.join(fx.runDir, "qa-report.json"), "utf8")) as Record<string, unknown>;
  return raw.delivery as Record<string, unknown>;
};

describe("review-verdict（票 10 / 票 04）", () => {
  it("pass 写入：记录是权威来源，只动视觉评审三处；exit 0", async () => {
    const base = tmp();
    const fx = makeRun(base);
    const rec = writeRecord(fx);
    const before = JSON.parse(readFileSync(path.join(fx.runDir, "qa-report.json"), "utf8")) as Record<string, unknown>;
    const { code } = await runC(["review-verdict", fx.runDir, "--verdict", "pass", "--review-record", rec, "--out", base]);
    expect(code).toBe(EXIT.ok);
    const d = deliveryOf(fx);
    expect(d.visualReview).toMatchObject({ status: "pass", reviewer: "人（本次会话用户）", reviewedAt: "2026-10-30T00:00:00.000Z", note: "六项人工对照通过" });
    expect((d.checks as Array<Record<string, unknown>>).find((c) => c.key === "visual-review")!.status).toBe("pass");
    const after = JSON.parse(readFileSync(path.join(fx.runDir, "qa-report.json"), "utf8")) as Record<string, unknown>;
    expect(after.checked).toEqual(before.checked);
    expect(after.observations).toEqual(before.observations);
  });

  it("fail 写入：overall=fail → visualReview.status=fail；QA 层保留", async () => {
    const base = tmp();
    const fx = makeRun(base);
    const rec = writeRecord(fx, { overall: "fail", note: "风格对不上" });
    const { code } = await runC(["review-verdict", fx.runDir, "--verdict", "fail", "--review-record", rec, "--out", base]);
    expect(code).toBe(EXIT.ok);
    expect(deliveryOf(fx).visualReview).toMatchObject({ status: "fail", note: "风格对不上" });
    const raw = JSON.parse(readFileSync(path.join(fx.runDir, "qa-report.json"), "utf8")) as Record<string, unknown>;
    expect(raw.format).toBe(QA_REPORT_FORMAT);
  });

  it("缺 --review-record → exit 2，不写诊断文件", async () => {
    const base = tmp();
    const fx = makeRun(base);
    const { code } = await runC(["review-verdict", fx.runDir, "--verdict", "pass", "--out", base]);
    expect(code).toBe(EXIT.usage);
    expect(existsSync(path.join(fx.runDir, "review-verdict-error.json"))).toBe(false);
  });

  it("--reviewer / --note 已移除 → exit 2", async () => {
    const base = tmp();
    const fx = makeRun(base);
    const rec = writeRecord(fx);
    const { code } = await runC(["review-verdict", fx.runDir, "--verdict", "pass", "--review-record", rec, "--reviewer", "人", "--out", base]);
    expect(code).toBe(EXIT.usage);
  });

  it("记录不存在 → exit 4，写 review-verdict-error.json，qa-report 不变", async () => {
    const base = tmp();
    const fx = makeRun(base);
    const qaPath = path.join(fx.runDir, "qa-report.json");
    const before = readFileSync(qaPath, "utf8");
    const { code } = await runC(["review-verdict", fx.runDir, "--verdict", "pass", "--review-record", path.join(base, "nope.json"), "--out", base]);
    expect(code).toBe(EXIT.invalid);
    expect(readFileSync(qaPath, "utf8")).toBe(before);
    expect(JSON.parse(readFileSync(path.join(fx.runDir, "review-verdict-error.json"), "utf8")).message).toMatch(/不可用/);
  });

  it("记录 schema 不过 → exit 4 + 诊断文件", async () => {
    const base = tmp();
    const fx = makeRun(base);
    const rec = writeRecord(fx, { overall: "pending" });
    const { code } = await runC(["review-verdict", fx.runDir, "--verdict", "pass", "--review-record", rec, "--out", base]);
    expect(code).toBe(EXIT.invalid);
    expect(existsSync(path.join(fx.runDir, "review-verdict-error.json"))).toBe(true);
  });

  it("subject 与当前交付不符 → exit 4 + 诊断文件", async () => {
    const base = tmp();
    const fx = makeRun(base);
    const rec = writeRecord(fx);
    const raw = JSON.parse(readFileSync(rec, "utf8"));
    raw.subject.configChecksum = "sha256:" + "f".repeat(64);
    writeJson(rec, raw);
    const { code } = await runC(["review-verdict", fx.runDir, "--verdict", "pass", "--review-record", rec, "--out", base]);
    expect(code).toBe(EXIT.invalid);
    expect(JSON.parse(readFileSync(path.join(fx.runDir, "review-verdict-error.json"), "utf8")).message).toMatch(/subject/);
  });

  it("overall 与 --verdict 不一致 → exit 4 + 诊断文件", async () => {
    const base = tmp();
    const fx = makeRun(base);
    const rec = writeRecord(fx, { overall: "pass" });
    const { code } = await runC(["review-verdict", fx.runDir, "--verdict", "fail", "--review-record", rec, "--out", base]);
    expect(code).toBe(EXIT.invalid);
    expect(JSON.parse(readFileSync(path.join(fx.runDir, "review-verdict-error.json"), "utf8")).message).toMatch(/overall/);
  });

  it("没有 delivery → exit 4 + 诊断文件", async () => {
    const base = tmp();
    const fx = makeRun(base);
    const qaPath = path.join(fx.runDir, "qa-report.json");
    const qa = JSON.parse(readFileSync(qaPath, "utf8"));
    delete qa.delivery;
    writeJson(qaPath, qa);
    const rec = writeRecord(fx);
    const { code } = await runC(["review-verdict", fx.runDir, "--verdict", "pass", "--review-record", rec, "--out", base]);
    expect(code).toBe(EXIT.invalid);
    expect(JSON.parse(readFileSync(path.join(fx.runDir, "review-verdict-error.json"), "utf8")).message).toMatch(/delivery/);
  });

  it("跨 run 不继承：写 v1 不动 v2 的报告", async () => {
    const base = tmp();
    const fx1 = makeRun(base, 1);
    const fx2 = makeRun(base, 2);
    const rec = writeRecord(fx1);
    await runC(["review-verdict", fx1.runDir, "--verdict", "pass", "--review-record", rec, "--out", base]);
    expect(deliveryOf(fx2).visualReview).toMatchObject({ reviewer: "旧评审" });
  });
});
