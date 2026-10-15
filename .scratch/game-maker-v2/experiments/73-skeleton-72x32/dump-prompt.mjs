// 票 73 · 读数 ①：**把真提示词原样渲染出来**（零付费 —— 上游用桩 fetch 顶掉）。
//
// ⚠️ 用法：node dump-prompt.mjs [资源包目录]
//   默认包 = fixtures/packs/last-train/v2。⚠️ 包必须是 `assetpack/v4`（今天 `parseAssetPack` 只认它）。
// ⚠️ 它**不改任何源码**，读的是 `packages/assets/dist`（`npx tsc -b` 之后的产物）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const ROOT = path.resolve(new URL("../../../..", import.meta.url).pathname);
const { compileRuntime } = await import(ROOT + "/packages/assets/dist/index.js");
const PACK = process.argv[2] ?? path.join(ROOT, "fixtures/packs/last-train/v2");
/** 一份最小但合法的设计（与 `compile-runtime.test.ts` 里那份同形）。 */
const DESIGN = {
  format: "game-design/v1",
  game: { title: "末班车", genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } },
  coreLoopSteps: ["躲开行李", "捡齐失物", "走到信号灯"],
  player: { id: "p-postman", role: "送信的邮差", abilities: ["跑", "跳"], goals: ["赶上末班车"] },
  enemies: [{ id: "e-dog", behavior: "沿地面来回走", threat: "碰到扣血" }],
  npcs: [], interactables: [{ id: "i-signal", type: "信号灯", behavior: "捡齐后变绿" }],
  resources: [{ id: "r-lost", purpose: "三件失物" }],
  world: { theme: "黄昏的铁路小站", setting: "月台与铁轨", structure: "三条横带：铁轨 / 月台 / 远山" },
  levels: [{ id: "l-1", purpose: "唯一一关", layout: "左侧出发，右侧信号灯", entities: ["e-dog", "r-lost", "i-signal"] }],
  progression: { model: "linear", description: "一关到底" },
  mechanics: [{ id: "m-jump", mechanic: "jump" }],
  winConditions: ["捡齐三件失物并走到信号灯"], loseConditions: [], runtimeRequirements: ["input:keyboard"],
};
const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-p73-"));
fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(DESIGN));
let captured = null;
const upstream = (async (_url, init) => {
  captured = JSON.parse(init.body).messages[0].content[0].text;
  return new Response(JSON.stringify({
    content: [{ type: "tool_use", name: "emit_game_config", input: {} }],
    stop_reason: "tool_use", model: "stub", usage: { output_tokens: 1 },
  }), { status: 200, headers: { "content-type": "application/json" } });
});
try {
  await compileRuntime({ designPath: path.join(d, "game-design.json"), packDir: PACK, outRoot: path.join(d, "out"),
    transport: { baseUrl: "http://stub", apiKey: "stub" }, fetchImpl: upstream });
} catch { /* 期望：空 input 过不了 schema —— 提示词已经捞到了 */ }
if (!captured) { console.error("没捞到提示词（包不过 schema？看上面的报错）"); process.exit(1); }
console.log(captured);
