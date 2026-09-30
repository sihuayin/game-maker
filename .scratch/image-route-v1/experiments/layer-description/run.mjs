// **票 02 的那一问**：给每一层**自己的**描述，模型会不会就只画它自己那一层？
//
// ⚠️ 这是一个**受控对照**：模板、目标层、尺寸、上游、抠图参数**全部不变**，
//   唯一变的是 `spec.description` 那一句话 —— 换成「这一层自己的东西」。
//   对照组就是真跑那一次（三层共用整张场景的描述）：三层全 100%。
//
// ⚠️ 量出来的数**与 `coverage.json` 同一个口径**（同一个 `importFrames` + 同一组参数），
//   所以它能直接对着门禁读：最远层要 ≥0.999，其余层要 <0.999。
//
//   node .scratch/image-route-v1/experiments/layer-description/run.mjs            # 逐层描述
//   node .scratch/image-route-v1/experiments/layer-description/run.mjs 只画自己   # 再补一句（见票 02 的答案）
//
// 一次 3 笔 Gemini 调用（一层一笔）。**要花钱**，所以它不住 CI。
import fs from "node:fs";
import { createGeminiGenerator, createProxyFetch, imagePrompt, importFrames, resolveImageTransport, encodePNG } from "../../../../packages/assets/dist/index.js";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const style = JSON.parse(fs.readFileSync(ROOT + "fixtures/style-spec.halt-dusk.json", "utf8"));
const recipe = JSON.parse(fs.readFileSync(ROOT + "fixtures/recipes/last-train-image.json", "utf8"));
const bg = recipe.assets.find((a) => a.spec.id === "bg-dusk-halt").spec;

// ⚠️ **逐层描述**：只写「这一层有什么」，不夹带任何「留空」之类的额外指令 ——
//   那些模板里已经有了。这一句就是要测的那个变量。
/** 命令行第二个词：追加到每一层描述后面的一句（**唯一**的另一个变量）。 */
const EXTRA = process.argv[2] ?? "";
const SUFFIX = EXTRA ? "-explicit" : "";

const PER_LAYER = {
  sky: "整幅黄昏天空：橙红色落日压在山脊剪影后面。天空铺满整块画布",
  wall: "候车室的外墙带：一排窗户、挂画与壁灯，横向平铺",
  ground: "站台地面与下方的一小段铁轨，横向平铺",
};

const cfg = JSON.parse(fs.readFileSync(ROOT + "game-maker.local.json", "utf8"));
const img = resolveImageTransport({ env: {}, cwd: ROOT });
if (!img.transport) { console.error("没配生图凭据"); process.exit(1); }
const t = img.transport;
const gen = createGeminiGenerator({ baseUrl: t.baseUrl, apiKey: t.apiKey, ...(t.model ? { model: t.model } : {}), fetchImpl: t.proxy ? createProxyFetch({ proxy: t.proxy }) : undefined });

const KEY = [255, 0, 255];   // #ff00ff —— 与 `keyColorFor(palette)` 同一个
const outDir = ROOT + "out/__layer-exp";
fs.mkdirSync(outDir, { recursive: true });

console.log(`上游 ${img.transport.protocol} · ${img.transport.model}\n`);
console.log("层        不透明率   （对照：共用描述那一次）");
for (const [i, l] of bg.layers.entries()) {
  const target = { name: l.name, index: i, total: bg.layers.length, tileX: !!l.tileable?.x };
  const prompt = imagePrompt({ ...bg, description: PER_LAYER[l.name] + (EXTRA ? `⚠️ ${EXTRA} —— 更近的那几层一个都不要画，那是它们的事。` : "") }, style, target);
  const { image } = await gen({ prompt, size: bg.size });
  fs.writeFileSync(`${outDir}/${l.name}${SUFFIX}.png`, encodePNG(image));
  fs.writeFileSync(`${outDir}/${l.name}${SUFFIX}.prompt.txt`, prompt + "\n");
  // ⚠️ 与 pack 对背景层的处理**逐字相同**（trim:false + 按已知纯色抠）
  const [frame] = importFrames([image], {
    palette: style.palette, targetWidth: bg.size.w, targetHeight: bg.size.h,
    background: { tolerance: 40, colors: [KEY] }, trim: false,
  });
  let opaque = 0;
  for (let p = 0; p < frame.width * frame.height; p++) if (frame.data[p * 4 + 3] > 0) opaque++;
  const ratio = opaque / (frame.width * frame.height);
  const ctrl = { sky: 1.0, wall: 1.0, ground: 1.0 }[l.name];
  console.log(`  ${l.name.padEnd(7)} ${(100 * ratio).toFixed(1).padStart(6)}%      ${(100 * ctrl).toFixed(1)}%`);
}
console.log("\n判据：最远层（sky）要 ≥99.9%，其余两层要 <99.9%");
console.log(`原图在 ${outDir.replace(ROOT, "")}（含那一刻的提示词）`);
