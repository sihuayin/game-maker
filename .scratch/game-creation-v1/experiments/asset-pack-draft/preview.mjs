// 把包里的交付态图集拼成一张放大联系表 PNG，供人眼看。纯验证工具，不入生产。
import fs from 'node:fs'; import path from 'node:path';
// 同上：实现已落进 packages/assets，这里不再留第二份。
const { encodePNG, decodePNG } = await import('../../../../packages/assets/dist/index.js');
const PACK = process.argv[2] || 'out/dystopian-shop/v1';
const atlases = JSON.parse(fs.readFileSync(path.join(PACK, 'manifest.json'), 'utf8')).atlases;
const SCALE = 6, PAD = 12, BG = [23, 28, 31, 255], FG = [168, 181, 174, 255];
const imgs = atlases.map((a) => ({ a, img: decodePNG(fs.readFileSync(path.join(PACK, a.image))) }))
  .map((o) => ({ ...o, s: Math.max(1, Math.min(SCALE, Math.floor(1400 / o.img.width))) }));
const W = Math.max(...imgs.map(({ img, s }) => img.width * s)) + PAD * 2;
const H = imgs.reduce((t, { img, s }) => t + img.height * s + PAD * 3 + 18, PAD) + 40;
const out = { width: W, height: H, data: Buffer.alloc(W * H * 4) };
for (let i = 0; i < W * H; i++) out.data.set(BG, i * 4);
let y = PAD + 30;
for (const { a, img, s: SC } of imgs) {
  for (let sy = 0; sy < img.height * SC; sy++) for (let sx = 0; sx < img.width * SC; sx++) {
    const s = (Math.floor(sy / SC) * img.width + Math.floor(sx / SC)) * 4;
    if (img.data[s + 3] === 0) continue;
    const d = ((y + sy) * W + PAD + sx) * 4;
    for (let k = 0; k < 4; k++) out.data[d + k] = img.data[s + k];
  }
  y += img.height * SC + PAD + 18;
}
fs.writeFileSync(path.join(PACK, 'preview.png'), encodePNG(out));
console.log('preview.png', `${W}×${H}`);
