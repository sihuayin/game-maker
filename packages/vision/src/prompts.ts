// 提示词与工具声明 —— 票 08 的提问面。
//
// ⚠️ **这一份是**重写**的，不是从 `docs/stylespec-extraction.md` 抄的**（票 08 的 R1-Q5）。
//   那份人肉规程喂的是 `StyleSpec`，这里喂的是 `VisualWorldSpec`（六桶、`PaletteRef`、
//   内嵌 `style` 子树）。但**两条实测得来的纠正被原文搬了过来** —— 它们不是文风，是量出来的：
//     ① **选色不排色**（「不要按画面占比从高到低排序」—— 否则色板全灰，画不出招牌/发光屏/机器外壳）。
//     ② **`constraints` 里不许写「某色面积 < X%」**（那是一句没人校验的字符串，还把重音色当污染物）。
//
// ⚠️ **`prompt.ts`（`packages/assets`）不动**：那一份是**反方向**的（`StyleSpec` → 生成提示词），
//   而 `vision` 也够不着它（`check-deps.mjs`）。

/** 工具名。⚠️ 与票 27 的七发探针同名 —— 那批 raw 还躺在 `.scratch/.../experiments/tool-choice-probe/`。 */
export const TOOL_NAME = "emit_visual_world";

/**
 * 工具声明。⚠️ **它是「schema 说不清的东西」唯一的家**（票 08 的 R2-Q5）。
 *
 * 为什么非得在这里说：`toJSONSchema` 会把 `superRefine` **静默丢掉**，而它把开放对象摊成
 * **没有 `properties` 的空对象**（票 08 的探针实测）。八发真跑里**两发**正是栽在这两件事上，
 * 而它们**都出在内嵌的 `style` 子树**、新视图零失败：
 *   · 第 05 发：`style.camera` / `composition` / `lighting` 被填成了**字符串数组**；
 *   · 第 06 发：模型**自造了一个键** `environmentStyle`，撞上 `strictObject`。
 * ⚠️ **这三条都只写「模型真能自己违背」的东西** —— 路径那三条管的是**调用方注入**的
 *   `styleReferences`（模型答不出，见 R1-Q2），所以**不写**。
 */
export const TOOL_DESCRIPTION = `输出一份 VisualWorldSpec —— 它描述这个世界**长什么样、按什么规则长**，
不是对这张图的描述，更不是复述画面内容。

⚠️ 有三件事 schema 表达不出来，必须由这里说清楚：

1. \`style.camera\` / \`style.composition\` / \`style.lighting\` 是**开放对象**（键名与值都随意），
   **不是数组**。它们是"原话"的载体，例如 \`{"mode":"2D正交侧面视角","angle":"平视"}\`。

2. \`style\` 的键集**是封的**，只有这 12 个：
   id · identity · camera · composition · palette · lighting · shapeLanguage · material ·
   environment · characterStyle · constraints · confidence
   **不许自造键**（尤其别把 environment 与 characterStyle 合成一个）。

3. 六桶（\`palette.primary\` 等）与 \`materials.*.color\` 里的 \`palette:N\`，
   必须指向你**自己刚写下的那份** \`style.palette\`：下标从 0 起、**严格小于**色板长度。
   色板里**不许有重复色**，色值一律**小写** \`#rrggbb\`。

只调这个工具，不要解释。`;

/**
 * 发出去的那一段话。⚠️ 只是**提示**，不是判据 —— 判据是「入参过 schema」（`parseToolUse`）。
 *
 * ⚠️ `style.id` 要**照着抄**（票 02 裁决 21）：它是**身份不是观察**，让模型看一张图即兴编，
 *   同一张图两次会跑出两个 `stylespecId`，而那个字段的用途恰恰是**指认**。解析后由
 *   `buildVisualWorld` **强制覆盖** —— 抄错也不影响正确性，抄对只是省一次覆盖。
 */
export function visionPrompt(input: { requirementText: string; styleId: string }): string {
  return `这是一张游戏截图，将作为**风格参考图**。

提取它的**视觉语法**（视觉语法 = 这个世界长什么样、按什么规则长），
**不要描述画面内容**、不要提 UI 文字、不要复述剧情。

palette 的选择标准是**能不能画出这个世界里的东西**，不是它在图上占多大面积：
- 每个色都**必须真的出现在这张图里** —— 不要补全猜测色、不要凭空发明
- ⚠️ **不要**按画面占比从高到低排序。参考图往往 80% 以上是中性色，
  按占比分配的色板会**全是灰的**，而灰的色板画不出招牌、发光屏、机器外壳、罐子这些**必须画得出来**的东西
- 顺序随意。下面还给了这个世界**将来要画什么**，照它挑能画出那些东西的颜色

constraints 只写**生成新资源时必须遵守的规则**，
⚠️ **不要**写「某色面积 < X%」这类数值上限 —— 那类句子会把**重音色当成污染物**，
而这个色板恰恰需要重音色。

⚠️ \`style.id\` 请**照抄**这个值：${input.styleId}

# 这个世界将来要画什么
${input.requirementText.trim()}

只调 ${TOOL_NAME} 工具，不要解释。`;
}
