// **票 02 的那一问**：给每一层**自己的**描述，模型会不会就只画它自己那一层？
//
// ⚠️ 这是一个**受控对照**：模板、目标层、尺寸、上游、抠图参数**全部不变**，
//   唯一变的是每一层的 `description` 在不在（`control` 摘掉 ⇒ 回落整张场景）。
//
// ⚠️⚠️ **这一列「不透明率」在这条路上永远是 100%，它看不见任何东西** ——
//   实测模型给的底色**从来不是**提示词要的那个纯色（六张图一个像素都抠不掉，
//   见[票 03](../../issues/03-key-color-drift.md)）。⇒ **证据是图，不是这个数。**
//   数还是留着：哪天底色对上了，它当场就有意义。
//
//   node .scratch/image-route-v1/experiments/layer-description/run.mjs            # 处理组
//   node .scratch/image-route-v1/experiments/layer-description/run.mjs --both     # 两臂一起
//   node .scratch/image-route-v1/experiments/layer-description/run.mjs 只画自己   # 再补一句
//
// ⚠️ **描述来自配方自己**（`fixtures/recipes/last-train-image.json` 的 `layers[].description`），
//   不在这里另写一份 —— 这样量到的就是**管线真会发出去的那句话**。
//
// 一个臂 3 笔 Gemini 调用（一层一笔）。**要花钱**，所以它不住 CI。
import fs from "node:fs";
import { createGeminiGenerator, createProxyFetch, imagePrompt, importFrames, resolveImageTransport, encodePNG } from "../../../../packages/assets/dist/index.js";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const style = JSON.parse(fs.readFileSync(ROOT + "fixtures/style-spec.halt-dusk.json", "utf8"));
const recipe = JSON.parse(fs.readFileSync(ROOT + "fixtures/recipes/last-train-image.json", "utf8"));
const bg = recipe.assets.find((a) => a.spec.id === "bg-dusk-halt").spec;

// ⚠️ **逐层描述**：只写「这一层有什么」，不夹带任何「留空」之类的额外指令 ——
//   那些模板里已经有了。这一句就是要测的那个变量。
/** 命令行第二个词：追加到每一层描述后面的一句（**唯一**的另一个变量）。 */
// ⚠️ **只取不是 `--` 开头的那一个** —— 第一版写成 `argv[2]`，于是 `--both` 被当成"追加的那句话"，
//   污染了**两个臂**（那一轮的 `-explicit` 文件就是这么来的）。
const EXTRA = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "";
const SUFFIX = EXTRA ? "-explicit" : "";

// ⚠️ **两个臂**：`treatment` 用配方里那三句逐层描述；`control` 把它们**摘掉**，
//   让每一层回落到整张场景那句 —— 这就是「不给逐层描述」的那个世界。
//   两臂走的是**同一份模板、同一个上游、同一组参数**，唯一的差别就是那三句话在不在。
const ARMS = process.argv.includes("--both") ? ["control", "treatment"] : ["treatment"];

// ⚠️ **不给**逐层描述的那种，走它自己的回落（整张场景那句）—— 那是对照组。

const cfg = JSON.parse(fs.readFileSync(ROOT + "game-maker.local.json", "utf8"));
const img = resolveImageTransport({ env: {}, cwd: ROOT });
if (!img.transport) { console.error("没配生图凭据"); process.exit(1); }
const t = img.transport;
const gen = createGeminiGenerator({ baseUrl: t.baseUrl, apiKey: t.apiKey, ...(t.model ? { model: t.model } : {}), fetchImpl: t.proxy ? createProxyFetch({ proxy: t.proxy }) : undefined });

const KEY = [255, 0, 255];   // #ff00ff —— 与 `keyColorFor(palette)` 同一个
const outDir = ROOT + "out/__layer-exp";
fs.mkdirSync(outDir, { recursive: true });

console.log(`上游 ${img.transport.protocol} · ${img.transport.model}\n`);
for (const arm of ARMS) {
console.log(`\n── ${arm === "control" ? "对照组：摘掉逐层描述（回落整张场景）" : "处理组：用配方里的逐层描述"} ──`);
console.log("层        不透明率");
for (const [i, l] of bg.layers.entries()) {
  // ⚠️ **层要嵌在 `.layer` 底下**（`ImagePromptTarget`）—— 平着传会让 `target.layer` 是 undefined，
  //   于是 `imagePrompt` **一路落到单物体那份模板**上，量到的就完全不是这条路。
  //   ⚠️ 前两轮就是这么错的（见票 02 末尾的更正）。
  const target = { layer: { name: l.name, index: i, total: bg.layers.length, tileX: !!l.tileable?.x } };
  const withDesc = EXTRA
    ? bg.layers.map((x) => ({ ...x, description: x.description + `⚠️ ${EXTRA} —— 更近的那几层一个都不要画，那是它们的事。` }))
    : bg.layers;
  const layers = arm === "control"
    ? withDesc.map(({ description, ...rest }) => rest)          // 摘掉 ⇒ 回落整张场景
    : withDesc;
  const prompt = imagePrompt({ ...bg, layers }, style, target);
  const { image } = await gen({ prompt, size: bg.size });
  fs.writeFileSync(`${outDir}/${arm}-${l.name}${SUFFIX}.png`, encodePNG(image));
  fs.writeFileSync(`${outDir}/${arm}-${l.name}${SUFFIX}.prompt.txt`, prompt + "\n");
  // ⚠️ 与 pack 对背景层的处理**逐字相同**（trim:false + 按已知纯色抠）
  const [frame] = importFrames([image], {
    palette: style.palette, targetWidth: bg.size.w, targetHeight: bg.size.h,
    background: { tolerance: 40, colors: [KEY] }, trim: false,
  });
  let opaque = 0;
  for (let p = 0; p < frame.width * frame.height; p++) if (frame.data[p * 4 + 3] > 0) opaque++;
  const ratio = opaque / (frame.width * frame.height);
  console.log(`  ${l.name.padEnd(7)} ${(100 * ratio).toFixed(1).padStart(6)}%   ← 看图，不看这个数`);
}
}
console.log("\n判据：最远层（sky）要 ≥99.9%，其余两层要 <99.9%");
console.log(`原图在 ${outDir.replace(ROOT, "")}（含那一刻的提示词）`);
