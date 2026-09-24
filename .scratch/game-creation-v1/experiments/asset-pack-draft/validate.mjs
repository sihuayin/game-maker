// 用 schema.mjs 校验刚生成的 manifest —— 契约不是「看起来对」，是可解析的。
import fs from 'node:fs'; import path from 'node:path';
import { AssetPackManifest } from './schema.mjs';
const p = path.join(process.argv[2] || 'out/dystopian-shop/v1', 'manifest.json');
const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
const r = AssetPackManifest.safeParse(raw);
if (r.success) { console.log(`✅ ${p} 通过 assetpack/v1 校验（${r.data.assets.length} assets / ${r.data.atlases.length} atlases / ${r.data.files.length} files）`); }
else { console.log('❌ 校验失败：'); for (const i of r.error.issues) console.log(`   ${i.path.join('.')}: ${i.message}`); process.exit(1); }

// 反例：契约必须拒绝的东西，逐个验一遍
const cases = [
  ['硬编码颜色混进 manifest', (m) => { m.palette.values[0] = '#FF00FF'; }],
  ['包版本号写成 0', (m) => { m.version = 0; }],
  ['asset 指向不存在的图集', (m) => { m.assets[0].atlasId = 'nope'; }],
  ['animation 引用不存在的帧', (m) => { m.assets[0].animations[0].frames = ['player.nope']; }],
  ['绝对路径混进包', (m) => { m.assets[0].authoring[0].ref = '/etc/passwd'; }],
  ['files[] 里漏掉一张图集', (m) => { m.files = m.files.filter((f) => f.path !== m.atlases[0].image); }],
  ['色板出现重复色', (m) => { m.palette.values[1] = m.palette.values[0]; }],
  ['unbound 却没记降级', (m) => { m.assets[0].paletteBinding = 'unbound'; }],
  ['fixture 包谎报自己是 generated', (m) => { m.provenance.mode = 'generated'; }],
];
let ok = 0;
for (const [why, mut] of cases) {
  const c = JSON.parse(JSON.stringify(raw)); mut(c);
  const rr = AssetPackManifest.safeParse(c);
  if (rr.success) console.log(`   ⚠️ 反例未被拒：${why}`);
  else { ok++; console.log(`   ✓ 已拒：${why} — ${rr.error.issues[0].path.join('.')}: ${rr.error.issues[0].message}`); }
}
console.log(`反例 ${ok}/${cases.length} 被正确拒绝`);
