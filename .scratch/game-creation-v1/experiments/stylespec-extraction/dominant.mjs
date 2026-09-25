// 用**仓库自己的解码器**（packages/assets 的 decodePNG）算出参考图的真实占比色。
// 用途：给「模型报的 palette 是不是真的」一个第一手的判据 —— 而不是拿模型的输出自证。
import fs from "node:fs";
import { decodePNG } from "../../../../packages/assets/dist/png.js";

const img = decodePNG(fs.readFileSync(process.argv[2]));
const count = new Map();
for (let i = 0; i < img.width * img.height; i++) {
  const s = i * 4;
  const a = img.data[s + 3];
  if (a < 128) continue;                       // 只算不透明像素
  const hex = "#" + [img.data[s], img.data[s + 1], img.data[s + 2]]
    .map(v => v.toString(16).padStart(2, "0")).join("");
  count.set(hex, (count.get(hex) ?? 0) + 1);
}
const total = [...count.values()].reduce((a, b) => a + b, 0);
const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log(`${img.width}×${img.height}  不透明像素 ${total}  不同颜色 ${count.size}`);
console.log("占比最高的 15 色：");
for (const [hex, n] of top) console.log(`  ${hex}  ${(100 * n / total).toFixed(2)}%`);
