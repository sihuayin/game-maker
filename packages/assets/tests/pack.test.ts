import { copyFileSync, mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { parseAssetPack, type AssetSpec, type AssetRecipe, type DrawList, type StyleSpec } from "@game-maker/contracts";
import { decodePNG } from "../src/png.js";
import {
  buildAssetPack, keyColorFor, nextPackVersion, verifyPack,
  type DrawListGenerator, type GenerateImage, type RasterImage,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const RECIPE: AssetRecipe = JSON.parse(readFileSync(ROOT + "fixtures/recipes/shift-change.json", "utf8"));
const STYLE: StyleSpec = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const EPOCH = 1790208000;   // 固定 epoch ⇒ createdAt 可复现

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "pack-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/**
 * **桩生成器**：确定性地按 spec 画几张色块。真生成器是票 22 的事 ——
 * 组装的可测试性正来自「生成器是注入的」这个设计。
 */
/** 纯函数版本 —— 端口返回的是 `DrawList[] | Promise<DrawList[]>`，取用时要分开。 */
const stubDrawLists = (spec: AssetSpec): DrawList[] => {
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
const stub: DrawListGenerator = (spec) => stubDrawLists(spec);

/** 只留前三项，测试跑得快些（真实清单有 8 个资源）。 */
const smallRecipe = (): AssetRecipe => ({ ...RECIPE, assets: RECIPE.assets.slice(0, 3) });

describe("组装出一个完整的包", () => {
  it("目录结构、manifest 过 schema、对账为空", async () => {
    const { manifest, packDir, audit } = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    const parsed = parseAssetPack(manifest);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join(" / ")).toBe(true);
    expect(audit).toEqual([]);

    expect(existsSync(path.join(packDir, "manifest.json"))).toBe(true);
    for (const a of manifest.atlases) {
      expect(existsSync(path.join(packDir, a.meta)), a.meta).toBe(true);
      expect(existsSync(path.join(packDir, a.image)), a.image).toBe(true);
    }
    expect(existsSync(path.join(packDir, "authoring/stylespec.json"))).toBe(true);
    expect(manifest.assets.every((a) => existsSync(path.join(packDir, a.authoring[0]!.ref)))).toBe(true);
  });

  it("files[] **覆盖包内每一个文件**（checksum 才谈得上完整）", async () => {
    const { manifest, packDir } = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    const walk = (dir: string, base = ""): string[] => readdirSync(dir, { withFileTypes: true })
      .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]));
    const onDisk = walk(packDir).filter((p) => p !== "manifest.json").sort();
    expect(manifest.files.map((f) => f.path)).toEqual(onDisk);
    for (const f of manifest.files) expect(f.bytes).toBe(readFileSync(path.join(packDir, f.path)).length);
  });

  it("确定性：同一 epoch 两次构建逐字节相同（连 PNG 也一样）", async () => {
    const a = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    const b = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    expect(a.manifest.files).toEqual(b.manifest.files);         // 含逐文件 checksum
    expect(JSON.stringify(a.manifest)).toBe(JSON.stringify(b.manifest));
  });

  it("⚠️ 绝不覆盖：同一个 outDir 再跑一次落在 v2，v1 还在", async () => {
    const out = tmp();
    const a = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: out, recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    const b = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: out, recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    expect(a.manifest.version).toBe(1);
    expect(b.manifest.version).toBe(2);
    expect(existsSync(a.packDir)).toBe(true);
    expect(existsSync(b.packDir)).toBe(true);
    expect(nextPackVersion(out, smallRecipe().id)).toBe(3);
  });

  it("provenance.mode 由来源派生；覆盖计数自洽", async () => {
    const { manifest } = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    expect(manifest.provenance.mode).toBe("generated");
    const cov = manifest.palette.coverage;
    expect(cov.unbound).toBe(0);   // 这条管线产不出 unbound
    expect(cov.exact + cov.composited + cov.quantized).toBe(manifest.assets.length);
  });

  it("色板被规范化进包（大写 → 小写）", async () => {
    expect(STYLE.palette.some((c) => /[A-F]/.test(c))).toBe(true);   // 输入的实测色板是大写
    const { packDir } = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    const inPack = JSON.parse(readFileSync(path.join(packDir, "authoring/stylespec.json"), "utf8"));
    expect(inPack.palette.every((c: string) => c === c.toLowerCase())).toBe(true);
  });

  it("生成器给的帧数与清单对不上 → 报出来，不静默裁剪", async () => {
    const short: DrawListGenerator = (spec) => stubDrawLists(spec).slice(0, 1);
    await expect(buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: short, sourceDateEpoch: EPOCH }))
      .rejects.toThrow(/清单说要有 \d+ 帧，生成器给了 1 帧/);
  });

  it("色板有重复色 → 直接失败（palette:N 会变得含糊）", async () => {
    const bad = { ...STYLE, palette: [STYLE.palette[0]!, STYLE.palette[0]!] };
    await expect(buildAssetPack({ recipe: smallRecipe(), style: bad, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH }))
      .rejects.toThrow(/重复色/);
  });
});

describe("导入通道端到端（真实素材）", () => {
  it("一张真实位图走完：解码 → 抠背景 → 降采样 → 量化 → 进包", async () => {
    const recipe: AssetRecipe = {
      ...RECIPE,
      assets: [{
        spec: { kind: "background", id: "shop_interior", role: "scene-backdrop", description: "商店内景", styleId: "style-ref",
          anchor: { x: 0, y: 0 }, size: { w: 320, h: 180 }, required: true },
        source: { kind: "import", ref: "fixtures/reference/test.png", background: { tolerance: 30 } },
      }],
    };
    const { manifest, packDir, audit } = await buildAssetPack({ recipe, style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    const a = manifest.assets[0]!;
    expect(a.origin).toBe("imported");
    expect(a.paletteBinding).toBe("quantized");
    expect(a.size).toEqual({ w: 320, h: 180 });
    expect(a.atlasId).toBe("backgrounds");
    expect(a.authoring[0]!.kind).toBe("bitmap");
    expect(audit).toEqual([]);
    expect(existsSync(path.join(packDir, a.authoring[0]!.ref))).toBe(true);
  });
});

/**
 * 下面两条守的是 2026-09-25 从「纯导入的包」上抓到的两个真 bug。
 * 它们此前没暴露，是因为仓库里的包要么全是 `generate`，要么导入资源的 `ref`
 * 恰好写成了 cwd 相对才碰巧能跑。
 */
describe("⚠️ 纯导入的包（2026-09-25 抓到的两个 bug）", () => {
  /** 图片放在一个**和 cwd 无关**的临时目录里，`ref` 只写文件名。 */
  const imported = (dir: string): AssetRecipe => {
    copyFileSync(ROOT + "fixtures/import/wan-player-1024.png", path.join(dir, "art.png"));
    return {
      ...RECIPE,
      assets: [{
        spec: { kind: "sprite", id: "imported-crate", role: "obstacle", description: "从位图导入的木箱", styleId: "style-ref",
          anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true },
        source: { kind: "import", ref: "art.png", background: { tolerance: 30 } },
      }],
    };
  };
  const build = async () => {
    const dir = tmp();
    const { manifest } = await buildAssetPack({
      recipe: imported(dir), style: STYLE, outDir: tmp(), recipeDir: dir, generate: stub, sourceDateEpoch: EPOCH,
    });
    return manifest;
  };

  it("① source.ref 相对**配方文件**解析（契约 InputPath 的规则），不是相对 cwd", async () => {
    // 旧实现是 `path.resolve(src.ref)`（= 相对 cwd）⇒ 这里会 ENOENT
    const m = await build();
    expect(m.assets[0]!.origin).toBe("imported");
    // `original` 记**清单里的原样字符串**：记绝对路径会让 manifest 随机器与目录变，
    // 而「同一输入两次生成逐字节相同」是 checksum 成立的前提
    expect(m.assets[0]!.authoring[0]!.original).toBe("art.png");
  });

  it('③ provenance.mode 是 "imported"，不是 "mixed"（此前契约里根本没有这个值）', async () => {
    const m = await build();
    expect(m.provenance.mode).toBe("imported");
    // 写入侧（pack.ts）与校验侧（contracts）必须用同一套派生规则，否则合法的包会被判成矛盾
    const parsed = parseAssetPack(m);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join(" / ")).toBe(true);
  });
});

/**
 * 这两条守的是票 42 的两个发现：
 * ① **分层背景当时既产不出来、也过不了对账** —— `framePlan()` 对非 animation 恒定只给一帧，
 *    而 `auditAssetSpec()` 有一条「非 animation 不该有多帧」。两处各堵一头。
 * ② **`UiSpec.ninePatch` → 交付态图集 `scale9Borders` 这条连线从没被走过**（零 ui 资源），
 *    而 manifest 上那个同名字段当时**声明了却从没被写入**。
 */
describe("分层背景与九宫格：两条从配方到交付态的连线（票 42）", () => {
  const recipe = (): AssetRecipe => ({
    ...RECIPE,
    assets: [
      { spec: {
          kind: "background", id: "station", role: "backdrop", description: "黄昏站台，三层",
          styleId: "style-ref", anchor: { x: 0, y: 0 }, size: { w: 320, h: 180 },
          required: true,
          layers: [
            { name: "sky", parallax: 0 },
            { name: "wall", parallax: 0.5, tileable: { x: true, y: false } },
            { name: "ground", parallax: 1, tileable: { x: true, y: false } },
          ],
        }, source: { kind: "drawlist" } },
      { spec: {
          kind: "ui", id: "hud", role: "hud-panel", description: "HUD 面板",
          styleId: "style-ref", anchor: { x: 0, y: 0 }, size: { w: 48, h: 32 },
          required: true,
          ninePatch: { left: 4, right: 4, top: 4, bottom: 4 },
        }, source: { kind: "drawlist" } },
    ],
  });

  it("三层背景：一层一帧、帧名带层名、层表进 manifest、图集里三帧都在", async () => {
    const { manifest, packDir, audit } = await buildAssetPack({ recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    expect(audit).toEqual([]);
    const parsed = parseAssetPack(manifest);
    expect(parsed.ok, parsed.ok ? "" : parsed.errors.join(" / ")).toBe(true);

    const bg = manifest.assets.find((a) => a.id === "station")!;
    expect(bg.frames.map((f) => f.name)).toEqual(["station.sky", "station.wall", "station.ground"]);
    expect(bg.layers?.map((l) => l.name)).toEqual(["sky", "wall", "ground"]);
    expect(bg.layers?.[1]!.parallax).toBe(0.5);
    expect(bg.layers?.[1]!.tileable).toEqual({ x: true, y: false });
    // 天空那一层**没有** tileable —— 资源级的一个布尔表达不了这件事，这正是它下沉到层的原因
    expect(bg.layers?.[0]!.tileable).toBeUndefined();

    const atlas = JSON.parse(readFileSync(path.join(packDir, "delivery/atlas.backgrounds.json"), "utf8"));
    expect(Object.keys(atlas.frames).sort()).toEqual(["station.ground", "station.sky", "station.wall"]);

    // 试件真的过 verify（不是只过 schema）—— checksum 与 files[] 都对得上才算数
    expect(verifyPack({ packDir }).data.ok).toBe(true);
  });

  it("九宫格：UiSpec.ninePatch 一路走到图集与 manifest 的 scale9Borders", async () => {
    const { manifest, packDir, audit } = await buildAssetPack({ recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: EPOCH });
    expect(audit).toEqual([]);
    const want = { x: 4, y: 4, w: 40, h: 24 };   // 48-4-4 × 32-4-4

    const ui = manifest.assets.find((a) => a.id === "hud")!;
    expect(ui.scale9Borders).toEqual(want);

    const atlas = JSON.parse(readFileSync(path.join(packDir, "delivery/atlas.ui.json"), "utf8"));
    expect(atlas.frames["hud"].scale9Borders).toEqual(want);

    expect(verifyPack({ packDir }).data.ok).toBe(true);
  });
});

/**
 * 票 43：**生图路线支持分层背景**。
 *
 * ⚠️ 这条路以前**根本走不通**（票 40 撞到的）：生图支对非 animation 只出**一张图**，
 *   而分层背景的 `plan` 有 N 项 ⇒ `results[i]` 越界成 `undefined`，
 *   一路带到 `buildAtlas` 才炸成一个**说不清是哪里错的** TypeError。
 */
describe("生图路线的分层背景：一层一次调用（票 43）", () => {
  const LAYERS = [
    { name: "sky", parallax: 0 },
    { name: "wall", parallax: 0.5, tileable: { x: true, y: false } },
    { name: "ground", parallax: 1, tileable: { x: true, y: false } },
  ];
  const recipe = (): AssetRecipe => ({
    // ⚠️ 去掉 `shift-change.json` 带的 `referenceImage`：它的相对路径是相对**那个配方自己**的目录，
    //   而这里 `recipeDir` 传的是仓库根；再说本用例要的是「不喂风格参考图」这条最朴素的形态。
    ...RECIPE, referenceImage: undefined,
    assets: [{
      spec: {
        kind: "background", id: "station", role: "backdrop", description: "黄昏站台，三层",
        styleId: "style-ref", anchor: { x: 0, y: 0 }, size: { w: 96, h: 64 },
        required: true, layers: LAYERS,
      },
      source: { kind: "image", background: { tolerance: 0 } },
    }],
  });

  const px = (hex: string): [number, number, number] =>
    [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  /** 一张「中间有东西、四周是抠底色」的图 —— 与真生图模型的产出同构。 */
  const layerImage = (w: number, h: number, fill: string): RasterImage => {
    const data = Buffer.alloc(w * h * 4);
    const k = px(keyColorFor(STYLE.palette)), f = px(fill);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const inner = x >= w * 0.25 && x < w * 0.75 && y >= h * 0.25 && y < h * 0.75;
      const c = inner ? f : k;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    return { width: w, height: h, data };
  };

  const call = (n: number) => {
    const prompts: string[] = [];
    const gen: GenerateImage = async (req) => {
      prompts.push(req.prompt);
      return {
        image: layerImage(req.size.w, req.size.h, STYLE.palette[n]!),
        call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 },
      };
    };
    return { prompts, gen };
  };

  it("三层 ⇒ **三次调用**，一层一张原图，帧名 `<资源 id>.<层名>`", async () => {
    const { prompts, gen } = call(1);
    const { manifest, packDir, audit } = await buildAssetPack({
      recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, generateImage: gen, sourceDateEpoch: EPOCH,
    });
    expect(audit).toEqual([]);
    expect(prompts, "一层一次调用 —— 不是一次出一张").toHaveLength(3);
    for (const name of ["sky", "wall", "ground"])
      expect(existsSync(path.join(packDir, `authoring/generated/station.${name}.png`)), name).toBe(true);
    expect(manifest.assets[0]!.frames.map((f) => f.name)).toEqual(["station.sky", "station.wall", "station.ground"]);
    expect(verifyPack({ packDir }).data.ok).toBe(true);
  });

  it("提示词说得清「画的是哪一层」与「没东西的地方留空」，且**不**照搬单物体那份", async () => {
    const { prompts, gen } = call(1);
    await buildAssetPack({ recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, generateImage: gen, sourceDateEpoch: EPOCH });
    const key = keyColorFor(STYLE.palette);

    prompts.forEach((p, i) => {
      expect(p, `第 ${i + 1} 次要说清画的是哪一层`).toMatch(new RegExp(`第 ${i + 1} / 3 层`));
      expect(p).toContain(LAYERS[i]!.name);
      expect(p, "没东西的地方 = 抠底色，会被抠成透明").toContain(key);
      expect(p).toMatch(/透明/);
      // ⚠️ 两条互相打架的规矩会让模型只执行一条（动画那一支吃过这个亏）——
      //   单物体那份的头一条是「物体占满整个画面」，分层背景恰恰**不能**那样。
      expect(p, "分层背景不能照搬「占满整个画面」").not.toMatch(/占满整个画面/);
    });
    expect(prompts[1], "可平铺的层要交代左右接得上").toMatch(/接得上/);
    expect(prompts[0], "不平铺的层不必接缝").toMatch(/不平铺/);
  });

  it("**每一层**的原图都声明成创作态 —— 不是一个资源只记第一张", async () => {
    const { gen } = call(1);
    const { manifest } = await buildAssetPack({
      recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, generateImage: gen, sourceDateEpoch: EPOCH,
    });
    const refs = manifest.assets[0]!.authoring.map((a) => a.ref).sort();
    expect(refs).toEqual([
      "authoring/generated/station.ground.png",
      "authoring/generated/station.sky.png",
      "authoring/generated/station.wall.png",
    ]);
  });
});

/**
 * ⚠️ **分层背景不许裁框**（票 43 施工时抓到的）。
 *
 * 导入通道的默认行为是「抠底 → **裁到内容的包围盒** → 拉到 `spec.size`」——
 * 对**一件道具**这是对的（裁紧、归一化，位置本来无意义）。
 * 但对**一层背景**它是**毁掉构成**：层里只画了上半部分，裁完再拉满整张画布，
 * 那一层就变成铺满 —— 层与层之间的空间关系没有了。
 *
 * ⇒ 背景必须 `trim: false`：保住整张画布的构成，只把抠底留下的**透明**留下。
 */
describe("分层背景：构成必须保住（票 43）", () => {
  const recipe = (): AssetRecipe => ({
    ...RECIPE, referenceImage: undefined,
    assets: [{
      spec: {
        kind: "background", id: "sky", role: "backdrop", description: "只有上半有东西",
        styleId: "style-ref", anchor: { x: 0, y: 0 }, size: { w: 64, h: 48 },
        required: true, layers: [{ name: "sky", parallax: 0 }],
      },
      source: { kind: "image", background: { tolerance: 0 } },
    }],
  });
  /** 内容**只占上半**，下半是抠底色 —— 构成要是被拉满，下半的透明就没了。 */
  const upperHalfOnly = (w: number, h: number): RasterImage => {
    const data = Buffer.alloc(w * h * 4);
    const k = [255, 0, 255], f = [90, 106, 138];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const c = y < h / 2 ? f : k;
      data[o] = c[0]!; data[o + 1] = c[1]!; data[o + 2] = c[2]!; data[o + 3] = 255;
    }
    return { width: w, height: h, data };
  };

  it("下半没有东西 ⇒ 交付态那一半必须是**透明**的，不是被拉满", async () => {
    const gen: GenerateImage = async (req) => ({
      image: upperHalfOnly(req.size.w, req.size.h),
      call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 },
    });
    const { packDir } = await buildAssetPack({
      recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, generateImage: gen, sourceDateEpoch: EPOCH,
    });
    const atlas = JSON.parse(readFileSync(path.join(packDir, "delivery/atlas.backgrounds.json"), "utf8"));
    const img = decodePNG(readFileSync(path.join(packDir, "delivery/atlas.backgrounds.png")));
    const fr = atlas.frames["sky.sky"].frame as { x: number; y: number; w: number; h: number };
    const alphaAt = (px: number, py: number) => img.data[((fr.y + py) * img.width + fr.x + px) * 4 + 3]!;

    expect(alphaAt(fr.w >> 1, 1), "上半有东西 ⇒ 不透明").toBe(255);
    expect(alphaAt(fr.w >> 1, fr.h - 2), "下半没东西 ⇒ **透明**（构成保住了）").toBe(0);
  });
});

/**
 * 票 47：**并发跑，且上限真的管用**。
 *
 * ⚠️ 这条测试值得存在，是因为我第一次实现时**闸门根本没接上**（选项没转发到构建器），
 *   而当时的「实测」四个并发档位跑出来几乎一样快 —— 看起来像「并发到一定程度就够了」，
 *   其实是**每一档都在用同一个默认值**。一条能证明「上限真的改变行为」的断言，就是那时候缺的。
 */
describe("并发：上限按上游分别定，而且真的管用（票 47）", () => {
  const many = (n: number): AssetRecipe => ({
    ...RECIPE, referenceImage: undefined,
    assets: Array.from({ length: n }, (_, i) => ({
      spec: { kind: "sprite", id: `s${i}`, role: "道具", description: "一个方块。", styleId: "style-ref",
        anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true },
      source: { kind: "drawlist" },
    })),
  });
  /** 记下「同时在跑的调用数」的峰值 —— 那就是并发是否被限住的直接证据。 */
  const peakOf = () => {
    let active = 0, peak = 0;
    const gen: DrawListGenerator = async (spec) => {
      active += 1; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 8));
      active -= 1;
      return stubDrawLists(spec);
    };
    return { gen, peak: () => peak };
  };

  it("上限 2 ⇒ 同时在跑的调用**从不超过 2**（而且确实 > 1，是真的在并发）", async () => {
    const { gen, peak } = peakOf();
    await buildAssetPack({ recipe: many(8), style: STYLE, outDir: tmp(), recipeDir: ROOT,
      generate: gen, concurrency: { text: 2 }, sourceDateEpoch: EPOCH });
    expect(peak()).toBeLessThanOrEqual(2);
    expect(peak(), "要是 1 就等于没并发").toBeGreaterThan(1);
  });

  it("上限 1 ⇒ **退化成串行**（对照实验用的就是这一档）", async () => {
    const { gen, peak } = peakOf();
    await buildAssetPack({ recipe: many(5), style: STYLE, outDir: tmp(), recipeDir: ROOT,
      generate: gen, concurrency: { text: 1 }, sourceDateEpoch: EPOCH });
    expect(peak()).toBe(1);
  });

  it("⚠️ **一个失败之后不再放新的调用出去** —— 钱不在「已经知道失败了」之后继续烧（票 47 第 3 条）", async () => {
    // 串行时「第 5 个失败」只浪费前 4 个；并发之后若不管，`Promise.all` 虽然立刻拒绝，
    // 但**其余都已经排进闸门了**，会照样发出去。这里钉的就是那道闸。
    let calls = 0;
    const gen: DrawListGenerator = async (spec) => {
      calls += 1;
      if (spec.id === "s0") throw new Error("第一个就挂了");
      await new Promise((r) => setTimeout(r, 5));
      return stubDrawLists(spec);
    };
    await expect(buildAssetPack({ recipe: many(8), style: STYLE, outDir: tmp(), recipeDir: ROOT,
      generate: gen, concurrency: { text: 2 }, sourceDateEpoch: EPOCH })).rejects.toThrow(/第一个就挂了/);
    // 在途的拦不住（钱已经出去了），但**没发出去的**必须拦住
    expect(calls, "8 个资源不该全发出去").toBeLessThanOrEqual(2);
  });

  it("⚠️ 资源**落位按下标** —— 并发完成顺序是乱的，而 manifest 的顺序必须稳定", async () => {
    // 让第 0 个资源**最慢**：并发跑的话它最后完成；若靠完成顺序 push，manifest 就会倒过来。
    const gen: DrawListGenerator = async (spec) => {
      await new Promise((r) => setTimeout(r, spec.id === "s0" ? 25 : 1));
      return stubDrawLists(spec);
    };
    const { manifest } = await buildAssetPack({ recipe: many(4), style: STYLE, outDir: tmp(), recipeDir: ROOT,
      generate: gen, concurrency: { text: 4 }, sourceDateEpoch: EPOCH });
    expect(manifest.assets.map((a) => a.id)).toEqual(["s0", "s1", "s2", "s3"]);
  });
});
