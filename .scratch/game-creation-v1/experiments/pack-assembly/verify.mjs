import fs from "node:fs"; import path from "node:path";
const ROOT = "/Volumes/shy/some-projects/game-maker/";
const { buildAssetPack, decodePNG } = await import(ROOT + "packages/assets/dist/index.js");
const recipe = JSON.parse(fs.readFileSync(ROOT + "fixtures/recipes/shift-change.json", "utf8"));
const style = JSON.parse(fs.readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const stub = (spec) => {
  const n = spec.kind === "animation" ? spec.animations.reduce((s, a) => s + a.frames, 0) : 1;
  return Array.from({ length: n }, (_, i) => ({ format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
    viewBox: [0,0,spec.size.w,spec.size.h], expectedSize: [spec.size.w,spec.size.h],
    ops: [{op:"rect",x:0,y:0,w:spec.size.w,h:spec.size.h,fill:`palette:${i%5}`}] }));
};
const r = structuredClone(recipe);
const bg = r.assets.find(a=>a.spec.kind==="background");
bg.source = { kind:"import", ref:"fixtures/reference/test.png", background:{tolerance:30} };
bg.spec.size = { w:320, h:180 };

// ① 确定性：两次构建（不同 outDir、同一 epoch）
const a = await buildAssetPack({ recipe:r, style, outDir:"/tmp/det-a", generate:stub, sourceDateEpoch:1790208000 });
const b = await buildAssetPack({ recipe:r, style, outDir:"/tmp/det-b", generate:stub, sourceDateEpoch:1790208000 });
const same = JSON.stringify(a.manifest) === JSON.stringify(b.manifest);
console.log(`① 确定性：manifest 两次${same?"逐字节相同 ✅":"不同 ❌"}`);
let bytesSame = true;
for (const f of a.manifest.files) {
  const pa = path.join(a.packDir, f.path), pb = path.join(b.packDir, f.path);
  if (!fs.readFileSync(pa).equals(fs.readFileSync(pb))) { bytesSame = false; console.log("   ❌ 文件不同：", f.path); }
}
console.log(`   包内 ${a.manifest.files.length} 个文件（含 PNG）${bytesSame?"逐字节相同 ✅":"有差异 ❌"}`);

// ② 可消费性：图集是 TexturePacker JSON Hash，PNG 能解回
const packDir = "/Volumes/shy/some-projects/game-maker/out/shift-change-assets/pack/v1";
for (const at of fs.readdirSync(path.join(packDir,"delivery")).filter(f=>f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join(packDir,"delivery",at),"utf8"));
  const isHash = !Array.isArray(j.frames) && typeof j.frames === "object";
  const keys = [...new Set(Object.values(j.frames).flatMap(f=>Object.keys(f)))].sort();
  console.log(`② delivery/${at.padEnd(24)} frames 是对象=${isHash?"✅":"❌"} · 帧字段 [${keys.join(",")}]`);
}
const img = decodePNG(fs.readFileSync(path.join(packDir,"delivery/atlas.sprites.png")));
console.log(`   atlas.sprites.png 解回 ${img.width}×${img.height} ✅`);
// ③ 包内路径全是相对 POSIX
const bad = a.manifest.files.filter(f=>f.path.startsWith("/")||f.path.includes("\\"));
console.log(`③ 包内路径全是相对 POSIX：${bad.length===0?"✅":"❌ "+bad.map(f=>f.path)}`);
fs.rmSync("/tmp/det-a",{recursive:true,force:true}); fs.rmSync("/tmp/det-b",{recursive:true,force:true});
