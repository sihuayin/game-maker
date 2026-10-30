// `verify-mechanics` 的归属校验（P0-02 v2 票 08）。
// ⚠️ 不跑 Chrome：所有用例都在 probe 之前失败（用法/身份/缺产物）。
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { EXIT, QA_JUDGEMENTS, QA_REPORT_FORMAT, buildDeliveryReport } from "@game-maker/contracts";
import { run, type CliIo } from "../src/cli.js";

const dirs: string[] = [];
const tmp = (): string => { const d = mkdtempSync(path.join(tmpdir(), "gm-verify-mech-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};
const runC = (argv: string[]) => { const io = capture(); return run(argv, io).then((code) => ({ code, io })); };
const writeJson = (p: string, v: unknown) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };

const deliveryOf = (over: { site?: boolean; packId?: string } = {}) => buildDeliveryReport({
  runId: "last-train/run/v1",
  pack: { packId: over.packId ?? "last-train", packVersion: 2 },
  config: { file: "last-train/run/v1/game-config.json" },
  ...(over.site === false ? {} : { site: { version: 1, shell: "2" } }),
  checks: [
    { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
    { key: "site", status: over.site === false ? "incomplete" : "pass" },
    { key: "playable-smoke", status: over.site === false ? "incomplete" : "pass" },
    { key: "visual-review", status: "pass" },
  ],
  visualReview: { status: "pass" },
});

const qaReport = (over: { delivery?: boolean; site?: boolean; packId?: string } = {}) => ({
  format: QA_REPORT_FORMAT,
  checked: [...QA_JUDGEMENTS],
  failures: [],
  observations: [
    { source: "inspect", outcome: "ok", lines: [] },
    { source: "review", outcome: "unavailable", reason: "测试" },
  ],
  subject: { packId: "last-train", packVersion: 2 },
  ...(over.delivery === false ? {} : { delivery: deliveryOf({ ...(over.site === undefined ? {} : { site: over.site }), ...(over.packId === undefined ? {} : { packId: over.packId }) }) }),
});

function makeRun(base: string, over: { delivery?: boolean; site?: boolean; packId?: string } = {}): string {
  const runDir = path.join(base, "last-train", "run", "v1");
  writeJson(path.join(runDir, "qa-report.json"), qaReport(over));
  writeJson(path.join(runDir, "game-config.json"), { format: "game-config/v1", entities: [], terrain: [], objective: { kind: "collect-then-reach", gate: "g" } });
  return runDir;
}

describe("verify-mechanics：用法与归属校验（probe 之前）", () => {
  it("缺 run 目录 → exit 2（usage）", async () => {
    const base = tmp();
    const { code } = await runC(["verify-mechanics", "--out", base]);
    expect(code).toBe(EXIT.usage);
  });

  it("不是 v<N> 形状 → exit 2", async () => {
    const base = tmp();
    const { code } = await runC(["verify-mechanics", path.join(base, "not-a-run"), "--out", base]);
    expect(code).toBe(EXIT.usage);
  });

  it("缺 qa-report → exit 4（invalid）", async () => {
    const base = tmp();
    const runDir = path.join(base, "last-train", "run", "v1");
    mkdirSync(runDir, { recursive: true });
    const { code } = await runC(["verify-mechanics", runDir, "--out", base]);
    expect(code).toBe(EXIT.invalid);
  });

  it("qa-report 没有 delivery → exit 4", async () => {
    const base = tmp();
    const runDir = makeRun(base, { delivery: false });
    const { code } = await runC(["verify-mechanics", runDir, "--out", base]);
    expect(code).toBe(EXIT.invalid);
  });

  it("delivery 没有 site → exit 4", async () => {
    const base = tmp();
    const runDir = makeRun(base, { site: false });
    const { code } = await runC(["verify-mechanics", runDir, "--out", base]);
    expect(code).toBe(EXIT.invalid);
  });

  it("包 manifest 身份与 delivery 不一致 → exit 4，且不写报告", async () => {
    const base = tmp();
    const runDir = makeRun(base);
    // site 与 pack 存在，但 manifest 的 id 对不上 ⇒ 身份校验先拒
    writeJson(path.join(base, "last-train", "site", "v1", "site.json"), { shell: "2", pack: "v2", config: "game-config.json" });
    writeFileSync(path.join(base, "last-train", "site", "v1", "game-config.json"), "{}\n");
    writeJson(path.join(base, "last-train", "pack", "v2", "manifest.json"), { id: "other-pack", version: 2 });
    const { code } = await runC(["verify-mechanics", runDir, "--out", base]);
    expect(code).toBe(EXIT.invalid);
    expect(existsSync(path.join(runDir, "mechanic-coverage.json"))).toBe(false);
  });
});
