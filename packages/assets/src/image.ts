// 位图的内存表达。**唯一**的图像类型：RGBA8、行优先、不含任何 DOM/Canvas 依赖。
export type RasterImage = { width: number; height: number; data: Buffer };

export function emptyImage(width: number, height: number): RasterImage {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

/**
 * 最近邻缩放。
 *
 * 像素风资源**只有这一种**放大方式：双线性会在色板色之间插值，产出色板外颜色，
 * 让「颜色 ∈ 色板」当场失效（票 36 的不变量）。整数倍放大时它等价于把每个像素
 * 摊成 scale×scale 的方块，逐字节可预测。
 */
export function resizeNearest(img: RasterImage, width: number, height: number): RasterImage {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    throw new Error(`resizeNearest: 目标尺寸必须是正整数，收到 ${width}×${height}`);
  if (width === img.width && height === img.height) return img;
  const out = emptyImage(width, height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y * img.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x * img.width) / width));
      img.data.copy(out.data, (y * width + x) * 4, (sy * img.width + sx) * 4, (sy * img.width + sx) * 4 + 4);
    }
  }
  return out;
}

/** 非透明像素的包围盒。全透明时返回 null。 */
export function inkBBox(
  img: RasterImage,
  /** alpha 下限。`1` = 任何非零 alpha 都算墨（缺省，向后兼容）。 */
  opts: { floor?: number } = {},
): { x: number; y: number; w: number; h: number } | null {
  const floor = opts.floor ?? 1;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3]! >= floor) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
  return x1 < x0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export type PaletteExactness = {
  /** 每个非透明像素的颜色是否都 ∈ 色板。 */
  exact: boolean;
  /** 色板外的颜色及各自出现的像素数，按出现次数降序。 */
  offPalette: { color: string; pixels: number }[];
};

/**
 * 扫像素，判定「这个位图的颜色 ∈ 色板」。
 *
 * 它**不是**判据而是**验证** —— 对 drawlist 资源，绑定关系在解析期就由
 * `paletteBindingOf()` 静态定了（票 36）；这个函数是用来**测试那个判定**的。
 * 对人工导入的位图（颜色本来就不受色板约束），它是唯一能说出「差多少」的手段。
 */
export function paletteExactness(img: RasterImage, palette: readonly string[]): PaletteExactness {
  const allowed = new Set(palette.map((c) => c.toLowerCase()));
  const off = new Map<string, number>();
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * 4;
    if (img.data[s + 3] === 0) continue;
    const hex = "#" + [img.data[s]!, img.data[s + 1]!, img.data[s + 2]!].map((v) => v.toString(16).padStart(2, "0")).join("");
    if (!allowed.has(hex)) off.set(hex, (off.get(hex) ?? 0) + 1);
  }
  const offPalette = [...off].map(([color, pixels]) => ({ color, pixels })).sort((a, b) => b.pixels - a.pixels || a.color.localeCompare(b.color));
  return { exact: offPalette.length === 0, offPalette };
}

/**
 * 丢掉**帧内**的孤立碎点（票 107 的免费前置）。
 *
 * ⚠️ 现场：生图会在角色头顶留下极淡的字形/噪点；抠底之后它们变成几十个不透明像素。
 *   切帧时它们**不是**独立的块（和角色在同一列），却被算进并集包围盒 ⇒
 *   idle 帧被压到 71/108 高、头顶永远飘着碎点；run 帧没有碎点 ⇒ 满高 —— 游戏里站住会缩小。
 *
 * 规则（保守）：以最大的连通块为主块；只丢「面积 < max(minArea, maxShare × 主块面积)」
 * **且**包围盒与主块包围盒**完全不相交**的块。贴身的饰件、大的分离部件都留下。
 * 返回新图（不改原图）；没有可丢的块时原样返回。
 */
export function dropDetachedSpecks(
  img: RasterImage,
  opts: { floor?: number; maxShare?: number; minArea?: number } = {},
): RasterImage {
  const floor = opts.floor ?? 1;
  const maxShare = opts.maxShare ?? 0.05;
  const minArea = opts.minArea ?? 4;
  const { width: w, height: h, data } = img;
  const labels = new Int32Array(w * h).fill(0); // 0 = 没看过
  const sizes = [0];
  const boxes = [{ x0: 0, y0: 0, x1: -1, y1: -1 }];
  const stack: number[] = [];
  let n = 0;
  for (let sy = 0; sy < h; sy++)
    for (let sx = 0; sx < w; sx++) {
      const start = sy * w + sx;
      if (labels[start] !== 0 || data[start * 4 + 3]! < floor) continue;
      n += 1;
      labels[start] = n;
      stack.push(start);
      let size = 0;
      let x0 = sx, y0 = sy, x1 = sx, y1 = sy;
      while (stack.length > 0) {
        const i = stack.pop()!;
        const x = i % w, y = (i - x) / w;
        size += 1;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (labels[j] !== 0 || data[j * 4 + 3]! < floor) continue;
            labels[j] = n;
            stack.push(j);
          }
      }
      sizes.push(size);
      boxes.push({ x0, y0, x1, y1 });
    }
  if (n <= 1) return img;
  let main = 1;
  for (let c = 2; c <= n; c++) if (sizes[c]! > sizes[main]!) main = c;
  const mb = boxes[main]!;
  const limit = Math.max(minArea, Math.ceil(sizes[main]! * maxShare));
  const drop = new Set<number>();
  for (let c = 1; c <= n; c++) {
    if (c === main || sizes[c]! >= limit) continue;
    const b = boxes[c]!;
    const intersects = !(b.x1 < mb.x0 || b.x0 > mb.x1 || b.y1 < mb.y0 || b.y0 > mb.y1);
    if (!intersects) drop.add(c);
  }
  if (drop.size === 0) return img;
  const out = { width: w, height: h, data: Buffer.from(data) };
  for (let i = 0; i < w * h; i++)
    if (drop.has(labels[i]!)) {
      const s = i * 4;
      out.data[s] = 0; out.data[s + 1] = 0; out.data[s + 2] = 0; out.data[s + 3] = 0;
    }
  return out;
}

/**
 * 丢掉帧**底部**的地面线 / 细虚线（票 03 的零付费后处理）。
 *
 * 现场：模型会在角色脚下画一条贯穿画面的细横线（或几段虚线）。它有两个麻烦：
 *   · 它常常**贴着脚**（和身体连成一块）⇒ `dropDetachedSpecks` 的「孤立」判据够不着它；
 *   · 它落在 ink 包围盒的底边上 ⇒ 并集裁框把它当真内容，跳跃帧被整体缩小、脚离底边更远。
 *
 * 判据（**只看 alpha**，不猜颜色）：
 *   · 从 ink 最底一行往上找，先跳过 ≤ `maxTail` 行抗锯齿残边；
 *   · 线是「行覆盖**突然跳高**」的那一段：从底边往上找第一行满足
 *     `覆盖(y) − 覆盖(y−1) ≥ minJump × 宽`，且它到 `end` 的每一行都 ≥ `minCover × 宽`；
 *   · 这一段必须**薄**（≤ `maxRows` 行）—— 否则那是身体 / 底座，不是线。
 *   ⚠️ 只看绝对覆盖率不够：一条宽身体的帧（`jump2`）整段身体都过 `minCover`。
 *     跳变把「线」和「面积大的身体」分开 —— 真图上线的跳变是 **0.39–0.44×宽**，
 *     最窄的一条（`wasteland-enemy.patrol2`）也有 **0.058×宽**。
 *
 * **脚部保护**：只删「正上方没有墨」的像素（逐行从上往下处理）。贴脚的那一小段会留下，
 * 成为脚底的延伸，而不是把脚切掉 —— 判据宁可少删，也不许切到脚。
 *
 * 默认值来自真图实测（`.scratch/style-migration-v1/runs/2026-10-19k-patch` 的 61 帧）：
 * 线所在行覆盖 **0.30–0.77**，脚所在行 **0.16–0.25**，线高 **5px**。
 * `maxRows` 按图高 1% 取（1184 → 12 行）。
 *
 * 返回新图（不改原图）；没有命中时原样返回。**默认不启用**（见 `ImportOptions.dropBottomLines`）——
 * 人给的位图不替人做主，只有生图那条路会传 true。
 */
export function dropBottomGroundLines(
  img: RasterImage,
  opts: { floor?: number; minCover?: number; minJump?: number; maxRows?: number; maxTail?: number } = {},
): RasterImage {
  const floor = opts.floor ?? 1;
  const minCover = opts.minCover ?? 0.28;
  const minJump = opts.minJump ?? 0.04;
  const maxRows = opts.maxRows ?? Math.max(2, Math.ceil(img.height * 0.01));
  const maxTail = opts.maxTail ?? 3;
  const { width: w, height: h, data } = img;
  const counts = new Int32Array(h);
  let bot = -1;
  for (let y = 0; y < h; y++) {
    let c = 0;
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]! >= floor) c++;
    counts[y] = c;
    if (c > 0) bot = y;
  }
  if (bot < 0) return img;
  const need = minCover * w;
  const jump = minJump * w;
  // 最底几行可能是线的抗锯齿残边（覆盖不够），先跳过；跳太多就说明底下不是线。
  let y = bot, tail = 0;
  while (y >= 0 && counts[y]! < need) {
    tail++;
    if (tail > maxTail) return img;
    y--;
  }
  const end = y;
  // 在「线最多能有 maxRows 行」的窗口里，**从最高的候选行往下**找第一个跳变 = 线的顶边。
  // ⚠️ 从底边往上找会把线内部的行覆盖波动当成顶边，只删掉下半截。
  let start = -1;
  for (let yy = Math.max(1, end - maxRows + 1); yy <= end; yy++) {
    if (counts[yy]! < need || counts[yy]! - counts[yy - 1]! < jump) continue;
    let ok = true;
    for (let k = yy; k <= end; k++) if (counts[k]! < need) { ok = false; break; }
    if (ok) { start = yy; break; }
  }
  if (start < 0) return img;
  const out: RasterImage = { width: w, height: h, data: Buffer.from(data) };
  let removed = 0;
  for (let yy = start; yy <= bot; yy++)
    for (let xx = 0; xx < w; xx++) {
      const s = (yy * w + xx) * 4;
      if (out.data[s + 3]! < floor) continue;
      // 正上方有墨 ⇒ 这是脚 / 身体的一部分，留下。
      const above = yy > 0 && out.data[((yy - 1) * w + xx) * 4 + 3]! >= floor;
      if (above) continue;
      out.data[s] = 0; out.data[s + 1] = 0; out.data[s + 2] = 0; out.data[s + 3] = 0;
      removed++;
    }
  return removed === 0 ? img : out;
}
