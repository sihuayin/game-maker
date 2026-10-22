# 03. 候选 provider 的工具调用能力与单价

Type: research
Status: resolved
Owner: research subagent · 2026-10-22
Blocked by: —
Map: ../map.md

## Question

Q3=A 定第一个切 MiniMax-M2.7，回退 qwen3.8-max → v4-pro / relay。把这些候选在
Anthropic 兼容端点上的事实查清，供切换与成本记账用：

1. 每个候选（MiniMax-M2.7 / qwen3.8-max / deepseek-v4-pro / Claude relay）的：
   - Anthropic 兼容端点与模型名（在 cc-switch 里 appType=claude 时怎么填）；
   - 是否支持 `tool_choice: {type:"tool"}` 强制工具调用 + `tool_use` 输出；
   - 对**大 schema** 工具入参的已知限制（截断 / 丢输入 / max_tokens 上限）；
   - 单价（in/out tokens）。
2. 给出「大 schema 工具调用最稳」的排序，作为 Q3 回退顺序的佐证或修正依据。

产出：research 笔记，含一张 provider 对照表（端点 / 模型名 / 强制工具调用 / 大 schema 风险 / 单价）。
**零付费、零上游调用**（纯查公开文档与价格页）。

## Answer

详见 research 笔记：[`../research/03-provider-comparison.md`](../research/03-provider-comparison.md)

**一句话结论**：Q3 原定回退顺序需两处修正 —— ① **MiniMax 档的模型名应换成 `MiniMax-M3.1-Flash`
（或 `MiniMax-M3`），不是 M2.7**：官方 Anthropic 兼容端点只支持 M3.1-Flash/M3，M2.x 走 OpenAI 兼容接口，
且 M2.7 已在退市（10-19 对新用户关闭、11-18 下线，官方 Model List 已标 Retired）；② **「大 schema 工具调用最稳」
排序建议 `deepseek-v4-pro` ≥ `qwen3.8-max` > `MiniMax-M3.1-Flash` > Claude relay（IKunCode）**——DeepSeek 官方
Anthropic 端点 `tool_choice:"tool"` 与 `input_schema` 明确全支持、max output 384K 余量最大；qwen3.8-max 一手端点、
`{"type":"tool","name":…}` 明确支持但输出最贵（$4.95–$6/1M）；MiniMax M3.1-Flash 最便宜（$0.15/$0.60）且明确支持
`tool_choice`；relay 是真 Claude 但第三方中转（429/乘数记账），只作兜底。若维持「MiniMax 第一」原意，至少把
模型名 M2.7 换成 M3.1-Flash。最终以票 05 探针实测为准。
