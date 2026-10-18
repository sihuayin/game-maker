// **一条 `create` 链**（票 15）+ **人类点名的五个 invariant**。
//
// ⚠️ 这一份最要紧的不是「能不能跑通」，而是那五条边界有没有被**锁死**：
//   Run 身份 · 构建 attempt 的版本 · recipe 磁盘真相 · character 引用完整性 · 失败现场保留。
//   每一条都有**它自己的 describe**（带 invariant 编号），别把它们埋进「happy path」里。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { DESIGN_ATTEMPTS_FILE, PLAYER_ACTION_NAMES, RUN_LEDGER_FORMAT, VISUAL_WORLD_ATTEMPTS_FILE, exitCodeOfError, parseAssetPlan, parseDesignAttempts, parseRecipe, parseVisualWorldAttempts, qaVerdict, type AssetRecipe, type AssetSpec, type QaContext, type QAReport, type StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, decodePNG, encodePNG, framePlan, type DrawListGenerator } from "@game-maker/assets";
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
/** v3 票 09：planner 需要 image 能力；用一条假 transport，不探测在线。 */
const IMAGE = { protocol: "gemini" as const, baseUrl: "http://up.test", apiKey: "k" };
const understand = (h: ReturnType<typeof harness>, over: Record<string, unknown> = {}) =>
  runUnderstanding({
    outRoot: h.outRoot, requirement: "做一个废土横版寻宝游戏",
    styleReferences: [{ path: "style.png" }],
    transport: TRANSPORT, fetchImpl: h.fetchImpl, cwd: h.cwd, imageTransport: IMAGE, ...over,
  });
const build = (h: ReturnType<typeof harness>, runDir: string, over: Record<string, unknown> = {}) =>
  runBuild({ outRoot: h.outRoot, runDir, transport: TRANSPORT, fetchImpl: h.fetchImpl, imageTransport: IMAGE, ...over });

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

  it("plan sidecar 跟着落进 run；route 与 Recipe 的 source.kind 逐项一致（v3 票 09）", async () => {
    const h = harness();
    const r = await understand(h);
    expect(r.paths.recipePlan).toBe("wasteland/run/v1/asset-recipe.plan.json");
    const plan = parseAssetPlan(readJson(runPath(h, "asset-recipe.plan.json")));
    expect(plan.ok, plan.ok ? "" : plan.errors.join(" / ")).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.capabilities.routes.image).toBe(true);
    expect(plan.value.assets.map((a) => a.id).sort()).toEqual(r.recipe.assets.map((a) => a.spec.id).sort());
    for (const a of plan.value.assets) {
      const e = r.recipe.assets.find((x) => x.spec.id === a.id)!;
      expect(e.source.kind, a.id).toBe(a.route);
    }
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
    // ⚠️ **不动 `provenance`**（升版会判死磁盘上那份入库的包）—— 它**只剩 `mode`**
    //    （`style` 于 2026-10-13 删除，票 45）
    expect(Object.keys(b.manifest.provenance).sort()).toEqual(["mode"]);
  });

  it("账：`run/` 那份是**链级并集**（理解段 + 构建），而包里那份只记包自己的", async () => {
    const h = harness();
    const u = await understand(h);
    const b = await build(h, u.run.dir);
    const steps = new Set(b.ledger.map((c) => c.step));
    expect(steps.has("analyze-reference"), "理解段在").toBe(true);
    expect(steps.has("drawlist"), "构建段在").toBe(true);
    const packed = readJson(path.join(b.paths.packDir, "ledger.json")) as { calls: { step: string }[] };
    expect([...new Set(packed.calls.map((c) => c.step))].sort()).toEqual(["drawlist", "image"]);   // resolver 后 bg/p-body 走 image
  });

  it("旧 run 没有 sidecar ⇒ build 照常（pack 不读它；不推断历史理由）", async () => {
    const h = harness();
    const u = await understand(h);
    fs.rmSync(runPath(h, "asset-recipe.plan.json"));
    const b = await build(h, u.run.dir);
    expect(b.packVersion).toBe(u.run.version);
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
      // ⚠️ 帧数要与 `framePlan` 对得上（`p-body` 是 6 帧：三路动画各 2 帧 —— 票 61 的 Q3(ii)
      //   「每路至少 2 帧」把这份桩从「各 1 帧」改成了「各 2 帧」）—— 给少了会当场拒
      generate: ((spec: AssetSpec) => framePlan(spec).map((f) => ({
        format: "drawlist+curve/v1", id: spec.id, frame: f.name, viewBox: [0, 0, spec.size.w, spec.size.h],
        expectedSize: [spec.size.w, spec.size.h], ops: [{ op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: "palette:0" }],
      }))) as DrawListGenerator,
      // v3 票 09：resolver 后 bg-dusk / p-body 走 image；给一个假生图器（不联网）。
      generateImage: (async (req: { prompt: string }) => {
        const n = Number(/横向排开 \*\*(\d+) 个\*\*/.exec(req.prompt)?.[1] ?? 0);
        const isBg = n === 0 && /背景|这一层|层\b/.test(req.prompt);
        const w = n > 0 ? Math.max(512, n * 128 + 64) : 480, h = 270;
        const data = Buffer.alloc(w * h * 4);
        const fill = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => {
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const s = (y * w + x) * 4; data[s] = c[0]; data[s + 1] = c[1]; data[s + 2] = c[2]; data[s + 3] = 255;
          }
        };
        fill(0, 0, w, h, isBg ? [90, 80, 70] : [255, 0, 255]);
        if (n > 0) for (let k = 0; k < n; k++) fill(64 + k * 128, 50, 128 + k * 128, 220, [220, 220, 220]);
        else if (!isBg) fill(Math.floor(w / 3), Math.floor(h / 4), Math.floor((2 * w) / 3), Math.floor((3 * h) / 4), [220, 220, 220]);
        return { image: decodePNG(encodePNG({ width: w, height: h, data })), call: { protocol: "fake", ms: 0, attempts: 1 } };
      }) as any,
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
      styleReferences: [{ path: "style.png" }],
      transport: TRANSPORT, fetchImpl: h.fetchImpl, cwd: h.cwd, imageTransport: IMAGE,
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

// ── 票 55「被拒的设计一个字都不落盘」的判据 ───────────────────────────────────
describe("§票 55 · 被拒的设计**也**留现场（`design-attempts.json`）", () => {
  /** 那一次失败留下的**唯一**现场目录（`.failed-<ts>/`）。 */
  const site = (h: ReturnType<typeof harness>) => {
    const sites = fs.readdirSync(h.outRoot).filter((d) => d.startsWith(".failed-"));
    expect(sites).toHaveLength(1);
    return path.join(h.outRoot, sites[0]!);
  };
  /** 跑一趟、把抛出来的东西**取出来看**（`rejects` 只给得出「抛没抛」）。 */
  const thrown = <T,>(p: Promise<T>) => p.then((): unknown => undefined, (e: unknown) => e);

  it("阳性 · schema 档：**三发各自的原始入参**都在现场里，而且读得回来", async () => {
    const h = harness({ designFails: 3 });
    const err = (await thrown(understand(h))) as Error;
    expect(String(err.message)).toMatch(/重采样/);
    // ⚠️ **报错里不点名这个文件**（票 55 的 Q4）：失败现场的通行做法是**目录即索引**
    expect(String(err.message)).not.toContain(DESIGN_ATTEMPTS_FILE);

    const parsed = parseDesignAttempts(readJson(path.join(site(h), DESIGN_ATTEMPTS_FILE)));
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("；")).toBe(true);
    if (!parsed.ok) return;
    // ⚠️ **每一次往返**（票 55 的 Q1）：三发都在、按 `attempt` 升序 ——
    //   只留最后一发，就会把「系统性毛病 vs 手气差」这条判断**重新变回推理**
    expect(parsed.value.attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
    expect(parsed.value.attempts.map((a) => a.outcome)).toEqual(["schema", "schema", "schema"]);
    // ⚠️ 而 `raw` 是**模型那一发写下的整份入参**（不是一个摘要、也不是装配后那份 —— 那一份没落盘）
    const raw0 = parsed.value.attempts[0]!.raw as { world: { theme: string } };
    expect(raw0.world.theme).toBe("");     // ← 夹具里那份过不了 gate 的设计，原样
  });

  it("阳性 · R12 档：那一发**照样**留原话，且 `rejections` 与抛出去那份**同一份事实**", async () => {
    // 参考图的视角这一代做不了（`top-down` ⇒ `camera-unsupported`）：
    // 一份**过了 schema**、却被 R12 否掉的设计 —— 正是第八跑那一档
    const h = harness({ override: { emit_visual_world: { ...CANNED.visualWorld, camera: { mode: "top-down" } } } });
    const err = (await thrown(understand(h))) as { rejections?: { reason: string }[] };
    expect(err.rejections?.[0]?.reason).toBe("camera-unsupported");

    const parsed = parseDesignAttempts(readJson(path.join(site(h), DESIGN_ATTEMPTS_FILE)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // ⚠️ **R12 那一档只走一趟**（不重采样）⇒ 恒 1 份
    expect(parsed.value.attempts).toHaveLength(1);
    const only = parsed.value.attempts[0]!;
    expect(only.outcome).toBe("rejected");
    expect(only.raw).toBeDefined();          // ← 「模型把 `player.id` 改成了什么」那个读点，就靠它
    // ⚠️ 与 `DesignRejectedError` 里那份**逐字相同**：不复用同一份，就会有两份**会分叉**的事实
    expect(only.rejections).toEqual(err.rejections);
  });

  it("⚠️ 密钥钉子：落下来的东西里**不含**密钥（不许只靠「它今天恰好只在请求头里」）", async () => {
    const SECRET = "sk-ant-THIS-MUST-NEVER-REACH-THE-FAILURE-SITE-5757";
    const h = harness({ designFails: 3 });
    await expect(understand(h, { transport: { baseUrl: "http://up.test", apiKey: SECRET } }))
      .rejects.toThrowError(/重采样/);
    // 现场里**所有**落盘的文本一起看 —— 本票往这里新塞了一类内容，就该在这里钉一次（同 `image-gen.test.ts`）
    const dir = site(h);
    const dump = fs.readdirSync(dir).filter((f) => /\.(json|md)$/.test(f))
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    expect(dump).toContain("design-attempts");   // 钉子先自证：那个文件**确实**在
    expect(dump).not.toContain(SECRET);
  });

  it("⚠️ 上游死在**第 2 发** ⇒ 第 1 发那份入参**不跟着丢**（判据不是「抛的是哪个类」）", async () => {
    // ⚠️ 票 55 的 Q5 关掉的那个边：按错误类分流（「只有 R12 那一档才写」/「只有重采样打满才写」）
    //   会把这一份**连同第 1 发的现场**一起丢掉。判据是**这一圈有没有拿到过模型入参**。
    const h = harness({ designFails: 1 });          // 第 1 发：过不了契约（`schema`）
    const inner = h.fetchImpl;
    let designTrips = 0;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { tool_choice?: { name?: string } };
      if (body.tool_choice?.name === "emit_game_design" && ++designTrips === 2)
        return new Response("boom", { status: 500 });
      return inner(url, init);
    }) as typeof fetch;

    await expect(understand(h, { fetchImpl })).rejects.toThrowError(/HTTP 500/);
    const parsed = parseDesignAttempts(readJson(path.join(site(h), DESIGN_ATTEMPTS_FILE)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // ⚠️ **缺号**：上游失败那一发不在容器里（它发生在取到 body 之前，压根没有入参）——
    //   它的事实在**账**那一侧记着（本票一个字没动账）
    expect(parsed.value.attempts.map((a) => a.attempt)).toEqual([1]);
    expect(parsed.value.attempts[0]!.outcome).toBe("schema");
    expect(parsed.value.attempts[0]!.raw).toBeDefined();
  });

  it("阴性 · **一个入参都没拿到** ⇒ 不写（连一个空容器都不留）", async () => {
    // ⚠️ 判据**不是「抛的是哪个类」**（票 55 的 Q5）：这里第 **1** 发就撞上上游 500 ——
    //   这一圈压根没有模型入参可留 ⇒ 一份**什么都不含**的容器不该被写出来。
    const h = harness();
    const inner = h.fetchImpl;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { tool_choice?: { name?: string } };
      if (body.tool_choice?.name === "emit_game_design") return new Response("boom", { status: 500 });
      return inner(url, init);
    }) as typeof fetch;

    await expect(understand(h, { fetchImpl })).rejects.toThrowError(/HTTP 500/);
    // 现场照旧在（改名、不删）—— 只是里面**没有**这个东西
    expect(fs.existsSync(path.join(site(h), DESIGN_ATTEMPTS_FILE))).toBe(false);
  });

  it("阴性 · 成功路径一个字节不变 —— 哪怕这一跑**重采样过**、内存里真有过一份原始入参", async () => {
    const clean = harness();
    await understand(clean);
    const retried = harness({ designFails: 1 });   // 第 1 发不过契约、第 2 发才成
    await understand(retried);

    const listing = (h: ReturnType<typeof harness>) =>
      fs.readdirSync(path.join(h.outRoot, "wasteland", "run", "v1")).sort();
    expect(listing(retried)).toEqual(listing(clean));
    // ⚠️ 本票的阴性判据里最要紧的一格：那份原始入参**不进成功产物**
    expect(listing(retried)).not.toContain(DESIGN_ATTEMPTS_FILE);
    for (const f of listing(clean)) {
      // ⚠️ `ledger.json` 除外：它的 `ms` 是**时钟读数**，而重采样那一跑本来就该多记一发
      //   （账一个字没动 —— 票 55 的 Q7）
      if (f === "ledger.json") continue;
      const read = (h: ReturnType<typeof harness>) =>
        fs.readFileSync(path.join(h.outRoot, "wasteland", "run", "v1", f));
      expect(read(clean).equals(read(retried)), f).toBe(true);
    }
    // ⚠️ 而成功那一跑连失败现场都不该有 —— 不抛就**没有那个写入点**（这条判据是**结构性**成立的）
    expect(fs.readdirSync(retried.outRoot).filter((d) => d.startsWith(".failed-"))).toEqual([]);
  });
});

// ── 票 60「理解层**第一步**失败时，模型写的东西一个字都不留」的判据 ──────────────
//
// ⚠️ 这一组与票 55 那一组的**判据形状是同款**，但**必须专门钉「死在第一步」这一档**：
//   票 55 的阳性桩喂的是**设计层**，而票 23 第十次真跑的新证据是**第一步就抛**
//   （现场里只有 `intent.md`）—— 不专门钉它，「换了一个键」这件事的判据会**看着它但不打中它**。
describe("§票 60 · 死在第一步也留现场（`visual-world-attempts.json`）", () => {
  /** 那一次失败留下的**唯一**现场目录（`.failed-<ts>/`）。 */
  const site = (h: ReturnType<typeof harness>) => {
    const sites = fs.readdirSync(h.outRoot).filter((d) => d.startsWith(".failed-"));
    expect(sites).toHaveLength(1);
    return path.join(h.outRoot, sites[0]!);
  };
  const thrown = <T,>(p: Promise<T>) => p.then((): unknown => undefined, (e: unknown) => e);

  /** 拦下某一支工具，按给定形状答话（其余照旧走假上游）。 */
  const intercept = (
    h: ReturnType<typeof harness>, tool: string,
    answer: (name: string) => Record<string, unknown> | Response,
  ): typeof fetch => {
    const inner = h.fetchImpl;
    return (async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { tool_choice?: { name?: string } };
      const name = body.tool_choice?.name;
      if (name !== undefined && name === tool) {
        const a = answer(name);
        return a instanceof Response ? a : jsonResponse(a);
      }
      return inner(url, init);
    }) as typeof fetch;
  };
  const jsonResponse = (body: unknown): Response =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  /** 一份**过了 `ModelFacingSpec`、但顶层 `palette` 是数组**的入参 —— 第十跑实测的那个形状。 */
  const badWorld = (p: unknown) => ({
    content: [{ type: "tool_use", name: "emit_visual_world", input: { ...CANNED.visualWorld, palette: p } }],
    stop_reason: "tool_use", model: "deepseek-flash", usage: { input_tokens: 1500, output_tokens: 2100 },
  });

  it("阳性 · **死在第一步**：现场里有 `intent.md`（那一步真走到了）与三发各自的原始入参", async () => {
    const h = harness();
    const fetchImpl = intercept(h, "emit_visual_world", () => badWorld(["#2e3b4e"]));
    const err = (await thrown(understand(h, { fetchImpl }))) as Error;
    expect(String(err.message)).toMatch(/重采样/);
    expect(String(err.message)).toContain("VisualWorldSpec");
    // ⚠️ **报错里不点名这个文件**（与票 55 的 Q4 同款）：失败现场的通行做法是**目录即索引**
    expect(String(err.message)).not.toContain(VISUAL_WORLD_ATTEMPTS_FILE);

    const dir = site(h);
    // ⚠️ 死在第一步 ⇒ **上游一格产物都没有**，`intent.md` 是 fixture 拷进去的**输入**
    //   （它同时是「那个写入点真的走得到」的旁证 —— 第十跑现场就是长这样）
    expect(fs.readdirSync(dir)).toContain("intent.md");
    expect(fs.existsSync(path.join(dir, "visual-world.json"))).toBe(false);

    const parsed = parseVisualWorldAttempts(readJson(path.join(dir, VISUAL_WORLD_ATTEMPTS_FILE)));
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("；")).toBe(true);
    if (!parsed.ok) return;
    // ⚠️ **每一次往返**：三发都在、按 `attempt` 升序 —— 只留最后一发，
    //   就会把「系统性毛病 vs 手气差」这条判断**重新变回推理**（票 23 的 H2 要的正是这个）
    expect(parsed.value.attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
    expect(parsed.value.attempts.map((a) => a.outcome)).toEqual(["schema", "schema", "schema"]);
    // ⚠️ 而 `raw` 是**模型那一发写下的整份入参**（不是装配后那份 —— 那一份没落盘）
    const raw0 = parsed.value.attempts[0]!.raw as { palette: unknown };
    expect(raw0.palette).toEqual(["#2e3b4e"]);
    // ⚠️ 响应摘要也在（判「三发是不是同一段时间的坏状态」的输入之一）
    expect(parsed.value.attempts[0]!.response.usage).toEqual({ inputTokens: 1500, outputTokens: 2100 });
  });

  it("阴性 · **第一步成了、第二步才死** ⇒ 第一发那份容器**不出现**（它只属于抛出来的那一圈）", async () => {
    // ⚠️ 这是**有意的取舍**、不是漏掉的边：`analyze-reference` 成功那一跑**不抛**
    //   ⇒ 没有写入点（成功路径一个字节不变的代价）。`visual-world.json` 在，容器不在。
    const h = harness();
    const fetchImpl = intercept(h, "emit_game_intent", () => ({
      content: [{ type: "tool_use", name: "emit_game_intent", input: { format: "game-intent/v1" } }],
      stop_reason: "tool_use", model: "deepseek-flash", usage: { output_tokens: 800 },
    }));
    await expect(understand(h, { fetchImpl })).rejects.toThrowError(/重采样/);
    const dir = site(h);
    expect(fs.existsSync(path.join(dir, "visual-world.json"))).toBe(true);
    expect(fs.existsSync(path.join(dir, VISUAL_WORLD_ATTEMPTS_FILE))).toBe(false);
  });

  it("⚠️ 密钥钉子：落下来的东西里**不含**密钥（不许只靠「它今天恰好只在请求头里」）", async () => {
    const SECRET = "sk-ant-THIS-MUST-NEVER-REACH-THE-FAILURE-SITE-6060";
    const h = harness();
    const fetchImpl = intercept(h, "emit_visual_world", () => badWorld([]));
    await expect(understand(h, { fetchImpl, transport: { baseUrl: "http://up.test", apiKey: SECRET } }))
      .rejects.toThrowError(/重采样/);
    // 现场里**所有**落盘的文本一起看 —— 本票往这里新塞了一类内容，就该在这里钉一次（同票 55）
    const dir = site(h);
    const dump = fs.readdirSync(dir).filter((f) => /\.(json|md)$/.test(f))
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    expect(dump).toContain("visual-world-attempts");   // 钉子先自证：那个文件**确实**在
    expect(dump).not.toContain(SECRET);
  });

  it("阴性 · **一个入参都没拿到**（连工具块都没有）⇒ 不写（连一个空容器都不留）", async () => {
    // ⚠️ 判据是**这一圈有没有拿到过模型入参**，不是「抛的是哪个类」——
    //   这一档三发全 `no-tool-use`，压根没有入参可留 ⇒ 一份什么都不含的容器不该被写出来
    const h = harness();
    const fetchImpl = intercept(h, "emit_visual_world", () => ({
      content: [{ type: "text", text: "我说了算" }], stop_reason: "tool_use", usage: { output_tokens: 4430 },
    }));
    await expect(understand(h, { fetchImpl })).rejects.toThrowError(/重采样/);
    // 现场照旧在（改名、不删）—— 只是里面**没有**这个东西
    const dir = site(h);
    expect(fs.readdirSync(dir)).toContain("intent.md");
    expect(fs.existsSync(path.join(dir, VISUAL_WORLD_ATTEMPTS_FILE))).toBe(false);
  });

  it("阴性 · 成功路径一个字节不变 —— 哪怕这一跑在**第一步**重采样过、内存里真有过一份原始入参", async () => {
    const clean = harness();
    await understand(clean);
    // 第 1 发不过契约、第 2 发才成（**在第一步重采样**，票 55 那一档没覆盖到）
    const retried = harness();
    let trips = 0;
    const fetchImpl = intercept(retried, "emit_visual_world", () =>
      (++trips === 1 ? badWorld(["#2e3b4e"]) : jsonResponse({
        content: [{ type: "tool_use", name: "emit_visual_world", input: CANNED.visualWorld }],
        stop_reason: "tool_use", model: "deepseek-flash", usage: { input_tokens: 1200, output_tokens: 900 },
      })));
    await understand(retried, { fetchImpl });

    const listing = (h: ReturnType<typeof harness>) =>
      fs.readdirSync(path.join(h.outRoot, "wasteland", "run", "v1")).sort();
    expect(listing(retried)).toEqual(listing(clean));
    // ⚠️ 本票的阴性判据里最要紧的一格：那份原始入参**不进成功产物**（更不进 `run/v<N>/`）
    expect(listing(retried)).not.toContain(VISUAL_WORLD_ATTEMPTS_FILE);
    for (const f of listing(clean)) {
      // ⚠️ `ledger.json` 除外：它的 `ms` 是**时钟读数**，而重采样那一跑本来就该多记一发
      //   （账一个字没动 —— 票 55 的 Q7 照旧）
      if (f === "ledger.json") continue;
      const read = (h: ReturnType<typeof harness>) =>
        fs.readFileSync(path.join(h.outRoot, "wasteland", "run", "v1", f));
      expect(read(clean).equals(read(retried)), f).toBe(true);
    }
    // ⚠️ 而成功那一跑连失败现场都不该有 —— 不抛就**没有那个写入点**（这条判据是**结构性**成立的）
    expect(fs.readdirSync(retried.outRoot).filter((d) => d.startsWith(".failed-"))).toEqual([]);
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
    // ⚠️ 转型在**外面**：`build()` 正常那一路返回 `BuildResult`，`.catch` 的返回类型于是是
    //    `BuildResult | Error` —— 在 catch 里转型，`e.message` 仍会撞在 `BuildResult` 上（TS2339）。
    const e = (await build(h, u.run.dir).catch((x: unknown) => x)) as Error;
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

// ── 票 61 · 「玩家那件资源」这条链**端到端**走一遍 ────────────────────────────
//
// ⚠️ 这一节问的不是任何**单点**（那两处各有各的判据：`assets/tests/plan-assets-player-gate`
//   管清单、`contracts/tests/game-config` 管配置），问的是**这两点之间那条链真的接上了**：
//   清单那一头写下的三个名字，配置那一头**解得开**、而且解到**三个不同的**动画。
//   ⚠️ 分开断「清单对」与「配置对」是**不够的** —— 两边各自成立、中间对不上的形状是存在的
//   （配置写 `idle`/`run`/`jump`，而清单里那三路叫别的名字）。
describe("§票 61 · 玩家那条链**端到端**（清单 ⇒ 包 ⇒ 配置引用）", () => {
  it("阳性：`p-body` **一件**、三路齐备且各 ≥2 帧，而落盘的配置三格**互不相同**且都解得到", async () => {
    const h = harness();
    const u = await understand(h);
    const parsed = parseRecipe(readJson(runPath(h, "asset-recipe.json")));
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join("；")).toBe(true);
    if (!parsed.ok) return;
    // ① 清单那一头：**恰好一件**资源写着玩家 id（「一件资源带三路」那句话的两半都钉住）
    const mine = parsed.value.assets.filter((e) => e.spec.characterId === "p-scavenger");
    expect(mine).toHaveLength(1);
    const spec = mine[0]!.spec;
    expect(spec.kind).toBe("animation");
    if (spec.kind !== "animation") return;
    for (const n of PLAYER_ACTION_NAMES) {
      const a = spec.animations.find((x) => x.name === n);
      expect(a, `缺 ${n}`).toBeDefined();
      expect(a!.frames, `${n} 的帧数`).toBeGreaterThanOrEqual(2);
    }

    const b = await build(h, u.run.dir);
    // ② 配置那一头：三格**互不相同**（外壳按三个键各取一路）
    const cfg = readJson(runPath(h, "game-config.json")) as { player: { anims: Record<string, string> } };
    const slots = PLAYER_ACTION_NAMES.map((n) => cfg.player.anims[n]!);
    expect(new Set(slots).size, "三格必须指到三个不同的动画").toBe(PLAYER_ACTION_NAMES.length);
    // ③ 而**中间**那一环：这三格指向的名字，**逐个都在清单那件资源里** —— 链真的接上了
    for (const s of slots) expect(spec.animations.map((a) => a.name), `配置引用的 "${s}"`).toContain(s);
    expect(b.config.player.anims).toEqual(cfg.player.anims);
  });

  it("阴性：清单缺一路 ⇒ 链**死在理解段**、退 4，而 `pack/` 那一步**一步都没走**", async () => {
    const badRecipe = structuredClone(CANNED.recipe) as
      { assets: { spec: { characterId?: string; animations?: { name: string }[] } }[] };
    const p = badRecipe.assets.find((e) => e.spec.characterId === "p-scavenger")!;
    p.spec.animations = p.spec.animations!.filter((a) => a.name !== "jump");
    const h = harness({ override: { emit_asset_recipe: badRecipe } });
    const e = await understand(h).then((): unknown => undefined, (x: unknown) => x);
    expect(exitCodeOfError(e)).toBe(4);
    expect(String((e as Error).message)).toMatch(/"jump"/);
    // ⚠️ **一笔生图的钱都没花出去**：清单没过闸 ⇒ 构建段压根没被调用过（`pack/` 不存在）
    expect(fs.existsSync(path.join(h.outRoot, "wasteland", "pack"))).toBe(false);
    // ⚠️ 而失败现场照旧留着（R8）—— 里面没有 `asset-recipe.json`，因为那一份从来没成立过
    const sites = fs.readdirSync(h.outRoot).filter((d) => d.startsWith(".failed-"));
    expect(sites).toHaveLength(1);
    expect(fs.existsSync(path.join(h.outRoot, sites[0]!, "asset-recipe.json"))).toBe(false);
    expect(fs.existsSync(path.join(h.outRoot, sites[0]!, "game-design.json"))).toBe(true);
  });

  it("⚠️ **配方完全正确也拦不住**的那一档：配置三格填同一个名字 ⇒ 死在配置那一步，退 4", async () => {
    // ⚠️ 这一条是**本票的立案形状本身**：清单那一头挑不出任何毛病（三路齐备、名字正确、
    //   帧数够），坏的是**配置怎么引用它** —— 而配置契约从前逐格解引用、三格各自都解得到，
    //   于是一格都不报（`game-config.test.ts` 那条「三格全填同一个」的前身）。
    //   ⇒ 这一条钉的是**分层**：清单那一层管不了这件事，配置这一层必须管。
    const h = harness({ override: {
      emit_game_config: { ...CANNED.gameConfig, player: { ...(CANNED.gameConfig["player"] as object), anims: { idle: "idle", run: "idle", jump: "idle" } } },
    } });
    const u = await understand(h);
    // ① 先确认这一跑那份清单**本身是干净的**（不然这条判据会被上一条闸门顶掉、红得没意义）
    expect(parseRecipe(readJson(runPath(h, "asset-recipe.json"))).ok).toBe(true);
    const e = await build(h, u.run.dir).then((): unknown => undefined, (x: unknown) => x);
    expect(exitCodeOfError(e)).toBe(4);
    expect(String((e as Error).message)).toMatch(/player\.anims/);
    // ② 而配置**没有落盘** —— 不过验收的配置不该冒充产物（那正是「两把尺子」要避免的）
    expect(fs.existsSync(runPath(h, "game-config.json"))).toBe(false);
  });
});

// ── v3 视觉 QA 接口：inspect 观察进入 qa-report ───────────────────────────────
describe("§v3 视觉 QA 接口：free inspect 观察进 QA 报告", () => {
  const reportOf = (h: ReturnType<typeof harness>) => readJson(runPath(h, "qa-report.json")) as {
    observations: { source: string; outcome: string; lines?: string[]; reason?: string }[];
    checked: string[]; failures: unknown[];
  };

  it("成功：inspect ok（含源图/目标尺寸段），review unavailable；六判据与 qaVerdict 不变", async () => {
    const h = harness();
    const u = await understand(h);
    const b = await build(h, u.run.dir);
    expect(b.packVersion).toBe(1);
    const report = reportOf(h);
    const inspect = report.observations.find((o) => o.source === "inspect")!;
    expect(inspect.outcome).toBe("ok");
    expect(inspect.lines!.join("\n")).toMatch(/源图 \/ 目标尺寸/);
    expect(inspect.lines!.join("\n")).toMatch(/源图 .* → 目标 /);
    // v3 终端摘要：结构化数据同时交到 BuildResult（不落盘、不进报告）
    expect(b.inspectData).toBeDefined();
    expect(b.inspectData!.assets.length).toBe(4);
    expect(b.inspectData!.layerCoverage.length).toBe(1);       // drawlist 背景只有一帧
    expect(b.inspectData!.paletteUsage.offPalette.pixels).toBe(0);
    expect(report.observations.find((o) => o.source === "review")!.outcome).toBe("unavailable");
    expect(report.checked.sort()).toEqual(["constructive-constraint", "intent-coverage", "palette-binding", "reachability", "reference-resolution"]);
    expect(qaVerdict(report as never)).toBe("incomplete");
  });

  it("inspect 抛错：unavailable + build 继续；六判据与 qaVerdict 不变；reason 不带路径", async () => {
    const h = harness();
    const u = await understand(h);
    const b = await build(h, u.run.dir, { inspect: () => { throw new Error("boom /private/secret/path"); } });
    expect(b.packVersion).toBe(1);
    const report = reportOf(h);
    const inspect = report.observations.find((o) => o.source === "inspect")!;
    expect(inspect.outcome).toBe("unavailable");
    expect(inspect.reason).toMatch(/inspect 未能完成/);
    expect(inspect.reason).not.toContain("/private/secret/path");
    expect(inspect.lines).toBeUndefined();
    expect(b.inspectData).toBeUndefined();                     // 抛错 ⇒ 没有结构化数据
    expect(report.checked).toHaveLength(5);
    expect(qaVerdict(report as never)).toBe("incomplete");
  });
});
