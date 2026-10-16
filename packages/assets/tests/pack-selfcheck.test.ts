import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { exitCodeOfError, parseRecipe, type AssetRecipe, type AssetSpec, type DrawList, type StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, type DrawListGenerator } from "../src/index.js";

/**
 * 票 46 · 制造端自校验的判据。
 *
 * ⚠️ **为什么单起一个文件**：`pack.test.ts` 里那三处 `parseAssetPack` 是**测试自己**在调它，
 *   验的是「测试预言的那个形状对不对」——**不是**「生产路径会不会拦住」。
 *   本文件问的是后者：驱动生产的 `buildAssetPack`，看**它**会不会把非法产物提交出去。
 *
 * ⚠️ **不需要测试缝**：那条路本来就通（票 46 的探针 A，现场在
 *   `experiments/46-self-validation-probe/`）—— 一个分层背景、两层同名即可。
 *   ⚠️ **2026-10-14（票 58）之后手工构造它成了必需**：`parseRecipe` 已经会拒这份配方，
 *   所以要撞的**只能**是生产函数里那道自校验 —— 于是这份输入由测试**直接**喂进去。
 */

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const RECIPE: AssetRecipe = JSON.parse(readFileSync(ROOT + "fixtures/recipes/shift-change.json", "utf8"));
const STYLE: StyleSpec = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const EPOCH = 1790208000;   // 固定 epoch ⇒ createdAt 可复现

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "selfcheck-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const stub: DrawListGenerator = (spec: AssetSpec) => {
  const n = spec.kind === "animation" ? spec.animations.reduce((s, a) => s + a.frames, 0)
    : spec.kind === "background" && spec.layers ? spec.layers.length : 1;
  return Array.from({ length: n }, (_, i) => ({
    format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
    viewBox: [0, 0, spec.size.w, spec.size.h], expectedSize: [spec.size.w, spec.size.h],
    ops: [
      { op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: `palette:${i % 5}` },
      { op: "rect", x: 1, y: 1, w: Math.max(1, spec.size.w - 2), h: 2, fill: "palette:1" },
    ] as DrawList["ops"],
  }));
};

/**
 * 票 46 探针 A 的那份配方：分层背景里**两层同名**。
 * ⚠️ **2026-10-14（票 58）之后它的意义变了**：创作侧那条判据
 *   （`AssetSpecSchema.superRefine` 的 union 层）已经补上，所以 **`parseRecipe` 现在会拒它**。
 *   ⇒ 本文件**故意不走** `parseRecipe`：它把这份配方**直接喂给生产函数**，
 *   问的是「**票 46 那道交付侧自校验还在不在**」。
 *   ⚠️ 两者治的**不是同一层**（票 46 的 Q6 原话）：契约收紧是在**花费之前**拒绝已知非法输入，
 *   自校验是**离开进程之前**的最后一道、兜的是**任何一条**。⇒ 前者补上**不等于**后者多余。
 */
const dupLayerRecipe = (): AssetRecipe => {
  const r: AssetRecipe = JSON.parse(JSON.stringify(RECIPE));
  const bg = r.assets.find((a) => a.spec.kind === "background")!;
  (bg.spec as { layers?: unknown }).layers = [
    { name: "far", parallax: 0.2 },
    { name: "far", parallax: 0.5 },
  ];
  return { ...r, assets: r.assets.filter((a) => a.spec.id === bg.spec.id) };
};

const smallRecipe = (): AssetRecipe => ({ ...RECIPE, assets: RECIPE.assets.slice(0, 3) });

describe("票 46 · 非法产物不许被当作成功产物交付", () => {
  it("阳性：分层背景两层同名 ⇒ 生产函数抛，且**不提交**成包；失败现场留着那份违约 manifest", async () => {
    const out = tmp();
    const recipe = dupLayerRecipe();

    // ⚠️ **两道闸的层次**（票 58 补上前一道之后，这一句才为真）：
    const front = parseRecipe(recipe);
    expect(front.ok, "入口那道**现在也**拒它（票 58 补的创作侧判据）").toBe(false);
    if (!front.ok) expect(front.errors.join()).toMatch(/层名重复/);
    // 而下面故意**绕过**入口 —— 撞的是**生产函数里**那道自校验（这才是本文件问的问题）。

    let err: unknown;
    try {
      await buildAssetPack({ recipe, style: STYLE, outDir: out, recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    } catch (e) { err = e; }

    // ① 拒绝，且出口是「业务/契约不过」那一档（退出码 4）
    expect(err, "必须抛 —— 这正是本票要的那条闸").toBeInstanceOf(Error);
    expect(exitCodeOfError(err)).toBe(4);

    // ② 报错**点名到字段与原因**（人裁 Q3 的边界：不许只报笼统的「校验失败」）
    const msg = String((err as Error).message);
    expect(msg).toMatch(/层名重复/);
    expect(msg).toMatch(/assets\[0\]\.layers/);

    // ③ 正式版本目录**根本没出现** —— 非法产物没机会变成一份包
    const gameDir = path.join(out, recipe.id);
    expect(existsSync(path.join(gameDir, "pack")), "pack/ 不许出现").toBe(false);

    // ④ 失败现场留着，且那份违约 manifest **在里面可看**（人裁 Q2：不删除现场、不消耗版本号）
    const sites = readdirSync(gameDir).filter((d) => d.startsWith("failed-"));
    expect(sites.length).toBe(1);
    const site = path.join(gameDir, sites[0]!);
    const kept = JSON.parse(readFileSync(path.join(site, "manifest.json"), "utf8"));
    expect(kept.assets[0].layers.map((l: { name: string }) => l.name)).toEqual(["far", "far"]);
  }, 120_000);

  it("阴性：合法包照常提交，且自校验对产物**一个字没动**（逐字节）", async () => {
    const a = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    const b = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });

    // 照常提交（`packDir` 就是 `pack/v<N>/`）
    expect(existsSync(path.join(a.packDir, "manifest.json"))).toBe(true);
    expect(a.packDir).toMatch(/\/pack\/v\d+$/);

    // 「产物字节不变」两重：① 盘上那份 == 生产者手上那份序列化的结果（自校验读而不写）
    //                       ② 同输入两次跑出**同一份字节**（可复现）
    const bytesOf = (p: string) => readFileSync(path.join(p, "manifest.json"), "utf8");
    expect(bytesOf(a.packDir)).toBe(JSON.stringify(a.manifest, null, 2) + "\n");
    expect(bytesOf(a.packDir)).toBe(bytesOf(b.packDir));
    expect(a.audit).toEqual([]);
  }, 120_000);
});

/**
 * 票 89 · **动画名重复** —— 而这一份走的是 `import`。
 *
 * ⚠️ **为什么不能拿分层背景那条现成形状来试**：那条（`dupLayerRecipe`）靠的是
 *   「帧名由层名派生」⇒ 两层同名**必然**撞帧名。动画名在 `drawlist` / `image` 上同款；
 *   ⚠️ 而 `import` 那条进路的帧名是**配方自己写的**（`src.sheet.names`），**不由动画名派生**
 *   ⇒ 探针 ③ 真跑出来的那份产物**帧名两两不同**，于是「帧名重复」一个字都不响、
 *   而它当时**过了交付侧契约**（票 79 的立案读数，现场 `experiments/79-anim-name-dup/`）。
 *   ⇒ 本文件这一组问的正是那半边：**今天是「过了」，补上之后应当「抛」**。
 */
describe("票 89 · 动画名重复走 `import` 那条进路：产物过不了交付侧契约", () => {
  /**
   * 一份 `import` 配方，两条同名动画 —— 而 `sheet.names` 是**四个互不相同的帧名**。
   * ⚠️ 帧名与动画名**都不是派生的**（这正是 `import` 那条进路与另外两条的分野）。
   */
  const dupAnimRecipe = (): AssetRecipe => ({
    format: "asset-recipe/v1",
    id: "t89-anim-dup",
    styleRef: "authoring/stylespec.json",
    assets: [{
      spec: {
        kind: "animation", id: "hero", role: "玩家角色", description: "一个两帧待机的角色",
        styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size: { w: 256, h: 256 }, required: true,
        animations: [{ name: "idle", frames: 2, loop: true }, { name: "idle", frames: 2, loop: true }],
      },
      source: {
        kind: "import", ref: "fixtures/import/wan-player-1024.png", background: { tolerance: 30 },
        sheet: {
          columns: 4, rows: 1, frameWidth: 256, frameHeight: 256,
          names: ["hero.a", "hero.b", "hero.c", "hero.d"],
          animations: [{ name: "idle", frames: ["hero.a", "hero.b"] }, { name: "idle", frames: ["hero.c", "hero.d"] }],
        },
      },
    }],
  });

  /** 同一份配方的**阴性对照**：只把两条动画名（与 sheet 的分组名）改成两两不同。 */
  const okAnimRecipe = (): AssetRecipe => {
    const r = dupAnimRecipe();
    const spec = r.assets[0]!.spec as unknown as { animations: { name: string; frames: number; loop: boolean }[] };
    spec.animations = [{ name: "idle", frames: 2, loop: true }, { name: "walk", frames: 2, loop: true }];
    const src = r.assets[0]!.source as unknown as { sheet: { animations: { name: string; frames: string[] }[] } };
    src.sheet.animations = [{ name: "idle", frames: ["hero.a", "hero.b"] }, { name: "walk", frames: ["hero.c", "hero.d"] }];
    return r;
  };

  it("阳性：两条同名 ⇒ 生产函数抛（退 4）· `pack/` 不出现 · 失败现场里那份违约 manifest 可看", async () => {
    const out = tmp();
    const recipe = dupAnimRecipe();

    // ⚠️ **两道闸的层次**（与上面那一组同款）：入口那道**现在也**拒它（票 89 的创作侧判据）。
    const front = parseRecipe(recipe);
    expect(front.ok, "入口那道**现在也**拒它（票 89 补的创作侧判据）").toBe(false);
    if (!front.ok) expect(front.errors.join()).toMatch(/动画名重复/);
    // 而下面故意**绕过**入口 —— 撞的是**生产函数里**那道自校验（这才是本文件问的问题）。

    let err: unknown;
    try {
      await buildAssetPack({ recipe, style: STYLE, outDir: out, recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    } catch (e) { err = e; }

    expect(err, "必须抛 —— 这正是票 89 补上的那半边").toBeInstanceOf(Error);
    expect(exitCodeOfError(err)).toBe(4);
    // ② 报错**点名到字段与原因** —— 而且说的是**动画名**，不是被它连累的帧名
    const msg = String((err as Error).message);
    expect(msg).toMatch(/动画名重复/);
    expect(msg).toMatch(/assets\[0\]\.animations/);

    // ③ 正式版本目录**根本没出现**
    const gameDir = path.join(out, recipe.id);
    expect(existsSync(path.join(gameDir, "pack")), "pack/ 不许出现").toBe(false);

    // ④ 失败现场留着，而那份违约 manifest 里**两条同名动画都还在**（可追溯它到底写了几条）
    const sites = readdirSync(gameDir).filter((d) => d.startsWith("failed-"));
    expect(sites.length).toBe(1);
    const kept = JSON.parse(readFileSync(path.join(gameDir, sites[0]!, "manifest.json"), "utf8"));
    expect(kept.assets[0].animations.map((a: { name: string }) => a.name)).toEqual(["idle", "idle"]);
    // ⚠️ 而帧名**确实是两两不同**的 —— 这条断言把这个用例与上面那一组**分开**：
    //   它证明了「帧名重复」那条判据在这里**一个字都不响**，拦住它的是新加的那一条。
    expect(new Set(kept.assets[0].frames.map((f: { name: string }) => f.name)).size).toBe(4);
  }, 120_000);

  it("阴性：同一份配方、动画名两两不同 ⇒ 照常提交、对账为空（新的那条不误杀 `import`）", async () => {
    const r = await buildAssetPack({
      recipe: okAnimRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH,
    });
    expect(r.packDir).toMatch(/\/pack\/v\d+$/);
    expect(r.manifest.assets[0]!.animations!.map((a) => a.name)).toEqual(["idle", "walk"]);
    // 两条动画各自拿到的帧**是分开的**（同名那两份会合体 —— 那正是票 89 量到的后果）
    expect(r.manifest.assets[0]!.animations!.map((a) => a.frames)).toEqual([["hero.a", "hero.b"], ["hero.c", "hero.d"]]);
    expect(r.audit).toEqual([]);
  }, 120_000);
});
