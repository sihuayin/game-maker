import fs from "node:fs";
import path from "node:path";
import { readFileSync } from "node:fs";
const ROOT = "/Volumes/shy/some-projects/game-maker/";
const { buildAssetPack } = await import(ROOT + "packages/assets/dist/index.js");
const { parseAssetPack, parseRecipe } = await import(ROOT + "packages/contracts/dist/index.js");

const recipe = JSON.parse(readFileSync(ROOT + "fixtures/recipes/shift-change.json", "utf8"));
const style = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));

// 桩生成器：票 22 还没做，所以这里用一个确定性的占位实现，把组装链路跑通
const stub = (spec) => {
  const n = spec.kind === "animation" ? spec.animations.reduce((s, a) => s + a.frames, 0) : 1;
  return Array.from({ length: n }, (_, i) => ({
    format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
    viewBox: [0, 0, spec.size.w, spec.size.h], expectedSize: [spec.size.w, spec.size.h],
    ops: [
      { op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: `palette:${i % 5}` },
      { op: "rect", x: 1, y: 1, w: Math.max(1, spec.size.w - 2), h: Math.max(1, Math.round(spec.size.h / 8)), fill: "palette:1" },
    ],
  }));
};

// 把清单里唯一的导入资源（背景）改成真的走导入通道，让两条路都在这一次里跑到
const r = structuredClone(recipe);
const bg = r.assets.find((a) => a.spec.kind === "background");
bg.source = { kind: "import", ref: "fixtures/reference/test.png", background: { tolerance: 30 } };
bg.spec.size = { w: 320, h: 180 };

const out = ROOT + "out";
const t0 = Date.now();
const res = await buildAssetPack({ recipe: r, style, outDir: out, generate: stub, sourceDateEpoch: 1790208000 });
const ms = Date.now() - t0;

const parsed = parseAssetPack(res.manifest);
console.log(`清单：${parseRecipe(r).ok ? "✅" : "❌"}  ·  manifest 过 schema：${parsed.ok ? "✅" : "❌ " + parsed.errors.join("；")}`);
console.log(`对账（spec ↔ 产物）：${res.audit.length === 0 ? "✅ 0 问题" : "❌ " + res.audit.join("；")}`);
console.log(`耗时 ${ms} ms  ·  ${res.manifest.files.length} 个文件  ·  ${(res.manifest.files.reduce((s, f) => s + f.bytes, 0) / 1024).toFixed(1)} KiB`);
console.log(`\n包：${path.relative(ROOT, res.packDir)}  (v${res.manifest.version})`);
console.log("图集：");
for (const a of res.manifest.atlases) console.log(`   ${a.id.padEnd(12)} ${String(a.size.w).padStart(4)}×${String(a.size.h).padEnd(4)} ${String(a.frames).padStart(2)} 帧  [${a.assets.join(", ")}]`);
console.log("资源：");
for (const a of res.manifest.assets) {
  const anim = a.animations ? ` · ${a.animations.map((x) => `${x.name}×${x.frames.length}`).join(" ")}` : "";
  console.log(`   ${a.id.padEnd(24)} ${a.kind.padEnd(11)} ${a.origin.padEnd(9)} ${a.paletteBinding.padEnd(10)} ${String(a.size.w + "×" + a.size.h).padEnd(9)} ${a.frames.length} 帧${anim}`);
}
console.log(`\nprovenance.mode = ${res.manifest.provenance.mode} · palette coverage = ${JSON.stringify(res.manifest.palette.coverage)}`);
