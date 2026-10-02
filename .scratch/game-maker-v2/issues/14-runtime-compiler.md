# 14. Runtime Compiler：`GameDesignSpec` + `RuntimeProfile` + `AssetPack` → `GameConfig`

Type: grilling
Status: open
Owner: —
Blocked by: 05, 10, 07
Map: ../map.md
> `docs/v2/03-claude-code.md` §19。「不要修改 Runtime 核心代码来适应每个游戏。」

## Question

这是**唯一**写 `GameConfig` 的地方（R12 之后它还多一个职责：**用 `RuntimeProfile` 拒绝**）。

### 1. 与 `compile-game` / `compile-td-game` 的关系

今天两个编译器都是 `需求 + 资源包 → 关卡配置`，**没有** `GameDesignSpec` 输入。
R4 之后塔防**不进新链**。要答：

- `compile-game` 是**保留**（人手写关卡那条路仍然开着，`README_zh.md` 明说）**还是被取代**？
- 若保留：它和 Runtime Compiler 就是**两个**写 `game-config/v1` 的地方 —— 谁负责
  「外壳不支持 → 拒绝」这条？**两个入口必须走同一处校验**（学 `derivePackMode`）。

### 2. `RuntimeProfile` 在哪一步拒绝，代价是多少

R12 把拒绝点定在**构建期**，但**第几步**没定。承票 10 §3：越晚拒绝越贵
（晚到这一步，`AssetPack` 已经造完、**生图的钱已经花了**）。

要答：`compile-design`（票 10）时要**先读一次** `RuntimeProfile` 吗？
⚠️ 若读，那票 10 的输入就变了（要加 `RuntimeProfile`）—— 那要**回头改票 10 的 Blocked by**，
或者把「能力预检」立成**独立的一小步**（在清单之前）。**这一票要给出落点。**

### 3. 坐标与几何的既有硬规矩（一条都不许松）

`CONTEXT.md:230` · `:250-257`：`GameConfig` 的坐标一律是**交付态像素、1:1、整数**；
HUD 活在**屏幕空间**（上限是**视口**不是 `world.size`）；纯文字那些**右边界保证不了**。
`CONTEXT.md:274-277` 的**砖**三条（尺寸精确等于 `arena.cell` · 锚点正中 · 是 sprite/animation）。
**票 09 那条明令：禁止 `scale`。**

要答：这些**今天在 `compile-game` 里**的检查，搬到 Runtime Compiler 之后走**同一份**实现
（不是抄一份）。

### 4. 第一阶段只出 `platformer/v1`

R4。要答：`RuntimeProfile` 有**两个成员**（横版 + 塔防）而只有一个是新链的 ——
这个不对称在代码里怎么表达，才不会让下一个加玩法的人以为要改 `GameConfig` 的形状。

> ✅ **2026-10-02（[票 05](05-contract-runtime-profile.md) 已关）：这一问已被答掉，不再是开放问题。**
> ① profile 与 `format` **正交**（Q3(b)）—— `format` 说「这份数据怎么读」，profile 说「这一代外壳会做什么」，
> 两者**不是**同一根轴上的两个名字，所以加一个 profile 成员**不必**动 `GameConfig` 的形状。
> ② 族的容器已经在了：`RUNTIME_PROFILES` 注册表 + `resolveRuntimeProfile({id, version})`
> （`packages/contracts/src/runtime-profile.ts`）。今天**一个成员**，塔防那一代**不进新链**（R4）。
> ③ 你要做的是**解析引用**：`GameDesignSpec.game.runtimeProfile` 解析不动 ⇒ `undefined` ⇒
> 那就是「说不出是哪一代的能力」的拒绝素材。
> ⇒ 本节剩下的只有你自己那道题：**在哪一刻拒绝**（§2），以及两个入口怎么走同一处校验（§1）。

## Answer

（待解）
