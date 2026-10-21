// 交付态**结构验收器** + `animation-acceptance/v1` 报告 writer（Phase 1 Q4 A · 票 05）。
//
// 三条边界：
//   1. **findings 不抛** —— 结构问题是一份可定位的报告，不是异常；CLI / MCP 按
//      `severity: "error"` 决定 exit 1（计划 §5）。
//   2. **输入不合法才抛** `CommandError("invalid")`（exit 4）：坏 manifest、坏 baseline
//      schema、找不到图集 PNG。⚠️ 与「验收失败」是两件事，别把它们混成一个退出码。
//   3. **绝不覆盖** —— 报告写进 `out/<packId>/acceptance/v<N>/`，版本号只增不减；
//      目录用 `mkdirSync` 的 `EEXIST` 抢，而不是「先读最高版本再写」。
//
// ⚠️ `manifest.id` 是用户可控的字符串，直接拼进输出目录会把 `"../x"` 变成目录穿越。
//    写入侧显式拒绝不能安全用作单段目录名的 id（而不是悄悄 slug 成另一个名字 ——
//    那会让两份不同的包落进同一个目录）。
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ANIMATION_ACCEPTANCE_FORMAT, AtlasJson, CommandError, HUMAN_REVIEW_ITEM_KEYS,
  formatIssues, parseAnimationAcceptance, parseAssetPack,
  type AcceptanceAnimation, type AcceptanceFinding, type AcceptanceMetrics, type AcceptanceSeverity,
  type AnimationAcceptance, type AssetPackEntry, type AssetPackManifest,
  type AtlasJson as AtlasJsonDoc, type AtlasFrame, type HumanReviewItemKey,
} from "@game-maker/contracts";
import {
  alphaMaskDiff, bboxWidthDiffPct, boundaryDarkPct, cleanBBox, dominantColorL1,
  offPaletteCount, paletteCount, positionDriftPct, verdictOf,
  type AnimationMetrics, type InkBox, type MetricTier,
} from "./animation-metrics.js";
import { cropToBox } from "./import.js";
import { verifyPack } from "./ops.js";
import { decodePNG } from "./png.js";
import type { RasterImage } from "./image.js";

/**
 * 本验收器**唯一允许产出**的 finding code 闭集。
 *
 * ⚠️ 契约层 `findings[].code` 仍是 `string`（码表由实现方拥有，见 `animation-acceptance.ts`
 * 那段注）。闭集住在这里：新增检查 = 在这里加一个码，而不是随手写一句没人认识的字符串。
 */
export const ACCEPTANCE_FINDING_CODES = [
  "pack.atlas.file-missing",
  "atlas.json.unreadable",
  "atlas.json.invalid",
  "atlas.image.undecodable",
  "atlas.image.size-mismatch",
  "atlas.image.checksum-mismatch",
  "atlas.frames.count-mismatch",
  "atlas.frame.out-of-bounds",
  "atlas.frame.missing",
  "atlas.frame.ghost",
  "atlas.frame.duplicate-across-assets",
  "atlas.frame.size-mismatch",
  "atlas.frame.trim-out-of-bounds",
  "atlas.frame.source-size-mismatch",
  "atlas.frame.anchor-mismatch",
  "atlas.frame.scale9-mismatch",
  "animation.frame.missing",
  "animation.frame.duplicate",
  "animation.frame.order",
  "metrics.unavailable",
  "baseline.frame-unmatched",
] as const;

export type AcceptanceFindingCode = (typeof ACCEPTANCE_FINDING_CODES)[number];

/** 默认工具版本 —— 与根 `package.json` 的 `0.0.0` 一致（计划 §4.1 的示例值）。 */
export const ACCEPTANCE_TOOL_VERSION = "0.0.0";

export type AcceptAnimationPackOptions = {
  packDir: string;
  /**
   * 可选的冻结基准目录；给了才计算 `metrics`，且**只对 baseline 覆盖的 `asset.anim`**
   * 计算 `verdict`（票 10）。
   */
  baselineDir?: string;
  /** 注入报告时间（测试可复现）；默认现在。 */
  now?: Date;
  toolVersion?: string;
};

export type AcceptanceResult = {
  report: AnimationAcceptance;
  /** `severity: "error"` 是否存在 —— CLI exit 1 的唯一判据（warning / info 不阻断）。 */
  hasErrors: boolean;
  summary: string[];
};

export type WriteAcceptanceReportOptions = {
  report: AnimationAcceptance;
  /** 默认 `./out`（与 CLI 的默认值一致）。 */
  outDir?: string;
};

/** 返回**相对 `outDir` 的 POSIX 路径**（与 `CommandResult.data` 的路径口径一致）。 */
export type WrittenAcceptanceReport = {
  version: number;
  dir: string;
  reportJson: string;
  reportMarkdown: string;
};

type Loc = {
  file?: string;
  assetId?: string;
  anim?: string;
  frame?: string;
};

type ParsedAtlas = {
  entry: AssetPackManifest["atlases"][number];
  json: AtlasJsonDoc | null;
  image: RasterImage | null;
};

const jstr = (o: unknown): string => JSON.stringify(o, null, 2) + "\n";
const sha256 = (b: Buffer): string => "sha256:" + createHash("sha256").update(b).digest("hex");
const toPosix = (p: string): string => p.split(path.sep).join("/");

const LABELS: Record<HumanReviewItemKey, string> = {
  identity: "身份 / 轮廓 / 比例",
  pose: "姿势族",
  lighting: "明暗 / 色板",
  loop: "无呼吸 / 跳变",
  alpha: "透明边缘",
  outline: "1px 描边",
  style: "风格一致",
};

/** 一条 finding **必须**能定位（契约的 superRefine 同一条）—— 在这里先挡住实现 bug。 */
function finding(
  code: AcceptanceFindingCode,
  severity: AcceptanceSeverity,
  message: string,
  loc: Loc,
): AcceptanceFinding {
  const defined = Object.fromEntries(
    Object.entries(loc).filter(([, v]) => v !== undefined),
  ) as Loc;
  if (defined.file === undefined && defined.assetId === undefined
    && defined.anim === undefined && defined.frame === undefined)
    throw new Error(`acceptance: finding "${code}" 没有定位字段（实现 bug）`);
  return { code, severity, message, ...defined };
}

/**
 * `manifest.id` 能否安全地作为**单段**目录名。
 *
 * 允许字母 / 数字 / `.` / `_` / `-`，但拒绝空串、`.`、`..`、以 `.` 开头、以及任何
 * 路径分隔符。⚠️ 拒绝而不是 slug：`a/b` 与 `a-b` slug 后同名，会把两份不同的包写进
 * 同一个 `acceptance/` —— 那是**静默混账**，比直接报错糟得多。
 */
const SAFE_DIR_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function safeReportDirName(id: string): string {
  if (!SAFE_DIR_NAME.test(id) || id === "." || id === "..")
    throw new CommandError(
      "invalid",
      `manifest.id "${id}" 不能安全用作输出目录名（只允许字母 / 数字 / . _ -，且不能以 . 开头）`,
    );
  return id;
}

// ── baseline.json：计划 §6.2 的字段 ─────────────────────────────────────────
//
// ⚠️ 只**消费**其中少数几项（asset 身份 / 标准版本 / raw 帧名 / 调色板），其余字段
//   （prompts / provenance / expectedMetricsTolerance / pixelSha256 …）是给人追溯的。
//   ⇒ 顶层与 `raw[]` / `delivery[]` 用 `.passthrough()`：这些字段的增补**不该**让
//   验收器把一份完好的基准判成「schema 不过」。真正要守的是被消费字段的形状。
const BareSha = z.string().regex(/^[0-9a-f]{64}$/, "64 位小写十六进制 sha256（无前缀）");
const BaselineRect = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
}).strict();

const BaselineJson = z.object({
  baselineId: z.string().min(1),
  sourceCommit: z.string().min(1),
  sourcePack: z.record(z.unknown()),
  model: z.string().min(1),
  /**
   * 票 10：baseline 覆盖的 `asset.anim` 身份。只有 `id` 与 `animation` **同时**匹配
   * 被验收包里的资源 / 动画时才计算 `verdict`；不匹配的动画只保留观察读数 `metrics`。
   */
  asset: z.object({
    id: z.string().min(1),
    animation: z.string().min(1),
  }).passthrough(),
  raw: z.array(z.object({ name: z.string().min(1), sha256: BareSha }).passthrough()).min(1),
  delivery: z.array(z.object({
    name: z.string().min(1),
    sha256: BareSha,
    atlasRect: BaselineRect,
  }).passthrough()).min(1),
  atlas: z.object({
    checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    metaChecksum: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  }).passthrough(),
  manifest: z.object({ checksum: z.string().regex(/^sha256:[0-9a-f]{64}$/) }).passthrough(),
  reference: z.object({ path: z.string().min(1), sha256: BareSha }).passthrough(),
  master: z.object({ path: z.string().min(1), sha256: BareSha }).passthrough(),
  stylespec: z.record(z.unknown()),
  standardVersion: z.string().min(1),
  thresholds: z.record(z.unknown()),
  expectedMetrics: z.record(z.unknown()),
  provenance: z.record(z.unknown()),
  /** 票 04 追加：34 色值（复算 off-palette / 边界深色所需）。省略时用包内 manifest 色板。 */
  palette: z.object({ values: z.array(z.string().min(1)) }).passthrough().optional(),
}).passthrough();

type BaselineJsonDoc = z.infer<typeof BaselineJson>;

type LoadedBaseline = {
  json: BaselineJsonDoc;
  path: string;
  checksum: string;
};

function loadBaseline(baselineDir: string): LoadedBaseline {
  const file = path.join(baselineDir, "baseline.json");
  let buf: Buffer;
  try {
    buf = fs.readFileSync(file);
  } catch (e) {
    throw new CommandError("invalid", `baseline 读不出来：${file} —— ${(e as Error).message}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(buf.toString("utf8"));
  } catch (e) {
    throw new CommandError("invalid", `baseline 不是合法 JSON：${file} —— ${(e as Error).message}`);
  }
  const parsed = BaselineJson.safeParse(raw);
  if (!parsed.success)
    throw new CommandError(
      "invalid",
      `baseline 不过 schema（${file}）：${formatIssues(parsed.error).slice(0, 6).join("；")}`,
    );
  return { json: parsed.data, path: toPosix(file), checksum: sha256(buf) };
}

function readManifest(packDir: string): AssetPackManifest {
  const manifestPath = path.join(packDir, "manifest.json");
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (e) {
    throw new CommandError("invalid", `manifest 读不出来或不是 JSON：${manifestPath} —— ${(e as Error).message}`);
  }
  const parsed = parseAssetPack(raw);
  if (!parsed.ok)
    throw new CommandError("invalid", `manifest 不过 schema：${parsed.errors.slice(0, 6).join("；")}`);
  return parsed.value;
}

/**
 * `verifyPack` 的失败在这里一律归 `invalid`（exit 4）。
 * ⚠️ 它自己会把「没有 manifest.json」报成 `usage`(2)；但 `accept` 的语义是
 *   「这个包不合法」，不是「命令参数写错了」——计划 §5 的退出码表把 4 留给包。
 */
function verifyForAcceptance(packDir: string): void {
  try {
    verifyPack({ packDir });
  } catch (e) {
    if (e instanceof CommandError && e.kind === "invalid") throw e;
    throw new CommandError(
      "invalid",
      `资源包不合法：${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function animOfFrame(asset: AssetPackEntry, frame: string): string | undefined {
  const names = (asset.animations ?? []).filter((a) => a.frames.includes(frame)).map((a) => a.name);
  return names.length === 1 ? names[0] : undefined;
}

function sameRect(
  a: { x: number; y: number; w: number; h: number } | undefined,
  b: { x: number; y: number; w: number; h: number } | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function sameAnchor(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

/** 帧矩形 / `spriteSourceSize` / `sourceSize` / 锚点 / 九宫格逐项对账（检查 6、9、10）。 */
function checkFrameAgreement(
  asset: AssetPackEntry,
  frameName: string,
  jf: AtlasFrame,
  file: string,
  add: (code: AcceptanceFindingCode, severity: AcceptanceSeverity, message: string, loc: Loc) => void,
): void {
  const loc: Loc = { file, assetId: asset.id, anim: animOfFrame(asset, frameName), frame: frameName };

  if (jf.sourceSize.w !== asset.size.w || jf.sourceSize.h !== asset.size.h)
    add(
      "atlas.frame.source-size-mismatch",
      "error",
      `帧 "${frameName}" 的 sourceSize ${jf.sourceSize.w}×${jf.sourceSize.h} 与资源 size ${asset.size.w}×${asset.size.h} 不一致`,
      loc,
    );

  const sss = jf.spriteSourceSize;
  if (sss.x + sss.w > jf.sourceSize.w || sss.y + sss.h > jf.sourceSize.h)
    add(
      "atlas.frame.trim-out-of-bounds",
      "error",
      `帧 "${frameName}" 的 spriteSourceSize 超出 sourceSize：x+w=${sss.x + sss.w} > ${jf.sourceSize.w} 或 y+h=${sss.y + sss.h} > ${jf.sourceSize.h}`,
      loc,
    );

  if (!jf.trimmed
    && (sss.x !== 0 || sss.y !== 0 || sss.w !== jf.sourceSize.w || sss.h !== jf.sourceSize.h))
    add(
      "atlas.frame.size-mismatch",
      "error",
      `帧 "${frameName}" 声明 trimmed=false，但 spriteSourceSize 不是完整 sourceSize`,
      loc,
    );

  const packed = jf.rotated ? { w: sss.h, h: sss.w } : { w: sss.w, h: sss.h };
  if (jf.frame.w !== packed.w || jf.frame.h !== packed.h)
    add(
      "atlas.frame.size-mismatch",
      "error",
      `帧 "${frameName}" 的图集矩形 ${jf.frame.w}×${jf.frame.h} 与 spriteSourceSize ${sss.w}×${sss.h}（rotated=${jf.rotated}）不一致`,
      loc,
    );

  if (jf.anchor !== undefined && !sameAnchor(jf.anchor, asset.anchor))
    add(
      "atlas.frame.anchor-mismatch",
      "error",
      `帧 "${frameName}" 的图集锚点 (${jf.anchor.x}, ${jf.anchor.y}) 与 manifest 锚点 (${asset.anchor.x}, ${asset.anchor.y}) 不一致`,
      loc,
    );

  if (!sameRect(jf.scale9Borders, asset.scale9Borders))
    add(
      "atlas.frame.scale9-mismatch",
      "error",
      `帧 "${frameName}" 的图集 scale9Borders 与 manifest 不一致：${JSON.stringify(jf.scale9Borders) ?? "缺"} vs ${JSON.stringify(asset.scale9Borders) ?? "缺"}`,
      loc,
    );
}

/** 动画帧对的读数（计划 §6 的指标口径；只做「量」，判档在 `verdictOf`）。 */
function metricsForAnimation(
  asset: AssetPackEntry,
  anim: { name: string; frames: readonly string[] },
  atlases: Map<string, ParsedAtlas>,
  packDir: string,
  palette: readonly string[],
): { metrics: AnimationMetrics; verdict: MetricTier } | { reason: string } {
  const atlas = atlases.get(asset.atlasId);
  if (!atlas) return { reason: `找不到图集 "${asset.atlasId}"` };
  if (!atlas.json) return { reason: `图集 "${asset.atlasId}" 的 JSON 不可用` };
  if (!atlas.image) return { reason: `图集 "${asset.atlasId}" 的 PNG 不可用` };
  if (palette.length === 0) return { reason: "包内色板为空，无法计算色板指标" };

  const raws: RasterImage[] = [];
  const deliveries: RasterImage[] = [];
  for (const frameName of anim.frames) {
    const rawPath = rawPathOf(asset, frameName, packDir);
    if (rawPath === null) return { reason: `帧 "${frameName}" 没有可用的创作态 raw 源图` };
    let raw: RasterImage;
    try {
      raw = decodePNG(fs.readFileSync(rawPath));
    } catch (e) {
      return { reason: `raw 源图读不出来（${rawPath}）：${(e as Error).message}` };
    }
    const jf = atlas.json.frames[frameName];
    if (!jf) return { reason: `图集 JSON 里没有帧 "${frameName}"` };
    const r = jf.frame;
    if (r.x + r.w > atlas.image.width || r.y + r.h > atlas.image.height)
      return { reason: `帧 "${frameName}" 的矩形超出图集，无法裁出交付帧` };
    raws.push(raw);
    deliveries.push(cropToBox(atlas.image, r));
  }

  const size = deliveries[0]!;
  if (deliveries.some((d) => d.width !== size.width || d.height !== size.height))
    return { reason: "同一动画的交付帧尺寸不一致，alpha 掩码差无从计算" };

  const bboxes = raws.map((r) => cleanBBox(r));
  if (bboxes.some((b): b is null => b === null))
    return { reason: "有 raw 帧抠底后没有墨（cleanBBox 为空）" };
  const boxes = bboxes as InkBox[];

  let alphaMaskDiffPct = 0;
  let bboxWidthDiffPctMax = 0;
  let positionDriftPctMax = 0;
  let backgroundL1 = 0;
  for (let i = 0; i < deliveries.length; i++)
    for (let j = i + 1; j < deliveries.length; j++) {
      alphaMaskDiffPct = Math.max(alphaMaskDiffPct, alphaMaskDiff(deliveries[i]!, deliveries[j]!));
      const width = bboxWidthDiffPct(boxes[i]!, boxes[j]!);
      if (width !== null) bboxWidthDiffPctMax = Math.max(bboxWidthDiffPctMax, width);
      const drift = positionDriftPct(
        { bbox: boxes[i]!, sourceWidth: raws[i]!.width, sourceHeight: raws[i]!.height },
        { bbox: boxes[j]!, sourceWidth: raws[j]!.width, sourceHeight: raws[j]!.height },
      );
      if (drift !== null) positionDriftPctMax = Math.max(positionDriftPctMax, drift);
      backgroundL1 = Math.max(backgroundL1, dominantColorL1(raws[i]!, raws[j]!));
    }

  const paletteCounts = deliveries.map((d) => paletteCount(d));
  const offPaletteCounts = deliveries.map((d) => offPaletteCount(d, palette));
  const boundary = deliveries.map((d) => boundaryDarkPct(d, palette));
  if (boundary.some((v) => v === null))
    return { reason: "有交付帧算不出轮廓边界深色占比（没有边界像素）" };
  const boundaries = boundary as number[];

  const metrics: AnimationMetrics = {
    alphaMaskDiffPct,
    bboxWidthDiffPct: bboxWidthDiffPctMax,
    positionDriftPct: positionDriftPctMax,
    backgroundL1,
    paletteCountMin: Math.min(...paletteCounts),
    offPalette: Math.max(...offPaletteCounts),
    boundaryDarkPctMin: Math.min(...boundaries),
  };
  return { metrics, verdict: verdictOf(metrics) };
}

/**
 * 帧名 → 创作态 raw 源图。
 *
 * 生图 / 人工导入的包把每个动画帧的原图放在 `authoring/**`（`kind: "bitmap"`）。
 * 命名约定是 `<帧名>.png`；单帧资源则常常是 `<资源 id>.png`。找不到就返回 `null` ——
 * 指标变 null，并留一条 `metrics.unavailable`，而不是猜一张图。
 */
function rawPathOf(asset: AssetPackEntry, frameName: string, packDir: string): string | null {
  const bitmaps = asset.authoring.filter((a) => a.kind === "bitmap");
  const exact = bitmaps.find((a) => path.posix.basename(a.ref) === `${frameName}.png`);
  if (exact) return path.resolve(packDir, exact.ref);
  if (asset.frames.length === 1 && bitmaps.length === 1)
    return path.resolve(packDir, bitmaps[0]!.ref);
  return null;
}

function buildReport(
  manifest: AssetPackManifest,
  packDir: string,
  baseline: LoadedBaseline | null,
  findings: AcceptanceFinding[],
  atlases: Map<string, ParsedAtlas>,
  opts: AcceptAnimationPackOptions,
): AcceptanceResult {
  const palette = baseline?.json.palette?.values ?? manifest.palette.values;
  const animations: AcceptanceAnimation[] = [];
  /** baseline 覆盖、且在被验收包里真实存在的动画（summary / report.md 写出这份名单）。 */
  const covered: string[] = [];

  for (const asset of manifest.assets)
    for (const anim of asset.animations ?? []) {
      // 票 10：baseline 只覆盖一个 `asset.anim`。其他动画的帧间差异是正常运动，
      // 用票 12 阈值判红是语义错误 ⇒ 仍量 metrics 作观察读数，但**不给 verdict**。
      const isCovered = baseline !== null
        && baseline.json.asset.id === asset.id
        && baseline.json.asset.animation === anim.name;
      if (isCovered) covered.push(`${asset.id}.${anim.name}`);
      let metrics: AcceptanceMetrics | null = null;
      let verdict: MetricTier | null = null;
      if (baseline !== null) {
        const computed = metricsForAnimation(asset, anim, atlases, packDir, palette);
        if ("metrics" in computed) {
          metrics = computed.metrics;
          verdict = isCovered ? computed.verdict : null;
        } else {
          findings.push(finding(
            "metrics.unavailable",
            "info",
            `动画 "${asset.id}.${anim.name}" 的 metrics 不可用：${computed.reason}`,
            { assetId: asset.id, anim: anim.name },
          ));
        }
      }
      animations.push({
        assetId: asset.id,
        anim: anim.name,
        frames: [...anim.frames],
        declared: { fps: anim.fps ?? null, loop: anim.loop },
        metrics,
        verdict,
        findings: findings.filter((f) => f.assetId === asset.id && f.anim === anim.name),
      });
    }

  const report: AnimationAcceptance = {
    format: ANIMATION_ACCEPTANCE_FORMAT,
    createdAt: (opts.now ?? new Date()).toISOString(),
    toolVersion: opts.toolVersion ?? ACCEPTANCE_TOOL_VERSION,
    pack: {
      id: manifest.id,
      version: manifest.version,
      manifestChecksum: sha256(fs.readFileSync(path.join(packDir, "manifest.json"))),
      atlases: manifest.atlases.map((a) => ({
        id: a.id,
        imageChecksum: sha256(fs.readFileSync(path.resolve(packDir, a.image))),
        metaChecksum: sha256(fs.readFileSync(path.resolve(packDir, a.meta))),
      })),
    },
    baseline: baseline === null ? null : {
      id: baseline.json.baselineId,
      path: baseline.path,
      checksum: baseline.checksum,
      standardVersion: baseline.json.standardVersion,
    },
    animations,
    findings,
    human: {
      verdict: "pending",
      reviewer: null,
      reviewedAt: null,
      items: HUMAN_REVIEW_ITEM_KEYS.map((key) => ({ key, label: LABELS[key], verdict: "pending", note: "" })),
      evidence: [],
    },
    runtime: { status: "unverified", evidence: [], declaredVsActual: [] },
  };

  const parsed = parseAnimationAcceptance(report);
  if (!parsed.ok)
    throw new Error(`acceptance: 生成的报告不过 schema（实现 bug）：${parsed.errors.slice(0, 6).join("；")}`);

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;
  const summary = [
    `结构验收：${manifest.id} v${manifest.version} · ${animations.length} 个动画 · ${findings.length} 条 findings`,
    findings.length === 0
      ? "findings：无"
      : `findings：error ${errors} · warning ${warnings} · info ${infos}`,
    baseline === null
      ? "baseline：无（metrics / verdict 为 null）"
      : `baseline：${baseline.json.baselineId}（${baseline.json.standardVersion}）`,
    ...(baseline === null ? [] : [
      `verdict 覆盖：${covered.length === 0
        ? "无（当前包没有 baseline 覆盖的动画）"
        : covered.join(" · ")} —— verdict 只在 baseline 覆盖的动画上计算；其余动画保留 metrics（观察读数），verdict 为 null`,
    ]),
  ];

  return { report: parsed.value, hasErrors: errors > 0, summary };
}

/**
 * 验收一个交付态资源包。
 *
 * 顺序先跑 `verifyPack`（schema + 逐文件 checksum + 反向穷举）—— 它失败是**输入不合法**
 * （exit 4），不是 findings。之后才是 §5 的 1–13 项结构检查：所有问题都进 `findings`，
 * 一条也不抛。`baseline` 存在时对**所有**动画计算 `metrics`（观察读数）；`verdict` 只对
 * baseline 覆盖的 `asset.anim` 计算（票 10），其余为 `null`。无 baseline 时整块 `null`。
 */
export function acceptAnimationPack(opts: AcceptAnimationPackOptions): AcceptanceResult {
  const packDir = path.resolve(opts.packDir);
  verifyForAcceptance(packDir);
  const manifest = readManifest(packDir);
  const baseline = opts.baselineDir === undefined ? null : loadBaseline(opts.baselineDir);
  const findings: AcceptanceFinding[] = [];
  const add = (
    code: AcceptanceFindingCode,
    severity: AcceptanceSeverity,
    message: string,
    loc: Loc,
  ): void => { findings.push(finding(code, severity, message, loc)); };

  const filePaths = new Set(manifest.files.map((f) => f.path));
  const atlases = new Map<string, ParsedAtlas>();

  // 检查 2–5：图集文件在对账表里、JSON 过 schema、PNG 可解码、尺寸 / 帧数 / checksum。
  for (const entry of manifest.atlases) {
    for (const [role, ref] of [["meta", entry.meta], ["image", entry.image]] as const)
      if (!filePaths.has(ref))
        add("pack.atlas.file-missing", "error", `图集 "${entry.id}" 的 ${role} 不在 files[] 里：${ref}`, { file: ref });

    let json: AtlasJsonDoc | null = null;
    const metaPath = path.resolve(packDir, entry.meta);
    if (fs.existsSync(metaPath)) {
      const text = fs.readFileSync(metaPath);
      try {
        const parsed = AtlasJson.safeParse(JSON.parse(text.toString("utf8")));
        if (parsed.success) json = parsed.data;
        else
          add(
            "atlas.json.invalid",
            "error",
            `图集 JSON 不过 schema：${formatIssues(parsed.error).slice(0, 6).join("；")}`,
            { file: entry.meta },
          );
      } catch (e) {
        add("atlas.json.unreadable", "error", `图集 JSON 读不出来：${(e as Error).message}`, { file: entry.meta });
      }
    }

    let image: RasterImage | null = null;
    const imagePath = path.resolve(packDir, entry.image);
    if (fs.existsSync(imagePath)) {
      const bytes = fs.readFileSync(imagePath);
      const actual = sha256(bytes);
      if (actual !== entry.checksum)
        add(
          "atlas.image.checksum-mismatch",
          "error",
          `图集 "${entry.id}" 的 checksum 与 PNG 不符：记 ${entry.checksum}，实际 ${actual}`,
          { file: entry.image },
        );
      try {
        image = decodePNG(bytes);
      } catch (e) {
        add("atlas.image.undecodable", "error", `图集 PNG 解不开：${(e as Error).message}`, { file: entry.image });
      }
    }

    if (image !== null && (image.width !== entry.size.w || image.height !== entry.size.h))
      add(
        "atlas.image.size-mismatch",
        "error",
        `图集 "${entry.id}" 声明 ${entry.size.w}×${entry.size.h}，PNG 实际 ${image.width}×${image.height}`,
        { file: entry.image },
      );

    if (json !== null && Object.keys(json.frames).length !== entry.frames)
      add(
        "atlas.frames.count-mismatch",
        "error",
        `图集 "${entry.id}" 声明 frames=${entry.frames}，图集 JSON 实际 ${Object.keys(json.frames).length} 帧`,
        { file: entry.meta },
      );

    atlases.set(entry.id, { entry, json, image });
  }

  // 检查 6–7：帧矩形边界；manifest 帧 ↔ 图集 JSON 双向对账（孤儿帧是 warning）。
  const declaredByAtlas = new Map<string, Set<string>>();
  for (const asset of manifest.assets) {
    const declared = declaredByAtlas.get(asset.atlasId) ?? new Set<string>();
    declaredByAtlas.set(asset.atlasId, declared);
    const parsed = atlases.get(asset.atlasId);
    for (const ref of asset.frames) {
      declared.add(ref.name);
      const loc: Loc = { assetId: asset.id, anim: animOfFrame(asset, ref.name), frame: ref.name };
      if (!parsed || !parsed.json) continue;
      const jf = parsed.json.frames[ref.name];
      if (!jf) {
        add("atlas.frame.missing", "error", `manifest 帧 "${ref.name}" 不在图集 "${asset.atlasId}" 的 JSON 里`, { file: parsed.entry.meta, ...loc });
        continue;
      }
      if (parsed.image !== null) {
        const r = jf.frame;
        if (r.x + r.w > parsed.image.width || r.y + r.h > parsed.image.height)
          add(
            "atlas.frame.out-of-bounds",
            "error",
            `帧矩形超出图集：x+w=${r.x + r.w} > ${parsed.image.width} 或 y+h=${r.y + r.h} > ${parsed.image.height}`,
            { file: parsed.entry.meta, ...loc },
          );
      }
      checkFrameAgreement(asset, ref.name, jf, parsed.entry.meta, add);
    }
  }

  for (const [atlasId, parsed] of atlases) {
    if (!parsed.json) continue;
    const declared = declaredByAtlas.get(atlasId) ?? new Set<string>();
    for (const name of Object.keys(parsed.json.frames))
      if (!declared.has(name))
        add(
          "atlas.frame.ghost",
          "warning",
          `图集 "${atlasId}" 里的帧 "${name}" 没有任何 manifest 资源引用（孤儿帧）`,
          { file: parsed.entry.meta, frame: name },
        );
  }

  // 检查 11：跨资源同名帧（`atlas.ts` 在图集内会静默覆盖；这里提前报出来）。
  const owner = new Map<string, string>();
  for (const asset of manifest.assets)
    for (const ref of asset.frames) {
      const prev = owner.get(ref.name);
      if (prev !== undefined && prev !== asset.id)
        add(
          "atlas.frame.duplicate-across-assets",
          "error",
          `帧名 "${ref.name}" 同时属于资源 "${prev}" 与 "${asset.id}"（会同名覆盖）`,
          { assetId: asset.id, anim: animOfFrame(asset, ref.name), frame: ref.name },
        );
      else if (prev === undefined) owner.set(ref.name, asset.id);
    }

  // 检查 8：动画帧存在 / 不重复 / 顺序与 manifest frames[] 一致。
  for (const asset of manifest.assets) {
    const index = new Map(asset.frames.map((f, i) => [f.name, i]));
    for (const anim of asset.animations ?? []) {
      const seen = new Set<string>();
      let previous = -1;
      for (const name of anim.frames) {
        const loc: Loc = { assetId: asset.id, anim: anim.name, frame: name };
        if (seen.has(name))
          add("animation.frame.duplicate", "error", `动画 "${anim.name}" 重复引用了帧 "${name}"`, loc);
        seen.add(name);
        if (!index.has(name))
          add("animation.frame.missing", "error", `动画 "${anim.name}" 引用了资源 "${asset.id}" 里不存在的帧 "${name}"`, loc);
        const i = index.get(name);
        if (i !== undefined) {
          if (i < previous)
            add(
              "animation.frame.order",
              "error",
              `动画 "${anim.name}" 的帧顺序与 manifest frames[] 不一致："${name}" 出现在后面（index ${i} < ${previous}）`,
              loc,
            );
          previous = i;
        }
      }
    }
  }

  // 检查 12：fps / loop 的合法性由 schema 保证；这里只把**声明**抄进报告，不验运行时。
  // baseline 的 raw 帧名如果不在包里，说明基准与这个包对不上 —— 留 warning 供追溯。
  if (baseline !== null) {
    const known = new Set(manifest.assets.flatMap((a) => a.frames.map((f) => f.name)));
    for (const raw of baseline.json.raw)
      if (!known.has(raw.name))
        add(
          "baseline.frame-unmatched",
          "warning",
          `baseline 的帧 "${raw.name}" 不在被验收的包里`,
          { file: baseline.path, frame: raw.name },
        );
  }

  // 检查 13 由 `finding()` 在构造时强制（没有定位字段就抛实现 bug）。
  return buildReport(manifest, packDir, baseline, findings, atlases, opts);
}

/** 下一个报告版本号 —— 扫描既有 `v<N>` 目录，**只增不减**。 */
export function nextAcceptanceVersion(acceptanceDir: string): number {
  if (!fs.existsSync(acceptanceDir)) return 1;
  const versions = fs.readdirSync(acceptanceDir)
    .map((d) => /^v(\d+)$/.exec(d))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  return versions.length === 0 ? 1 : Math.max(...versions) + 1;
}

/** 用 `mkdirSync` 的 `EEXIST` 抢占版本目录：并发写者也不会算出同一个 `v<N>`。 */
function allocateReportDir(acceptanceDir: string): { version: number; dir: string } {
  fs.mkdirSync(acceptanceDir, { recursive: true });
  let version = nextAcceptanceVersion(acceptanceDir);
  for (;;) {
    const dir = path.join(acceptanceDir, `v${version}`);
    try {
      fs.mkdirSync(dir);
      return { version, dir };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      version += 1;
    }
  }
}

const escapeCell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

function renderMarkdown(report: AnimationAcceptance): string {
  const errors = report.findings.filter((f) => f.severity === "error").length;
  // 报告 schema 不含 baseline 的 `asset.anim`（本票不改契约）⇒ 从非 null verdict 反推覆盖名单；
  // 与 summary 同一口径：**只有**被 baseline 覆盖的动画才有 verdict。
  const covered = report.animations
    .filter((a) => a.verdict !== null)
    .map((a) => `${a.assetId}.${a.anim}`);
  const lines = [
    `# 动画验收报告 · ${report.pack.id} v${report.pack.version}`,
    "",
    `- 生成时间：${report.createdAt}`,
    `- 工具版本：${report.toolVersion}`,
    `- manifest checksum：${report.pack.manifestChecksum}`,
    report.baseline === null
      ? "- baseline：无（metrics / verdict 为 null）"
      : `- baseline：${report.baseline.id} · ${report.baseline.standardVersion} · ${report.baseline.checksum}`,
    ...(report.baseline === null ? [] : [
      `- verdict 覆盖：${covered.length === 0 ? "无" : covered.join(" · ")} —— verdict 只在 baseline 覆盖的动画上计算；其余动画的 verdict 为 —（metrics 仅作观察读数）`,
    ]),
    `- 结论：${errors === 0 ? "无 error findings（warning / info 不阻断）" : `${errors} 条 error findings`}`,
    "",
    "## 图集",
    "",
    "| 图集 | image checksum | meta checksum |",
    "|---|---|---|",
    ...report.pack.atlases.map((a) => `| ${a.id} | ${a.imageChecksum} | ${a.metaChecksum} |`),
    "",
    "## Findings",
    "",
  ];
  if (report.findings.length === 0) lines.push("无。", "");
  else {
    lines.push("| 严重度 | code | 定位 | 说明 |", "|---|---|---|---|");
    for (const f of report.findings) {
      const loc = [f.file, f.assetId, f.anim, f.frame].filter((v): v is string => v !== undefined).join(" · ");
      lines.push(`| ${f.severity} | ${f.code} | ${escapeCell(loc || "—")} | ${escapeCell(f.message)} |`);
    }
    lines.push("");
  }
  lines.push("## 动画", "", "| 资源.动画 | 帧 | fps | loop | verdict | 指标 |", "|---|---|---|---|---|---|");
  for (const a of report.animations) {
    const metrics = a.metrics === null
      ? "—"
      : `alpha ${a.metrics.alphaMaskDiffPct}% · bbox ${a.metrics.bboxWidthDiffPct}% · pos ${a.metrics.positionDriftPct}% · L1 ${a.metrics.backgroundL1} · colors ${a.metrics.paletteCountMin} · off ${a.metrics.offPalette} · boundary ${a.metrics.boundaryDarkPctMin}%`;
    lines.push(`| ${a.assetId}.${a.anim} | ${a.frames.length} | ${a.declared.fps ?? "—"} | ${a.declared.loop ? "true" : "false"} | ${a.verdict ?? "—"} | ${metrics} |`);
  }
  lines.push(
    "",
    "## 人裁 / 运行时",
    "",
    `- 人裁：${report.human.verdict}（${report.human.items.length} 项）`,
    `- 运行时：${report.runtime.status}`,
    "",
  );
  return lines.join("\n");
}

/**
 * 写 `out/<packId>/acceptance/v<N>/report.json` + `report.md`。
 *
 * ⚠️ 既有版本**绝不覆盖**：新目录由 `mkdirSync` 原子创建（EEXIST ⇒ 试下一个 N），
 *   而不是「读最高版本 + 1 再 mkdir」—— 后者在两个写者之间会算到同一个数。
 * ⚠️ 报告先过 `parseAnimationAcceptance` 再落盘：写出去的东西必须能被下一个读者解析。
 */
export function writeAcceptanceReport(opts: WriteAcceptanceReportOptions): WrittenAcceptanceReport {
  const parsed = parseAnimationAcceptance(opts.report);
  if (!parsed.ok)
    throw new Error(`验收报告不过 schema（实现 bug）：${parsed.errors.slice(0, 6).join("；")}`);
  const report = parsed.value;
  const outDir = path.resolve(opts.outDir ?? "out");
  const packId = safeReportDirName(report.pack.id);
  const acceptanceDir = path.join(outDir, packId, "acceptance");
  const { version, dir } = allocateReportDir(acceptanceDir);
  fs.writeFileSync(path.join(dir, "report.json"), jstr(report));
  fs.writeFileSync(path.join(dir, "report.md"), renderMarkdown(report));
  const relDir = toPosix(path.relative(outDir, dir));
  return {
    version,
    dir: relDir,
    reportJson: `${relDir}/report.json`,
    reportMarkdown: `${relDir}/report.md`,
  };
}
