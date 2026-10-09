// **一条 `create` 链**（票 15）+ **人类点名的五个 invariant**。
//
// ⚠️ 这一份最要紧的不是「能不能跑通」，而是那五条边界有没有被**锁死**：
//   Run 身份 · 构建 attempt 的版本 · recipe 磁盘真相 · character 引用完整性 · 失败现场保留。
//   每一条都有**它自己的 describe**（带 invariant 编号），别把它们埋进「happy path」里。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { RUN_LEDGER_FORMAT, parseRecipe, qaVerdict, type AssetRecipe, type AssetSpec, type QaContext, type QAReport, type StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, framePlan, type DrawListGenerator } from "@game-maker/assets";
import { createGame, runBuild, runUnderstanding } from "../src/index.js";
import { CANNED, fakeUpstream, tinyPng } from "./upstream.js";

const dirs: string[] = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-create-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

/** 一个已经摆在磁盘上的参考图 + 一条假上游。 */
function harness(over: { recipeId?: string; designFails?: number; override?: Record<string, unknown> } = {}) {
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, "style.png"), tinyPng());
  const seen: Record<string, unknown>[] = [];
  return {
    cwd, seen,
    outRoot: path.join(cwd, "out"),
    fetchImpl: fakeUpstream({ recipeId: over.recipeId ?? "wasteland", seen, ...(over.designFails !== undefined ? { designFails: over.designFails } : {}), ...(over.override !== undefined ? { override: over.override } : {}) }),
  };
}
const TRANSPORT = { baseUrl: "http://up.test", apiKey: "k" };
const understand = (h: ReturnType<typeof harness>, over: Record<string, unknown> = {}) =>
  runUnderstanding({
    outRoot: h.outRoot, requirement: "做一个废土横版寻宝游戏",
    styleReferences: [{ path: "style.png", role: "global" }],
    transport: TRANSPORT, fetchImpl: h.fetchImpl, cwd: h.cwd, ...over,
  });
const build = (h: ReturnType<typeof harness>, runDir: string, over: Record<string, unknown> = {}) =>
  runBuild({ outRoot: h.outRoot, runDir, transport: TRANSPORT, fetchImpl: h.fetchImpl, ...over });

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
const runPath = (h: ReturnType<typeof harness>, ...rest: string[]) => path.join(h.outRoot, "wasteland", "run", "v1", ...rest);

describe("§第一段：理解 ⇒ `run/v<N>/`（Q1/Q2/Q3/Q13）", () => {
  it("七项落在 `run/v1/`，`characterRef` 被注入、参考图也拷了进来", async () => {
    const h = harness();
    const r = await understand(h);
    expect(r.run.version).toBe(1);
    expect(r.paths.runDir).toBe("wasteland/run/v1");
    // 九项里**这一段**该有的七项（`game-config.json` 在第二段、`qa-report.json` 见 QA 那一节）
    for (const f of ["intent.md", "visual-world.json", "game-intent.json", "game-design.json", "character-dna.json", "asset-recipe.json", "ledger.json"])
      expect(fs.existsSync(runPath(h, f)), f).toBe(true);
    // 清单跟着 planner 那三样（`styleRef` / `referenceImage` 写的是**同目录**的相对路径）
    expect(fs.existsSync(runPath(h, "stylespec.json"))).toBe(true);
    expect(fs.existsSync(runPath(h, "reference.png"))).toBe(true);
    // ⚠️ **`characterRef` 是注入的**（模型不知道落点），而磁盘上那一份也带着它（磁盘才是真相）
    expect(r.recipe.characterRef).toBe("character-dna.json");
    expect(readJson(runPath(h, "asset-recipe.json"))["characterRef"]).toBe("character-dna.json");
    // ⚠️ 参考图拷进来之后，VWS 里的路径改写成**同目录的 basename**（契约：相对它自己）
    expect(r.visualWorld.styleReferences[0]!.path).toBe("style.png");
    expect(fs.existsSync(path.join(r.run.dir, "style.png"))).toBe(true);
  });

  it("`intent.md` 是**原样字节**（§13 的原话：不做规范化）", async () => {
    const h = harness();
    const requirement = "做一个废土横版寻宝游戏\n第二行带着空格  \n";
    await understand(h, { requirement });
    expect(fs.readFileSync(runPath(h, "intent.md"), "utf8")).toBe(requirement);
  });

  it("账：`run-ledger/v1`，理解段那五发都在（`plan-assets` 也在）", async () => {
    const h = harness();
    await understand(h);
    const doc = readJson(runPath(h, "ledger.json"));
    expect(doc["format"]).toBe(RUN_LEDGER_FORMAT);
    expect(Object.keys(doc["run"] as object).includes("byStep")).toBe(true);
    const steps = new Set((doc["calls"] as { step: string }[]).map((c) => c.step));
    expect([...steps].sort()).toEqual(["analyze-intent", "analyze-reference", "character-dna", "compile-design", "plan-assets"]);
  });

  it("五发都走了**强制工具调用**（R16：五个工具名各一次）", async () => {
    const h = harness();
    await understand(h);
    const tools = h.seen.map((b) => (b["tool_choice"] as { name: string }).name);
    expect(tools.sort()).toEqual(["emit_asset_recipe", "emit_character_dna", "emit_game_design", "emit_game_intent", "emit_visual_world"]);
  });
});

describe("§第二段：构建 —— **只吃 runDir**（Q2/Q5/Q6/Q14/Q15）", () => {
  it("产 `pack/v1` 与 `run/v1/game-config.json`；首次 attempt 的包版本**与 run 对齐**", async () => {
    const h = harness();
    const u = await understand(h);
    const b = await build(h, u.run.dir);
    expect(b.packVersion).toBe(u.run.version);
    expect(b.paths.config).toBe(runPath(h, "game-config.json"));
    expect(fs.existsSync(b.paths.packDir)).toBe(true);
    expect(b.manifest.id).toBe("wasteland");
    expect(b.config.scene.background.asset).toBe("bg-dusk");
  });

  it("⚠️ 包内带一份 `authoring/visual-world.json`，而且它**进了 `files[]`**（Q15 α：靠 files[] 白拿 checksum）", async () => {
    const h = harness();
    const u = await understand(h);
    const b = await build(h, u.run.dir);
    const packed = path.join(b.paths.packDir, "authoring", "visual-world.json");
    expect(fs.existsSync(packed)).toBe(true);
    expect(b.manifest.files.map((f) => f.path)).toContain("authoring/visual-world.json");
    // ⚠️ **不动 `provenance`**（升版会判死磁盘上那份入库的 v2 包）—— 它只有 `mode` 与 `style`
    expect(Object.keys(b.manifest.provenance).sort()).toEqual(["mode", "style"]);
  });

  it("账：`run/` 那份是**链级并集**（理解段 + 构建），而包里那份只记包自己的", async () => {
    const h = harness();
    const u = await understand(h);
    const b = await build(h, u.run.dir);
    const steps = new Set(b.ledger.map((c) => c.step));
    expect(steps.has("analyze-reference"), "理解段在").toBe(true);
    expect(steps.has("drawlist"), "构建段在").toBe(true);
    const packed = readJson(path.join(b.paths.packDir, "ledger.json")) as { calls: { step: string }[] };
    expect([...new Set(packed.calls.map((c) => c.step))]).toEqual(["drawlist"]);   // 包里那份只有构建这一段
  });
});

// ── 人类点名的五个 invariant ─────────────────────────────────────────────────
describe("§invariant 1 · Run 身份", () => {
  it("⚠️ 清单里的 `id` 与运行目录名不一致 ⇒ **拒**（否则产物会劈到两个 gameId 下）", async () => {
    const h = harness();
    const u = await understand(h);
    const p = runPath(h, "asset-recipe.json");
    const doc = readJson(p);
    fs.writeFileSync(p, JSON.stringify({ ...doc, id: "另一个 id" }, null, 2) + "\n");
    await expect(build(h, u.run.dir)).rejects.toThrowError(/与这次运行的目录名/);
  });
});

describe("§invariant 2 · 构建 attempt 的版本", () => {
  it("首次 attempt 与 run 对齐（`pack/v1`）；**第二次** attempt ⇒ `pack/v2`，而 run 仍是 `v1`", async () => {
    const h = harness();
    const u = await understand(h);
    // ⚠️ 先往磁盘上放一个**更高的**包版本（v9）：对齐 ⇒ 仍然 v1（`pack/v1` 空着）；无脑取下一个 ⇒ v10
    fs.mkdirSync(path.join(h.outRoot, "wasteland", "pack", "v9"), { recursive: true });
    fs.writeFileSync(path.join(h.outRoot, "wasteland", "pack", "v9", "别的.txt"), "x");
    await build(h, u.run.dir);
    fs.rmSync(path.join(h.outRoot, "wasteland", "pack", "v9"), { recursive: true, force: true });   // 撤掉干扰
    const again = await build(h, u.run.dir);
    expect(again.runVersion).toBe(1);
    expect(again.packVersion).toBe(2);        // 第二次 attempt ⇒ 父给一个新 N（不是 v10）
    expect(fs.existsSync(path.join(h.outRoot, "wasteland", "pack", "v2"))).toBe(true);
  });

  it("⚠️ **子步骤禁止自行计算**：`buildAssetPack({version: 7})` 就落在 `v7`（哪怕 v1..v3 都在）", async () => {
    const h = harness();
    const u = await understand(h);
    const style = readJson(path.join(u.run.dir, "stylespec.json")) as unknown as StyleSpec;
    const out = path.join(h.cwd, "explicit");
    for (let i = 1; i <= 3; i++) fs.mkdirSync(path.join(out, "wasteland", "pack", `v${i}`), { recursive: true });
    const res = await buildAssetPack({
      recipe: readJson(path.join(u.run.dir, "asset-recipe.json")) as unknown as AssetRecipe,
      style, outDir: out, recipeDir: u.run.dir, version: 7,
      // ⚠️ 帧数要与 `framePlan` 对得上（`p-body` 是 3 帧）—— 给少了会当场拒
      generate: ((spec: AssetSpec) => framePlan(spec).map((f) => ({
        format: "drawlist+curve/v1", id: spec.id, frame: f.name, viewBox: [0, 0, spec.size.w, spec.size.h],
        expectedSize: [spec.size.w, spec.size.h], ops: [{ op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: "palette:0" }],
      }))) as DrawListGenerator,
      sourceDateEpoch: 1790208000,
    });
    expect(res.manifest.version).toBe(7);
    expect(res.packDir.endsWith(path.join("pack", "v7"))).toBe(true);
  });
});

describe("§invariant 3 · recipe 磁盘真相", () => {
  it("⚠️ 人改过磁盘上那份清单 ⇒ 构建段用的是**改过的那份**（内存里根本没有第二份）", async () => {
    const h = harness();
    const u = await understand(h);
    const p = runPath(h, "asset-recipe.json");
    const doc = readJson(p) as { assets: unknown[] };
    fs.writeFileSync(p, JSON.stringify({
      ...doc,
      assets: [...doc.assets, { spec: { kind: "sprite", id: "crate-2", role: "第二只箱子", description: "又一只木条箱", styleId: "halt-dusk", anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true, characterId: "p-scavenger" }, source: { kind: "drawlist" } }],
    }, null, 2) + "\n");
    const b = await build(h, u.run.dir);
    expect(b.manifest.assets.map((a) => a.id).sort()).toEqual(["bg-dusk", "crate-2", "p-body", "ui-hud", "ui-pip"]);
  });

  it("检查点拿到的是**磁盘上那一份**：`createGame` 的 `onRecipe` 在构建之前被调，且改得动", async () => {
    const h = harness();
    let seenRecipe: string | undefined;
    const r = await createGame({
      outRoot: h.outRoot, requirement: "做一个废土横版寻宝游戏",
      styleReferences: [{ path: "style.png", role: "global" }],
      transport: TRANSPORT, fetchImpl: h.fetchImpl, cwd: h.cwd,
      onRecipe: ({ recipePath, recipe }) => {
        seenRecipe = recipePath;
        expect(recipe.id).toBe("wasteland");
        expect(fs.existsSync(recipePath)).toBe(true);
        // ⚠️ 人在这里改清单（R10 的**唯一**人工点）—— 改的就是磁盘上那一份。
        //   ⚠️ 这里是**加**一个资产（而不是删）：删掉 `ui-hud` 会让配置编译器没东西可引。
        const doc = readJson(recipePath) as { assets: unknown[] };
        fs.writeFileSync(recipePath, JSON.stringify({
          ...doc,
          assets: [...doc.assets, { spec: { kind: "sprite", id: "crate-added", role: "人加的箱子", description: "人手加的", styleId: "halt-dusk", anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true }, source: { kind: "drawlist" } }],
        }, null, 2) + "\n");
      },
    });
    expect(seenRecipe).toBe(runPath(h, "asset-recipe.json"));
    expect(r.manifest.assets.map((a) => a.id)).toContain("crate-added");
  });
});

describe("§invariant 4 · character 引用完整性（**三条链都要真的响**）", () => {
  it("① 清单里有 `characterId` 而 `characterRef` 缺席 ⇒ 生成开始前拒（票 15 的 Q18）", async () => {
    const h = harness();
    const u = await understand(h);
    const p = runPath(h, "asset-recipe.json");
    const doc = readJson(p);
    delete doc["characterRef"];
    fs.writeFileSync(p, JSON.stringify(doc, null, 2) + "\n");
    await expect(build(h, u.run.dir)).rejects.toThrowError(/没有 `characterRef`/);
  });

  it("② 给了基因文件、而那个 `characterId` 不在里面 ⇒ 拒（票 13 落在 `pack` 的那条）", async () => {
    const h = harness();
    const u = await understand(h);
    const p = runPath(h, "character-dna.json");
    const doc = readJson(p) as { characters: { id: string }[] };
    fs.writeFileSync(p, JSON.stringify({ ...doc, characters: doc.characters.map((c) => ({ ...c, id: `x-${c.id}` })) }, null, 2) + "\n");
    await expect(build(h, u.run.dir)).rejects.toThrowError(/没有对家/);
  });

  it("③ 母版画布的宽高比与引用它的资产不一致 ⇒ 拒（票 11 落在契约里的那条）", async () => {
    const h = harness();
    const u = await understand(h);
    const p = runPath(h, "asset-recipe.json");
    const doc = readJson(p) as { assets: { spec: Record<string, unknown> }[] };
    fs.writeFileSync(p, JSON.stringify({
      ...doc,
      authoring: [{ id: "crate-master", role: "母版", description: "一张画布", source: { kind: "import", ref: "reference.png" }, characterId: "p-scavenger", size: { w: 32, h: 32 } }],
      assets: doc.assets.map((a) => ({ ...a, spec: { ...a.spec, masterAsset: "crate-master" } })),
    }, null, 2) + "\n");
    await expect(build(h, u.run.dir)).rejects.toThrowError(/宽高比不一致/);
  });
});

describe("§invariant 5 · 失败现场保留", () => {
  it("⚠️ 理解段挂 ⇒ 现场里有**已经跑完那几步**的产物，而且**不消耗版本号**", async () => {
    const h = harness({ designFails: 3 });
    await expect(understand(h)).rejects.toThrowError(/重采样/);
    const sites = fs.readdirSync(h.outRoot).filter((d) => d.startsWith(".failed-"));
    expect(sites).toHaveLength(1);
    const site = path.join(h.outRoot, sites[0]!);
    // 跑到设计那一步才挂 ⇒ 前两步的产物都在（看一眼就知道断在哪）
    expect(fs.existsSync(path.join(site, "intent.md"))).toBe(true);
    expect(fs.existsSync(path.join(site, "visual-world.json"))).toBe(true);
    expect(fs.existsSync(path.join(site, "game-intent.json"))).toBe(true);
    expect(fs.existsSync(path.join(site, "character-dna.json"))).toBe(false);
    // ⚠️ 失败**没消耗**版本号：接下来这一趟还是 v1
    const ok = await understand(h);
    expect(ok.run.version).toBe(1);
  });
});

describe("§QA：**默认跑**，只有 `null` 关得掉（票 20 的 Q3）", () => {
  it("⚠️ 不给 ⇒ 跑默认的合成器 —— 而**`incomplete` 不是失败**，它照样不阻断", async () => {
    const h = harness();
    const u = await understand(h);
    const b = await build(h, u.run.dir);
    // ⚠️ 干净的一次运行：五条判据全跑、一条怨言都没有
    expect(b.qa?.failures).toEqual([]);
    // ⚠️ **第六条不归 QA**（层覆盖由装配期的硬失败保证）⇒ `checked` 恒 5/6、裁决恒 `incomplete`
    //   —— 而**这一次构建成功了**：那正是「闸看 `failures`，不看 `qaVerdict`」的证据。
    expect(b.qa?.checked).toHaveLength(5);
    expect(b.qa?.checked).not.toContain("layer-coverage");
    expect(qaVerdict(b.qa!)).toBe("incomplete");
    expect(readJson(runPath(h, "qa-report.json"))["format"]).toBe("qa-report/v1");
    expect(b.paths.qaReport).toBeDefined();
  });

  it("⚠️ **`qa: null` ⇒ 缺席**（返回里没有 `qa`、run 里没有 `qa-report.json`）—— 不是「跑了但没问题」", async () => {
    const h = harness();
    const u = await understand(h);
    const b = await build(h, u.run.dir, { qa: null });
    expect(b.qa).toBeUndefined();
    expect(b.paths.qaReport).toBeUndefined();
    expect(fs.existsSync(runPath(h, "qa-report.json"))).toBe(false);
  });

  it("给了 ⇒ 跑、**pipeline 落盘**、返回里带着那份报告", async () => {
    const h = harness();
    const u = await understand(h);
    const report: QAReport = {
      format: "qa-report/v1", checked: [], failures: [],
      // ⚠️ **每个来源恰好一条**（契约的 `superRefine` ④）—— 少一条，`runBuild` 的契约校验当场拒。
      observations: [
        { source: "inspect", outcome: "unavailable", reason: "测试用：没跑" },
        { source: "review", outcome: "unavailable", reason: "测试用：没跑" },
      ],
    };
    let saw = "";
    const b = await build(h, u.run.dir, {
      qa: async (ctx: QaContext) => {
        // ⚠️ **四份产物路径逐个查**（票 19 的 Q4/Q11）：QA 看到的是**已经落盘**的那四样 ——
        //   手打的窄参数类型在这里会**编译不过**（逆变），那正是这条纪律想要的。
        saw = [
          ctx.gameId, fs.existsSync(ctx.packDir), fs.existsSync(ctx.configPath),
          fs.existsSync(ctx.intentPath), fs.existsSync(ctx.designPath), fs.existsSync(ctx.recipePath)
        ].join("|");
        return report;
      },
    });
    expect(saw).toBe("wasteland|true|true|true|true|true");   // ⚠️ QA 看到的是**已经落盘**的那五份产物（外加 `gameId`）
    expect(b.qa).toEqual(report);
    expect(readJson(runPath(h, "qa-report.json"))["format"]).toBe("qa-report/v1");
  });

  it("⚠️ 一份**过不了契约**的报告 ⇒ 当场拒（那是**我们自己的 bug**，不是模型没生成好）", async () => {
    const h = harness();
    const u = await understand(h);
    // 观察缺一条 —— 正是票 18 实测到的那个形状（一份「族结果」直接落盘）
    const broken = {
      format: "qa-report/v1", checked: [], failures: [],
      observations: [{ source: "inspect", outcome: "unavailable", reason: "只给了一条" }],
    } as unknown as QAReport;
    await expect(build(h, u.run.dir, { qa: async () => broken }))
      .rejects.toThrowError(/过不了 `qa-report\/v1`/);
  });
});

describe("§QA 的硬失败：**报告先落盘、再阻断**（R3 · 票 20 的 Q4）", () => {
  /** 一个**真链上会响**的现场：把拾取物摆到跳不到的高处 ⇒ `reachability` 报一条 error。
   *  ⚠️ 世界是平的、跳跃顶点只有 40.5px（`180²/(2×400)`），而 y=60 离脚下的 200 有一大截。 */
  function unreachableHarness() {
    const config = structuredClone(CANNED.gameConfig) as { entities: { id: string; at: { x: number; y: number } }[] };
    config.entities.find((e) => e.id === "e-pickup-1")!.at = { x: 120, y: 60 };
    return harness({ override: { emit_game_config: config } });
  }

  it("⚠️ 真链上响一次 ⇒ 抛 `invalid`（= 退出码 4），而报告**已经在磁盘上**", async () => {
    const h = unreachableHarness();
    const u = await understand(h);
    await expect(build(h, u.run.dir)).rejects.toMatchObject({ kind: "invalid" });

    // ⚠️ **落盘在阻断之前**：判据说不行了，正是最该读它的时候（也是修复循环要读的那一份）
    const report = readJson(runPath(h, "qa-report.json")) as {
      checked: string[]; failures: { judgement: string; severity: string }[];
    };
    expect(report.failures.map((f) => f.judgement)).toContain("reachability");
    expect(report.checked).toContain("reachability");      // 跑过才产得出失败（契约的 `superRefine` ③）
  });

  it("⚠️ 文案里带着**报告路径**与失败详情 —— 走异常那一路也丢不掉它（票 20 的 Q5）", async () => {
    const h = unreachableHarness();
    const u = await understand(h);
    const e = await build(h, u.run.dir).catch((x: unknown) => x as Error);
    expect(e.message).toMatch(/qa-report\.json/);          // 报告路径
    expect(e.message).toMatch(/\[reachability\]/);         // 哪条判据
    expect(e.message).toMatch(/QA 判据没过/);
    // ⚠️ **不能**出现「再抽一次」那类话：判据说的是**产物**的问题，重抽改不了那些事实。
    expect(e.message).toMatch(/不是「再抽一次」的理由/);
  });
});

describe("§两段各报自己那几步（Q6 的进度）", () => {
  it("理解段报 5 步、构建段报 3 步（QA 默认在，所以是 pack → config → qa）", async () => {
    const h = harness();
    const got: string[] = [];
    await understand(h, { onProgress: (p: { step: string }) => got.push(p.step) });
    expect(got).toEqual(["visual-world", "intent", "design", "character-dna", "recipe"]);
    const u = await understand(h);
    const got2: string[] = [];
    await build(h, u.run.dir, { onProgress: (p: { step: string }) => got2.push(p.step) });
    expect(got2.filter((s, i) => s !== got2[i - 1])).toEqual(["pack", "config", "qa"]);   // 资产级进度也报在 pack 那一步

    // ⚠️ `qa: null` ⇒ 那一步**根本不报**（不是报一个「跳过了」）—— 步级进度说的是**发生过**的事
    const u2 = await understand(h);
    const got3: string[] = [];
    await build(h, u2.run.dir, { qa: null, onProgress: (p: { step: string }) => got3.push(p.step) });
    expect(got3.filter((s, i) => s !== got3[i - 1])).toEqual(["pack", "config"]);
  });
});
