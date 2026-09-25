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
export function inkBBox(img: RasterImage): { x: number; y: number; w: number; h: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3] !== 0) {
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
