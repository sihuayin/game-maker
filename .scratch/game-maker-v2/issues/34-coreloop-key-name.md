# 34. `coreLoop` 这个**键名**让模型 12/12 吐字符串 —— 契约怎么收口

Type: grilling
Status: resolved
Owner: claude (2026-10-09)
Blocked by: —
Map: ../map.md

> ✅ **2026-10-09 · 本票已关。** 裁定在 §1（两个契约**同时**改名 `coreLoopSteps`），
> 落地与判据在 §2，**这一票最要紧的一行**是 §4（「改了几个」不等于「改对了」）。
> 下面整块（含 `## Question`）是**票面的原始前提**，留着当现场。
> ⚠️ 新增的量：`.scratch/game-maker-v2/experiments/e2e-wasteland/` 里的
> `intent-after-rename-probe.mjs`（真调用）与 `prior-locus-probe.mjs` · `singular-array-inventory.mjs`（两个探针）。
> 派生自[票 23「E2E fixture + 真跑一次」](23-e2e-fixture-wasteland.md) 的真跑（2026-10-09）。
> ⚠️ **它今天挡着整条链的第 2 步**：`game-maker create` 在 `analyze-intent` 上三发全 `schema`、退 4。
> 原始往返留在 `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/`（`intent-raw/` · `coreloop/` · `coreloop-name/`），
> 三支探针脚本与它们同目录。

## Question

### 现象

`create` 的理解段死在第二发调用上，**两次真跑、同一种死法**：
[票 16「CLI `create`」](16-cli-create.md) 的 E2E 记的是 `failures: ["schema","schema","empty-input"]`（2026-10-08），
[票 23](23-e2e-fixture-wasteland.md) 今天重跑记的是 `["schema","schema","schema"]`，
文案逐字：

```text
重采样 3 次都没有拿到一份过契约的 GameIntentSpec（最后一次：schema）。
最后一次的病因：工具入参不过契约：coreLoop: Invalid input: expected array, received string
```

### 量到的（`raw/` 里每一发都是真往返）

**① 工具 schema 是对的，`tool_choice` 也是强制的。**
上游收到的 `coreLoop` 写的是 `{"type":"array","items":{"type":"string"}}`，
在 `required` 里，顶层 `additionalProperties: false`，`tool_choice: {type:"tool",name:"emit_game_intent"}`。

**② 模型 12/12 把 `coreLoop` 吐成字符串 —— 而同一次响应里别的数组全对。**

| 键 | 在 12 次响应里的类型 |
|---|---|
| `coreLoop` | **`string` 12/12** |
| `winConditions` · `loseConditions` · `ambiguity` · `entities` | `list` 12/12 |
| `mechanics` | `list` 11/12 · `dict` 1 |
| `player.goals` | `list`（嵌在 `player` 里） |

⇒ **不是「模型不会用数组」**。它同一发里用得好好的。

**③ 提示词那句不是杠杆（n=3/臂，9 发）。** 把骨架里 `coreLoop` 那句改掉再发：

| 臂 | `coreLoop` 的形状 |
|---|---|
| 现状：「核心循环，**一条一句**，**至少一条**」 | `string` 3/3 |
| 「核心循环，**一个字符串数组**，每个元素一句话，**至少一条**」 | `string` 3/3 |
| 「…**至少一条**（这是一个**数组**）」 | `string` 3/3 |

**④ 键名才是（n=3/臂，12 发）：**

| 键名 | 形状 |
|---|---|
| `coreLoop` | `string` 3/3 |
| `coreLoops` | `string` 3/3 |
| `coreLoopSteps` | **`array` 3/3** |
| `zorbixList`（生造词） | **`array` 3/3** |

**⑤ 把它改名后吐出来的东西，就是契约要的东西。**
`coreLoopSteps` 那三发把键名换回 `coreLoop` 再喂**真的** `GameIntentSpecSchema` ⇒ **3/3 过契约**，内容是干净的循环步骤：

```json
["在废弃城市中横向探索不同区域","跳跃越过地形障碍前进","搜寻并拾取资源",
 "发现并打开宝箱获取宝物","躲避或应对危险与敌人","带着收获推进到最终目标"]
```

⇒ **理解层的第 2 步离绿只差一个键名。**

### ⚠️ 它不是孤例：`coreLoop` 在设计层还有一份

`packages/contracts/src/game-design.ts` 里**同样**有 `coreLoop`（设计与意图两层 13 处重名之一，
是[票 19「Intent QA 的判据」](19-qa-intent-coverage.md) 集合差的前提）。
⇒ **就算把意图那层治好，第 3 步 `compile-design` 会原样再撞一次。**

### 这一票要答的

1. **契约怎么收口** —— 改名（改成什么）· 换形状 · 还是接受字符串再由装配归一？
   ⚠️ 这是[票 03「`GameIntentSpec` + `GameDesignSpec` 落地」](03-contract-intent-and-design.md) 的决定，
   动它要按本图的规矩重新开票（就是本票）。
2. **这是上游的性质，还是我们要长期共存的约束？**
   服务端自报 `servedModel=deepseek-flash`（请求的是 `deepseek-v4-pro`），
   而[票 25「代理到底支不支持结构化输出 / 视觉输入」](25-prototype-structured-output.md) 已经记过
   「**代理的上游配置一直在变**」⇒ 若这是某个上游的实现怪癖，改名是**对症**；若这是模型对
   常见标识符的**先验**（`coreLoop` 在游戏设计语料里几乎总是一句话），那就是**一条通用纪律**：
   **键名不得与强先验撞车**，而它得有判据看着。
3. **泛化：一次量完还是只治已知的？**
   仓库里还有一批**单数名的数组字段**（`visual-world.ts` 的 `identity` / `shapeLanguage` / `material` /
   `environment` / `characterStyle`，`game-config.ts` 的 `terrain`，`recipe.ts` 的 `authoring`，
   `qa.ts` 的 `checked`，`asset-spec.ts` 的 `dependsOn` …）。
   ⚠️ 已知 `VisualWorldSpec` 那一批**今天没出事**（票 23 的真跑里 `analyze-reference` 过了），
   但那是**一次**读数，不是保证。

⚠️ **本票不碰**：`analyze-intent` 的重采样次数（3 是[票 27「严格 JSON 改用 tool_choice 吗」](27-json-via-tool-choice.md) 定的地板值）
与 `empty-input` 那一档（[票 09「`analyze-intent.ts`」](09-intent-analyzer.md) 已记过）。

## Answer

### 1. 裁定：**两个契约同时改名 `coreLoop` → `coreLoopSteps`**

不改形状（它本来就是 `z.array(z.string())`）、不做装配归一、不换别的名字。

**为什么是「同时」**：`coreLoop` 在设计层还**有一份**（`game-design.ts`）。只治意图层，第 3 步
`compile-design` 会**原样再撞一次** —— 那不是两次故障，是**同一个键名**在两个契约里各犯一次。
所以两处一起改（票面 §⚠️ 那条点的就是这个）。

**为什么是 `coreLoopSteps` 而不是 `coreLoops`**：票面 ④ 的对照组已经否掉了纯复数
（`coreLoops` 3/3 仍是字符串），而描述性的 `coreLoopSteps` 3/3 是数组。选**描述性**的那个。

⚠️ **这是[票 03](03-contract-intent-and-design.md) 那条决定的修订，按本图规矩由本票承载**（R17）——
所以「原名 `coreLoop`」这件事**不抹掉**，只按 [票 02](02-contract-visual-world.md) 那次
（`references.styleImages` → `styleReferences`）的老办法**加一条带日期的注**：
`docs/v2/01-contracts.md` §3/§4 两处**声明**、`CONTEXT.md` 各一处。
⚠️ **R 表不需要注** —— 我核过了，**R 表一行都没点过这个字段名**（那次 R15 要注，是因为 R15 自己写着那个名字）。

### 2. 落地：动的就是这些

**活代码 / 测试 / fixture（28 份文件）**：
`packages/contracts/src/{game-intent,game-design,index,intent-coverage,qa}.ts` ·
`packages/contracts/tests/`（7 份）· `packages/game-design/src/prompts.ts` ·
`packages/game-design/tests/`（4 份）· `packages/qa/{src,tests}/intent*.ts` ·
`packages/assets/src/prompt.ts` + `packages/assets/tests/`（3 份）· `fixtures/upstream/canned.json`。

⚠️ **一个字都没动的**（不是漏了，是故意的）：
- **`docs/文档.md`** —— 那是 **V1.0 的规格**（`GAME_CREATION_RUNTIME_V1`），它描述的 `GameSpec`
  **早就被删了**（`packages/contracts/src/index.ts:41` 留着这话）。**改它等于篡改 v1 的记录。**
- **`.scratch/**`** —— 票与探针的 `raw/` 是**量出来的现场**，不是文档。**改写原始输出就是伪造证据。**

### 3. 判据

| 判据 | 结果 |
|---|---|
| `pnpm typecheck` | ✅ 绿（9 个包） |
| `pnpm test` | ✅ **1138/1138** · 67 份文件 |
| `pnpm check:deps` | ✅ 依赖图合法（9 个包） |
| `pnpm check:links` | ✅ 零断裂（149 份文档 · 852 条链接） |
| **半路漂回去会不会红** | ✅ **会** —— 契约改回 `coreLoop` 而 `FIELD_HINTS` 还是 `coreLoopSteps` ⇒ `tsc` 报 4 条错。**两边一起改漏一个就编译不过**，靠的是 `FIELD_HINTS: Record<keyof GameIntentSpec, string>`，不是人盯 |
| **真调用** | ✅ **见 §4** |

⚠️ **`tsc -b` 必须 `--force`**：本票自己在这上面栽过一次（见 §5），所以收尾一律
`npx tsc -b --force`，不用增量。

### 4. ⚠️ 最要紧的一行：**改名之后，真的调用过了吗**

「测试全绿」**证明不了这一票** —— 上游那 12/12 是一次**真往返**量出来的，改完必须再用**真往返**验一次。
`intent-after-rename-probe.mjs` 走的是**出厂的那份 `analyzeIntent`**（`packages/game-design/dist/`，
与 CLI 消费的是同一份），输入是 fixture 的 `intent.md` **逐字节**，运输层是**真上游**：

```text
✅ 过契约（3444ms）   attempts: 1   failures: []
   coreLoopSteps = ["在废弃城市中横向探索前进","寻找资源与宝箱","拾取资源","躲避危险与敌人","朝最终目标推进"]
   形状：array · 5 条
```

上游原文（`raw/after-rename/01.response.json`）逐项对过：`stop_reason: tool_use` ·
模型**自己**吐的键就是 `coreLoopSteps` · **没有**多冒出一个 `coreLoop` · 发出去的 schema 里
那个键也是 `coreLoopSteps` 且在 `required` 里。

⇒ **第 2 步从「三发全 `schema`、退 4」变成「首发就过」。**

### 5. 病因：**先验挂在键名上**，而且比票面写的更刁

票面 ④ 说「换键名就好了」。本票补了一次**交叉**（`prior-locus-probe.mjs`，n=3/臂）——
起因是我自己漏了 rebuild，意外发出了一发「schema 是 `coreLoop`、提示词那张字段表是 `coreLoopSteps`」的**混合态**，
而它**吐了数组**：

| 臂 | 工具 schema 的键 | 提示词那张表的键 | 结果 |
|---|---|---|---|
| 混合 A | `coreLoop` | `coreLoopSteps` | **array 3/3**（键按 schema 回 `coreLoop`） |
| 原状 B | `coreLoop` | `coreLoop` | `string` 1/1（另 2 发是 `empty-input` 白烧，不是形状证据） |
| 混合 C | `coreLoopSteps` | `coreLoop` | **array 3/3**（键按 schema 回 `coreLoopSteps`） |

⇒ **只有两边都是 `coreLoop` 时才发作。** 任一边换掉，模型就回到数组。
⚠️ 机制是**假说**（n=3/臂、`empty-input` 在吃发数），本票**没定死它**。

⚠️ **而这枚证据落不了地**：提示词那张表是 `Record<keyof GameIntentSpec, string>`，
**它和 schema 的键名结构上永远一致、不可能分歧** ⇒ 「只改提示词不改 schema」这条捷径
在出厂代码里**根本走不通**。能动的杠杆**只有「两边一起改」**，也就是 §1 做的这件事。
⇒ 结论不受假说成立与否影响。

### 6. 泛化：**一次量过，结论是「别的都不动」**

人类给的规矩是「**只有有实验证据才改**」，所以先**量**再定。`singular-array-inventory.mjs` 两步：

① **候选从契约里现扫**（别硬编码名单）：递归走 `toJSONSchema`，「类型是 array、键名不是复数」
⇒ **17 个**：`GameIntentSpec.ambiguity` · `CharacterDNA.{gear,palette}` · `QAReport.checked` ·
`VisualWorldSpec.shapeLanguage` 与 `style.{identity,palette,shapeLanguage,material,environment,characterStyle}` ·
`palette.{primary,secondary,accent,background,shadow,highlight}`。

② **拿仓库里已有的真输出数形状** —— 12 个 `raw/` 目录、106 份真往返 JSON，**零新调用、零花钱**：

| | 数 |
|---|---|
| 有真输出覆盖的候选 | **14 / 17** |
| **形状出过错的** | **0** |
| 从没被覆盖过的 | 3 —— `CharacterDNA.{gear,palette}`（DNA 的入参是 `{characters:[…]}`，本脚本的路径模型没走到 ⇒ 记成**没覆盖**，**不是**「过了」）· `QAReport.checked`（**机器装配的**，根本没有模型先验可言） |

⇒ **一个都不改。** `coreLoop` 是**孤例**，不是一类毛病的第一例。
⚠️ 「零错」是**已覆盖的那些**读出来的 —— 它**不是保证**，只是「没有证据支持改动」。

### 7. 顺带（不在本票的问题里，但本票撞上了）

- ⚠️ **`packages/pipeline/tests/create-game.test.ts:353` 的 `tsc` 错是`9d7e9d9`（票 20）带进来的、
  与本票无关** —— 我用 `git stash` 复现过：**把本票的改动全撤掉，它照样红**。
  `pnpm typecheck` 因此**今天一整天是红的**。已修（转型挪到 `.catch` **外面**，
  否则 `BuildResult | Error` 上取 `.message` 就是 TS2339）。⚠️ **修它不是本票的决定，是它挡着本票的判据。**
- ⚠️ **`改 src 不 rebuild 等于没改` 这条老坑，本票自己又踩了一次**：第一次跑
  `intent-after-rename-probe.mjs` 时 `contracts/dist` 还是**变异实验留下的旧货**
  （schema 说 `coreLoop`、提示词已说 `coreLoopSteps`）⇒ 探针报的「✅ 过契约」其实是**混合态**的结果。
  **差点拿它当证据。**重建（`--force`）后才是 §4 那一发。
- **`empty-input` 仍在吃发数**：今天各探针合计约 **3/16**（≈19%）。本票按票面**不碰**它（归
  [票 09](09-intent-analyzer.md) 那一档），只记一笔。

### 8. 播下的

- 🔓 **[票 23「E2E fixture + 真跑一次」](23-e2e-fixture-wasteland.md) 的前置解除** —— 它挂着的
  `34` 已关，第 2 步不再是墙。⚠️ 但**本票没替它跑**：那一票要的是**从 fixture 一路到站点**，
  本票只验到第 2 步。
- ⚠️ 地图的 **R 表要加一条带日期的注**（`coreLoop` → `coreLoopSteps`），照 R15 那次的老办法。
