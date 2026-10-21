import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ANIMATION_THRESHOLDS, alphaMaskDiff, bboxWidthDiffPct, boundaryDarkPct, cleanBBox,
  cropToBox, decodePNG, dominantColorL1, dominantOpaqueColor, offPaletteCount, paletteCount,
  positionDriftPct, verdictOf,
  type AnimationMetrics, type InkBox, type RasterImage,
} from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const FIXTURE = path.join(ROOT, "fixtures/animation-baselines/scavenger-idle");

type Rect = { x: number; y: number; w: number; h: number };
type PaletteSpec = { path: string; paletteSize: number; sha256: string };
type PromptEntry = { name: string; sha256: string; paletteSize: number };
type Baseline = {
  baselineId: string;
  sourceCommit: string;
  sourcePack: { path: string; manifest: { id: string; version: number } };
  model: string;
  asset: {
    id: string; animation: string; frameCount: number;
    size: { w: number; h: number }; fps: number; loop: boolean; anchor: { x: number; y: number };
  };
  raw: { name: string; sha256: string }[];
  delivery: { name: string; sha256: string; pixelSha256: string; atlasRect: Rect }[];
  atlas: { checksum: string; metaChecksum: string };
  manifest: { checksum: string };
  reference: { path: string; sha256: string; pixelSha256: string };
  master: {
    path: string; sha256: string; pixelSha256: string;
    packCopy: { path: string; sha256: string; pixelSha256: string; note: string };
  };
  stylespec: { actual: PaletteSpec; pack: PaletteSpec };
  palette: { source: string; size: number; values: string[] };
  prompts: { actual: PromptEntry[]; pack: PromptEntry[] };
  standardVersion: string;
  thresholds: typeof ANIMATION_THRESHOLDS;
  expectedMetrics: AnimationMetrics;
  expectedMetricsTolerance: Record<keyof AnimationMetrics, number>;
  provenance: {
    failedRun: string; generatedDir: string; httpCallsLog: string;
    imageRequests: number; http200: number; pngResponses: number; textRequests: number;
    finalState: string; failureResource: string; logLines: string[]; note: string;
  };
};

const baseline = JSON.parse(fs.readFileSync(path.join(FIXTURE, "baseline.json"), "utf8")) as Baseline;
const PACK = path.join(ROOT, baseline.sourcePack.path);

const sha256 = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
const sha256File = (p: string): string => sha256(fs.readFileSync(p));
/** RGBA8 行主序原始像素（不含尺寸头）—— d 票 §3.2 的口径。 */
const pixelSha256 = (img: RasterImage): string => sha256(img.data);
const stripPrefix = (checksum: string): string => checksum.replace(/^sha256:/, "");

/** 所有失败都带这个前缀：资源 → 动画 → 帧。 */
const at = (frame: string): string =>
  `资源 "${baseline.asset.id}" 动画 "${baseline.asset.animation}" 帧 "${frame}"`;
const fixturePath = (dir: "raw" | "delivery", name: string): string => path.join(FIXTURE, dir, `${name}.png`);
const promptPath = (name: string): string => path.join(FIXTURE, "prompts", `${name}.txt`);
const paletteSizeOf = (text: string): number => {
  const line = text.split("\n").find((l) => l.startsWith("#000000"));
  return line ? line.trim().split(/\s+/).length : 0;
};

describe("baseline fixture：scavenger-actor.idle（v7）", () => {
  it("baseline.json 元数据、阈值与来源包对齐", () => {
    expect(baseline.baselineId, "baselineId").toBe("scavenger-actor.idle.v7.2026-10-19");
    expect(baseline.sourceCommit, "sourceCommit").toBe("e267ac4");
    expect(baseline.model, "model").toBe("gemini-2.5-flash-image");
    expect(baseline.standardVersion, "standardVersion").toBe("ticket-12/2026-10-21");
    expect(baseline.asset, "asset").toEqual({
      id: "scavenger-actor", animation: "idle", frameCount: 4,
      size: { w: 48, h: 64 }, fps: 6, loop: true, anchor: { x: 0.5, y: 1 },
    });
    expect(baseline.raw.length, "raw 帧数").toBe(4);
    expect(baseline.delivery.length, "delivery 帧数").toBe(4);
    expect(baseline.prompts.actual.length, "真实 Prompt 数").toBe(4);
    expect(baseline.prompts.pack.length, "重建 Prompt 数").toBe(4);

    // 阈值冻结：指标模块若被静默调阈值，这里先红。
    expect(baseline.thresholds, at("汇总") + " thresholds 与 ANIMATION_THRESHOLDS 不一致").toEqual(ANIMATION_THRESHOLDS);

    // 来源包身份与调色板：34 色是 v7 导入版，32 色是 19i 实际生成版。
    const manifest = JSON.parse(fs.readFileSync(path.join(PACK, "manifest.json"), "utf8")) as {
      id: string; version: number; palette: { size: number; values: string[] };
      assets: { id: string; frames: { name: string }[] }[];
    };
    expect(manifest.id, at("汇总") + " manifest.id").toBe(baseline.sourcePack.manifest.id);
    expect(manifest.version, at("汇总") + " manifest.version").toBe(baseline.sourcePack.manifest.version);
    expect(manifest.palette.size, at("汇总") + " manifest 调色板色数").toBe(34);
    expect(manifest.palette.values, at("汇总") + " manifest 调色板").toEqual(baseline.palette.values);
    expect(baseline.palette.size, at("汇总") + " baseline 调色板色数").toBe(34);
    expect(baseline.stylespec.actual.paletteSize, at("汇总") + " 真实 stylespec 色数").toBe(32);
    expect(baseline.stylespec.pack.paletteSize, at("汇总") + " v7 stylespec 色数").toBe(34);

    const actor = manifest.assets.find((a) => a.id === baseline.asset.id)!;
    const idle = actor.frames.filter((f) => f.name.includes(`.${baseline.asset.animation}`));
    expect(idle.length, at("汇总") + " manifest 内 idle 帧数").toBe(4);
  });

  it("4 张 raw：fixture hash、v7 源 hash、与 19i 现场同字节", () => {
    for (const entry of baseline.raw) {
      const fixture = fixturePath("raw", entry.name);
      expect(sha256File(fixture), at(entry.name) + " raw sha256").toBe(entry.sha256);
      const v7 = path.join(PACK, "authoring/generated", `${entry.name}.png`);
      expect(sha256File(v7), at(entry.name) + " 与 v7 源不逐字节相同").toBe(entry.sha256);
      const img = decodePNG(fs.readFileSync(fixture));
      expect([img.width, img.height], at(entry.name) + " raw 尺寸").toEqual([864, 1184]);
      // 19i 失败现场若仍在盘上，必须与 v7 逐字节相同（现场是 raw 的真实来源）。
      const n19 = path.join(ROOT, baseline.provenance.generatedDir, `${entry.name}.png`);
      if (fs.existsSync(n19)) {
        expect(sha256File(n19), at(entry.name) + " 19i 现场 raw 与 v7 不同").toBe(entry.sha256);
      }
    }
  });

  it("4 张 delivery：fixture hash、图集矩形无损裁剪、像素 hash", () => {
    const atlasBuf = fs.readFileSync(path.join(PACK, "delivery/atlas.animations.png"));
    const atlas = decodePNG(atlasBuf);
    const atlasJson = JSON.parse(fs.readFileSync(path.join(PACK, "delivery/atlas.animations.json"), "utf8")) as {
      frames: Record<string, { frame: Rect; rotated: boolean; trimmed: boolean }>;
    };
    for (const entry of baseline.delivery) {
      const fixture = fixturePath("delivery", entry.name);
      expect(sha256File(fixture), at(entry.name) + " delivery sha256").toBe(entry.sha256);
      const img = decodePNG(fs.readFileSync(fixture));
      expect([img.width, img.height], at(entry.name) + " delivery 尺寸").toEqual([48, 64]);
      expect(pixelSha256(img), at(entry.name) + " delivery 像素 sha256").toBe(entry.pixelSha256);

      const meta = atlasJson.frames[entry.name];
      expect(meta, at(entry.name) + " 图集缺帧").toBeDefined();
      expect(meta!.rotated, at(entry.name) + " 图集帧被旋转").toBe(false);
      expect(meta!.trimmed, at(entry.name) + " 图集帧被裁剪").toBe(false);
      expect(meta!.frame, at(entry.name) + " 图集矩形").toEqual(entry.atlasRect);
      const cropped = cropToBox(atlas, entry.atlasRect);
      expect(cropped.data.equals(img.data), at(entry.name) + " 与图集矩形裁剪不逐像素相同").toBe(true);
    }
  });

  it("v7 图集 / 图集 JSON / manifest 的 checksum 未漂移", () => {
    expect(sha256File(path.join(PACK, "delivery/atlas.animations.png")), at("汇总") + " 图集 checksum")
      .toBe(stripPrefix(baseline.atlas.checksum));
    expect(sha256File(path.join(PACK, "delivery/atlas.animations.json")), at("汇总") + " 图集 JSON checksum")
      .toBe(stripPrefix(baseline.atlas.metaChecksum));
    expect(sha256File(path.join(PACK, "manifest.json")), at("汇总") + " manifest checksum")
      .toBe(stripPrefix(baseline.manifest.checksum));

    const manifest = JSON.parse(fs.readFileSync(path.join(PACK, "manifest.json"), "utf8")) as {
      atlases: { id: string; checksum: string; meta: string; image: string }[];
    };
    const animations = manifest.atlases.find((a) => a.id === "animations")!;
    expect(animations.checksum, at("汇总") + " manifest 内图集 checksum").toBe(baseline.atlas.checksum);
    expect(animations.meta, at("汇总") + " manifest 图集 meta 路径").toBe("delivery/atlas.animations.json");
    expect(animations.image, at("汇总") + " manifest 图集 image 路径").toBe("delivery/atlas.animations.png");
  });

  it("reference / master：字节 hash 与像素 hash 分开钉住", () => {
    const refPath = path.join(ROOT, baseline.reference.path);
    expect(sha256File(refPath), at("汇总") + " reference sha256").toBe(baseline.reference.sha256);
    expect(pixelSha256(decodePNG(fs.readFileSync(refPath))), at("汇总") + " reference 像素 sha256")
      .toBe(baseline.reference.pixelSha256);

    const masterPath = path.join(ROOT, baseline.master.path);
    expect(sha256File(masterPath), at("汇总") + " 输入母版 sha256").toBe(baseline.master.sha256);
    const masterPixels = pixelSha256(decodePNG(fs.readFileSync(masterPath)));
    expect(masterPixels, at("汇总") + " 输入母版像素 sha256").toBe(baseline.master.pixelSha256);

    const packCopyPath = path.join(ROOT, baseline.master.packCopy.path);
    expect(sha256File(packCopyPath), at("汇总") + " 包内母版副本 sha256")
      .toBe(baseline.master.packCopy.sha256);
    expect(pixelSha256(decodePNG(fs.readFileSync(packCopyPath))), at("汇总") + " 包内母版副本像素 sha256")
      .toBe(baseline.master.packCopy.pixelSha256);
    // 重编码不同字节、同一像素：这正是 reference/master 要分开记两种 hash 的原因。
    expect(masterPixels, at("汇总") + " 母版输入与包内副本像素不同")
      .toBe(baseline.master.packCopy.pixelSha256);
    expect(baseline.master.sha256, at("汇总") + " 母版输入与包内副本字节相同（应不同）")
      .not.toBe(baseline.master.packCopy.sha256);
  });

  it("32 色真实 Prompt 与 34 色重建 Prompt 明确区分", () => {
    for (const [i, entry] of baseline.prompts.actual.entries()) {
      const text = fs.readFileSync(promptPath(entry.name), "utf8");
      expect(sha256(Buffer.from(text)), at(`idle${i + 1}`) + " 真实 Prompt sha256").toBe(entry.sha256);
      expect(paletteSizeOf(text), at(`idle${i + 1}`) + " 真实 Prompt 色数").toBe(32);
      expect(text.includes("#59503b") || text.includes("#50432b"), at(`idle${i + 1}`) + " 真实 Prompt 混入 34 色增量")
        .toBe(false);
    }
    for (const [i, entry] of baseline.prompts.pack.entries()) {
      const text = fs.readFileSync(promptPath(entry.name), "utf8");
      expect(sha256(Buffer.from(text)), at(`idle${i + 1}`) + " 重建 Prompt sha256").toBe(entry.sha256);
      expect(paletteSizeOf(text), at(`idle${i + 1}`) + " 重建 Prompt 色数").toBe(34);
      expect(text.includes("#59503b") && text.includes("#50432b"), at(`idle${i + 1}`) + " 重建 Prompt 缺 34 色增量")
        .toBe(true);
    }

    for (let i = 0; i < baseline.prompts.actual.length; i++) {
      const actual = fs.readFileSync(promptPath(baseline.prompts.actual[i]!.name), "utf8");
      const pack = fs.readFileSync(promptPath(baseline.prompts.pack[i]!.name), "utf8");
      expect(actual, at(`idle${i + 1}`) + " 真实 Prompt 与重建 Prompt 不应相同").not.toBe(pack);
      const aLines = actual.split("\n");
      const pLines = pack.split("\n");
      expect(aLines.length, at(`idle${i + 1}`) + " 两份 Prompt 行数").toBe(pLines.length);
      aLines.forEach((line, n) => {
        if (line === pLines[n]) return;
        expect(
          line.startsWith("#000000") && pLines[n]!.startsWith("#000000"),
          at(`idle${i + 1}`) + ` 第 ${n + 1} 行非调色板差异`,
        ).toBe(true);
      });
    }
  });

  it("期望指标（animation-metrics 复算）在容差内且整体判绿", () => {
    const frames = baseline.raw.map((entry, i) => {
      const raw = decodePNG(fs.readFileSync(fixturePath("raw", entry.name)));
      const delivery = decodePNG(fs.readFileSync(fixturePath("delivery", baseline.delivery[i]!.name)));
      const bbox: InkBox | null = cleanBBox(raw);
      expect(bbox, at(entry.name) + " 抠底后没有墨").not.toBeNull();
      return { name: entry.name, raw, delivery, bbox: bbox!, key: dominantOpaqueColor(raw).color };
    });

    const placement = (f: (typeof frames)[number]) => ({
      bbox: f.bbox, sourceWidth: f.raw.width, sourceHeight: f.raw.height,
    });
    const pairs: { frame: string; alpha: number; width: number; position: number; keyL1: number }[] = [];
    for (let i = 0; i < frames.length; i++) {
      for (let j = i + 1; j < frames.length; j++) {
        const x = frames[i]!;
        const y = frames[j]!;
        pairs.push({
          frame: `idle${i + 1}~idle${j + 1}`,
          alpha: alphaMaskDiff(x.delivery, y.delivery),
          width: bboxWidthDiffPct(x.bbox, y.bbox)!,
          position: positionDriftPct(placement(x), placement(y))!,
          keyL1: dominantColorL1(x.key, y.key),
        });
      }
    }
    const maxOf = (pick: (p: (typeof pairs)[number]) => number) =>
      pairs.reduce((a, b) => (pick(b) > pick(a) ? b : a));
    const minOf = (pick: (f: (typeof frames)[number]) => number) =>
      frames.reduce((a, b) => (pick(b) < pick(a) ? b : a));

    const metrics: AnimationMetrics = {
      alphaMaskDiffPct: maxOf((p) => p.alpha).alpha,
      bboxWidthDiffPct: maxOf((p) => p.width).width,
      positionDriftPct: maxOf((p) => p.position).position,
      backgroundL1: maxOf((p) => p.keyL1).keyL1,
      paletteCountMin: Math.min(...frames.map((f) => paletteCount(f.delivery))),
      offPalette: Math.max(...frames.map((f) => offPaletteCount(f.delivery, baseline.palette.values))),
      boundaryDarkPctMin: Math.min(...frames.map((f) => boundaryDarkPct(f.delivery, baseline.palette.values)!)),
    };

    const tol = baseline.expectedMetricsTolerance;
    const near = (a: number, b: number, t: number) => Math.abs(a - b) <= t;

    const alphaWorst = maxOf((p) => p.alpha);
    const widthWorst = maxOf((p) => p.width);
    const positionWorst = maxOf((p) => p.position);
    const keyWorst = maxOf((p) => p.keyL1);
    const paletteWorst = minOf((f) => paletteCount(f.delivery));
    const offWorst = frames.reduce((a, b) =>
      offPaletteCount(b.delivery, baseline.palette.values) > offPaletteCount(a.delivery, baseline.palette.values) ? b : a);
    const boundaryWorst = minOf((f) => boundaryDarkPct(f.delivery, baseline.palette.values)!);

    expect(
      near(metrics.alphaMaskDiffPct, baseline.expectedMetrics.alphaMaskDiffPct, tol.alphaMaskDiffPct),
      at(alphaWorst.frame) + ` alpha 掩码差 ${metrics.alphaMaskDiffPct}%（期望 ${baseline.expectedMetrics.alphaMaskDiffPct} ±${tol.alphaMaskDiffPct}）`,
    ).toBe(true);
    expect(
      near(metrics.bboxWidthDiffPct, baseline.expectedMetrics.bboxWidthDiffPct, tol.bboxWidthDiffPct),
      at(widthWorst.frame) + ` bbox 宽差 ${metrics.bboxWidthDiffPct}%（期望 ${baseline.expectedMetrics.bboxWidthDiffPct} ±${tol.bboxWidthDiffPct}）`,
    ).toBe(true);
    expect(
      near(metrics.positionDriftPct, baseline.expectedMetrics.positionDriftPct, tol.positionDriftPct),
      at(positionWorst.frame) + ` 位置漂移 ${metrics.positionDriftPct}%（期望 ${baseline.expectedMetrics.positionDriftPct} ±${tol.positionDriftPct}）`,
    ).toBe(true);
    expect(
      near(metrics.backgroundL1, baseline.expectedMetrics.backgroundL1, tol.backgroundL1),
      at(keyWorst.frame) + ` 背景 L1 ${metrics.backgroundL1}（期望 ${baseline.expectedMetrics.backgroundL1} ±${tol.backgroundL1}）`,
    ).toBe(true);
    expect(
      near(metrics.paletteCountMin, baseline.expectedMetrics.paletteCountMin, tol.paletteCountMin),
      at(paletteWorst.name) + ` 调色板色数 ${metrics.paletteCountMin}（期望 ${baseline.expectedMetrics.paletteCountMin} ±${tol.paletteCountMin}）`,
    ).toBe(true);
    expect(
      near(metrics.offPalette, baseline.expectedMetrics.offPalette, tol.offPalette),
      at(offWorst.name) + ` off-palette ${metrics.offPalette}（期望 ${baseline.expectedMetrics.offPalette} ±${tol.offPalette}）`,
    ).toBe(true);
    expect(
      near(metrics.boundaryDarkPctMin, baseline.expectedMetrics.boundaryDarkPctMin, tol.boundaryDarkPctMin),
      at(boundaryWorst.name) + ` 边界深色 ${metrics.boundaryDarkPctMin}%（期望 ${baseline.expectedMetrics.boundaryDarkPctMin} ±${tol.boundaryDarkPctMin}）`,
    ).toBe(true);

    expect(verdictOf(metrics), at("汇总") + " 票 12 机械闸判定").toBe("green");
  });
});
