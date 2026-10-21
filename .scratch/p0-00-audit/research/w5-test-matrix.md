# W5 测试与 fixture 代表性（票 05）

- 仓库：`/Volumes/shy/some-projects/game-maker`
- 分支 / 基线：`v2-foundation` · HEAD `ea53240`（2026-10-20 审计）
- 任务书：`docs/v4/P0-00-task-brief.md` §5 W5
- 票：`.scratch/p0-00-audit/issues/05-w5-test-matrix.md`
- 边界：只读；零付费；未改源码 / 测试 / fixture / `docs/v4/` / `map.md` / 其它票。
- 证据分级（任务书 §附录 A）：E0 推测 · E1 源码证据 · E2 测试证据 · E3 真实产物证据。
  **W5 的最高等级是 E2**；E3 属于 W6。本文没有把任何未运行的测试写成通过。

## 0. 运行记录

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `pnpm test` | 0 | **105 个测试文件全过，1640 个用例全过**（11.80s）。测试全部离线：假上游 / 本地 HTTP 桩 / 临时目录。 |
| `pnpm typecheck` | **2** | 根 `tsc -b` 通过；逐包 `tsconfig.spec.json` 在 `@game-maker/assets` 失败，**2 个测试文件类型错误**。 |

`pnpm typecheck` 的失败摘要（不涉及生产源码）：

- `packages/assets/tests/pack-sheet-grid.test.ts(150,11): error TS2322`：假 `ImageGenerator` 返回的 `call` 缺少 `requestedSize`（`ImageGenCall` 要求的字段）。
- `packages/assets/tests/prompt.test.ts(257,14): error TS2304: Cannot find name 'CharacterDNA'`。
- pnpm 报 `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @game-maker/assets@0.0.0 typecheck`、`Exit status 2`。

含义：**`pnpm test` 绿不等于 `pnpm typecheck` 绿**。Vitest 只转译、不做类型检查；上述两个测试文件在当前 HEAD 上类型不成立。W5 的矩阵不能把「测试清单」当作「类型正确」。

用 `grep` 粗计的断言风格：`toBeDefined / toBeTruthy / not.toBeUndefined / toHaveProperty` 约 51 处；`toThrow / rejects / isError / exitCode / severity: "error" / toBe(false)` 等行为型断言约 602 处。总体偏行为，但存在一类「字段存在即通过」的弱断言（见 §12）。

## 1. 判定口径

- **existing**：当前 HEAD 有直接相关测试，且断言的是目标行为（拒绝、退出码、产物落盘/不落盘、内容相等、调用次数），并已随 `pnpm test` 通过。
- **needs strengthening**：有部分直接测试，但关键入口、边界、负例或「真实产物」维度缺失；或只有形状断言。
- **missing**：没有找到测试；以源码路径 / fixture 路径作为「为什么应该存在」的 E1 证据。
- **断言类型**：
  - **行为**：断言拒绝原因、退出码、目录/文件出现或消失、字节相等、调用次数、顺序、阻断与否。
  - **形状**：只断言「能解析 / 字段在 / 键集相等 / 长度」。
  - **混合**：同一条用例两者都有。

## 2. 11 类总矩阵

| # | 类别 | 判定 | 最强证据（路径 > 用例） | 断言类型 | 等级 |
| --- | --- | --- | --- | --- | --- |
| 1 | 合法输入成功路径 | **existing** | `packages/cli/tests/cli-create.test.ts` > 「两条路的产物等价」；`packages/pipeline/tests/create-game.test.ts` > 「七项落在 `run/v1/`」 | 行为 | E2 |
| 2 | 缺失字段与非法枚举 | **existing** | `packages/contracts/tests/asset-plan.test.ts` > 「必填字段缺失 / null / 空字符串 / 错误类型都拒」 | 行为（schema 拒绝） | E2 |
| 3 | 资源路线选择与不支持路线 | **needs strengthening** | `packages/assets/tests/route-resolver.test.ts`（17 例）；缺 `frames` 路线 | 行为 | E2 / E1 |
| 4 | 上游结构合法但语义错误 | **existing** | `packages/game-design/tests/build-design.test.ts` > R12；`packages/contracts/tests/*-gate.test.ts` | 行为 | E2 |
| 5 | 参考图没有、需求要求的新实体 | **missing** | 无测试；只有 `fixtures/e2e/wasteland-platformer/README.md` 的错配 fixture | — | E1 |
| 6 | 文件存在但内容 / 尺寸 / 帧数不符 | **needs strengthening** | `packages/qa/tests/visual.test.ts` > 尺寸 / 帧数；`packages/contracts/tests/asset-spec.test.ts` | 行为 | E2 / E1 |
| 7 | 资源包成功但游戏构建失败 | **needs strengthening** | `packages/demo/tests/site.test.ts`（组件级）；无 CLI/MCP 全链 | 行为（组件） | E2 / E1 |
| 8 | 游戏可启动但关键机制不可执行 | **missing** | 无浏览器/启动测试；`qa/gameplay.ts` 明说不跑游戏 | — | E1（模拟有 E2） |
| 9 | QA 阻断时发布不误报成功 | **needs strengthening** | `packages/pipeline/tests/create-game.test.ts` > QA 硬失败；`packages/cli/tests/cli-create.test.ts` > 退出码 4 | 行为 | E2 / E1 |
| 10 | CLI / MCP 同输入关键行为一致 | **missing** | 无跨入口对照测试；源码有分歧 | — | E1 |
| 11 | 失败不消耗版本号、临时目录 / 失败产物契约 | **needs strengthening** | `packages/pipeline/tests/run.test.ts` > 「失败不消耗版本号」；`packages/assets/tests/ops.test.ts` | 行为 | E2 / E1 |

---

## 3. 类别 1：合法输入成功路径

**判定：existing。** 主链（理解段 → 包 → 配置 → QA → 站点）在 in-process 假上游下确实跑通；CLI 两段式与 `--yes` 的产物等价也有逐字节断言。

证据：

- `packages/pipeline/tests/create-game.test.ts` > `§第一段：理解 ⇒ run/v<N>/（Q1/Q2/Q3/Q13）` > 「七项落在 `run/v1/`，`characterRef` 被注入、参考图也拷了进来」— 七项产物落盘、引用注入、拷贝参考图（行为，E2）。
- 同文件 > `§第二段：构建 —— 只吃 runDir` > 「产 `pack/v1` 与 `run/v1/game-config.json`；首次 attempt 的包版本与 run 对齐」— 包与配置落盘、版本对齐（行为，E2）。
- 同文件 > `§票 61 · 玩家那条链端到端` > 「阳性：`p-body` 一件、三路齐备且各 ≥2 帧，而落盘的配置三格互不相同且都解得到」— 资源 → 配置引用链（行为，E2）。
- `packages/cli/tests/cli-create.test.ts` > `§--yes：一路跑到站点` > 「run / pack / site 都是 v1，且 `status = complete`」（行为，E2）。
- 同文件 > `§两条路的产物等价` > 「`create --yes` 与「`create` 停住 → 人看 → `build`」：同一批相对路径 + 同一份字节」（行为，E2；这是本仓最强的「两段式不漂移」证据）。
- `packages/mcp/tests/create-game-no-digest.test.ts` > 「create_game 的 content 与 structuredContent 都不出现摘要行」— 先断言 `isError` 非真、再读 `run/v1/qa-report.json`，证明 MCP 全链跑通（行为，E2）。
- `packages/assets/tests/pack.test.ts` > `组装出一个完整的包` > 「目录结构、manifest 过 schema、对账为空」「files[] 覆盖包内每一个文件」（行为，E2）。
- `packages/assets/tests/recipes-sweep.test.ts` > 「9 份手写 fixture：每一份都过契约、都出得了包」— 每一份 recipe fixture 建包 + `verify`（行为，E2）。
- `packages/demo/tests/site.test.ts` > `装配：三份数据 + 一份共用 bundle` > 「产出 index.html / shell.js / site.json / game-config.json，且 site.json 自带出处」（行为，E2）。
- `packages/assets/tests/compile-runtime.test.ts` > `编译：一次调用 → 一份落盘的配置` > 「上游给一份合法配置 → 落盘 v1，校验全过，账上是 `compile-runtime`」（行为，E2）。
- `packages/assets/tests/compile-td-game.test.ts` > `编译：一次调用 → 一份落盘的关卡` > 「上游给一份合法关卡 → 落盘 v1，且校验全过」（行为，E2）。

缺口：

- CLI 的 `site` / `compile-runtime` / `compile-td-game` / `review` **没有命令级测试**；`packages/cli/tests` 里实际调用 `run()` 的命令只有 `create`、`build`、`pack`、`plan`（`plan` 在 `cli-create.test.ts` 末段）、`verify`、`inspect`。参数解析在 `cli.test.ts`，但没有从 CLI 命令走到 core 的成功路径。
- MCP 的 `plan_assets`、`compile_runtime`、`assemble_site` **没有成功/失败用例**；`packages/mcp/tests/server.test.ts` 只调 `inspect_asset_pack`、`verify_asset_pack`、不存在的工具；`create_game` 在另一个文件里；`build_asset_pack` 只有 stdio 失败路径。见类别 10。
- 没有「同一份 fixture 依次过九个阶段」的单条 smoke 测试；当前成功路径是按阶段拆的。

## 4. 类别 2：缺失字段与非法枚举

**判定：existing。** 契约层对必填、类型、封闭枚举、`.strict()`、跨字段一致性有大量负例；CLI 对缺 flag 也有退出码 2。

证据：

- `packages/contracts/tests/asset-plan.test.ts` > 「必填字段缺失 / null / 空字符串 / 错误类型都拒（不宽松解析）」— 七种变异逐个 `parseAssetPlan(...).ok === false`（行为，E2）。
- 同文件 > 「未知 format / 版本 / route / reason / candidate 都拒」— 封闭枚举负例（行为，E2）。
- `packages/contracts/tests/recipe.test.ts` > 「资源 id 重复被拒」「版本号写错被拒」「多出的顶层字段被拒（strict）」「网格格数与给的名字数对不上被拒」「sheet 的帧名重复被拒」「动画类走导入却没给 sheet 被拒」（行为，E2）。
- `packages/contracts/tests/asset-spec.test.ts` > 「sprite 不许带动画」「animation 必须声明至少一个动画」「左右内缩之和 ≥ 宽度被拒」「上下内缩之和 ≥ 高度被拒」「层名重复被拒」「动画名重复被拒」（行为，E2）。
- `packages/contracts/tests/game-config.test.ts` > 「多一个键就拒（`.strict()`）」「非整数坐标被拒」「`kind` 拼错被拒（封闭枚举）」「`motion.kind` 拼错被拒」；`td-config.test.ts` > 「`lives` 必须 > 0」「减速系数必须严格小于 1」「`levels` 是定长 2 的元组」（行为，E2）。
- `packages/contracts/tests/game-intent.test.ts` > 「四个桶名收，第五个不收」；`game-design.test.ts` > 「`mechanics[].mechanic` 是封闭枚举」；`visual-world.test.ts` > 「六桶只收 `palette:<下标>`」「`camera.mode` 是封闭枚举」（行为，E2）。
- `packages/cli/tests/cli-create.test.ts` > 「缺 `--style` / 缺 `--intent` / `build` 缺那个 run 目录 ⇒ 都是参数错（2）」；同文件 > 「`pack --version` 不是整数 ⇒ 参数错」（行为，E2）。

缺口：

- **MCP 不校验工具必填参数**：`packages/mcp/src/server.ts` 的 `tools/call` 直接 `String(args.designPath)`；缺参数会变成字符串 `"undefined"`，而不是 CLI 那样的 usage/2。`packages/mcp/tests/server.test.ts` 没有任何缺参数用例——**no test found**。这是类别 2 与 10 的共同缺口。
- `packages/contracts/src/asset-plan.ts:13-14` 注释写「与 `AssetSource["kind"]` 同一组值；新增 source.kind 时这里必须跟着改（测试会盯）」，但 `AssetSource` 现有四值（`drawlist` / `image` / `import` / `frames`），`ASSET_PLAN_ROUTES` 仍是三值；`asset-plan.test.ts` 的「route 与 reason 的封闭枚举与 source.kind 三值一致」只比较硬编码的三值数组，**没有真的去比 `AssetSource`**，属于形状断言，抓不到漂移（E1）。

## 5. 类别 3：资源路线选择与不支持路线

**判定：needs strengthening。** 三条生产路线（image / drawlist / import）与「能力缺失不换路」覆盖很强；第四个合法 `source.kind = "frames"` 在路线决策里没有测试，且源码把它折叠成 image。

证据（existing 部分）：

- `packages/assets/tests/route-resolver.test.ts` > `resolveRoute：硬信号与顺序`：
  - 「characterId 最高：候选 drawlist 也覆盖为 image:character，participated=false」；
  - 「masterAsset > animation > background 的顺序：背景走 image:background」；
  - 「九宫格 UI 是 drawlist 硬信号：候选 image 不覆盖」；
  - 「非九宫格 UI 由候选平局」；「普通 sprite 由候选平局」（行为，E2）。
- 同文件 > `resolveRoute：import 的合格条件`：「mustReuse + accessible ⇒ import」「mustReuse 但 ref 不可访问 ⇒ ref 失败，不回退」「候选 import 不能自己触发 import：无硬信号时直接 no-route」（行为，E2）。
- 同文件 > `resolveRoute：能力缺失不换路`：「需要 image 但 image 不可用 ⇒ capability（missing=image）」等三例（行为，E2）。
- 同文件 > `确定性`：「同一归一化输入重复 20 次 route / reason / inputs / candidate / participated 完全一致」（行为，E2）。
- `packages/assets/tests/plan-sidecar.test.ts` > 「硬信号覆盖候选；sidecar 与 Recipe 逐项一致」「能力缺失：image 不可用 ⇒ usage，且不生成 sidecar」「import fixture：mustReuse + 可访问 ⇒ import」「import ref 不可访问 ⇒ invalid」「dashscope-mcp + 角色母版 ⇒ usage（参考图能力缺失）」（行为，E2）。
- `packages/assets/tests/plan-assets-player-gate.test.ts` > `负例`：「缺一路（jump）⇒ 退 4」「玩家名下两件 animation ⇒ 退 4」「`characterId` 缺席 ⇒ 退 4」「某一路只有 1 帧 ⇒ 退 4」（行为，E2）。
- `packages/assets/tests/plan-assets.test.ts` > 「设计不过 schema ⇒ invalid，且账上一笔都没有」「世界不过 schema ⇒ 同样是 invalid、同样不发」（行为，E2）。

缺口（needs strengthening）：

- **`source.kind: "frames"` 没有路线/fixture 覆盖。** `packages/contracts/src/recipe.ts` 把它列为合法源；`packages/assets/tests/pack-frames.test.ts` 只**直接喂给 `buildAssetPack`**（「2 帧 = 2 次调用；manifest 有 2 帧且分组正确」），没有经过 planner / `resolveRoute` / sidecar。
- `packages/assets/src/ops.ts:372` 把 `frames` 的候选路线写成 `"image"`；`packages/assets/src/route.ts:143-155` 的 `sourceForDecision` 只在 `source.kind === "image"` 时保留 image source，其余返回 `{ kind: "image" }`。因此按源码推断（E1，未执行验证），规划链会把 `frames` 折叠成 image。没有测试钉住这个语义；`frames` 是否应当作为一条独立路线，留给综合票裁定。
- 没有「不支持的路线」fixture：`asset-plan.test.ts` 的 `"video"` 变异是 inline 构造，没有一份可复用的负例 fixture。
- 没有针对 `frames` + 母版 / `frames` + 参考图能力缺失的测试。

## 6. 类别 4：上游模型输出结构合法但语义错误

**判定：existing。** 这是当前测试最厚的一类：契约 gate、R12 拒绝、玩家动画 gate、配置业务校验、路径派生失败、重采样分类都有行为断言。

证据：

- `packages/game-design/tests/build-design.test.ts` > `R12 ①：意图 → 设计的覆盖`：「意图里的机制在设计里没有对家 ⇒ 拒绝，报错里带着用户的原话」「意图里的实体在设计里没有对家 ⇒ 拒绝，且按 `type` 落到对的桶再找」「同一个 id 落在错的桶里不算有对家」「全都有对家 ⇒ 放行」（行为，E2）。
- 同文件 > `R12 ②：相机`：「`top-down` / `isometric` / `first-person` / `other` 都 ⇒ 拒绝」「`side` ⇒ 放行」（行为，E2）。
- `packages/game-design/tests/compile-design.test.ts` > `R12 的拒绝：不重采样、不进 failures[]`：「意图里有条机制没做成 ⇒ `DesignRejectedError`，只走一趟，账上没有失败痕迹」「空 `mechanics` ⇒ `DesignRejectedError`、逐条点名」（行为，E2）。
- `packages/contracts/tests/visual-world-gate.test.ts` > 「六桶里越界 ⇒ 拒，且 `path` 指得到那一格」「`materials.*.color` 里越界 ⇒ 同样拒」「空色板 + 任何引用 ⇒ 拒」「它同时管从磁盘上读回来的文档」（行为，E2）。
- `packages/contracts/tests/game-design-gate.test.ts` > 「必填字符串为空 ⇒ 拒」「数组元素是空串 ⇒ 拒」「`coreLoopSteps` / `player.abilities` / `player.goals` / `levels` 是空数组 ⇒ 拒」「id 跨四桶重复 ⇒ 拒」「`levels[].entities[]` 解得到 —— 悬空引用即拒」「`player.id` 与桶里某个 id 重复 ⇒ 拒」（行为，E2）。
- `packages/contracts/tests/game-intent-gate.test.ts` > 「嵌套的必填字符串同样管」「可选对象出现了但是空壳 ⇒ 拒」「id 重复 ⇒ 拒」「跨数组相撞也拒」「`entities[].id` 不许写成这一类的名字」（行为，E2）。
- `packages/assets/tests/compile-runtime.test.ts` > 「实体 id 重复 ⇒ 线形状放行（镜像没有 refine）、v3 契约判死 ⇒ 算 `schema`、重采样」；同文件 > 「模型拿世界坐标写 HUD → 抓出来」「锚点语义下 `at.y = 地面线` 不该被误报」（行为，E2）。
- `packages/assets/tests/compile-td-game.test.ts` > 「走道画得派生不出路径 → 不崩、不落一份坏关卡，而是有一条说得清的硬失败」「引用了包里不存在的资源 → ok=false，但 v1.json 还在，且消息点名到格号」（行为，E2）。
- `packages/assets/tests/text-op-ledger.test.ts` > 「线形状过了还不够：一份 `dependsOn` 有环的清单 ⇒ 由 v3 契约判死，照样算 `schema`、照样重采样」（行为，E2）。

缺口：

- 语义错误主要限于**契约能机械判定的那部分**（空值、id、枚举、引用、几何）。「角色长得不像描述」「机制存在但实际不可玩」「新实体语义与世界观不符」不在任何自动化判据里（与 W4 的结论一致；W5 只需登记）。
- `fixtures/upstream/canned.json` 只有一份**全绿**的上游应答（`visualWorld / intent / design / characterDna / gameConfig / recipe`），没有任何「结构合法、语义错误」的负例 fixture；所有负例都在测试里 inline 改字段。可复用性弱。

## 7. 类别 5：参考图没有出现、但需求要求的新实体

**判定：missing。** 没有找到一条测试断言「需求要求的新实体被生成 / 使用参考图色板 / 进入配置 / 视觉上属于同一世界」。

现有相邻证据（都**不是**这条判据）：

- `fixtures/e2e/wasteland-platformer/README.md` 明写 `style.png`（黄昏山间小站）与 `intent.md`（废土寻宝：拾荒者、废弃城市、宝箱、资源、敌人）是**有意错配**，考的正是「模型跟图还是跟文本」。这是最合适的正例 fixture，但没有测试读它来断言新实体。
- 该 fixture 只被 `packages/assets/tests/route-resolver.test.ts`、`plan-sidecar.test.ts`、`import-fixture.test.ts`、`review.test.ts` 和 `packages/pipeline/tests/review.test.ts` 使用；这些用例只验证路线、sidecar、导入和 review 的接线。
- `packages/game-design/tests/build-design.test.ts` > 「设计里**新加**意图没点名的实体 ⇒ **什么都不触发**（那是需求补全，是它的活）」——方向相反：设计层新增实体，不验证新实体的视觉实现。
- `packages/contracts/tests/intent-coverage.test.ts` > 「桶里没有它 ⇒ 一条」「同一个 id 躺在别的桶里 ⇒ 也是缺」「补一个意图没点名的实体 ⇒ 什么都不报」——只比较 intent 与 design 的 id 集合。
- `packages/vision/tests/palette.test.ts` > 「每个色真的出现在参考图里（不是加权平均出来的假色）」——只证明色板来自参考图，不证明新实体消费了它。
- `packages/qa/src/visual.ts` 文件头明确把 `style similarity` / `silhouette` / `composition` / `character consistency` 等列为**观察，不是判据**；`packages/qa/tests/visual.test.ts` > 「只声明自己那两条」只断言 `constructive-constraint` 与 `palette-binding`，没有风格相似度。
- **no test found**：没有测试从 `fixtures/e2e/wasteland-platformer` 出发，断言 recipe 含 `player-scavenger` / `chest` / `enemy` 等参考图中不存在的实体，并检查它们的 `source.kind`、palette 绑定或交付尺寸。

结论：fixture 有了（错配图 + 意图），**判据与断言没有**。这是 11 类中最明确的空白。

## 8. 类别 6：资源文件存在但内容 / 尺寸 / 帧数不符合预期

**判定：needs strengthening。** 「spec ↔ manifest / 产物」的尺寸与帧数对账很强；「磁盘上的 PNG 实际像素与 manifest / atlas 是否一致」只有 checksum（`verify`），没有像素级交叉检查；也没有真实 image/import 交付包 fixture。

证据（existing）：

- `packages/qa/tests/visual.test.ts` > 「把包里一个资产的**尺寸**改掉 ⇒ 一条 `error`，而 `target` 是那个资源的 id」（行为，E2）。
- 同文件 > 「改**清单**（spec 说要 3 帧、产物只有 2 帧）⇒ 也响」（行为，E2）。
- 同文件 > 「清单里加了一个、包里没做 ⇒ 报『没被做出来』」「创作态 drawlist 的 `viewBox` 被改坏 ⇒ 也响」（行为，E2）。
- `packages/contracts/tests/asset-spec.test.ts` > 「帧数对不上 → 报出来（spec 说 4 帧、实际 3 帧）」「尺寸对不上 → 报出来」「kind 对不上 → 报出来」「做出了没要求的动画 → 报出来」「一个像素都没画出来 → error」（行为，E2）。
- `packages/assets/tests/pack.test.ts` > 「生成器给的帧数与清单对不上 → 报出来，不静默裁剪」（行为，E2）。
- `packages/assets/tests/pack-sheet-grid.test.ts` > 「空格 ⇒ 明确失败（不静默取剩下的）」「一格里两个主体 ⇒ 明确失败」「格子带黑框 ⇒ 明确失败」「1 帧 + 1×1 网格也走按格校验」（行为，E2）。
- `packages/assets/tests/pack-ground-band.test.ts` > 「有横带 ⇒ 切出 N 帧，且交付帧里横带颜色 0 像素」「有横带但只画了 N-1 个角色 ⇒ 裁完仍不是 N 块，照样抛」（行为，E2）。
- `packages/assets/tests/pack-reuse-threshold.test.ts` > 「现场缺一帧 ⇒ 明确失败，不偷偷重发」「默认 0.6 ⇒ 多部件道具被拒」「显式 0.5 ⇒ 通过」（行为，E2）。
- `packages/assets/tests/pack-selfcheck.test.ts` > 「分层背景两层同名 ⇒ 生产函数抛，且不提交成包」「动画名重复走 `import` 那条进路：产物过不了交付侧契约」（行为，E2）。
- `packages/assets/tests/import.test.ts` > 「各帧尺寸必须一致 —— 不同尺寸无从并起，要报错」「网格超出图范围时报错，而不是静默给出裁剪过的帧」（行为，E2）。
- `packages/cli/tests/cli.test.ts` > 「篡改一个文件后 verify **必须非 0** —— 第一版这里退的是 0」（行为，E2）。

缺口（needs strengthening）：

- `packages/qa/src/visual.ts` 文件头自白：QA 包够不着 PNG 解码器，`palette-binding` 只能做 manifest 报表级对账；没有测试用「PNG 实际像素尺寸 / atlas 帧矩形」对照 manifest。
- 没有 committed 的**生成态 / 导入态**包 fixture：`fixtures/packs` 两份都是 drawlist 包（`last-train/v2`、`counter-siege/v4`）。QA、site、inspect 的真产物路径没有在 image 源包上跑过。
- 没有损坏 PNG / 截断图 / atlas 缺帧的负例 fixture；篡改都在测试里 inline 做。
- `packages/assets/tests/inspect.test.ts` 对源图尺寸与色板外像素是**观察**：用例「它是观察，不是判据 —— 报数、不打分、不阻断」明确不阻断（形状/观察，E2）；因此「文件在但内容错」在 inspect 这一层不会失败。

## 9. 类别 7：资源包成功但游戏构建失败

**判定：needs strengthening。** 装配器（pack → config → site）的校验失败有组件级测试，但没有一条从「成功的 pack」出发、经 CLI/MCP 跑到 site 失败、并检查退出码与站点版本/产物的全链用例。

证据（existing，组件级）：

- `packages/demo/tests/site.test.ts` > `硬失败：校验不过不产出站点`：「引用了包里没有的资源 → invalid，且一个目录都没写」「game-config 不过 schema → invalid」「不平铺的层给了非零视差 → 硬失败（盖不住世界）」「HUD 摆到屏幕外 → 硬失败」（行为，E2）。
- `packages/demo/tests/td-site.test.ts` > `校验不过 = 硬失败，不产出站点`：「引用解不到 → invalid，且一个目录都没写」「可通关族：数值刻度整个写反、一个敌人都没杀掉 ⇒ 硬失败，且一个目录都没写」「场地铺不满世界 → 硬失败」（行为，E2）。
- `packages/assets/tests/compile-runtime.test.ts` > 「引用了包里没有的资源 → `invalid`，而且一个字节都没落」「业务校验不过只试一次」「没有文本上游 → upstream」「不是一个资源包 → usage」（行为，E2）。
- `packages/pipeline/tests/create-game.test.ts` > 「配方完全正确也拦不住的那一档：配置三格填同一个名字 ⇒ 死在配置那一步，退 4」（行为，E2）。
- `packages/cli/tests/cli-create.test.ts` > 「判据硬失败 ⇒ 退出码 4、站点不产、报告已经落盘」——这是 QA 阻断，不是 site 构建失败，但证明了「包成功之后不让站点产出」的壳层行为（行为，E2）。

缺口：

- **no test found**：一条 `pack` 成功 → `assembleFromConfig` / `assembleSite` 抛 `invalid` → CLI 退出 4、MCP `isError`、`site/` 不出现、已产出的 `pack/` 保持可 `verify` 的组合用例。
- CLI `site` 命令没有命令级测试（见类别 1），MCP `assemble_site` 也没有。
- 没有断言「site 构建失败后下一次成功仍然落在 `site/v1`」（版本不被失败消耗，见类别 11）。
- 组件级测试的失败输入是 fixture pack + inline 坏 config；没有一份「坏的 game-config / td-config」fixture。

## 10. 类别 8：游戏可以启动但关键机制不可执行

**判定：missing。** 没有测试真正启动站点、执行输入并观察机制；现有证据分两类：纯领域模拟、外壳源码串静态见证。

- 纯领域模拟（E2，但不是「游戏启动」）：
  - `packages/demo/tests/td-sim.test.ts` > 「塔防模拟：三条写死的战斗规则」：「伤害在开火那一刻结算」「护甲平减、下限 1」「减速取最强的一份」「aoe 不索敌」；`经济与胜负`：「建塔花钱」「同一个插槽建不了第二座」「升级要花钱」「漏一个敌人掉它自己那份声望」「打完最后一波就是赢」「声望归零就是输」；`参考玩家`：「它能打赢这一关」。
  - `packages/demo/tests/td-winnable.test.ts` > 「真关卡：赢了、漏 1 ⇒ 一条都不报」「退化 = 一个敌人都没杀掉 ⇒ 硬失败」。
  - `packages/demo/tests/hazard.test.ts` > 三角波位置、边界、零/负参数。
- 静态见证（E2，但只是源码串）：
  - `packages/demo/tests/shell-capability-witness.test.ts` > 「八条能力逐条指得到外壳的一行」「`needle` 是行为串不是注释措辞」。
  - `packages/demo/tests/shell-scene-wiring.test.ts` > 「create() 里玩家先于实体创建」「advanceHazards 用纯函数返回的锚点」。
  - `packages/demo/tests/shell-hud-declared-size.test.ts` > 「四个 HUD 格子逐格指得到外壳里那一句」。
- `packages/qa/src/gameplay.ts` 文件头逐字：「不跑游戏（Playwright / headless 那一簇本图不做）」；`§三、可达性不跑游戏`——`auditReachability` 是静态 BFS。`packages/qa/tests/gameplay.test.ts` 只测引用族与可达性（「挖一条 200px 的沟 ⇒ 一条 error」）。
- **no test found**：启动 `site/v<N>/index.html`、加载 `shell.js`、注入键盘/指针输入、断言角色移动 / 跳跃 / 拾取 / 胜负的测试。仓库里没有 Playwright / Puppeteer / jsdom 依赖（`pnpm-lock.yaml` 里只有 vitest 的可选 peer 条目，未安装）。当前唯一真实启动方式在 W6（CDP 人工验证），不在测试套件内。

结论：这是**结构性缺失**，不是「测试写得不够强」。类别 8 的判定不能被 `td-sim` 的纯函数测试替代。

## 11. 类别 9：QA 发现阻断问题时，发布不会被误报成功

**判定：needs strengthening。** pipeline 与 CLI `create --yes` 的阻断链有强测试；MCP、CLI `build`、只含 warning 的边界、以及 visual 族的全链阻断缺失。

证据（existing）：

- `packages/pipeline/tests/create-game.test.ts` > `§QA 的硬失败：报告先落盘、再阻断`：
  - 「真链上响一次 ⇒ 抛 `invalid`（= 退出码 4），而报告已经在磁盘上」；
  - 「文案里带着报告路径与失败详情 —— 走异常那一路也丢不掉它」（行为，E2）。
- 同文件 > `§QA：默认跑，只有 null 关得掉`：「不给 ⇒ 跑默认的合成器 —— 而 `incomplete` 不是失败，它照样不阻断」（行为，E2）；「`qa: null` ⇒ 缺席」（行为，E2）。
- `packages/cli/tests/cli-create.test.ts` > 「判据硬失败 ⇒ 退出码 4、站点不产、报告已经落盘，而文案里有路径与详情」——同时断言 `site` 目录不存在（行为，E2）。
- `packages/qa/tests/visual.test.ts` > 「判据说『错』的时候一律 `severity: "error"` —— 降成 `warning` 就悄悄不阻断了」（行为，E2）。
- `packages/qa/tests/assemble.test.ts` > 「观察换成任意内容（包括『拿到了、有话说』），裁决一个字不变」「判据真响了（`fail`）时，观察那一栏一模一样」（行为，E2）。
- `packages/qa/tests/intent.test.ts` > 「缺项一条 error」「缺两样也是一条 finding」（行为，E2）。

缺口：

- **MCP `create_game` 没有 QA 阻断用例**：没有「`isError: true` + `_exitCode: 4` + `site/` 不出现 + 报告在盘上」的断言（`packages/mcp/tests/create-game-no-digest.test.ts` 只跑成功路径）。
- **CLI `build` 没有 QA 硬失败用例**；只有 `create --yes`。`build` 走同一个 `buildAndSite`，但没有任何测试钉住这一点。
- 全链阻断只由 `reachability`（gameplay 族）触发过；没有一条由 `constructive-constraint` / `palette-binding` / `intent-coverage` 触发 `runBuild` 抛出的用例。
- 没有「只有 warning ⇒ 构建成功、退出 0」的链级负判据；`qa/assemble.test.ts` 只证明观察不影响裁决，不证明 warning 不阻断。
- 没有断言「QA 失败后 `qa-report.json` 的 `checked` 恰好只含真跑过的族」在链级的完整映射（`qa/assemble` 有组件级断言）。

## 12. 类别 10：CLI / MCP 对同一输入的关键行为一致

**判定：missing。** 没有任何测试同时驱动 CLI 与 MCP、喂同一输入、比较关键行为。仅有的「同源」字样是 MCP 单方面的形状断言。

证据（existing 的相邻部分）：

- `packages/mcp/tests/server.test.ts` > 「inspect 返回 content + structuredContent（与 CLI 的 `--json` 同源）」——只调 MCP `handle`，断言 `structuredContent.command === "inspect"` 与 `data.packId`；**没有调用 CLI**（形状，E2）。
- `packages/mcp/tests/build-pack-stdio.test.ts` > 「机器看的那一份（`structuredContent`）：`ledger` 钉到那一笔的内容、`failureDir` 指得到地方」——真实 stdio 下的失败契约，很强；但只覆盖 `build_asset_pack`（行为，E2）。
- `packages/mcp/tests/create-game-no-digest.test.ts` 与 `packages/cli/tests/cli-create.test.ts` 使用**同一份** `fixtures/upstream/canned.json` 与同款假上游逻辑，但两份测试各写各的断言，没有任何逐字段对照（E2 证据，不构成一致性判据）。
- 该 MCP 测试文件自己有一段注释：「MCP 把 `stylePath` 原样往下传；契约要求它相对 cwd（绝对路径会被 `analyzeReference` 拒）」，测试因此手工把路径转成相对路径。CLI 的 `styleRefOf()` 会主动把 `--style` 转成相对 cwd 的路径（`packages/cli/src/cli.ts` 的 `styleRefOf`）——**同一个「绝对路径」输入，CLI 接受、MCP 拒绝**（E1，源码 + 测试注释；无对照测试）。

源码层面的关键差异（E1，均无测试）：

- **玩法分派**：CLI `buildAndSite` / `site` 用 `assembleFromConfig`（按 `format` 分派 `assembleSite` 或 `assembleTdSite`，`packages/cli/src/cli.ts:241,584`）；MCP `create_game` 与 `assemble_site` 直接调 `assembleSite`（`packages/mcp/src/server.ts:287,319`）。给 MCP 一份 `td-config/v1`，它会走横版装配器并因 `game-config` 契约失败，而 CLI `site` 会正确分派到塔防。**no test found**。
- **返回 `data` 形状**：CLI `create --yes` 的 `data` 含 `runDir / packDir / config / siteDir / entry / serveRoot / imageCalls / imageCallBreakdown / ambiguity / qa*`（`packages/cli/src/cli.ts:329-336`）；MCP `create_game` 的 `data` 只有 `status / gameId / runVersion / packVersion / ...site.data / qa*`（`packages/mcp/src/server.ts:306-309`），且 `artifacts` 没有 `run` 一项。这是同一输入下机器可读输出的实质差异（E1）。
- **HUD 行高**：CLI `compile-runtime` / `compile-td-game` / `create` / `build` 都传 `hudLineHeight: HUD_LINE_HEIGHT`（`packages/cli/src/cli.ts:237,556,571`）；MCP `compile_runtime` / `create_game` 只传 `viewport`，靠 `DEFAULT_HUD_LINE_HEIGHT`。目前两者数值同为 10（`packages/contracts/src/screen-space.ts:24`、`packages/demo/src/draw.ts:43`），所以今天不可观察，但这是「同一输入、两个来源」的结构性漂移（E1）。
- **必填参数**：CLI 在 switch 前逐命令检查 flag 并抛 `usage`；MCP 直接 `String(args.x)`，缺参数变成 `"undefined"`。没有测试（E1）。
- **检查点 / 两段式**：CLI `create` 默认停在清单，MCP `create_game` 按设计不停（文档已写明，不算 bug）；但没有测试证明「CLI `create --yes` 与 MCP `create_game` 的产物逐字节等值」，而 CLI 自己的两段式等值有测试。

结论：**missing**。至少需要一条「同一 fixture、同一假上游、CLI `create --yes` vs MCP `create_game`：产物路径 / 字节 / 机器可读字段 / 失败退出码」的对照测试；以及 MCP 的 TD 分派测试。

## 13. 类别 11：失败不消耗版本号、临时目录与失败产物契约

**判定：needs strengthening。** run / pack / CLI / MCP 的失败现场与版本不消耗有强测试；site、config staging、QA 失败后的版本状态缺失。

证据（existing）：

- `packages/pipeline/tests/run.test.ts` > `§开 → 定稿`：「`openRun` 只开临时目录、不分配版本号」「`commitRun` 一次改名到 `run/v<N>`：第一次 v1、第二次 v2」「撞名 ⇒ 原子抢：v1 被占住时，定稿落到 v2」（行为，E2）。
- 同文件 > `§放弃`：「还没定出 id 就挂 ⇒ 现场在 `out/.failed-<ts>/`（带点，不然它长得像个 gameId）」「定出 id 之后挂 ⇒ 现场在 `<gameId>/run/failed-<ts>/`」「**失败不消耗版本号**：放弃了三次，第一次成功仍然是 v1」「已定稿的运行再 `abandonRun` ⇒ 什么都不动」（行为，E2）。
- `packages/assets/tests/ops.test.ts` > 「失败的那次既不留包目录、也不吃版本号」「一笔都没成功时也不留空现场」（行为，E2）。
- `packages/assets/tests/pack.test.ts` > 「第 2 个资源挂掉 ⇒ 第 1 个的原图与逐字提示词原样还在」「同一份配方只留最近一份 —— 失败两次不堆成一部失败史」「失败时等『在飞的』收尾」「一笔都没成功就挂掉 ⇒ 不留空目录」「第 2 个资源挂 ⇒ 失败现场里有账」（行为，E2）。
- `packages/assets/tests/pack-selfcheck.test.ts` > 「分层背景两层同名 ⇒ 生产函数抛，且不提交成包；失败现场留着那份违约 manifest」「动画名重复 ⇒ 生产函数抛（退 4）、`pack/` 不出现、失败现场里那份违约 manifest 可看」（行为，E2）。
- `packages/cli/tests/cli.test.ts` > 「人看的那一行：说清在哪、以及怎么复用」「机器看的那一份：`--json` 里带着 `failureDir`」（行为，E2）。
- `packages/mcp/tests/build-pack-stdio.test.ts` > 「机器看的那一份（`structuredContent`）：`ledger` 钉到那一笔的内容、`failureDir` 指得到地方」——真实 stdio 子进程（行为，E2）。
- `packages/demo/tests/site.test.ts` / `td-site.test.ts` > 「引用了包里没有的资源 → invalid，且一个目录都没写」「绝不覆盖：装配两次就是 v1 与 v2，v1 原样还在」；`packages/cli/tests/cli-create.test.ts` > 「站点的 N 是父给的、不是它自己数的：先摆一个 `site/v9`，产物仍然落在 `site/v1`」（行为，E2）。

缺口：

- **no test found**：site 硬失败后下一次成功仍落在 `site/v1`（失败不消耗 site 版本）。`site.test.ts` 的硬失败用例之后没有检查版本号；`laySite` 只在所有校验通过后才运行（`packages/demo/src/site.ts:213` 之后），所以今天大概率成立，但没有被判据钉住。
- **no test found**：`laySite` 在拷贝 shell / 写文件中途抛错时的半成品目录处置（`packages/demo/src/layout.ts` 先 `mkdirSync(siteDir)` 再 `copyFileSync`）。没有故障注入。
- **no test found**：`runBuild` 的配置 staging（`fs.mkdtempSync(path.join(input.outRoot, ".config-"))`）在 `compileRuntime` 抛错时被 `finally rmSync` 清掉——`packages/pipeline/src/create-game.ts` 有实现，没有测试断言 `.config-*` 不残留。
- **no test found**：QA 硬失败的那次构建之后，下一次构建的 `pack/v<N>` 版本分配是什么。QA 失败时 pack 已经提交，下一次 `runBuild` 会因 `pack/v<runVersion>` 已存在而取 `nextPackVersion`（`create-game.ts` 的 `packVersion` 分支）；没有测试钉住这个跨 attempt 行为。
- `compile-td-game` 的「校验不过也照常落盘」是一条**有意的例外**：`packages/assets/tests/compile-td-game.test.ts` > 「校验不过也重采样」「重采样全失败也照常落盘最后那一份」「坏关卡照常落盘」都断言 `td-configs/v1.json` 存在（行为，E2）。它消耗版本号，因为产物是给「人过目」的。矩阵应把它登记为**契约例外**，不要与 run/pack 的「失败不消耗版本号」混为一谈。

## 14. 缺失的正例 / 负例 / 边界 fixture

### 14.1 已有 fixture（正例基线）

- `fixtures/recipes/*.json`：9 份（drawlist / image / import / mixed / master 都有），由 `recipes-sweep.test.ts` 全量建包 + verify。
- `fixtures/packs/last-train/v2`、`fixtures/packs/counter-siege/v4`：真包、真 checksum、真 drawlist（**都是 drawlist 包**）。
- `fixtures/game-configs/last-train.json`、`fixtures/td-configs/counter-siege.json`：两种玩法的真关卡。
- `fixtures/e2e/wasteland-platformer/`：`style.png`（借 `halt-dusk.png`）、`intent.md`、`visual-world.json`、`game-design.json`、`asset-recipe.json`、`character-dna.json`、`import-frame.png`、`import-recipe.json`；**没有 `game-intent.json`**。
- `fixtures/upstream/canned.json`：六份全绿的假上游应答。
- `fixtures/reference/halt-dusk.png`、`fixtures/import/wan-player-1024.png`、`fixtures/model-paint*`、`fixtures/drawlist/*`。

### 14.2 缺失的正例 fixture

| ID | 需要的正例 | 服务于 | 为什么现在没有 |
| --- | --- | --- | --- |
| P1 | 一份 `source.kind: "frames"` 的 recipe fixture（含 player 三路动画） | 类别 3 / 1 | `pack-frames.test.ts` 在内存里构造，`fixtures/recipes/` 九份没有 frames |
| P2 | 一份**真实生图 / 导入**的交付包（含 PNG、atlas、manifest） | 类别 6 / 8 | `fixtures/packs` 两份都是 drawlist；QA/site/inspect 从没在 image 源包上跑过 |
| P3 | 完整的 `wasteland-platformer` run fixture（含 `game-intent.json` 与「参考图里没有的实体」清单） | 类别 5 | 现在有 style / intent / design / recipe，缺 intent JSON 与「新实体」断言目标 |
| P4 | 塔防全链 fixture（run + pack + td-config + 期望 site） | 类别 7 / 8 | 现在只有 `td-configs/counter-siege.json` + 独立包，没有从 create/build 走出的 run |
| P5 | CLI/MCP 共用的「输入 → 期望输出」golden fixture | 类别 10 | 只有 `canned.json` 的输入侧，没有输出侧 |
| P6 | 一份 QA 硬失败但站点**已可装配**的 config fixture（不可达目标） | 类别 9 | `cli-create.test.ts` 在 fakeUpstream 里 inline 改 `gameConfig` |

### 14.3 缺失的负例 fixture

| ID | 需要的负例 | 服务于 | 现状 |
| --- | --- | --- | --- |
| N1 | 非法 / 不支持的 `source.kind`、`asset-plan` route、未知 reason code 的 fixture | 类别 2 / 3 | 全部 inline `mutate()` |
| N2 | 五类上游「结构合法、语义错误」应答 fixture（世界 / 意图 / 设计 / DNA / 配置 / 清单） | 类别 4 | `canned.json` 只有全绿；负例在测试里 inline 覆盖 |
| N3 | 损坏 / 截断 PNG、atlas 帧矩形错误、checksum 不符、帧数少一份的交付包 | 类别 6 | 没有 committed fixture；`verify` 篡改在 `cli.test.ts` inline 做 |
| N4 | 一份能通过 schema、但装配期硬失败的 game-config / td-config fixture | 类别 7 | `site.test.ts` inline 改 fixture config |
| N5 | MCP 缺必填参数的请求 fixture | 类别 2 / 10 | **完全没有** |
| N6 | 「参考图无、需求有」的意图 + 期望实体清单（用于负判据：缺了要红） | 类别 5 | **完全没有** |

### 14.4 边界 fixture / 边界用例

| ID | 边界 | 现状 |
| --- | --- | --- |
| B1 | 动画 1 帧 / 0 帧 / N-1 帧 / 多段重复名 | 部分 inline：`pack-ground-band`（N-1）、`asset-spec`（重复名）、`plan-assets-player-gate`（1 帧）；没有 fixture |
| B2 | sheet 恰好铺满 / 带 offset+spacing / 全透明格 / 1 个不透明像素 | inline 覆盖：`import.test.ts`、`sheet-grid.test.ts`、`pack-sheet-grid.test.ts` |
| B3 | 色板 0 色 / 1 色 / 重复色 / 越界引用 / 色板外像素 | 覆盖：`visual-world-gate`、`vision/palette`、`pack.test`、`inspect.test` |
| B4 | `FILLED` 恰好 0.999、世界宽 == 视口、单层背景 | 覆盖：`site.test.ts` > 「近层差一点点不满（0.998）⇒ 放行」「只有一层背景」；`layer-coverage.test.ts` > 「边界：`cover` 恰好等于视口 ⇒ 不报」 |
| B5 | run/pack/site 的版本撞名与显式版本 | 覆盖：`run.test.ts`、`cli-create.test.ts`（site v9）、`pack.test.ts`（绝不覆盖）；**pack 显式 `version` 已存在时拒绝**没有直接用例（`buildInto` 的 `renameSync` 会撞） |
| B6 | 同进程 / 多进程并发定稿 | 模拟 `renameSync` 撞名（`run.test.ts`），没有真并发进程 |
| B7 | 空数组 / 缺字段 / null 的三种区别 | 覆盖：`game-intent-gate`、`game-design-gate`、`asset-plan.test` |
| B8 | 参考图 jpg / webp / 截断 PNG / 无扩展名 | 只覆盖 jpg（`pipeline/tests/palette.test.ts` > 「jpg ⇒ usage 报错，且一次上游都不发」）；webp / 截断 PNG 没有 |
| B9 | 超大尺寸资源 / 极端宽高比 / 1×1 图 | 部分：`image-gen.test` 的尺寸换算、`import.test` 的 1×1 空图；没有交付包级用例 |

## 15. fixture / 测试可复现性风险

- `packages/cli/tests/cli.test.ts` 与 `packages/mcp/tests/server.test.ts` 会优先选**本机 `out/shift-change-assets/pack/vN`**（gitignored）里的包，只有不存在 / 契约过期时才回落到 `fixtures/packs/counter-siege/v4`。测试对象会随机器状态变化；回落后 `describe.skipIf(!hasPack)` 还可能静默跳过整组。当前 `hasPack` 为真，但这是可复现性风险（E1）。
- 十余份 assets 测试从 `.scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json` 读 `StyleSpec`，而不是从 `fixtures/`；该文件当前已被 git 跟踪（`git ls-files` 命中），所以干净检出可跑，但 fixture 的“家”不一致。
- 测试全部用假上游或本地桩；没有任何真实上游响应进入测试套件。这保证了零付费，但也意味着 **E2 不能证明真实模型行为**（W6 的职责）。

## 16. 断言「字段存在」与「断言行为」的分布

- 总体：行为型断言占多数；契约负例几乎都是 `parse(...).ok === false` / `toThrow`，属于「结构行为」。
- 弱断言集中在：
  - `packages/assets/tests/ops.test.ts`（8 处 `toBeDefined/toBeTruthy`，主要断言账/现场键存在）；
  - `packages/pipeline/tests/create-game.test.ts`（5 处，主要断言路径/报告字段存在）；
  - `packages/mcp/tests/server.test.ts` > 「inspect 返回 content + structuredContent」——只断言 `command` 与 `packId` 形状；
  - `packages/contracts/tests/asset-plan.test.ts` > 「route 与 reason 的封闭枚举与 source.kind 三值一致」——名字说一致，实际只比硬编码数组。
- 强行为断言的典型：
  - `packages/cli/tests/cli-create.test.ts` > 「两条路的产物等价：同一批相对路径 + 同一份字节」；
  - `packages/pipeline/tests/create-game.test.ts` > 「真链上响一次 ⇒ 抛 invalid，而报告已经在磁盘上」；
  - `packages/assets/tests/ops.test.ts` > 「失败的那次既不留包目录、也不吃版本号」；
  - `packages/demo/tests/site.test.ts` > 「引用了包里没有的资源 → invalid，且一个目录都没写」。

## 17. 结论要点（供综合票）

1. **强项**：契约负例、路线 resolver、pack 帧/尺寸对账、run/pack 失败现场与版本不消耗、CLI 两段式等值、QA 硬失败阻断（`create --yes`）都很扎实，且全部离线可跑（105 文件 / 1640 用例 / 退出 0）。
2. **最大空白**：
   - 类别 5：参考图缺席的新实体，没有判据也没有断言；
   - 类别 8：没有任何「启动游戏 + 执行输入」的测试，`td-sim` 只是纯函数；
   - 类别 10：没有 CLI/MCP 对照测试，且源码已存在分派 / 输出 / 参数校验差异；
   - 类别 7：没有「pack 成功 → site 失败」的全链用例；
   - 类别 3：`frames` 这第四个合法 source 没进路线决策测试。
3. **可直接补测的优先顺序**（仅建议，不属于本票实施）：类别 5 的正例 + 负例 fixture（最低成本、最高信息量）→ 类别 10 的单一对照测试 → 类别 9 的 MCP / `build` 阻断 → 类别 7 的全链 site 失败 → 类别 3 的 `frames` 路线 → 类别 6 的真实 image/import 交付包 fixture。
4. **测试环境事实**：`pnpm test` 全绿；`pnpm typecheck` **失败**（2 个测试文件类型错误）。任何「测试清单已通过」的说法必须同时注明 typecheck 未通过。

## Answer

- 11 类判定：existing 3（合法成功路径、缺失字段/非法枚举、上游语义错误）；needs strengthening 5（路线选择、文件内容/尺寸/帧数、pack 成功但构建失败、QA 阻断、失败版本/现场契约）；missing 3（参考图缺席的新实体、游戏启动后机制不可执行、CLI/MCP 一致性）。
- 证据等级：所有「existing / needs strengthening」的核心结论均为 E2（`pnpm test` 105 文件 / 1640 用例 / 退出 0，离线假上游）；所有「missing」结论为 E1（源码路径或 fixture 存在、但没有测试）；W5 不使用 E3，真实交付证据留给 W6。
- 最强证据：`packages/cli/tests/cli-create.test.ts` > 「两条路的产物等价」；`packages/pipeline/tests/create-game.test.ts` > QA 硬失败；`packages/assets/tests/ops.test.ts` > 「失败不吃版本号」；`packages/qa/tests/visual.test.ts` > 尺寸 / 帧数损坏。
- 最大缺口：类别 5（新实体无判据）、类别 8（无浏览器/启动测试）、类别 10（无 CLI/MCP 对照；MCP 不按 format 分派、返回 data 形状不同、缺参不校验）、类别 7（无全链 site 失败）、类别 3（`frames` 未覆盖）。
- 测试环境：`pnpm typecheck` 退出 2（`packages/assets/tests/pack-sheet-grid.test.ts:150` 与 `packages/assets/tests/prompt.test.ts:257`）；`pnpm test` 绿不覆盖类型正确性。
- 结论仅基于当前 HEAD `ea53240` 的源码、测试、fixture 与本地零付费运行；没有运行任何 create/build/plan/pack/compile-runtime/compile-td-game/site 真实命令，没有改 `game-maker.local.json`。
