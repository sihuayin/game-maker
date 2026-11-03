# D 类当前源码复核（P1 实施后）：viewport / role / modelHard / 设计 goal 桶

- **日期**：2026-11-03
- **基线**：`main` @ `3b1b61d`（P1「design-to-config residual gaps」已合入）；行号以当前工作树为准。
- **性质**：只读研究。未修改生产代码、测试、fixture、契约、历史证据；未 commit / 未建分支 / 未推送。
- **零付费**：只使用既有 fixture、mock `fetchImpl`、临时目录与既有 `out/**`、`fixtures/**`、`.scratch/**` 语料；无模型调用、无生图、无网络。
- **本票不裁定修复去留**。下面只给事实、证据与候选判据；「修复 / 推迟 / 剔除 / 范围变更」由 03 按 map.md 的四项门槛裁定。
- **E3 运行说明**：E3 脚本写在 `/tmp`（未进仓库），调用的是 `packages/*/dist`（2026-11-03 09:49–10:00 构建，含 P1 代码）。命令与退出码见 §5。

---

## 0. 结论先行

| 编号 | 原子项 | P1 后是否仍成立 | 证据级别 | 关键源码 | 语料重判新增 error | 契约变更候选 |
|---|---|---|---|---|---|---|
| D-01 | `viewport` 贯通 | **作为源码事实仍成立**；今天两个壳都固定 480×270，生产链无可观察失败 | E1 + E2（缺贯通测试）+ E3（默认值分叉复现） | `pipeline/src/create-game.ts:48,128,177,380,390,598,629,669`；`demo/src/site.ts:210`；`demo/src/td/site.ts:130,143`；`demo/src/draw.ts:15`；`assets/src/ops.ts:877` | **0**（117/117 config `world.size.h = 270`） | 可选 API 增量（`UnderstandingInput.viewport`、`AssembleOptions.viewport`）；有不改契约的替代（单常量 / 早拒） |
| D-02 | `role` 贯通 | **仍成立**：横版 `resourceBrief` 不打印 `role`，塔防 `tdResourceBrief` 打印 | E1 + E2（无任何断言）+ E3（真发出去的两份 body） | `assets/src/ops.ts:953-963`（横版）、`:1373-1379`（塔防）、`:1147`、`:1421`；`contracts/src/assetpack.ts:167`；`assets/src/pack.ts:1214` | **0**（982/982 可解析 manifest 资产的 `role` 非空） | 无需契约变更；纯提示词改动。若要「机读语义分类」则是 B-01/Q2 的契约级变更，已被裁为 Out of scope |
| D-03 | `modelHard` 归因与盲重采样 | **仍成立**：3 发请求体逐字相同；包根因仍写「模型错」；归因只有 flat 列表 + 3 个 A 类码 | E1 + E2（有重采样测试、无反馈/归因测试）+ E3（无 ui 临时包复现） | `assets/src/ops.ts:1098,1173-1214`（编译循环）、`:423-435`（规划循环）；`contracts/src/config-audit.ts:34-48`；`contracts/src/game-config.ts:300-317` | **0**（113 份配对 config 的 86 条 resampleable error 按「无同 kind 备选」判据 0 条包根因） | 新归因码 / 改 `auditConfigPipeline` 返回形状属契约级；不改契约的替代是「新增独立分类纯函数 + 循环内追加反馈」 |
| D-04 | 设计 goal 桶 | **仍成立**：设计 schema 无 goal 桶；设计允许 `winConditions: []`（「没有终点」）；config 的 `objective` 只有 `collect-then-reach` 且 `gate` 必须是 goal；`winConditions` 下游零消费者 | E1 + E2（孤儿 goal 合法、同桶误归属为已知限制的测试）+ E3（schema/审计对比 + 语料） | `contracts/src/game-design.ts:110-111,160-172,196`；`contracts/src/game-config.ts:228-232,421-423,646`；`assets/src/prompt.ts:854-870`；`assets/src/ops.ts:1127` | 新增「设计必须有结构化 goal」判据会让 **43/43** 份合法设计变 error（不可接受）；已存在的 config 侧 gate 判据新增 **0**（1 条是故意坏的 `out/__probe/empty`） | 设计契约新增结构化 goal 载体（宽影响面）；不改契约的替代是继续用 config 侧孤儿 goal + 提示词/布局散文 |

### 0.1 P1 对本图的净影响

| P1 改动 | 对 D-01 | 对 D-02 | 对 D-03 | 对 D-04 |
|---|---|---|---|---|
| `ConfigIssue.code`（三码，`game-config.ts:300-317`） | 无 | 无 | **只覆盖 Q1/Q3/Q4 三处**；引用/自洽/身份/屏幕空间仍无码（`game-config.test.ts:694` 明确断言既有错误不带 code） | 无 goal 码 |
| `auditConfigPipeline`（`config-audit.ts:34-48`） | 无 | 无 | 把审计收成单一入口、返回 `resampleable` / `deterministic` 两档；但 `resampleable` 仍是 **flat `ConfigIssue[]`**，不带来源/根因字段 | 无 |
| 五类实体 kind 锁（`ENTITY_ASSET_KINDS`，`game-config.ts:62-70`） | 无 | 无 | 让 kind 错误更早、更准，并带 `entity-asset-kind`；但仍落在 `modelHard`，包缺该 kind 时照样写「模型错」 | goal 只允许 `sprite|animation`；语料 100 份配对 config 的 goal 资源 = animation 55 / sprite 45，**0 新 error** |
| Q6a `hudUiGate` 无条件（`ops.ts:304-325`） | 无 | 无 | **消掉 P0 的 case K**（设计没声明 HUD → 清单缺 ui → 下游骂模型）在**规划期**的发生；但人工改清单 / `reuseFrom` 旧包 / 独立 `compile-runtime` 仍可绕过 | 无 |
| Q5 `runBuild` 汇合点确定性复验（`create-game.ts:625-636`） | 无 | 无 | 增加第四个失败档（确定性硬失败、不重采样），但只作用于 `deterministic`（层覆盖等），不改变编译循环里的 `modelHard` | 无 |
| Q6b `GameDesignSpecSchema.resources ≥ 1`（`game-design.ts:285-301`） | 无 | 无 | 无 | **相邻先例**：设计层已能为「config 强制 N≥1」收紧同类矛盾；但未处理 goal；语料 43/43 合法设计 `resources` 非空，0 误伤 |

---

## 1. D-01：`viewport` 贯通

### 1.1 当前状态（E1）

**结论：`UnderstandingInput` 仍没有 `viewport`；`runUnderstanding` 的 `planAssets` 调用仍不传；`compileVisualDesign` 仍硬编码 `DEFAULT_VIEWPORT`；站点装配仍固定 `demo` 的 `VIEWPORT` 常量。** P1 未触碰这条链。

调用链与每处取值：

| 阶段 | 调用点 | 取哪个 viewport | 证据 |
|---|---|---|---|
| 输入类型（理解段） | `UnderstandingInput` | **没有这个字段** | `packages/pipeline/src/create-game.ts:48-77` |
| 输入类型（构建段） | `BuildInput.viewport?` | 可选，注释写「外壳的常量，由壳那一侧传」 | `:109-128`（字段在 `:128`） |
| 合并输入 | `CreateInput = UnderstandingInput & Omit<BuildInput,…>` | 只有构建段那一份 | `:177` |
| 视觉设计 | `compileVisualDesign({ … })` | **硬编码 `DEFAULT_VIEWPORT`** | `:380` |
| 规划 | `planAssets({ … })` | **不传 `viewport`** ⇒ `planAssets` 内 `opts.viewport ?? DEFAULT_VIEWPORT` | `:390-400`；`assets/src/ops.ts:422` |
| 编译 | `compileRuntime({ … })` | `input.viewport ?? DEFAULT_VIEWPORT` | `create-game.ts:598`；`ops.ts:1097` |
| 汇合点复验 | `auditConfigPipeline({ … })` | `input.viewport ?? DEFAULT_VIEWPORT` | `create-game.ts:629` |
| QA | `runner({ viewport: … })` | `input.viewport ?? DEFAULT_VIEWPORT` | `create-game.ts:669` |
| 站点（横版） | `auditScreenSpace(VIEWPORT, …)` / `buildWorld` | **`demo` 的 `VIEWPORT` 常量，参数面没有 viewport** | `demo/src/site.ts:205-210`；`demo/src/assemble.ts:36-42`（`AssembleOptions` 无 viewport） |
| 站点（塔防） | `auditScreenSpace(VIEWPORT, …)` / `auditTdWorldSize(VIEWPORT, …)` | 同上 | `demo/src/td/site.ts:130,143` |
| 世界描述 | `buildWorld` 返回值 | 恒为 `{ ...VIEWPORT }` | `demo/src/world.ts:236`（另见 `:150,158`） |

常量的两个「家」：

- `packages/assets/src/ops.ts:877`：`export const DEFAULT_VIEWPORT = { w: 480, h: 270 } as const;`
- `packages/demo/src/draw.ts:15`：`export const VIEWPORT = { w: 480, h: 270 } as const;`
- 契约层明确表示拿不到这两个常量：`packages/contracts/src/td-config.ts:620-624`：「视口是外壳常量，具名的两份住在 `assets/src/ops.ts`（`DEFAULT_VIEWPORT`）与 `demo/src/draw.ts`（`VIEWPORT`），而契约依赖不到它们（`check:deps` 会当场拒）」。
- `ops.ts:99-101` 的注释已与代码不符：注释写「create 链两处都传 `input.viewport ?? DEFAULT_VIEWPORT`」，但 `runUnderstanding` 的 `planAssets` 调用不传。这条注释是 P0 已记录的「上游一致性小缺口」，P1 未改。

**今天的实际影响**：两个常量同值 480×270；CLI/MCP 的所有生产路径都把 `VIEWPORT` 传给 `runBuild`（`cli/src/cli.ts:273,684,699`；`mcp/src/server.ts:347,369`），并且 `create` / `create_game` 的 `runUnderstanding` 从不接收 viewport（`cli.ts:603`、`mcp/server.ts:352`）。⇒ **生产链今天不会出现两个不同的数**。缺口只在程序化调用 `createGame({ viewport: 自定义 })` 或将来给壳加自定义视口时暴露：规划期/视觉设计用 480×270，编译/QA/汇合点用自定义值，站点仍用 480×270。

### 1.2 证据

**E1（源码）**：见 §1.1 表格。补充两点：

- `runUnderstanding` 的签名是 `input: UnderstandingInput`（`create-game.ts:294`），但 `createGame` 把整个 `CreateInput` 传进去（`:762`）——运行时有 `viewport` 属性，类型上不可见，代码也从不读它。
- `packages/contracts/src/visual-design.ts:12-14` 明确说明视口是「**不是数据**」的壳常量，schema 只验形状；「`viewport` 是否等于壳 `VIEWPORT`」是一条 `validator` 判据（`visual-design/src/validator.ts:45`）。这决定了修复方向只能是「贯通壳常量」，不能把 viewport 塞进资源包或 VWS 数据。

**E2（既有测试）**：

| 测试 | 断言 | 与本项关系 |
|---|---|---|
| `packages/demo/tests/world.test.ts:279-284` | 「视口是常量 480×270（票 32 裁决 1）—— 它不该被任何一个资源包改动」；换 `world.size` 视口纹丝不动 | **锁定站点视口固定**，证明 site 不参与贯通 |
| `packages/demo/tests/world.test.ts:37` | 零数据时 `w.viewport === VIEWPORT` | 同上 |
| `packages/qa/tests/layers.test.ts:79-86` | 「视口**真的被用上**：同一个包换 960 宽视口 ⇒ 那层 480 宽的不平铺层就该响」 | 证明 **QA 层是参数化的、会消费调用方给的值**；与 site 的硬编码形成对照 |
| `packages/assets/tests/plan-background-gate.test.ts:63-75` | 背景高 180 < 视口高 270 ⇒ 三发 `schema`、不落盘 | 只用默认 480×270，**没有自定义视口用例** |
| `packages/assets/tests/compile-runtime.test.ts`（全文） | 全部走默认视口；无自定义 viewport 用例 | 无贯通测试 |
| `packages/pipeline/tests/create-game.test.ts`（全文） | 无 `viewport` 参数注入 | 无贯通测试 |

⇒ **E2 只能证明「各阶段各自消费调用方传入的视口」和「site 固定 480×270」；没有任何测试能证明 runUnderstanding→planAssets→compile→site 用的是同一个数。** 贯通测试在类型上今天也写不出来（`UnderstandingInput` 没有这个字段）。

**E3（零付费复现，2026-11-03）**：`node /tmp/e3_d.mjs`，exit 0。

做法：取 `fixtures/e2e/wasteland-platformer/asset-recipe.json`，把背景 `spec.size` 改成 `{ w: 500, h: 280 }`；用 mock transport 走**当前 `planAssets` 的默认路径**（不传 viewport，等价于 create 链在 `create-game.ts:390` 的调用）。

结果：

```
planOk: true
backgroundCoverageGate(recipe, {w:480,h:270}) => null
backgroundCoverageGate(recipe, {w:640,h:360}) => "背景盖不住世界（清单层确定性缺口，重抽 config 改不了）：
  · 背景 \"level-downtown-ruins\" 高 280 < 视口高 360 …"
```

⇒ 同一份清单在**规划期默认视口**下通过，在**下游自定义视口**下被拒。这是默认值分叉的直接见证（不是生产壳的当前失败；见 §1.1 的边界）。

### 1.3 候选判据与误报边界

**候选判据（可计算）**：

> 对同一次调用，规划期（`planAssets` 的背景闸与提示词）、视觉设计（VDS 画布）、编译期审计、QA 层覆盖、站点装配所使用的 **viewport 值**必须逐次相等；任何两个阶段取到不同的数即 `error`（或至少是编译期硬失败）。

这是**调用链不变量**，不是语料判据；可用「传一个非默认值，逐阶段 spy/断言」测试。误报边界：

- **只比较 viewport，不比较 `world.size`**：横版允许 `world.size.w` 任意大、`world.size.h` 必须等于视口高（`ops.ts:1102` 铁律 4）；塔防则是「世界必须正好等于视口」（`td-config.ts:635-649`）。把世界尺寸纳入判据会误伤。
- **不要要求 viewport 等于某个数值**：CONTEXT.md 的裁定是「外壳常量，不是数据」；值由壳决定，判据只要求「同一次调用内一致」。
- **不要改由资源包/VWS 推导视口**：`visual-design/src` 与 `demo/tests/world.test.ts:279` 都锁死了「资源包不许改视口」。
- **今天不暴露自定义视口时判据不会响**（正确）：两个常量都是 480×270，所有生产路径一致；判据只在程序化传自定义值时才有牙齿。

**缺什么语义信息**：没有缺口。这是纯 plumbing 不变量，不需要新的设计/资源语义。

### 1.4 语料重判

**新增 error：0。**

- 扫描 `out/**`、`fixtures/**`、`.scratch/**` 的全部 `game-config.json`：**117/117 份** `world.size.h = 270`；没有任何一份携带非默认视口的证据（`game-config` 本身不存 viewport，视口是壳常量）。
- 因此「同一次调用视口一致」这条判据不会让任何既有 config 新增 error；它也不改变任何落盘产物。
- 反过来说，语料也**证明不了**修好后的行为——没有一份历史产物是在自定义视口下跑出来的（这与 P0 §10 的「site 装配期口径未纳入复验」一致）。

### 1.5 修改面

- `packages/pipeline/src/create-game.ts`：给 `UnderstandingInput` 增可选 `viewport`（或把 viewport 上移到两段共享的输入基类）；`compileVisualDesign` 与 `planAssets` 调用改用**同一个**值。
- `packages/demo/src/{site.ts,td/site.ts,assemble.ts,world.ts}`：若要让站点也吃同一值，需要给 `AssembleOptions`/`SiteOptions`/`buildWorld` 增可选 viewport，并把 `auditScreenSpace` / `auditTdWorldSize` 的实参从常量改为传入值；若只要求「壳常量一致」，则只需把两个常量收敛到一处（见替代方案）。
- `packages/cli/src/cli.ts`、`packages/mcp/src/server.ts`：今天已显式传 `VIEWPORT`；若新增可选参数，两壳不需要改（保持默认），不改变 CLI/MCP 对外形状。
- `packages/assets/src/ops.ts:99-101`：修正失真的注释。
- 不新增依赖、不改 Runtime、不改落盘产物、不改 schema。
- 测试：需要新增「自定义视口贯通」用例；现有 `world.test.ts`/`plan-background-gate.test.ts` 的默认值断言需要保持（它们锁的是壳常量）。

### 1.6 契约变更候选（含不改契约的替代）

**候选 A（API 增量，非持久化契约）**：`UnderstandingInput.viewport?` + `AssembleOptions.viewport?`，把值逐段传下去。

- 必要性：只有要支持「程序化自定义视口」时才需要；今天壳固定 480×270，不一致是**潜在**的。
- 影响面：pipeline / demo 的公开 TS 类型（新增可选字段，向后兼容）；无序列化变化；既有产物不变。
- 不做的后果：自定义视口时规划期背景闸/提示词与下游审计用两个数；E3 已复现「规划期放行、下游拒绝」。
- 单独审批点：是否需要「可自定义视口」这个产品能力；若不需要，A 不应进入修复。

**替代 B（不改任何契约/类型）**：把 `DEFAULT_VIEWPORT` 与 `VIEWPORT` 收敛为一个共享常量（放在 `contracts` 或由壳单点导出），所有阶段引用它；不新增输入字段。代价：仍然不能在运行时自定义视口，但能消除「两个常量各自漂移」的风险，且与 CONTEXT.md「视口是壳常量」完全一致。

**替代 C（不改契约、不改贯通）**：在 `createGame` / `runBuild` 入口显式拒绝 `input.viewport` 与壳常量不同的调用（`usage` 错误）。把「不支持自定义视口」说出口，而不是半贯通。代价：程序化自定义视口不可用；但今天本来也没有端到端支持。

### 1.7 前置裁定（逐字）

- `docs/v7.7` 之前的冻结裁定（P0 `issues/04-residual-gap-ruling.md:50`）：
  > 「Q9 | `modelHard` 归因「模型错」、盲重采样、`viewport`/`role` 未贯通 | **D** | 上游诊断、重采样反馈与契约贯通需独立处理；改善重采样反馈还需要模型调用验证 | 另立 effort」
- `CONTEXT.md:638-643`：
  > 「**Viewport（视口）** 相机一次能看到的世界区域。**它是 [[Runtime Shell]] 的常量，不是数据** —— 因为它同时管着 UI 的屏幕空间坐标系与缩放策略，那两件事不该被一个资源包改动。」
- `packages/demo/tests/world.test.ts:279`：
  > 「视口是常量 480×270（票 32 裁决 1）—— 它不该被任何一个资源包改动」
- `packages/contracts/src/visual-design.ts:12-14`：
  > 「**`viewport` 只验形状，不钉值**：视口是「**不是数据**」的壳常量……「`viewport` 是否等于壳 VIEWPORT」这条是**判据**，住在 validator……」

---

## 2. D-02：`role` 贯通

### 2.1 当前状态（E1）

**结论：横版 `resourceBrief` 仍不打印 `AssetPackEntry.role`；塔防 `tdResourceBrief` 仍打印。`role` 在 manifest 里是必填字段（`assetpack.ts:167`），但唯一的下游消费者是塔防清单。**

- 横版：`packages/assets/src/ops.ts:952-963`。文档注释写「id / 种类 / 尺寸 / **锚点落点** / 动画名 / 背景层」；行模板（`:958`）是：
  `- \`${a.id}\` · ${a.kind} · ${a.size.w}×${a.size.h}px · ${nineSliceNote(a)}锚点 {x:${a.anchor.x}, y:${a.anchor.y}} · 动画：${animText}`
  —— **没有 `a.role`**。
- 塔防：`packages/assets/src/ops.ts:1373-1379`。注释（`:1362-1372`）逐字写：
  > 「资源包清单 —— `resourceBrief` 的塔防版。⚠️ **带上 `role`（模型靠它认出「**哪个是砖**」）**、**锚点**与**尺寸**。」
  行模板（`:1377`）含 `${a.role}`。
- 两个清单共用 `nineSliceNote`（`:945-951`），但 `role` 段不在共用部分——这正是 P0 §6.2 第 9 条与票 71/85 反复强调的「两份实现必然漂」的同一处接缝。
- 横版调用点：`ops.ts:1147` `${resourceBrief(manifest)}`；塔防调用点：`:1421` `tdResourceBrief(manifest)`。

**生产者与契约**：

- `contracts/src/assetpack.ts:167`：`role: z.string()` —— 只要求字符串，**允许空串**。
- `assets/src/pack.ts:1214`：`role: b.spec.role` —— 从配方 `AssetSpec.role` 原样拷进 manifest。
- `AssetSpec.role` 在**生图提示词**里被消费（`assets/src/prompt.ts:212,377,405,480,537`），但那是生成时的 spec，不是交付 manifest 的 `role`。

**`AssetPackEntry.role` 的消费者清点（非 dist / 非 tests）**：

| 位置 | 用途 | 是否消费 manifest `role` |
|---|---|---|
| `assets/src/ops.ts:1377` | `tdResourceBrief` | **是（唯一）** |
| `assets/src/ops.ts:953-963` | `resourceBrief`（横版） | **否** |
| `contracts/src/*` | schema / 审计 | 只验类型（`z.string()`），无判据 |
| `demo/src/**`（含 site/world/td） | 装配/渲染 | **否** |
| `qa/src/**` | QA | **否**（`qa/src/visual.ts:184-185` 明确说 identity 用设计桶，不用 VDS 的 `role`；这是另一个 `role` 概念） |
| `pipeline/src/**` | 编排 | **否** |
| `cli/src/**`、`mcp/src/**` | 壳 | **否** |
| `visual-design/src/**` | VDS 布局 | **否**（它有自己的视觉分组 `role`，`layout.ts:46-55`） |

（`master.ts` 的 `role` 是 `authoring[].role`，不是 `AssetPackEntry.role`；`evidence-manifest` 的 `role` 是证据清单概念，也不是同一个字段。）

### 2.2 证据

**E1**：见 §2.1。

**E2（既有测试）**：

- `packages/assets/tests/compile-runtime.test.ts` 有逐资源的 `lineOf` 断言（`:387-420` 等），但只断九宫格标记、锚点、动画；**没有任何一条断言横版清单包含 `role`**。
- `packages/assets/tests/compile-td-game.test.ts:305-363` 有塔防清单的 spy 测试，但只断九宫格；**也没有断言 `role`**。文件头（`:299-304`）自白此前连 spy 都没有；票 85 才补 spy。
- `packages/assets/tests/prompt.test.ts` 测的是 `assetPlanPrompt`（生成配方），不是 `resourceBrief`。
- ⇒ **E2 对这一项是「缺失」而非「通过/失败」**：没有任何测试能发现横版清单丢了 `role`。测试基础设施（`lineOf` spy）足以写出这条判据，只是今天没写。

**E3（零付费复现，2026-11-03）**：`node /tmp/e3_d.mjs`，exit 0。

- 横版：用 `fixtures/packs/last-train/v2` + `fixtures/game-configs/last-train.json` 走 `compileRuntime`（mock transport），抓第一次请求体文本；断言某个已知资产的 `role` 子串是否出现。结果：
  - `sideHasRole: false`
  - 被查角色：`失物收集物：皮箱，摆三处`（`manifest.json` 里 `pickup-suitcase` 的 `role`）
- 塔防：用 `fixtures/packs/counter-siege/v4` + `fixtures/td-configs/counter-siege.json` 走 `compileTdGame`；结果：
  - `tdHasRole: true`
  - 被查资产/角色：`tile-floor` / `场地砖：店内的水泥地面，俯视`

⇒ 两份真发出去的 body 直接证明不对称仍存在。

### 2.3 候选判据与误报边界

**候选判据（可计算、提示词级）**：

> 横版 `resourceBrief` 的每一条资源行必须包含该资产在 manifest 中的 `role` 原文；塔防 `tdResourceBrief` 同样；两份清单的 `role` 段由**同一个函数**渲染（或同一条模板），不得各写一份。

- 精度：是。用现有的 `spy + lineOf` 可以对每个资产逐条断言；也可以做「横版 body 包含 role、塔防 body 包含 role」的双向断言。
- 可计算性：是。`role` 是 manifest 的必填字符串；语料里没有换行、没有需要转义的字符。
- 误报边界：
  - **只要求「印出来」，不要求语义正确**。`role` 仍是自由文本（`AssetSpec.role` 被 CONTEXT.md:116 降格为资产级描述）；不要把它当「地形/道具/角色」的机读分类，否则等于重开 B-01/Q2（已裁 Out of scope）。
  - **行安全**：语料 982 条 `role` 的字符数 min 2 / median 16 / p95 26 / max 32，**0 条含换行**；若未来 role 可能含换行/反引号，需要单行化/转义，否则会破坏「一行一资源」的 `lineOf` 结构。
  - **token 成本**：982 条总计 15,239 字符，单份包通常 10–20 条，增量很小；但它是每次规划的付费提示词，属于「改动后需要一次真跑验证」的范畴（Q9 裁定：改善重采样反馈还需要模型调用验证）。
  - **不要把 `role` 加进已失败的错误消息/状态机**：那是另一件事（归因/反馈），不要和提示词可读性混在一起。

**替代判据（更弱、但仍是可计算的形状规则）**：

> manifest 的每条资产 `role` 必须非空。

- 语料：982/982 通过，**0 新 error**；但它没有观测到任何真实失败（配方允许空串，契约也允许），因此判据可能「永远绿」，价值弱。

### 2.4 语料重判

**新增 error：0。**

- 90 份可解析 manifest（`parseAssetPack` 通过）共 **982 件**资产；`role` 缺失 **0**、空串 **0**、含换行 **0**；122 个不同取值。
- 若落「横版清单必须打印 role」这条判据：它不改变任何 config 的有效性，不会新增 error；只能说「如果打印，982 件资产的 role 都会多出现在提示词里」。
- 若落「role 非空」判据：0 新 error。
- 说明：172 份 `manifest.json` 中 **82 份 `parseAssetPack` 失败**（历史版本，早于当前 `assetpack` 形态），它们不计入 982/982 的分母；这些是历史产物，不重写、不重判。

### 2.5 修改面

- `packages/assets/src/ops.ts`：`resourceBrief` 行模板加 `${a.role}`；建议抽一个与 `nineSliceNote` 同款的 `roleNote`/`briefLine` 共用函数，保证横版/塔防「只此一份」。
- `packages/assets/src/prompt.ts`：无需改（`tdConfigPrompt` 只接收 brief 字符串）。
- 测试：`compile-runtime.test.ts` / `compile-td-game.test.ts` 各加一条 spy 断言；可选加一条「两份清单逐字同形」的 parity 断言（沿用 `:354-363` 的写法）。
- 不新增依赖、不改 Runtime、不改 schema、不改 CLI/MCP 形状、不改落盘产物。

### 2.6 契约变更候选（含不改契约的替代）

**本项不需要契约变更**：`AssetPackEntry.role` 已经在契约里；要做的只是把已有字段印到另一份提示词里。

- 若要做「机读语义分类」（例如把 role 变成封闭枚举、让审计能判「这件 sprite 是地形吗」），那是 **B-01/Q2 的契约级改动**，P0 已裁为 Out of scope；D-02 不应借机重开。
- 替代方案（不改契约）：
  1. 只加提示词（上文）；
  2. 若要「验证 role 质量」，只能做非阻断 warning 或人读侧检查，不能新增 error（会与语料零误伤冲突）；
  3. 不做：横版模型继续靠 id 猜地形/道具，塔防继续有 role；不对称保留。

### 2.7 前置裁定（逐字）

- P0 `issues/04-residual-gap-ruling.md:46`：
  > 「Q2 | `sprite` 内部无可机读语义分类，`role` 无人读 | **B** | 当前只保证资源形态兼容，不保证角色/地形/道具语义正确；补分类是契约级改动 | Out of scope」
- P0 `issues/04-residual-gap-ruling.md:50`：
  > 「Q9 | `modelHard` 归因「模型错」、盲重采样、`viewport`/`role` 未贯通 | **D** | …… | 另立 effort」
- `CONTEXT.md:116`：
  > 「⇒ **「这个角色是谁」只有 DNA 一个家** —— `AssetSpec.role` / `description` 是**资产级**的。」
- `assets/src/ops.ts:1362-1369`（塔防注释）：
  > 「⚠️ **带上 `role`（模型靠它认出「**哪个是砖**」）**、**锚点**与**尺寸**。……而那正是「两份实现必然漂」的样子（横版那份是带锚点的）。」

---

## 3. D-03：`modelHard` 归因与盲重采样

### 3.1 当前状态（E1）

**结论：两项都仍成立，且 P1 的 Q3/Q4 给 `modelHard` 增加了新的「包内容根因」错误类型。**

#### 3.1.1 失败分档（P1 后）

`compileRuntime` 的循环（`assets/src/ops.ts:1174-1215`）按顺序判四档：

| 档 | 判据 | 是否重采样 | 最终文案 | 证据 |
|---|---|---|---|---|
| 上游故障 | `once.kind === "upstream"` / `not-sent` | 否（抛 `upstream`） | 上游错误原文 | `ops.ts:1182-1190` |
| 结构化调用坏档 | `once.kind === "bad"`（http/timeout/truncated/invalid-json/no-tool-use/empty-input） | 是（每次 `continue`） | `once.detail` | `ops.ts:1191` |
| 契约（schema） | `parseGameConfig(once.result.value)` 失败 | 是 | `配置不过契约：…` | `ops.ts:1193-1198` |
| `modelHard` | `auditConfigPipeline(...).resampleable.filter(error)` 非空 | 是，最多 `STRUCTURED_CALL_ATTEMPTS = 3` 发 | **「配置过不了业务校验（模型错，3 发重采样后仍没写对，最后一次）」** | `ops.ts:1205-1214`；`contracts/src/structured-call.ts:25` |
| 确定性（循环后） | `auditConfigPipeline(...).deterministic.filter(error)`，实际上只有「层盖不住世界」等超出 resampleable 的项 | **否** | 「…过不了校验…层盖不住世界是确定性的…去资源清单」 | `ops.ts:1229-1241` |

`runBuild` 汇合点（P1 · Q5）又加了第四档：`deterministic` 非空 ⇒ 立即 `invalid`、不落盘、不重采样（`create-game.ts:625-636`）。

**归因粒度**：`auditConfigPipeline`（`contracts/src/config-audit.ts:34-48`）只把问题分成两桶：

```ts
const resampleable: ConfigIssue[] = [
  ...auditGameConfig(config, ctx.manifest),        // 引用族 + 自洽族
  ...(ctx.design === undefined ? [] : auditEntityIdentity(...)), // 身份族
  ...auditScreenSpace(...),                         // HUD 屏幕空间
];
const deterministic: ConfigIssue[] = [...resampleable, ...auditLayerCoverage(...)];
```

`resampleable` 是 **flat `ConfigIssue[]`**：没有 `family` / `rootCause` / `owner` 字段；调用方只能靠 `where` / `message` 文本区分。`ConfigIssue` 的 `code` 只有三个值（`entity-asset-kind` / `entity-state-frames` / `hud-panel-size`，`game-config.ts:316`），而且 P1 明确不 retrofit 既有构造点——`game-config.test.ts:694-699` 逐字断言「既有错误**不带 code**（条件式 A：不 retrofit 历史构造点）」。

**P1 新增的包内容根因**：

- `entity-state-frames`（Q3）：`chest`/`danger` 引用的资产解析出 <2 帧 ⇒ error（`game-config.ts:410-419`）。如果包里这件就是单帧，config 模型**改不动帧数**；但只要能找到另一件允许 kind 且 ≥2 帧的资产，它就能「换一件」通过——那是 B-01 语义问题，不是判据能救的。语料里有 71 条这种错误（见 §3.4）。
- `hud-panel-size`（Q4）：九宫格下界 / 非九宫格声明尺寸不一致（`game-config.ts:453-495`）。有些是 config 可改（把声明改成包内尺寸），有些是包本身不是九宫格导致「声明大尺寸」永远不合法——后者是包根因。
- `entity-asset-kind`：包里有该 kind 的替代 ⇒ config 可修；包里**完全没有**该 kind ⇒ config 不可修。后者是 P0 的 case I（包缺 ui），P1 Q6a 只在**规划期**堵住新增清单；人工改清单 / `reuseFrom` 旧包 / 独立 `compile-runtime` 仍可产生。

#### 3.1.2 盲重采样

两个循环都是「prompt 在循环外构造一次，循环内原样复用」：

- 规划：`ops.ts:423` 构造 `prompt`，`:435` 进入 `while`；`lastError`（`:431`）只在失败时赋值，**从不进入下一次 `onceThroughTool({ prompt, … })`**。
- 编译：`ops.ts:1098` 构造模板串 `prompt`，`:1174` 进入 `for`；`lastError`（`:1173`）只写进最终 `CommandError`（`:1214`）。
- 塔防：`ops.ts:1421` 构造 `prompt`，`:1457` 进入 `for`；`:1480` 只记 `lastError`，同样不回灌。

⇒ 三发请求体逐字相同。P0 已在 `stage-b-retry6.log` 量过；本次 E3 在 P1 后再次复现（§3.2）。

### 3.2 证据

**E1**：见 §3.1。

**E2（既有测试）**：

| 测试 | 断言 | 与本项关系 |
|---|---|---|
| `packages/assets/tests/compile-runtime.test.ts:130-141` | 业务校验「模型错」⇒ 重采样、抛、不落盘 | 证明分档存在，**不证明归因是否准确** |
| 同文件 `:144-150` | 消息要点出「模型错、重采样后仍没写对」——与「层覆盖是确定性的」分得开 | **测试主动锁定「模型错」文案**（这会让「改文案」触发回归） |
| 同文件 `:179-191` | 缺 `sourceIntent` → 模型错、重采样、不落盘 | 身份族归入 `modelHard` |
| 同文件 `:193-201` | 三发结构不过 ⇒ `invalid`，账上三次 `schema` | 重采样次数 |
| 同文件 `:203-211` | 引用解不到 ⇒ 三发，账上每趟都是成功（无 `failures`） | `modelHard` 是「成功调用但业务失败」 |
| 同文件 `:213-230` | 第一发坏、第二发好 ⇒ `attempts: 2`、出包 | 重采样确实能修复随机错 |
| `packages/pipeline/tests/create-game.test.ts:1008-1050` | P1 · Q5：`reuseConfig` 的屏幕空间越界 / 九宫格 1×1 ⇒ `invalid`，不重采样 | 新增的第四档存在 |
| `packages/contracts/tests/game-config.test.ts:694-699` | 既有错误不带 `code` | 归因码不覆盖引用/身份/屏幕空间 |

**缺口**：没有任何测试断言
1. 第 2/3 发请求体包含上一发错误；
2. `modelHard` 的 flat 列表能区分「config 可修 / 包不可修」；
3. 包根因不会被文案写成「模型错」。

**E3（零付费复现，2026-11-03）**：

**(a) 盲重采样 + 归因**：`node /tmp/e3_d.mjs`，exit 0。用 `fixtures/packs/last-train/v2` + 一份把某个 entity 的 asset 改成 `__没有这个__` 的配置，mock transport 连续返回同一份坏配置。结果：

```
attempts: 3
bodiesIdentical: true
finalMessageHead: "配置过不了业务校验（模型错，3 发重采样后仍没写对，最后一次）："
hasModelBlame: true
kindErrWhere: 'entity "suitcase-1"'
kindErrCode: null          // 「包里没有资源」这条错误没有 code
allResampleableCodes: [null]
```

**(b) 包里根本没有 ui（P0 case I 的当前形态）**：`node /tmp/e3_packrooted.mjs`，exit 0。复制 `fixtures/packs/last-train/v2` 到临时目录，从 manifest 中删掉全部 `ui` 资产与 `ui` 图集（**fixture 本身不改**），让配置把 `hud.panel` / `hud.pip` 指向现有 sprite。结果：

```
attempts: 3
identical: true
kind: invalid
head: "配置过不了业务校验（模型错，3 发重采样后仍没写对，最后一次）："
mentionsModel: true
body:
  · hud.panel: "prop-luggage-pile" 是 sprite，这里要的是 ui
  · hud.pip: "pickup-suitcase" 是 sprite，这里要的是 ui
  · hud.panel.size: 声明的是 72×32，而包里的 "prop-luggage-pile" 是 40×40 …不是九宫格…
hasUiInManifest: false
```

⇒ 包里**完全没有 ui**，config 模型无论怎么写都不可能满足 `hud.panel/pip → ui`；三发重采样逐字相同，最后文案仍写「模型错」。这是 D-03 两条缺口（盲重采样 + 包根因误归因）的同一份 E3 见证。注意：P1 Q6a 之后，**新建**清单不会走到这里；本 E3 走的是「人工改清单 / 复用旧包 / 独立 compile」路径，正是 P0 已确认仍存在的那条。

### 3.3 候选判据与误报边界

**候选 A（反馈，提示词级）**：

> 对 `schema` / `modelHard` 失败，第 n+1 发请求体必须包含第 n 发的结构化失败摘要（最多 N 条、每条截断、不含密钥）；对 `http / timeout / truncated / empty-input` 等非模型故障，不喂回失败摘要。

- 可计算：是。mock transport 抓第 2/3 发 body，断言包含第 1 发 `where/message` 的子串。
- 误报边界：
  - **不能把包根因喂回去**（会把模型往错误方向推）；需要先有归因（候选 B）。
  - **不能把上游故障/空输入当作模型错误喂回去**（`structured-call.ts:30-37` 已把 `empty-input` 单列 6 发）。
  - **长度与注入面**：错误消息可能含资源 id/路径；要做截断与转义；避免把内部路径写进 prompt。
  - **需要真实模型验证**：Q9 裁定原文「改善重采样反馈还需要模型调用验证」；零付费研究只能写判据 + mock，不能证明模型会因此改对。

**候选 B（归因，可计算）**：

> 对 `resampleable` 的每条 error，如果它要求一个 manifest 中**不存在的资源 id**，或要求一个 kind 而 manifest 里**没有任何该 kind 的资产**，则归为「上游/清单根因」，不得进入 `modelHard` 重采样，也不得在文案里写「模型错」。

- 可计算：对 `entity-asset-kind` / `hud.panel|pip` kind 错误，可以直接查 manifest 的 kind 集合；对「包里没有资源」要区分「模型幻觉 id」与「包真的没有」，需要对照 recipe/design 才能判定。
- 误报边界：
  - **幻觉 id vs 包缺失**：同一个 message「包里没有资源」既可能是模型写错 id（可修），也可能是包缺（不可修）；只看 manifest 判不出来。
  - **Q3 状态帧**：如果包里有另一件允许 kind 且 ≥2 帧的资产，「换一件」在判据上可过，但语义上可能错（B-01）；所以「没有备选」是包根因的**必要不充分**条件。
  - **Q4 九宫格**：声明尺寸不一致可能 config 可修（改成包内尺寸），也可能包不是九宫格导致「声明大尺寸」永远不合法；要看具体是哪个子判据。
  - **`decor` 无 kind 锁**：不能把 `decor` 纳入 kind 备选判断。

**候选 C（失败分档，行为级）**：

> 上游/清单根因的 `modelHard` 项改为 `deterministic` 档：不重采样、不落盘，文案明确指向资源清单（与层覆盖同款）。

- 可计算：是，复用 `auditConfigPipeline` 的返回值，但需要新增分类步骤。
- 误报边界：同候选 B；另外这是**失败分档变化**，会改变部分场景的调用次数（3→1）与账上 `failures`，必须核对既有测试对 `attempts` 的断言。

### 3.4 语料重判

**新增 error：0。**

扫描 117 份 `game-config.json`，就近配对 `pack/v*/manifest.json`，用 `auditConfigPipeline` 在 480×270 下重判：

- 113 份能配对 manifest；其中 100 份在 D-04 的 goal 资源统计里有有效 manifest。
- `resampleable` 共 **86 条 error**：
  - `entity-state-frames`：**71 条**（P1 Q3 的新判据；历史 chest/danger 单帧形态，P1 报告另记 75 条，差额来自配对/跳过口径）
  - 无 `code`：**15 条**（身份族「设计实体没有 sourceIntent」；全部来自 2026-10-17/18、10-23、10-25 的历史 config，早于 `sourceIntent` 规则）
  - 其余码：0
- 按「无同 kind 备选」的包根因启发式：**0 条**包根因；86 条都是 config 根因。
  - 特别地，71 条 `entity-state-frames` 的每一份包里都存在另一件允许 kind 且 ≥2 帧的资产 ⇒ 按**确定性判据**它们是「可换一件通过」的；但换哪一件是语义问题（B-01），不是这条判据能解决的。
- `deterministic` 比 `resampleable` 多出的 error：**0 条**（语料里没有层覆盖失败）。
- 口径说明：`auditEntityIdentity` 只在就近能找到 `game-design.json` 的 22 份 config 上跑了；15 条身份 error 只是这部分的下界，不是全语料的上界。`entity-state-frames` / kind 锁不依赖 design，覆盖全部 113 份配对 config。
- 结论：候选 B 在现有语料上**新增 0 条 error**；但语料里也没有「包里完全没有该 kind」的样本——本次 E3 的临时无 ui 包是**fabricated**，不属于语料。不要把「语料零误伤」误读为「包根因不存在」。

### 3.5 修改面

- `packages/assets/src/ops.ts`：
  - 规划循环 `:423-521`、编译循环 `:1098-1215`、塔防循环 `:1421-1500`：把 `lastError` 作为第 n+1 发的反馈附加到 prompt（或在循环内重建 prompt）。
  - 编译循环 `:1205-1214`：按归因结果决定是否 `continue` / 是否改文案。
- `packages/contracts/src/config-audit.ts`：若采用候选 B，新增一个**独立纯函数**（例如 `classifyConfigIssues(config, manifest, issues)`）返回 `{ configFixable, upstreamRooted }`，不改变 `auditConfigPipeline` 的现有返回形状（替代方案），或改返回形状（契约级，见 §3.6）。
- `packages/pipeline/src/create-game.ts`：若采用候选 C，需要让 `runBuild` 汇合点的文案与新的分档一致（已有 `deterministic` 入口，改动很小）。
- 测试：新增 mock transport 的「三发 body 逐字不同（第 2/3 发含第 1 发错误）」、无 ui 包「不重采样 / 文案不再写模型错」、以及既有 `attempts` 断言回归。
- 不新增依赖、不改 Runtime、不新增持久化字段；CLI/MCP 的**输出形状**不变（文案变化不算 shape，但会改变用户可见文本，需在方案里单列）。

### 3.6 契约变更候选（含不改契约的替代）

**候选 A（契约级：新增归因码）**：往 `CONFIG_ISSUE_CODES` 加机器可读码（如 `pack-missing-kind` / `upstream-rooted`），或给 `ConfigIssue` 加 `rootCause` 字段。

- 必要性：只有要做「机器可读的归因」时才需要；人类读 `where/message` 目前也能定位。
- 冲突：P1 已批准的契约裁定逐字写「只给本图**新增或加强**的错误写码（Q1/Q3/Q4 三处），**不 retrofit** 既有构造点」「不改变既有 `severity`/`where`/`message` 语义」（`game-config.ts:303-310`；`rulings-2026-11-02.md` 第三轮 Q-A3）。给引用/身份/屏幕空间错误补码会与这条裁定冲突；D-03 若要码，必须单独审批并说明它服务的是**新增的归因层**，不是 retrofit。
- 影响面：`contracts` 闭集、所有 `ConfigIssue` 构造点（不 retrofit 则只有新层用）、测试、下游渲染；无持久化产物（`ConfigIssue` 不落盘）。
- 不做的后果：归因仍只能靠 `message` 文本或 `where` 解析，脆弱。

**替代 B（不改 `ConfigIssue` 契约）**：新增独立分类纯函数/类型（例如 `ConfigIssueAttribution = { issue: ConfigIssue; root: "config" | "pack" | "unknown" }`），只在 `assets`/`pipeline` 内部使用；`ConfigIssue` 与 `auditConfigPipeline` 的返回形状不动。这是**优先候选**：它满足 Q5「单列审批」的最小面，且不碰 P1 已冻结的 code 闭集。

**替代 C（只改提示词）**：不改任何分类/码，只在第 2/3 发追加 `lastError`。它解决「盲」，不解决「归因」；且把包根因喂回去会误导模型（需要至少一个「哪些错误不喂」的过滤）。

**不实施的后果**：每次系统性错误固定烧 3 发文本调用；包缺 ui/单帧 chest 这类「重抽 config 改不了」的错误仍被写成「模型错」，操作者被指向错误的修复方向（P0 已记录的同一条错误信息不对称）。

### 3.7 前置裁定（逐字）

- P0 `issues/04-residual-gap-ruling.md:50`：
  > 「Q9 | `modelHard` 归因「模型错」、盲重采样、`viewport`/`role` 未贯通 | **D** | 上游诊断、重采样反馈与契约贯通需独立处理；**改善重采样反馈还需要模型调用验证** | 另立 effort」
- P1 已批准的契约裁定（`rulings-2026-11-02.md` 第三轮）：
  > 「**只给本图新增或加强的错误写码**」「**不 retrofit 历史 47 个构造点**」「**不改变现有错误的 severity/where/message 语义**」「新增码集中定义」
- `contracts/src/structured-call.ts:25-28`：
  > 「R16（新）定的**重采样次数**：1 次首发 + 2 次重采样。……⚠️ **它是地板，不是调优结果**……」
- `assets/src/ops.ts:1193-1197`（当前实现注释）：
  > 「业务校验里「模型错」那一族（引用 + 自洽 + HUD 屏幕空间）移进**重采样循环** —— 与 schema 失败同档，模型下一发可能写对。」
- `assets/src/ops.ts:461-464`（规划循环里对 `frames` 候选的注释）：
  > 「⚠️ **不重采样**：这是「模型选了这条候选」，不是「形状写坏了」—— 三发盲重采样只会重复同一件事。」
  —— 这条自白本身说明仓库已经承认「盲重采样只能修随机错」；它没有推广到 `modelHard`。

---

## 4. D-04：设计层缺少 goal 桶

### 4.1 当前状态（E1）

**结论：设计层仍没有结构化的 goal 表达；config 仍要求 `objective.gate` 指向一个 `kind:"goal"` 的实体；唯一的结构化替代是「config 侧孤儿 goal」——它合法、且是今天的主流形态，但设计意图与 gate 之间没有机器可读的链接。**

**设计侧**：

- `GameDesignSpecSchema` 只有四桶 `enemies` / `npcs` / `interactables` / `resources`（`contracts/src/game-design.ts:124-172`），**没有 goal 桶**；`levels[].entities` 只是 id 引用（`:180-190`），不表达「哪个是终点」。
- `winConditions: z.array(z.string())` 是自由文本（`:196`）；文件头逐字写「**`winConditions: []` / `loseConditions: []` —— 「不会死 / 没有终点」是真设计**」（`:110-111`）。
- 设计提示词要求「最终目标是什么（赢了算怎么回事）⇒ 记进 `winConditions[]`」（`game-design/src/prompts.ts:93-94`），并明确「「没有终点」就留空数组」（`:282`）。
- **`winConditions` 下游零消费者**：`designBrief` 只打印 `game.title/genre/camera/coreLoopSteps/player.*/world.*/四桶/levels`（`assets/src/prompt.ts:854-870`），**不打印 `winConditions` / `loseConditions`**；`compileRuntime` 的提示词只插 `${designBrief(design)}`（`ops.ts:1147`）。全仓 grep（非 dist/非 tests）没有生产代码读设计层的 `winConditions`。
- 意图层同样没有 goal 类型：`INTENT_ENTITY_TYPES = ["enemy","npc","interactable","resource"]`（`contracts/src/vocabulary.ts:165`），`ENTITY_BUCKETS` 四桶一一对应（`:173-178`）；游戏设计 schema 的注释逐字说「四个桶与意图层 `entities[].type` 的封闭枚举**一一对应**」（`game-design.ts:162-164`）。

**config 侧**：

- `Objective` 是封闭枚举，V1 只有 `collect-then-reach`；`gate: z.string().min(1)`（`contracts/src/game-config.ts:228-232`）。
- `auditReferences`：`gates = entities.filter(kind === "goal")`；`objective.gate` 找不到对应 goal ⇒ error（`:421-423`）。
- 孤儿合法：`auditEntityIdentity` 的文件注释逐字写「**孤儿合法**：没有 `sourceIntent` 的 config entity（地面 solid / 终点 goal，无设计对位）**不报**」（`:646`）；测试 `game-config.test.ts:538-543` 也锁了这条。
- config 提示词逐字给模型出路（`assets/src/ops.ts:1127`）：
  > 「**孤儿**：地面 `solid` 块、终点 `gate` 这类**设计里没有对位**的结构/派生实体，**不填** `sourceIntent`」
- 配置提示词同时打印 `interactables[].type` / `behavior`（`designBrief`，`prompt.ts:866`）——这是设计层唯一能被 config 模型读到的「终点线索」之一；`levels[].layout` 也被打印（`:869`）。
- `DESIGN_BUCKET_KINDS.interactables` 允许 `chest/pickup/goal/hazard/danger/solid`（`:608`），即设计桶 `interactables` 可以被映射成 `goal`；但 `interactables[].type` 是开放文本，P0 已证不可靠（`game-config.ts:599-603`）：
  > 「同桶误归属不在本矩阵射程内：`interactables` 内部「信号灯→goal 对 / 宝箱→goal 错」靠 `type`/`behavior` 开放文本区分，票 01 已证不可靠 ⇒ 记录为已知限制，不靠摘 `goal`/`solid` 制造误拒来假装解决」

**P1 的影响**：Q6b 给设计契约加了 `resources ≥ 1`（`game-design.ts:285-301`），这是**同一族「设计合法 → config 强制」矛盾**的相邻修复；它没有处理 goal。Q1 的 goal kind 锁（`goal: ["sprite","animation"]`）只影响 goal 实体引用什么资源，不影响「设计有没有 goal」。

### 4.2 证据

**E1**：见 §4.1。

**E2（既有测试）**：

| 测试 | 断言 | 与本项关系 |
|---|---|---|
| `packages/contracts/tests/game-config.test.ts:160-163` | `objective.gate` 悬空 ⇒ 「找不到 id 为 "nope" 的 goal 实体」 | **config 侧强制**存在 |
| 同文件 `:525-537` | 「兼容：已知限制 —— interactable → goal（gate→chest）不拦，同桶无法严格区分」 | 冻结同桶误归属，**不得借 D-04 重开** |
| 同文件 `:538-543` | 「兼容：goal / solid 孤儿不带 `sourceIntent` → 不因归属规则被拒」 | **孤儿 goal 合法**的回归基线 |
| 同文件 `:643` / `:662` | goal 可以引 sprite/animation；goal → ui 拒绝 | P1 Q1 对 goal 的资源 kind 锁 |
| `packages/contracts/tests/game-design.test.ts:130-143` | P1 · Q6b：`resources: []` 拒、非空通过 | 相邻先例 |
| `packages/contracts/tests/game-design.test.ts`（全文） | **没有 goal 桶/goal 字段的用例** | 设计 schema 没有这个能力 |

**E3（零付费，2026-11-03）**：

**(a) schema 对比**：`node /tmp/e3_goal.mjs`，exit 0。构造一份其余字段合法、`winConditions: []` 的设计：

```
designEmptyWinConditionsAccepted: true      // 设计允许「没有终点」
designEmptyResourcesAccepted: false         // P1 Q6b 已收紧
configWithoutGoalEntityAccepted: true       // GameConfigSchema 本身不查 goal
```

**(b) 审计对比**：`node /tmp/e3_goal2.mjs`，exit 0。同一份 config 交给 `auditGameConfig`：

```
[
  { "where": "objective.gate", "message": "找不到 id 为 \"__none__\" 的 goal 实体（现有 goal：无）" },
  { "where": "entities", "message": "一个 pickup 或 chest 都没有 —— 而 objective 是「捡齐 N 件再到达终点」，N = 0 让这一关没有内容" }
]
```

⇒ 设计层合法输出「没有终点」，config 层仍要求 goal + pickup；P1 只修了 pickup 那一半（Q6b），goal 这一半仍存在。注意：schema 本身接受无 goal 的 config，硬要求只在 `auditReferences`（`:421-423`），所以「设计允许、schema 允许、审计拒绝」是三层不一致。

**(c) 语料**（`/tmp/d_goal.mjs`、`/tmp/d_gatekind.mjs`、`/tmp/d_frames.mjs`、`/tmp/d_scan.mjs`，均 exit 0）：

- 49 份 `game-design.json`：**43 份**通过当前 schema；6 份失败全部是历史 `player.id == npcs[0].id`（票 42 之前的失败现场），与本项无关。
- **43/43 份合法设计都没有 goal 桶**（schema 里没有这个桶，属于构造性事实）。
- `winConditions`：43/43 非空；42/43 在 `winConditions / coreLoopSteps / levels[].layout` 文本里出现 goal/exit/终点/出口/抵达/到达/撤离/gate/signal/信号 等词；1/43 没有。
- `interactables[].type` 是高度不一致的自由文本：`chest`(20)、`宝箱`(14)、`level-exit`(3)、`treasure-container`(3)、`撤离点灯柱`(1)、`goal-terminal`(1)、`hazard`(2)、`危险区域（碎石尖刺带）`(5)……；这直接印证 P0「开放文本不可靠」。
- 117 份 `game-config.json`：**116 份**有可解析的 `objective.gate` → goal 实体；**115 份的 gate 是孤儿**（无 `sourceIntent`）；**1 份** gate 带 `sourceIntent:"chest"`（即 `entity-identity-v1` 已冻结的「interactables 同桶误归属」真实样本，`.scratch/entity-identity-v1/runs/2026-10-25-e2e-r2/…/game-config.json`）；**1 份**没有 goal 实体（`out/__probe/empty/site/v1/game-config.json`，是**故意坏的探针夹具**，`gate:"__不存在__"`）。
- 100 份能配对 manifest 的 config 里，gate 指向的资源 kind：**animation 55 / sprite 45**；P1 Q1 的 `goal: ["sprite","animation"]` 对语料 **0 新 error**。

### 4.3 候选判据与误报边界

**候选 A（设计层结构化 goal）**：

> 每个设计关卡必须声明至少一个结构化 goal（新桶或 `levels[].goalId`），且该 id 必须能在 config 中解析到 `kind:"goal"` 实体。

- 精度：可以写得很精确（id 引用、唯一性、与 `levels[].entities` 的一致性）。
- **语料重判**：43/43 份合法设计会新增 error（100%），且 6 份历史失败现场也会多一条。它们不是「真实缺陷」——今天这些设计都通过 config 侧的孤儿 gate 产出了合法 config（116/117）。⇒ **不满足 map 的第 3 项门槛**（新增 error 必须为 0，或每处都能解释为真实缺陷；这里 43 处无法解释为真实缺陷）。
- 误报边界：
  - **孤儿 goal 是合法且主流的**（115/116 语料 config），不能把「没有设计对位」判成错。
  - **设计桶与意图层 `entities[].type` 一一对应**（`game-design.ts:162-164`）；新增第五桶会破坏这个关系，或需要给意图层也加一个 `goal` 类型（更大的契约变更），或把它列为「不参与 intent coverage 的孤儿桶」（新的特例）。
  - **`winConditions: []` 是「真设计」**（`game-design.ts:110-111`）；如果设计可以合法地说「没有终点」，任何「必须有 goal」的判据都必须先处理这个反向情形（要么禁止空 winConditions，要么给 config 增加「无 gate」变体——两者都是契约级）。
  - **`interactables[].type` 不能作为 goal 的判据**：开放文本已证不可靠，且会重开 `entity-identity-v1.1` 的已知限制。
  - **同桶误归属**（`gate → chest`）不得用新判据顺手修；语料有 1 个真实样本，且测试明确锁着「不拦」。

**候选 B（config 侧，已存在）**：

> 每份 config 的 `objective.gate` 必须解析到 `kind:"goal"` 的实体。

- 已经在 `auditReferences`（`:421-423`）实现；**新增 error 0**（`out/__probe/empty` 是故意坏的探针）。这条判据证明「现有能力足够」保证 config 可运行，但不表达设计意图。
- 误报边界：与 D-04 的「设计表达」问题不同层；不要拿它冒充「设计 goal 桶已解决」。

**候选 C（设计文本，不推荐）**：

> `winConditions` 非空，或在 `levels[].layout` 里出现终点词。

- 语料 43/43 非空、42/43 有 goal 词 ⇒ 新增 error 0/1；但**不精确**：文本词表无法证明「终点存在」，且设计提示词允许「没有终点」；`winConditions` 下游零消费者，即使非空也不进入 config prompt。
- 这是「可计算但不精确」的反例，不满足 CONTEXT 判据门槛。

**缺什么语义信息**：需要一个**结构化、可引用、与意图/设计桶兼容**的 goal 表达；仅仅把 `winConditions` 打印进 config prompt 只能改善「模型看得到」，不能建立可审计的链接。

### 4.4 修改面（若 03 决定走契约变更）

- `packages/contracts/src/game-design.ts`：新增桶/字段 + superRefine + `GameDesignSpec` 类型。
- `packages/game-design/src/prompts.ts`：`DESIGN_FIELD_HINTS` 增加字段；`designPrompt`/`build-design` 的覆盖/拒绝逻辑。
- `packages/contracts/src/vocabulary.ts`：若新增意图层类型，改 `INTENT_ENTITY_TYPES` / `ENTITY_BUCKETS`（否则设计层新桶无意图对家，需在 `auditIntentCoverage` 明确豁免）。
- `packages/contracts/src/game-config.ts`：`DESIGN_BUCKET_KINDS` / `DESIGN_BUCKET_ASSET_KINDS`（若新桶需要覆盖规则）。
- `packages/assets/src/ops.ts`：`designCoverageGate` 的 `needAsset` 四桶硬编码（`:287-290`）；`designBrief` 打印新字段；config 提示词对 gate/孤儿规则的说明。
- `packages/assets/src/prompt.ts`：`designBrief`（`:854-870`）目前连 `winConditions` 都不打印；若走「先改善可读性」的路线，这是最小改动点。
- `packages/qa/src/visual.ts`：四桶遍历（`:205-208,231-234`）若新桶参与视觉 identity，需要补。
- 测试/fixture：43 份合法设计 + 6 份历史失败现场会被新 schema 重判；必须提供兼容/迁移路径，否则语料全红。
- 不新增依赖、不改 Runtime；**契约级变更**，需要单独审批。

### 4.5 契约变更候选（含不改契约的替代）

**候选 A（设计契约新增结构化 goal）**：

- 变更内容：`GameDesignSpec` 增加 `goal` 桶或 `levels[].goalId`（必填或可选），并定义它与 `interactables` / `winConditions` 的关系。
- 必要性：只有要「设计意图 → config gate」可审计、可机读时才需要；今天 config 侧孤儿 gate 已能让运行合法。
- 替代方案（不改契约）：
  1. **继续用 config 侧孤儿 goal**（现状）：115/116 语料 config 就是这么做的；`auditReferences` 已保证 gate 存在。代价：设计意图与 gate 无机器链接，模型从 `layout`/`interactables.type` 推断。
  2. **只改提示词**：把 `winConditions` 打印进 `designBrief`，并明确要求 config 模型「从 winConditions/layout 推导 gate」；不改 schema、不新增字段。代价：仍是散文，不能机读；但能消除「设计的目标声明对 config 模型完全不可见」这一事实（`winConditions` 今天零消费者）。
  3. **可选字段 + 不强制**：新增 `levels[].goalId?`，缺省回退到孤儿 gate；新增 error 0（语料都没这个字段，因为可选），但判据没有牙齿，只有前向可追溯性。代价：不会改善现有 43 份设计。
- 影响面：若必填，设计 schema/prompt/覆盖闸/QA/计划覆盖/意图覆盖/所有 fixture 与 43 份语料；若可选，影响面小但判据弱。
- 不实施的后果：设计层不能结构化表达「终点是谁/在哪」；`winConditions` 继续零消费者；设计合法说「没有终点」时 config 无法表达（`objective` 封闭枚举只有 collect-then-reach）；但**运行时仍可通过孤儿 gate 合法产出**，所以这不是「合法配置被拒」，而是**表达力/可追溯性**缺口。

**候选 B（config 契约扩展，允许无 goal 的 objective 变体）**：

- 变更内容：给 `Objective` 增加「无终点」变体（例如 `kind: "survive"`），让「设计说没有终点」也能产出合法 config。
- 必要性：只有要把「没有终点」当成可交付玩法时才需要；它与「设计 winConditions: [] 是真设计」直接对应。
- 替代方案：不改，继续要求每关有 goal（现状）；代价是设计层「无终点」设计不可交付。
- 影响面：`GameConfigSchema`、`auditReferences`、HUD/pickup 规则、Runtime、demo 世界描述、QA、所有站点；这是比候选 A 更深的契约变更。

### 4.6 前置裁定（逐字）

- P0 `issues/04-residual-gap-ruling.md:52`：
  > 「Q10(d) | 设计无 goal 桶，而 `objective.gate` 必须指向 goal 实体 | **D** | 设计层缺桶与 config 契约冲突，超出本图终点 | 另立 effort」
- `CONTEXT.md:415-418`：
  > 「**目标（Objective）** 一关的胜负条件，**封闭枚举**（V1 只有一个变体：捡齐 N 件 → 激活终点 → 到达即胜）。……⚠️ 它与画面是**同一个决定的两种表达**：终点的红/绿就是「是否已捡齐」的显示。」
- `contracts/src/game-design.ts:110-111`：
  > 「**不进 gate**（⚠️ **逐条写下来，免得下一个人往里加**）：…… `winConditions: []` / `loseConditions: []` —— 「不会死 / 没有终点」是真设计」
- `contracts/src/game-design.ts:162-164`：
  > 「四个桶与意图层 `entities[].type` 的封闭枚举**一一对应**（票 03 Q3）：enemy → enemies · npc → npcs · interactable → interactables · resource → resources。」
- `contracts/src/game-config.ts:599-603`：
  > 「同桶误归属不在本矩阵射程内：`interactables` 内部「信号灯→goal 对 / 宝箱→goal 错」靠 `type`/`behavior` 开放文本区分，票 01 已证不可靠 ⇒ 记录为已知限制，不靠摘 `goal`/`solid` 制造误拒来假装解决」
- `contracts/src/game-config.ts:646`：
  > 「⚠️ **孤儿合法**：没有 `sourceIntent` 的 config entity（地面 solid / 终点 goal，无设计对位）**不报**。」
- P1 `game-design.ts:285-299`（相邻先例）：
  > 「为什么落在设计层、而不是放行 config：`interactables` 可能落成 goal / solid（purpose 是开放文本，不可机读），不能保证产出一个 pickup/chest；只有 `resources` 桶在语义上承诺「可拾取之物」。⇒ 要求设计**至少写一个 resource** 是唯一可机械判定的修法。」

---

## 5. E3 复现记录（零付费、零模型、零生图）

所有脚本在 `/tmp`，只读语料或使用临时目录；**未写入仓库**。全部调用 `packages/*/dist`（P1 后构建）。

| 命令 | 退出码 | 用途 / 关键结果 |
|---|---|---|
| `node /tmp/d_scan.mjs` | 0 | 语料总扫：117 config / 113 配对 manifest / 86 resampleable（71 state-frames + 15 无码身份）/ 0 包根因 / 0 deterministic 额外；manifest role 982 件、0 空 |
| `node /tmp/d_goal.mjs` | 0 | 43 份合法设计：0 goal 桶、0 空 resources、0 空 winConditions、42 有 goal 词、1 无；`interactables[].type` 取值表 |
| `node /tmp/d_gatekind.mjs` | 0 | 100 份配对 config 的 gate 资源 kind：animation 55 / sprite 45 |
| `node /tmp/d_frames.mjs` | 0 | 71 条单帧 chest/danger；按「无同 kind 备选」判据 **0 条**不可修 |
| `node /tmp/d_rolelen.mjs` | 0 | role 长度：min 2 / median 16 / p95 26 / max 32；0 换行；总计 15,239 字符 |
| `node /tmp/d_designfail.mjs` | 0 | 49 份设计中 6 份失败；全部是历史 `player.id == npcs[0].id` |
| `node /tmp/e3_d.mjs` | 0 | D-01：计划期默认视口放行 500×280、640×360 下游闸拒绝；D-02：横版 body 无 role / 塔防 body 有 role；D-03：3 发 body 逐字相同、文案「模型错」 |
| `node /tmp/e3_packrooted.mjs` | 0 | D-03：包里删掉全部 ui（临时副本）⇒ 3 发同 body、文案「模型错」、`hasUiInManifest:false` |
| `node /tmp/e3_goal.mjs` / `node /tmp/e3_goal2.mjs` | 0 / 0 | D-04：设计接受 `winConditions: []`；schema 接受无 goal 的 config；`auditGameConfig` 拒绝并点名 goal 缺失 |
| `pnpm exec vitest run packages/assets/tests/compile-runtime.test.ts packages/assets/tests/compile-td-game.test.ts packages/assets/tests/plan-background-gate.test.ts packages/assets/tests/prompt.test.ts packages/contracts/tests/game-design.test.ts packages/contracts/tests/game-config.test.ts packages/pipeline/tests/create-game.test.ts` | **0** | **7 files / 250 tests passed**（2026-11-03 14:17；日志 `/tmp/e2_tests.log`） |

补充：`git status --porcelain` 在本票开始时只有 `?? .scratch/design-to-config-residual-bd-audit-v1/`；本票只新增本报告与票的 `## Answer`。

---

## 6. 未覆盖与限制

1. **D-01 没有端到端 E3**：没有跑完整 `runUnderstanding`（那需要 5 个 mock 上游响应 + 落盘），只做了 `planAssets` 单步 + 下游 gate 的对照；`runUnderstanding` 的调用链证据是 E1。
2. **D-02 没有模型行为证据**：只证明「发出去的 body 缺 role」；没有证明「加上 role 后模型选地形更准」（需要付费真跑）。P0 Q9 裁定也把「改善重采样反馈」列为需要模型调用验证。
3. **D-03 的包根因是 fabricated**：无 ui 包是临时副本，不是既有语料；语料里 0 条包根因。这只能证明「判据会响」，不能证明「真实跑里经常发生」。P1 Q6a 之后，新建清单在规划期就被挡住，剩下的是人工改清单/复用旧包/独立 compile 路径。
4. **D-04 的设计 goal 判据没有实现**；语料统计只能说明「一旦落判据会新增 43 条 error」，不能说明「这 43 条都是真实缺陷」——report 的立场是它们不是（现有孤儿 gate 能产出合法 config）。
5. **多关卡**：`BuildInput` 无 `levelId`，所有审计取 `levels[0]`（P1 已知限制未变）；本票未展开多关。
6. **82 份 manifest 解析失败**：历史版本，未纳入 role 统计；未重写、未修复。
7. **site 装配期**：`assembleFromConfig` 不接受 viewport；本票没有改动它，也没有跑站点。

---

## 7. 给 03 的裁定输入（不是裁定）

| 编号 | 若按 map 四项门槛，需要 03 回答的问题 | 本票已知事实 |
|---|---|---|
| D-01 | 「当前仍成立」是否足以支持修复？还是因为生产壳固定 480×270、且 `viewport` 按 CONTEXT 是壳常量，应走「单常量 / 早拒」替代而不是贯通？ | E1 缺口真实；E3 可复现分叉；语料 0 误伤；修改面可控；契约候选是 API 增量（可选字段） |
| D-02 | 只把已有 `role` 印到横版清单，是否属于「当前仍成立且判据可写」的修复？还是因为它不产生确定性失败、且 `role` 语义仍是 B-01，应推迟？ | E1 不对称真实；E3 两份 body 见证；E2 无任何断言；语料 0 误伤；改动只碰提示词 |
| D-03 | 归因/反馈是否需要付费真跑才能过「判据可写 + 语料零误伤」？是否值得先做「不改契约的分类纯函数 + 不喂包根因」？ | 两条缺口都真实；E3 在 P1 后复现；语料 0 包根因；P1 的 code 闭集不允许 retrofit；Q9 已裁「需模型调用验证」 |
| D-04 | 「设计没有结构化 goal」是修复 / 推迟 / 剔除？现有孤儿 gate 是否已经足够（即问题是否只剩「表达力/可追溯性」）？若修，是设计契约新增字段、还是 config 允许无 gate、还是只把 `winConditions` 打印给 config 模型？ | 设计接受「没有终点」；config 要求 goal；`winConditions` 下游零消费者；语料 43/43 设计无 goal 桶、116/117 config 靠孤儿 gate 合法；同桶误归属与孤儿合法均有冻结裁定 |
