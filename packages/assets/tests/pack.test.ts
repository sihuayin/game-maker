import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { parseAssetPack, type AssetSpec, type AssetRecipe, type DrawList, type StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, nextPackVersion, type DrawListGenerator } from "../src/index.js";

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
  const n = spec.kind === "animation" ? spec.animations.reduce((s, a) => s + a.frames, 0) : 1;
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
    const { manifest, packDir, audit } = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), generate: stub, sourceDateEpoch: EPOCH });
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
    const { manifest, packDir } = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), generate: stub, sourceDateEpoch: EPOCH });
    const walk = (dir: string, base = ""): string[] => readdirSync(dir, { withFileTypes: true })
      .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]));
    const onDisk = walk(packDir).filter((p) => p !== "manifest.json").sort();
    expect(manifest.files.map((f) => f.path)).toEqual(onDisk);
    for (const f of manifest.files) expect(f.bytes).toBe(readFileSync(path.join(packDir, f.path)).length);
  });

  it("确定性：同一 epoch 两次构建逐字节相同（连 PNG 也一样）", async () => {
    const a = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), generate: stub, sourceDateEpoch: EPOCH });
    const b = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), generate: stub, sourceDateEpoch: EPOCH });
    expect(a.manifest.files).toEqual(b.manifest.files);         // 含逐文件 checksum
    expect(JSON.stringify(a.manifest)).toBe(JSON.stringify(b.manifest));
  });

  it("⚠️ 绝不覆盖：同一个 outDir 再跑一次落在 v2，v1 还在", async () => {
    const out = tmp();
    const a = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: out, generate: stub, sourceDateEpoch: EPOCH });
    const b = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: out, generate: stub, sourceDateEpoch: EPOCH });
    expect(a.manifest.version).toBe(1);
    expect(b.manifest.version).toBe(2);
    expect(existsSync(a.packDir)).toBe(true);
    expect(existsSync(b.packDir)).toBe(true);
    expect(nextPackVersion(out, smallRecipe().id)).toBe(3);
  });

  it("provenance.mode 由来源派生；覆盖计数自洽", async () => {
    const { manifest } = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), generate: stub, sourceDateEpoch: EPOCH });
    expect(manifest.provenance.mode).toBe("generated");
    const cov = manifest.palette.coverage;
    expect(cov.unbound).toBe(0);   // 这条管线产不出 unbound
    expect(cov.exact + cov.composited + cov.quantized).toBe(manifest.assets.length);
  });

  it("色板被规范化进包（大写 → 小写）", async () => {
    expect(STYLE.palette.some((c) => /[A-F]/.test(c))).toBe(true);   // 输入的实测色板是大写
    const { packDir } = await buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), generate: stub, sourceDateEpoch: EPOCH });
    const inPack = JSON.parse(readFileSync(path.join(packDir, "authoring/stylespec.json"), "utf8"));
    expect(inPack.palette.every((c: string) => c === c.toLowerCase())).toBe(true);
  });

  it("生成器给的帧数与清单对不上 → 报出来，不静默裁剪", async () => {
    const short: DrawListGenerator = (spec) => stubDrawLists(spec).slice(0, 1);
    await expect(buildAssetPack({ recipe: smallRecipe(), style: STYLE, outDir: tmp(), generate: short, sourceDateEpoch: EPOCH }))
      .rejects.toThrow(/清单说要有 \d+ 帧，生成器给了 1 帧/);
  });

  it("色板有重复色 → 直接失败（palette:N 会变得含糊）", async () => {
    const bad = { ...STYLE, palette: [STYLE.palette[0]!, STYLE.palette[0]!] };
    await expect(buildAssetPack({ recipe: smallRecipe(), style: bad, outDir: tmp(), generate: stub, sourceDateEpoch: EPOCH }))
      .rejects.toThrow(/重复色/);
  });
});

describe("导入通道端到端（真实素材）", () => {
  it("一张真实位图走完：解码 → 抠背景 → 降采样 → 量化 → 进包", async () => {
    const recipe: AssetRecipe = {
      ...RECIPE,
      assets: [{
        spec: { kind: "background", id: "shop_interior", role: "scene-backdrop", description: "商店内景", styleId: "style-ref",
          anchor: { x: 0, y: 0 }, size: { w: 320, h: 180 }, dependencies: [], required: true },
        source: { kind: "import", ref: "fixtures/reference/test.png", background: { tolerance: 30 } },
      }],
    };
    const { manifest, packDir, audit } = await buildAssetPack({ recipe, style: STYLE, outDir: tmp(), generate: stub, sourceDateEpoch: EPOCH });
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
