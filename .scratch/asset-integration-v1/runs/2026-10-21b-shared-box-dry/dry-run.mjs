// 票 11 的零付费 dry-run：只读现有 raw，比较「逐帧紧裁 / 并集共享框 / 平均共享框」。
// 不发任何 HTTP；不改源码；产物只写本 run 目录。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const {
  decodePNG, encodePNG, dominantOpaqueColor, keyBackground, inkBBox, unionInkBBox,
  dropDetachedSpecks, dropBottomGroundLines, importFrames, emptyImage, resizeNearest,
} = A;

const SMOKE = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-21a-smoke/evidence");
const V7 = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/authoring/generated");
const RUN = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20f-lurker");
const palette = JSON.parse(fs.readFileSync(path.join(RUN, "stylespec.json"), "utf8")).palette;
const FLOOR = 128;
const TARGET = { w: 48, h: 64 };
const OUT = path.join(HERE, "evidence");

const SETS = [
  { name: "2.1", frames: [
    { name: "idle1", file: path.join(SMOKE, "scavenger-actor.idle1.decoded.png") },
    { name: "idle2", file: path.join(SMOKE, "scavenger-actor.idle2.decoded.png") },
  ]},
  { name: "2.5", frames: [
    { name: "idle1", file: path.join(V7, "scavenger-actor.idle1.png") },
    { name: "idle2", file: path.join(V7, "scavenger-actor.idle2.png") },
  ]},
];

const hstack = (imgs, gap = 8) => {
  const h = Math.max(...imgs.map((i) => i.height));
  const out = emptyImage(imgs.reduce((s, i) => s + i.width + gap, 0) - gap, h);
  let x = 0;
  for (const img of imgs) {
    for (let y = 0; y < img.height; y++) img.data.copy(out.data, (y * out.width + x) * 4, y * img.width * 4, (y + 1) * img.width * 4);
    x += img.width + gap;
  }
  return out;
};
const vstack = (rows, gap = 8) => {
  const w = Math.max(...rows.map((r) => r.width));
  const out = emptyImage(w, rows.reduce((s, r) => s + r.height + gap, 0) - gap);
  let y = 0;
  for (const row of rows) {
    for (let yy = 0; yy < row.height; yy++) row.data.copy(out.data, (yy + y) * out.width * 4, yy * row.width * 4, (yy + 1) * row.width * 4);
    y += row.height + gap;
  }
  return out;
};
const upscale = (img, s = 8) => resizeNearest(img, img.width * s, img.height * s);
const diff = (x, y) => {
  let alpha = 0, rgb = 0, sum = 0;
  const n = x.width * x.height;
  for (let i = 0; i < n; i++) {
    const s = i * 4;
    if ((x.data[s + 3] >= 128) !== (y.data[s + 3] >= 128)) alpha++;
    if (x.data[s + 3] >= 128 && y.data[s + 3] >= 128) {
      const l = Math.abs(x.data[s] - y.data[s]) + Math.abs(x.data[s + 1] - y.data[s + 1]) + Math.abs(x.data[s + 2] - y.data[s + 2]);
      if (l > 0) rgb++;
      sum += l;
    }
  }
  return { alphaDiff: alpha, alphaPct: +(alpha / n * 100).toFixed(1), rgbChanged: rgb, rgbPct: +(rgb / n * 100).toFixed(1), meanL1: +(sum / n).toFixed(2) };
};
const avgBox = (boxes) => {
  const x = Math.round(boxes.reduce((s, b) => s + b.x, 0) / boxes.length);
  const y = Math.round(boxes.reduce((s, b) => s + b.y, 0) / boxes.length);
  const w = Math.round(boxes.reduce((s, b) => s + b.w, 0) / boxes.length);
  const h = Math.round(boxes.reduce((s, b) => s + b.h, 0) / boxes.length);
  return { x, y, w, h };
};

const result = { palette: palette.length, floor: FLOOR, target: TARGET, sets: [] };
for (const set of SETS) {
  const frames = set.frames.map((f) => {
    const img = decodePNG(fs.readFileSync(f.file));
    const key = dominantOpaqueColor(img).color;
    const keyed = keyBackground(img, { tolerance: 30, colors: [key] }).image;
    const cleaned = dropDetachedSpecks(dropBottomGroundLines(keyed, { floor: FLOOR }), { floor: FLOOR });
    return { ...f, img, key, cleaned, bbox: inkBBox(cleaned, { floor: FLOOR }) };
  });
  const boxes = frames.map((f) => f.bbox);
  const union = unionInkBBox(frames.map((f) => f.cleaned), { floor: FLOOR });
  const average = avgBox(boxes);
  const opts = (f) => ({
    palette, targetWidth: TARGET.w, targetHeight: TARGET.h,
    background: { tolerance: 30, colors: [f.key] }, dropSpecks: true, dropBottomLines: true,
  });
  const modes = {
    perFrame: frames.map((f) => importFrames([f.img], opts(f))[0]),
    union: frames.map((f) => importFrames([f.img], { ...opts(f), trimBox: union })[0]),
    average: frames.map((f) => importFrames([f.img], { ...opts(f), trimBox: average })[0]),
  };
  const metrics = {};
  for (const [mode, imgs] of Object.entries(modes)) metrics[mode] = diff(imgs[0], imgs[1]);
  for (const f of frames) {
    const name = `${set.name}-${f.name}`;
    fs.writeFileSync(path.join(OUT, `${name}-perFrame.png`), encodePNG(modes.perFrame[frames.indexOf(f)]));
    fs.writeFileSync(path.join(OUT, `${name}-union.png`), encodePNG(modes.union[frames.indexOf(f)]));
    fs.writeFileSync(path.join(OUT, `${name}-average.png`), encodePNG(modes.average[frames.indexOf(f)]));
  }
  const sheet = vstack([
    hstack([modes.perFrame[0], modes.union[0], modes.average[0]].map((i) => upscale(i))),
    hstack([modes.perFrame[1], modes.union[1], modes.average[1]].map((i) => upscale(i))),
  ]);
  fs.writeFileSync(path.join(OUT, `contact-${set.name}-modes.png`), encodePNG(sheet));
  result.sets.push({
    name: set.name,
    frames: frames.map((f) => ({ name: f.name, dims: { w: f.img.width, h: f.img.height }, key: f.key, bbox: f.bbox })),
    boxes: { union, average },
    metrics,
  });
  console.log(JSON.stringify(result.sets[result.sets.length - 1], null, 2));
}

fs.writeFileSync(path.join(HERE, "dry-run-result.json"), JSON.stringify(result, null, 2) + "\n");
console.log("wrote", path.join(HERE, "dry-run-result.json"));
