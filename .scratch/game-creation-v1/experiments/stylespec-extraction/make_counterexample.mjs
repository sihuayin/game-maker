// 票 15 第 7 条（反例验证）用的一次性反例图 —— **可复跑**，不依赖任何 Python 包。
//
// 它只为一件事存在：证明「参考图 → StyleSpec」的 prompt **没有被写死成某一种风格**。
// ⚠️ **持久的那张反例图归票 04** —— 这里造的是用完即弃的证据材料，不是产品资产。
//
// 用仓库自己的 PNG 编码器（packages/assets），与管线同一个实现 —— 不引第三方依赖。
import fs from "node:fs";
import { encodePNG } from "../../../../packages/assets/dist/png.js";
import { emptyImage } from "../../../../packages/assets/dist/image.js";

const W = 640, H = 360;
const img = emptyImage(W, H);
const put = (x, y, [r, g, b]) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const s = (y * W + x) * 4;
  img.data[s] = r; img.data[s + 1] = g; img.data[s + 2] = b; img.data[s + 3] = 255;
};
const rect = (x0, y0, x1, y1, c, fill = true) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (fill || x === x0 || x === x1 || y === y0 || y === y1) put(x, y, c);
};
// 造一张**与参考图处处相反**的图：极高对比、纯饱和荧光、硬边、竖线主导。
const BG = [18, 13, 46];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, BG);

let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const NEON = [[255, 0, 229], [0, 255, 229], [168, 0, 255], [255, 214, 0]];
for (let i = 0; i < 70; i++) {                       // 竖排荧光灯管
  const x = Math.floor(rnd() * W), w = [3, 5, 8][Math.floor(rnd() * 3)];
  rect(x, 0, x + w, H - 1, NEON[Math.floor(rnd() * NEON.length)]);
}
for (let i = 0; i < 26; i++) {                       // 硬边几何框
  const x = Math.floor(rnd() * W), y = Math.floor(rnd() * (H - 80)), s = 20 + Math.floor(rnd() * 50);
  rect(x, y, x + s, y + s, [255, 255, 255], false);
}
for (let y = H - 1; y >= H - 120; y--) {             // 尖角地平线
  const half = Math.round(((H - y) / 120) * (W / 2));
  for (let x = 0; x < half; x++) { put(x, y, [26, 0, 51]); put(W - 1 - x, y, [26, 0, 51]); }
}
fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/counterexample-neon.png", encodePNG(img));
console.log("✓ out/counterexample-neon.png", `${W}×${H}`);
