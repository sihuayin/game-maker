import { copyFileSync, mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { parseAssetPack, type AssetSpec, type AssetRecipe, type DrawList, type StyleSpec } from "@game-maker/contracts";
import { decodePNG, encodePNG } from "../src/png.js";
import {
  buildAssetPack, keyColorFor, nextPackVersion, verifyPack,
  type DrawListGenerator, type ImageGenerator, type RasterImage,
} from "../src/index.js";
import { deliveredColour } from "./_model-paint.js";

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
  const layerImage = (w: number, h: number, fill: string, border?: string): RasterImage => {
    const data = Buffer.alloc(w * h * 4);
    const k = px(border ?? keyColorFor(STYLE.palette)), f = px(fill);
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
    const gen: ImageGenerator = async (req) => {
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

  /** 把底色挪开 70 —— 模拟「模型画了另一个相近的颜色」（实测差 129–248）。 */
  const drifted = () => {
    const k = px(keyColorFor(STYLE.palette));
    return `#${[Math.max(0, k[0] - 70), Math.min(255, k[1] + 70), k[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  /** 与 `call` 同款，但**底色画偏了**（`which` 指定哪几层偏）。 */
  const callDrifted = (which: (name: string) => boolean) => {
    const gen: ImageGenerator = async (req) => ({
      image: layerImage(req.size.w, req.size.h, STYLE.palette[1]!,
        which(req.prompt.includes("sky") ? "sky" : req.prompt.includes("wall") ? "wall" : "ground") ? drifted() : undefined),
      call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 },
    });
    return gen;
  };

  it("⚠️ **底色没抠到 ⇒ 硬失败**（票 03）—— 抠不掉的那层会一个洞都没有，把后面全挡住", async () => {
    // ⚠️ 依据是实测：模型给的底色可以离声明色 **129–248**，而容差只有 40 ⇒ 一个像素都抠不掉。
    //   后果不只是「该透明的地方留着底色」—— 这一层的不透明率会**恒为 1**，
    //   于是「最远层必须画满」那条门禁**反而通过**（抠不掉的东西全是不透明的）。
    const gen = callDrifted((name) => name !== "sky");
    const e = await buildAssetPack({
      recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT,
      generate: stub, generateImage: gen, sourceDateEpoch: EPOCH,
    }).catch((x: unknown) => x as Error);
    expect(e).toBeInstanceOf(Error);
    // 只报**第一条**（wall 在 ground 前面）—— 一次说清一个
    expect((e as Error).message).toMatch(/底色\*\*一个像素都没抠到\*\*/);
    expect((e as Error).message).toMatch(/station\.wall/);
    expect((e as Error).message).toMatch(/把后面那几层整个挡住/);
    // ⚠️ 票 37 的 Q6 删掉了此前那句「别改成「按四角取样兜底」」—— 那是**修法指引**，
    //   而不是读数；顶替它的是**可核对的量**：声明色、实测众数色、各抠掉多少、两者的 L1。
    expect((e as Error).message, "报实测众数色").toMatch(/实测的众数色/);
    expect((e as Error).message, "报声明色这一侧抠到几个像素").toMatch(/按它只抠到 \d+ 像素/);
    expect((e as Error).message, "报两者差多少").toMatch(/与声明色差 L1 = \d+/);
    expect((e as Error).message, "并说清背景层本票没改").toMatch(/背景层保持原样/);
  });

  it("⚠️ **最远那层底色偏了不报错** —— 它本来就该是满的，抠得少是它对", async () => {
    // 这一条钉的是「只查非最远层」那条边界。实测：四角取样会把最远层抠掉 **48–50%**
    // （它的角上就是内容本身）—— 所以「一律兜底」是错的修法。
    const gen = callDrifted((name) => name === "sky");
    const { audit } = await buildAssetPack({
      recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT,
      generate: stub, generateImage: gen, sourceDateEpoch: EPOCH,
    });
    expect(audit).toEqual([]);
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

  const recipeWithLayers = (layers: unknown[]): AssetRecipe => {
    const r = recipe();
    return { ...r, assets: r.assets.map((a) => ({ ...a, spec: { ...a.spec, layers } as never })) };
  };

  it("⚠️ **逐层描述**：每一层用自己的那一句，**缺省才回落**到整张场景（票 02）", async () => {
    // ⚠️ 实测：不给逐层描述时，**每一层的提示词里写的都是整张场景**，而模型的默认解释是
    //   「**从这一层往前**」⇒ 最远那层把整张场景画了一遍，最近那层恰好全对。
    const { prompts, gen } = call(1);
    await buildAssetPack({
      recipe: recipeWithLayers([
        { name: "sky", parallax: 0, description: "整幅黄昏天空，铺满整块画布" },
        { name: "wall", parallax: 0.5, tileable: { x: true, y: false } },   // 没给 ⇒ 回落
        { name: "ground", parallax: 1, tileable: { x: true, y: false }, description: "站台地面与铁轨那一条" },
      ]),
      style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, generateImage: gen, sourceDateEpoch: EPOCH,
    });
    expect(prompts[0]).toContain("整幅黄昏天空，铺满整块画布");
    expect(prompts[2]).toContain("站台地面与铁轨那一条");
    // ⚠️ 给了自己那句的层，**不许**再出现整张场景那句 —— 那正是这一票在修的东西
    expect(prompts[0]).not.toContain("黄昏站台，三层");
    expect(prompts[2]).not.toContain("黄昏站台，三层");
    // ⚠️ 没给自己的那层照旧回落，**而且带上 `role`**（回落时它是同一句描述的一部分）
    expect(prompts[1]).toContain("黄昏站台，三层");
    expect(prompts[1]).toContain("backdrop");
  });

  it("⚠️ **作者的散文不进交付清单** —— `layers[].description` 剥在拷进 manifest 那一步（票 02）", async () => {
    // ⚠️ `Layer` 是**配方与清单共用**的定义，而这一条钉的是它们**在哪儿分岔**：
    //   `role` 进、`description` 不进（清单里早就是这个分工）。
    const gen = call(1).gen;
    const { manifest, audit } = await buildAssetPack({
      recipe: recipeWithLayers([
        { name: "sky", parallax: 0, description: "整幅黄昏天空" },
        { name: "wall", parallax: 0.5, tileable: { x: true, y: false } },
        { name: "ground", parallax: 1, tileable: { x: true, y: false } },
      ]),
      style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, generateImage: gen, sourceDateEpoch: EPOCH,
    });
    const layers = manifest.assets[0]!.layers!;
    expect(layers.map((l) => l.name)).toEqual(["sky", "wall", "ground"]);
    for (const l of layers) expect(l, "交付清单里不该有 description").not.toHaveProperty("description");
    // ⚠️ 而壳子真要的东西一样都不许少
    expect(layers[1]!.parallax).toBe(0.5);
    expect(layers[1]!.tileable).toEqual({ x: true, y: false });
    // ⚠️ 而**两边形状不同不许把对账绊倒** —— `auditAssetSpec` 是**逐字段**比的
    //   （name / parallax / tileable），不是整对象比。这一条钉住那个前提。
    expect(audit).toEqual([]);
  });

  it("⚠️ **最远那层不许再说「别拿天空色去填」**（票 51：那句话字面上就是「别画天空」）", async () => {
    // 票 51 量了四次：把「画满」说硬（70.3%）、改成「天空就是内容」（66.9%）**全都没用**，
    // 而**只拆掉那句禁色** ⇒ **100%**。所以这条钉的不是措辞好不好听，是**那个矛盾在不在了**。
    const { prompts, gen } = call(1);
    await buildAssetPack({ recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: ROOT,
      generate: stub, generateImage: gen, sourceDateEpoch: EPOCH });
    const [sky, wall] = prompts as [string, string, string];

    // 最远那层：说清「天空就是这一层的内容」，且**不许**出现那句自相矛盾的禁色
    expect(sky).toMatch(/天空本身就是你要画的东西/);
    expect(sky, "「不要拿…天空色…去填」对天层是**反的**").not.toMatch(/天空色/);
    // ⚠️ 其余层**必须保留**那句 —— 墙的空白处不许拿天色糊上去（那会盖住真正的天层）
    expect(wall, "对墙层，那句话是对的，不许一起改掉").toMatch(/天空色/);
    expect(wall).not.toMatch(/天空本身就是你要画的东西/);
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
    const gen: ImageGenerator = async (req) => ({
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
    // 串行时「第 5 个失败」只浪费前 4 个；并发之后若不管，**其余那些排进闸门的会照样发出去**。
    // ⚠️ 拦它们的是**闸门自己**（它记着第一个错、之后一律拒），**不是**外层的 Promise ——
    //   外层从 2026-09-30 起是 `allSettled`（票 05：等「在飞的」收尾），它不会「立刻拒绝」任何东西。
    //   这里钉的就是那道闸。
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

describe("失败现场：**已经付过钱的原图不许丢**（票 01）", () => {
  // ⚠️ 这一条的由来：`pack` 写进 `.building-<pid>-<版本>` 工作目录、成功后改名过去，
  //   而**原图与逐字提示词是一张一落的**（每次调用回来就写）⇒ 失败那一刻，
  //   已经付过钱的创作态**就躺在磁盘上**，然后被失败分支的 `rmSync` **主动删掉**。
  //   实测两次：GPT 6 笔 · 约 19 分钟、Gemini 4 笔 · 约 9.5 分钟，产物为零。
  /** 两份单帧 sprite —— 一次生图调用一个 unit，「第几个失败」因此是确定的。 */
  const twoSprites = (): AssetRecipe => ({
    ...RECIPE, id: "salvage", referenceImage: undefined,
    assets: ["a", "b"].map((id) => ({
      spec: { kind: "sprite" as const, id, role: `${id} 的角色`, description: `${id} 那个东西`,
        styleId: "style-ref", anchor: { x: 0.5, y: 0.5 }, size: { w: 16, h: 16 }, required: true },
      source: { kind: "image" as const, background: { tolerance: 0 } },
    })),
  });
  /**
   * 一张「中间有东西、四周是**我们告诉模型的那个抠底色**」的图 —— 与真生图模型的产出同构。
   *
   * ⚠️ **不许图省事画成一块任意纯色**（[票 35](../../../.scratch/game-maker-v2/issues/35-multiframe-needs-background.md)）：
   *   生图那一路现在**始终**按 `keyColorFor(style.palette)` 抠底，而**抠不到一个像素**会当场
   *   撞上那条哨兵 ⇒ 一块与派生底色无关的纯色图会让下面这几条测试**因为错误的理由而绿**
   *   （失败的是哨兵，不是它们各自要量的那条规矩）。这里不关心内容，但要关心**底色对不对**。
   */
  const flat = (w: number, h: number): RasterImage => {
    const px = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const;
    const k = px(keyColorFor(STYLE.palette)), f = px(STYLE.palette[0]!);
    const data = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const inner = x >= w * 0.25 && x < w * 0.75 && y >= h * 0.25 && y < h * 0.75;
      const c = inner ? f : k;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    return { width: w, height: h, data };
  };
  /** 第 `failAt` 次调用抛，其余照常返回一张图。⚠️ 调用方要把它配上 `concurrency: {image: 1}`（顺序才是确定的）。 */
  const failingGen = (failAt: number) => {
    const ok: { image: RasterImage; prompt: string }[] = [];
    const gen: ImageGenerator = async (req) => {
      if (ok.length + 1 === failAt) throw new Error("抖一下");
      const image = flat(req.size.w, req.size.h);
      ok.push({ image, prompt: req.prompt });
      return { image, call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 } };
    };
    return { gen, ok };
  };
  /** ⚠️ 用 `.then(成功, 失败)` 而不是 `.catch` —— 只 `.catch` 的话返回类型是**联合**，
   *  TS 就没法在断言里收窄 `failureDir`（那是 `pack.test.ts` 里第一次见的那种收窄）。 */
  const fail = (outDir: string, gen: ImageGenerator): Promise<Error & { failureDir?: string }> =>
    buildAssetPack({
      recipe: twoSprites(), style: STYLE, outDir, recipeDir: ROOT,
      generate: stub, generateImage: gen, concurrency: { image: 1 }, sourceDateEpoch: EPOCH,
    }).then(() => { throw new Error("本该失败，却出包了"); },
      (x: unknown) => x as Error & { failureDir?: string });

  it("⚠️ 第 2 个资源挂掉 ⇒ 第 1 个的**原图与逐字提示词原样还在**（判据一）", async () => {
    const d = tmp();
    const { gen, ok } = failingGen(2);
    const e = await fail(d, gen);
    expect(e.failureDir, "失败现场没留下来").toBeDefined();
    const dir = e.failureDir!;
    expect(path.basename(dir)).toMatch(/^failed-/);
    // ⚠️ **逐字节**：与那一刻写下去的那份比，不是「差不多」
    expect(readFileSync(path.join(dir, "authoring/generated/a.png")).equals(encodePNG(ok[0]!.image))).toBe(true);
    expect(readFileSync(path.join(dir, "authoring/generated/a.prompt.txt"), "utf8")).toBe(ok[0]!.prompt + "\n");
    // 而**没成功的那一个不许有** —— 现场是「付过钱的那些」，不是「清单上的那些」
    expect(existsSync(path.join(dir, "authoring/generated/b.png"))).toBe(false);
    // ⚠️ 它是**失败现场不是包**：不占版本号（「失败不消耗版本号」照旧成立）
    expect(existsSync(path.join(d, "salvage", "pack", "v1"))).toBe(false);
    expect(nextPackVersion(d, "salvage")).toBe(1);
  });

  it("⚠️ **拿那份现场拼一份 `import` 配方出得了包**（判据二）—— 生图 0 次", async () => {
    const d = tmp();
    const { gen } = failingGen(2);
    const e = await fail(d, gen);
    // 人拿到那份现场之后该做的事：把它当 `import` 的来源，重出一份包。
    // ⚠️ `ref` 相对**配方文件**解析 ⇒ 把 `recipeDir` 指到现场那一层，路径就是它里面那个。
    const kept = { ...twoSprites(), id: "salvaged" };
    const r = await buildAssetPack({
      recipe: { ...kept, assets: [{ spec: kept.assets[0]!.spec,
        source: { kind: "import", ref: "authoring/generated/a.png", background: { tolerance: 0 } } }] },
      style: STYLE, outDir: tmp(), recipeDir: e.failureDir!,
      generate: stub, sourceDateEpoch: EPOCH,          // ⚠️ 没有 generateImage ⇒ 一次生图调用都不会发
    });
    expect(r.audit).toEqual([]);
    expect(verifyPack({ packDir: r.packDir }).data.ok).toBe(true);
  });

  it("⚠️ **同一份配方只留最近一份** —— 失败两次不堆成一部失败史", async () => {
    const d = tmp();
    for (let i = 0; i < 2; i++) await fail(d, failingGen(2).gen);
    expect(readdirSync(path.join(d, "salvage")).filter((x) => x.startsWith("failed-"))).toHaveLength(1);
  });

  it("⚠️ 失败时**等「在飞的」收尾**（票 05）—— 那几笔已经付过钱，不等就是把已经买的图扔掉", async () => {
    // ⚠️ 不等的话还有第二个后果：失败那条 `renameSync` 先生效，而**还在飞的**那笔随后
    //   往**旧路径**写 ⇒ ENOTDIR，且那笔的产物永远进不了失败现场。
    const d = tmp();
    const gen: ImageGenerator = async (req) => {
      if (req.size.w === 8) throw new Error("抖一下");            // 这一笔立刻挂
      await new Promise((r) => setTimeout(r, 60));                 // 另一笔慢，但在飞
      return { image: flat(req.size.w, req.size.h), call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 } };
    };
    const r = twoSprites();
    (r.assets[0]!.spec as { size: { w: number; h: number } }).size = { w: 8, h: 8 };    // 快的挂
    (r.assets[1]!.spec as { size: { w: number; h: number } }).size = { w: 16, h: 16 };  // 慢的成
    const e = await buildAssetPack({
      recipe: r, style: STYLE, outDir: d, recipeDir: ROOT,
      generate: stub, generateImage: gen, concurrency: { image: 2 }, sourceDateEpoch: EPOCH,
    }).then(() => { throw new Error("本该失败"); }, (x: unknown) => x as Error & { failureDir?: string });

    // ⚠️ **等了**：慢的那一笔的产物进了失败现场
    expect(existsSync(path.join(e.failureDir!, "authoring/generated/b.png")), "在飞的那笔被扔了").toBe(true);
    // ⚠️ 而**没有留下垃圾**：工作目录已经改名走了，`out/<id>/` 底下不该再有 `.building-*`
    expect(readdirSync(path.join(d, "salvage")).filter((x) => x.startsWith(".building-"))).toEqual([]);
  });

  it("⚠️ **一笔都没成功就挂掉 ⇒ 不留空目录**（原来那条 rmSync 怕的正是这个）", async () => {
    const d = tmp();
    const e = await fail(d, failingGen(1).gen);
    expect(e.failureDir).toBeUndefined();
    expect(readdirSync(path.join(d, "salvage")).filter((x) => x.startsWith("failed-") || x.startsWith(".building-"))).toEqual([]);
  });
});

// ── 票 35：底色是**运行时确定性规则**，不是清单里的一行字 ────────────────────────
//
// ⚠️ 这一块问的是一个**值**的问题：提示词里逐字告诉模型的那个底色，与 `pack` 抠底时
//   用的那个颜色，**是不是同一个**。
//
//   病根是「同一个事实有两个来源」：`source.prompt` 曾让计划阶段**覆盖整段提示词**
//   （真跑 20 条 `image` 资源，**每一条**都填了它），于是 `imagePrompt()` **一次都没跑过** ——
//   而「背景必须是纯色 ${bg}」「画布是 N 倍宽」「一排 N 个」那些话**全在它里面**。
//   那个字段已从契约与工具 schema 两处删掉（`recipe.ts` / `recipe-tool.ts`）
//   ⇒ 提示词**只能**派生，形状上就不可能再被覆盖。
//
// ⚠️⚠️ **票 37 把后半截推翻了**（2026-10-10）：上面那个「提示词里的色 === `pack` 抠的色」
//   的守卫**不是一个守卫，它把错误钉死了** —— 实测两者**永远不等**：第三次真跑 9/9 张图在
//   容差 30 下抠到 **0 像素**，画面里离声明色最近的像素也差 L1 118~334（提示词里那句话
//   写了两到四遍，一次没听）。⇒ **抠底改用「这张图上量出来的众数色」**，
//   而**提示词那一侧仍然派生同一个颜色**（它是在要求模型「把背景画成一块与角色无关的平涂」，
//   这个作用实测有效 —— 9/9 都画了平涂、都没把洋红用到角色身上）。
//
//   ⇒ 于是这一块的桩**必须换**：此前它**照着提示词画**（一个只会照做的傀儡），
//     「模型会交付我们声明的颜色」成了测试环境里**唯一**的可能 —— 那正是
//     **三道闸全绿而规则是错的**（票 37 §4）的来源。现在它**画另一个颜色**
//     （`deliveredColour`：9 组实测交付色），而「构建成功」本身就是判据：
//     抠底要是还认声明色，样张**当场**就出不了包。
describe("⚠️ 抠底用的是**这张图上量出来的**那个色，不是提示词里说的那个（票 37）", () => {
  /**
   * ⚠️ **色板里故意坐着 `#ff00ff`** —— 它是 `keyColorFor` 的**第一候选**，派生色因此
   *   必须**跳开**它去拿 `#00ff00`。于是「把底色写死成 `#ff00ff`」这种实现（正是删掉
   *   `source.prompt` 之前真跑里模型自挑的那个路子：`(85,90,95)` 撞上色板里的 `#5a5f6b`）
   *   当场露馅。
   */
  const GUARD: StyleSpec = { ...STYLE, palette: [...STYLE.palette, "#ff00ff"] };
  const DERIVED = "#00ff00";
  /** 提示词里那句底色 —— 三份模板**都用这个说法**（「背景必须是纯色 X」/「必须是纯色 X」/「是纯色 X」）。 */
  const COLOUR_IN_PROMPT = /纯色 (#[0-9a-fA-F]{6})/;
  const px = (hex: string): [number, number, number] =>
    [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const toHex = (c: readonly [number, number, number]): string =>
    `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

  /**
   * 「底色 = 参数给的那个、墨 = 参数给的那几个色」的图 —— 与真生图模型的产出同构。
   * ⚠️ 多格时**每格用自己的颜色、格与格之间留干净的底色缝**：分块（`segmentRowCells`）
   *   靠的就是那些缝，把格子画满会让整排连成一块。
   * ⚠️ **墨只占中间 40%**（`0.3 ~ 0.7`）—— 真跑那 9 张的主体只占 10~20%
   *   （极简像素 · 大片留白）；画成 75% 会**墨比底多**，众数色就成了主体本身。
   */
  const tinted = (w: number, h: number, key: string, fills: readonly string[]): RasterImage => {
    const k = px(key);
    const data = Buffer.alloc(w * h * 4);
    const cellW = w / fills.length;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cell = Math.min(fills.length - 1, Math.floor(x / cellW));
      const inX = x - cell * cellW;
      const inner = inX >= cellW * 0.3 && inX < cellW * 0.7 && y >= h * 0.3 && y < h * 0.7;
      const c = inner ? px(fills[cell]!) : k;
      const o = (y * w + x) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    return { width: w, height: h, data };
  };

  /**
   * 桩：**读得出**提示词里那个底色、但**画的是另一个**（`deliveredColour`，票 37 的 Q5）。
   * `seen` 用来断言「每一次调用被告诉的都是同一个派生色」。
   */
  const modelLike = (fills: (i: number) => readonly string[]) => {
    const seen: string[] = [];
    const painted: string[] = [];
    const canvas: { w: number; h: number }[] = [];
    const gen: ImageGenerator = async (req) => {
      const m = COLOUR_IN_PROMPT.exec(req.prompt);
      if (m === null) throw new Error(`提示词里没写底色，桩没法照它画：\n${req.prompt}`);
      seen.push(m[1]!);
      const k = deliveredColour(m[1]!);
      painted.push(`#${k.map((v) => v.toString(16).padStart(2, "0")).join("")}`);
      canvas.push({ w: req.size.w, h: req.size.h });
      return {
        image: tinted(req.size.w, req.size.h, `#${k.map((v) => v.toString(16).padStart(2, "0")).join("")}`, fills(seen.length - 1)),
        call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 },
      };
    };
    return { gen, seen, painted, canvas };
  };

  /** 从图集里**逐帧**取中心那一点的 RGBA —— 「内容与顺序」就是把这一串读出来比，比的是**序列**。 */
  const sampled = (packDir: string, metaRel: string, names: readonly string[]) => {
    const at = JSON.parse(readFileSync(path.join(packDir, metaRel), "utf8")) as
      { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> };
    const img = decodePNG(readFileSync(path.join(packDir, metaRel.replace(/\.json$/, ".png"))));
    return names.map((n) => {
      const r = at.frames[n]!.frame;
      const o = ((r.y + (r.h >> 1)) * img.width + r.x + (r.w >> 1)) * 4;
      return [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!, img.data[o + 3]!];
    });
  };

  const SPRITE: AssetRecipe = {
    ...RECIPE, id: "guard-sprite", referenceImage: undefined,
    assets: [{
      spec: { kind: "sprite", id: "lantern", role: "提灯", description: "一盏黄铜提灯",
        styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true },
      source: { kind: "image", background: { tolerance: 0 } },
    }],
  };

  const WALK: AssetRecipe = {
    ...RECIPE, id: "guard-walk", referenceImage: undefined,
    assets: [{
      spec: { kind: "animation", id: "walk", role: "角色", description: "一个走路的人",
        styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true,
        animations: [{ name: "idle", frames: 3, fps: 6, loop: true }] },
      // ⚠️ **整个 `background` 键缺席** —— 真跑里 5/5 多帧资源就是这样，而那时链**当场抛**在
      //   「source 没给 background」上（票 35 §1：真正的错一个字都没说到）。现在它合法：
      //   颜色是派生的，这里只有一个可选的容差。
      source: { kind: "image" },
    }],
  };

  const SCENE: AssetRecipe = {
    ...RECIPE, id: "guard-scene", referenceImage: undefined,
    assets: [{
      spec: { kind: "background", id: "yard", role: "院子", description: "黄昏的院子",
        styleId: "style-ref", anchor: { x: 0, y: 0 }, size: { w: 32, h: 24 }, required: true,
        layers: [{ name: "sky", parallax: 0 }, { name: "fence", parallax: 0.6 }] },
      source: { kind: "image", background: { tolerance: 0 } },
    }],
  };

  const build = (recipe: AssetRecipe, gen: ImageGenerator) => buildAssetPack({
    recipe, style: GUARD, outDir: tmp(), recipeDir: ROOT, generate: stub, generateImage: gen, sourceDateEpoch: EPOCH,
  });
  const failed = (recipe: AssetRecipe, gen: ImageGenerator): Promise<Error> =>
    build(recipe, gen).then(() => { throw new Error("本该失败，却出包了"); }, (x: unknown) => x as Error);

  it("前提：派生色**跳开**了色板里坐着的 `#ff00ff`（写死它的实现会当场露馅）", () => {
    expect(GUARD.palette, "前提：色板里坐着 #ff00ff").toContain("#ff00ff");
    expect(keyColorFor(GUARD.palette), "所以派生出来的不是它").toBe(DERIVED);
    expect(keyColorFor(STYLE.palette), "而原色板派生的正是它 —— 两条都要覆盖").toBe("#ff00ff");
  });

  it("前提②：桩交付的那个颜色**不等于**声明色（否则这整个 describe 就退化成傀儡）", () => {
    // ⚠️ **这条是整个 describe 的地基**：下面每一条「照样抠得开」都只有在
    //   「桩画的 ≠ 提示词说的」时才在验**交付色**。桩要是照声明色画，
    //   它们就全都在验傀儡 —— 而那正是票 37 §4 那个「三道闸全绿而规则是错的」。
    expect(deliveredColour("#ff00ff"), "实测那一对").toEqual([200, 30, 124]);
    for (const declared of ["#ff00ff", "#00ff00", "#ff0000", "#0000ff", "#ffff00", "#00ffff"]) {
      const d = px(declared), k = deliveredColour(declared);
      expect(k, `${declared} 的交付色撞上了声明色`).not.toEqual(d);
    }
  });

  it("单帧：提示词说 `#00ff00`、而模型交回**另一个**颜色 ⇒ 照样抠得开（票 37）", async () => {
    // ⚠️ **构建成功本身就是判据**：桩画的是 `deliveredColour(DERIVED)`（9 组实测交付色之一），
    //   抠底要是还认提示词里那个声明色，样张**当场**就出不了包。
    const { gen, seen, painted, canvas } = modelLike(() => [GUARD.palette[0]!]);
    const { manifest, audit } = await build(SPRITE, gen);
    expect(audit).toEqual([]);
    expect(seen, "一个资源一次调用，而提示词里仍然是那个派生色").toEqual([DERIVED]);
    expect(painted, "而画出来的**不是**它").toEqual([toHex(deliveredColour(DERIVED))]);
    expect(canvas[0], "单帧的画布就是 spec.size —— 没有 N 倍宽那回事").toEqual({ w: 16, h: 16 });
    expect(manifest.assets[0]!.frames.map((f) => f.name)).toEqual(["lantern"]);
  });

  it("⚠️ 多帧：**画布是 N 倍宽**（那句话曾经整段丢掉），且切帧数量、内容、顺序都对", async () => {
    // ⚠️ 这是票 35 的 Q6(b) 那条判据「用 stub 生图器真实验证切帧数量、内容和顺序」。
    const COLOURS = [GUARD.palette[0]!, GUARD.palette[1]!, GUARD.palette[3]!];
    const { gen, seen, canvas } = modelLike(() => COLOURS);
    const { manifest, packDir, audit } = await build(WALK, gen);
    expect(audit).toEqual([]);
    expect(seen, "一个动画一次调用，而底色**还是那一个**派生色").toEqual([DERIVED]);
    // ⚠️ 「画布是 N 倍宽」是 `animationSheetPrompt` 里的话 —— 它曾因 `src.prompt` 覆盖而不存在，
    //   模型于是拿到一个 16×16 的方画布去画「一排 3 个」。
    expect(canvas[0]).toEqual({ w: 48, h: 16 });

    // 数量与顺序：`<资源 id>.<动画名><第几帧>`（单帧动画不带序号）
    const NAMES = ["walk.idle1", "walk.idle2", "walk.idle3"];
    expect(manifest.assets[0]!.frames.map((f) => f.name)).toEqual(NAMES);
    expect(manifest.assets[0]!.animations![0]!.frames).toEqual(NAMES);

    // 内容与顺序：**逐帧**读图集上那一点，比的是**序列**不是集合 —— 顺序颠倒了这条当场红
    expect(sampled(packDir, "delivery/atlas.animations.json", NAMES))
      .toEqual(COLOURS.map((c) => [...px(c), 255]));
  });

  it("背景层：**每一层**的每一次调用都被告诉同一个派生色（非最远那层真的被抠到）", async () => {
    // ⚠️ 背景层**今天仍然按声明色抠**（票 37 的 Q3：那是决定表里的另一行，另开票）。
    //   所以这一条里的桩**照声明色画** —— 它问的是「层与层的管线通不通」，
    //   而不是「模型会不会交付那个颜色」（那个问题在下面那条里，答案是**不会**）。
    const keyFaithful: ImageGenerator = async (req) => {
      const m = COLOUR_IN_PROMPT.exec(req.prompt);
      if (m === null) throw new Error(`提示词里没写底色：\n${req.prompt}`);
      seen.push(m[1]!);
      return {
        image: tinted(req.size.w, req.size.h, m[1]!, [GUARD.palette[0]!]),
        call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 },
      };
    };
    const seen: string[] = [];
    const { manifest, audit } = await build(SCENE, keyFaithful);
    expect(audit).toEqual([]);
    expect(seen, "一层一次调用，而两次的底色必须是**同一个值**").toEqual([DERIVED, DERIVED]);
    expect(manifest.assets[0]!.frames.map((f) => f.name)).toEqual(["yard.sky", "yard.fence"]);
  });

  it("⚠️ **抠底不是写死的**：喂一张别的底色的图 ⇒ 照样抠得开（票 37 的 Q4 ①）", async () => {
    // ⚠️ 这条专盯「把某个颜色写死进抠底」的实现：同一份配方、两种交付色，
    //   写死任何一个都会在另一张上崩。（`[225,31,138]` 是实测交付过的那一族；
    //   `[0,255,0]` 是**另一个量级的绿**，与那一族毫无关系。）
    for (const delivered of [[225, 31, 138], [0, 255, 0]] as const) {
      const flat: ImageGenerator = async (req) => ({
        image: tinted(req.size.w, req.size.h, toHex(delivered), [GUARD.palette[0]!]),
        call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 },
      });
      const { manifest, audit } = await build(SPRITE, flat);
      expect(audit, `底为 [${delivered.join(", ")}]`).toEqual([]);
      expect(manifest.assets[0]!.frames.map((f) => f.name)).toEqual(["lantern"]);
    }
  });

  it("⚠️ 单帧判据①：底**不是平涂**（众数只占一小半）⇒ 抛，并说清是覆盖率不够", async () => {
    // ⚠️ 四种颜色各占四分之一 ⇒ 众数色只覆盖 25% ⇒ 「抠掉的是多数」不成立。
    //   这条挡的是「模型画的根本不是平涂」（渐变色带 / 噪点）—— 那时单色众数抠不干净。
    const stripes: ImageGenerator = async (req) => {
      const { w, h } = req.size;
      const data = Buffer.alloc(w * h * 4);
      const bands = [[200, 30, 124], [10, 200, 40], [30, 40, 210], [230, 210, 30]];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = bands[Math.min(bands.length - 1, Math.floor((x / w) * bands.length))]!;
        const o = (y * w + x) * 4;
        data[o] = c[0]!; data[o + 1] = c[1]!; data[o + 2] = c[2]!; data[o + 3] = 255;
      }
      return {
        image: { width: w, height: h, data } as RasterImage,
        call: { protocol: "openai", requestedSize: `${w}x${h}`, ms: 1, attempts: 1 },
      };
    };
    const e = await failed(SPRITE, stripes);
    expect(e.message).toMatch(/底色判据没过/);
    expect(e.message, "说清是**覆盖率**那一条").toMatch(/只抠掉/);
    expect(e.message, "把声明色与实测众数色并排报出来").toMatch(/实测的众数色/);
    // ⚠️ 票 37 的 Q6：**不许给一个必然失败的建议**
    expect(e.message, "不能再出现「重出这一张」").not.toMatch(/重出这一[张层]/);
    expect(e.message).toMatch(/这不是重试能解决的问题/);
  });

  it("⚠️ 单帧判据②：剩下的墨**被抠碎** ⇒ 抛，并说清是连通结构那一条", async () => {
    // ⚠️ 底是平涂（众数占 93.75% ⇒ 覆盖率那条过），但主体被画成 16 个互不相连的小点
    //   ⇒ 最大一块只占剩下的墨的 1/16 ⇒ 连通结构那条响。真跑里这条挡的是
    //   「抠底把主体抠穿了 / 抠成碎片」。
    const dots: ImageGenerator = async (req) => {
      const { w, h } = req.size;
      const data = Buffer.alloc(w * h * 4);
      const bg = [200, 30, 124], ink = [62, 50, 54];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = x % 4 === 0 && y % 4 === 0 ? ink : bg;
        const o = (y * w + x) * 4;
        data[o] = c[0]!; data[o + 1] = c[1]!; data[o + 2] = c[2]!; data[o + 3] = 255;
      }
      return {
        image: { width: w, height: h, data } as RasterImage,
        call: { protocol: "openai", requestedSize: `${w}x${h}`, ms: 1, attempts: 1 },
      };
    };
    const e = await failed(SPRITE, dots);
    expect(e.message).toMatch(/底色判据没过/);
    expect(e.message, "说清是**连通结构**那一条").toMatch(/碎成了 16 块/);
    expect(e.message).toMatch(/这不是重试能解决的问题/);
  });

  it("⚠️ 多帧的**两个错分得开**：交付色与提示词不同**不算错**；帧数真不对 ⇒ 帧数核对", async () => {
    // ⚠️ 票 35 记的那个「**指错方向的错**」是这两条打架的结果。票 37 之后第一个错**消失**了：
    //   底色与提示词不同**不再是一种失败**（那正是常态）。剩下的那个错 —— 模型多画一格 ——
    //   由帧数核对报出来，而它**要附上抠底的读数**（否则下一次还是指错方向）。
    const four = modelLike(() => [GUARD.palette[0]!, GUARD.palette[1]!, GUARD.palette[3]!, GUARD.palette[4]!]);
    const e2 = await failed(WALK, four.gen);
    expect(e2.message).toMatch(/检测到 4 块/);
    expect(e2.message, "帧数那条要附上抠底用的那个颜色").toMatch(/实测众数色/);
    expect(e2.message, "而底色那条**不该**在这时候响 —— 两个错各说各的").not.toMatch(/一个像素都没抠到/);
  });

  // ⚠️⚠️⚠️ **已知残留的洞 —— 这条测试钉住的是「今天还错着」的行为，不是「应当如此」。**
  //
  //   票 37 的边界原话：「不能把『众数色』本身当作成功判据（众数可能是主体；必须继续验证
  //   覆盖率和连通结构）」。本票照做了 —— 覆盖率与连通结构两条都判。**但那两条挡不住这一种**：
  //   主体自己占了多数（> 50%）**且**剩下的底连成一块 ⇒ 两条判据**都过** ⇒
  //   交付出去的是**抠反了的图**：主体被当底抠掉，底被当主体留下，而且**静默**。
  //
  //   下面这个 8×8：内圈 36 像素（主体色 S，4 连通的一块）、外圈 28 像素（底 B，4 连通的环）。
  //   众数 = S（36/64 = 56.25% > 50% ⇒ 判据①过；抠完剩下那个环，1 块 ⇒ 判据②过）。
  //
  //   ⚠️ **它今天是绿的**：它断言的是「这种图**会**出包，而且出的是反的」——
  //   **谁要是把这条洞补上了（例如加了「众数色不该与四角取样差太远」之类），这条会红，
  //   那时请把本测试改成断言它抛错**（而不是把断言放宽）。
  it("⚠️ 已知的洞：主体自己就是众数**且**剩下的底连成一块 ⇒ 抠反了却照样出包（今天如此）", async () => {
    const inverted: ImageGenerator = async (req) => {
      const { w, h } = req.size;
      const data = Buffer.alloc(w * h * 4);
      const subject = [62, 50, 54], bg = [200, 30, 124];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const border = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        const c = border ? bg : subject;      // 内圈 36 > 外圈 28 ⇒ 主体是众数
        const o = (y * w + x) * 4;
        data[o] = c[0]!; data[o + 1] = c[1]!; data[o + 2] = c[2]!; data[o + 3] = 255;
      }
      return {
        image: { width: w, height: h, data } as RasterImage,
        call: { protocol: "openai", requestedSize: `${w}x${h}`, ms: 1, attempts: 1 },
      };
    };
    const { audit } = await build(SPRITE, inverted);   // ⚠️ **不抛** —— 这正是那个洞
    expect(audit, "今天它一路走到出包，两条判据都没响").toEqual([]);
  });
});
