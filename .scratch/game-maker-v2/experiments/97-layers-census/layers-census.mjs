// 票 97 · 读数：盘上**有没有**任何一对（配方 × 包）会让 `layers` 那一族真的响？
// 零付费、只读：用 packages/contracts/dist 里**生产那个函数自己**（auditAssetSpec）。
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(new URL("../../../..", import.meta.url).pathname);
const C = await import(path.join(ROOT, "packages/contracts/dist/index.js"));
const recipes = fs.readdirSync(path.join(ROOT, "fixtures/recipes")).filter(f => f.endsWith(".json"));
const packs = [];
for (const p of fs.readdirSync(path.join(ROOT, "fixtures/packs")))
  for (const v of fs.readdirSync(path.join(ROOT, "fixtures/packs", p)))
    if (fs.existsSync(path.join(ROOT, "fixtures/packs", p, v, "manifest.json"))) packs.push([p, v]);
const LAYER = /层|平铺/;
for (const r of recipes) {
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/recipes", r), "utf8"));
  const specs = (rec.assets ?? []).map(a => a.spec ?? a);
  for (const [p, v] of packs) {
    const m = C.parseAssetPack(JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/packs", p, v, "manifest.json"), "utf8")));
    if (!m.ok) { console.log("包不过契约", p, v); continue; }
    let overlap = 0, layerHits = 0, otherHits = 0;
    for (const spec of specs) {
      const entry = m.value.assets.find(a => a.id === spec.id);
      if (!entry) continue;
      overlap++;
      for (const msg of C.auditAssetSpec(spec, entry)) (LAYER.test(msg) ? layerHits++ : otherHits++);
    }
    if (overlap) console.log(`${r.padEnd(32)} × ${(p + "/" + v).padEnd(22)} 重叠 ${String(overlap).padStart(2)} · **层族 ${layerHits}** · 其他 ${otherHits}`);
  }
}
