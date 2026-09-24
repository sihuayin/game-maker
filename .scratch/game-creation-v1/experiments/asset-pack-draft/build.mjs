// 票 24 的「把草案填一遍」：用现有实验里的真实产物，按草案结构**真的产出一个资源包**。
//
// 这不是生产实现。生产实现要等票 24 的契约落地 + 票 29 的 monorepo 骨架。
// 这个脚本存在的唯一理由：证明契约装得下真实产物，而不是纸上推演。
//
//   node build.mjs [--out out]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { encodePNG, decodePNG } from './lib/png.mjs';
import { rasterize, RasterError } from './lib/raster.mjs';
import { buildAtlas } from './lib/atlas.mjs';
import { quantizeToPalette, paletteExactness } from './lib/quantize.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'out');
const GENERATOR = { name: 'game-maker', version: '0.0.0-draft', run: 'asset-pack-draft' };

const sha256 = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const jstr = (o) => JSON.stringify(o, null, 2) + '\n';

const recipe = readJSON(path.join(HERE, 'recipe.json'));
const styleSpec = readJSON(path.resolve(HERE, recipe.styleRef));
const PALETTE = styleSpec.palette.map((h) => h.toLowerCase());
const notes = [];

// ── 1. 逐帧产出位图（创作态 → 交付态的唯一步骤）────────────────────────────
const byAsset = [];
for (const a of recipe.assets) {
  const frames = [];
  const paletteBinding = a.paletteBinding || 'exact';
  for (const fr of a.frames || [{}]) {
    const name = fr.name || (fr.state ? `${a.id}.${fr.state}` : a.id);
    let img, src;
    if (fr.from.kind === 'drawlist') {
      const dlPath = path.resolve(HERE, fr.from.ref);
      const dl = readJSON(dlPath);
      if (dl.id !== a.id && !a.frames.some((x) => x.name)) notes.push(`${name}: drawlist id "${dl.id}" ≠ asset id "${a.id}"`);
      if (dl.viewBox[2] !== a.size?.w || dl.viewBox[3] !== a.size?.h)
        notes.push(`${name}: viewBox ${dl.viewBox[2]}×${dl.viewBox[3]} 与 recipe size ${a.size?.w}×${a.size?.h} 不一致`);
      try { img = rasterize(dl, { palette: PALETTE }); }
      catch (e) { if (e instanceof RasterError) throw new Error(`光栅化失败 —— ${e.message}`); throw e; }
      // 凸包容差：只判「过大」。票 12 出局时搬过来的规则，落地处归票 27。
      const bb = inkBBox(img);
      const exp = dl.expectedSize;
      if (bb.w > exp[0] + 1e-9 || bb.h > exp[1] + 1e-9)
        notes.push(`${name}: ink bbox ${bb.w}×${bb.h} 超出 expectedSize ${exp[0]}×${exp[1]}`);
      src = { kind: 'drawlist', ref: dlPath };
    } else {
      img = decodePNG(fs.readFileSync(path.resolve(HERE, fr.from.ref)));
      if (paletteBinding === 'quantized') {
        const q = quantizeToPalette(img, PALETTE);
        notes.push(`${name}: 量化到 ${PALETTE.length} 色 —— 非透明像素 ${q.opaquePixels}，其中 ${(100 * q.changedPixels / q.opaquePixels).toFixed(2)}% 被改色`);
        img = q;
      }
      src = { kind: 'bitmap', ref: path.resolve(HERE, fr.from.ref) };
    }
    frames.push({ name, state: fr.state, img, src });
  }
  byAsset.push({ spec: a, frames, paletteBinding });
}

function inkBBox({ width, height, data }) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
    if (data[(y * width + x) * 4 + 3] !== 0) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return x1 < x0 ? { w: 0, h: 0 } : { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ── 2. 按 kind 分组打包图集 ────────────────────────────────────────────────
const packsDir = path.join(OUT, recipe.id, 'v1');
fs.rmSync(path.join(OUT, recipe.id), { recursive: true, force: true });
fs.mkdirSync(path.join(packsDir, 'delivery'), { recursive: true });
fs.mkdirSync(path.join(packsDir, 'authoring', 'drawlist'), { recursive: true });
fs.mkdirSync(path.join(packsDir, 'authoring', 'imported'), { recursive: true });

// 图集文件名 = kind 的复数（ui 的复数还是 ui）。名字写死，不用库 —— 这属于「手写固定」清单。
const ATLAS_NAME = { sprite: 'sprites', animation: 'animations', background: 'backgrounds', ui: 'ui' };
const kinds = [...new Set(byAsset.map((a) => a.spec.kind))].sort();
const atlases = [];
for (const kind of kinds) {
  const group = byAsset.filter((a) => a.spec.kind === kind);
  const frames = group.flatMap((a) => a.frames.map((f) => ({
    name: f.name, width: f.img.width, height: f.img.height, data: f.img.data,
    anchor: a.spec.anchor, scale9Borders: a.spec.scale9Borders,
  })));
  const { json, image } = buildAtlas(frames);
  const base = `atlas.${ATLAS_NAME[kind]}`;
  json.meta.image = `${base}.png`;
  fs.writeFileSync(path.join(packsDir, 'delivery', `${base}.json`), jstr(json));
  fs.writeFileSync(path.join(packsDir, 'delivery', `${base}.png`), encodePNG(image));
  atlases.push({ id: ATLAS_NAME[kind], kind, meta: `delivery/${base}.json`, image: `delivery/${base}.png`,
    size: { w: image.width, h: image.height }, frames: frames.length,
    assets: group.map((a) => a.spec.id).sort(), checksum: sha256(fs.readFileSync(path.join(packsDir, 'delivery', `${base}.png`))) });
  for (const a of group) a.atlasId = ATLAS_NAME[kind];
}

// ── 3. 创作态入包 ──────────────────────────────────────────────────────────
fs.writeFileSync(path.join(packsDir, 'authoring', 'stylespec.json'), jstr(styleSpec));
const authoringRefs = new Map();
for (const a of byAsset) {
  const refs = [];
  for (const f of a.frames) {
    if (f.src.kind === 'drawlist') {
      const dest = path.join('authoring', 'drawlist', `${f.name}.json`);
      fs.writeFileSync(path.join(packsDir, dest), jstr(readJSON(f.src.ref)));
      refs.push({ kind: 'drawlist', ref: dest });
    } else {
      const dest = path.join('authoring', 'imported', `${a.spec.id}${path.extname(f.src.ref)}`);
      fs.copyFileSync(f.src.ref, path.join(packsDir, dest));
      refs.push({ kind: 'bitmap', ref: dest, original: path.relative(path.resolve(HERE, '../../../..'), f.src.ref) });
    }
  }
  authoringRefs.set(a.spec.id, refs);
}

// ── 4. manifest ───────────────────────────────────────────────────────────
const exactness = new Map();
for (const a of byAsset) {
  if (a.paletteBinding !== 'exact') continue;
  for (const f of a.frames) {
    const e = paletteExactness(f.img, PALETTE);
    if (!e.exact) notes.push(`${f.name}: paletteBinding=exact 但实测有 ${e.offPalette.length} 种色板外颜色 ${JSON.stringify(e.offPalette)}`);
  }
  exactness.set(a.spec.id, true);
}

const mode = byAsset.every((a) => a.spec.origin === 'fixture') ? 'fixture'
  : byAsset.every((a) => (a.spec.origin || (a.frames[0].src.kind === 'bitmap' ? 'imported' : 'generated')) === 'generated') ? 'generated' : 'mixed';

const manifest = {
  format: 'assetpack/v1',
  id: recipe.id,
  version: 1,
  createdAt: new Date(Number(process.env.SOURCE_DATE_EPOCH || 1790208000) * 1000).toISOString(),
  generator: { ...GENERATOR, deterministic: process.env.SOURCE_DATE_EPOCH ? 'SOURCE_DATE_EPOCH' : 'fixed-default' },
  provenance: {
    mode,
    style: { origin: 'human-in-session', ref: 'authoring/stylespec.json', stylespecId: styleSpec.id, checksum: sha256(fs.readFileSync(path.join(packsDir, 'authoring', 'stylespec.json'))) },
    degradations: [
      { stage: 'backgrounds', assetId: 'shop_interior', reason: '管线不调用生图 API（R10），场景尺度背景只能走人工导入通道', fellBackTo: 'imported' },
    ],
  },
  palette: {
    ref: 'authoring/stylespec.json#/palette', size: PALETTE.length, values: PALETTE,
    coverage: {
      exact: byAsset.filter((a) => a.paletteBinding === 'exact').length,
      quantized: byAsset.filter((a) => a.paletteBinding === 'quantized').length,
      unbound: byAsset.filter((a) => a.paletteBinding === 'unbound').length,
    },
  },
  atlases,
  assets: byAsset.map((a) => {
    const o = {
      id: a.spec.id, kind: a.spec.kind, role: a.spec.role,
      origin: a.spec.origin || (a.frames[0].src.kind === 'bitmap' ? 'imported' : 'generated'),
      paletteBinding: a.paletteBinding,
      required: a.spec.required !== false,
      size: a.frames[0].img.width && a.spec.size ? { w: a.frames[0].img.width, h: a.frames[0].img.height } : null,
      anchor: a.spec.anchor,
      atlasId: a.atlasId,
      frames: a.frames.map((f) => (f.state ? { name: f.name, state: f.state } : { name: f.name })),
      authoring: authoringRefs.get(a.spec.id),
    };
    if (a.spec.scale9Borders) o.scale9Borders = a.spec.scale9Borders;
    if (a.spec.animations) o.animations = a.spec.animations;
    return o;
  }),
};
fs.writeFileSync(path.join(packsDir, 'manifest.json'), jstr(manifest));

// ── 5. files[] —— 逐文件 checksum（manifest.json 自身除外）─────────────────
const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]);
manifest.files = walk(packsDir).filter((p) => p !== 'manifest.json').sort().map((p) => {
  const b = fs.readFileSync(path.join(packsDir, p));
  return { path: p, bytes: b.length, checksum: sha256(b) };
});
fs.writeFileSync(path.join(packsDir, 'manifest.json'), jstr(manifest));

// ── 6. 报告 ───────────────────────────────────────────────────────────────
console.log(`pack → ${path.relative(process.cwd(), packsDir)}`);
console.log(`  ${manifest.files.length} files, ${(manifest.files.reduce((s, f) => s + f.bytes, 0) / 1024).toFixed(1)} KiB`);
for (const at of atlases) console.log(`  atlas ${at.id.padEnd(12)} ${String(at.size.w).padStart(4)}×${String(at.size.h).padEnd(4)} ${String(at.frames).padStart(2)} frames  [${at.assets.join(', ')}]`);
for (const a of manifest.assets) console.log(`  ${a.id.padEnd(14)} ${a.kind.padEnd(11)} ${a.origin.padEnd(9)} ${a.paletteBinding.padEnd(10)} ${a.frames.length} frame(s)${a.animations ? `, ${a.animations.length} anim(s)` : ''}`);
if (notes.length) { console.log('\nnotes:'); for (const n of notes) console.log('  · ' + n); }
