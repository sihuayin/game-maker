import fs from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  ANIMATION_ACCEPTANCE_FORMAT, parseAnimationAcceptance,
  type AcceptanceFinding, type AssetPackManifest,
} from "@game-maker/contracts";
import {
  ACCEPTANCE_FINDING_CODES, buildAtlas, decodePNG, emptyImage, encodePNG,
  exitCodeOfError, type RasterImage,
} from "../src/index.js";
import { acceptAnimationPack, writeAcceptanceReport } from "../src/acceptance.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const V7 = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7");
const BASELINE = path.join(ROOT, "fixtures/animation-baselines/scavenger-idle");

const dirs: string[] = [];
const tmp = (tag: string): string => {
  const d = fs.mkdtempSync(path.join(tmpdir(), `acceptance-${tag}-`));
  dirs.push(d);
  return d;
};
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const jstr = (o: unknown): string => JSON.stringify(o, null, 2) + "\n";

type WrittenPack = { packDir: string; manifest: AssetPackManifest };

/** 8×8 的合成帧：透明底 + 一个 4×4 的色块（每帧左右错 1px，便于量位置漂移）。 */
function frameImage(index: number): RasterImage {
  const img = emptyImage(8, 8);
  const x0 = 1 + (index % 2);
  for (let y = 2; y < 6; y++)
    for (let x = x0; x < x0 + 4; x++) {
      const o = (y * 8 + x) * 4;
      img.data[o] = 0x11; img.data[o + 1] = 0x22; img.data[o + 2] = 0x33; img.data[o + 3] = 255;
    }
  return img;
}

/**
 * 创作态 raw 帧：**带不透明底色**（与交付帧不同）。
 * ⚠️ `cleanBBox` 的第一步是抠掉众数色；给一张本来就没有底的透明图，它会连角色一起抠掉，
 *    指标因此不可用 —— 这不是验收器的 bug，是夹具不成立。
 */
function rawFrameImage(index: number): RasterImage {
  const img = emptyImage(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const o = (y * 16 + x) * 4;
      img.data[o] = 0x99; img.data[o + 1] = 0x99; img.data[o + 2] = 0x99; img.data[o + 3] = 255;
    }
  const x0 = 4 + (index % 2);
  for (let y = 5; y < 11; y++)
    for (let x = x0; x < x0 + 6; x++) {
      const o = (y * 16 + x) * 4;
      img.data[o] = 0x11; img.data[o + 1] = 0x22; img.data[o + 2] = 0x33; img.data[o + 3] = 255;
    }
  return img;
}

type MakePackOptions = {
  id?: string;
  /** 图集 JSON 里真实存在的帧。 */
  atlasFrameNames?: string[];
  /** manifest 资源声明的帧（默认同 `atlasFrameNames`；用于「缺帧」负例）。 */
  manifestFrameNames?: string[];
  /** `atlases[].frames` 的谎言值。 */
  declaredFrameCount?: number;
  /** 覆写图集 PNG 的字节（非 PNG 负例）。 */
  imageOverride?: Buffer;
  /** 写盘前改图集 JSON（越界 / 锚点 / 尺寸负例）。 */
  mutateAtlas?: (json: Record<string, unknown> & { frames: Record<string, any> }) => void;
  /** 让第二个资源也声明这个帧名（跨资源同名负例）。 */
  duplicateAssetFrame?: string;
  /** 写 raw 源图（baseline 指标需要）。 */
  withAuthoring?: boolean;
};

/** 合成一个最小合法包（8×8、一张图集、1 个动画资源）。 */
function makePack(tag: string, opts: MakePackOptions = {}): WrittenPack {
  const packDir = tmp(tag);
  fs.mkdirSync(path.join(packDir, "delivery"), { recursive: true });
  const atlasFrameNames = opts.atlasFrameNames ?? ["hero.idle1", "hero.idle2"];
  const manifestFrameNames = opts.manifestFrameNames ?? atlasFrameNames;
  const images = new Map(atlasFrameNames.map((name, i) => [name, frameImage(i)]));
  const built = buildAtlas(atlasFrameNames.map((name, i) => ({
    name, image: images.get(name)!, anchor: { x: 0.5, y: 1 },
  })));
  const atlasJson = JSON.parse(JSON.stringify(built.json)) as {
    frames: Record<string, any>;
    meta: { image: string; size: { w: number; h: number } };
  };
  atlasJson.meta.image = "atlas.animations.png";
  opts.mutateAtlas?.(atlasJson);
  const imageBytes = opts.imageOverride ?? encodePNG(built.image);
  const metaRel = "delivery/atlas.animations.json";
  const imageRel = "delivery/atlas.animations.png";
  fs.writeFileSync(path.join(packDir, metaRel), jstr(atlasJson));
  fs.writeFileSync(path.join(packDir, imageRel), imageBytes);

  const written = [metaRel, imageRel];
  if (opts.withAuthoring) {
    fs.mkdirSync(path.join(packDir, "authoring/generated"), { recursive: true });
    for (const [i, name] of manifestFrameNames.entries()) {
      if (!images.has(name)) continue;
      const rel = `authoring/generated/${name}.png`;
      fs.writeFileSync(path.join(packDir, rel), encodePNG(rawFrameImage(i)));
      written.push(rel);
    }
  }

  const sha = (buf: Buffer): string => "sha256:" + createHash("sha256").update(buf).digest("hex");
  const files = written.map((rel) => {
    const buf = fs.readFileSync(path.join(packDir, rel));
    return { path: rel, bytes: buf.length, checksum: sha(buf) };
  });

  const asset = {
    id: "hero",
    kind: "animation",
    role: "player",
    origin: "generated",
    paletteBinding: "unbound",
    size: { w: 8, h: 8 },
    anchor: { x: 0.5, y: 1 },
    atlasId: "animations",
    frames: manifestFrameNames.map((name) => ({ name })),
    animations: [{ name: "idle", frames: manifestFrameNames, fps: 6, loop: true }],
    authoring: opts.withAuthoring
      ? manifestFrameNames
        .filter((name) => images.has(name))
        .map((name) => ({ kind: "bitmap", ref: `authoring/generated/${name}.png` }))
      : [],
  };
  const assets: unknown[] = [asset];
  if (opts.duplicateAssetFrame !== undefined)
    assets.push({
      id: "hero-copy",
      kind: "sprite",
      role: "prop",
      origin: "generated",
      paletteBinding: "unbound",
      size: { w: 8, h: 8 },
      anchor: { x: 0.5, y: 1 },
      atlasId: "animations",
      frames: [{ name: opts.duplicateAssetFrame }],
      authoring: [],
    });

  const manifest = {
    format: "assetpack/v4",
    id: opts.id ?? "synthetic",
    version: 1,
    createdAt: "2026-10-21T00:00:00.000Z",
    generator: { name: "test", version: "0" },
    provenance: { mode: "generated" },
    palette: {
      ref: "authoring/stylespec.json#/palette", size: 1, values: ["#112233"],
      coverage: { exact: 0, composited: 0, quantized: 0, unbound: assets.length },
    },
    atlases: [{
      id: "animations",
      kind: "animation",
      meta: metaRel,
      image: imageRel,
      size: { w: built.image.width, h: built.image.height },
      frames: opts.declaredFrameCount ?? atlasFrameNames.length,
      assets: assets.length === 1 ? ["hero"] : ["hero", "hero-copy"],
      checksum: sha(imageBytes),
    }],
    assets,
    files,
  } as unknown as AssetPackManifest;
  fs.writeFileSync(path.join(packDir, "manifest.json"), jstr(manifest));
  return { packDir, manifest };
}

function codesOf(packDir: string): AcceptanceFinding["code"][] {
  return acceptAnimationPack({ packDir }).report.findings.map((f) => f.code);
}

function errorCodesOf(packDir: string): AcceptanceFinding["code"][] {
  return acceptAnimationPack({ packDir }).report.findings
    .filter((f) => f.severity === "error").map((f) => f.code);
}

type BaselineAsset = { id: string; animation: string };

function writeBaseline(
  dir: string,
  frameNames: string[],
  rawNames = frameNames,
  asset: BaselineAsset = { id: "hero", animation: "idle" },
): string {
  const json = {
    baselineId: "hero.idle.v1.2026-10-21",
    sourceCommit: "test",
    sourcePack: { path: "synthetic", manifest: { id: "synthetic", version: 1 } },
    model: "test",
    asset: { ...asset, frameCount: frameNames.length },
    raw: rawNames.map((name) => ({ name, sha256: "a".repeat(64) })),
    delivery: frameNames.map((name) => ({
      name, sha256: "b".repeat(64), atlasRect: { x: 0, y: 0, w: 8, h: 8 },
    })),
    atlas: { checksum: "sha256:" + "c".repeat(64), metaChecksum: "sha256:" + "d".repeat(64) },
    manifest: { checksum: "sha256:" + "e".repeat(64) },
    reference: { path: "reference.png", sha256: "f".repeat(64) },
    master: { path: "master.png", sha256: "0".repeat(64) },
    stylespec: { actual: {}, pack: {} },
    standardVersion: "ticket-12/2026-10-21",
    thresholds: {},
    expectedMetrics: {},
    provenance: {},
    palette: { values: ["#112233"] },
  };
  fs.writeFileSync(path.join(dir, "baseline.json"), jstr(json));
  return dir;
}

describe("票 05 · v7 正例（结构 + baseline 指标）", () => {
  it("v7 结构全绿；idle 的 7 项读数与冻结 baseline 一致", () => {
    const result = acceptAnimationPack({
      packDir: V7,
      baselineDir: BASELINE,
      now: new Date("2026-10-21T00:00:00.000Z"),
    });
    expect(result.report.findings).toEqual([]);
    expect(result.hasErrors).toBe(false);
    expect(parseAnimationAcceptance(result.report).ok).toBe(true);
    expect(result.report.pack).toMatchObject({ id: "ruin-scavenger-extraction-assets", version: 7 });
    expect(result.report.pack.atlases.map((a) => a.id)).toEqual(["animations", "backgrounds", "sprites", "ui"]);
    expect(result.report.animations).toHaveLength(13);

    const idle = result.report.animations.find((a) => a.assetId === "scavenger-actor" && a.anim === "idle");
    expect(idle).toBeDefined();
    expect(idle!.frames).toEqual([
      "scavenger-actor.idle1", "scavenger-actor.idle2",
      "scavenger-actor.idle3", "scavenger-actor.idle4",
    ]);
    expect(idle!.declared).toEqual({ fps: 6, loop: true });
    expect(idle!.metrics).not.toBeNull();
    expect(idle!.metrics).toMatchObject({
      alphaMaskDiffPct: 0.4,
      bboxWidthDiffPct: 0.2,
      positionDriftPct: 0.4,
      backgroundL1: 3,
      offPalette: 0,
    });
    expect(idle!.metrics!.paletteCountMin).toBeGreaterThanOrEqual(18);
    expect(idle!.metrics!.boundaryDarkPctMin).toBeCloseTo(87.4, 1);
    expect(idle!.verdict).toBe("green");

    // 票 10：baseline 只覆盖 scavenger-actor.idle —— 其余 12 个动画只保留观察读数。
    // 注意 scrap-resource.idle / clean-water.idle 动画名同为 idle，但 asset.id 不同，也不算覆盖。
    const others = result.report.animations.filter(
      (a) => !(a.assetId === "scavenger-actor" && a.anim === "idle"),
    );
    expect(others).toHaveLength(12);
    for (const a of others) {
      expect(a.verdict, `${a.assetId}.${a.anim} 不在 baseline 覆盖内`).toBeNull();
      expect(a.metrics, `${a.assetId}.${a.anim} 仍应有观察 metrics`).not.toBeNull();
    }
    expect(result.summary.join("\n")).toMatch(/verdict 只在 baseline 覆盖的动画上计算/);
    expect(result.summary.join("\n")).toMatch(/verdict 覆盖：scavenger-actor\.idle(?![.\w-])/);

    expect(result.report.baseline).toMatchObject({
      id: "scavenger-actor.idle.v7.2026-10-19",
      standardVersion: "ticket-12/2026-10-21",
    });
    expect(result.report.baseline!.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.report.runtime).toEqual({ status: "unverified", evidence: [], declaredVsActual: [] });
    expect(result.report.human.items).toHaveLength(7);
  }, 120_000);
});

describe("票 05 · 负例：每条 finding 都能定位到 file / asset / frame", () => {
  it("非 PNG ⇒ atlas.image.undecodable", () => {
    const { packDir } = makePack("not-png", { imageOverride: Buffer.from("not a png") });
    const findings = acceptAnimationPack({ packDir }).report.findings;
    const hit = findings.find((f) => f.code === "atlas.image.undecodable");
    expect(hit?.severity).toBe("error");
    expect(hit?.file).toBe("delivery/atlas.animations.png");
  });

  it("帧矩形越界 ⇒ atlas.frame.out-of-bounds（定位到帧）", () => {
    const { packDir } = makePack("oob", {
      mutateAtlas: (json) => { json.frames["hero.idle1"]!.frame.x = 9999; },
    });
    const hit = acceptAnimationPack({ packDir }).report.findings.find((f) => f.code === "atlas.frame.out-of-bounds");
    expect(hit).toMatchObject({ severity: "error", assetId: "hero", anim: "idle", frame: "hero.idle1" });
  });

  it("缺帧 ⇒ atlas.frame.missing（manifest 声明、图集 JSON 没有）", () => {
    const { packDir } = makePack("missing", {
      atlasFrameNames: ["hero.idle1"],
      manifestFrameNames: ["hero.idle1", "hero.idle2"],
    });
    const hit = acceptAnimationPack({ packDir }).report.findings.find((f) => f.code === "atlas.frame.missing");
    expect(hit).toMatchObject({ severity: "error", assetId: "hero", anim: "idle", frame: "hero.idle2" });
  });

  it("幽灵帧 ⇒ atlas.frame.ghost（warning，不阻断）", () => {
    const { packDir } = makePack("ghost", {
      atlasFrameNames: ["hero.idle1", "hero.idle2"],
      manifestFrameNames: ["hero.idle1"],
    });
    const result = acceptAnimationPack({ packDir });
    const hit = result.report.findings.find((f) => f.code === "atlas.frame.ghost");
    expect(hit).toMatchObject({ severity: "warning", frame: "hero.idle2" });
    expect(result.hasErrors).toBe(false);
  });

  it("atlases[].frames 说谎 ⇒ atlas.frames.count-mismatch", () => {
    const { packDir } = makePack("count", { declaredFrameCount: 99 });
    const hit = acceptAnimationPack({ packDir }).report.findings.find((f) => f.code === "atlas.frames.count-mismatch");
    expect(hit).toMatchObject({ severity: "error", file: "delivery/atlas.animations.json" });
  });

  it("锚点 / 尺寸不一致 ⇒ 两条各定位到帧", () => {
    const { packDir } = makePack("anchor-size", {
      mutateAtlas: (json) => {
        json.frames["hero.idle1"]!.anchor.x = 0.25;
        json.frames["hero.idle2"]!.sourceSize.w = 9;
      },
    });
    const findings = acceptAnimationPack({ packDir }).report.findings;
    expect(findings.find((f) => f.code === "atlas.frame.anchor-mismatch")).toMatchObject({
      severity: "error", assetId: "hero", anim: "idle", frame: "hero.idle1",
    });
    expect(findings.find((f) => f.code === "atlas.frame.source-size-mismatch")).toMatchObject({
      severity: "error", assetId: "hero", frame: "hero.idle2",
    });
  });

  it("跨资源同名帧 ⇒ atlas.frame.duplicate-across-assets", () => {
    const { packDir } = makePack("duplicate", { duplicateAssetFrame: "hero.idle1" });
    const hit = acceptAnimationPack({ packDir }).report.findings
      .find((f) => f.code === "atlas.frame.duplicate-across-assets");
    expect(hit).toMatchObject({ severity: "error", frame: "hero.idle1" });
    expect(hit?.message).toMatch(/hero-copy/);
  });

  it("所有产出的 code 都在闭集内", () => {
    const { packDir } = makePack("closed-set", {
      atlasFrameNames: ["hero.idle1"],
      manifestFrameNames: ["hero.idle1", "hero.idle2"],
      declaredFrameCount: 99,
      mutateAtlas: (json) => {
        json.frames["hero.idle1"]!.anchor.x = 0.25;
        json.frames["hero.idle1"]!.sourceSize.w = 9;
      },
      duplicateAssetFrame: "hero.idle1",
    });
    const findings = acceptAnimationPack({ packDir }).report.findings;
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings)
      expect(ACCEPTANCE_FINDING_CODES, `未知 code：${f.code}`).toContain(f.code);
    expect(errorCodesOf(packDir).length).toBeGreaterThan(0);
  });
});

describe("票 05 · baseline 与输入不合法", () => {
  it("baseline 覆盖的动画：metrics + verdict 都填；raw 帧名对不上留 warning", () => {
    const { packDir } = makePack("baseline", { withAuthoring: true });
    const baselineDir = writeBaseline(tmp("baseline-dir"), ["hero.idle1", "hero.idle2"], ["hero.idle1", "not-in-pack"]);
    const result = acceptAnimationPack({ packDir, baselineDir });
    expect(result.report.baseline).toMatchObject({ id: "hero.idle.v1.2026-10-21" });
    const anim = result.report.animations[0]!;
    expect(anim.metrics).not.toBeNull();
    expect(anim.metrics!.paletteCountMin).toBe(1);
    expect(anim.metrics!.offPalette).toBe(0);
    expect(["green", "yellow", "red"]).toContain(anim.verdict);
    expect(result.report.findings.find((f) => f.code === "baseline.frame-unmatched")).toMatchObject({
      severity: "warning", frame: "not-in-pack",
    });

    // summary 与 report.md 都写明覆盖范围（票 10）。
    expect(result.summary.join("\n")).toMatch(/verdict 覆盖：hero\.idle(?![.\w-])/);
    expect(result.summary.join("\n")).toMatch(/verdict 只在 baseline 覆盖的动画上计算/);
    const outDir = tmp("baseline-md");
    const written = writeAcceptanceReport({ report: result.report, outDir });
    const md = fs.readFileSync(path.join(outDir, written.reportMarkdown), "utf8");
    expect(md).toMatch(/verdict 覆盖：hero\.idle(?![.\w-]) —— verdict 只在 baseline 覆盖的动画上计算/);
  });

  it("baseline 不覆盖的动画：metrics 保留，verdict 为 null（票 10）", () => {
    const { packDir } = makePack("baseline-uncovered", { withAuthoring: true });

    // 动画名不匹配 ⇒ 不覆盖。
    const byAnim = acceptAnimationPack({
      packDir,
      baselineDir: writeBaseline(
        tmp("baseline-other-anim"), ["hero.idle1", "hero.idle2"], undefined,
        { id: "hero", animation: "run" },
      ),
    });
    const anim = byAnim.report.animations[0]!;
    expect(anim.metrics).not.toBeNull();
    expect(anim.verdict).toBeNull();
    expect(byAnim.summary.join("\n")).toMatch(/verdict 覆盖：无（当前包没有 baseline 覆盖的动画）/);
    const outDir = tmp("baseline-uncovered-md");
    const written = writeAcceptanceReport({ report: byAnim.report, outDir });
    expect(fs.readFileSync(path.join(outDir, written.reportMarkdown), "utf8"))
      .toMatch(/verdict 覆盖：无 —— verdict 只在 baseline 覆盖的动画上计算/);

    // 资源 id 不匹配（动画名同为 idle）⇒ 也不覆盖。
    const byAsset = acceptAnimationPack({
      packDir,
      baselineDir: writeBaseline(
        tmp("baseline-other-asset"), ["hero.idle1", "hero.idle2"], undefined,
        { id: "hero-copy", animation: "idle" },
      ),
    });
    expect(byAsset.report.animations[0]!.metrics).not.toBeNull();
    expect(byAsset.report.animations[0]!.verdict).toBeNull();
    expect(byAsset.summary.join("\n")).toMatch(/verdict 覆盖：无/);
  });

  it("无 baseline ⇒ metrics / verdict 为 null", () => {
    const { packDir } = makePack("no-baseline", { withAuthoring: true });
    const result = acceptAnimationPack({ packDir });
    expect(result.report.baseline).toBeNull();
    expect(result.report.animations[0]!.metrics).toBeNull();
    expect(result.report.animations[0]!.verdict).toBeNull();
  });

  it("坏 manifest ⇒ CommandError invalid（exit 4），不是 findings", () => {
    const packDir = tmp("bad-manifest");
    fs.writeFileSync(path.join(packDir, "manifest.json"), "{}");
    let error: unknown;
    try { acceptAnimationPack({ packDir }); } catch (e) { error = e; }
    expect(error).toBeDefined();
    expect(exitCodeOfError(error)).toBe(4);
    expect((error as { kind?: string }).kind).toBe("invalid");
  });

  it("坏 baseline schema ⇒ exit 4", () => {
    const { packDir } = makePack("bad-baseline-pack");
    const baselineDir = tmp("bad-baseline");
    fs.writeFileSync(path.join(baselineDir, "baseline.json"), "{}");
    let error: unknown;
    try { acceptAnimationPack({ packDir, baselineDir }); } catch (e) { error = e; }
    expect(exitCodeOfError(error)).toBe(4);
  });
});

describe("票 05 · 报告写入：schema 通过 + 版本不覆盖", () => {
  it("v1 与 v2 并存，v1 逐字节不变；Markdown 同行落盘", () => {
    const { packDir } = makePack("report", { withAuthoring: true });
    const result = acceptAnimationPack({ packDir, now: new Date("2026-10-21T00:00:00.000Z") });
    const outDir = tmp("out");
    const first = writeAcceptanceReport({ report: result.report, outDir });
    expect(first).toEqual({
      version: 1,
      dir: "synthetic/acceptance/v1",
      reportJson: "synthetic/acceptance/v1/report.json",
      reportMarkdown: "synthetic/acceptance/v1/report.md",
    });
    const jsonPath = path.join(outDir, first.reportJson);
    const mdPath = path.join(outDir, first.reportMarkdown);
    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(mdPath)).toBe(true);
    const bytes = fs.readFileSync(jsonPath, "utf8");
    const parsed = parseAnimationAcceptance(JSON.parse(bytes));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.format).toBe(ANIMATION_ACCEPTANCE_FORMAT);
    expect(fs.readFileSync(mdPath, "utf8")).toMatch(/动画验收报告 · synthetic v1/);

    const second = writeAcceptanceReport({ report: result.report, outDir });
    expect(second.version).toBe(2);
    expect(fs.readFileSync(jsonPath, "utf8")).toBe(bytes);
    expect(fs.existsSync(path.join(outDir, "synthetic/acceptance/v2/report.json"))).toBe(true);
  });

  it("有 error findings 时报告仍然写盘（findings 不阻止落盘）", () => {
    const { packDir } = makePack("report-findings", {
      atlasFrameNames: ["hero.idle1"],
      manifestFrameNames: ["hero.idle1", "hero.idle2"],
    });
    const result = acceptAnimationPack({ packDir });
    expect(result.hasErrors).toBe(true);
    const outDir = tmp("out-findings");
    const written = writeAcceptanceReport({ report: result.report, outDir });
    const parsed = parseAnimationAcceptance(
      JSON.parse(fs.readFileSync(path.join(outDir, written.reportJson), "utf8")),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.findings.some((f) => f.severity === "error")).toBe(true);
      expect(parsed.value.findings.every((f) => f.file || f.assetId || f.anim || f.frame)).toBe(true);
    }
    expect(fs.existsSync(path.join(outDir, written.reportMarkdown))).toBe(true);
  });

  it("manifest.id 不能安全用作目录名 ⇒ 拒绝（exit 4）", () => {
    const { packDir } = makePack("unsafe-id");
    const result = acceptAnimationPack({ packDir });
    const report = { ...result.report, pack: { ...result.report.pack, id: "../escape" } };
    let error: unknown;
    try { writeAcceptanceReport({ report, outDir: tmp("unsafe-out") }); } catch (e) { error = e; }
    expect(exitCodeOfError(error)).toBe(4);
  });

  it("合成包用 decodePNG 读出帧图（夹具自检）", () => {
    const { packDir } = makePack("selfcheck", { withAuthoring: true });
    const img = decodePNG(fs.readFileSync(path.join(packDir, "delivery/atlas.animations.png")));
    expect(img.width).toBeGreaterThan(0);
  });
});
