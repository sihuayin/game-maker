# 79. **动画名重复** —— 没有任何一条判据叫这个名字；而它今天的下场是「死在**帧名**上、且**在花完钱之后**」

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 58「层名不许重复只住在交付侧」](58-layer-name-uniqueness-one-sided.md) 的 **Q3** 与补充裁定第 4 条。
> 人裁（2026-10-14）原话逐字：
> 「**本票只处理层名重复；动画名重复另开票登记。**」
> 「动画名重复属于另一种问题：**目前创作侧与交付侧都未拦截**，应**单独登记并裁定其规则落点**；不扩大本票范围。」
> 本轮（2026-10-14）**A1 / 补充边界第 4 条**把它点成要开的一张：
> 「五个议题分别立票，保留各自边界，不合并成一张大票」·「分别处理……**动画名重复**……**每张独立裁定**」。
> ⚠️ **立票 ≠ 批准施工**（[票 65](65-layer-coverage-at-config.md) / [票 76](76-cross-stage-sample-conflict.md) 先例逐字沿用）：
> 本票面**只登记现场与落点**；加判据要**另一次独立授权**。

## Question

**票 58 抓到的那个形状（「一条规矩只住在一半」）在动画名上重演了一次 —— 而这一次连那一半都没有。**

```text
交付侧  packages/contracts/src/assetpack.ts   AssetPackEntry.superRefine  :194-234
        :197  帧名重复："…"            ✅ 有
        :214  层名重复："…"            ✅ 有（票 58 之后创作侧也有了）
        :293  资源 id 重复             ✅ 有（在 manifest 那层 :283-316）
        ❌ **动画名**：一个字都没有 —— `:201` 那个循环只校「引用的帧存不存在」

创作侧  packages/contracts/src/asset-spec.ts   AssetSpecSchema.superRefine  :162-189
        ✅ 层名重复（票 58 刚补的）· ✅ 九宫格中央区
        ❌ **动画名**：`AnimationSpec`（:68-73）与 `AnimatedSpec`（:79-82）都没有这条
```

⚠️ **一处与人裁措辞的差异（照实说，供下一轮核对）**：人裁说「创作侧与交付侧**都未拦截**」——
**前半句逐字成立，后半句成立得比它听起来轻**：交付侧**确实没有**一条叫「动画名重复」的判据，
但**它的后果会被另一条判据抓到**（见下一节）。⇒ 本票裁决时要面对的是这个形状，
而不是「一个字都没人管」的形状。

## 已经量到的（别重新量）

- **⭐ 为什么后果会被抓到（这一票最要紧的一处机制）**：帧名是**由动画名派生**的 ——
  `packages/assets/src/prompt.ts:148-155` `framePlan()` 逐字：
  `` name: `${spec.id}.${a.name}${a.frames > 1 ? i + 1 : ""}` ``
  ⇒ **两个同名动画必然产出至少一个同名帧**（两者的第一帧都叫 `<id>.<name>`），
  于是 `assetpack.ts:197` 的「帧名重复」会拒它。
  ⚠️ **而它拒的位置在花完钱之后**：那条判据是**交付侧自校验**（`packages/assets/src/pack.ts:1161`
  `const selfCheck = parseAssetPack(onDisk);`，注在 `:1154-1156` 逐字「…于是一路走到这里才被发现
  （那时钱已经花了）」）—— **与票 58 治的那个病同一条进路**。
  ⚠️ **而且报文点错了东西**：人看到的是「**帧**名重复」（`assetpack.ts:197`），
  而病根是**动画名**。⇒ 「报得出来」不等于「报得对」。
- **⚠️ 读者侧** `resolvePackRef`（`assetpack.ts:360`）：`:377` `const anim = animations.find((a) => a.name === ref.anim);`
  —— **first match wins，静默取第一个**；对照 `:395-398`（**没给 `anim` 且有多个可画的东西时**）
  它**会**拒绝并说「必须指明 anim」。⇒ ⭐ **同名动画比不同名更坏**：它**不报歧义**，
  只是悄悄解到生成器先吐出来的那一条。
- **⭐ 同名两条会拿到同一份帧表**（本 session 读出来的机制）：`pack.ts:884`
  `for (const a of spec.animations) for (let i = 0; i < a.frames; i++) stateOf.set(plan[k++]!.name, a.name);`
  · `:927-933` `animations = spec.animations.map((a) => ({ name: a.name,
  frames: frames.filter((f) => f.state === a.name).map((f) => f.name), … }))`
  ⇒ ⭐ **按状态名过滤** ⇒ 两条同名条目**筛出同一批帧** ⇒ 若真出得了包，两条动画会是**逐帧相同的两份**。
  ⚠️ **这正是票面要记的那件事**：它**不是**「一条多余」，是「**两条都变成了同一条**」。
- **对账也看不见它**：`packages/contracts/src/audit.ts:55-65` 用 `Set` 比 `declared` / `produced` 的
  `a.name`（`const want = new Set(declared.map((a) => a.name))` · `const b = produced.find((x) => x.name === a.name)`）
  ⇒ **集合去重 ⇒ 重复项对覆盖度检查是隐形的**。
- **运行时会静默取错的那几处**（都走 `resolvePackRef`）：
  `packages/demo/src/world.ts:151`（`cfg.player.anims` 那一圈）· `:138`（`e.anim`）
  · `packages/demo/src/draw.ts:148` / `:192` · `packages/contracts/src/game-config.ts:299`
  · `packages/contracts/src/td-config.ts:398` · `packages/assets/src/ops.ts:208-216`
  （`idle/run/jump` 那条要求，用的是 `only.animations.find((x) => x.name === n)`）。
- **QA 不兜它**：`packages/qa/src/visual.ts:10,14` 里的 `animation consistency` 只算**逐帧外接矩形**
  —— 它**不读动画名**。
- **磁盘上零复现**：9 份真配方 + 2 份入库包 + 全仓每一份 `manifest.json`（含 `out/`）
  的动画名**全部两两不同**（逐份比过 `length` 与 `unique` 长度）。
  ⇒ ⭐ **今天这一条是「运气不是闸」**：与票 58 立案时同款 —— 但**它比票 58 更难撞**（见下一问）。

## 要裁决的（留给下一轮 grill，此处只列边界）

1. **要不要单独立这条判据？** ⚠️ 这一问比票 58 那一问**更真**：
   后果**已经被抓到**（帧名重复那条），所以「补一条动画名判据」的增量**只有两样**：
   ① **报文点名点到病根**（现在是「帧名重复」，指错东西）；
   ② **在花费之前拒**（创作侧现在零覆盖）。
   ⇒ ⚠️ **也可能裁成「不必加」**：理由会是「帧名那条已经够了，报文改一句就行」——
   而那**又是一次施工**，且落在交付侧。**本票不预先指定**。
2. **若加，补在哪一层？** 与票 58 同一张菜单：
   - **(a) 创作侧** `AssetSpecSchema.superRefine`（票 58 刚补完层名的地方，**离它三步远**）；
   - **(b) 交付侧** `AssetPackEntry.superRefine`（与 `frames` / `layers` 那两条并排）；
   - **(c) 两处都补**（那就要回答「镜像与原件各写一份判据会不会漂移」——⚠️ 票 58 的答案是**权威只有一处**）。
3. **读者侧那条静默歧义要不要治？** `resolvePackRef:377` 的 `find` first-match-wins
   与 `:395-398` 的「必须指明」**口径不一致**。
   ⚠️ 而这一条**与上面两条不同**：它管的是**手上已经有一份同名 manifest 时怎么读**
   （可能来自人手改的包、别的来源的包），不是「怎么不产出它」。
4. **与票 58 的分工必须说清**：两票**落在同一段代码附近**（同一份 superRefine 里）
   ⇒ 免得后一张把前一张的成果收窄（票 58 的 Q3 就是这么把这格切出来的）。
5. **它的落点与[票 76](76-cross-stage-sample-conflict.md) 无关**：那一张管**跨阶段的形状冲突**，
   本票管**一份清单内部的命名唯一性**。

## 边界（人裁原话 + 本图既有约定）

- 「**本票只处理层名重复；动画名重复另开票登记。**」·「…应**单独登记并裁定其规则落点**；
  **不扩大本票范围**。」（票 58 Q3 与补充裁定第 4 条逐字）
- 「五个议题分别立票，**保留各自边界**，不合并成一张大票」·「**每张独立裁定**」（本轮 A1 逐字）
- **本票只作裁定**：不改 `assetpack.ts` / `asset-spec.ts` / `pack.ts` / `prompt.ts` 一行。
- **不升版本**（⚠️ 今天它**不是**版本问题：**没有任何一条判据**要删要改，只有「加不加」要裁）。
- **不动 R 表** · `packages/qa` 一行不碰 · `game-maker.local.json` 一个字不动 · **不执行任何付费真跑**。
- ⚠️ **与[票 78](78-reviewpack-wiring.md) / [票 80](80-hud-panel-world-ruler-removal.md) /
  [票 81](81-world-ruler-semantics-differences.md) / [票 82](82-hud-anchor-convention-ownership.md) 分开**。

## 验收（今天写得出来的部分）

- **免费证得了的**：三处「没有这条判据」是**盘上的字**（`assetpack.ts:194-234` ·
  `asset-spec.ts:162-189` · `resolvePackRef:377`），而「帧名会撞」那一步是**算出来的**
  （`framePlan` 的命名规则 + 至少两条同名 ⇒ 至少一对同名帧），**可以只读地钉住**。
- ⚠️ **免费证不了的**：模型会不会真写重复动画名 —— 那要一次真跑（**票 23**，另出报告 + 逐次明确同意）。
  今天的答案是**未知**：磁盘上零复现，**而零复现不代表写不出来**（票 58 立案时也是零复现）。
