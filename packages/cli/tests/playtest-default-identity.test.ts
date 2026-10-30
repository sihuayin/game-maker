// 票 06 / 票 12：默认五态场景只服务冻结 wasteland Demo；非默认 Demo 未传 --scenario-dir ⇒ exit 4。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  EXIT, QA_JUDGEMENTS, QA_REPORT_FORMAT, buildDeliveryReport,
} from "@game-maker/contracts";
import { run, type CliIo } from "../src/cli.js";
import { DEFAULT_SCENARIO_DEMO, defaultScenarioIdentityProblem } from "../src/playtest.js";

const dirs: string[] = [];
const tmp = (): string => { const d = mkdtempSync(path.join(tmpdir(), "gm-default-scenario-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};
const runC = (argv: string[]) => { const io = capture(); return run(argv, io).then((code) => ({ code, io })); };
const writeJson = (p: string, v: unknown) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;

function setup(packId = "other-pack", pickups = 3, chests = 1): { base: string; runDir: string } {
  const base = tmp();
  const game = path.join(base, "g");
  const runDir = path.join(game, "run", "v1");
  const config = {
    format: "game-config/v1",
    entities: [
      ...Array.from({ length: pickups }, () => ({ kind: "pickup" })),
      ...Array.from({ length: chests }, () => ({ kind: "chest" })),
    ],
    terrain: [],
    objective: { kind: "collect-then-reach", gate: "g" },
  };
  writeJson(path.join(game, "pack", "v1", "manifest.json"), { id: packId, version: 1, assets: [], files: [] });
  writeJson(path.join(game, "site", "v1", "site.json"), { shell: "2", pack: "v1", config: "game-config.json" });
  writeJson(path.join(game, "site", "v1", "game-config.json"), config);
  writeJson(path.join(runDir, "game-config.json"), config);
  const delivery = buildDeliveryReport({
    runId: "g/run/v1",
    pack: { packId, packVersion: 1 },
    config: { file: "g/run/v1/game-config.json" },
    site: { version: 1, shell: "2" },
    checks: [
      { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
      { key: "site", status: "pass" }, { key: "playable-smoke", status: "pass" },
      { key: "visual-review", status: "pass" },
    ],
    visualReview: { status: "pass" },
  });
  writeJson(path.join(runDir, "qa-report.json"), {
    format: QA_REPORT_FORMAT,
    subject: { packId, packVersion: 1 },
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

describe("defaultScenarioIdentityProblem（票 06 / 票 12）", () => {
  it("默认 wasteland Demo ⇒ undefined；其他 pack ⇒ 带实际身份与 --scenario-dir 提示", () => {
    const base = tmp();
    const cfg = path.join(base, "cfg.json");
    writeJson(cfg, { entities: [{ kind: "pickup" }, { kind: "pickup" }, { kind: "chest" }] });
    const ok = buildDeliveryReport({
      runId: "x", pack: { packId: DEFAULT_SCENARIO_DEMO.packId, packVersion: DEFAULT_SCENARIO_DEMO.packVersion },
      config: { file: "x" }, site: { version: 1, shell: "2" },
      checks: [
        { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
        { key: "site", status: "pass" }, { key: "playable-smoke", status: "pass" }, { key: "visual-review", status: "pass" },
      ],
      visualReview: { status: "pending" },
    });
    expect(defaultScenarioIdentityProblem(ok, 1, cfg)).toBeUndefined();

    const bad = buildDeliveryReport({
      runId: "x", pack: { packId: "other-pack", packVersion: 1 },
      config: { file: "x" }, site: { version: 1, shell: "2" },
      checks: [
        { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
        { key: "site", status: "pass" }, { key: "playable-smoke", status: "pass" }, { key: "visual-review", status: "pass" },
      ],
      visualReview: { status: "pending" },
    });
    const msg = defaultScenarioIdentityProblem(bad, 1, cfg, "g/run/v1/game-config.json")!;
    expect(msg).toContain(DEFAULT_SCENARIO_DEMO.packId);
    expect(msg).toContain("other-pack");
    expect(msg).toContain("pickup=2");
    expect(msg).toContain("chest=1");
    expect(msg).toContain("--scenario-dir");
  });
});

describe("playtest 默认场景身份门禁（CLI）", () => {
  it("非默认 Demo + 未传 --scenario-dir ⇒ exit 4，诊断列出身份；旧 pass 已先撤销", async () => {
    const { base, runDir } = setup("other-pack", 3, 1);
    const { code, io } = await runC(["playtest", runDir, "--out", base]);
    expect(code).toBe(EXIT.invalid);
    const all = [...io.lines, ...io.errors].join("\n");
    expect(all).toContain("默认五态场景只服务");
    expect(all).toContain("other-pack");
    expect(all).toContain("pickup=3");
    expect(all).toContain("chest=1");
    expect(all).toContain("--scenario-dir");
    const qa = readJson(path.join(runDir, "qa-report.json"));
    const d = qa.delivery as Record<string, unknown>;
    expect((d.checks as Array<Record<string, unknown>>).find((c) => c.key === "playable-smoke")).toMatchObject({ status: "blocked" });
  });

  it("显式 --scenario-dir 绕过身份门禁（随后因空目录失败，而不是身份错误）", async () => {
    const { base, runDir } = setup("other-pack", 3, 1);
    const empty = path.join(base, "empty-scenarios");
    mkdirSync(empty, { recursive: true });
    const { code, io } = await runC(["playtest", runDir, "--out", base, "--scenario-dir", empty]);
    expect(code).toBe(EXIT.invalid);
    const all = [...io.lines, ...io.errors].join("\n");
    expect(all).not.toContain("默认五态场景只服务");
    expect(all).toContain("没有可执行的必需场景");
  });
});
