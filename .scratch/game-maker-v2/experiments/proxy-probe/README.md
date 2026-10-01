# 票 25 的探针：`/v1/messages` 今天到底能干什么

**三发请求，每发只回答一个问题。** 原始响应在 `raw/`（逐发一份 JSON，含 `usage` / `stop_reason` / 原文）。
跑法：`node .scratch/game-maker-v2/experiments/proxy-probe/run.mjs`（凭据从环境读，**不落盘**）。

## 结果

| # | 问题 | 做法 | 结果 |
|---|---|---|---|
| ① | 模型**真看见**吗（不是「收得下图块、看不见图」） | 合成图：白底 3 个实心圆，左红 / 中绿 / 右蓝。**真值我造的** | ✅ `"3 个；左=红色 中=绿色 右=蓝色"` —— **全对** |
| ② | 真参考图 + 一次能吐多大 JSON | `fixtures/reference/halt-dusk.png`（480×270）+ 点名要 11 个块 | ✅ 2129 字符 · `JSON.parse` 通过 · **11 键全齐** · **无 markdown 围栏** · `stop=end_turn`（未截断） |
| ③ | `tools` + `tool_choice` 认不认 | 一个工具 + `tool_choice:{type:"tool"}` | ✅ `blocks=[tool_use]` · `stop_reason=tool_use` · input 是一份合法对象 |

三发全是 **HTTP 200**（956ms / 3404ms / 1115ms）。

### ① 是这三发里最要紧的一发

它**排除了那个已知的失败模式**。这条路此前**正好经历过**「收得下图块、模型看不见图」
（`../../../game-creation-v1/map.md:193-200`）。合成图的真值是我自己画的，
所以答对**不可能是碰运气**。

### ② 说的是那张图，不是在编

`identity.description` = *"a solitary figure in a train station…"* · `composition.foreground` = *"Train tracks"* ·
`composition.midground` = *"Character and station platform"* · `composition.background` = *"Station wall, bulletin board"*。
—— 与「黄昏山间列车小站」对得上，且具体到了公告板。

## ⚠️ 三条**必须一起读**的保留

1. **每项 n = 1。** 这三发回答的是「**能不能**」，**不是「成功率」**。
   票 01 那条「强制 JSON 只有 1/3 通过」是一个**率**，而且是在**另一个端点**（`/v1/chat/completions`）上量的
   —— 本探针**没有**复现它，也**没有**推翻它。要率，得另开一次测量（多花请求）。
2. **`servedModel` 是 `deepseek-flash`**，而我们请求的是 `deepseek-v4-pro`。
   代理换模型这件事**又发生了一次**（旧图里已记过）。⇒ 账上的 `requestedModel` 与 `model` 必须分开记，这条纪律今天仍然成立。
3. **② 的 2129 字符是在 4000 `max_tokens` 下、点名只要那 11 个键拿到的。**
   真的 `VisualWorldSpec` 可能更大（`references` 数组、`materials` 展开）。**没有量到天花板**。

## 对下游的含义

- 票 08 的**第一段不用新接上游**：复用 `/v1/messages` + base64 图块（照 `review.ts` 抄）。
- ③ 让「严格 JSON」多了一条**比纯文本强**的路 —— 但**改 R16 要重新开票**（R17），
  所以派生出了[票 27](../../issues/27-json-via-tool-choice.md)。
