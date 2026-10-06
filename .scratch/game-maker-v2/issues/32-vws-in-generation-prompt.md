# 32. `VisualWorldSpec` 进生成提示词：六桶与 `materials` 今天零消费者

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 12](12-asset-planner.md) 的 Q2（人类裁定「**另票，不在本票接**」）。
> `docs/v2/03-claude-code.md` §15 · `02-implementation-plan.md` Phase 8。
> ⚠️ **2026-10-06 更新（票 31 关掉时）**：**「六桶与 `materials` 零消费者」这句现在只对生图那一步成立** ——
> [票 31](31-character-dna-gen.md) 的 `characterDnaPrompt` 是它们的**第一个读者**：六桶按「**颜色分工**」
> 逐桶摊开（`primary=palette:6,7,11 · accent=…`）、`materials` 按 `appearance` / `texture` / `color` 摊开，
> 供**角色基因**选色与选材质（⚠️ 那是**角色**层，产物是 `character-dna.json`）。
> ⇒ 本票的射程（**生图**提示词）与那处**不重叠**，票面其余部分**一字不动**；
> 题名里「零消费者」那半句按上面这段读。

## Question

`03 §15` 写着：**「生成 Prompt 必须结合：Original Reference Image · VisualWorldSpec · AssetSpec ·
CharacterDNA · Generation Strategy」**，并且补一句**「不要只把 VisualWorldSpec 转成文本 Prompt」**；
`02 Phase 8` 是同一张单子。而**今天 `VisualWorldSpec` 一个消费者都没有**：

- `buildAssetPack`（`pack.ts:37`）的入参里**根本没有 VWS** —— 那是个结构子集类型，只有
  `{recipe, style, referenceImage, assets}`；
- `imagePrompt(spec, style)` / `renderPrompt(spec, style)` 各只拿**两样**；
- ⇒ **六桶**（`palette.primary|secondary|accent|background|shadow|highlight`）与 **`materials`**
  在 `packages/*/src` 里**零读取** —— 而它们正是票 08 费劲长出来的东西（判据：「`palette` 是
  [[绘制词汇]]，**不是**画面分布的摘要」）。⚠️ 一个零消费者的字段正是 R7 的门要砍的东西。

### 要答

1. **接线方式**，两条路各有代价：
   - **(a)** `buildAssetPack({…, visualWorld?})` —— pipeline（票 15）手里**就有** VWS，直接传；
     **契约一个字不改**，但 `pack` 多一个可选入参，且「包内要不要带 VWS」那件事（票 15 的旧账）
     仍悬着。
   - **(b)** 配方里加一条 `visualWorldRef?`（与 `styleRef` / `characterRef` 同形）——
     自描述、可复跑，但**配方契约要动**，而且它是**唯一人工编辑点**，多一条路径就多一处能写错。
2. **接进去之后说什么**：六桶说的是「**颜色的分工**」（主色 / 强调色 / 背景色 / 阴影 / 高光），
   而生成那一步只认 `palette:N` —— 提示词里怎么把「这一笔用**强调色**」说清楚？
   `materials` 那一侧（`{appearance, texture?, color?}`）怎么进提示词？
3. ⚠️ **那几个提示词是「真跑调出来的」**：`backgroundLayerPrompt` 的注释里记着「票 51 四次真跑」
   量出来的一段话（「别去跟一段量出来的话对着写」）。往里加东西**要配自己的探针**。
4. §15 那张单子里还有 `AssetSpec` 与 `CharacterDNA` —— 它们的接线归**票 12 / 票 13**，
   **本票只管 VWS 那一样**。

## Answer

（待解）
