// 票 28 的实物验证：**真跑一次「需求 → 资源清单」**。
//
// 输入 = 需求文本 + 已存在的 StyleSpec 文件（R11：StyleSpec 由人在会话里看图产出，管线只消费文件）。
// 调用按票 01 查清的配方：/v1/chat/completions + thinking:{type:"disabled"} + **纯文本 JSON**
// （⚠️ 不用 tool_choice —— 票 01 实测只有 1/3 可靠）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { parseRecipe, AssetRecipe } = await import("../../../../packages/contracts/dist/index.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const requirement = fs.readFileSync(path.join(HERE, "requirement.md"), "utf8");
const style = JSON.parse(fs.readFileSync(path.join(ROOT, ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json"), "utf8"));

/** 只给模型看 StyleSpec 里**影响资源清单**的那几维 —— 全给会挤掉需求本身。 */
const styleBrief = {
  identity: style.identity,
  palette: style.palette.map((h, i) => `${i}:${h}`).join(" "),
  shapeLanguage: style.shapeLanguage,
  material: style.material,
  environment: style.environment,
  constraints: style.constraints,
};

const SCHEMA = `清单是 JSON，形如：
{
  "format": "asset-recipe/v1",
  "id": "<简短英文 slug>",
  "styleRef": "authoring/stylespec.json",
  "assets": [
    {
      "spec": {
        "kind": "sprite" | "animation" | "background" | "ui",
        "id": "<英文 slug>", "role": "<它是什么>", "description": "<一句话>",
        "styleId": "style-ref",
        "anchor": { "x": <0..1>, "y": <0..1> },
        "size": { "w": <整数>, "h": <整数> },
        "dependencies": [ "<别的资源 id>" ], "required": true,
        "animations": [ { "name": "<英文>", "frames": <整数>, "fps": <数字>, "loop": <布尔> } ]
      },
      "source": { "kind": "generate" }
    }
  ]
}

四条硬规则：
1. **kind 四选一**：sprite = 单帧静止（不许有 animations）；animation = 多帧或需要播放（**必须有至少一个 animation**）；
   background = 场景尺度、可能分层视差；ui = **屏幕空间**（HUD/按钮/面板），世界里的招牌**不是** ui，是 sprite。
2. **动画的 frames 是「要几帧」这个数量**，不是帧名。名字只给动画名。
3. **anchor 是归一化 0..1 的定位点**：站在地面上的角色，x 取 0.5、y 取「脚底在画布上的比例」；
   一块可以横向拼接的地砖，用 (0,0)。
4. **⚠️ 同一个东西的多个动作，是「一个资源、多个动画」—— 不是多个资源。**
   玩家角色的 idle / run / jump 应当是**一个 id 为 player 的资源**，带三个 animation；
   拆成 player-idle / player-run / player-jump 是**错的**（会让三组帧变成三个不同的角色）。
   「不同的资源」指的是**不同的东西**：玩家、货箱、罐头、背景……
5. **dependencies 只用来排生成顺序**（比如「骑马的牛仔」要先有马），不许写清单里没有的 id。
   **绝大多数清单不需要它** —— 不要用它来表达「这两个属于同一个东西」，那应该合成一个资源。

尺寸参考：玩家这种横版角色常见 24×32 或 32×48；地砖 64×16；小道具 16×16；背景按 16:9 左右。
本项目的背景走**人工导入**通道（source.kind 在清单里仍写 "generate"，由管线处理），你只需要给对尺寸。`;

const prompt = `你是一个游戏资源策划。请根据下面的**需求**与**风格规格**，产出一份完整的资源清单。

要求：
- 只输出 JSON 本体，**不要 markdown 围栏，不要解释**。
- 清单要**完整**：把需求里点名的每一种资源都列出来，该拆的拆开（比如两种障碍是两条）。
- 每个资源的尺寸要合理，且同一世界的资源尺寸要互相协调。

# 需求
${requirement}

# 风格规格（这份世界长什么样）
${JSON.stringify(styleBrief, null, 1)}

# 清单的格式
${SCHEMA}`;

const B = process.env.ANTHROPIC_BASE_URL, K = process.env.ANTHROPIC_AUTH_TOKEN;
const t0 = Date.now();
const r = await fetch(`${B}/v1/chat/completions`, {
  method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${K}` },
  body: JSON.stringify({
    model: "deepseek-v4-pro", max_tokens: 6000,
    thinking: { type: "disabled" },                 // 票 01：不关会吃光输出预算
    messages: [{ role: "user", content: prompt }],
  }),
});
const j = await r.json();
const txt = j.choices?.[0]?.message?.content ?? "";
console.log(`HTTP ${r.status} · ${((Date.now() - t0) / 1000).toFixed(1)}s · 输出 ${txt.length} 字符`);

// 票 01：关掉 thinking 后模型会加围栏，所以保留剥围栏兜底（但不该依赖它）
const cleaned = txt.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/```[\s\S]*$/, "").trim() || txt.trim();
fs.mkdirSync(path.join(HERE, "out"), { recursive: true });
fs.writeFileSync(path.join(HERE, "out/raw.txt"), txt);

let parsed;
try { parsed = JSON.parse(cleaned); }
catch (e) {
  console.log("❌ JSON 解析失败：", e.message);
  console.log(cleaned.slice(0, 600)); process.exit(1);
}
fs.writeFileSync(path.join(HERE, "out/recipe.raw.json"), JSON.stringify(parsed, null, 2));

const res = parseRecipe(parsed);
if (!res.ok) {
  console.log(`\n❌ 第 1 次没过 schema（${res.errors.length} 处）：`);
  for (const e of res.errors.slice(0, 8)) console.log("   · " + e);
  fs.writeFileSync(path.join(HERE, "out/errors.json"), JSON.stringify(res.errors, null, 2));
  process.exit(2);
}
fs.writeFileSync(path.join(HERE, "out/recipe.json"), JSON.stringify(res.value, null, 2));
console.log(`\n✅ 一次通过 schema —— ${res.value.assets.length} 个资源`);
const byKind = {};
for (const a of res.value.assets) byKind[a.spec.kind] = (byKind[a.spec.kind] ?? 0) + 1;
console.log("   四类分布：", Object.entries(byKind).map(([k, v]) => `${k}×${v}`).join(" · "));
