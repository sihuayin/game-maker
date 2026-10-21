# P0-00 测试与 fixture 覆盖矩阵

| 属性 | 内容 |
|---|---|
| 审计基线 | `v2-foundation` · `ea53240`（2026-10-20） |
| 当前 HEAD（写作时） | `7aa98d7` |
| 证据来源 | [W5 调研](../../.scratch/p0-00-audit/research/w5-test-matrix.md) |
| 相关交付物 | [能力差距表](P0-00-capability-gap-audit.md) · [调用链](P0-00-call-graph.md) · [E2E 证据](P0-00-e2e-evidence.md) · [P0 范围](P0-00-p0-scope.md) |
| 证据等级 | W5 最高 E2；E3 归 [E2E 证据](P0-00-e2e-evidence.md) |

## 0. 运行记录与基线漂移

### 0.1 基线 `ea53240`

| 命令 | 退出码 | 结果 |
|---|---|---|
| `pnpm test` | 0 | **105 个测试文件 / 1640 个用例全过**（11.80s）；全部离线（假上游 / 本地 HTTP 桩 / 临时目录） |
| `pnpm typecheck` | **2** | 根 `tsc -b` 通过；`@game-maker/assets` 的 `tsconfig.spec.json` 失败：`pack-sheet-grid.test.ts:150` 缺 `requestedSize`；`prompt.test.ts:257` 找不到 `CharacterDNA` |

含义：**`pnpm test` 绿不等于 `pnpm typecheck` 绿**。Vitest 只转译、不做类型检查。

### 0.2 当前 HEAD `7aa98d7`

| 命令 | 退出码 | 结果 |
|---|---|---|
| `pnpm test` | 0 | **110 个测试文件 / 1731 个用例全过**（24.27s） |
| `pnpm typecheck` | 0 | 9 个 workspace 项目全部 Done |

`7aa98d7` 的 Phase 1 Tier 1 施工票 01 修复了上述两处测试类型错误；同时新增了
`accept` 的契约 / 指标 / 验收器 / CLI / MCP / baseline 回归测试（约 36 个新用例）。
**本文除特别注明外，判定与证据仍针对 `ea53240`**；`7aa98d7` 只改变「typecheck 已绿」与测试数量。

## 1. 判定口径

- **existing**：基线 HEAD 有直接相关测试，且断言目标行为（拒绝、退出码、产物落盘/不落盘、内容相等、调用次数），
  并随 `pnpm test` 通过。
- **needs strengthening**：有部分直接测试，但关键入口、边界、负例或真实产物维度缺失；或只有形状断言。
- **missing**：没有找到测试；以源码路径 / fixture 路径作为「为什么应该存在」的 E1 证据。
- **断言类型**：**行为**（拒绝原因、退出码、目录/文件出现或消失、字节相等、调用次数、顺序、阻断与否）；
  **形状**（只断言能解析 / 字段在 / 键集相等 / 长度）；**混合**。

## 2. 11 类总矩阵

| # | 类别 | 判定 | 最强证据（路径 > 用例） | 断言类型 | 等级 |
|---|---|---|---|---|---|
| 1 | 合法输入成功路径 | **existing** | `packages/cli/tests/cli-create.test.ts` > 「两条路的产物等价」；`packages/pipeline/tests/create-game.test.ts` > 「七项落在 `run/v1/`」 | 行为 | E2 |
| 2 | 缺失字段与非法枚举 | **existing** | `packages/contracts/tests/asset-plan.test.ts` > 「必填字段缺失 / null / 空字符串 / 错误类型都拒」 | 行为（schema 拒绝） | E2 |
| 3 | 资源路线选择与不支持路线 | **needs strengthening** | `packages/assets/tests/route-resolver.test.ts`（17 例）；缺 `frames` 路线 | 行为 | E2 / E1 |
| 4 | 上游结构合法但语义错误 | **existing** | `packages/game-design/tests/build-design.test.ts` > R12；`packages/contracts/tests/*-gate.test.ts` | 行为 | E2 |
| 5 | 参考图没有、需求要求的新实体 | **missing** | 无测试；只有 `fixtures/e2e/wasteland-platformer/README.md` 的错配 fixture | — | E1 |
| 6 | 文件存在但内容 / 尺寸 / 帧数不符 | **needs strengthening** | `packages/qa/tests/visual.test.ts` > 尺寸 / 帧数；`packages/contracts/tests/asset-spec.test.ts` | 行为 | E2 / E1 |
| 7 | 资源包成功但游戏构建失败 | **needs strengthening** | `packages/demo/tests/site.test.ts`（组件级）；无 CLI/MCP 全链 | 行为（组件） | E2 / E1 |
| 8 | 游戏可以启动但关键机制不可执行 | **missing** | 无浏览器/启动测试；`qa/gameplay.ts` 明说不跑游戏 | — | E1（`td-sim` 有 E2） |
| 9 | QA 阻断时发布不误报成功 | **needs strengthening** | `create-game.test.ts` > QA 硬失败；`cli-create.test.ts` > 退出码 4 | 行为 | E2 / E1 |
| 10 | CLI / MCP 同输入关键行为一致 | **missing** | 无跨入口对照测试；源码有分歧 | — | E1 |
| 11 | 失败不消耗版本号、临时目录 / 失败产物契约 | **needs strengthening** | `packages/pipeline/tests/run.test.ts` > 「失败不消耗版本号」；`packages/assets/tests/ops.test.ts` | 行为 | E2 / E1 |

## 3. 类别 1：合法输入成功路径（existing）

主链（理解段 → 包 → 配置 → QA → 站点）在 in-process 假上游下确实跑通；CLI 两段式与 `--yes`
的产物等价也有逐字节断言。

证据：

- `create-game.test.ts` > 「七项落在 `run/v1/`，`characterRef` 被注入、参考图也拷了进来」。
- 同文件 > 「产 `pack/v1` 与 `run/v1/game-config.json`；首次 attempt 的包版本与 run 对齐」。
- 同文件 > 「玩家那条链端到端」：`p-body` 一件、三路齐备且各 ≥2 帧，配置三格互不相同且都解得到。
- `cli-create.test.ts` > 「run / pack / site 都是 v1，且 `status = complete`」。
- 同文件 > 「两条路的产物等价」：`create --yes` 与「`create` 停住 → `build`」同一批相对路径 + 同一份字节
  （本仓最强的「两段式不漂移」证据）。
- `packages/mcp/tests/create-game-no-digest.test.ts` > `create_game` 全链跑通，`qa-report.json` 存在。
- `packages/assets/tests/pack.test.ts` > 「目录结构、manifest 过 schema、对账为空」「`files[]` 覆盖包内每一个文件」。
- `packages/assets/tests/recipes-sweep.test.ts` > 「9 份手写 fixture：每一份都过契约、都出得了包」。
- `packages/demo/tests/site.test.ts` > 「产出 `index.html` / `shell.js` / `site.json` / `game-config.json`，
  且 `site.json` 自带出处」。
- `compile-runtime.test.ts` / `compile-td-game.test.ts` > 上游给合法产物 → 落盘 v1、校验全过。

缺口（分流见能力差距表）：

- CLI 的 `site` / `compile-runtime` / `compile-td-game` / `review` **没有命令级测试**；
  `cli-create.test.ts` 实际调用 `run()` 的命令只有 `create`、`build`、`pack`、`plan`、`verify`、`inspect`。
- MCP 的 `plan_assets`、`compile_runtime`、`assemble_site` **没有成功/失败用例**；
  `server.test.ts` 只调 `inspect_asset_pack`、`verify_asset_pack` 和不存在的工具；
  `build_asset_pack` 只有 stdio 失败路径。
- 没有「同一份 fixture 依次过九个阶段」的单条 smoke 测试；当前成功路径按阶段拆开。

## 4. 类别 2：缺失字段与非法枚举（existing）

契约层对必填、类型、封闭枚举、`.strict()`、跨字段一致性有大量负例；CLI 对缺 flag 也有退出码 2。

证据：

- `asset-plan.test.ts` > 「必填字段缺失 / null / 空字符串 / 错误类型都拒」；「未知 format / 版本 /
  route / reason / candidate 都拒」。
- `recipe.test.ts` > id 重复 / 版本写错 / 多顶层字段 / 网格格数不符 / 帧名重复 / 动画类走 import 却没 sheet。
- `asset-spec.test.ts` > sprite 不许带动画 / animation 至少一个动画 / 九宫格内缩越界 / 层名重复 / 动画名重复。
- `game-config.test.ts` > `.strict()` / 非整数坐标 / `kind` 拼错 / `motion.kind` 拼错；
  `td-config.test.ts` > `lives > 0` / 减速系数 < 1 / `levels` 定长 2。
- `game-intent.test.ts` > 四个桶名收、第五个不收；`game-design.test.ts` > `mechanic` 封闭枚举；
  `visual-world.test.ts` > 六桶只收 `palette:<下标>` / `camera.mode` 封闭枚举。
- `cli-create.test.ts` > 缺 `--style` / 缺 `--intent` / `build` 缺 run 目录 ⇒ 2；`pack --version` 非整数 ⇒ 2。

缺口：

- **MCP 不校验工具必填参数**：`server.ts` 的 `tools/call` 直接 `String(args.x)`；缺参数会变成字符串
  `"undefined"`，而不是 CLI 那样的 usage/2。`server.test.ts` 没有任何缺参数用例（no test found）。
- `packages/contracts/src/asset-plan.ts:13-14` 注释写「与 `AssetSource["kind"]` 同一组值」，
  但 `AssetSource` 现有四值（`drawlist` / `image` / `import` / `frames`），`ASSET_PLAN_ROUTES` 仍是三值；
  `asset-plan.test.ts` 的「三值一致」只比较硬编码数组，**没有真的去比 `AssetSource`**（形状断言）。

## 5. 类别 3：资源路线选择与不支持路线（needs strengthening）

三条生产路线（`image` / `drawlist` / `import`）与「能力缺失不换路」覆盖很强；
第四个合法 `source.kind = "frames"` 在路线决策里没有测试，且源码把它折叠成 `image`。

existing：

- `route-resolver.test.ts` > 五条硬信号与顺序（`characterId` 最高；`masterAsset > animation > background`；
  九宫格 UI 是 `drawlist` 硬信号；非九宫格 UI / 普通 sprite 由候选平局）。
- 同文件 > `import` 的合格条件（`mustReuse + accessible` ⇒ import；ref 不可访问 ⇒ ref 失败；
  候选 import 不能自己触发 import）。
- 同文件 > 「能力缺失不换路」三例；「同一归一化输入重复 20 次结果一致」。
- `plan-sidecar.test.ts` > 硬信号覆盖候选 / sidecar 与 Recipe 逐项一致 / 能力缺失不落 sidecar /
  import 三态 / 参考图能力缺失。
- `plan-assets-player-gate.test.ts` > 玩家缺一路 / 两件 animation / `characterId` 缺席 / 1 帧 ⇒ 退 4。
- `plan-assets.test.ts` > 设计或世界不过 schema ⇒ invalid，且账上一笔都没有。

缺口：

- **`source.kind: "frames"` 没有路线 / fixture 覆盖**。`packages/contracts/src/recipe.ts` 把它列为合法源；
  `pack-frames.test.ts` 只直接喂给 `buildAssetPack`，没有经过 planner / `resolveRoute` / sidecar。
- `ops.ts:372` 把 `frames` 候选路线写成 `"image"`；`route.ts:143-155` 的 `sourceForDecision`
  只在 `source.kind === "image"` 时保留 image source，其余返回 `{ kind: "image" }`。
  按源码推断（E1，后由 W3 的假 fetch 探针实测确认）规划链会把 `frames` 折叠成 `image`；
  没有测试钉住这个语义。→ P0 修复项（`CAP-ASSET-01`）。
- 没有「不支持的路线」可复用 fixture：`asset-plan.test.ts` 的 `"video"` 变异是 inline 构造。
- 没有 `frames` + 母版 / `frames` + 参考图能力缺失的测试。

## 6. 类别 4：上游结构合法但语义错误（existing）

这是当前测试最厚的一类：契约 gate、R12 拒绝、玩家动画 gate、配置业务校验、路径派生失败、
重采样分类都有行为断言。

证据：

- `build-design.test.ts` > R12 ①意图 → 设计覆盖（缺机制 / 缺实体 / 串桶 / 全有 ⇒ 放行）；
  R12 ②相机（`top-down` / `isometric` / `first-person` / `other` 拒，`side` 放行）。
- `compile-design.test.ts` > 拒绝不重采样、不进 `failures[]`；空 `mechanics` 逐条点名。
- `visual-world-gate.test.ts` > 六桶 / `materials.*.color` 越界 / 空色板 + 引用 ⇒ 拒。
- `game-design-gate.test.ts` > 空字符串 / 空数组 / 四桶 id 重复 / 悬空实体引用 ⇒ 拒。
- `game-intent-gate.test.ts` > 嵌套必填 / 空壳可选对象 / id 重复 / 跨数组相撞 / id 写成类名 ⇒ 拒。
- `compile-runtime.test.ts` > HUD 用世界坐标被抓；锚点语义下 `at.y = 地面线` 不误报。
- `compile-td-game.test.ts` > 走道派生不出路径 ⇒ 硬失败；引用不存在资源 ⇒ `ok:false` 但 v1 仍在。
- `text-op-ledger.test.ts` > `dependsOn` 有环 ⇒ 由 v3 契约判死、重采样。

缺口：

- 语义错误主要限于**契约能机械判定的那部分**（空值、id、枚举、引用、几何）。
  「角色长得不像描述」「机制存在但实际不可玩」「新实体语义与世界观不符」不在任何自动判据里。
- `fixtures/upstream/canned.json` 只有一份**全绿**的上游应答，没有「结构合法、语义错误」的负例 fixture；
  所有负例都在测试里 inline 改字段，可复用性弱。

## 7. 类别 5：参考图没有、需求要求的新实体（missing）

没有一条测试断言「需求要求的新实体被生成 / 使用参考图色板 / 进入配置 / 视觉上属于同一世界」。

相邻证据（都**不是**这条判据）：

- `fixtures/e2e/wasteland-platformer/README.md` 明写 `style.png`（黄昏山间小站）与 `intent.md`
  （废土寻宝）是**有意错配**，考的正是「模型跟图还是跟文本」。这是最合适的正例 fixture，
  但没有测试读它来断言新实体。
- 该 fixture 只被 `route-resolver.test.ts`、`plan-sidecar.test.ts`、`import-fixture.test.ts`、
  `review.test.ts` 和 `pipeline/tests/review.test.ts` 使用；这些用例只验证路线、sidecar、导入和 review 接线。
- `build-design.test.ts` > 「设计里新加意图没点名的实体 ⇒ 什么都不触发」——方向相反。
- `intent-coverage.test.ts` > 只比较 intent 与 design 的 id 集合。
- `vision/tests/palette.test.ts` > 只证明色板来自参考图，不证明新实体消费了它。
- `qa/src/visual.ts` 文件头明确把 `style similarity` / `silhouette` / `composition` /
  `character consistency` 列为**观察，不是判据**。
- **no test found**：从 `fixtures/e2e/wasteland-platformer` 出发，断言 recipe 含
  `player-scavenger` / `chest` / `enemy` 等参考图中不存在的实体，并检查 `source.kind`、
  palette 绑定或交付尺寸。

结论：fixture 有了（错配图 + 意图），**判据与断言没有**。这是 11 类中最明确的空白。

## 8. 类别 6：文件存在但内容 / 尺寸 / 帧数不符（needs strengthening）

「spec ↔ manifest / 产物」的尺寸与帧数对账很强；「磁盘上的 PNG 实际像素与 manifest / atlas 是否一致」
只有 checksum（`verify`），没有像素级交叉检查；也没有真实 image/import 交付包 fixture。

existing：

- `qa/tests/visual.test.ts` > 改尺寸 ⇒ 一条 error，`target` 是资源 id；spec 说 3 帧、产物 2 帧 ⇒ 也响；
  清单有包里没有 ⇒ 「没被做出来」；drawlist `viewBox` 改坏 ⇒ 也响。
- `asset-spec.test.ts` > 帧数 / 尺寸 / kind / 多出动画 / 零像素 ⇒ 报出来。
- `pack.test.ts` > 生成器给的帧数与清单对不上 ⇒ 报出来，不静默裁剪。
- `pack-sheet-grid.test.ts` > 空格 / 一格两主体 / 格子带黑框 ⇒ 明确失败。
- `pack-ground-band.test.ts` > 横带颜色必须 0 像素；只画 N-1 个角色仍然抛。
- `pack-reuse-threshold.test.ts` > 缺一帧不偷偷重发；0.6 / 0.5 阈值。
- `pack-selfcheck.test.ts` > 层名重复 / 动画名重复 ⇒ 不提交成包。
- `import.test.ts` > 各帧尺寸必须一致；网格超出图范围报错。
- `cli.test.ts` > 篡改一个文件后 `verify` 必须非 0。

缺口：

- `qa/src/visual.ts` 文件头自白：QA 包够不着 PNG 解码器，`palette-binding` 只能做 manifest 报表级对账；
  没有测试用「PNG 实际像素尺寸 / atlas 帧矩形」对照 manifest。
- 没有 committed 的**生成态 / 导入态**包 fixture：`fixtures/packs` 两份都是 drawlist 包
  （`last-train/v2`、`counter-siege/v4`）。QA、site、inspect 的真产物路径没有在 image 源包上跑过。
- 没有损坏 PNG / 截断图 / atlas 缺帧的负例 fixture；篡改都在测试里 inline 做。
- `inspect.test.ts` 对源图尺寸与色板外像素是**观察**：用例「它是观察，不是判据 —— 报数、不打分、不阻断」
  明确不阻断；因此「文件在但内容错」在 inspect 这一层不会失败。→ P0 像素阈值项的起点。

## 9. 类别 7：资源包成功但游戏构建失败（needs strengthening）

装配器（pack → config → site）的校验失败有组件级测试，但没有一条从「成功的 pack」出发、
经 CLI/MCP 跑到 site 失败、并检查退出码与站点版本/产物的全链用例。

existing（组件级）：

- `site.test.ts` > 「引用了包里没有的资源 → invalid，且一个目录都没写」「game-config 不过 schema → invalid」
  「不平铺的层给了非零视差 → 硬失败」「HUD 摆到屏幕外 → 硬失败」。
- `td-site.test.ts` > 引用解不到 / 可通关族数值写反 / 场地铺不满 ⇒ 硬失败、零目录。
- `compile-runtime.test.ts` > 引用不存在资源 ⇒ invalid、一个字节都没落；业务校验不过只试一次；
  没有文本上游 ⇒ upstream；不是资源包 ⇒ usage。
- `create-game.test.ts` > 配方正确但配置三格同名 ⇒ 死在配置一步、退 4。
- `cli-create.test.ts` > QA 硬失败 ⇒ 4、站点不产、报告已落盘。

缺口：

- **no test found**：`pack` 成功 → `assembleFromConfig` / `assembleSite` 抛 invalid → CLI 退出 4、
  MCP `isError`、`site/` 不出现、已产出的 `pack/` 保持可 `verify` 的组合用例。
- CLI `site` 与 MCP `assemble_site` 没有命令级测试。
- 没有断言「site 构建失败后下一次成功仍落在 `site/v1`」（版本不被失败消耗，见类别 11）。
- 组件级失败输入是 fixture pack + inline 坏 config；没有一份「坏的 game-config / td-config」fixture。

## 10. 类别 8：游戏可以启动但关键机制不可执行（missing）

没有测试真正启动站点、执行输入并观察机制；现有证据分两类：纯领域模拟、外壳源码串静态见证。

- 纯领域模拟（E2，但不是「游戏启动」）：
  `demo/tests/td-sim.test.ts`（伤害 / 护甲 / 减速 / aoe；建塔 / 升级 / 漏怪 / 胜负；参考玩家能赢）、
  `td-winnable.test.ts`（真关卡赢 / 漏 1 / 退化）、`hazard.test.ts`（三角波位置与边界）。
- 静态见证（E2，只是源码串）：`shell-capability-witness.test.ts`（八条能力逐条指得到外壳一行）、
  `shell-scene-wiring.test.ts`（玩家先于实体创建 / `advanceHazards` 用锚点）、
  `shell-hud-declared-size.test.ts`（四个 HUD 格子逐格指得到外壳）。
- `qa/src/gameplay.ts` 文件头逐字：「不跑游戏（Playwright / headless 那一簇本图不做）」；
  `auditReachability` 是静态 BFS；`qa/tests/gameplay.test.ts` 只测引用族与可达性。
- **no test found**：启动 `site/v<N>/index.html`、加载 `shell.js`、注入键盘/指针输入、
  断言角色移动 / 跳跃 / 拾取 / 胜负的测试。仓库没有 Playwright / Puppeteer / jsdom 依赖
  （`pnpm-lock.yaml` 里只有 vitest 的可选 peer 条目，未安装）。唯一真实启动在 W6 的人工 CDP，不在测试套件内。

结论：这是**结构性缺失**，不能被 `td-sim` 的纯函数测试替代。→ P0 最小 headless smoke（`CAP-QA-07`）。

## 11. 类别 9：QA 发现阻断问题时，发布不会被误报成功（needs strengthening）

pipeline 与 CLI `create --yes` 的阻断链有强测试；MCP、CLI `build`、只含 warning 的边界、
以及 visual 族的全链阻断缺失。

existing：

- `create-game.test.ts` > 「真链上响一次 ⇒ 抛 invalid（= 4），而报告已经在磁盘上」；
  「文案里带着报告路径与失败详情」。
- 同文件 > 「不给 ⇒ 跑默认合成器 —— `incomplete` 不是失败，它照样不阻断」；「`qa: null` ⇒ 缺席」。
- `cli-create.test.ts` > 「判据硬失败 ⇒ 退出码 4、站点不产、报告已经落盘，而文案里有路径与详情」。
- `qa/tests/visual.test.ts` > 「一律 `severity: "error"` —— 降成 warning 就悄悄不阻断了」。
- `qa/tests/assemble.test.ts` > 「观察换成任意内容，裁决一个字不变」「判据真响了时，观察栏一模一样」。
- `qa/tests/intent.test.ts` > 缺项一条 error；缺两样也是一条 finding。

缺口：

- **MCP `create_game` 没有 QA 阻断用例**（只有成功路径）。
- **CLI `build` 没有 QA 硬失败用例**；只有 `create --yes`。
- 全链阻断只由 `reachability`（gameplay 族）触发过；没有由 `constructive-constraint` /
  `palette-binding` / `intent-coverage` 触发 `runBuild` 抛出的用例。
- 没有「只有 warning ⇒ 构建成功、退出 0」的链级负判据。
- 没有断言「QA 失败后 `qa-report.json` 的 `checked` 恰好只含真跑过的族」在链级的完整映射。
- **`site` / `assemble_site` 不读 QA 报告、不跑 reachability**——发布闸门可绕过（W4 结论 9）。
  → P0 发布闸门统一（`CAP-QA-08`）。

## 12. 类别 10：CLI / MCP 对同一输入的关键行为一致（missing）

没有任何测试同时驱动 CLI 与 MCP、喂同一输入、比较关键行为。

相邻证据：

- `mcp/tests/server.test.ts` > 「inspect 返回 content + structuredContent（与 CLI 的 `--json` 同源）」——
  只调 MCP `handle`，断言形状，**没有调用 CLI**。
- `mcp/tests/build-pack-stdio.test.ts` > 真实 stdio 下的失败契约，很强；但只覆盖 `build_asset_pack`。
- `create-game-no-digest.test.ts` 与 `cli-create.test.ts` 使用**同一份** `canned.json` 与同款假上游逻辑，
  但两份测试各写各的断言，没有逐字段对照。
- `create-game-no-digest.test.ts` 自白：「MCP 把 `stylePath` 原样往下传；契约要求它相对 cwd」，
  测试因此手工把路径转成相对路径。CLI 的 `styleRefOf()` 会主动转换——**同一绝对路径输入，CLI 接受、MCP 拒绝**
  （E1，源码 + 测试注释；无对照测试）。

源码差异（E1，均无测试）：

- **玩法分派**：CLI `buildAndSite` / `site` 用 `assembleFromConfig`（按 `format` 分派塔防）；
  MCP `create_game` / `assemble_site` 直接 `assembleSite`。给 MCP 一份 `td-config/v1` 会走横版装配器并失败。
- **返回 `data` 形状**：CLI `create --yes` 含 `runDir / packDir / config / siteDir / entry / serveRoot /
  imageCalls / imageCallBreakdown / ambiguity / qa*`；MCP `create_game` 只有 `status / gameId / runVersion /
  packVersion / ...site.data / qa*`，且 `artifacts` 没有 `run`。
- **HUD 行高**：CLI 传 `hudLineHeight: HUD_LINE_HEIGHT`；MCP 不传，靠 `DEFAULT_HUD_LINE_HEIGHT`。
  今天同值（10），但这是两个来源。
- **必填参数**：CLI 逐命令检查 flag；MCP 直接 `String(args.x)`。
- **检查点**：CLI `create` 默认停住，MCP `create_game` 不停（设计如此）；没有测试证明两者产物逐字节等值。

结论：**missing**。至少需要一条「同一 fixture、同一假上游、CLI `create --yes` vs MCP `create_game`：
产物路径 / 字节 / 机器可读字段 / 失败退出码」的对照测试；以及 MCP 的 TD 分派测试。
→ P0 只要求错误语义 / `stylePath` / QA 失败测试（Q9 裁定）；全面对照测试 P1（`CAP-TEST-02`）。

## 13. 类别 11：失败不消耗版本号、临时目录与失败产物契约（needs strengthening）

run / pack / CLI / MCP 的失败现场与版本不消耗有强测试；site、config staging、QA 失败后的版本状态缺失。

existing：

- `run.test.ts` > `openRun` 只开临时目录、不定版本；`commitRun` 第一次 v1、第二次 v2；撞名原子抢到 v2；
  未定 id 失败现场在 `out/.failed-<ts>/`；已定 id 在 `<gameId>/run/failed-<ts>/`；
  **失败不消耗版本号**（放弃三次后第一次成功仍是 v1）；已定稿再 abandon 什么都不动。
- `ops.test.ts` > 失败既不留包目录、也不吃版本号；一笔都没成功时不留空现场。
- `pack.test.ts` > 第 2 个资源挂掉时第 1 个的原图与提示词还在；同一配方只留最近一份失败；等「在飞的」收尾；
  第 2 个资源挂时失败现场里有账。
- `pack-selfcheck.test.ts` > 违约 manifest 留在失败现场；`pack/` 不出现。
- `cli.test.ts` > 人类行说清在哪、怎么复用；`--json` 带 `failureDir`。
- `mcp/tests/build-pack-stdio.test.ts` > 真实 stdio 失败契约。
- `site.test.ts` / `td-site.test.ts` > 校验失败零目录；两次装配 v1 与 v2，v1 原样在；
  `cli-create.test.ts` > 先摆 `site/v9`，产物仍落 `site/v1`。

缺口：

- **no test found**：site 硬失败后下一次成功仍落 `site/v1`。
- **no test found**：`laySite` 拷贝 shell / 写文件中途抛错时的半成品目录处置（无故障注入）。
- **no test found**：`runBuild` 的配置 staging（`.config-*`）在 `compileRuntime` 抛错时被 `finally` 清掉。
- **no test found**：QA 硬失败后下一次构建的 `pack/v<N>` 版本分配（`nextPackVersion` 分支）。
- `compile-td-game` 的「校验不过也照常落盘」是**有意的契约例外**（产物给人过目），
  不应与 run/pack 的「失败不消耗版本号」混为一谈。

## 14. 缺失的 fixture

### 14.1 已有正例基线

- `fixtures/recipes/*.json`：9 份（drawlist / image / import / mixed / master），由 `recipes-sweep.test.ts`
  全量建包 + verify。
- `fixtures/packs/last-train/v2`、`fixtures/packs/counter-siege/v4`：真包、真 checksum、真 drawlist
  （**都是 drawlist 包**）。
- `fixtures/game-configs/last-train.json`、`fixtures/td-configs/counter-siege.json`：两种玩法的真关卡。
- `fixtures/e2e/wasteland-platformer/`：`style.png`（借 `halt-dusk.png`）、`intent.md`、`visual-world.json`、
  `game-design.json`、`asset-recipe.json`、`character-dna.json`、`import-frame.png`、`import-recipe.json`；
  **没有 `game-intent.json`**。
- `fixtures/upstream/canned.json`：六份全绿的假上游应答。
- `fixtures/reference/halt-dusk.png`、`fixtures/import/wan-player-1024.png`、`fixtures/model-paint*`、
  `fixtures/drawlist/*`。

### 14.2 缺失的正例 fixture

| ID | 需要的正例 | 服务于 | 为什么现在没有 |
|---|---|---|---|
| P1 | 一份 `source.kind: "frames"` 的 recipe fixture（含 player 三路动画） | 类别 3 / 1 | `pack-frames.test.ts` 在内存里构造，`fixtures/recipes/` 九份没有 frames |
| P2 | 一份**真实生图 / 导入**的交付包（含 PNG、atlas、manifest） | 类别 6 / 8 | `fixtures/packs` 两份都是 drawlist；QA/site/inspect 从没在 image 源包上跑过 |
| P3 | 完整的 `wasteland-platformer` run fixture（含 `game-intent.json` 与「参考图里没有的实体」清单） | 类别 5 | 现在有 style / intent / design / recipe，缺 intent JSON 与「新实体」断言目标 |
| P4 | 塔防全链 fixture（run + pack + td-config + 期望 site） | 类别 7 / 8 | 现在只有 `td-configs/counter-siege.json` + 独立包，没有从 create/build 走出的 run |
| P5 | CLI/MCP 共用的「输入 → 期望输出」golden fixture | 类别 10 | 只有 `canned.json` 的输入侧，没有输出侧 |
| P6 | 一份 QA 硬失败但站点**已可装配**的 config fixture（不可达目标） | 类别 9 | `cli-create.test.ts` 在 fakeUpstream 里 inline 改 `gameConfig` |

### 14.3 缺失的负例 fixture

| ID | 需要的负例 | 服务于 | 现状 |
|---|---|---|---|
| N1 | 非法 / 不支持的 `source.kind`、`asset-plan` route、未知 reason code 的 fixture | 类别 2 / 3 | 全部 inline `mutate()` |
| N2 | 五类上游「结构合法、语义错误」应答 fixture（世界 / 意图 / 设计 / DNA / 配置 / 清单） | 类别 4 | `canned.json` 只有全绿；负例 inline |
| N3 | 损坏 / 截断 PNG、atlas 帧矩形错误、checksum 不符、帧数少一份的交付包 | 类别 6 | 没有 committed fixture；`verify` 篡改 inline |
| N4 | 一份能通过 schema、但装配期硬失败的 game-config / td-config fixture | 类别 7 | `site.test.ts` inline 改 fixture config |
| N5 | MCP 缺必填参数的请求 fixture | 类别 2 / 10 | **完全没有** |
| N6 | 「参考图无、需求有」的意图 + 期望实体清单（用于负判据：缺了要红） | 类别 5 | **完全没有** |

### 14.4 边界 fixture / 边界用例

| ID | 边界 | 现状 |
|---|---|---|
| B1 | 动画 1 帧 / 0 帧 / N-1 帧 / 多段重复名 | 部分 inline：`pack-ground-band`（N-1）、`asset-spec`（重复名）、`plan-assets-player-gate`（1 帧）；没有 fixture |
| B2 | sheet 恰好铺满 / 带 offset+spacing / 全透明格 / 1 个不透明像素 | inline 覆盖：`import.test.ts`、`sheet-grid.test.ts`、`pack-sheet-grid.test.ts` |
| B3 | 色板 0 色 / 1 色 / 重复色 / 越界引用 / 色板外像素 | 覆盖：`visual-world-gate`、`vision/palette`、`pack.test`、`inspect.test` |
| B4 | `FILLED` 恰好 0.999、世界宽 == 视口、单层背景 | 覆盖：`site.test.ts` > 0.998 放行 / 只有一层背景；`layer-coverage.test.ts` > 恰好等于视口不报 |
| B5 | run/pack/site 的版本撞名与显式版本 | 覆盖：`run.test.ts`、`cli-create.test.ts`（site v9）、`pack.test.ts`；**pack 显式 `version` 已存在时拒绝**没有直接用例 |
| B6 | 同进程 / 多进程并发定稿 | 模拟 `renameSync` 撞名（`run.test.ts`），没有真并发进程 |
| B7 | 空数组 / 缺字段 / null 的三种区别 | 覆盖：`game-intent-gate`、`game-design-gate`、`asset-plan.test` |
| B8 | 参考图 jpg / webp / 截断 PNG / 无扩展名 | 只覆盖 jpg（`pipeline/tests/palette.test.ts` > jpg ⇒ usage 且零上游）；webp / 截断 PNG 没有 |
| B9 | 超大尺寸资源 / 极端宽高比 / 1×1 图 | 部分：`image-gen.test` 尺寸换算、`import.test` 1×1 空图；没有交付包级用例 |

## 15. fixture / 测试可复现性风险

- `packages/cli/tests/cli.test.ts` 与 `packages/mcp/tests/server.test.ts` 会优先选**本机
  `out/shift-change-assets/pack/vN`**（gitignored）里的包，只有不存在 / 契约过期时才回落到
  `fixtures/packs/counter-siege/v4`。测试对象会随机器状态变化；回落时 `describe.skipIf(!hasPack)`
  还可能静默跳过整组。当前 `hasPack` 为真，但这是可复现性风险（E1）。→ `CAP-TEST-07`。
- 十余份 assets 测试从 `.scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json`
  读 `StyleSpec`，而不是从 `fixtures/`；该文件已被 git 跟踪，所以干净检出可跑，但 fixture 的「家」不一致。
- 测试全部用假上游或本地桩；没有真实上游响应进入测试套件。这保证零付费，但意味着
  **E2 不能证明真实模型行为**（W6 的职责）。

## 16. 断言「字段存在」与「断言行为」的分布

- 总体：行为型断言占多数；契约负例几乎都是 `parse(...).ok === false` / `toThrow`（结构行为）。
- 弱断言集中在：
  - `packages/assets/tests/ops.test.ts`（8 处 `toBeDefined/toBeTruthy`，主要断言账/现场键存在）；
  - `packages/pipeline/tests/create-game.test.ts`（5 处，主要断言路径/报告字段存在）；
  - `packages/mcp/tests/server.test.ts` > 「inspect 返回 content + structuredContent」（只断言形状）；
  - `packages/contracts/tests/asset-plan.test.ts` > 「route 与 reason 的封闭枚举与 source.kind 三值一致」
    （名字说一致，实际只比硬编码数组）。
- 强行为断言典型：`cli-create.test.ts` > 「两条路的产物等价」；`create-game.test.ts` > QA 硬失败；
  `ops.test.ts` > 失败不吃版本号；`site.test.ts` > 引用缺失 ⇒ invalid 且零目录。

## 17. P0 施工需要新增 / 加强的测试（按裁定映射）

| P0 工作包 | 必须新增 / 加强的测试 | 对应类别 |
|---|---|---|
| P0-01 运行时胜利与软锁 | 两 goal 只有 gate 能赢；危险物空中/固体上重置后可恢复、不掉穿 | 8（新增启动级测试可覆盖） |
| P0-02 发布闸门 | `site` / `assemble_site` 缺 QA、error、incomplete ⇒ 拒；6/6 含 `layer-coverage`；CLI/MCP 对照 | 9、10、11 |
| P0-03 可玩 smoke | 启动站点 + 输入 + 拾取/胜利；负例：故意打断 gate/pickup ⇒ 红 | 8（结构性补齐） |
| P0-04 资产完整性 | 设计 id 缺资源 ⇒ 拒；坏 checksum 包 ⇒ `runBuild` 拒；空色板在下游付费调用前拒 | 3、6、7 |
| P0-05 像素阈值 | 已知坏像素统计 ⇒ QA error；已接受包 ⇒ 通过；阈值文档化 | 6、9 |
| P0-06 静默降级 / 入口 | `frames` 候选 ⇒ 明确失败（或参数化保留）；MCP 错误码 / 绝对 `stylePath` / QA 失败路径 | 3、10 |
| P0-FINAL 付费 E2E | 不是测试套件；单独票的验收记录（见 P0 范围） | — |

## 18. 结论要点

1. **强项**：契约负例、路线 resolver、pack 帧/尺寸对账、run/pack 失败现场与版本不消耗、
   CLI 两段式等值、QA 硬失败阻断（`create --yes`）都很扎实，且全部离线可跑。
2. **最大空白**：类别 5（新实体无判据）、类别 8（无启动+输入测试）、类别 10（无 CLI/MCP 对照）、
   类别 7（无全链 site 失败）、类别 3（`frames` 未覆盖）。
3. **P0 必须补的测试**见 §17；其余补测按 P1/P2 分流，见 [能力差距表](P0-00-capability-gap-audit.md)。
4. **测试环境事实**：基线 `pnpm test` 绿但 `pnpm typecheck` 失败；`7aa98d7` 已修复 typecheck。
   任何「测试清单已通过」的说法必须注明是哪条命令、哪个 HEAD。
5. **可复现性**：测试对象可能随本机 `out/` 状态变化；这是 P2 修正项（`CAP-TEST-07`）。
