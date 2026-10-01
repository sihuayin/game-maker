# 27. 严格 JSON 改用 `tool_choice` 吗 —— **R16 要不要改**

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 由[票 25](25-prototype-structured-output.md) 的**第三发**派生。
> **R17 说改 R 表必须重新开票** —— 这就是那张票。

## Question

**R16 定的是**：

> 严格 JSON **沿用**「纯文本 + 剥围栏 + 固定次数重采样」，**同时**开一张 `prototype` 票去量
> 代理的结构化输出 / 视觉输入。

那张 prototype 票**跑了**（票 25），第三发的结论是：`tools` + `tool_choice: {type:"tool"}`
**认**，`stop_reason = tool_use`，回的是一个合法 `tool_use` 块。

⇒ 现在「沿用三件套」这个前提**有了新证据**，要不要改，是这一票要答的。

### 三条事实（别重新量）

1. **`tool_choice` 认**（票 25 ③，n=1）
2. **票 01 的「1/3」不能拿来反对**：那是在**另一个端点**（`/v1/chat/completions`）上量的**率**，
   而 `generate.ts:11` 自己写着「**代理的上游配置一直在变，端点是参数不是常量**」。
   票 25 **既没复现它、也没推翻它**。
3. **票 25 ② 顺带量到**：**光用提示词**要 JSON，模型也**没有加 markdown 围栏**（2129 字符，直接 `JSON.parse` 通过）。
   ⇒ 「剥围栏」这一步在**那一次**是多余的。⚠️ 同样 n=1。

### 选哪条

**(a) 改用 `tool_choice`** —— 形状由 **JSON Schema 保证**，不靠模型自觉。
`tool_use` 缺席 = **解析失败**，走既有的重采样，不是一条并行的兜底路线。
**(b) 保持 R16**（纯文本 + 剥围栏 + 重采样）—— 理由：`tool_choice` 只有 n=1，
弱模型偶尔会「不调工具、直接回文本」，那时仍要回落。
**(c) 两条都留**：首选 `tool_choice`、回落纯文本。
⚠️ 注意这不是 R10 说的「互相兜底」—— R10 那条**只管资产路线**（drawlist vs image），与调用协议无关。

### 连带影响谁

票 08 / 09 / 10 三张（`analyze-reference` · `analyze-intent` · `compile-design`）
**都要按这个答案写**，所以本票已加进它们三张的 `Blocked by`。

⚠️ 还有一层：**票 08 的第一发真跑不就是率吗？** —— 账（`ledger.json`）本来就逐笔记
`attempts` / `trips`（`image-route-v1` 那四张票刚把它做准）。所以选 (a) 的话，
**不需要再花一笔专门去测率**：第一张真跑的账就是答案，且它免费。

## Answer

（待解）
