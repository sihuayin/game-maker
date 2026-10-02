# 15. `packages/pipeline` + `createGame`：一条链串起来，产物落 `run/v<N>/`

Type: grilling
Status: open
Owner: —
Blocked by: 06, 07, 08, 09, 10, 11, 12, 13, 14
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> `docs/v2/03-claude-code.md` §25 + 依据 **R8**（Q9a）。
>
> ⚠️ **2026-10-01（[票 02](02-contract-visual-world.md)，R2-Q5）—— 包内要不要带一份 `VisualWorldSpec`，
> 归本票，别在 `pack.ts` 里补。** 票 02 只钉了 `run/v<N>/visual-world.json`（doc `02 §Phase19` 已写）；
> 而包（`pack/v<N>/`）今天只带 `authoring/stylespec.json`（`pack.ts:566`），doc 从头到尾**没说**包内要不要放 VWS。
> ⇒ 这是「链怎么落盘」的问题，不是「契约长什么样」的问题。⚠️ 包是**自描述、可复跑**的那份 ——
> 只带 stylespec 的包，重建时**拿不回类型化视图**（`VWS.camera.mode` 这类封闭枚举），
> 而 `pack.ts:580` 的 `provenance.style` 槽位也只指向 stylespec。这个权衡要在本票里表态。

## Question

`pipeline` 是**唯一**把新包串起来的地方（R11 的依赖图），也就是 §25 的 `createGame`。

### 1. 落盘形状（R8 定的，要落成具体路径）

R8：`run/v<N>/` + `pack/v<N>/` + `site/v<N>/`，**禁止覆盖**。要答的是 **`run/` 里装哪些文件、
各自叫什么**：

```text
out/<gameId>/
├── run/v<N>/
│   ├── visual-world.json        ← 票 02
│   ├── game-intent.json         ← 票 03
│   ├── game-design.json         ← 票 03
│   ├── character-dna.json       ← 票 04（可能多个角色 ⇒ 一个目录？）
│   ├── runtime-profile.json     ← 票 05
│   └── qa-report.json           ← 票 06
├── <清单落在哪？>                ← ⚠️ 今天 recipes/v<N>.json 是与 pack/ 平级的
├── pack/v<N>/                   ← 票 12 的产出
└── site/v<N>/                   ← 票 14 的产出
```

⚠️ **两个要判的**：
- **清单**今天是 `out/<id>/recipes/v<N>.json`（**与 `pack/` 平级**，且 `derive` 单独跑时也写这儿）。
  进 `run/v<N>/` 会**移动一个既有路径** —— 移还是不移？
- **`gameId` 谁给**：今天 id 由**模型**给出（`README_zh.md`：「id 由模型给出，命令会把确切路径打出来」）。
  一次 `create` 里，id 在**哪一步**才知道？（视觉那一步没有 id。）

### 2. 检查点（R9）在 `createGame` 里怎么表达

R9：人工点**只有一个**，在**清单处**，`--yes` 跳过。要答：这个「停」是
**API 层的一次返回**（`createGame` 分两段调用）还是 **CLI 层的一次循环**（`pipeline` 里没有「停」这个概念）？
⚠️ MCP 也要有这个能力（`packages/mcp`），而 MCP 是**无交互**的 —— 这决定了答案。

### 3. 失败时保住什么（承 `image-route-v1` 的三张票）

那三张票（`.scratch/image-route-v1/`）钉死的三条**在本图仍然有效**，新链不许违反：
① 失败时**改名留下工作目录**，不删；② 账**发出即记**；③ 失败时**等「在飞的」收尾**；
（另：失败的生图调用**要报重试**）。要答：`create` 跑到一半失败时，`run/v<N>/` 是**留下还是回滚**。

### 4. `createGame` 的返回（§25）

§25 的返回里有 `visualWorld, gameIntent, gameDesign, assetRecipe, assetPack,
runtimeProfile, gameConfig, qa`。要答：
- ⚠️ **它返回的是内存对象还是路径？** `CLI 只解析参数、渲染结果`（`README_zh.md`），
  而 §28 要一堆 JSON 文件 —— 两者不冲突，但**谁负责写**要说清（pipeline 写，CLI 只报路径）。
- 进度与取消：今天 `pack` 有 `--concurrency`、MCP 有 `notifications/progress`。

> ⚠️ **2026-10-02（[票 03](03-contract-intent-and-design.md) 已关）：`run/v<N>/` 的**目录清单**定了** ——
> 它就是那个被砍掉的 `GameCreationState`（本票 Q3 判**不建**那个契约，目录即容器）。
> 九项见 `docs/v2/01-contracts.md §13`：`intent.md` · `visual-world.json` · `game-intent.json` ·
> `game-design.json` · `character-dna.json` · `asset-recipe.json` · `game-config.json` ·
> `qa-report.json` · `ledger.json`。
> ⚠️ 除 `asset-recipe.json`（R9 检查点 + R10 策略都落在那里）外**一律机器产出、不许手改** ——
> 否则「禁止覆盖」的 `v<N>` 会被手工编辑悄悄毁掉。
> ⚠️ `intent.md` 存**原样字节**（裸文本则写一个 `.md`），**不做规范化** —— 否则复现的不是同一次输入。
> ⚠️ 票 02 甩过来的「**包内要不要带一份 `VisualWorldSpec`**」**仍挂在本票** —— 票 03 没有回答它。

> ⚠️ **2026-10-02（[票 04](04-contract-character-dna.md) 已关）：两条统一校验落在本票。**
> ① **引用族**：`AssetSpec.characterId` 必须命中 `run/v<N>/character-dna.json` 里某条的 `id`。
>    （配方内那条 `masterAsset → authoring[]` 已在契约的 `superRefine` 里，本票**不用**管它。）
> ② **构造性**：母版的宽高比必须与**每一个**引用它的资产的 `size` 宽高比一致（票 04 Q2/Q4）
>    —— 否则同一个角色会有两套头身比（票 22 撞过的那类坑）。
> ⚠️ 两条都**只在 pipeline 做一次** —— planner 明确不重复验（票 04 Q3）。
> 另：`run/v<N>/` 清单里的 **`character-dna.json`** 早已在票 03 的九项里；
> 它的产出方是[票 31](31-character-dna-gen.md)（不是票 13 —— 那条链的箭头被反转过）。

## Answer

（待解）
