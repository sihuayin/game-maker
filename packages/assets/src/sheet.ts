// 把模型画的「一排角色」切成帧。
//
// ⚠️ **为什么不能等分切**（2026-09-26 实测，见
// `.scratch/game-creation-v1/experiments/master-to-animation/`）：
// 让模型画「一排 6 格、每格等宽」，它给你 **5 个角色、间距还不均匀**。
// 按 1344/6 = 224 等分切，相邻角色会被切进同一格 —— 实测逐帧头宽极差 **144**（格宽 224）。
// 而按**列的零墨区间**切，同一张图的身高级差降到 **1 像素**。
//
// 也就是说：模型不按格子排版，但它会在角色之间留干净的缝。切法要跟着这个事实走。
import { emptyImage, type RasterImage } from "./image.js";
import type { Box } from "./import.js";

export type SegmentOptions = {
  /** alpha 下限，与 `trimToInk` 同一把尺子。 */
  floor?: number;
  /** 两块之间至少要空多少列才算「缝」。太小的会被当成噪声。 */
  minGap?: number;
  /** 一块至少要占多少列才留下来 —— 用来滤掉模型偶尔甩出的孤立噪点。 */
  minWidth?: number;
  /**
   * 一块的宽度至少要达到**其余块的宽度中位数**的几成，否则判为碎片。
   *
   * ⚠️ 固定像素阈值治不了这个：实测一张 1344 宽的 run sheet 分出 6 块，
   * 宽度是 `17,147,175,150,198,228` —— 那个 17 是碎渣。靠 `minWidth` 定死一个
   * 绝对数会同时要么漏掉碎渣、要么切掉真的窄角色（比如侧面姿势）。
   */
  minRelativeWidth?: number;
  /** 一块里的墨至少要占多少行，理由同上。 */
  minInkRows?: number;
};

/** 这一列有没有墨（只看到第一个墨像素就够）。 */
const columnHasInk = (img: RasterImage, x: number, floor: number): boolean => {
  for (let y = 0; y < img.height; y++) if (img.data[(y * img.width + x) * 4 + 3]! >= floor) return true;
  return false;
};

/**
 * 按竖直方向的墨迹间隙把一行图切成若干块，**行优先**。
 *
 * 返回的是每块在本图上的矩形（已裁到该块的墨包围盒）。切不出块时返回空数组 ——
 * 调用方自己决定那是「上游出错了」还是「这一帧本来就是空的」。
 */
export function segmentRow(img: RasterImage, opts: SegmentOptions = {}): Box[] {
  const floor = opts.floor ?? 128;
  const minGap = opts.minGap ?? Math.max(2, Math.round(img.width / 200));
  const minWidth = opts.minWidth ?? Math.max(2, Math.round(img.width / 400));
  const minInkRows = opts.minInkRows ?? Math.max(2, Math.round(img.height / 100));

  const spans: [number, number][] = [];
  let start = -1, gap = 0;
  for (let x = 0; x < img.width; x++) {
    if (columnHasInk(img, x, floor)) {
      if (start < 0) start = x;
      gap = 0;
    } else if (start >= 0 && ++gap >= minGap) {
      spans.push([start, x - gap]);
      start = -1;
      gap = 0;
    }
  }
  if (start >= 0) spans.push([start, img.width - 1]);

  const boxes: Box[] = [];
  for (const [x0, x1] of spans) {
    if (x1 - x0 + 1 < minWidth) continue;
    let y0 = Infinity, y1 = -Infinity, rows = 0;
    for (let y = 0; y < img.height; y++) {
      let any = false;
      for (let x = x0; x <= x1; x++) if (img.data[(y * img.width + x) * 4 + 3]! >= floor) { any = true; break; }
      if (any) { rows++; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (rows < minInkRows) continue;
    boxes.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  // 按**相对宽度**再滤一遍碎片（见 `minRelativeWidth` 的注释）。
  const rel = opts.minRelativeWidth ?? 0.4;
  if (boxes.length >= 3) {
    const ws = [...boxes.map((b) => b.w)].sort((a, b) => a - b);
    const median = ws[Math.floor(ws.length / 2)]!;
    return boxes.filter((b) => b.w >= median * rel);
  }
  return boxes;
}

/** 把若干块横排拼成一张联系表（供人眼验收）。块之间留 `gap` 列透明。 */
export function montageRow(img: RasterImage, boxes: readonly Box[], gap = 8): RasterImage {
  if (boxes.length === 0) return emptyImage(1, 1);
  const h = Math.max(...boxes.map((b) => b.h));
  const out = emptyImage(boxes.reduce((s, b) => s + b.w + gap, 0) - gap, h);
  let x = 0;
  for (const b of boxes) {
    for (let y = 0; y < b.h; y++)
      img.data.copy(out.data, (y * out.width + x) * 4, ((b.y + y) * img.width + b.x) * 4, ((b.y + y) * img.width + b.x + b.w) * 4);
    x += b.w + gap;
  }
  return out;
}

/**
 * 一行图 → **等尺寸的各帧**（可交给 `importFrames`）。
 *
 * ⚠️ 为什么不能直接把 `segmentRow` 的块拿去用：那些块各自裁到了自己的墨包围盒，
 * **宽度与高度都不一样**，而 `importFrames` 的共用裁框要求各帧同尺寸（并集是在同一个
 * 坐标系里算的）。所以这里把每块按**整图高**取出来、再统一补到最宽的宽度，
 * 补的位置**居中** —— 角色的相对位置与比例因此原样保留，这正是共用裁框要的东西。
 */
export function cellsFromBoxes(img: RasterImage, boxes: readonly Box[]): RasterImage[] {
  if (boxes.length === 0) return [];
  const w = Math.max(...boxes.map((b) => b.w));
  return boxes.map((b) => {
    const cell = emptyImage(w, img.height);            // 整图高 —— 脚底线因此对齐
    const off = Math.floor((w - b.w) / 2);
    for (let y = 0; y < img.height; y++)
      img.data.copy(cell.data, (y * w + off) * 4, (y * img.width + b.x) * 4, (y * img.width + b.x + b.w) * 4);
    return cell;
  });
}

/**
 * 一行图 → 等尺寸的各帧。
 *
 * ⚠️ **`probe` 与 `img` 是两个东西，别合成一个**：分块看的是 **alpha**，所以 `probe`
 * 必须是**抠过背景**的图；而裁帧要用**原图**（`img`）—— 抠过的图已经被抹过一遍，
 * 拿它去裁会让 `importFrames` 拿不到「抠掉了多少」那些事实。
 * 实测教训：一开始只传原图，而原图根本没有 alpha（Gemini 返回的是纯 RGB + 洋红底），
 * 于是**每一列都"有墨"**，一整排 4 个角色被判定成 **1 块**。
 */
export function segmentRowCells(img: RasterImage, probe: RasterImage, opts: SegmentOptions = {}): { cells: RasterImage[]; boxes: Box[] } {
  if (probe.width !== img.width || probe.height !== img.height)
    throw new Error(`segmentRowCells: probe(${probe.width}×${probe.height}) 与 img(${img.width}×${img.height}) 不同尺寸 —— 它们是同一张图抠前与抠后`);
  const boxes = segmentRow(probe, opts);
  return { cells: cellsFromBoxes(img, boxes), boxes };
}
