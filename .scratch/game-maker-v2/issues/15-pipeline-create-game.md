# 15. `packages/pipeline` + `createGame`：一条链串起来，产物落 `run/v<N>/`

Type: grilling
Status: open
Owner: —
Blocked by: 06, 07, 08, 09, 10, 11, 12, 13, 14
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> `docs/v2/03-claude-code.md` §25 + 依据 **R8**（Q9a）。

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

## Answer

（待解）
