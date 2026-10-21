// 动画验收的纯指标（票 12 标准）。
//
// 定义逐项对齐 `.scratch/asset-integration-v1/runs/2026-10-21d-qualification/qualify.mjs`
// 与 `2026-10-21f-finalist/finalist.mjs` 里的实际实现 —— 那两份脚本是票 12 机械闸的
// 唯一历史实现。这里只做「量」与「判档」：不读写文件、不联网、不新增依赖。
//
// 量在哪张图上（与脚本一致，顺序是判据的一部分）：
//   · alpha 掩码差、调色板色数、off-palette、边界深色 → **导入后**的交付帧（如 48×64）；
//   · 干净 bbox、位置漂移、背景众数色 → 解码后的 **raw 帧**；
//     位置漂移的分母是 raw 源图尺寸（两帧取较大者），不是交付帧尺寸。
//   · bbox 先抠底（dominantOpaqueColor + keyBackground 容差 30）、再删地面线、再删孤立碎点，
//     最后量 ink 包围盒；掩码与 bbox 的 alpha 下限都是 128。
//   · 百分比保留 1 位小数后再判档（脚本里的 `+…toFixed(1)`）。
import { dropBottomGroundLines, dropDetachedSpecks, inkBBox, type RasterImage } from "./image.js";
import { dominantOpaqueColor, keyBackground } from "./import.js";

/** RGB 三元组，0–255。 */
export type Rgb = readonly [number, number, number];

/** 像素包围盒（左上角 + 宽高，含端点）。 */
export type InkBox = { x: number; y: number; w: number; h: number };

/** 单帧的几何读数：干净 bbox + 解码后的 raw 源图尺寸。 */
export type FramePlacement = {
  bbox: InkBox | null;
  /** raw 源图宽（位置漂移的分母之一）。 */
  sourceWidth: number;
  /** raw 源图高（位置漂移的分母之一）。 */
  sourceHeight: number;
};

/** 绿 / 黄 / 红。票 12：任一红灯帧让整个动画失败；黄灯必须人眼复核。 */
export type MetricTier = "green" | "yellow" | "red";

/**
 * 票 12 的机械闸阈值（2026-10-21 版）。
 *
 * 前四项是上界：`≤ green` 绿、`≤ yellow` 黄、否则红。
 * 后三项是交付硬门槛，只有绿 / 红（票 12 明确「不设黄灯」）：
 * 色数 `< paletteCountMin`、off-palette `≠ 0`、边界深色 `< boundaryDarkPctMin` 都直接红。
 *
 * **阈值只住在这里。** 新增指标或调阈值时改这一处，不要在调用方另抄一份。
 */
export const ANIMATION_THRESHOLDS = {
  alphaMaskDiffPct: { green: 1, yellow: 3 },
  bboxWidthDiffPct: { green: 2, yellow: 5 },
  positionDriftPct: { green: 1, yellow: 3 },
  backgroundL1: { green: 10, yellow: 20 },
  paletteCountMin: 14,
  offPaletteMax: 0,
  boundaryDarkPctMin: 50,
} as const;

/**
 * 一个动画的汇总读数 —— 与 `animation-acceptance/v1` 报告的 `metrics` 字段同名。
 *
 * 每个值都是「所有帧 / 帧对里最差的那个」：alpha、宽度差、位置、背景 L1 取 max；
 * 色数、边界深色取 min；off-palette 取 max。单帧最好成绩不能抵消另一帧的红灯。
 */
export type AnimationMetrics = {
  /** 所有帧对里最大的 alpha 掩码差（%）。 */
  alphaMaskDiffPct: number;
  /** 所有帧对里最大的干净 bbox 宽度差（%）。 */
  bboxWidthDiffPct: number;
  /** 所有帧对里最大的位置漂移（%）。 */
  positionDriftPct: number;
  /** 所有帧对里最大的背景众数色 L1。 */
  backgroundL1: number;
  /** 所有帧里最少的调色板色数。 */
  paletteCountMin: number;
  /** 所有帧里最大的 off-palette 像素数。 */
  offPalette: number;
  /** 所有帧里最低的轮廓边界深色占比（%）。 */
  boundaryDarkPctMin: number;
};

const round1 = (v: number): number => Number(v.toFixed(1));

const assertSameSize = (a: RasterImage, b: RasterImage, fn: string): void => {
  if (a.width !== b.width || a.height !== b.height)
    throw new Error(`${fn}: 两帧尺寸必须一致（${a.width}×${a.height} vs ${b.width}×${b.height}）`);
};

/**
 * alpha 掩码差 %：两帧同一尺寸里，`alpha ≥ floor` 的布尔掩码不同的像素占比。
 *
 * 这是资格 / 决赛脚本里的 `alphaDiff(...).alphaPct`。只看掩码，不看 RGB ——
 * 颜色变了不算掩码差（颜色另有 off-palette / 背景 L1 两道尺子）。
 */
export function alphaMaskDiff(a: RasterImage, b: RasterImage, opts: { floor?: number } = {}): number {
  assertSameSize(a, b, "alphaMaskDiff");
  const floor = opts.floor ?? 128;
  const n = a.width * a.height;
  if (n === 0) return 0;
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const s = i * 4;
    if ((a.data[s + 3]! >= floor) !== (b.data[s + 3]! >= floor)) changed++;
  }
  return round1((changed / n) * 100);
}

/**
 * raw 帧的「干净 bbox」：抠底 → 删底部地面线与细虚线 → 删孤立碎点 → ink 包围盒。
 *
 * 与 qualify/finalist 的 `measure()` 同一条链、同一个顺序（先删地面线再删碎点：
 * 地面线贴着脚时不是孤立碎点，反过来删不掉）。`floor` 默认 128、抠底容差默认 30。
 * 全透明（或全被抠掉）时返回 `null`。
 */
export function cleanBBox(
  img: RasterImage,
  opts: { floor?: number; keyTolerance?: number } = {},
): InkBox | null {
  const floor = opts.floor ?? 128;
  const key = dominantOpaqueColor(img).color;
  const keyed = keyBackground(img, { tolerance: opts.keyTolerance ?? 30, colors: [key] }).image;
  const cleaned = dropDetachedSpecks(dropBottomGroundLines(keyed, { floor }), { floor });
  return inkBBox(cleaned, { floor });
}

/**
 * 干净 bbox 宽度差 %：`(max(wA,wB) / min(wA,wB) − 1) × 100`，保留 1 位小数。
 *
 * 任一帧没有 bbox 时返回 `null`（脚本把缺值当 `unknown`，不参与判档）。
 * 宽度差只比宽度 —— 高度差会混入姿势变化，票 12 的指标是「轮廓宽度」。
 */
export function bboxWidthDiffPct(a: InkBox | null, b: InkBox | null): number | null {
  if (!a || !b) return null;
  if (a.w <= 0 || b.w <= 0) throw new Error(`bboxWidthDiffPct: bbox 宽度必须为正（${a.w} / ${b.w}）`);
  return round1((Math.max(a.w, b.w) / Math.min(a.w, b.w) - 1) * 100);
}

/**
 * 位置漂移 %：bbox 左上角在两帧之间的位移，按 raw 源图尺寸归一。
 *
 * `max(|dx| / max(srcW), |dy| / max(srcH)) × 100`，保留 1 位小数 —— 与脚本逐字一致。
 * 分母用 raw 源图（如 864×1184），所以这个指标与导出尺寸无关。
 * 任一帧没有 bbox 时返回 `null`。
 */
export function positionDriftPct(a: FramePlacement, b: FramePlacement): number | null {
  if (!a.bbox || !b.bbox) return null;
  const w = Math.max(a.sourceWidth, b.sourceWidth);
  const h = Math.max(a.sourceHeight, b.sourceHeight);
  if (!(w > 0) || !(h > 0))
    throw new Error(`positionDriftPct: 源图尺寸必须为正（${w}×${h}）`);
  const dx = Math.abs(a.bbox.x - b.bbox.x);
  const dy = Math.abs(a.bbox.y - b.bbox.y);
  return round1(Math.max(dx / w, dy / h) * 100);
}

/**
 * 背景众数色的 L1：两帧各自取不透明像素的众数色，再算 `|ΔR|+|ΔG|+|ΔB|`。
 *
 * 众数色由 `dominantOpaqueColor` 决定（并列时取 RGB 打包值最小者，结果确定）。
 * 既可以传两张图，也可以传已经量好的 RGB（脚本每帧只量一次 key，再对所有帧对复用）。
 */
export function dominantColorL1(a: Rgb | RasterImage, b: Rgb | RasterImage): number {
  const isRgb = (v: Rgb | RasterImage): v is Rgb => Array.isArray(v);
  const ca = isRgb(a) ? a : dominantOpaqueColor(a).color;
  const cb = isRgb(b) ? b : dominantOpaqueColor(b).color;
  return Math.abs(ca[0]! - cb[0]!) + Math.abs(ca[1]! - cb[1]!) + Math.abs(ca[2]! - cb[2]!);
}

/** 交付帧里出现的调色板色数（alpha ≥ floor 的不同 RGB 数）。 */
export function paletteCount(img: RasterImage, opts: { floor?: number } = {}): number {
  const floor = opts.floor ?? 128;
  const seen = new Set<number>();
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * 4;
    if (img.data[s + 3]! < floor) continue;
    seen.add((img.data[s]! << 16) | (img.data[s + 1]! << 8) | img.data[s + 2]!);
  }
  return seen.size;
}

/** 交付帧里颜色不在 `palette` 内的不透明像素数（alpha ≥ floor）。票 12 的硬门槛是 0。 */
export function offPaletteCount(
  img: RasterImage,
  palette: readonly string[],
  opts: { floor?: number } = {},
): number {
  const floor = opts.floor ?? 128;
  const allowed = new Set(palette.map((c) => c.toLowerCase()));
  let off = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * 4;
    if (img.data[s + 3]! < floor) continue;
    const hex = `#${[img.data[s]!, img.data[s + 1]!, img.data[s + 2]!]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")}`;
    if (!allowed.has(hex)) off++;
  }
  return off;
}

const luminance = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * 轮廓边界深色占比 %：不透明像素里「贴着透明像素或图边」的那些，亮度 ≤ 色板中位亮度的比例。
 *
 * 与脚本逐字一致：
 *   · 边界 = 图边（x=0 / y=0 / x=W−1 / y=H−1）或上 / 下 / 左 / 右邻 alpha < floor；
 *   · 深色界值 = 色板亮度升序的第 `floor(len / 2)` 项（不是插值中位数）；
 *   · 亮度 = Rec.709（0.2126 R + 0.7152 G + 0.0722 B），`≤` 界值算深色。
 * 没有任何边界像素时返回 `null`（脚本记 `null`，不判档）。
 */
export function boundaryDarkPct(
  img: RasterImage,
  palette: readonly string[],
  opts: { floor?: number } = {},
): number | null {
  if (palette.length === 0) throw new Error("boundaryDarkPct: 色板不能为空");
  const floor = opts.floor ?? 128;
  const lum = palette.map(luminance).sort((a, b) => a - b);
  const darkCut = lum[Math.floor(lum.length / 2)]!;
  const W = img.width, H = img.height;
  let boundary = 0;
  let dark = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 4;
      if (img.data[s + 3]! < floor) continue;
      const edge =
        x === 0 || y === 0 || x === W - 1 || y === H - 1 ||
        img.data[(y * W + x - 1) * 4 + 3]! < floor ||
        img.data[(y * W + x + 1) * 4 + 3]! < floor ||
        img.data[((y - 1) * W + x) * 4 + 3]! < floor ||
        img.data[((y + 1) * W + x) * 4 + 3]! < floor;
      if (!edge) continue;
      boundary++;
      const value = 0.2126 * img.data[s]! + 0.7152 * img.data[s + 1]! + 0.0722 * img.data[s + 2]!;
      if (value <= darkCut) dark++;
    }
  }
  return boundary === 0 ? null : round1((dark / boundary) * 100);
}

const tierAtMost = (value: number, green: number, yellow: number): MetricTier =>
  value <= green ? "green" : value <= yellow ? "yellow" : "red";

/**
 * 票 12 的整体判定：任一红灯 → 红；否则任一黄灯 → 黄；否则绿。
 *
 * 三个硬门槛（色数 / off-palette / 边界深色）只会给出绿或红。
 * 输入应是所有帧 / 帧对里的最差值（见 `AnimationMetrics`），不是平均值。
 */
export function verdictOf(metrics: AnimationMetrics): MetricTier {
  const t = ANIMATION_THRESHOLDS;
  const tiers: MetricTier[] = [
    tierAtMost(metrics.alphaMaskDiffPct, t.alphaMaskDiffPct.green, t.alphaMaskDiffPct.yellow),
    tierAtMost(metrics.bboxWidthDiffPct, t.bboxWidthDiffPct.green, t.bboxWidthDiffPct.yellow),
    tierAtMost(metrics.positionDriftPct, t.positionDriftPct.green, t.positionDriftPct.yellow),
    tierAtMost(metrics.backgroundL1, t.backgroundL1.green, t.backgroundL1.yellow),
    metrics.paletteCountMin >= t.paletteCountMin ? "green" : "red",
    metrics.offPalette === t.offPaletteMax ? "green" : "red",
    metrics.boundaryDarkPctMin >= t.boundaryDarkPctMin ? "green" : "red",
  ];
  return tiers.includes("red") ? "red" : tiers.includes("yellow") ? "yellow" : "green";
}
