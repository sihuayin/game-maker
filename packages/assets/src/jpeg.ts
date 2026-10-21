// JPEG 解码 —— Interactions API 的图片输出只有 JPEG（2026-10-20 · 票 05 / 07）。
//
// ⚠️ 为什么用第三方库：PNG 是手写的、零依赖；JPEG 的熵编码 / 色度子采样 / 重启标记
//   自己写不值得。`jpeg-js` 是纯 JS、零依赖、BSD-3；0.4.4 修掉了 CVE-2022-25851。
//
// ⚠️ 它只负责**字节 → RGBA**。格式分派（信不信 mime、要不要嗅探）在 `image-gen.ts`：
//   上游声明了 PNG 却给了 JPEG，绝不能在这里悄悄「猜对了」。
import { decode as decodeJPEGBytes } from "jpeg-js";
import type { RasterImage } from "./image.js";

/** JPEG 以 `FF D8 FF` 开头（第三个字节是下一个标记的开始）。 */
export const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

export function isJPEG(buf: Buffer): boolean {
  return buf.length >= JPEG_SIGNATURE.length && buf.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE);
}

/**
 * JPEG → RGBA8。
 *
 * - JPEG 没有 alpha ⇒ 恒 255。
 * - 宽高与数据长度都校验：缺字节的图不能带着错误的 stride 进后面的降采样。
 * - `maxResolutionInMP` / `maxMemoryUsageInMB` 是异常大图的刹车；上游正常是 1K 级。
 */
export function decodeJPEG(buf: Buffer): RasterImage {
  if (!isJPEG(buf)) throw new Error("不是 JPEG（签名不匹配）");
  const raw = decodeJPEGBytes(buf, {
    formatAsRGBA: true,
    maxResolutionInMP: 100,
    maxMemoryUsageInMB: 512,
  });
  const { width, height } = raw;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    throw new Error(`JPEG 尺寸不合法：${width}×${height}`);
  const expected = width * height * 4;
  if (raw.data.length !== expected)
    throw new Error(`JPEG 解码后的字节数不对：${raw.data.length}，期望 ${expected}（${width}×${height} RGBA）`);
  return { width, height, data: Buffer.from(raw.data) };
}
