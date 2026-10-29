// P0-02 A（屋顶信使）的程序化参考图 —— **零付费、确定性、可复现**。
// 复用 reference-image-draft/draw.mjs 的 canvas 原语；底层是仓库自己的 RasterImage + encodePNG。
// 不改生产代码、现有 generate.mjs、fixtures 或历史实验。
import fs from "node:fs";
import crypto from "node:crypto";
import { canvas } from "../../game-creation-v1/experiments/reference-image-draft/draw.mjs";

const W = 480, H = 270;

/** 18 个命名槽位 / 16 个唯一色：黄昏屋顶城市的天空 / 远景 / 中景 / 屋顶 / 暖光 / 材质。 */
const PALETTE = {
  skyTop: [0x1b, 0x24, 0x3a],
  skyMid: [0x2e, 0x4a, 0x66],
  skyLow: [0x4a, 0x60, 0x76],
  dusk: [0xc9, 0x8b, 0x5e],
  duskL: [0xf2, 0xd9, 0x8b],
  far: [0x2a, 0x34, 0x42],
  far2: [0x3b, 0x4a, 0x5c],
  mid: [0x4a, 0x5a, 0x6e],
  mid2: [0x5f, 0x70, 0x84],
  roof: [0x1b, 0x20, 0x27],
  roof2: [0x2f, 0x35, 0x3f],
  stone: [0x56, 0x5b, 0x60],
  stoneL: [0x7a, 0x7f, 0x84],
  brass: [0xd9, 0xa4, 0x41],
  win: [0xf2, 0xd9, 0x8b],
  winDim: [0xc9, 0x8b, 0x5e],
  green: [0x3f, 0x5c, 0x3a],
  cream: [0xe6, 0xe2, 0xd6],
};
const P = PALETTE;
const hex = (c) => "#" + c.map((n) => n.toString(16).padStart(2, "0")).join("");

function draw() {
  const c = canvas(W, H, P.skyTop);

  // ── 天空：4 条硬边色带 + 一条 dither 过渡（全部色板内） ──────────────
  c.rect(0, 0, W - 1, 69, P.skyTop);
  c.rect(0, 70, W - 1, 119, P.skyMid);
  c.dither(0, 118, W - 1, 123, P.skyMid, P.skyLow, 2);
  c.rect(0, 124, W - 1, 149, P.dusk);
  c.rect(0, 150, W - 1, 169, P.duskL);

  // 落日 + 光晕（被远景建筑切掉一部分）
  c.ell(372, 150, 30, 30, P.brass);
  c.ell(372, 150, 23, 23, P.duskL);

  // ── 远景城市：高低塔楼 + 天线 ──────────────────────────────────────
  const farTowers = [
    [0, 138, 34], [36, 120, 30], [70, 146, 26], [100, 104, 34], [138, 132, 28],
    [170, 116, 32], [206, 142, 24], [234, 110, 30], [268, 136, 34], [306, 122, 26],
    [336, 148, 30], [370, 112, 34], [408, 134, 28], [440, 118, 40],
  ];
  for (const [x, top, w] of farTowers) {
    c.rect(x, top, x + w, 170, P.far);
    c.rect(x + 2, top + 3, x + 5, top + 6, P.winDim); // 几粒远窗
  }
  c.line(52, 120, 52, 98, P.far);
  c.line(118, 104, 118, 88, P.far);
  c.line(250, 110, 250, 92, P.far);
  c.line(388, 112, 388, 94, P.far);

  // ── 中景建筑：更亮、带窗格 ─────────────────────────────────────────
  const midBlocks = [
    [8, 150, 82, 210], [96, 140, 168, 210], [184, 156, 258, 210],
    [276, 146, 360, 210], [378, 136, 472, 210],
  ];
  for (const [x0, y0, x1, y1] of midBlocks) {
    c.rect(x0, y0, x1, y1, P.mid);
    c.rect(x0, y0, x1, y0 + 3, P.mid2);
  }
  for (let x = 16; x <= 66; x += 10) for (let y = 158; y <= 196; y += 12) c.rect(x, y, x + 3, y + 5, (x + y) % 3 === 0 ? P.win : P.winDim);
  for (let x = 106; x <= 156; x += 10) for (let y = 150; y <= 196; y += 12) c.rect(x, y, x + 3, y + 5, (x + y) % 4 === 0 ? P.winDim : P.win);
  for (let x = 194; x <= 246; x += 10) for (let y = 166; y <= 198; y += 12) c.rect(x, y, x + 3, y + 5, P.winDim);
  for (let x = 286; x <= 350; x += 10) for (let y = 154; y <= 196; y += 12) c.rect(x, y, x + 3, y + 5, (x + y) % 4 === 0 ? P.win : P.winDim);
  for (let x = 388; x <= 462; x += 10) for (let y = 144; y <= 196; y += 12) c.rect(x, y, x + 3, y + 5, P.win);

  // ── 钟楼（A 的 goal 视觉锚点） ─────────────────────────────────────
  c.rect(398, 108, 462, 210, P.stone);
  c.rect(398, 108, 462, 112, P.stoneL);
  c.poly([[392, 108], [468, 108], [452, 86], [408, 86]], P.roof2);
  c.line(430, 86, 430, 66, P.stoneL);
  c.ell(430, 132, 12, 12, P.cream);
  c.ell(430, 132, 10, 10, P.stoneL);
  c.line(430, 132, 430, 124, P.roof);
  c.line(430, 132, 436, 136, P.roof);
  c.rect(418, 166, 426, 180, P.roof2);
  c.rect(434, 166, 442, 180, P.roof2);
  c.rect(418, 166, 426, 168, P.win);
  c.rect(434, 166, 442, 168, P.win);

  // ── 前景屋顶 ──────────────────────────────────────────────────────
  c.rect(0, 210, W - 1, H - 1, P.roof);
  c.rect(0, 210, W - 1, 214, P.stone);
  c.rect(0, 214, W - 1, 217, P.roof2);
  c.line(0, 230, 70, 230, P.stoneL);
  for (let x = 8; x <= 60; x += 14) c.line(x, 230, x, 224, P.stoneL);

  // 水塔
  c.rect(96, 166, 152, 196, P.stone);
  c.rect(96, 166, 152, 170, P.stoneL);
  c.poly([[92, 166], [156, 166], [150, 156], [98, 156]], P.roof2);
  c.rect(104, 196, 110, 222, P.roof2);
  c.rect(138, 196, 144, 222, P.roof2);
  c.line(104, 222, 138, 196, P.roof2);
  c.line(144, 222, 110, 196, P.roof2);
  for (let y = 174; y <= 190; y += 6) c.rect(96, y, 152, y + 1, P.roof2);

  // 天线
  c.rect(298, 150, 302, 222, P.roof2);
  c.rect(280, 172, 320, 175, P.stoneL);
  c.rect(286, 190, 314, 193, P.stoneL);
  c.line(300, 150, 300, 136, P.stoneL);
  c.ell(300, 134, 3, 3, P.dusk);

  // 管道与通风口
  c.rect(350, 218, 420, 222, P.roof2);
  c.rect(356, 222, 362, 238, P.roof2);
  c.rect(404, 222, 410, 238, P.roof2);
  c.rect(330, 204, 346, 210, P.green);
  c.rect(168, 204, 186, 210, P.green);

  // 信使（小剪影；不承担 UI/文字）
  c.ell(230, 180, 5, 5, P.cream);
  c.rect(225, 185, 235, 200, P.roof2);
  c.rect(225, 200, 229, 212, P.roof2);
  c.rect(231, 200, 235, 212, P.roof2);
  c.rect(235, 188, 243, 196, P.brass);
  c.line(226, 186, 220, 194, P.roof2);
  c.line(234, 186, 240, 194, P.roof2);

  // 一点鸟 / 细线
  c.line(60, 86, 66, 82, P.far2);
  c.line(66, 82, 72, 86, P.far2);
  c.line(78, 92, 84, 88, P.far2);
  c.line(84, 88, 90, 92, P.far2);

  return c;
}

const c = draw();
const png = c.png();

// 自检：尺寸、色板、每像素都在色板内
const allowed = new Set(Object.values(P).map((v) => v.join(",")));
const used = new Set();
for (let i = 0; i < c.img.data.length; i += 4) {
  const key = `${c.img.data[i]},${c.img.data[i + 1]},${c.img.data[i + 2]}`;
  if (c.img.data[i + 3] !== 255 || !allowed.has(key)) throw new Error(`像素不在色板/不透明：${key}`);
  used.add(key);
}

const OUT = new URL("../inputs/reference/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const file = new URL("rooftop-dusk.png", OUT);
fs.writeFileSync(file, png);
const sha = "sha256:" + crypto.createHash("sha256").update(png).digest("hex");

const paletteHex = [...new Set(Object.values(PALETTE).map(hex))];
const provenance = {
  format: "reference-image-provenance/v2",
  artifact: "rooftop-dusk.png",
  artifactSha256: sha,
  world: "黄昏城市屋顶（屋顶信使 A）",
  composition: "分层剖面：天空 / 远景城市 / 中景建筑 / 前景屋顶 + 水塔 + 天线 + 钟楼；一名信使剪影",
  how: {
    generator: ".scratch/p0-02-second-demo/tools/generate-reference.mjs",
    technique: "Node + 仓库自己的 canvas 原语 / RasterImage / encodePNG；零第三方依赖、零付费、无需浏览器",
    reproduce: "node .scratch/p0-02-second-demo/tools/generate-reference.mjs",
    size: { w: W, h: H },
  },
  palette: {
    size: paletteHex.length,
    namedEntries: Object.keys(PALETTE).length,
    values: paletteHex,
    usedInImage: used.size,
    property: "图上每个像素都是这 16 个唯一色之一（18 个命名槽位，其中 2 组同色）；没有插值、抗锯齿或重编码。",
  },
  verification: {
    width: c.w,
    height: c.h,
    allPixelsInPalette: true,
    alphaOpaque: true,
    sha256: sha,
  },
  limits: [
    "它是程序化插图，不是真实游戏截图；不代表最终画面密度。",
    "它只用于 A 的视觉世界参考；不代表参考图已通过视觉验收（票 17 由用户验收）。",
    "尺寸/色板/像素可复现；上游重编码仍可能让提取出的 palette 有偏差。",
  ],
};
fs.writeFileSync(new URL("rooftop-dusk.provenance.json", OUT), JSON.stringify(provenance, null, 2) + "\n");
console.log(`✓ ${file.pathname} ${W}×${H} ${(png.length / 1024).toFixed(1)} KiB · ${used.size}/${paletteHex.length} unique colors · ${sha}`);
