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
  // ⚠️ **必须跳过全透明的像素**（2026-09-26 修）。四角取样曾经直接读 RGB，不看 alpha ——
  // 而 `cellsFromBoxes` 会把每格**居中补白**到统一宽度，补出来的是全透明（RGB=0）。
  // 于是「背景色」被读成黑色，抠掉的是**角色的暗部**，真正的背景原地不动，
  // 最后被量化成色板里的橙色（洋红离橙最近）。实测：交付帧 94% 不透明、主色 #c4694a。
  // 沿对角线往里走，找到第一个不透明像素为止。
  const opaqueFrom = (x0: number, y0: number, dx: number, dy: number): [number, number, number] => {
    const max = Math.min(img.width, img.height);
    for (let i = 0; i < max; i++) {
      const x = x0 + dx * i, y = y0 + dy * i;
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) break;
      const p = pixel(img, x, y);
      if (p[3]! >= 128) return p.slice(0, 3) as [number, number, number];
    }
    return pixel(img, Math.min(x0, img.width - 1), Math.min(y0, img.height - 1)).slice(0, 3) as [number, number, number];
  };
  const refs = [
    opaqueFrom(2, 2, 1, 1), opaqueFrom(img.width - 3, 2, -1, 1),
    opaqueFrom(2, img.height - 3, 1, -1), opaqueFrom(img.width - 3, img.height - 3, -1, -1),
  ];
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

/**
 * 裁到非透明像素的包围盒。全透明则原样返回（那是上游出错了，不该在这里静默产出 0×0）。
 *
 * ⚠️ **`floor` 取的是「会活下来的」alpha 下限，不是 `!== 0`**（2026-09-25 修正）。
 * 判据 `alpha !== 0` 与紧随其后的 `thresholdAlpha` 不自洽：一颗 alpha=1 的孤点会被它算作墨，
 * 于是包围盒被撑满整张画布，而那个像素在二值化后**根本不会出现**。
 * 实测（`experiments/real-generation/measure-import.mjs`）：一颗这样的孤点把角色在 32×48 里
 * 从 32×48 缩到 19×42，即**角色被缩到原大的 59%×88%**。
 * 模型给的透明底 PNG 常有这类极淡的 alpha 噪点，所以这条通道上它会真的发生。
 * 取 `alphaThreshold`（默认 0.5 ⇒ 128）之后，判据变成「这一像素自己就能通过二值化」——
 * 与最终结果一致，而不是与一个将被丢弃的中间量一致。
 */
export function trimToInk(img: RasterImage, opts: { floor?: number } = {}): RasterImage {
  const box = inkBBox(img, opts);
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
  /**
   * 指定的裁框。给了就**不再按本帧自己的 ink 包围盒裁**。
   *
   * ⚠️ 多帧资源**必须**走这条路（经 `importFrames`）—— 逐帧各裁各的会让同一角色
   * 在帧与帧之间改变位置与缩放，见 `importFrames` 的注释。
   */
  trimBox?: Box;
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

/** 裁框判据的 alpha 下限 —— 与 `thresholdAlpha` 同一把尺子（见 `trimToInk` 的注释）。 */
function inkFloor(alphaThreshold: number | null | undefined): number {
  return alphaThreshold === null ? 1 : Math.max(1, Math.round((alphaThreshold ?? 0.5) * 255));
}

/** 几帧的 ink 包围盒的**并集**（同一坐标系里算 —— 调用方须保证各帧同尺寸）。全透明返回 null。 */
export function unionInkBBox(images: readonly RasterImage[], opts: { floor?: number } = {}): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const img of images) {
    const b = inkBBox(img, opts);
    if (!b) continue;
    if (b.x < x0) x0 = b.x;
    if (b.y < y0) y0 = b.y;
    if (b.x + b.w - 1 > x1) x1 = b.x + b.w - 1;
    if (b.y + b.h - 1 > y1) y1 = b.y + b.h - 1;
  }
  return x1 < x0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

type Prepared = { keyed: RasterImage; report: ImportResult["report"] };

/** 抠背景那一段。单独拆出来是因为多帧要先知道**每帧**的 ink 在哪，才能算并集框。 */
function prepareFrame(img: RasterImage, opts: ImportOptions): Prepared {
  const report: ImportResult["report"] = {
    sourceSize: { w: img.width, h: img.height }, keyedPixels: 0, backgroundColors: [],
    trimmedTo: null, distinctColorsBeforeQuantize: 0,
  };
  if (!opts.background) return { keyed: img, report };
  const k = keyBackground(img, opts.background);
  report.keyedPixels = k.keyedPixels;
  report.backgroundColors = k.backgroundColors;
  return { keyed: k.image, report };
}

/** 裁框 → 降采样 → 二值化 → 量化那一段。`box` 是同资源各帧共用的并集框；null = 各帧裁自己的。 */
function finishFrame(prepared: Prepared, opts: ImportOptions, box: Box | null): ImportResult {
  const { report } = prepared;
  let cur = prepared.keyed;
  if (opts.trim !== false) {
    const before = { w: cur.width, h: cur.height };
    // 优先用**显式框**，其次用**同资源共用框**，都没有才裁到本帧自己的包围盒。
    // 裁框判据用「会活下来的」像素 —— 与下面的 thresholdAlpha 同一把尺子（见 trimToInk 的注释）。
    const use = opts.trimBox ?? box;
    if (use) {
      if (use.x < 0 || use.y < 0 || use.x + use.w > cur.width || use.y + use.h > cur.height)
        throw new Error(`裁框 ${use.x},${use.y} ${use.w}×${use.h} 超出图像 ${cur.width}×${cur.height}`);
      cur = cropToBox(cur, use);
    } else {
      cur = trimToInk(cur, { floor: inkFloor(opts.alphaThreshold) });
    }
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

/**
 * 导入管线：抠背景 → 裁到包围盒 → 面积平均降采样 → alpha 二值化 → 量化到色板。
 *
 * 顺序不是随意的：**先降采样再量化**，而不是反过来。
 * 反过来的话，被量化掉的颜色在降采样时还会参与平均 —— 等于用一堆已经丢掉的信息
 * 去决定每一格的颜色。实测（票 23 原型）三种降采样策略的对比见
 * `experiments/bitmap-import-draft/`。
 *
 * ⚠️ **单帧**用这个；多帧用 `importFrames`（各帧必须共用裁框，理由见那里）。
 */
export function importBitmap(img: RasterImage, opts: ImportOptions): ImportResult {
  return finishFrame(prepareFrame(img, opts), opts, null);
}

/**
 * 一次导入**一个资源的多帧** —— 全部帧共用同一个裁框。
 *
 * ⚠️ **为什么必须共用**（2026-09-25 修）：此前 `pack.ts` 逐帧调 `importBitmap`，
 * 它逐帧裁到各自的 ink 包围盒，而 `tw/th` 又是从**裁完的**图推的 ——
 * 于是「腿并拢」与「腿分开」两帧不只位置不同，**缩放也不同**，同一角色逐帧脉动。
 * 更根本的是 `AssetSpec.anchor` 是**逐资源**声明的：逐帧裁框让同一个 anchor
 * 在每一帧落在角色身上不同的位置，**anchor 语义在动画资源上因此失效**。
 * 共用并集框之后，各帧之间的相对位置与比例被原样保留，anchor 才有的放矢。
 *
 * 代价：并集框比任何单帧的都大，所以单看某帧角色会略小 —— 那是这个动画的**真实**范围。
 */
export function importFrames(images: readonly RasterImage[], opts: ImportOptions): ImportResult[] {
  if (images.length === 0) throw new Error("importFrames: 至少要有一帧");
  const { width, height } = images[0]!;
  for (const img of images)
    if (img.width !== width || img.height !== height)
      throw new Error(
        `importFrames: 各帧尺寸必须一致（第一帧 ${width}×${height}，有一帧是 ${img.width}×${img.height}）—— ` +
        "并集裁框是在同一个坐标系里算的，尺寸不同就无从并起",
      );
  const prepared = images.map((img) => prepareFrame(img, opts));
  const box = opts.trim === false
    ? null
    : unionInkBBox(prepared.map((p) => p.keyed), { floor: inkFloor(opts.alphaThreshold) });
  return prepared.map((p) => finishFrame(p, opts, box));
}
