// 最小 PNG 编解码。**一份实现，两条通道共用** —— 光栅化产出的图要编码出去，
// 人工导入的图要解码进来（票 23）。
//
// 只用 `node:zlib`，无第三方依赖；`deflateSync` 的 level 写死（9），所以同一份输入
// 两次编码逐字节相同 —— 这是 checksum 成立的前提（票 24 / 票 18）。
import zlib from "node:zlib";
import type { RasterImage } from "./image.js";

const CRC_T = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_T[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer): Buffer => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, c]);
};

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** RGBA8 → PNG。输出**确定**：同样的输入永远得到同样的字节。 */
export function encodePNG(img: RasterImage): Buffer {
  const { width, height, data } = img;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None) —— 不用自适应滤波，省得输出随内容变
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/** PNG → RGBA8。支持 8-bit、非隔行、colorType 0/2/4/6。 */
export function decodePNG(buf: Buffer): RasterImage {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("不是 PNG（签名不匹配）");
  let off = 8, ihdr: { width: number; height: number; depth: number; color: number; interlace: number } | null = null;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString("ascii", off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") ihdr = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8]!, color: body[9]!, interlace: body[12]! };
    else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error("PNG 缺少 IHDR");
  if (ihdr.depth !== 8) throw new Error(`只支持 8-bit，收到 ${ihdr.depth}-bit`);
  if (ihdr.interlace !== 0) throw new Error("不支持隔行 PNG");
  const ch = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[ihdr.color];
  if (!ch) throw new Error(`不支持的 colorType ${ihdr.color}（调色板型 PNG 请先转真彩）`);

  const { width: W, height: H } = ihdr, stride = W * ch;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    const ft = raw[y * (stride + 1)]!, line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const out = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? out[i - ch]! : 0, b = prev ? prev[i]! : 0, c = prev && i >= ch ? prev[i - ch]! : 0, x = line[i]!;
      out[i] = ft === 0 ? x : ft === 1 ? (x + a) & 255 : ft === 2 ? (x + b) & 255 : ft === 3 ? (x + ((a + b) >> 1)) & 255
        : (() => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return (x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; })();
    }
  }
  // ⚠️ 必须按 **colorType** 分支，不能按通道数：colorType 4（灰度+alpha）与 6（RGBA）
  // 的通道数都是 4，按通道数分支会把 RGBA 当成灰度读，静默产出灰度图。
  const data = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const s = i * ch, d = i * 4;
    switch (ihdr.color) {
      case 0: data[d] = data[d + 1] = data[d + 2] = px[s]!; data[d + 3] = 255; break;
      case 2: data[d] = px[s]!; data[d + 1] = px[s + 1]!; data[d + 2] = px[s + 2]!; data[d + 3] = 255; break;
      case 4: data[d] = data[d + 1] = data[d + 2] = px[s]!; data[d + 3] = px[s + 1]!; break;
      case 6: data[d] = px[s]!; data[d + 1] = px[s + 1]!; data[d + 2] = px[s + 2]!; data[d + 3] = px[s + 3]!; break;
    }
  }
  return { width: W, height: H, data };
}
