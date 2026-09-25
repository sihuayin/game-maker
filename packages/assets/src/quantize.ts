// 最近邻色量化：把任意位图吸附到 StyleSpec.palette。
//
// ⚠️ **一份实现，两条通道共用**（票 21 抬头的硬要求）：
//   光栅化产出的图**理论上**已经在色板里（`paletteBinding: "exact"` / `"composited"`），
//   而人工导入的图**本来就不在**（票 35 / 票 24 §7）。两者对「不在色板里怎么办」的答案是同一个。
//
// 量化**不是免费的**：票 24 实测把一张 1218×685 的场景图量化到 9 色，
// **100% 的非透明像素被改色**。所以它必须回报改了多少 —— 调用方要能把这个数字告诉人。
import { paletteExactness, type RasterImage } from "./image.js";

export type QuantizeResult = RasterImage & {
  /** 非透明像素总数。 */
  opaquePixels: number;
  /** 其中被改色的像素数。0 表示原图本来就在色板里。 */
  changedPixels: number;
};

/** 距离用 RGB 平方欧氏距离（忽略 alpha）；同距时取索引小的 —— 确定。 */
export function quantizeToPalette(img: RasterImage, palette: readonly string[]): QuantizeResult {
  if (palette.length === 0) throw new Error("quantizeToPalette: 色板为空，没有可吸附的目标");
  const pal = palette.map((hex) => { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const; });
  const out = Buffer.alloc(img.data.length);
  let changed = 0, opaque = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * 4, a = img.data[s + 3]!;
    out[s] = img.data[s]!; out[s + 1] = img.data[s + 1]!; out[s + 2] = img.data[s + 2]!; out[s + 3] = a;
    if (a === 0) continue;              // 全透明像素的颜色无所谓，不动它
    opaque++;
    let best = 0, bestD = Infinity;
    for (let k = 0; k < pal.length; k++) {
      const d = (img.data[s]! - pal[k]![0]!) ** 2 + (img.data[s + 1]! - pal[k]![1]!) ** 2 + (img.data[s + 2]! - pal[k]![2]!) ** 2;
      if (d < bestD) { bestD = d; best = k; }
    }
    if (bestD !== 0) changed++;
    out[s] = pal[best]![0]!; out[s + 1] = pal[best]![1]!; out[s + 2] = pal[best]![2]!;
  }
  return { width: img.width, height: img.height, data: out, opaquePixels: opaque, changedPixels: changed };
}

export { paletteExactness };
