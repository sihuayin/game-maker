// 人工导入通道：把**人给的位图**变成能进包的东西（票 23）。
//
// R10/票 35 定了：**管线永不调用生图 API**，位图只从这里进来。
// 所以这条通道不是「可选路线」，它是产物 A 在「手绘质感」这一侧的**唯一入口**。
//
// ⚠️ 一条实测事实决定了整套设计（票 23 的原型，见 experiments/bitmap-import-draft/）：
// 让模型画「像素风」，它给回来的是**像素画风格的抗锯齿图** ——
// 实测那张 1024×1024 的角色：边缘位置对任何 k 取模都是均匀分布（**没有整数像素网格**）、
// **61152 种颜色**、背景还不是平色（四角取样得到 4 种颜色，有渐变与噪点）。
//
// 所以这里做的不是「重采样回原网格」（没有那个网格），是**重建**一个：
// 抠背景 → 裁到包围盒 → 面积平均降采样 → alpha 二值化 → 量化到世界色板。
import { emptyImage, inkBBox, resizeNearest, type RasterImage } from "./image.js";
import { quantizeToPalette } from "./quantize.js";

export type Box = { x: number; y: number; w: number; h: number };

const pixel = (img: RasterImage, x: number, y: number): [number, number, number, number] => {
  const s = (y * img.width + x) * 4;
  return [img.data[s]!, img.data[s + 1]!, img.data[s + 2]!, img.data[s + 3]!];
};

/**
 * 抠背景 → alpha。
 *
 * 只能按**容差**做，不能判等：实测那张图的背景四角取样得到 **4 种**颜色（有渐变与噪点），
 * 判等会把大半背景留下来。取四角各自为参考色，像素与**最近的那个**比。
 *
 * ⚠️ 这是「够用」而不是「正确」—— 它假定背景是与主体色差明显的近纯色。
 * 背景复杂时（照片、多色场景）人应当自己给透明底的 PNG。
 */
export function keyBackground(img: RasterImage, { tolerance = 30 }: { tolerance?: number } = {}): {
  image: RasterImage; backgroundColors: [number, number, number][]; keyedPixels: number;
} {
  const corners = [[2, 2], [img.width - 3, 2], [2, img.height - 3], [img.width - 3, img.height - 3]] as const;
  const refs = corners.map(([x, y]) => pixel(img, x, y).slice(0, 3) as [number, number, number]);
  const out: RasterImage = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  let keyed = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * 4;
    let best = Infinity;
    for (const c of refs) {
      const d = Math.abs(img.data[s]! - c[0]) + Math.abs(img.data[s + 1]! - c[1]) + Math.abs(img.data[s + 2]! - c[2]);
      if (d < best) best = d;
    }
    if (best <= tolerance) { out.data[s + 3] = 0; keyed++; }
  }
  return { image: out, backgroundColors: refs, keyedPixels: keyed };
}

/**
 * 面积平均降采样（**按 alpha 加权**）。
 *
 * alpha 加权不是可选项：把不透明像素与透明像素直接平均，会把主体边缘拉向背景色，
 * 在轮廓上烧出一圈暗边。
 *
 * alpha 本身取格内均值（保留半透明边缘），二值化交给 `thresholdAlpha()` ——
 * 分开是为了让「要么有要么没有」这个决定能单独被看见、被测试。
 */
export function downscaleArea(img: RasterImage, width: number, height: number): RasterImage {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    throw new Error(`downscaleArea: 目标尺寸必须是正整数，收到 ${width}×${height}`);
  if (width === img.width && height === img.height) return img;
  const out = emptyImage(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx0 = Math.floor((x * img.width) / width), sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * img.width) / width));
    const sy0 = Math.floor((y * img.height) / height), sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * img.height) / height));
    let r = 0, g = 0, b = 0, aSum = 0, wSum = 0, n = 0;
    for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
      const [pr, pg, pb, pa] = pixel(img, sx, sy);
      const w = pa / 255;
      r += pr * w; g += pg * w; b += pb * w; aSum += pa; wSum += w; n++;
    }
    const d = (y * width + x) * 4;
    if (wSum > 0) { out.data[d] = Math.round(r / wSum); out.data[d + 1] = Math.round(g / wSum); out.data[d + 2] = Math.round(b / wSum); }
    out.data[d + 3] = Math.round(aSum / n);
  }
  return out;
}

/**
 * alpha 二值化。像素风要的是「要么有要么没有」——
 * 半透明边缘在游戏里会与背景混色，产出色板外的像素。
 */
export function thresholdAlpha(img: RasterImage, { threshold = 0.5 }: { threshold?: number } = {}): RasterImage {
  const cut = Math.round(threshold * 255);
  const out: RasterImage = { width: img.width, height: img.height, data: Buffer.from(img.data) };
  for (let i = 0; i < img.width * img.height; i++) out.data[i * 4 + 3] = out.data[i * 4 + 3]! >= cut ? 255 : 0;
  return out;
}

/** 裁到指定矩形。 */
export function cropToBox(img: RasterImage, box: Box): RasterImage {
  const out = emptyImage(box.w, box.h);
  for (let y = 0; y < box.h; y++)
    img.data.copy(out.data, y * box.w * 4, ((box.y + y) * img.width + box.x) * 4, ((box.y + y) * img.width + box.x + box.w) * 4);
  return out;
}

/** 裁到非透明像素的包围盒。全透明则原样返回（那是上游出错了，不该在这里静默产出 0×0）。 */
export function trimToInk(img: RasterImage): RasterImage {
  const box = inkBBox(img);
  return box ? cropToBox(img, box) : img;
}

export type GridSpec = {
  columns: number; rows: number;
  /** 每格的尺寸（源图像素）。 */
  frameWidth: number; frameHeight: number;
  /** 起始偏移，默认 0。 */
  offsetX?: number; offsetY?: number;
  /** 格间距，默认 0（紧密排布）。 */
  spacingX?: number; spacingY?: number;
};

/**
 * 按网格切 sheet。**行优先**返回：`frames[row * columns + column]`。
 *
 * ⚠️ **它只在「那张图真有网格」时成立** —— 人用 Aseprite 排的 sheet 有，
 * 模型生成的**没有**（实测：边缘位置对任何 k 取模都是均匀分布）。
 * 所以这条通道的输入是人给的图，模型产出走 `keyBackground` + `downscaleArea`。
 */
export function sliceGrid(img: RasterImage, spec: GridSpec): RasterImage[] {
  const { columns, rows, frameWidth, frameHeight, offsetX = 0, offsetY = 0, spacingX = 0, spacingY = 0 } = spec;
  if (![columns, rows, frameWidth, frameHeight].every((v) => Number.isInteger(v) && v > 0))
    throw new Error("sliceGrid: columns / rows / frameWidth / frameHeight 必须是正整数");
  const needW = offsetX + columns * frameWidth + (columns - 1) * spacingX;
  const needH = offsetY + rows * frameHeight + (rows - 1) * spacingY;
  if (needW > img.width || needH > img.height)
    throw new Error(`sliceGrid: 网格需要 ${needW}×${needH}，但图只有 ${img.width}×${img.height}`);
  const frames: RasterImage[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++)
    frames.push(cropToBox(img, { x: offsetX + c * (frameWidth + spacingX), y: offsetY + r * (frameHeight + spacingY), w: frameWidth, h: frameHeight }));
  return frames;
}

export type ImportOptions = {
  /** 目标像素网格。给一个就够，另一个按比例算。 */
  targetWidth?: number; targetHeight?: number;
  /** 世界色板。**导入位图默认量化到它**（票 23 的裁决）。 */
  palette: readonly string[];
  /** 抠背景。给了才抠；不给就假定人已经给了透明底。 */
  background?: { tolerance?: number };
  /** alpha 二值化阈值，默认 0.5。传 `null` 保留半透明边缘（不推荐，会产出色板外颜色）。 */
  alphaThreshold?: number | null;
  /** 裁到非透明包围盒，默认 true。 */
  trim?: boolean;
  /** 整数倍放大（像素风放大），默认 1。 */
  pixelScale?: number;
};

export type ImportResult = RasterImage & {
  /** 量化前的网格图（保留源图的颜色数）—— 用来说明「不量化会长什么样」。 */
  grid: RasterImage;
  /** 事实记录，供人核对与写进 manifest 的 provenance。 */
  report: {
    sourceSize: { w: number; h: number };
    keyedPixels: number;
    backgroundColors: [number, number, number][];
    trimmedTo: { w: number; h: number } | null;
    distinctColorsBeforeQuantize: number;
  };
};

/**
 * 导入管线：抠背景 → 裁到包围盒 → 面积平均降采样 → alpha 二值化 → 量化到色板。
 *
 * 顺序不是随意的：**先降采样再量化**，而不是反过来。
 * 反过来的话，被量化掉的颜色在降采样时还会参与平均 —— 等于用一堆已经丢掉的信息
 * 去决定每一格的颜色。实测（票 23 原型）三种降采样策略的对比见
 * `experiments/bitmap-import-draft/`。
 */
export function importBitmap(img: RasterImage, opts: ImportOptions): ImportResult {
  const report: ImportResult["report"] = {
    sourceSize: { w: img.width, h: img.height }, keyedPixels: 0, backgroundColors: [],
    trimmedTo: null, distinctColorsBeforeQuantize: 0,
  };
  let cur = img;
  if (opts.background) {
    const k = keyBackground(cur, opts.background);
    cur = k.image;
    report.keyedPixels = k.keyedPixels;
    report.backgroundColors = k.backgroundColors;
  }
  if (opts.trim !== false) {
    const before = { w: cur.width, h: cur.height };
    cur = trimToInk(cur);
    if (cur.width !== before.w || cur.height !== before.h) report.trimmedTo = { w: cur.width, h: cur.height };
  }

  const tw = opts.targetWidth ?? Math.max(1, Math.round((cur.width / cur.height) * (opts.targetHeight ?? 32)));
  const th = opts.targetHeight ?? Math.max(1, Math.round((cur.height / cur.width) * (opts.targetWidth ?? 32)));
  let grid = downscaleArea(cur, tw, th);
  if (opts.alphaThreshold !== null) grid = thresholdAlpha(grid, { threshold: opts.alphaThreshold ?? 0.5 });

  const colors = new Set<string>();
  for (let i = 0; i < grid.width * grid.height; i++) {
    const s = i * 4;
    if (grid.data[s + 3] !== 0) colors.add(`${grid.data[s]},${grid.data[s + 1]},${grid.data[s + 2]}`);
  }
  report.distinctColorsBeforeQuantize = colors.size;

  const quantized = quantizeToPalette(grid, opts.palette);
  const scale = opts.pixelScale ?? 1;
  const final = scale === 1 ? quantized : resizeNearest(quantized, tw * scale, th * scale);
  return Object.assign(final, { grid, report });
}
