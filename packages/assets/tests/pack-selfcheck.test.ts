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
