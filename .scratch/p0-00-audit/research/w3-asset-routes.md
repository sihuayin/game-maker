# W3 资源生产路线审计（HEAD `ea53240`）

日期：2026-10-20 · 分支：`v2-foundation` · HEAD：`ea53240`
票：[`03-w3-asset-routes.md`](../issues/03-w3-asset-routes.md) · 地图：[`../../game-maker-v3/map.md`](../../game-maker-v3/map.md)
任务书：[`docs/v4/P0-00-task-brief.md` §5 W3](../../../docs/v4/P0-00-task-brief.md)

> **边界遵守**：只读审计；零付费。没有运行 `plan` / `build` / `pack` / `create` / `compile-*` / `site`
> 对真实配置，也没有触发任何上游调用。所有「执行」证据来自**既有归档产物**，或**注入假 fetch 的本地探针**
> （请求不出进程，见 §8）。未改源码 / 测试 / fixture / Schema / `docs/v4/` / `map.md` / 其他票。

---

## 1. 裁定摘要

| 编号 | 问题 | 裁定 | 证据等级 |
|---|---|---|---|
| **A-01** | `deriveRecipe` 是否仍存在 / 是否仍默认 `drawlist` | **不可复现 / 已被 v3 取代**。仓库里已无 `deriveRecipe` 函数或导出；只剩一处历史注释（`prompt.ts:563`）与文档。HEAD 的规划入口只有 `planAssets`；路线不再有任何「缺省即 `drawlist`」分支——无合法路线时硬失败。 | 不存在：**E1**；新行为：**E2** |
| **A-02** | 路线决策能否区分复杂角色、敌人、环境与道具 | **部分能**。确定性规则只认四类**硬信号**（`characterId` / `masterAsset` / `kind:animation|background` / `ui+ninePatch`）；其余全部落到模型候选平局。敌人与 NPC、复杂角色共用 `image:character`；大型非背景物件、高频小型道具没有尺寸/频率规则；NPC 没有独立规则。**能稳定分流，但不是按任务书的六类语义分类。** | **E2**（规则）+ **E3**（归档产物跨类目） |
| 路线枚举 | 合法路线是否仍为 `image` / `drawlist` / `import` | **是**（`contracts/src/asset-plan.ts:13`）。但可执行的 Recipe `source.kind` 是**四值**，多一个 `frames`（`recipe.ts:143`）；`frames` 不是 route，规划时被折叠成 `image`（见 F1）。 | **E2** |
| 非法 / 缺输入 | 是否明确失败、不静默降级 | **规划期是**：非法 kind、不可访问的 import ref、能力缺失、候选 `import` 都硬失败，且失败不落 recipe/sidecar。**一处例外**：模型若给出 `frames`，会被静默改写成 `image`，sidecar 的 `candidate` 也记为 `image`（F1）。 | **E2**（+ 合成探针） |

---

## 2. 代码地图（HEAD）

| 环节 | 位置 | 行为 |
|---|---|---|
| 规划入口 | `packages/assets/src/ops.ts:249` `planAssets` | 读设计 / 世界 → 过 Schema → 一次强制工具调用 → `parseRecipe` → 玩家动画闸 → 母版兜底 → `resolveRoute` → 写 recipe + sidecar |
| 母版兜底 | `ops.ts:364` `ensureCharacterMasters`（实现在 `planner-masters.ts:33`） | 每个带 `characterId` 的 animation 补一张本角色、同比例母版；`mustReuse` 资产跳过 |
| 路线决策调用点 | `ops.ts:370` | `resolveRoute({spec, context, capabilities, existingAssets, candidate})`；`frames` 候选在**调用前**被映射成 `image`（`ops.ts:372`） |
| 决策失败包装 | `ops.ts:374-379` | `capability` → `CommandError("usage")`；其余（`no-route` / `ref`）→ `CommandError("invalid")` |
| 参考图能力预检 | `ops.ts:380-386` | `dashscope-mcp` + 母版 / 参考图 ⇒ 规划期 `usage`，不推到 pack |
| 写回 source | `ops.ts:388` → `route.ts:143` `sourceForDecision` | route 是 `source.kind` 的唯一最终写入侧 |
| 二次验契约 | `ops.ts:391-398` | 改写后的 Recipe 再 `parseRecipe`，失败为 `invalid` |
| sidecar | `ops.ts:417-441` | `asset-plan/v1`，字段直接来自 resolver 输出；过 `parseAssetPlan` 后写 `v<N>.plan.json` |
| 能力快照 | `route.ts:121` `plannerCapabilitiesOf` | `image` = 有 image transport；`drawlist` = 恒真；`import` = `existingAssets.length > 0` |
| 纯决策函数 | `packages/assets/src/route.ts:80` `resolveRoute` | 无 I/O；顺序见 §3 |
| pack 分派 | `packages/assets/src/pack.ts:567` / `:603` / `:1018` | `drawlist` / `image|frames` / `else`（`import`）；不读 plan sidecar |
| pack 入口闸 | `ops.ts:1508-1519` | 先 `parseRecipe`（非法 ⇒ `invalid`）；`image|frames` 但无 image transport ⇒ `usage` |

**规划产物**：`<outRoot>/<recipeId>/recipes/v<N>.json` + `v<N>.plan.json`。
**执行产物**：`<outRoot>/<recipeId>/pack/v<N>/{manifest.json,delivery/,authoring/}`。

---

## 3. 路线规则（可测试的确定性顺序）

`resolveRoute`（`route.ts:80-118`）按**固定顺序**判定，命中即返回：

| 顺序 | 条件 | route | reason code | `participated` | 失败行为 |
|---|---|---|---|---|---|
| 1 | 该 id 在 `existingAssets` 中且 `mustReuse` + `accessible` + `import` 能力可用 | `import` | `import:explicit-ref` | `false` | 不可访问 ⇒ `ref`；能力缺失 ⇒ `capability`（**不换路**） |
| 2a | `spec.characterId` 是字符串 | `image` | `image:character` | `false` | `image` 不可用 ⇒ `capability` |
| 2b | `spec.masterAsset` 是字符串（且无 `characterId`） | `image` | `image:master` | `false` | 同上；`inputs.masterAsset` 记录该 id |
| 2c | `spec.kind === "animation"` | `image` | `image:animation` | `false` | 同上 |
| 2d | `spec.kind === "background"` | `image` | `image:background` | `false` | 同上 |
| 3 | `spec.kind === "ui"` 且 `ninePatch !== undefined` | `drawlist` | `drawlist:ui-ninepatch` | `false` | `drawlist` 不可用 ⇒ `capability` |
| 4 | 候选是 `image` 或 `drawlist` | 候选本身 | `image:candidate` / `drawlist:candidate` | `true` | 候选不可用 ⇒ `capability` |
| — | 其他（含候选 `import`） | — | — | — | `no-route`（`route.ts:117`） |

关键性质：

- **import 不能由候选触发**：必须有显式 `existingAssets` + `mustReuse`（`route.ts:86-92`；测试 `route-resolver.test.ts:90`「候选 import 不能自己触发 import：无硬信号时直接 no-route」）。
- **能力检查在选路之后**：选中路线不可用就失败，不换路（`route.ts:90-117`；测试 `route-resolver.test.ts:98-121`）。
- **纯函数 / 可重复**：同一归一化输入重复 20 次结果一致（`route-resolver.test.ts:144-153`）。
- **九宫格是窄口径**：只有 `kind:ui` + `ninePatch` 才是硬信号；非九宫格 UI 由候选决定（`route-resolver.test.ts:54`）。
- **没有默认路线**：`route.ts:117` 的 `no-route` 是兜底，不会回落到 `drawlist` 或任何固定值。

---

## 4. 六类样例表

> 「HEAD 规划输出」= 用仓库 fixture + **假 fetch** 在 HEAD 上跑 `planAssets`（零网络，§8 探针 1）。
> 六类都用同一份 `fixtures/e2e/wasteland-platformer/asset-recipe.json` 作模型输入，因此可直接横向比较；
> 每项的 `source.kind` 都与 sidecar 的 `route` 一致（`plan-sidecar.test.ts:50-84` 的逐项断言）。

| # | 类别 / 样例 | 输入规格（模型候选） | HEAD 规划输出 `route` | `source.kind` | reason | 执行结果 / 产物 | 测试覆盖 | 失败表现 | 等级 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **主角 + 移动动画** `player-scavenger` | `kind:animation`, `characterId:player-scavenger`, `masterAsset:master-player-scavenger`, 动画 idle 2 / run 4 / jump 2；候选 `image` | `image` | `image` | `image:character`，`inputs.masterAsset=master-player-scavenger`，`participated=false` | 真跑归档：8 帧（idle1-2 / run1-4 / jump1-2），`origin=generated`，3 张原图 → `authoring/generated/player-scavenger.{idle,run,jump}.png` | `plan-sidecar.test.ts:69-72`（候选 `drawlist` 被覆盖为 `image:character`）；`plan-assets.test.ts:269`（母版兜底） | 缺 image 能力 ⇒ `usage`，不落 sidecar（`plan-sidecar.test.ts:87-92`）；缺 `generateImage` ⇒ pack 抛「调用方的 bug，不静默跳过」（`pack.ts:607-608`） | **E3** |
| 2 | **敌人 / NPC** `enemy-wasteland` | `kind:animation`, `characterId:enemy-wasteland`, `masterAsset:master-enemy-wasteland`, patrol 4 帧；候选 `image` | `image` | `image` | `image:character`，`participated=false` | 真跑归档：4 帧，`origin=generated`，`authoring/generated/enemy-wasteland.patrol.png` | `route-resolver.test.ts:29`（characterId 最高）；`plan-sidecar.test.ts:76-84` | 同 #1 | **E3** |
| 3 | **大型环境物件** `level-downtown-ruins` | `kind:background`, 1920×540, 4 层；候选 `image` | `image` | `image` | `image:background`，`participated=false` | 真跑归档：4 层（sky / horizon / facade / ground），`origin=generated`，4 张原图 | `route-resolver.test.ts:40`（`masterAsset > animation > background`）；`plan-sidecar.test.ts:74-75` | 同 #1 | **E3** |
| 4 | **高频小型道具** `scrap-resource` | `kind:sprite`, 20×16, 无硬信号；候选 `drawlist` | `drawlist` | `drawlist` | `drawlist:candidate`，`participated=true` | 真跑归档：1 帧，`authoring/drawlist/scrap-resource.json`，进 `atlas.sprites` | `route-resolver.test.ts:61`（普通 sprite 由候选平局）；`plan-sidecar.test.ts:77-80`（`chest` 的 `image:candidate` 对照） | 候选不可用 ⇒ `capability`（`route-resolver.test.ts:98-121`）；无任何默认批次/尺寸规则 | **E3** |
| 5 | **HUD / UI** `ui-scrap-counter`（九宫格）/ `ui-scrap-icon`（非九宫格） | 前者 `kind:ui` + `ninePatch{8,8,8,8}`，96×32；后者 `kind:ui` 无 `ninePatch`，16×16；候选均 `drawlist` | `drawlist` / `drawlist` | `drawlist` / `drawlist` | `drawlist:ui-ninepatch`（`participated=false`）/ `drawlist:candidate`（`participated=true`） | 真跑归档：两张 drawlist JSON；交付图集 `atlas.ui.json` 保留 `anchor` 与 `scale9Borders{x:8,y:8,w:80,h:16}` | `route-resolver.test.ts:45`（九宫格硬信号）；`:54`（非九宫格候选平局）；`pack.test.ts:233`（ninePatch → `scale9Borders`） | 非九宫格 UI **没有**硬规则；若候选也非法 ⇒ `no-route` | **E3** |
| 6 | **已有外部资源** `chest-ruined-city`（`existingAssets`） | 同一 spec；调用方给 `{id:"chest-ruined-city", ref:"frame.png", mustReuse:true}`；模型候选 `image` | `import` | `import` | `import:explicit-ref`，`inputs.importRef=frame.png`，`participated=false`，能力快照 `import=true` | `buildAssetPack` 产出 `origin=imported`、`provenance.mode=imported`，原图落 `authoring/imported/import-demo.png`；归档零付费包中 7 个 import 资产同型 | `plan-sidecar.test.ts:94-107`（recipe/sidecar 同步）；`plan-assets.test.ts` import 用例；`import-fixture.test.ts:13`（真实 fixture 出包 + `verifyPack`）；`pack.test.ts:117/164/173` | ref 不可访问 ⇒ 规划期 `invalid`（`plan-sidecar.test.ts:109-113`），不落 sidecar；绕过规划直接 pack 缺文件 ⇒ 原始 `ENOENT`（§8 探针 3） | 路线 **E2**；执行 **E3** |

### 4.1 归档样例的补充说明

- **规划真实产物**：`.scratch/style-migration-v1/runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1/asset-recipe.plan.json`
  （19 项，`asset-plan/v1`）。该文件与同目录 `asset-recipe.json` 的 `source.kind` **逐项一致**（19/19 核对无差异），
  且 `text-calls.log` 记录同一次运行有真实文本调用。代表性条目：
  - `scavenger-actor` → `image:character`（player）
  - `wasteland-enemy` / `ceiling-lurker` → `image:character`（敌人）
  - `ruined-city-backdrop` → `image:background`；`office-debris` → `image:candidate`（大型环境物件 / 大道具）
  - `tile-floor` / `wooden-crate` → `drawlist:candidate`；`scrap-resource` → `image:animation`（模型把它做成动画，硬信号覆盖候选）
  - `hud-panel` → `drawlist:ui-ninepatch`；`scrap-icon` / `health-icon` → `drawlist:candidate`
  - `capabilities.routes.import=false`
- **执行真实产物**：`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/pack/v2/manifest.json`
  （player 8 帧、enemy 4 帧、背景 4 层、drawlist 道具、`atlas.ui.json` 的 `scale9Borders`）。
  这是已付费的归档跑（同包 `ledger.json`：17 次调用 / 430s），本次**没有**重新执行。
- **当前形态的零付费包**：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/manifest.json`
  （`ledger.json` 0 calls）。它证明 HEAD 的 pack 执行器在 `frames` / `image` / `import` / `drawlist` 四种 source 上都能出包；
  其 recipe 是抢救/手改产物（`.../2026-10-20f-lurker/asset-recipe.json`），**不能**拿来反推 `resolveRoute` 的决策。
- 归档 sidecar 的 player 项 `inputs` 为空，是 **母版兜底（`ensureCharacterMasters`）之前**的产物；
  HEAD 的母版行为以 `plan-assets.test.ts:269` 和 §8 探针 1 为准（两处都显示 `inputs.masterAsset` 已被补上）。

---

## 5. 合法路线枚举与非法输入

### 5.1 枚举

| 位置 | 值 | 说明 |
|---|---|---|
| `packages/contracts/src/asset-plan.ts:13` `ASSET_PLAN_ROUTES` | `image` / `drawlist` / `import` | sidecar 的 route 闭合枚举；`parseAssetPlan` 拒未知值 |
| `packages/contracts/src/recipe.ts:143` `AssetSource` | `drawlist` / `image` / `import` / `frames` | Recipe 可执行 source；`frames` 是**逐帧生图模式**，不是 route |
| `packages/assets/src/prompt.ts:807-810` | 只告诉模型三值 | 「策略只有三个值 … 角色 / 敌人 / 背景 / 复杂道具 → image；UI 与简单几何 → drawlist」 |
| `packages/contracts/src/recipe-tool.ts:128` | **允许 `frames`** | 工具 schema 与提示词不一致；F1 的入口 |

`asset-plan.test.ts:33-36` 钉住「route 与 reason 的封闭枚举」为三值；`asset-plan.test.ts:39-56` 钉住未知
`route` / `reason` / `candidate` 硬拒。

### 5.2 失败行为矩阵（已实测 / 有测试）

| 输入 | 结果 | 产物 | 证据 |
|---|---|---|---|
| 非法 `source.kind:"video"`（模型输出） | 工具入参不过契约；三次重采样后 `CommandError("invalid")` | **不建 recipe 目录、不落 sidecar** | §8 探针 2：`invalid: 工具入参不过契约：assets[2].source.kind: Invalid input`；目录不存在 |
| 设计 / 世界不过 Schema | `invalid`，**一次上游调用都不发** | 无 | `plan-assets.test.ts:242/252` |
| 有 `image` 信号但无 image 能力 | `usage` | 不落 `.plan.json` | `plan-sidecar.test.ts:87-92`；`route-resolver.test.ts:98-105` |
| `mustReuse` 的 ref 不可访问 | `invalid`（`failure:"ref"`） | 不落 sidecar | `plan-sidecar.test.ts:109-113`；`route-resolver.test.ts:78` |
| 候选 `import` 但无 `mustReuse` | `no-route` ⇒ `invalid` | 不落 sidecar | `route-resolver.test.ts:90-95`；实测消息见 §8 探针 4 |
| 有 import 需求但 import 能力不可用 | `capability` ⇒ `usage`，**不换路** | 不落 sidecar | `route-resolver.test.ts:115`；实测见 §8 探针 4 |
| sidecar 不过 `asset-plan/v1` | `invalid` | recipe 可能已写、sidecar 不写 | `ops.ts:437-440`（结构固定，正常不可达） |
| pack：清单不过 Schema | `invalid`（退出码 4） | 不出包 | `ops.ts:1510-1512` |
| pack：有 `image|frames` 但无生图凭据 | `usage`（退出码 2） | 不出包 | `ops.ts:1516-1519` |
| pack：`image` 资源但未注入 `generateImage` | 抛「调用方的 bug，不静默跳过」 | 不出包 | `pack.ts:607-608` |
| pack：import 文件缺失 | 原始 `ENOENT`（明确失败，但未包装） | 不出包 | §8 探针 3 |

---

## 6. 缺口与分流建议

> 下列均为**审计发现**，不修改 v3 已裁决策；「建议归属」按任务书 §6 的六类分流。

| ID | 发现 | 证据 | 影响 | 建议归属 |
|---|---|---|---|---|
| **F1** | **`frames` 被静默折叠成 `image`**：工具 schema 允许 `frames`（`recipe-tool.ts:128`），但 `ops.ts:372` 把它当 `image` 候选，`sourceForDecision`（`route.ts:154`）再把 `{kind:"frames"}` 写成 `{kind:"image"}`；sidecar 的 `candidate` 也只记 `image`，模型的原选择完全丢失。 | §8 探针 2：输入 `frames` → sidecar `candidate:"image"`、recipe `source:{kind:"image"}`。无测试覆盖 `frames` 走 `planAssets`（全仓 grep 只在 pack/contracts 测试出现）。 | 逐帧生成（一次一帧、可控帧数）会被悄悄换回「一图 N 帧」；与任务书「不得静默降级」相抵触。 | **修正**（P1）。最小修法：`planAssets` 对 `frames` 明确报 `invalid`，或把 `frames` 作为 `image` 的**参数化**保留并记录；同时对齐 tool schema / 提示词 / sidecar。不得新增 `source.kind`。 |
| **F2** | **`import` 在 CLI / MCP / create 链不可达**：三个调用点都不传 `existingAssets`（`packages/cli/src/cli.ts:516`、`packages/mcp/src/server.ts:233`、`packages/pipeline/src/create-game.ts:328`）。 | 全仓 `existingAssets` 只出现在 `ops.ts` / `route.ts` 与测试。与 v3 地图「Q4(b) 留后续」一致。 | 已有外部资源只能通过程序化 API 或手写 Recipe 使用；端到端「复用既有素材」尚未成立。 | **暂缓**（v3 明确边界），不要在 W3 补。 |
| **F3** | **类别规则粗于任务书六类**：敌人 / NPC / 复杂角色只看 `characterId`（同一 reason `image:character`）；NPC 无独立信号；大型非背景物件无尺寸规则（靠候选）；高频小型道具无批量 / 尺寸一致性规则（靠候选）。 | §3；`route-resolver.test.ts:29-65`；归档 `office-debris` 为 `image:candidate`、`tile-floor` 为 `drawlist:candidate`。 | 路线可重复，但「为什么这类资源该走这条路线」仍由模型候选承担；A-02 只能判「部分」。 | **暂缓 / 补文档**：v3 已裁定规则矩阵与「缺失则失败」；若后续要语义路由，需新开票，不在本审计内改。 |
| **F4** | **非九宫格 UI 无硬信号**：`ui-scrap-icon` 只能 `drawlist:candidate`；若模型给 `image`，resolver 会接受 `image:candidate`。 | `route.ts:106-111`；`route-resolver.test.ts:54-59`。 | HUD 小图标可能走到 `image`，与「UI → drawlist」的提示词经验不一致，但这是 v3 的窄口径裁定。 | **补测 / 暂缓**（记录现状）。 |
| **F5** | pack 不读 plan sidecar。 | `packages/assets/src/pack.ts` 无 `asset-plan` / `.plan.json` 读取；`ops.ts:417` 只写。与 v3 Q5 一致。 | sidecar 是观察/追溯记录，不参与执行；sidecar 与实际 pack 可能漂移（v7 手改 recipe 即为例）。 | **无需动作**（v3 已裁）。 |
| **F6** | import 缺文件在 pack 层是**裸 `ENOENT`**，没有「哪个资源、哪份 ref」的包装。 | `pack.ts:1025`；§8 探针 3。 | 规划期已能拦截（`ops.ts:350-356`），只有手写 Recipe / 绕过规划时可见；诊断性一般。 | **修正**（P2，低风险）。 |

---

## 7. A-01 / A-02 详细裁定

### A-01：`deriveRecipe`

- **不存在**。`grep -rn "deriveRecipe" packages` 只命中 `packages/assets/src/prompt.ts:563` 的历史注释
  （「原本是 `ops.ts` 里 `deriveRecipe` 的一段内联字符串」）与 `dist/prompt.d.ts`；没有任何函数定义、导出或调用。
- **被取代**：v2 票 12 把 `deriveRecipe` 改写成 `planAssets`；v3 现状审计已记录同一结论
  （`.scratch/game-maker-v3/issues/02-local-audit.md`「`deriveRecipe` 已不存在」）；本次复核 `ops.ts:249` 为唯一规划入口，
  CLI `plan`（`cli.ts:516`）、MCP `plan_assets`（`server.ts:233`）、`create-game`（`create-game.ts:328`）都调它。
- **「默认 drawlist」不可复现**：HEAD 没有默认路线分支；`resolveRoute` 只在三类硬信号或候选平局时返回，
  否则 `no-route` 硬失败（`route.ts:117`）。提示词里的「UI 与简单几何 → drawlist」是**经验建议**
  （`prompt.ts:810`），不是代码默认值。
- **裁定**：**不可复现 / 已被 v3 取代**。不存在需要修复的「默认 drawlist」缺陷；保留此结论即可，
  不得把历史疑虑写成 HEAD 的现缺陷。

### A-02：路线决策的区分能力

- **能区分**：角色（`characterId`）、有母版的资源、动画、背景、九宫格 UI、显式 import——这些是**确定性、可测试**的。
- **不能充分区分**：
  - 敌人 vs NPC：没有 `kind:enemy` / `kind:npc` 信号；带 `characterId` 的 NPC 与敌人得到完全相同的 reason。
  - 复杂角色 vs 普通角色：只看 `characterId` 是否存在，不看复杂度。
  - 大型环境物件 vs 小型道具：只有 `kind:background` 有硬信号；非背景的尺寸差异不影响路线。
  - 高频小型道具：没有批量、重复频率、尺寸一致性等输入，全部由候选决定。
  - HUD / UI：九宫格有硬信号；非九宫格 UI 由候选决定，可能走 `image`。
- **裁定**：A-02 **部分成立**。路线机制是确定性的、可测试的（E2），真实归档也显示跨类目分流（E3）；
  但「六类语义分类」不在 resolver 的输入里，而是**模型候选 + 四条硬信号**的混合结果。任何「能按六类智能选路」的表述都超出当前证据。

---

## 8. 本次运行记录（全部零付费）

1. **免费测试（E2）**，均为 `exit=0`：
   - `npx vitest run packages/assets/tests/route-resolver.test.ts packages/assets/tests/plan-sidecar.test.ts packages/assets/tests/import-fixture.test.ts packages/contracts/tests/asset-plan.test.ts`
     → 4 files / **28 tests passed**（`route-resolver` 17 · `asset-plan` 5 · `plan-sidecar` 5 · `import-fixture` 1）。
   - `npx vitest run packages/assets/tests/plan-assets.test.ts packages/assets/tests/pack.test.ts packages/assets/tests/pack-frames.test.ts packages/assets/tests/pack-master.test.ts`
     → 4 files / **77 tests passed**。
2. **HEAD 规划探针（假 fetch，零网络）**：`/tmp/w3-plan-probe.mjs`，用 `fixtures/e2e/wasteland-platformer` 的
   design / world / recipe，注入返回 `emit_asset_recipe` 的 `fetchImpl`，`planAssets` 写 `/tmp`。输出：
   10 个资源的 route / reason / inputs / candidate / source（§4 表）；player 与 enemy 的
   `inputs.masterAsset` 均被 `ensureCharacterMasters` 补上；第二次运行加 `existingAssets` 后
   `capabilities.routes.import=true`、`chest-ruined-city` → `import:explicit-ref` / `{kind:"import",ref:"frame.png"}`。
   **未调用任何真实上游**（transport 的 baseUrl 是 `http://fake`，fetch 是注入桩）。
3. **`frames` / 非法 kind 探针**：`/tmp/w3-frames-probe.mjs`。
   - 模型给 `player-scavenger` 的 `source:{kind:"frames"}` → sidecar `candidate:"image"`、recipe `source:{kind:"image"}`（F1）。
   - 模型给 `scrap-resource` 的 `source:{kind:"video"}` → `invalid: 工具入参不过契约：assets[2].source.kind: Invalid input`，
     `recipes/` 目录**不存在**。
4. **resolver 失败探针**：直接调 `dist` 的 `resolveRoute`，得到
   `no-route`（候选 import）、`capability`（image 不可用 / import 不可用）、`ref`（不可访问）四种失败，消息见 §5.2。
5. **import pack 探针**：`/tmp/w3-import-probe.mjs`，用 `fixtures/e2e/wasteland-platformer/import-recipe.json` 调
   `buildAssetPack`（无生图 / 无文本生成器）→ `provenance.mode="imported"`、`origin="imported"`、
   `authoring/imported/import-demo.png`、`files[]` 覆盖 5 个文件；故意把 `ref` 改成不存在的文件 → 抛 `ENOENT`（F6）。

---

## 9. 证据边界

- **没有真实上游 E2E**：零付费约束下，HEAD 行为用 fixture + 假 fetch 验证（E2）；真实规划输出来自归档（E3），
  但归档跑的时间早于 HEAD 的母版兜底（§4.1 已注明）。
- **归档 pack 的 recipe 不一定由 `resolveRoute` 产生**：v7 是抢救/手改 recipe，只能证明 **pack 执行器**；
  不能证明「该 route → 该产物」的端到端因果。路线 → source 的因果由 `plan-sidecar.test.ts` 与 §8 探针 1 证明。
- **没有新增 / 修改任何 `source.kind`**；`frames` 是 HEAD 既有值（`recipe.ts:143`），本审计只指出它在规划期的折叠。
- 所有测试命令均未读取 `game-maker.local.json`，未修改它。

---

## Answer

**A-01：`deriveRecipe` 已不存在，原疑虑不可复现，已被 v3 的 `planAssets` 取代。**
HEAD 唯一规划入口是 `planAssets`（`packages/assets/src/ops.ts:249`），CLI / MCP / create 三处都调它；
`resolveRoute`（`route.ts:80`）没有任何「默认 `drawlist`」分支——无硬信号且候选非法时 `no-route` 硬失败（`route.ts:117`）。
证据：全仓 grep 只剩 `prompt.ts:563` 历史注释（E1）；新行为有 `route-resolver.test.ts:29-121` 覆盖（E2）。

**A-02：路线决策能确定性地分流，但对任务书六类只做到「部分区分」。**
`characterId` → `image:character`、`masterAsset` → `image:master`、`kind:animation` → `image:animation`、
`kind:background` → `image:background`、`ui+ninePatch` → `drawlist:ui-ninepatch`、显式 `existingAssets+mustReuse`
→ `import:explicit-ref`；其余由模型候选在 `image` / `drawlist` 之间平局（`participated=true`）。
敌人 / NPC 没有独立信号，大型非背景物件与高频小道具没有尺寸 / 频率规则，非九宫格 UI 由候选决定。
**因此可以写「路线由可测试规则决定」，不能写「路线能按六类语义智能分类」。**

**路线枚举**：route 仍是 `image` / `drawlist` / `import`（`contracts/src/asset-plan.ts:13`，E2）；
Recipe 的 `source.kind` 多一个 `frames`（`recipe.ts:143`），但规划期会把 `frames` 静默折叠成 `image`（F1，P1 修正项）。
**失败行为**：非法 kind、不可访问 import ref、能力缺失、候选 import 都明确失败且不落 sidecar（E2）；
唯一静默降级是 F1 的 `frames → image`。

**六类样例**：player / enemy / background / small prop / UI 均有 HEAD 合成规划 + 真实归档规划与执行证据（E3）；
import 的路线决策为 E2、pack 执行为 E3（`import-fixture.test.ts`、`pack.test.ts:117-187`、v7 归档）。
