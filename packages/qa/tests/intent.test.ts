// 票 19 的判据：**意图覆盖**（`intent-coverage`，`03 §23`）。
//
// ⚠️ 夹具是**一对真的 intent + design**（`fixtures/upstream/canned.json`），拷出来再改 ——
//   与票 17/18 同一个做法：证明判据**真的会响**，而不只是「没报错」。
//
// ⚠️ 本族在**新链上恒绿**（`compile-design` 先拒，链根本走不到 QA）—— 那是**知道**的，
//   自白写在 `src/intent.ts` 的文件头三。而下面那些**故意损坏**的用例，
//   正是「它真会响」的证据。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { GameDesignSpecSchema, type QaContext, type QaFamilyResult } from "@game-maker/contracts";
import { intentQaRunner } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const CANNED = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/upstream/canned.json"), "utf8")) as {
  intent: Record<string, unknown>;
  design: Record<string, unknown>;
};

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

/**
 * 一次「运行目录」的现场。
 *
 * ⚠️ 本族**只读** `intentPath` 与 `designPath` —— 另外三份路径给了，但**那份文件不存在**：
 *   那正说明**没人读它**（票 19 的 Q4/Q11 把四份路径都摆出来，读错哪份当场炸，不是静默）。
 */
function stage(): QaContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gm-qa-intent-"));
  dirs.push(dir);
  const runDir = path.join(dir, "run");
  const nowhere = path.join(dir, "本族不读这些");
  fs.mkdirSync(runDir, { recursive: true });
  write(runDir, "game-intent.json", CANNED.intent);
  write(runDir, "game-design.json", CANNED.design);
  return {
    runDir, gameId: "wasteland",
    packDir: nowhere,
    configPath: path.join(nowhere, "game-config.json"),
    recipePath: path.join(nowhere, "asset-recipe.json"),
    intentPath: path.join(runDir, "game-intent.json"),
    designPath: path.join(runDir, "game-design.json")
  };
}
function write(runDir: string, name: string, body: unknown): void {
  fs.writeFileSync(path.join(runDir, name), JSON.stringify(body, null, 2) + "\n");
}
/** 改运行目录里那份设计（**交付态**那一份，不是夹具）。 */
function patchDesign(ctx: QaContext, f: (d: any) => void): void {
  const d = JSON.parse(fs.readFileSync(ctx.designPath, "utf8"));
  f(d);
  write(ctx.runDir, "game-design.json", d);
}
const run = (ctx: QaContext): Promise<QaFamilyResult> => intentQaRunner(ctx);
/** ⚠️ **测试自己的**摊平小工具 —— 投影与装配归票 20（与票 17/18 同一个）。 */
const flat = (r: QaFamilyResult) => Object.entries(r.judgements)
  .flatMap(([j, res]) => (res.ran ? res.findings.map((f) => ({ ...f, judgement: j })) : []));
const keys = (r: QaFamilyResult) => Object.keys(r.judgements).sort();

describe("§干净的真的那一对：判据跑了、没话说", () => {
  it("只声明自己那一条，零 findings，观察那一栏空着", async () => {
    const r = await run(stage());
    expect(keys(r)).toEqual(["intent-coverage"]);        // ⚠️ 其余五格**缺席 = 不归我**，不是 `ran:false`
    expect(flat(r)).toEqual([]);
    expect(r.observations).toEqual([]);                  // ⚠️ 不许拿 `unavailable` 表示「不归我」
  });

  it("⚠️ 而它不是「没跑」—— 同一份设计挖掉一个实体，它当场开口（下一条）", async () => {
    const r = await run(stage());
    expect(r.judgements["intent-coverage"]).toEqual({ ran: true, findings: [] });
  });

  it("⚠️ **文本那一半不在这里**：这份绿的设计把 `coreLoop` 整个改写了", async () => {
    // 票 19 的钉子（`contracts/tests/intent-coverage.test.ts` 里有完整那条）：
    // 交付态这条路（真读两份文件）上再钉一次 —— 有人把文本相等加回来时，这里先红。
    expect(CANNED.intent["coreLoop"]).toEqual(["在废土上跳跃移动", "收集废料"]);
    expect(CANNED.design["coreLoop"]).toEqual(["在废墟间探索并收集零件"]);
    expect(flat(await run(stage()))).toEqual([]);
  });
});

describe("§故意损坏：它真会响（`target` 恒 `game-design`）", () => {
  it("设计层把这个实体做丢了 ⇒ 一条 error，点名 id 与**用户自己的话**", async () => {
    const ctx = stage();
    patchDesign(ctx, (d) => { d.enemies = []; d.levels[0].entities = []; });
    const findings = flat(await run(ctx));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ judgement: "intent-coverage", target: "game-design", severity: "error" });
    expect(findings[0]!.detail).toContain("e-drone");
    expect(findings[0]!.detail).toContain("巡逻的无人机");
  });

  it("⚠️ 串桶 ⇒ 也响，而 `detail` 说得清「它其实在 `npcs` 里」（不然人会去空桶里找）", async () => {
    const ctx = stage();
    patchDesign(ctx, (d) => { d.enemies = []; d.npcs = [{ id: "e-drone", role: "会说话的无人机", interaction: "对话" }]; });
    const findings = flat(await run(ctx));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.detail).toContain("串桶");
    expect(findings[0]!.detail).toContain("npcs");
    expect(findings[0]!.detail).toContain("不是没做");
  });

  it("设计层把机制做丢了 ⇒ 一条，点名机制的原话（那是**自由文本**，才报得出「跳跃」）", async () => {
    const ctx = stage();
    patchDesign(ctx, (d) => { d.mechanics = [{ id: "m-run", mechanic: "run" }]; });
    const findings = flat(await run(ctx));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.detail).toContain("m-jump");
    expect(findings[0]!.detail).toContain("跳跃");
  });

  it("⚠️ 缺两样也是**一条** finding（同一 `(judgement, target)` 不许重复，细节并进 `detail`）", async () => {
    const ctx = stage();
    patchDesign(ctx, (d) => {
      d.enemies = []; d.levels[0].entities = []; d.mechanics = [{ id: "m-run", mechanic: "run" }];
    });
    const findings = flat(await run(ctx));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.detail.split("\n")).toHaveLength(2);   // 两行，一行一项
  });
});

describe("§「该跑却跑不了」是**抛**，不是一条判据的失败（票 18 的 R3-Q1）", () => {
  it("设计那一份不是 JSON ⇒ 抛，且说得出是哪一份、哪个文件", async () => {
    const ctx = stage();
    fs.writeFileSync(ctx.designPath, "{ 不是 JSON }");
    await expect(run(ctx)).rejects.toThrow(/设计读不出来/);
  });

  it("⚠️ 手改坏的设计（去掉判别式）⇒ 抛，且带**契约自己的话**", async () => {
    const ctx = stage();
    patchDesign(ctx, (d) => { delete d.format; });
    await expect(run(ctx)).rejects.toThrow(/不过契约/);
  });

  it("意图那一份不存在 ⇒ 抛（不是「意图为空 ⇒ 全绿」那种静默）", async () => {
    const ctx = stage();
    fs.rmSync(ctx.intentPath);
    await expect(run(ctx)).rejects.toThrow(/意图读不出来/);
  });

  it("⚠️ **别把判据喂给一份不过契约的设计** —— 那是调用方的输入问题", async () => {
    // 反证上面两条不是「恰好抛了」：一份**过契约**的设计走同一条路，一声不响。
    const ctx = stage();
    expect(GameDesignSpecSchema.safeParse(JSON.parse(fs.readFileSync(ctx.designPath, "utf8"))).success).toBe(true);
    expect(flat(await run(ctx))).toEqual([]);
  });
});
