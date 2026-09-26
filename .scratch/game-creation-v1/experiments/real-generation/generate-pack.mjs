import fs from "node:fs";
const ROOT = "/Volumes/shy/some-projects/game-maker/";
const { buildAssetPack, createDrawListGenerator } = await import(ROOT + "packages/assets/dist/index.js");
const { parseAssetPack } = await import(ROOT + "packages/contracts/dist/index.js");

const recipe = JSON.parse(fs.readFileSync(ROOT + "fixtures/recipes/shift-change.json", "utf8"));
const style = JSON.parse(fs.readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
// 背景走人工导入（票 23 定：场景尺度的东西管线造不出来）
const r = structuredClone(recipe);
const bg = r.assets.find((a) => a.spec.kind === "background");
// ⚠️ ref 相对**配方文件**解析（契约 InputPath 的规则，票 18）——
// 配方在 fixtures/recipes/，参考图在 fixtures/reference/，所以是 ../reference/test.png。
// 这里曾经写成仓库根相对的 "fixtures/reference/test.png"：那是 cwd 解析时代的写法，
// recipeDir 变成必填之后就一直是崩的（.mjs 不在 tsc 管辖内，没人发现）。
bg.source = { kind: "import", ref: "../reference/test.png", background: { tolerance: 30 } };
bg.spec.size = { w: 320, h: 180 };

const prompts = fs.mkdirSync(ROOT + "out/prompts", { recursive: true }) ?? ROOT + "out/prompts";
const gen = createDrawListGenerator({
  baseUrl: process.env.ANTHROPIC_BASE_URL, apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
  onPrompt: (p, spec) => fs.writeFileSync(`${ROOT}out/prompts/${spec.id}.txt`, p),
});

const t0 = Date.now();
console.log(`开始生成 ${r.assets.length} 个资源（一次调用一个资源，全部帧一起出）…`);
process.on("unhandledRejection", (e) => { console.error("❌", e.message); process.exit(1); });
const res = await buildAssetPack({
  recipe: r, style, outDir: ROOT + "out", generate: gen, sourceDateEpoch: 1790208000,
  recipeDir: ROOT + "fixtures/recipes",   // 必填：source.ref 与 styleRef 都相对它解析
});
const ms = Date.now() - t0;

const parsed = parseAssetPack(res.manifest);
console.log(`\n✅ 清单 → 真包：${((ms) / 1000).toFixed(1)}s · manifest 过 schema：${parsed.ok ? "✅" : "❌ " + parsed.errors.join("；")}`);
console.log(`   对账（spec ↔ 产物）：${res.audit.length === 0 ? "✅ 0 问题" : "❌ " + res.audit.join("；")}`);
console.log(`   ${path_of(res.packDir)}  ·  ${res.manifest.files.length} 个文件  ·  ${(res.manifest.files.reduce((s, f) => s + f.bytes, 0) / 1024).toFixed(1)} KiB`);
for (const a of res.manifest.assets) {
  const anim = a.animations ? a.animations.map((x) => `${x.name}×${x.frames.length}`).join(" ") : "—";
  console.log(`   ${a.id.padEnd(24)} ${a.kind.padEnd(11)} ${a.origin.padEnd(9)} ${a.paletteBinding.padEnd(10)} ${String(a.size.w + "×" + a.size.h).padEnd(9)} ${String(a.frames.length).padStart(2)} 帧  ${anim}`);
}
console.log(`\nprovenance.mode = ${res.manifest.provenance.mode} · coverage = ${JSON.stringify(res.manifest.palette.coverage)}`);
console.log(`包路径：${res.packDir}`);
function path_of(p) { return p.replace(ROOT, ""); }
