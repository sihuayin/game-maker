// 提取 StyleSpec 的 prompt **全文** —— 票 15 的产出之一，也是「操作流程」的核心。
// ⚠️ 单一来源：extract.mjs 与 multi_and_counter.mjs 都 import 这里，不各写一份。
//
// 设计要点（每条都有本票或上游票的证据）：
//  ① 按**契约的字段**要，不按 docs 第 12 节的 12 个维度要 —— 文档里的
//     Perspective / UI / Rendering 在我们的 StyleSpecSchema 里没有落点，
//     照着文档要会拿到被 Zod 静默剥掉的键，而人以为自己提取到了。
//  ② 「只列真实存在的颜色，不要补全猜测色」：票 01 的四象限图上有色板幻觉，加这句后消失。
//  ③ 纯文本 JSON，不用 tool_choice（票 01：强制 JSON 只有 1/3 通过）。
export const SPEC = `{
  "id": "string（短 slug）",
  "identity": "string[] 3-6 个风格气质词",
  "camera": {"mode":"string","angle":"string"},
  "composition": {"layout":"string","density":"string"},
  "palette": "string[] 6-10 个 #RRGGBB，按画面占比从高到低",
  "lighting": {"direction":"string","contrast":"string","ambience":"string"},
  "shapeLanguage": "string[] 形状特征",
  "material": "string[] 材质质感",
  "environment": "string[] 环境元素",
  "characterStyle": "string[] 角色画法",
  "constraints": "string[] 生成新资源时必须遵守的规则",
  "confidence": "number 0-1"
}`;

export const PROMPT = `这是一张游戏截图，将作为**风格参考图**。

提取它的**视觉语法**（视觉语法 = 这个世界长什么样、按什么规则长），
**不要描述画面内容**、不要提 UI 文字、不要复述剧情。

palette 必须是 #RRGGBB hex 数组，按画面占比从高到低，只列**真实存在**的颜色，不要补全猜测色。

严格按以下 JSON 结构输出，只输出 JSON 本体，不要 markdown 围栏、不要解释：
${SPEC}`;
