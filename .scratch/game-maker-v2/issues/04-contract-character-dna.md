# 04. `CharacterDNA` 落盘成契约 —— 它是「跨资产同一份」，不是一次调用的中间量

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 依据 **R14**（Q16①）。母版机制**已经在跑**，缺的是契约。

## Question

`01-contracts.md` §7 给的 `CharacterDNA`：

```ts
{ id, identity, bodyProportions, silhouette, face, clothing,
  equipment[], palette[], accessories[], visualConstraints[] }
```

R14 定了：**落盘成契约**，进 `run/v<N>/`。要答的是**形状与来源**。

### 1. 它从哪来

两条路，要选（或都要）：

- **(a) 从 `VisualWorldSpec.character` 派生** —— `01-contracts.md:118-124` 里
  `character: {proportions, silhouette, poseLanguage, clothing, faceAbstraction}` 就是它的雏形。
  派生的话，DNA 是**世界语法在某个角色上的特化**。
- **(b) 由一次 LLM 调用产出** —— 从「世界 + 这个角色是谁」生成一份 DNA。

⚠️ 若走 (a)，那 `VisualWorldSpec.character` 与 `CharacterDNA` 是不是**同一件事的粗细两版**？
——**这正是票 09 删 `GameSpec` 的那条理由，要对它正面回答**。

### 2. 它和 `01 §6` 的 `AssetDependency` 怎么咬合

§6 给了 `{dependsOn[], derivedFrom?, masterAsset?, referenceAssets?}`，并画了：

```text
player-master
 ├── player-idle
 ├── player-run
 ├── player-jump
 └── player-attack
```

今天的实况（别重新量）：`ImageSource.reference`（`recipe.ts:60-65`）已经是一张**文件路径**的母版；
`fixtures/recipes/shift-change-image-anim.json:46` 已经在用；多帧是**一次调用画一行、按墨迹间隙切**
（`pack.ts:340-342,377` + `sheet.ts`）。**缺的只是契约**。

要答：`masterAsset` 是**资产 id**（新，图上一条边）还是**沿用今天的文件路径**？
若换成 id，图和边**谁来拓扑排序**（谁先造谁）？今天 `assets` 是**扁平数组、零依赖边**。

### 3. `03 §16` 那句「而不是 idle/run/jump 分别重新设计角色」

今天的**机制已经满足**这条（一次调用画一行 ⇒ 帧间一致）。要答的是：
**它是不是已经够了**，还是 DNA 契约能买到今天买不到的东西（例如**跨两个资源**的一致性：
`player` 与 `npc-trader` 是两个 AssetSpec，今天没有任何东西保证它俩像同一个世界的人）。

## Answer

（待解）
