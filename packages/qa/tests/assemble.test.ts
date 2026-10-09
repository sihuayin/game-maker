// 票 20 的落点：**合成器**（`src/assemble.ts`）—— 三个族的汇合处。
//
// ⚠️ 这一份里有**两条跟着出口搬过来的断言**（票 17 原来在 `visual.test.ts` 上断的，
//   出口改成「族结果」之后它们**没有家**了：族结果里既没有 `format` 也没有裁决）：
//     · 「`format` 是契约那份」—— 整份报告才算得出来；
//     · 「裁决是 `incomplete`」—— `qaVerdict` 吃的是**整份报告**。
//   它们归本票**重写**（票 18 的交接单第 ③ 条）。
//
// ⚠️ 夹具是三份**真产物**拼起来的（与票 17/18/19 同一批 fixture），而不是手搓的小对象：
//   合成器的输入就是**已经落盘的**那五样，手搓一份反而测不到「文件进出」这条纪律。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { QA_JUDGEMENTS, QAReportSchema, qaVerdict, type Observation, type QAReport, type QaContext } from "@game-maker/contracts";
import { qaRunner } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const RECIPE = path.join(ROOT, "fixtures/recipes/last-train.json");
const CONFIG = path.join(ROOT, "fixtures/game-configs/last-train.json");
const CANNED = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/upstream/canned.json"), "utf8")) as {
  intent: Record<string, unknown>;
  design: Record<string, unknown>;
};

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

/**
 * 一次「运行目录 + 包目录」的现场 —— ⚠️ **五份产物全在**（与三个族各自那几份单薄的夹具不同：
 * 合成器要三族**同时**跑得起来，少一份就有一个族抛）。
 * ⚠️ fixture 是**拷**出来的：损坏那几条不能动真 fixture。
 */
function stage(): QaContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gm-qa-assemble-"));
  dirs.push(dir);
  const runDir = path.join(dir, "run");
  const packDir = path.join(dir, "pack");
  fs.mkdirSync(runDir, { recursive: true });
  fs.cpSync(PACK, packDir, { recursive: true });
  fs.copyFileSync(RECIPE, path.join(runDir, "asset-recipe.json"));
  fs.copyFileSync(CONFIG, path.join(runDir, "game-config.json"));
  write(runDir, "game-intent.json", CANNED.intent);
  write(runDir, "game-design.json", CANNED.design);
  return {
    runDir, packDir, gameId: "last-train",
    recipePath: path.join(runDir, "asset-recipe.json"),
    configPath: path.join(runDir, "game-config.json"),
    intentPath: path.join(runDir, "game-intent.json"),
    designPath: path.join(runDir, "game-design.json"),
  };
}
function write(runDir: string, name: string, body: unknown): void {
  fs.writeFileSync(path.join(runDir, name), JSON.stringify(body, null, 2) + "\n");
}
const run = (ctx: QaContext): Promise<QAReport> => qaRunner(ctx);
const bySource = (r: QAReport, s: string) => r.observations.find((o) => o.source === s);

/** 五条 —— 六条判据里**第六条不归任何族**（层覆盖由装配期的硬失败保证）。 */
const FIVE = ["constructive-constraint", "palette-binding", "reference-resolution", "reachability", "intent-coverage"];

describe("§干净的真现场：三族都跑、合成一份**过得了契约**的报告", () => {
  it("⚠️ `format` 是契约那份、整份报告过 schema（票 17 搬过来那两条断言的第一条）", async () => {
    const r = await run(stage());
    expect(r.format).toBe("qa-report/v1");
    expect(QAReportSchema.safeParse(r).success).toBe(true);   // ⚠️ 族结果落盘**过不了**（票 18 实测）—— 合成器补的就是这一条
  });

  it("⚠️ `checked` 恰好是那**五条**，`layer-coverage` **不在**里面 —— 而裁决因此是 `incomplete`", async () => {
    const r = await run(stage());
    expect([...r.checked].sort()).toEqual([...FIVE].sort());
    expect(r.checked).not.toContain("layer-coverage");
    // ⚠️ **那不是缺口，是实话**：有判据没由 QA 跑。⇒ 不许为了让它变成 `pass` 去动 `checked`。
    expect(qaVerdict(r)).toBe("incomplete");
    // ⚠️ 判据的全集与「这一次真跑过的子集」是两件事（契约 §四①）
    expect(QA_JUDGEMENTS).toHaveLength(6);
    expect(r.checked).toHaveLength(5);
  });

  it("⚠️ 补进去的那条 `ran:false` **不落盘**（落盘的形式就是「不在 `checked` 里」）", async () => {
    const r = await run(stage());
    // 合成器给 `layer-coverage` 写了一句理由，而它**一个字都不该出现在产物里**
    expect(JSON.stringify(r)).not.toContain("没有族声明它");
    expect(r.failures).toEqual([]);
  });

  it("两条观察：`inspect` / `review` 各一条，**都是 `unavailable`**（合成器今天只装配、不采集）", async () => {
    const r = await run(stage());
    expect(r.observations).toHaveLength(2);
    expect(r.observations.map((o) => o.source).sort()).toEqual(["inspect", "review"]);
    for (const o of r.observations) {
      expect(o.outcome).toBe("unavailable");
      // ⚠️ 理由**必须说得出**（契约靠联合保证这件事）—— 而且要说清「没拿到 ≠ 比过了、没差异」
      if (o.outcome === "unavailable") expect(o.reason).toMatch(/没有可原样搬来的观察/);
    }
  });
});

describe("§R3 那条底线：**观察不许影响 status**", () => {
  /** 把观察那一栏整个换掉 —— 裁决必须一个字不变。 */
  const withObservations = (r: QAReport, observations: Observation[]): QAReport => ({ ...r, observations });

  it("⚠️ 观察换成任意内容（包括「拿到了、有话说」），裁决**一个字不变**", async () => {
    const clean = await run(stage());
    expect(qaVerdict(clean)).toBe("incomplete");
    const chatty: Observation[] = [
      { source: "inspect", outcome: "ok", lines: ["色板 16 色 · 交付态用了 9 色", "背景层画满 100%"] },
      { source: "review", outcome: "ok", lines: ["不像：这一版的金属偏暖", "两处轮廓丢了"] },
    ];
    expect(qaVerdict(withObservations(clean, chatty))).toBe(qaVerdict(clean));
    // ⚠️ 而且这些是**真话**（过得了契约）—— 不是靠写了一句注释把观察挡在门外
    expect(QAReportSchema.safeParse(withObservations(clean, chatty)).success).toBe(true);
  });

  it("⚠️ 反向那一边：判据**真响了**（`fail`）时，观察那一栏**一模一样**", async () => {
    const ctx = stage();
    // 把一个拾取物的 asset 指到不存在的 id ⇒ 引用族响，而配置本身仍然过得了 schema
    const c = JSON.parse(fs.readFileSync(ctx.configPath, "utf8")) as { entities: { id: string; asset: string }[] };
    c.entities.find((e) => e.id === "suitcase-1")!.asset = "根本没有这个资源";
    write(ctx.runDir, "game-config.json", c);

    const bad = await run(ctx);
    expect(qaVerdict(bad)).toBe("fail");
    expect(bad.failures.map((f) => f.judgement)).toContain("reference-resolution");
    // ⚠️ `checked` 仍然是**五条**：跑了、响了，与跑了几条是两件事
    expect([...bad.checked].sort()).toEqual([...FIVE].sort());
    // ⚠️ 观察那一栏与干净那次**逐字节相同** —— 它不看 `failures`
    const clean = await run(stage());
    expect(bad.observations).toEqual(clean.observations);
  });
});

describe("§「该跑却跑不了」是**抛**，不是一份半截报告（票 18 的 R3-Q1）", () => {
  it("一个族读不到它那份产物 ⇒ 合成器把它冒出去，**不生成**报告", async () => {
    const ctx = stage();
    fs.rmSync(ctx.intentPath);
    await expect(run(ctx)).rejects.toThrow(/意图读不出来/);
  });

  it("⚠️ 那份产物**读得回来、但不过契约** ⇒ 同样抛（而且带契约自己的话）", async () => {
    const ctx = stage();
    write(ctx.runDir, "game-design.json", { format: "game-design/v1" });   // 缺一大半字段
    await expect(run(ctx)).rejects.toThrow(/不过契约/);
  });
});
