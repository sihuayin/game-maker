# 01. 根因证据：大 schema 丢数据 vs provider 映射没生效

Type: research
Status: resolved
Owner: research subagent · 2026-10-22
Blocked by: —
Map: ../map.md

## Question

`plan-assets` 的 `empty-input` 失败到底是大 `emit_asset_recipe` schema 导致的数据丢失，还是
cc-switch 把 provider 映射成 `deepseek-flash` 导致的能力不足？把能区分的证据查清、落盘：

1. **`emit_asset_recipe` 的实际 schema 规模**：从 `packages/contracts/src/recipe-tool.ts` 生成
   的 `toolInputSchema` 有多少字节 / 多深 / 多少字段？`PLAN_TOOL_DESCRIPTION` 又有多长？
   是不是大到了足以让代理 / 上游截断或丢输入的量级？
2. **「票 27」悬空引用定位**：p0-final-v1 里反复引用「票 27 第 1 发实测：上游烧了 1135 输出 token、
   入参没了」。这个证据到底在哪（哪个 effort 的哪张票 / 哪个实验 / 哪个 run 日志）？原文怎么记的？
   它证明的是「大 schema 丢数据」还是「某 provider 能力不足」？
3. **失败签名区分**：`empty-input`（入参空/丢失）与 `schema`（入参有、不过契约）是两种不同档。
   现有失败现场（`.scratch/p0-final-v1/runs/2026-10-22-real/`）里，哪些是 `empty-input`、哪些是
   `schema`？两者分别指向什么根因？
4. **结论**：倾向「schema 太大」还是「provider 映射」？给出证据权重，供票 06 失败后决定是否开
   「最小仓库侧修法」票。

产出：一份 research 笔记（写到 `.scratch/text-upstream-v1/research/`），在 Answer 里给结论 + 证据链接。
**零付费、零上游调用**（纯读仓库与既有日志）。

## Answer

**结论：倾向「provider 映射 / 上游转译」这一侧，不倾向「schema 太大」。**
`plan-assets` 的失败其实是**两个签名、两个根因，都不在仓库侧**：

- `empty-input`（入参空/丢失）= **上游转译层把 `tool_use.input` 丢了**（数据丢失，不是模型不写、
  也不是 schema 太大）——决定性证据是票 59 的定向探针：3 发空输入各自烧了 3,198–4,430 输出 token，
  却只回来一个 `{}`（一个 `{}` 不值三千多 token ⇒ 模型写了东西、没到达客户端）；且票 27 的
  `input={}` 发生在 **1,463 token 的 `VisualWorldSpec` 小 schema** 上 ⇒ 丢入参与 schema 大小无必然关系。
- `schema`（入参有、不过契约）= **provider 映射把 `deepseek-v4-pro` 降级成 `deepseek-flash`**
  的弱模型质量问题（票 59 第 4 发：20 个 assets 完整回来，只是母版宽高比没对上）。

关键反证：「schema 太大、模型填不动」**被推翻**——`emit_asset_recipe` 的 `toolInputSchema` 实测
**10,447 B / 深 15 层 / 顶层 7 字段 / 全树 149 个 properties**，完整请求体 ≈19.4 KB（上游记 ≈7.2k token），
属正常量级；模型在「入参没被丢」时**能填满它**。⇒ 不建议据此先开「缩小 schema」的仓库侧修法票；
首选仍是本图 Q3 已定的**切 provider**（MiniMax-M2.7 → qwen3.8-max → v4-pro/relay），把丢数据的转译层
与弱模型一起换掉。只有当多个 provider 上大 schema 都稳定失败、缩小 schema 后成功，才回到缩小 schema。

证据权重：**provider/转译丢数据（高）≈ 映射→弱模型（高）>> schema 太大（低，基本被推翻）**。

「票 27」悬空引用已定位：出处是 `game-maker-v2` 的
[票 27](../game-maker-v2/issues/27-json-via-tool-choice.md) + 探针
[`tool-choice-probe/`](../game-maker-v2/experiments/tool-choice-probe/README.md)
（`raw/01-tool-choice-r1.json`：`emit_visual_world` · 1463 in / 1135 out · `input={}` · served=deepseek-flash）。
它证明「入参在代理侧会静默丢失」，但场景是**小 schema**，不能用来支持「大 schema 丢数据」。

完整证据、字段级测量与路径见 research 笔记：
[`research/01-root-cause-evidence.md`](../research/01-root-cause-evidence.md)。

