# Design-to-Config Residual B/D Audit V1：五项修复合并方案

- **Date**：2026-11-03
- **票**：[06 合并方案](issues/06-consolidated-plan.md)（grilling · HITL）
- **基线**：`main` @ `3b1b61d`
- **输入**：[01 B 类研究](research/01-b-class.md)、[02 D 类研究](research/02-d-class.md)、
  [03 统一裁定](issues/03-disposition-ruling.md)、[04 publish-gate 研究](research/04-publish-gate-config-identity.md)、
  [05 方案票切法](issues/05-plan-ticket-slicing.md)
- **性质**：决策就绪方案与验证计划。**不修改生产代码、不批准契约、不启动付费调用、不生图、不 commit。**
  本文件不构成任何实施授权。

> **2026-11-03 票 06 裁定摘要（HITL，amber）**
>
> | 问题 | 裁定 |
> |---|---|
> | Q1 D-01 修复面 | **A：全链贯通，包含站点**；站点不得留给 Q8 |
> | Q2 D-03 归因与循环 | **只改编译循环**；归因增加**保守兜底**：无法可靠确定根因 ⇒ config 可修，不硬拒 |
> | Q3 publish-gate | **A：共享 `assertPublishableQa` 现场复验**；`configPath` 缺省跳过 |
> | Q4 契约候选 | 全部维持原状态；**D-01 API 增量必须进入 07 单列审批** |
> | Q5 付费验证 | 写入方案（2 场景、≤6 次文本调用）；**本轮不授权执行** |
> | Q6 实施顺序 | **A：D-02 → B-02 → publish-gate → D-01 → D-03** |
>
> 章节顺序即实施顺序；五项各自独立测试、独立回退。五项进入同一份方案 **不等于**一次性批准。

---

## 0. 方案总览

| 顺序 | 项 | 处置 | 判据一句话 | 契约候选 |
|---|---|---|---|---|
| 1 | **D-02** | 修复 | 横版与塔防清单的每条资产行都打印 manifest `role` | 无 |
| 2 | **B-02** | 修复 | `auditReachability(...)` 的 error 进入 `deterministic` 档，不进 `resampleable` | 可选 `unreachable` 码（不默认采用） |
| 3 | **publish-gate** | 修复 | 非 TD、有 `configPath` 时现场重跑 reachability，有 error 即拒绝发布 | `subject.configChecksum`（仅备选） |
| 4 | **D-01** | 修复 | 同一次调用的 viewport 在理解 / 构建 / 站点装配各阶段逐次相等 | viewport API 增量（**必须进 07 审批**） |
| 5 | **D-03** | 修复 | 只有确定可修的 config 错误进入反馈；确定的清单根因硬拒；不确定 ⇒ config 可修 | 无（对外归因码不纳入） |

**证据分级**：E0 推测 · E1 源码 · E2 测试 · E3 真实产物 + 零付费运行证据。
本方案引用的行号均指基线 `3b1b61d`。

---

## 1. D-02：`role` 提示词贯通

### 1.1 当前缺口与证据

塔防清单打印 manifest `role`，横版清单不打印 —— 同一份 `AssetPackEntry`，两种模型可见性。

- **E1**：横版 `resourceBrief` 的行模板不含 `a.role`（`packages/assets/src/ops.ts:952-963`）；
  塔防 `tdResourceBrief` 的行模板含 `${a.role}`（`ops.ts:1373-1379`）；
  `AssetPackEntry.role` 是必填字符串（`packages/contracts/src/assetpack.ts:167`），
  由 `pack.ts:1214` 从 `AssetSpec.role` 原样拷入。
- **E2（缺失，不是通过）**：`compile-runtime.test.ts:387-420` 的 `lineOf` 只断九宫格 / 锚点 / 动画；
  `compile-td-game.test.ts:305-363` 只断九宫格；没有任何断言检查横版清单包含 `role`。
- **E3**：真发出去的两份 body —— 横版 `sideHasRole: false`（查 `pickup-suitcase` 的
  「失物收集物：皮箱，摆三处」），塔防 `tdHasRole: true`（查 `tile-floor` 的「场地砖…」）。
  语料 982 件可解析资产：`role` 非空 **982/982**、含换行 **0**、122 个不同取值、最长 32 字符、总计 15,239 字符。

### 1.2 修复判据

> 横版 `resourceBrief` 与塔防 `tdResourceBrief` 的**每一条资产行**都必须包含该资产在 manifest 中的
> `role`；两份清单的 `role` 段由**同一个渲染函数**产出，不得各写一份。

- 精确、可计算：`role` 是 manifest 必填字符串；用现有 spy + `lineOf` 可逐条断言。
- 误报边界：**只要求「印出来」，不要求语义正确**。`role` 仍是自由文本，**不得**升级为
  「地形 / 道具 / 角色」的机读分类 —— 那会重开 B-01（03 已裁推迟）。
- 空 `role` 是契约允许的。渲染函数对空值输出 `（role 为空）`，保持「一行一资源」的结构；
  当前语料 0 命中，不影响既有产物。

### 1.3 最小修改面

| 文件 | 改动 |
|---|---|
| `packages/assets/src/ops.ts` | 在 `nineSliceNote`（`:945-951`）旁新增 `roleNote(a): string`：把 `role` 的连续空白折成单空格、去首尾，输出 `<role> · `；空值输出 `（role 为空） · `。横版行模板（`:958`）与塔防行模板（`:1377`）都改用它。更新两处文档注释。 |
| 测试 | `compile-runtime.test.ts` / `compile-td-game.test.ts` 各加 `role` 断言；新增 parity 断言（同一 fixture 包，两份 body 都含同一组 role）；新增含换行 role 的单行化用例。 |

不新增依赖；不改 schema、Runtime、CLI/MCP 形状、落盘产物。

### 1.4 测试矩阵

| 类型 | 用例 | 断言 |
|---|---|---|
| 正 | 横版 `compileRuntime`（`fixtures/packs/last-train/v2`） | 每条资产行含 manifest `role` |
| 正 | 塔防 `compileTdGame`（`fixtures/packs/counter-siege/v4`） | 同上 |
| 边界 | 同一包的横版 / 塔防 body | 同一组 role 都出现（parity） |
| 边界 | `role: "a\nb"` 的临时 manifest | body 中为 `a b`，不出现换行 |
| 边界 | `role: ""` | 输出 `（role 为空）`，行结构不破 |
| 回归 | 既有 `lineOf` 九宫格 / 锚点 / 动画断言 | 原样通过 |
| 负 | 横版 brief 去掉 role | 新测试失败（防回退） |

### 1.5 零付费验证

```text
pnpm exec vitest run packages/assets/tests/compile-runtime.test.ts \
  packages/assets/tests/compile-td-game.test.ts
# 期望 exit 0
```

- 语料重判：不改变任何 config 的有效性，**新增 error 预测 0**。
- **不能证明**模型选地形更准 —— 那需要付费真跑；零付费只证明 body 含 `role`。

### 1.6 风险与回退条件

- **token 成本**：982 件合计 15,239 字符；单份包通常 10–20 件，增量小，但属付费提示词变更。
- **注入面**：`role` 是自由文本；`roleNote` 只折空白，不转义反引号。当前语料无反引号 / 换行；
  若将来允许，需要转义策略（本方案不引入）。
- **语义误读**：模型可能把 `role` 当成机读分类。提示词里不新增「role 是类别」的说法；
  这是可见性修复，不是 B-01。
- **回退**：删除 `roleNote` 与两处调用即可；新测试会随回退一起删除。

### 1.7 契约变更候选

无。`AssetPackEntry.role` 已在契约中。

---

## 2. B-02：`reachability` 进入 deterministic 档

### 2.1 当前缺口与证据

`auditReachability` 仍只由 QA 调用；config 编译与 `runBuild` 汇合点都不跑它。

- **E1**：`auditReachability` 定义在 `packages/contracts/src/reachability.ts:44-225`，
  唯一生产调用点是 `packages/qa/src/gameplay.ts:80`；
  `auditConfigPipeline`（`packages/contracts/src/config-audit.ts:34-49`）只含
  `auditGameConfig` / `auditEntityIdentity` / `auditScreenSpace` / `auditLayerCoverage`，**不含** reachability；
  `auditGameConfig` 的「可通关族」只是警告（`game-config.ts:562-584`），不是图搜索。
- **E2**：`reachability.test.ts:35-179`（真夹具通、200px 沟、100px 墙、40px 沟/墙、120px 高 pickup、
  出生点无落脚点不报、玩家资源解不到不报）；`gameplay.test.ts:129-148` 证明 QA 族会报。
  01 复跑 6 文件 194 tests exit 0。
- **E3**：134 对 config+manifest 上 `auditReachability` 返回 **0 条 error**；
  `fixtures/game-configs/last-train.json` + `fixtures/packs/last-train/v2` 也是 0。

### 2.2 修复判据

> `auditReachability(config, manifest)` 的 `severity: "error"` 项必须出现在
> `auditConfigPipeline(...).deterministic` 中，且**不得**出现在 `.resampleable` 中。

- 精确、可计算：`auditReachability(...).length === 0` 是既有判据；它偏向漏报、不偏向误报
  （源码自述：玩家能力一律往强里估，只报「到不了」）。
- 失败分档：编译循环**不重采样**（不进 `resampleable`）；循环后的 deterministic 检查硬拒；
  `runBuild` 汇合点同样硬拒。QA 原有 `reachability` 判据保留。
- 文案：指向「布局 / 地形不可达」，**不写「模型错」**。

### 2.3 最小修改面

| 文件 | 改动 |
|---|---|
| `packages/contracts/src/config-audit.ts` | import `auditReachability`；在 `deterministic` 数组里追加 `...auditReachability(config, ctx.manifest)`；更新文件头「两档」说明。 |
| `packages/assets/src/ops.ts` | 循环后的确定性失败文案（`:1229-1241`）目前写死「层盖不住世界是确定性的…去资源清单」。改为**家族中性**：逐条 issue 已自带指引，结尾只说「确定性失败、重抽 config 改不了、按每条提示改布局/配置或资源清单」。 |
| `packages/pipeline/src/create-game.ts` | 汇合点文案（`:625-636`）已是中性指引，仅把「改配置或改清单」补成「改配置、布局或清单」。 |

不新增依赖；不改 Runtime、CLI/MCP 形状、ConfigIssue 形状。

**行为变化（须在 07 明示）**：不可达 config 的失败阶段从 QA 提前到编译 / 汇合点；
退出码仍是 `invalid`(4)，但落盘时机与文案不同。默认 QA 路径的最终结果不变（QA 仍会报同一条）。

### 2.4 测试矩阵

| 类型 | 用例 | 断言 |
|---|---|---|
| 正 | `auditConfigPipeline` + 100px 墙 config | `deterministic` 含 reachability error；`resampleable` **不含** |
| 负 | 同上，检查 `resampleable` | 长度不因 reachability 增加 |
| 正 | `compileRuntime` + 不可达 config | 只发 1 次（不重采样）、`invalid`、不落盘 |
| 文案 | 同上 | 含「不可达 / 布局」；不含「模型错」 |
| 正 | `runBuild` 的 `reuseConfig` + 不可达 config | 在 QA 前硬失败 |
| 回归 | `last-train` fixture | 编译 / 汇合点仍通过 |
| 回归 | QA `reachability` 判据 | 仍存在于 `checked` 且照常报告 |
$1
> `packages/contracts/tests/config-audit.test.ts` 为**新增**测试文件；既有 `game-config.test.ts` 不含 pipeline 档位断言。

### 2.5 零付费验证

```text
pnpm exec vitest run packages/contracts/tests/reachability.test.ts \
  packages/contracts/tests/config-audit.test.ts \
  packages/assets/tests/compile-runtime.test.ts \
  packages/pipeline/tests/create-game.test.ts \
  packages/qa/tests/gameplay.test.ts
# 期望 exit 0
```

语料重判：134 对 config+manifest，`deterministic` 新增 error **预测 0**；任何新增必须逐条解释为真实不可达。

### 2.6 风险与回退条件

- **失败阶段前移**：`qa: null` 或手工改 config 的路径从「QA 拦」变成「编译/汇合点拦」。
- **文案回归**：`compile-runtime.test.ts:144-150` 一类锁文案的测试需要按新语义更新；
  更新必须保留「确定性、不重采样」的断言。
- **多关卡**：`BuildInput` 无 `levelId`，仍取 `levels[0]`（既有已知限制，不扩大）。
- **回退**：删除 `config-audit.ts` 的一行 spread，恢复两条文案；测试随之回退。

### 2.7 契约变更候选

**可选 `ConfigIssue.code: "unreachable"`（提出，不默认采用，未批准）**

| 项 | 内容 |
|---|---|
| 变更内容 | `CONFIG_ISSUE_CODES` 增加 `"unreachable"`；`auditReachability` 的报告项带该码 |
| 必要性 | 只有需要机读区分「不可达」与其它 deterministic 失败时才需要；默认方案用 `where` / `message` 即可 |
| 不改契约的替代 | 不加码；调用方按文案 / `where` 区分；或返回 `deterministic` 时外部再调一次 `auditReachability` |
| 影响面 | contracts 闭集、QA 报告消费者、测试；无持久化字段 |
| 不做后果 | 失败文案只能家族中性；机读消费者无法在不解析文本的前提下区分 |
| 兼容 / 迁移 | 可选字段式增量；旧报告无码不受影响 |
| 07 批准问题 | 本轮是否需要机读码？默认 **不需要** |

---

## 3. publish-gate：standalone `site` / `assemble_site` 的 reachability 复验

### 3.1 当前缺口与证据

发布闸只比较 pack 身份；`configPath` 只用来识别 TD。一份绿色报告属于 config A，仍可发布带不可达布局的 config B。

- **E1**：`subjectProblem`（`packages/pipeline/src/publish-gate.ts:112-121`）只比
  `packId` / `packVersion` / 可选 `manifestChecksum`；`configPath` 的唯一用途是 `formatOf(...) === TD_CONFIG_FORMAT`
  时提前返回（`:147`，`formatOf` 在 `:75-83`）。站点装配重跑 `auditGameConfig`（`site.ts:191`）、
  `auditGeometry`（`:205`）、`auditScreenSpace`（`:210`），**不重跑** `auditReachability`。
  QA 实际是 **7 条**判据（`packages/contracts/src/qa.ts:111-160`），第七条
  `visual-config-coherence`（`qa/src/visual.ts:196-277`）同样不被站点重跑。
- **E2**：04 复跑 5 文件 58 tests exit 0；没有任何测试构造「报告属于 A、config 是 B」。
- **E3**：CLI `site` 用 config A 的绿报告发布 config B（A + 100px 墙），
  显式 `--qa-report` 与 out 树 auto 查找两条路径都 **exit 0**；config B 有 3 条 reachability error，
  而 `auditGameConfig` 0 条 error。站点装配自身也不会因 reachability 拒绝。

### 3.2 修复判据

> 非 TD、且 `configPath` 存在时，发布闸必须满足
> `filter(auditReachability(parseGameConfig(configPath), manifest), i => i.severity === "error").length === 0`；
> 否则 `CommandError("invalid")`（退出码 4）阻断发布。

- **缺省策略**：`configPath` 未提供 ⇒ **跳过**该项检查（与 TD 跳过同形）。四个真实发布入口
  （CLI `build`、CLI `site`、MCP `create_game`、MCP `assemble_site`）**都传** `configPath`
  （`cli.ts:281-284,717-720`；`server.ts:374-378,433-436`）；缺省只服务库调用与既有测试。
  **实现时必须逐入口复核**，缺省跳过不得成为发布入口的逃逸路径。
- 不改契约、不引入完整 config 身份绑定、不扩大到 `visual-config-coherence`。
- 失败文案：**「这份 config 本身不可达」**，不是「报告不能证明属于这份 config」。

### 3.3 最小修改面

| 文件 | 改动 |
|---|---|
| `packages/pipeline/src/publish-gate.ts` | import `parseGameConfig` / `auditReachability`；新增 `configProblem(configPath, manifest)`；在报告通过 `subjectProblem` / `verdictProblem` 之后、返回之前调用（显式报告与 auto 查找两条分支共用）。`configPath` 缺省 ⇒ 不调用。config 解析失败 ⇒ 跳过，由装配器报它自己的 schema 错（不在这里重复 Ownership）。 |

不新增依赖；不改 Runtime、CLI/MCP 参数与返回形状；退出码语义不变（`invalid` 4）。

### 3.4 测试矩阵

| 类型 | 用例 | 断言 |
|---|---|---|
| 正 | 绿报告 A + config B（100px 墙） | gate 拒绝；退出码 4 |
| 正 | CLI `site`（显式报告） | 拒绝；站点不产出 |
| 正 | CLI `site`（auto 查找报告） | 拒绝 |
| 正 | MCP `assemble_site` | 拒绝 |
| 正 | CLI `build` / MCP `create_game` | 同一 config 通过；与 QA 结果一致（幂等） |
| 边界 | 库调用 `assertPublishableQa` 不带 `configPath` | 跳过；既有断言不变 |
| 边界 | TD config | 提前返回；不跑 reachability |
| 回归 | 既有 58 条 gate 测试 | 通过 |
| 审计 | 四个发布入口的 `configPath` 传参 | 代码复核 + 集成测试；缺一即失败 |

### 3.5 零付费验证

```text
pnpm exec vitest run packages/pipeline/tests/publish-gate.test.ts \
  packages/cli/tests/cli-site-gate.test.ts \
  packages/mcp/tests/assemble-site-qa-gate.test.ts \
  packages/contracts/tests/reachability.test.ts \
  packages/qa/tests/gameplay.test.ts
# 期望 exit 0
```

复现脚本（04 §5.1 同款，全部在 `/tmp`）：config A 绿报告 + config B ⇒ **期望 exit 4**；
config A + A ⇒ exit 0。语料 21 个 report/config/pack 三元组，reachability 新增 error 预测 0。

### 3.6 风险与回退条件

- **手写 config 工作流**：只有**真的不可达**才被拒；可达的手写 config 照常发布（这是选 gate 重跑而非
  `configChecksum` 的理由）。
- **报告仍只钉 pack**：本项不证明报告属于这份 config；它只保证「当前 config 自身可达」。
  第七条的洞仍在（见 §10 交接）。
- **解析失败跳过**：由装配器报 schema 错；不会让不可解析的 config 发布成功。
- **回退**：删除 `configProblem` 调用即可；无契约、无形状残留。

### 3.7 契约变更候选

**`subject.configChecksum`（仅备选，不默认采用，未批准）**

| 项 | 内容 |
|---|---|
| 变更内容 | `QAReportSchema.subject`（strict）新增可选 `configChecksum`（`sha256:<hex>`）；`create-game.ts:684-691` 注入；gate 比较 `fileChecksum(configPath)` |
| 必要性 | 只有要「证明报告属于这份 config」时才需要；本方案选现场重跑，不依赖它 |
| 不改契约的替代 | 现场重跑（本方案）；out 树兄弟 config 字节比较；`delivery.config.file` 比较 |
| 影响面 | `contracts/qa.ts`、`create-game.ts`、`publish-gate.ts`、4 组测试、文档；`subject` 是 strict，必须契约与生产者同批改 |
| 不做后果 | 报告仍无法证明 config 身份；但 reachability 已被现场重跑，配置敏感判据的剩余洞只剩第七条 |
| 兼容 / 迁移 | 26/29 历史报告有 subject、0 有 `configChecksum`；若必填会全部拒；若可选缺席跳过则洞仍在 |
| 07 批准问题 | 现在做 / 以后做 / 不做？默认 **不做** |

---

## 4. D-01：`viewport` 全链贯通

### 4.1 当前缺口与证据

同一次调用的 viewport 在规划 / VDS / 编译 / QA / 站点各取各的值。

- **E1**：`UnderstandingInput` 没有 `viewport`（`packages/pipeline/src/create-game.ts:48-77`）；
  `runUnderstanding` 的 `compileVisualDesign` 硬编码 `DEFAULT_VIEWPORT`（`:380`），
  `planAssets` 调用**不传** viewport（`:390-400`，`ops.ts:422` 回落到默认）；
  编译 / 汇合点 / QA 用 `input.viewport ?? DEFAULT_VIEWPORT`（`:598,629,669`）。
  站点侧 `assembleSite` / `assembleFromConfig` 的参数面没有 viewport（`demo/src/site.ts:145-156`、
  `assemble.ts:36-42`）；`auditScreenSpace` / `auditTdWorldSize` 用 `demo` 的 `VIEWPORT`
  （`site.ts:210`、`td/site.ts:130,143`）；`buildWorld` / `buildTdWorld` 在内部多处读 `VIEWPORT`
  （`world.ts:150,158,168,236,244`；`td/world.ts:102,104,113,295`）。
  两个常量：`assets/src/ops.ts:877` 与 `demo/src/draw.ts:15`，当前同值 480×270。
- **E2**：`demo/tests/world.test.ts:279-284` 锁「视口是常量 480×270，资源包不许改」；
  `qa/tests/layers.test.ts:79-86` 证明 QA 会消费调用方给的视口；
  **没有**任何测试证明理解 → 规划 → 编译 → QA → 站点用的是同一个数。
- **E3**：规划期默认 480×270 放行 500×280 的背景；下游 640×360 的闸拒绝同一份清单
  （`backgroundCoverageGate` 报「背景盖不住世界」）。生产壳默认 480×270，今天不触发；
  程序化自定义视口会触发。

### 4.2 修复判据

> 对**同一次调用**，以下阶段使用的 viewport 必须逐次相等：
> ① 理解段：VDS 画布、`planAssets` 的背景闸与提示词；
> ② 构建段：编译提示词、汇合点审计、QA 层覆盖；
> ③ 站点装配：`auditScreenSpace` / `auditTdWorldSize`、`buildWorld` / `buildTdWorld`、
> 世界描述里的 `viewport`。

- **只比较 viewport，不比较 `world.size`**：横版允许 `world.size.w` 任意大、高必须等于视口高；
  塔防要求世界正好等于视口。把世界尺寸纳入判据会误伤。
- **不要求 viewport 等于某个数值**：它仍是外壳常量，值由壳决定；判据只要求「同一次调用内一致」。
- **不从资源包 / VWS 推导视口**：`visual-design.ts:12-14` 与 `world.test.ts:279` 都锁死这条。
- **默认值不变**：CLI/MCP 不新增参数、不传新字段，继续走 480×270。

### 4.3 最小修改面

| 文件 | 改动 |
|---|---|
| `packages/pipeline/src/create-game.ts` | `UnderstandingInput` 增可选 `viewport?: { w: number; h: number }`；`runUnderstanding` 解析一次 `const viewport = input.viewport ?? DEFAULT_VIEWPORT`，传给 `compileVisualDesign`（`:380`）与 `planAssets`（`:390`）。构建段沿用同一解析结果（同一个 `input.viewport`；`CreateInput` 是交集，类型兼容）。 |
| `packages/demo/src/assemble.ts` | `AssembleOptions` 增可选 `viewport`；按 `format` 分派时传给横版 / 塔防站点装配。 |
| `packages/demo/src/site.ts` | `SiteOptions` 增可选 `viewport`；解析 `const viewport = opts.viewport ?? VIEWPORT`；`buildWorld(..., { viewport })`、`auditScreenSpace(viewport, ...)` 使用它。 |
| `packages/demo/src/td/site.ts` | 同上：`buildTdWorld(..., { viewport })`、`auditTdWorldSize(viewport, ...)`、`auditScreenSpace(viewport, ...)`。 |
| `packages/demo/src/world.ts` | `buildWorld` 的 opts 增可选 `viewport`；把函数内**每一处** `VIEWPORT` 读取改为局部 `viewport`（背景构建、两个 fallback 的 HUD 盒、`hudFallback`、最终返回的 `viewport`）。 |
| `packages/demo/src/td/world.ts` | 同上（`:102,104,113,295`）。 |
| `packages/assets/src/ops.ts` | 修正 `:99-101` 的失真注释（原文说 create 链两处都传，实际规划期不传）。 |
| CLI / MCP | **不改**。`cli.ts:273,684,699`、`server.ts:347,369` 继续传壳常量；`create` / `create_game` 继续不传理解段 viewport（默认）。 |

**实现纪律（用户特别要求）**：不能只把 viewport 传到最外层、内部 world builder 再读常量。
实现时必须逐行替换 `buildWorld` / `buildTdWorld` 内的 `VIEWPORT` 引用，并用**自定义视口测试**证明
该值到达：世界描述的 `viewport`、背景层尺寸、HUD fallback 盒、站点屏幕空间审计。
运行时外壳读的是 `world.viewport`（`demo/src/shell/scene.ts:17`、`shell/td/scene.ts:28`），
不是构建期常量，因此站点装配传入的自定义值会被外壳真正消费。

不新增依赖；不改 Runtime；不把 viewport 写入资源包 / VWS / `site.json`。

### 4.4 测试矩阵

| 类型 | 用例 | 断言 |
|---|---|---|
| 正 | `createGame({ viewport: { w: 500, h: 280 } })`（mock transport） | VDS viewport、plan 背景闸 / 提示词、编译提示词 `world.size.h`、QA viewport 均为 500×280 |
| 正 | `planAssets({ viewport: 500×280 })` + 高 280 的背景 | 通过（默认 480×270 也通过；640×360 拒绝） |
| 正 | `assembleSite({ viewport: 500×280 })` | 世界描述 `viewport` = 500×280；`auditScreenSpace` 用 500×280；`buildWorld` 背景 / HUD fallback 同步 |
| 正 | `assembleTdSite({ viewport: ... })` | `auditTdWorldSize` / 屏幕空间 / 世界描述同步 |
| 边界 | 默认路径不传 viewport | 仍是 480×270；`world.test.ts:279` 原样通过 |
| 负 | 只传最外层、内部仍读 `VIEWPORT` | 自定义视口用例失败 |
| 回归 | 既有 `plan-background-gate` / `compile-runtime` / `create-game` | 通过 |

### 4.5 零付费验证

```text
pnpm exec vitest run packages/pipeline/tests/create-game.test.ts \
  packages/demo/tests/world.test.ts packages/demo/tests/site.test.ts \
  packages/demo/tests/td-site.test.ts packages/assets/tests/plan-background-gate.test.ts \
  packages/assets/tests/compile-runtime.test.ts packages/qa/tests/layers.test.ts
# 期望 exit 0
```

语料重判：117/117 份 config 的 `world.size.h = 270`，默认路径不变；新增 error 预测 0。
没有历史产物在自定义视口下跑过，语料**不能**证明修好后的端到端行为 —— 只能由新测试证明。

### 4.6 风险与回退条件

- **契约候选依赖**：`UnderstandingInput.viewport`、`AssembleOptions.viewport`、`SiteOptions.viewport`
  都是 API 增量，**必须经 07 单列审批**。若审批不通过，D-01 **标记推迟**，
  不得退化成「只合并两个常量」后仍声称完成。
- **触碰 `demo` 世界构建器**：`buildWorld` 多处读常量；漏一处就会出现「外层传了、内层没吃」。
  自定义视口测试必须覆盖背景、HUD fallback、世界描述三条路径。
- **默认断言**：`world.test.ts:279-284` 保留；新增用例只证明自定义值，不改默认值语义。
- **回退**：按文件移除可选字段与透传；默认路径零行为变化。

### 4.7 契约变更候选

**viewport API 增量（必须进入 07 单列审批，未批准）**

| 项 | 内容 |
|---|---|
| 变更内容 | `UnderstandingInput.viewport?`、`AssembleOptions.viewport?`、`SiteOptions.viewport?`；`buildWorld` / `buildTdWorld` 的 opts 增可选 `viewport` |
| 必要性 | D-01 的 A 方案依赖它；不改这些类型就无法让理解段 / 站点装配接收调用方的值 |
| 不改契约的替代 | ① 只收敛 `DEFAULT_VIEWPORT` 与 `VIEWPORT` 为一个常量 —— 仍不支持运行时自定义；② 入口显式拒绝自定义 viewport —— 把「不支持」说出口，但不满足 03 的「贯通」 |
| 影响面 | pipeline / demo 的公开 TS 类型（新增可选字段，向后兼容）；无序列化变化；既有产物不变；CLI/MCP 形状不变 |
| 不做后果 | 自定义视口下规划 / VDS 与下游审计分叉（E3 已复现）；D-01 只能推迟 |
| 兼容 / 迁移 | 可选字段、默认值不变；旧调用方无需改动 |
| 07 批准问题 | 是否批准这组 API 增量？不批准 ⇒ D-01 推迟，不得部分实施 |

---

## 5. D-03：`modelHard` 归因与受限重采样反馈

### 5.1 当前缺口与证据

编译循环三发请求体逐字相同；包里根本没有所需资源时仍写「模型错」。

- **E1**：`compileRuntime` 的提示词在循环外构造一次（`packages/assets/src/ops.ts:1098`），
  循环内原样复用（`:1174-1215`）；`lastError`（`:1173`）只写进最终异常；
  `modelHard` = `auditConfigPipeline(...).resampleable` 的 error（`:1205-1214`），最多 3 发。
  `resampleable` 是 flat `ConfigIssue[]`，没有 family / rootCause 字段（`config-audit.ts:34-48`）；
  `ConfigIssue.code` 只有三码（`game-config.ts:300-317`），且明确不 retrofit 既有构造点。
- **E2**：`compile-runtime.test.ts:130-141,144-150,179-191,193-201,203-211,213-230` 证明重采样分档存在，
  但**没有**断言：第 2/3 发含上一发错误；flat 列表能区分 config 可修 / 包根因；包根因不写「模型错」。
- **E3**：① 连续返回同一份坏 config ⇒ `attempts: 3`、`bodiesIdentical: true`、文案「模型错」；
  ② 临时副本删掉全部 `ui` 资产，config 把 `hud.panel` / `hud.pip` 指向 sprite ⇒ 3 发逐字相同、
  `hasUiInManifest: false`、文案仍「模型错」。语料 113 份配对 config：86 条 resampleable
  （71 条 `entity-state-frames` + 15 条无码身份族），按「无同 kind 备选」启发式 **0 条**包根因。

### 5.2 归因规则（保守兜底，票 06 Q2 裁定）

新增**独立、确定性的纯函数**（只读 `config` + `manifest` + `ConfigIssue[]`），把 error 分成
`configFixable` / `packRooted` 两组。规则如下：

| `where` | 从 config 语义推导的所需能力 | 归为 `packRooted` 的条件 |
|---|---|---|
| `entity "<id>"`，且 config 中存在该 id | 该实体 `kind` 对应的 `ENTITY_ASSET_KINDS` 允许的 AssetKind；`kind` 为 `chest` / `danger` 且 `code === "entity-state-frames"` 时，另要求「≥2 帧」 | 允许集**明确**且 manifest 中没有任何满足该能力的资产 |
| `entity "<id>"`，但 config 中**找不到**该 id | 无法确认语义类型 | **不**归包根因（config 可修） |
| `hud.panel` / `hud.pip`（含其子字段） | manifest 中存在 `ui` 资产 | 没有任何 `ui` 资产 |
| `player` / `player.anims.*` | manifest 中存在 `animation` 资产 | 没有任何 `animation` 资产 |
| `scene.background`（含其子字段） | manifest 中存在 `background` 资产 | 没有任何 `background` 资产 |
| 其它一切 | 无法可靠确定 | **不**归包根因（config 可修） |

**兜底原则**：

1. 所需能力必须先从 **config 语义**（实体存在、实体 kind、字段结构）推导，`where` 只作索引；
   不得仅凭字符串格式下结论。
2. `entity` 的语义类型必须能从 config 确认；确认不了（id 不在 config）⇒ config 可修。
3. `entity-state-frames` 只有在 code 命中且实体 kind 确实是 `chest` / `danger` 时才追加「≥2 帧」条件。
4. `decor` 的 `ENTITY_ASSET_KINDS` 为 `undefined` ⇒ 能力不明确 ⇒ config 可修。
5. 只有「能力明确 + manifest 无任何满足该能力的资产 + 该错误确实无法由 config 满足」三者同时成立，
   才归 `packRooted`。
6. **任何不确定 ⇒ config 可修，不硬拒。** 牺牲提前硬拒的机会，换取不误拒可修复 config。

**明确不归包根因的情形**：「包里没有资源 `<id>`」—— 该 id 可能是模型幻觉；manifest 里有没有
对应 kind 的其它资产也不改变「模型可以换一个 id」这一可修路径。除非该 `where` 的所需能力
在 manifest 中完全不存在（例如 hud 需要 ui 而整包无 ui），才按上表归类。

### 5.3 修复判据

> ① 编译循环内，`resampleable` 的 error 先经上述纯函数分类；
> ② `packRooted` 非空 ⇒ **立即硬拒**，不重采样，`attempts` 从最多 3 降为 1，文案指向
> 「config 与资源清单对不上」，**不写「模型错」**；
> ③ 只有 `configFixable` 非空 ⇒ 进入下一次重采样，且第 n+1 发的 prompt 必须包含第 n 发的
> 结构化失败摘要；
> ④ 分类不确定 ⇒ 按 `configFixable` 处理。

- 反馈只带 **config 可修错误**；schema 失败属于 config 形状问题，其摘要也进入反馈；
  `bad`（http / timeout / truncated / empty-input）是上游故障，**不喂回**；`empty-input` 的 6 发逻辑不变。
- 反馈格式：`# 上一发被拒的原因（只改这些，不要重复）` + 最多 6 条
  `- <where>: <message>`；每条截断到 300 字符、换行折成空格；不含包根因、不含密钥 / 内部路径。
- 不新增对外归因码；不改变 `ConfigIssue` 与 `auditConfigPipeline` 的返回形状；
  不 retrofit 历史构造点。

### 5.4 循环范围（票 06 Q2 裁定）

| 循环 | 本轮处理 |
|---|---|
| 编译循环（`ops.ts:1174-1215`） | **修复** |
| 规划循环（`ops.ts:423-521`） | **推迟** |
| 塔防循环（`ops.ts:1457-1500`） | **推迟** |

规划循环与塔防循环的盲重采样写入 §10 的 Q8 交接；**不得**因编译循环完成而宣称
「全系统重采样问题已解决」。

### 5.5 最小修改面

| 文件 | 改动 |
|---|---|
| `packages/contracts/src/config-audit.ts` | 新增独立纯函数 `classifyConfigIssues(config, manifest, issues)`，返回 `{ configFixable, packRooted }`。复用 `ENTITY_ASSET_KINDS`；不读 message 文本；不改变 `auditConfigPipeline` 返回形状。它是内部 API 增量，不是持久化契约。 |
| `packages/assets/src/ops.ts` | 只改编译循环：解析一次 `modelHard` → 分类；`packRooted` 非空 ⇒ `call.trip({ spent })` 后抛 `CommandError("invalid")`；`configFixable` 非空 ⇒ 把摘要拼进下一发 prompt（在循环内重建 prompt 或追加 retry 段）；schema 失败同样追加 schema 摘要。新增私有 `retryFeedback()` 负责截断 / 折行。 |
| 测试 | 分类器单测 + 编译循环 spy 测试（反馈 / 包根因 / 不确定 / schema / bad）。 |

不改规划循环、塔防循环、Runtime、CLI/MCP 形状、落盘产物。

### 5.6 测试矩阵

| 类型 | 用例 | 断言 |
|---|---|---|
| 单测 | entity 存在、allowed kind 不在 manifest | `packRooted` |
| 单测 | entity 存在、allowed kind 在 manifest | `configFixable` |
| 单测 | `where` 的 entity id 不在 config（幻觉 id） | `configFixable`（**不得**硬拒） |
| 单测 | `chest` + `entity-state-frames`，包内无 ≥2 帧资产 | `packRooted` |
| 单测 | 同上，但包内有另一件 ≥2 帧资产 | `configFixable` |
| 单测 | `hud.panel` / `hud.pip`，包内无 ui | `packRooted` |
| 单测 | `player` / `scene.background` 缺对应 kind | `packRooted` |
| 单测 | `decor` / 未知 `where` | `configFixable` |
| 循环 | 包内无 ui（临时副本） | 1 发、`invalid`、文案不含「模型错」、指向清单 |
| 循环 | config 可修错误（如单帧 chest 且有备选） | 3 发；第 2/3 发 body 含第 1 发 where/message |
| 循环 | 幻觉 id（包里没有该 id，但有同 kind 资产） | 3 发；不进入包根因硬拒 |
| 循环 | schema 失败 | 第 2 发 body 含 schema 摘要 |
| 循环 | `bad`（http / timeout） | 不喂回；既有 attempts 语义不变 |
| 回归 | `compile-runtime.test.ts:130-230` | 按新文案更新；不得删除「重采样 3 发 / 不落盘」断言 |
| 回归 | `create-game.test.ts:1008-1050` | 汇合点 deterministic 行为不变 |
$1
> `packages/contracts/tests/config-audit.test.ts` 为**新增**测试文件（分类器单测 + 档位断言）。

### 5.7 零付费验证

```text
pnpm exec vitest run packages/contracts/tests/config-audit.test.ts \
  packages/assets/tests/compile-runtime.test.ts \
  packages/assets/tests/compile-td-game.test.ts \
  packages/pipeline/tests/create-game.test.ts
# 期望 exit 0
```

语料重判：113 份配对 config 的 86 条 resampleable 按新分类器重跑，**预测 0 条包根因**
（与 02 的启发式一致）；任何一条被判包根因都必须逐条解释。包根因的 E3 见证是 fabricated 临时包，
不属于语料 —— 不得把「语料 0 条」误读为「包根因不存在」。

### 5.8 付费验证（写入方案，本轮不执行）

**授权边界**：本轮**不调用模型、不消耗预算**；实施前必须另行授权预算、环境、模型与执行时间。

| 场景 | 要回答的问题 | 预算上限 | 通过条件 | 回退 / 停止条件 |
|---|---|---|---|---|
| ① config 可修错误 | 把上一发 `where/message` 喂回后，下一发是否改对？ | ≤3 次文本调用 | 至少一次在第 2 发改对；无「重复同一错误」 | 不通过 ⇒ 回退「反馈」部分，保留「归因 + 硬拒」 |
| ② 清单根因 | 无 ui 的包是否只发 1 次、被硬拒、文案不再写「模型错」？ | ≤3 次文本调用 | 1 发、退出码 4、文案指向清单 | 不通过 ⇒ 停止，不改分档 |

- 总计 **≤6 次文本调用**；零生图、零站点重建；只用既有 fixture，不生成新资源。
- D-02 的 `role` 可见性**无法**用零付费证明模型效果；零付费只证明 body 含 `role`。

### 5.9 风险与回退条件

- **保守归因会漏掉部分包根因**：这是有意的；不确定 ⇒ config 可修，最多多烧 3 发，不误拒。
- **硬拒改变账目**：`attempts` 3→1、`failures` / ledger 随之变化；必须核对既有 `attempts` 断言。
- **反馈注入面**：错误消息可能含资源 id / 路径；截断 + 折行 + 不回灌包根因。
- **付费效果未证**：零付费只证明 plumbing；模型是否因此改对，由 §5.8 单独验证。
- **回退**：删除循环内的分类 / 反馈 / 硬拒，恢复 `modelHard` 原逻辑；分类器可一并删除。

### 5.10 契约变更候选

无。对外归因码**不纳入**；只用内部纯函数与私有分类结果。若将来需要对外码，按 Q5 另提。

---

## 6. 跨项测试矩阵

| 交叉 | 用例 | 断言 |
|---|---|---|
| **B-02 × D-03** | 不可达 config 经过编译循环 | reachability 只在 `deterministic`，不进 `resampleable`；不进反馈；包根因硬拒与 reachability 硬拒互不冒充 |
| **B-02 × D-03** | 单帧 chest + 有备选资产 | config 可修，3 发；反馈不含不可达 |
| **D-01 × D-02 × site/QA** | 自定义 viewport + 横版 / 塔防 | viewport 贯通理解 / 构建 / 站点；两份清单 role parity |
| **D-02 × B-01** | 横版清单新增 role | 只证明可见；不新增语义分类、不改 `role` schema（B-01 仍推迟） |
| **B-02 × publish-gate** | 同一份不可达 config | build 汇合点与 standalone `site` 都拒绝；两个入口各有独立测试，不得互推 |
| **publish-gate × D-01** | 自定义视口站点 + reachability | 站点屏幕空间用调用方 viewport；reachability 与视口无关，不误伤 |

---

## 7. 零付费验证计划（全局）

### 7.1 构建与类型

```text
pnpm build        # tsc -b + bundle；期望 exit 0
pnpm typecheck    # 期望 exit 0
```

### 7.2 分批测试（每项独立跑，失败即定位到项）

| 顺序 | 命令（vitest 文件） | 期望 |
|---|---|---|
| 1 | `assets/tests/compile-runtime.test.ts`、`compile-td-game.test.ts` | exit 0 |
| 2 | `contracts/tests/reachability.test.ts`、`config-audit.test.ts（新增）`、`assets/tests/compile-runtime.test.ts`、`pipeline/tests/create-game.test.ts`、`qa/tests/gameplay.test.ts` | exit 0 |
| 3 | `pipeline/tests/publish-gate.test.ts`、`cli/tests/cli-site-gate.test.ts`、`mcp/tests/assemble-site-qa-gate.test.ts` | exit 0 |
| 4 | `pipeline/tests/create-game.test.ts`、`demo/tests/world.test.ts`、`demo/tests/site.test.ts`、`demo/tests/td-site.test.ts`、`assets/tests/plan-background-gate.test.ts`、`qa/tests/layers.test.ts` | exit 0 |
| 5 | `contracts/tests/config-audit.test.ts（新增）`、`assets/tests/compile-runtime.test.ts`、`pipeline/tests/create-game.test.ts` | exit 0 |
| 最终 | `pnpm test` | exit 0；任何失败必须归因到某一项并回退该项 |

### 7.3 语料重判（只读，不修改历史产物）

在 `/tmp` 写一次性脚本（不提交），扫描 `out/**`、`fixtures/**`、`.scratch/**`，跳过
`node_modules` / `.git`，沿用 01 §1.3 的配对口径：

| 指标 | 预测 | 解释规则 |
|---|---|---|
| config+manifest 配对 | 134 对 | 17 份无邻近包，跳过 |
| B-02 reachability 新增 error | **0** | 任何新增必须逐条解释为真实不可达 |
| D-01 config `world.size.h` | 117/117 = 270 | 默认路径不变；自定义视口无历史样本 |
| D-02 role 非空 / 换行 | 982/982 非空、0 换行 | 不改变有效性 |
| D-03 resampleable | 86 条（71 state-frames + 15 无码） | 新分类器预测 0 条包根因 |
| publish-gate 三元组 | 21 组，reachability 正例 0 | 任何新增必须解释 |
| QA 报告 | 29 份；26 有 subject、0 有 configChecksum | 本方案不改报告契约 |

**不允许**写 `out/**`、`fixtures/**`、`.scratch/**` 的既有产物；不允许重跑付费链；不允许 `reset` / `clean`。

---

## 8. 失败分类与回退策略

### 8.1 分类总表（实施后）

| 类别 | 典型来源 | 重采样？ | 喂回下一发？ | 文案指向 | 落盘？ |
|---|---|---|---|---|---|
| upstream | http / timeout / truncated / not-sent | 否 | 否 | 上游错误原文 | 否 |
| bad | invalid-json / no-tool-use / empty-input | 是（6 发规则不变） | 否 | 上游错误原文 | 否 |
| schema | config 不过 schema | 是 | **是**（schema 摘要） | 契约 | 否 |
| config 可修 | 引用 / 身份 / 屏幕空间等可换值错误 | 是（最多 3 发） | **是** | 模型错（3 发后仍没写对） | 否 |
| 包根因 | 所需能力在清单中完全不存在 | **否（1 发）** | 否 | **资源清单 / config 与清单对不上** | 否 |
| deterministic | reachability / 层覆盖 | 否 | 否 | 布局 / 清单（按每条 issue） | 否 |
| publish-gate | 当前 config 不可达 | 否 | 否 | 这份 config 本身不可达 | 不装配站点 |

### 8.2 新增拒绝的说明义务

任何新增 error / 新增拒绝都必须满足其一：
1. 语料中为 0；或
2. 每一处都能解释为真实缺陷（不可达、包缺所需 kind、反馈无效等），并记录在实施报告。

### 8.3 回退策略

- **逐项独立回退**：五项各自一个 PR / 一组测试；任何一项失败只回退该项，不阻塞其余。
- **全局停止条件**（任一触发即停止并回到 07）：
  - 需要未批准的契约变更；
  - 任何语料新增 error 无法解释；
  - 任何既有测试回归无法按新语义解释；
  - 修改了历史 run / pack / site / fixture；
  - 未授权付费调用；
  - CLI/MCP 对外形状变化。

---

## 9. 契约候选单列清单（全部未批准）

| 项 | 候选 | 本轮状态 | 07 批准问题 |
|---|---|---|---|
| B-02 | 可选 `ConfigIssue.code: "unreachable"` | 提出，**不默认采用** | 是否需要机读码？默认不需要 |
| D-01 | `UnderstandingInput.viewport?` + `AssembleOptions.viewport?` + `SiteOptions.viewport?`（+ world builder opts） | **必须进入 07 单列审批** | 是否批准 API 增量？不批准 ⇒ D-01 推迟 |
| publish-gate | `subject.configChecksum` | **仅备选**，不默认采用 | 现在做 / 以后做 / 不做？默认不做 |
| D-03 | 对外归因码 | **不纳入** | 无；若将来需要，另提 |

**批准时点**：本方案不授予任何契约批准；所有候选在 07 收口 / P1 审批包中逐项呈现，
每项必须带：变更内容、必要性、不改契约的替代、影响面、不实施的后果、兼容 / 迁移要求、批准问题。

---

## 10. 明确排除与推迟项交接

### 10.1 本轮明确排除

- **第七条 `visual-config-coherence`**：不在 publish-gate 第五项范围；站点没有 VDS / design 入参，
  无法重跑。按 Q8 交接。
- **完整 config 身份体系**：`subject.configChecksum`、VDS / design / intent 身份、runDir 跨阶段一致性、
  手写 config 工作流的身份策略 —— 均不在本轮。
- **规划循环 / 塔防循环的盲重采样**：本轮只修编译循环，另按 Q8 交接。
- **B-01 / B-03 / B-04 / B-05 / B-06 / B-07 / D-04**：维持 03 §4 的推迟交接；
  本方案不重开、不重新裁定。
- **任何实施**：生产代码、测试、fixture、契约的修改必须另获实施授权。
- **付费链**：本轮不调用模型、不生图、不重建站点。

### 10.2 Q8 交接：第七条 `visual-config-coherence`

| 项 | 内容 |
|---|---|
| 推迟原因 | config 敏感，但站点装配没有 VDS / design；发布闸也没有 runDir；与 reachability 并列的真实洞 |
| 推荐后续 effort | **publish-gate 的完整 QA 输入身份**（config / design / intent / VDS 四类输入的身份绑定，或站点侧补齐所需输入） |
| 交接时须重新确认 | `QA_JUDGEMENTS` 仍为 7 条；`site.ts` 仍无 VDS / design 入参；`QAReport.subject` 仍是 strict 三字段；29 份历史报告仍 0 份有 configChecksum |
| 启动前须补充证据 | 哪些 config 敏感判据未被站点重跑；四类 QA 输入的身份形状；手写 config 工作流的兼容策略；旧报告的迁移 / 拒绝策略 |
| 本图未替其决定 | 身份字段形状、可选 / 必填、是否升 `qa-report` 版本、是否给站点补 VDS / design 入参 |

### 10.3 Q8 交接：规划循环的盲重采样

| 项 | 内容 |
|---|---|
| 推迟原因 | 本轮 D-03 限定编译循环；规划循环的失败类型（recipe schema / 规划闸）与 config 归因不是同一套分类 |
| 推荐后续 effort | **重采样反馈 v2（规划段）** |
| 交接时须重新确认 | `planAssets` 的 prompt 仍循环外构造（`ops.ts:423,435`）；`lastError` 仍不回灌（`:431`）；`empty-input` 6 发规则仍有效 |
| 启动前须补充证据 | 规划失败的可修 / 不可修分类；反馈是否改善 recipe 命中率；token 成本；与 `plan-*` 闸的关系 |
| 本图未替其决定 | 是否复用本轮的分类器、反馈格式、是否改变 attempts |

### 10.4 Q8 交接：塔防循环的盲重采样

| 项 | 内容 |
|---|---|
| 推迟原因 | 本轮 D-03 限定编译循环；塔防的失败类型与 QA 等价物不同 |
| 推荐后续 effort | **重采样反馈 v2（塔防段）** |
| 交接时须重新确认 | `compileTdGame` 仍「不过校验也落盘」（`ops.ts:1421-1500`）；塔防仍无 QA 等价；`tdResourceBrief` 已带 role |
| 启动前须补充证据 | 塔防失败分档（校验 / 派生 / 上游）；反馈对模型的影响；落盘策略是否改变 |
| 本图未替其决定 | 是否与编译段共用分类器、是否改变落盘语义、是否新增对外码 |

---

## 11. 待 07 审批的问题清单

1. **D-01 API 增量**：是否批准 `UnderstandingInput.viewport?` / `AssembleOptions.viewport?` /
   `SiteOptions.viewport?` / world builder opts？不批准 ⇒ D-01 推迟，不得部分实施。
2. **B-02 可选 `unreachable` 码**：本轮是否需要机读码？默认不需要。
3. **publish-gate `subject.configChecksum`**：现在做 / 以后做 / 不做？默认不做。
4. **D-03 无对外归因码**：确认本轮只用内部纯函数。
5. **实施授权粒度**：是否允许逐项批准、逐项实施、逐项回退？05 已裁定方案票可逐项批准；
   本方案仍要求每一项有独立的实施授权。
6. **付费验证**：另批预算（≤6 次文本调用）、环境、模型与执行时间；本轮不执行。

---

## 12. 边界确认

- 本方案**不构成实施授权**；生产代码修改、契约批准与付费验证须各自经过对应审批。
- 五项进入同一份方案 **不等于**一次性批准；允许部分批准、部分推迟。
- publish-gate 只处理 `reachability`；第七条 `visual-config-coherence` 按 Q8 交接。
- D-03 **归因不确定时不得硬拒**；只有明确的清单根因才能把 `attempts` 从 3 降为 1。
- 零付费验证 **不等于**付费模型效果验收；D-02 的 role 可见性、D-03 的反馈效果均需另批付费验证。
- 本方案未修改生产代码、测试、fixture、契约或历史证据；未 commit、未建分支、未推送；
  零付费、零模型调用、零生图。
