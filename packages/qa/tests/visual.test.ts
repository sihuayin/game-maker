// 票 17 的判据：**两条可达的判据**，以及「其余四条为什么不在」。
//
// ⚠️ 这一份用的全是**真产物**（`fixtures/` 里那份 v2 包 + 它的清单），而不是手搓的小对象 ——
//   票面 Q7 要的就是这个：**真 fixture + 故意损坏**，用来证明判据**真的会响**。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { QaContext, QaFamilyResult } from "@game-maker/contracts";
import { visualQaRunner } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const RECIPE = path.join(ROOT, "fixtures/recipes/last-train.json");

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

/** 一次「运行目录 + 包目录」的现场。⚠️ 它把 fixture **拷**出来 —— 损坏那几条不能动真 fixture。 */
function stage(): QaContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gm-qa-"));
  dirs.push(dir);
  const runDir = path.join(dir, "run");
  const packDir = path.join(dir, "pack");
  fs.mkdirSync(runDir, { recursive: true });
  fs.cpSync(PACK, packDir, { recursive: true });
  fs.copyFileSync(RECIPE, path.join(runDir, "asset-recipe.json"));
  return { runDir, packDir, configPath: path.join(runDir, "game-config.json"), gameId: "last-train" };
}
const manifestPath = (ctx: QaContext) => path.join(ctx.packDir, "manifest.json");
const load = (ctx: QaContext) => JSON.parse(fs.readFileSync(manifestPath(ctx), "utf8"));
const patch = (ctx: QaContext, f: (m: ReturnType<typeof load>) => void): void => {
  const m = load(ctx);
  f(m);
  fs.writeFileSync(manifestPath(ctx), JSON.stringify(m, null, 2) + "\n");
};
const run = (ctx: QaContext): Promise<QaFamilyResult> => visualQaRunner(ctx);

/** ⚠️ **测试自己的**摊平小工具：把族结果铺成「带判据名的一列失败」。
 *  真正的投影（`checked` / `failures` 那份报告）归**票 20** 的合成器 —— 这里不替它做。 */
const flat = (r: QaFamilyResult) => Object.entries(r.judgements)
  .flatMap(([j, res]) => (res.ran ? res.findings.map((f) => ({ ...f, judgement: j })) : []));
const keys = (r: QaFamilyResult) => Object.keys(r.judgements).sort();
type AnyManifest = { assets: { id: string; size: { w: number; h: number }; paletteBinding: string }[]; palette: { size: number; ref: string; coverage: { exact: number } } };

describe("§干净的真包：两条判据都跑、都没有怨言", () => {
  it("⚠️ **只声明自己那两条** —— 另外四条**缺席**，不是 `ran:false`（票 18 的 R3-Q1：缺席 = 不归我）", async () => {
    const r = await run(stage());
    expect(keys(r)).toEqual(["constructive-constraint", "palette-binding"]);
    expect(flat(r)).toEqual([]);
  });

  it("⚠️ **观察那一栏是空的** —— 不是 `unavailable`（那说的是「我去拿了、没拿到」）", async () => {
    expect((await run(stage())).observations).toEqual([]);
  });

  // ⚠️ 票 17 在这里还断过两件事，**都跟着出口改成族结果搬走了**：
  //   · 「裁决是 `incomplete`」—— `qaVerdict` 吃的是**整份报告**，而凑成报告的是票 20；
  //   · 「`format` 是契约那份」—— 族结果里没有 `format`，那是报告的字段。
});

describe("§故意损坏 ①：构造性约束**真的会响**", () => {
  it("把包里一个资产的**尺寸**改掉 ⇒ 一条 `error`，而 `target` 是那个资源的 id（账的词汇）", async () => {
    const ctx = stage();
    patch(ctx, (m) => {
      const a = (m as unknown as AnyManifest).assets.find((x) => x.id === "player-traveler")!;
      a.size = { w: a.size.w + 1, h: a.size.h };
    });
    const all = flat(await run(ctx));
    expect(all).toHaveLength(1);
    const f = all[0]!;
    expect(f.judgement).toBe("constructive-constraint");
    expect(f.target).toBe("player-traveler");
    expect(f.severity).toBe("error");
    expect(f.detail).toMatch(/尺寸对不上/);
  });

  it("⚠️ 改**清单**（spec 说要 3 帧、产物只有 2 帧）⇒ 也响 —— 这条只有 spec ↔ 产物对账看得见", async () => {
    const ctx = stage();
    // ⚠️ 走**清单**那一侧：改 manifest 的 frames 会先被**包契约**拒掉（帧必须归组），
    //   而那一条的落点不是 QA —— 所以这里改的是运行目录里那份 spec。
    const recipePath = path.join(ctx.runDir, "asset-recipe.json");
    const recipe = JSON.parse(fs.readFileSync(recipePath, "utf8")) as { assets: { spec: { id: string; animations?: { name: string; frames: number }[] } }[] };
    const spec = recipe.assets.find((a) => a.spec.id === "player-traveler")!.spec;
    spec.animations = spec.animations?.map((an, i) => (i === 0 ? { ...an, frames: an.frames + 1 } : an));
    fs.writeFileSync(recipePath, JSON.stringify(recipe, null, 2) + "\n");
    expect(flat(await run(ctx)).some((f) => f.judgement === "constructive-constraint" && /帧/.test(f.detail))).toBe(true);
  });
});

describe("§故意损坏 ①'：清单里有、包里没有", () => {
  it("⚠️ 清单里**加了一个**、包里没做 ⇒ 报「没被做出来」，而 target 是它的 id", async () => {
    const ctx = stage();
    // ⚠️ 走**清单**那一侧（删包里的资产会被**包契约**先挡住：图集声称包含不存在的资源）——
    //   而「人改过清单、包还是旧的」正是票 16 那条路会有的形状 ✓
    const recipePath = path.join(ctx.runDir, "asset-recipe.json");
    const recipe = JSON.parse(fs.readFileSync(recipePath, "utf8")) as { assets: { spec: { id: string }; source: unknown }[] };
    recipe.assets.push({ ...recipe.assets[0]!, spec: { ...recipe.assets[0]!.spec, id: "prop-人加的箱子" } });
    fs.writeFileSync(recipePath, JSON.stringify(recipe, null, 2) + "\n");
    const f = flat(await run(ctx)).find((x) => x.target === "prop-人加的箱子")!;
    expect(f.judgement).toBe("constructive-constraint");
    expect(f.severity).toBe("error");          // ⚠️ 「没做出来」不是「也许吧」—— 它得阻断
    expect(f.detail).toMatch(/没被做出来/);
  });

  it("⚠️ 创作态那份 drawlist 的 `viewBox` 被改坏 ⇒ 也响（那是**唯一**能看见创作态↔交付态那条线的地方）", async () => {
    const ctx = stage();
    const m = load(ctx) as unknown as { assets: { id: string; authoring: { kind: string; ref: string }[] }[] };
    const ref = m.assets.find((x) => x.id === "player-traveler")!.authoring.find((x) => x.kind === "drawlist")!.ref;
    const dlPath = path.join(ctx.packDir, ref);
    const dl = JSON.parse(fs.readFileSync(dlPath, "utf8")) as { viewBox: number[] };
    dl.viewBox = [0, 0, dl.viewBox[2]! + 1, dl.viewBox[3]!];
    fs.writeFileSync(dlPath, JSON.stringify(dl, null, 2) + "\n");
    expect(flat(await run(ctx)).some((f) => f.judgement === "constructive-constraint" && /viewBox/.test(f.detail))).toBe(true);
  });
});

describe("§响了就是 **`error`**（那一档才是让裁决**阻断**的东西）", () => {
  it("⚠️ 判据说「错」的时候一律 `severity: \"error\"` —— 降成 `warning` 就悄悄不阻断了", async () => {
    const ctx = stage();
    patch(ctx, (m) => { (m as unknown as AnyManifest).palette.coverage.exact += 1; });
    // ⚠️ 「有 `error` ⇒ `fail`」那句归票 20（只有它拿得到整份报告）—— 这里只钉 severity。
    expect(flat(await run(ctx)).every((f) => f.severity === "error")).toBe(true);
  });
});

describe("§故意损坏 ②：色板绑定**真的会响**", () => {
  it("把包级那四个数里的一个改掉 ⇒ 一条 `error`，而 `target` 是 `recipe`（它不是某个资产的事）", async () => {
    const ctx = stage();
    patch(ctx, (m) => { (m as unknown as AnyManifest).palette.coverage.exact += 1; });
    const all = flat(await run(ctx));
    expect(all).toHaveLength(1);
    const f = all[0]!;
    expect(f.judgement).toBe("palette-binding");
    expect(f.target).toBe("recipe");
    expect(f.detail).toMatch(/说的是同一件事/);
  });

  it("⚠️ 反过来改**条目**上那个值也一样响 —— 两处说的是同一件事，改哪边都听得见", async () => {
    const ctx = stage();
    patch(ctx, (m) => {
      (m as unknown as AnyManifest).assets.find((x) => x.id === "player-traveler")!.paletteBinding = "quantized";
    });
    expect(flat(await run(ctx)).some((f) => f.judgement === "palette-binding" && /quantized/.test(f.detail))).toBe(true);
  });

  it("把 `palette.ref` 指到 `files[]` 之外 ⇒ 也响（那份色板因此**在 checksum 覆盖之外**）", async () => {
    const ctx = stage();
    patch(ctx, (m) => { (m as unknown as AnyManifest & { palette: { ref: string } }).palette.ref = "authoring/不存在的色板.json"; });
    expect(flat(await run(ctx)).some((f) => f.judgement === "palette-binding" && /checksum/.test(f.detail))).toBe(true);
  });

  it("⚠️ 而 `palette.size == values.length` **不是这里的判据** —— 那是包契约自己的 superRefine 守住的", async () => {
    const ctx = stage();
    patch(ctx, (m) => { (m as unknown as AnyManifest).palette.size += 1; });
    // 先炸的是**契约**（`parseAssetPack` 先跑）⇒ 一条永远轮不到 QA 的检查，写它没有意义
    await expect(run(ctx)).rejects.toThrowError(/palette.size/);
  });
});

describe("§边界：本包**够不着**的东西，一条都不碰", () => {
  it("没有 `layer-coverage` —— 它的规则住装配期（那儿已经硬失败）", async () => {
    expect(keys(await run(stage()))).not.toContain("layer-coverage");
  });

  it("⚠️ 也**没有**玩法那两条（它们归 `gameplay.ts`）与意图那一条（票 19 还没落地）", async () => {
    const c = keys(await run(stage()));
    for (const j of ["reference-resolution", "reachability", "intent-coverage"]) expect(c).not.toContain(j);
  });

  it("⚠️ 塞一份坏清单 ⇒ **抛**（那是调用方的输入，不是一条判据的失败）", async () => {
    const ctx = stage();
    fs.writeFileSync(path.join(ctx.runDir, "asset-recipe.json"), "{ 不是 JSON }");
    await expect(run(ctx)).rejects.toThrowError(/清单读不出来/);
  });
});
