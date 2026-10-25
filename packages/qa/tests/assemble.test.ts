// 票 20 的落点：**合成器**（`src/assemble.ts`）—— 三个族的汇合处。
//
// ⚠️ 这一份里有**两条跟着出口搬过来的断言**（票 17 原来在 `visual.test.ts` 上断的，
//   出口改成「族结果」之后它们**没有家**了：族结果里既没有 `format` 也没有裁决）：
//     · 「`format` 是契约那份」—— 整份报告才算得出来；
//     · 「裁决是 `pass`」—— `qaVerdict` 吃的是**整份报告**（P0-02a 起六条都真跑）。
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
  // ⚠️ 票 02 起交叉验证**真的对账**（D∖S/S∖D）：给 config 里 `carriage`(hazard) 补上设计实体
  //   `e-drone` 的 `sourceIntent`（enemies→hazard 兼容），再让 VDS 覆盖它 ⇒ 一条合法 S=D。
  const configPath = path.join(runDir, "game-config.json");
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8")) as { entities: { id: string; sourceIntent?: string }[] };
  cfg.entities.find((e) => e.id === "carriage")!.sourceIntent = "e-drone";
  write(runDir, "game-config.json", cfg);
  write(runDir, "game-intent.json", CANNED.intent);
  write(runDir, "game-design.json", CANNED.design);
  // 合成 VDS：background（无 sourceIntent，装饰不参与）+ e-drone（sourceIntent，bounds 与
  //   carriage 的 box 同尺寸 64×48，几何观察不响）。
  write(runDir, "visual-design.json", {
    format: "visual-design/v1", viewport: { w: 480, h: 270 },
    style: { visualWorldFormat: "visual-world/v1" },
    objects: [
      { id: "background", role: "background", bounds: { x: 0, y: 0, w: 480, h: 270 }, layer: 0, fill: "palette:0" },
      { id: "e-drone", role: "hazard", bounds: { x: 768, y: 202, w: 64, h: 48 }, layer: 10, fill: "palette:1", sourceIntent: "e-drone" },
    ],
  });
  return {
    runDir, packDir, gameId: "last-train",
    // ⚠️ 第六条判据（层覆盖）要它（P0-02a）：合成器把视口原样交给 `auditLayerCoverage`。
    viewport: { w: 480, h: 270 },
    recipePath: path.join(runDir, "asset-recipe.json"),
    configPath: path.join(runDir, "game-config.json"),
    intentPath: path.join(runDir, "game-intent.json"),
    designPath: path.join(runDir, "game-design.json"),
    vdsPath: path.join(runDir, "visual-design.json"),
  };
}
function write(runDir: string, name: string, body: unknown): void {
  fs.writeFileSync(path.join(runDir, name), JSON.stringify(body, null, 2) + "\n");
}
const run = (ctx: QaContext): Promise<QAReport> => qaRunner(ctx);
const bySource = (r: QAReport, s: string) => r.observations.find((o) => o.source === s);

/** 七条 —— 视觉族三条 + 玩法族两条 + 意图族一条 + 合成器自己跑的层覆盖一条（P0-02a）。 */
const SEVEN = ["constructive-constraint", "palette-binding", "visual-config-coherence", "layer-coverage", "reference-resolution", "reachability", "intent-coverage"];

describe("§干净的真现场：三族都跑、合成一份**过得了契约**的报告", () => {
  it("⚠️ `format` 是契约那份、整份报告过 schema（票 17 搬过来那两条断言的第一条）", async () => {
    const r = await run(stage());
    expect(r.format).toBe("qa-report/v1");
    expect(QAReportSchema.safeParse(r).success).toBe(true);   // ⚠️ 族结果落盘**过不了**（票 18 实测）—— 合成器补的就是这一条
  });

  it("⚠️ `checked` 是**七条**、含 `layer-coverage` —— 干净包裁决 `pass`", async () => {
    const r = await run(stage());
    expect([...r.checked].sort()).toEqual([...SEVEN].sort());
    expect(r.checked).toContain("layer-coverage");
    // ⚠️ 以前这里是 `incomplete`（第六条没由 QA 跑、`checked` 恒 5/6）；P0-02a 起第六条**真跑**。
    expect(qaVerdict(r)).toBe("pass");
    expect(QA_JUDGEMENTS).toHaveLength(7);
    expect(r.checked).toHaveLength(7);
    expect(r.failures).toEqual([]);
  });

  it("⚠️ 阴性：包里有一层盖不住世界 ⇒ `layer-coverage` **error**（防「假 6/6」）", async () => {
    const ctx = stage();
    // 把最远那层（不平铺、宽 480）的视差改成 0.5 ⇒ 镜头走到 1440−480=960 的尽头时退掉 480
    const mp = path.join(ctx.packDir, "manifest.json");
    const m = JSON.parse(fs.readFileSync(mp, "utf8")) as {
      assets: { id: string; layers?: { name: string; parallax: number }[] }[];
    };
    m.assets.find((a) => a.id === "bg-dusk-halt")!.layers!.find((l) => l.name === "sky")!.parallax = 0.5;
    fs.writeFileSync(mp, JSON.stringify(m, null, 2) + "\n");

    const r = await run(ctx);
    // ⚠️ 跑了、响了 —— 而不是「补一条 `ran:false`、checked 少一格」
    expect(r.checked).toContain("layer-coverage");
    expect(r.failures).toContainEqual(expect.objectContaining({
      judgement: "layer-coverage", target: "bg-dusk-halt.sky", severity: "error",
    }));
    expect(qaVerdict(r)).toBe("fail");
    expect(QAReportSchema.safeParse(r).success).toBe(true);
  });

  it("⚠️ 见证：合成器**真的**调了第六条 runner（删掉那一行 ⇒ 这条红）", () => {
    // ⚠️ 这是「防假 6/6」的结构见证：把 `layerCoverageJudgement(ctx)` 那一行删掉，
    //   正例可以靠 `ran:true, findings:[]` 假绿，而这条会当场红（源码级的钉子）。
    const src = fs.readFileSync(new URL("../src/assemble.ts", import.meta.url), "utf8");
    expect(src).toMatch(/layerCoverageJudgement\(ctx\)/);
    expect(src).toMatch(/"layer-coverage":\s*layers/);
  });

  it("两条观察：`inspect` / `review` 各一条；standalone 没给 inspect ⇒ 都是 `unavailable`", async () => {
    const r = await run(stage());
    expect(r.observations).toHaveLength(2);
    expect(r.observations.map((o) => o.source).sort()).toEqual(["inspect", "review"]);
    for (const o of r.observations) {
      expect(o.outcome).toBe("unavailable");
      // ⚠️ 理由**必须说得出**（契约靠联合保证这件事）—— 而且要说清「没拿到 ≠ 比过了、没差异」
      if (o.outcome === "unavailable") expect(o.reason).toMatch(/没有可原样搬来的观察/);
    }
  });

  it("上游提供 inspect 观察 ⇒ inspect 原样 ok，review 仍 unavailable；判据/qaVerdict 不变（v3 视觉 QA 接口）", async () => {
    const clean = await run(stage());
    const inspect: Observation = { source: "inspect", outcome: "ok", lines: ["源图 / 目标尺寸（**观察，不是判据**）：", "  p-body.idle 源图 512×270 (1.896) → 目标 64×48 (1.333) · 长宽比差 -29.7%"] };
    const r = await run({ ...stage(), inspectObservation: inspect });
    expect(bySource(r, "inspect")).toEqual(inspect);
    expect(bySource(r, "review")?.outcome).toBe("unavailable");
    expect(r.checked).toEqual(clean.checked);
    expect(r.failures).toEqual(clean.failures);
    expect(qaVerdict(r)).toBe(qaVerdict(clean));
    expect(QAReportSchema.safeParse(r).success).toBe(true);
  });

  it("上游提供 unavailable ⇒ 原样装配（失败不伪装 ok）", async () => {
    const un: Observation = { source: "inspect", outcome: "unavailable", reason: "inspect 未能完成（测试）" };
    const r = await run({ ...stage(), inspectObservation: un });
    expect(bySource(r, "inspect")).toEqual(un);
  });
});

describe("§R3 那条底线：**观察不许影响 status**", () => {
  /** 把观察那一栏整个换掉 —— 裁决必须一个字不变。 */
  const withObservations = (r: QAReport, observations: Observation[]): QAReport => ({ ...r, observations });

  it("⚠️ 观察换成任意内容（包括「拿到了、有话说」），裁决**一个字不变**", async () => {
    const clean = await run(stage());
    expect(qaVerdict(clean)).toBe("pass");
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
    // ⚠️ `checked` 仍然是**七条**：跑了、响了，与跑了几条是两件事
    expect([...bad.checked].sort()).toEqual([...SEVEN].sort());
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

describe("§票 07 · VDS↔GameConfig 交叉验证（设计桶↔kind 家族）", () => {
  // 设计（CANNED.design）的 enemies 桶里有 e-drone；这里给 config 造一个 id 相同的实体。
  const ID = "e-drone";
  const drone = { id: ID, role: "hazard", bounds: { x: 100, y: 200, w: 16, h: 16 }, layer: 10, fill: "palette:0", sourceIntent: ID };
  const vds = (objects: unknown[]) => ({
    format: "visual-design/v1", viewport: { w: 480, h: 270 },
    style: { visualWorldFormat: "visual-world/v1" }, objects,
  });
  /** 真 config（last-train）+ 可选一个 `sourceIntent=ID` 的实体（kind 由参数给；null = 不加 ⇒ 制造「缺失」）。 */
  const configWith = (kind: string | null) => {
    const c = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
    // ⚠️ entity-identity-v1 票 04：join 键是 `sourceIntent`（不再是 `id`），实体要带它才查得到。
    if (kind !== null) c.entities.push({ id: ID, sourceIntent: ID, kind, at: { x: 720, y: 230 }, asset: "hazard-sweeping-carriage" });
    return c;
  };
  const vcFindings = (r: QAReport) => r.failures.filter((f) => f.judgement === "visual-config-coherence");

  it("一致：敌人桶实体在 config 里是 hazard ⇒ 无 error（几何漂移只 warning）", async () => {
    const ctx = stage();
    write(ctx.runDir, "game-config.json", configWith("hazard"));
    write(ctx.runDir, "visual-design.json", vds([drone]));
    expect(vcFindings(await run(ctx)).filter((f) => f.severity === "error")).toEqual([]);
  });

  it("⚠️ 串桶：敌人桶实体在 config 里是 decor ⇒ error（target = 实体 id）", async () => {
    const ctx = stage();
    write(ctx.runDir, "game-config.json", configWith("decor"));
    write(ctx.runDir, "visual-design.json", vds([drone]));
    const f = vcFindings(await run(ctx)).find((x) => x.severity === "error");
    expect(f?.target).toBe(ID);
    expect(f?.detail).toMatch(/不在允许集合/);
  });

  it("⚠️ 缺失：VDS 画了、config 没有 ⇒ error", async () => {
    const ctx = stage();
    write(ctx.runDir, "game-config.json", configWith(null));
    write(ctx.runDir, "visual-design.json", vds([drone]));
    const f = vcFindings(await run(ctx)).find((x) => x.severity === "error");
    expect(f?.target).toBe(ID);
    expect(f?.detail).toMatch(/不存在/);
  });

  it("几何漂移：只出 warning、不阻断（裁决仍 pass）", async () => {
    const ctx = stage();
    write(ctx.runDir, "game-config.json", configWith("hazard"));
    write(ctx.runDir, "visual-design.json", vds([drone]));
    const r = await run(ctx);
    expect(vcFindings(r).some((f) => f.severity === "warning")).toBe(true);
    expect(qaVerdict(r)).toBe("pass");
  });

  it("entity-identity-v1 票 04：1:N 合法 —— 同 sourceIntent 多个实体都 kind 在允许集合 ⇒ 无 error", async () => {
    const ctx = stage();
    const c = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
    c.entities.push({ id: "e-drone-a", sourceIntent: ID, kind: "hazard", at: { x: 720, y: 230 }, asset: "hazard-sweeping-carriage" });
    c.entities.push({ id: "e-drone-b", sourceIntent: ID, kind: "hazard", at: { x: 760, y: 230 }, asset: "hazard-sweeping-carriage" });
    write(ctx.runDir, "game-config.json", c);
    write(ctx.runDir, "visual-design.json", vds([drone]));
    expect(vcFindings(await run(ctx)).filter((f) => f.severity === "error")).toEqual([]);
  });

  it("entity-identity-v1 票 04：1:N 串桶 —— 其中一个实体 kind 越界 ⇒ error", async () => {
    const ctx = stage();
    const c = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
    c.entities.push({ id: "e-drone-a", sourceIntent: ID, kind: "hazard", at: { x: 720, y: 230 }, asset: "hazard-sweeping-carriage" });
    c.entities.push({ id: "e-drone-b", sourceIntent: ID, kind: "decor", at: { x: 760, y: 230 }, asset: "hazard-sweeping-carriage" });
    write(ctx.runDir, "game-config.json", c);
    write(ctx.runDir, "visual-design.json", vds([drone]));
    const f = vcFindings(await run(ctx)).find((x) => x.severity === "error");
    expect(f?.target).toBe(ID);
    expect(f?.detail).toMatch(/不在允许集合/);
  });
});
