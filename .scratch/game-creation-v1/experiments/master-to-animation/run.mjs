// A 方案实验：母版定稿 → 拿母版当**内联参考图**逐动画生成。
//
// 要回答的问题是票 23 那个至今无答案的：**生图路线的帧一致性到底能不能拿到**。
// 这里不改契约、不进管线，只跑数据 —— 因为要回答的是「行不行」，不是「怎么接」。
//
// 判据（不是"看着像"）：等分切片之后，**同一个特征在各帧里被画成多大**。
// 逐帧各画各的 ⇒ 尺寸会抖；共用一把尺子 ⇒ 不抖。这与 import.test.ts 那条是同一条判据。
import fs from "node:fs";
import path from "node:path";
const ROOT = "/Volumes/shy/some-projects/game-maker/";
const { resolveImageTransport, createGeminiGenerator, decodePNG, encodePNG, emptyImage, inkBBox, cropToBox, keyBackground } =
  await import(ROOT + "packages/assets/dist/index.js");
const { transport } = resolveImageTransport({ env: process.env, cwd: ROOT });
if (!transport) throw new Error("没配生图上游");
const { createProxyFetch } = await import(ROOT + "packages/assets/dist/index.js");
const gen = createGeminiGenerator({
  baseUrl: transport.baseUrl, apiKey: transport.apiKey, model: transport.model,
  ...(transport.proxy ? { fetchImpl: createProxyFetch({ proxy: transport.proxy }) } : {}),
});

const OUT = ROOT + ".scratch/game-creation-v1/experiments/master-to-animation/out";
fs.mkdirSync(OUT, { recursive: true });

const WORLD = `Muted desaturated dystopian industrial palette, cold teal-gray dominant.
2D retro pixel art, flat solid color blocks, hard pixel-stepped edges.
No anti-aliasing, no gradients, no 3D, no photograph. Straight-on view, no perspective.`;

const NEG = "scene, landscape, room, interior, background scenery, border, frame, panel, poster, " +
  "watermark, logo, UI, multiple characters, group, gradient, soft edges, blur, anti-aliasing, " +
  "photograph, photorealistic, 3D render, depth of field, drop shadow, reflection, perspective, isometric";

const CHARACTER = `a middle-aged shopkeeper in a dystopian retro-industrial world.
Thick worn grey-green work jacket, dark trousers, scuffed boots, a green knit beanie cap,
a short grey beard, and a small emissive CRT panel on the chest glowing warm amber.`;

// ── 1. 母版 ────────────────────────────────────────────────────────────────
console.log("① 出母版…");
const masterPrompt = `${WORLD}

Draw ONE single game character sprite, full body, centered, front-facing, standing.
${CHARACTER}
About 4 heads tall, compact. The cap, beard, jacket, trousers and boots must each be a
VISIBLY DIFFERENT color from one another — the character must not read as a dark silhouette.
Background: a flat solid mid-grey #808080, edge to edge, nothing on it.`;
const master = await gen({ prompt: masterPrompt, size: { w: 32, h: 48 }, negativePrompt: NEG });
fs.writeFileSync(`${OUT}/master.png`, encodePNG(master.image));
console.log(`   母版 ${master.image.width}×${master.image.height} · ${master.call.ms}ms`);

// ── 2. 逐动画出单行 sheet（母版当内联参考）────────────────────────────────
const ANIMS = [["idle", 4, "a quiet breathing cycle — shoulders rise 1px, settle, fall 1px, settle"],
               ["run", 6, "a running cycle, arms bent and swinging opposite to the legs"],
               ["jump", 4, "a jump arc: crouch, launch, airborne apex with legs tucked, landing"]];

const keyed = (img) => keyBackground(img, { tolerance: 40 }).image;
const sheets = [];
for (const [name, frames, desc] of ANIMS) {
  console.log(`② ${name}（${frames} 帧单行 sheet）…`);
  const p = `${WORLD}

Using the attached image as the EXACT character reference, draw a sprite sheet of the SAME character.

KEEP EXACTLY, frame to frame: the face, the beard, the beanie cap, the jacket shape and color,
the chest CRT panel, the trousers, the boots, the body proportions, the outline style,
the pixel scale, and the character's size within each cell.

Only the limb poses may change. Every cell must show the same character at the same scale,
same body height, feet on the same ground line.

Layout: ONE single horizontal row of ${frames} equal-width cells. No grid lines, no borders,
no numbers, no text, no separators between cells. Each cell has the same size.

Animation: ${desc}.

Background: flat solid mid-grey #808080 across the whole sheet, nothing on it.`;
  const r = await gen({ prompt: p, size: { w: 32 * frames, h: 48 }, negativePrompt: NEG, reference: master.image });
  fs.writeFileSync(`${OUT}/${name}-sheet.png`, encodePNG(r.image));
  console.log(`   ${r.image.width}×${r.image.height} · ${r.call.ms}ms`);
  sheets.push({ name, frames, image: r.image });
}

// ── 3. 等分切片 + 抠背景，量逐帧的「同一个特征被画成多宽」────────────────
console.log("\n③ 等分切片后的逐帧测量（判据：头部带里的墨宽，与 import.test.ts 同一条）");
const headWidth = (img) => {
  const b = inkBBox(img); if (!b) return null;
  let lo = Infinity, hi = -Infinity;
  for (let y = b.y; y < b.y + Math.max(1, Math.round(b.h * 0.3)); y++)
    for (let x = 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3] !== 0) { if (x < lo) lo = x; if (x > hi) hi = x; }
  return hi - lo + 1;
};
const report = {};
for (const { name, frames, image } of sheets) {
  const k = keyed(image);
  const cw = Math.floor(k.width / frames);
  const cells = Array.from({ length: frames }, (_, i) => cropToBox(k, { x: i * cw, y: 0, w: cw, h: k.height }));
  const ws = cells.map(headWidth);
  const boxes = cells.map((c) => inkBBox(c)).filter(Boolean);
  const spread = Math.max(...ws) - Math.min(...ws);
  report[name] = { headWidths: ws, spread, cellW: cw };
  console.log(`   ${name.padEnd(5)} 逐帧头部宽 ${ws.join(" ")}  极差 ${spread}  (格宽 ${cw})`);
  const sheet = emptyImage(cw * frames, k.height);
  cells.forEach((c, i) => { for (let y = 0; y < c.height; y++) c.data.copy(sheet.data, (y * sheet.width + i * cw) * 4, y * cw * 4, (y * cw + cw) * 4); });
  fs.writeFileSync(`${OUT}/${name}-sliced.png`, encodePNG(sheet));
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2) + "\n");
console.log("\n结论看 report.json 的 spread：逐帧各画各的 ⇒ 明显 >0；共用一把尺子 ⇒ 0");
