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
import { cropToBox, foregroundBlocks, sliceGrid, type Box } from "./import.js";

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
  // ⚠️ 两块时也执行（票 101 / 102）：13h 的现场正是「1 个真角色 + 1 个 28px 碎块」，
  //   旧守卫 `>= 3` 会让碎块凑够 2 帧、静默通过。n=2 时 median 取的是**较大块**，
  //   等价于「≥ 较大块的 40%」。⚠️ 不能直接删守卫：0 块时 `ws[0]` 是 undefined。
  const rel = opts.minRelativeWidth ?? 0.4;
  if (boxes.length >= 2) {
    const ws = [...boxes.map((b) => b.w)].sort((a, b) => a - b);
    const median = ws[Math.floor(ws.length / 2)]!;
    return boxes.filter((b) => b.w >= median * rel);
  }
  return boxes;
}

/**
 * 画面**最底部**那一段连续的高覆盖率横带（票 99 · 票 100）。
 *
 * ⚠️ **只认「最底部的那一段有墨的行」**：从整幅图最下面的 ink 行往上走，连续满足
 *   `coverage >= minCover` 的行才算；一旦断开就停。画面中部的高覆盖行**不算** ——
 *   那可能是几个角色并排时的一行（实测正常图最高到 83.4%），不是「贯穿底部的横带」。
 *
 * ⚠️ **minCover 取 80% 是量出来的（票 101 / 102）**：13h 的横带 15 行、每行 ≥85%、均值 88.5%，
 *   而盘上 21 张正常图的底部连续段是 **0 行 ≥80%** —— 形状本身已经把误报挡住了，
 *   80% 只是给真横带留余量；命中后仍要「重分块正好 N 块」才接受。
 *
 * ⚠️ **它不是判据，是救援的入口**：`pack` 只在「第一次分块数 ≠ spec 的 N」时才调它；
 *   正常图的行为一字不改。返回的 `cover` 是带子各行覆盖率的平均值（区间 `y0..y1` 含端点）。
 */
export function bottomBand(
  img: RasterImage,
  { floor = 128, minCover = 0.8, minRows = 3 }: { floor?: number; minCover?: number; minRows?: number } = {},
): { y0: number; y1: number; rows: number; cover: number } | null {
  const cover = (y: number): number => {
    let n = 0;
    for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3]! >= floor) n++;
    return n / img.width;
  };
  // 最下面的 ink 行 —— 它下面必须是空的，带子才叫「贴着底部」。
  let y1 = -1;
  for (let y = img.height - 1; y >= 0; y--) if (cover(y) > 0) { y1 = y; break; }
  if (y1 < 0) return null;
  let y0 = y1;
  let sum = 0;
  while (y0 >= 0 && cover(y0) >= minCover) { sum += cover(y0); y0--; }
  y0++;
  const rows = y1 - y0 + 1;
  if (rows < minRows || y0 <= 0) return null;   // y0 <= 0 = 整幅图都是带子，裁完什么也不剩
  return { y0, y1, rows, cover: sum / rows };
}

/** 把 `bottomBand` 找到的那一段（连同它下面的空行）裁掉，只留 `y < band.y0`。 */
export function cropAboveBand(img: RasterImage, band: { y0: number }): RasterImage {
  if (band.y0 <= 0 || band.y0 > img.height)
    throw new Error(`cropAboveBand: y0=${band.y0} 超出图像高度 ${img.height}`);
  return cropToBox(img, { x: 0, y: 0, w: img.width, h: band.y0 });
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

/**
 * 把**生成出来的**固定网格图按 `columns × rows` 切 —— 票 01。
 *
 * ⚠️ 与 `sliceGrid`（导入通道）**不是同一个入口**：那一份的输入是人用工具排的 sheet
 *   （格宽/间距/偏移都写得出来），而这里只有「几列几行」—— 格子大小由**回来的图**定。
 *   上游按 aspect 表回尺寸，**不必整除**（实测 Gemini 常态），所以余下的边缘像素**居中让掉**，
 *   而不是让最后一格窄 1 像素（那会让 `importFrames` 的共用裁框错位）。
 *
 * 返回**行优先**：`frames[row * columns + column]`，与 `framePlan` 的顺序一致。
 */
export function sliceGridCells(img: RasterImage, spec: { columns: number; rows: number }): RasterImage[] {
  const { columns, rows } = spec;
  if (![columns, rows].every((v) => Number.isInteger(v) && v > 0))
    throw new Error("sliceGridCells: columns / rows 必须是正整数");
  if (img.width < columns || img.height < rows)
    throw new Error(`sliceGridCells: 图 ${img.width}×${img.height} 装不下 ${columns}×${rows} 的网格`);
  const frameWidth = Math.floor(img.width / columns);
  const frameHeight = Math.floor(img.height / rows);
  return sliceGrid(img, {
    columns, rows, frameWidth, frameHeight,
    offsetX: Math.floor((img.width - columns * frameWidth) / 2),
    offsetY: Math.floor((img.height - rows * frameHeight) / 2),
  });
}

/** 一格的读数**为什么不合格**。⚠️ 报文由 `pack` 拼（这里只交事实，不带资源名）。 */
export type SheetCellIssue =
  | { kind: "empty"; index: number; row: number; column: number }
  | { kind: "fragmented"; index: number; row: number; column: number; blocks: number; largestShare: number }
  | { kind: "border"; index: number; row: number; column: number; edges: { top: number; bottom: number; left: number; right: number } };

/**
 * **每格内容校验**（票 01 的人裁：严格结构）。
 *
 * 三条判据：
 *  ① **空格**：一个不透明像素都没有 ⇒ 失败（模型漏画一格）。
 *  ② **四边框**：墨同时贴住格子的上/下/左/右四条边、且每条边覆盖率 ≥ `borderCover`
 *     ⇒ 失败。这是 C2 idle 那种「黑框」的形状：角色自身贴一条边是构图，**四条边**同时贴住
 *     只可能是画框 / 画溢出格。
 *  ③ **多主体/碎片**：抠底后最大连通块占比 < `minLargestShare` ⇒ 失败。
 *     0.6 是**单帧那条已有的尺子**（`pack.ts` 的「最大块 ≥ 60%」），不是这一票新拍的数。
 *
 * ⚠️ **文字**只能被 ③ 间接发现（文字是额外连通块）。小号标注（C2 的 `48:1`）在 60% 这条线
 *   底下可能漏过 —— 没有 OCR 就不假装能判；提示词那一侧已经逐字禁止编号/文字。
 * ⚠️ 输入必须是**抠过背景**的那一份（alpha 才是墨），与 `segmentRowCells` 的探针同款。
 */
export function auditSheetCells(
  cells: readonly RasterImage[],
  opts: { columns: number; rows: number; minLargestShare?: number; borderCover?: number },
): SheetCellIssue[] {
  const { columns, rows, minLargestShare = 0.6, borderCover = 0.5 } = opts;
  if (![columns, rows].every((v) => Number.isInteger(v) && v > 0))
    throw new Error("auditSheetCells: columns / rows 必须是正整数");
  if (cells.length !== columns * rows)
    throw new Error(`auditSheetCells: 给了 ${cells.length} 格，但网格是 ${columns}×${rows} = ${columns * rows} 格`);

  const ink = (img: RasterImage, x: number, y: number): boolean => img.data[(y * img.width + x) * 4 + 3]! >= 128;
  /** 四条边的墨覆盖率（分母是该边的长度）。 */
  const edgeCover = (img: RasterImage) => {
    let top = 0, bottom = 0, left = 0, right = 0;
    for (let x = 0; x < img.width; x++) {
      if (ink(img, x, 0)) top++;
      if (ink(img, x, img.height - 1)) bottom++;
    }
    for (let y = 0; y < img.height; y++) {
      if (ink(img, 0, y)) left++;
      if (ink(img, img.width - 1, y)) right++;
    }
    return { top: top / img.width, bottom: bottom / img.width, left: left / img.height, right: right / img.height };
  };

  const issues: SheetCellIssue[] = [];
  cells.forEach((cell, index) => {
    const row = Math.floor(index / columns), column = index % columns;
    const blocks = foregroundBlocks(cell);
    if (blocks.total === 0) { issues.push({ kind: "empty", index, row, column }); return; }
    const edges = edgeCover(cell);
    if (Math.min(edges.top, edges.bottom, edges.left, edges.right) >= borderCover) {
      issues.push({ kind: "border", index, row, column, edges });
      return;
    }
    if (blocks.largestShare < minLargestShare)
      issues.push({ kind: "fragmented", index, row, column, blocks: blocks.areas.length, largestShare: blocks.largestShare });
  });
  return issues;
}
