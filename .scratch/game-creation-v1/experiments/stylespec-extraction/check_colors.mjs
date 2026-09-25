// 给定一组 hex，回答：它**真的**出现在参考图里吗？出现多少次？
// 这是本票第 4 条「palette 幻觉」的第一手判据 —— 票 01 记过一次（四象限图），
// 但那次是抽象色块图，本票要的是真实参考图上的结论。
import fs from "node:fs";
import { decodePNG } from "../../../../packages/assets/dist/png.js";

const img = decodePNG(fs.readFileSync(process.argv[2]));
const present = new Map();
for (let i = 0; i < img.width * img.height; i++) {
  const s = i * 4;
  if (img.data[s + 3] < 128) continue;
  const hex = "#" + [img.data[s], img.data[s + 1], img.data[s + 2]]
    .map(v => v.toString(16).padStart(2, "0")).join("");
  present.set(hex, (present.get(hex) ?? 0) + 1);
}
const total = [...present.values()].reduce((a, b) => a + b, 0);

for (const raw of process.argv.slice(3)) {
  const hex = raw.toLowerCase();
  const n = present.get(hex) ?? 0;
  const tag = n === 0 ? "❌ 不存在" : n / total < 0.00001 ? "⚠️ 极少" : "✅";
  console.log(`  ${hex}  ${String(n).padStart(7)} px  ${(100 * n / total).toFixed(4)}%  ${tag}`);
}
