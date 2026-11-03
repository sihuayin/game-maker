# D 类当前源码复核：viewport / role / modelHard / 设计 goal 桶

Type: research
Status: resolved
Owner: research subagent · 2026-11-03
Blocked by: —
Map: ../map.md

## Question

在 P1 实施后的当前源码（`main` @ `3b1b61d`）上，逐原子项复核 P0 的 D 类结论是否仍成立、
是否已被 P1 改变，并给出**事实、证据与候选判据**。本票**不裁定修复去留**——裁定归 03。

### 原子项

| 编号 | 原子项 | 复核重点 |
|---|---|---|
| D-01 | Q9：`viewport` 贯通 | `UnderstandingInput` → `planAssets` → compile/site 是否仍有参数缺口 |
| D-02 | Q9：`role` 贯通 | 横版 `resourceBrief` 与塔防 `tdResourceBrief` 的不对称是否仍存在 |
| D-03 | Q9：`modelHard` 归因与重采样反馈 | 失败归因与盲重采样是否仍有缺口 |
| D-04 | Q10(d)：设计层缺少 goal 桶 | 是否仍需要设计表达或契约层面的独立改动 |

### 每项必须交付（逐条 `file:line`）

1. **当前状态**：P1 后的源码事实；写明 P1 的 `ConfigIssue.code`、`auditConfigPipeline`、
   五类实体 kind 锁是否改变了该项的成立条件。
2. **证据**：E1 源码定位；E2 既有测试（文件 + 用例名 + 断言）；E3 零付费复现或既有产物重判
   （命令 + 退出码 + 路径）。仅历史推断必须显式标注。
3. **候选判据**：若可写，给出精确判据与误报边界；若不可写，说明缺什么语义信息。
4. **语料重判**：用现有 `out/**`、`fixtures/**`、`.scratch/**` 全量扫描，报告该项一旦落判据
   的新增 error 数量与逐条解释（不得修改语料）。
5. **修改面**：涉及包、文件、契约、调用链；是否新增依赖、是否改 Runtime/CLI/MCP 形状。
6. **契约变更候选**：若有，列变更内容、必要性、至少一个不改契约的替代方案、影响面与不做后果。
7. **前置裁定**：该项是否受 P0/P1 或 PRD 既有裁定约束；若有，逐字引用。

### 约束

- **只读**：不修改生产代码、测试、fixture、契约、历史证据；不 commit、不建分支、不推送。
- **零付费、零模型调用、零生图**；需要运行测试时只用既有测试与 fixture，记录命令与退出码。
- 不把 PRD 的槽位表当作事实来源；一切规则以源码与 Runtime 消费逻辑为准。
- 证据分级：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据。

### 产出

- 报告写入 `../research/02-d-class.md`（相对本票）。
- 本票追加 `## Answer`（一页以内：逐原子项状态表 + 证据定位 + 候选判据 + 语料重判摘要），
  `Status` 改 `resolved`。

## Answer

**结论：D-01…D-04 在 P1 后仍全部成立为源码事实；证据级别 E1 + E2/E3。本票不裁定修复去留。** 详细报告：[`../research/02-d-class.md`](../research/02-d-class.md)。

| 编号 | 当前状态（P1 后） | 证据定位（`file:line`） | 语料重判新增 error |
|---|---|---|---|
| D-01 `viewport` | 仍成立：`UnderstandingInput` 无 viewport；`runUnderstanding` 的 `planAssets` 不传；`compileVisualDesign` 硬编码 `DEFAULT_VIEWPORT`；site 固定 `demo` 的 `VIEWPORT` 且 `AssembleOptions` 无此参数。两个常量同值 480×270，生产壳今天无可观察失败 | `pipeline/src/create-game.ts:48-77,128,177,380,390,598,629,669`；`demo/src/site.ts:205-210`；`demo/src/td/site.ts:130,143`；`demo/src/draw.ts:15`；`assets/src/ops.ts:877`；`qa/tests/layers.test.ts:79`；`demo/tests/world.test.ts:279` | 0（117/117 config `world.size.h=270`） |
| D-02 `role` | 仍成立：横版 `resourceBrief` 不打印 `AssetPackEntry.role`；塔防 `tdResourceBrief` 打印。`role` 的唯一 manifest 消费者就是塔防清单；`role` 为 `z.string()`，语料 982/982 非空 | `assets/src/ops.ts:953-963` vs `:1373-1379`（调用 `:1147`/`:1421`）；`contracts/src/assetpack.ts:167`；`assets/src/pack.ts:1214`；`CONTEXT.md:116` | 0（role 非空判据：982/982 通过） |
| D-03 `modelHard` | 仍成立：三发请求体逐字相同、`lastError` 不回灌；`auditConfigPipeline.resampleable` 是 flat 列表，仅 3 个 A 类码，引用/身份/屏幕空间无码；包根因仍写「模型错」。P1 Q6a 只在规划期堵住「缺 ui」，人工改清单/复用旧包/独立 compile 仍可复现 | `assets/src/ops.ts:423-521,1098,1173-1215`；`contracts/src/config-audit.ts:34-48`；`contracts/src/game-config.ts:300-317`；`compile-runtime.test.ts:130-231`；`create-game.test.ts:1008-1050` | 0（113 配对 config 的 86 条 resampleable 按「无同 kind 备选」判据 0 条包根因） |
| D-04 设计 goal 桶 | 仍成立：设计 schema 无 goal 桶；设计允许 `winConditions: []`（「没有终点」是真设计）；config `Objective` 只有 `collect-then-reach` 且 gate 必须是 goal；config 侧孤儿 goal 合法且是主流（115/116）；`winConditions` 下游零消费者（`designBrief` 不打印） | `contracts/src/game-design.ts:110-111,124-172,196`；`contracts/src/game-config.ts:228-232,421-423,646`；`assets/src/prompt.ts:854-870`；`assets/src/ops.ts:1127`；`game-config.test.ts:525-543` | 新增「设计必须有结构化 goal」判据会让 **43/43** 份合法设计变 error（不可接受）；已有 config 侧 gate 判据新增 **0**（1 条是故意坏的 `out/__probe/empty`） |

### 候选判据（摘要，均附误报边界于报告）

- **D-01**：同一次调用内 plan / VDS / compile / QA / site 使用的 viewport 必须逐次相等。只比 viewport，不比 `world.size`；不把视口变成包数据（CONTEXT.md:638-643）。
- **D-02**：横版与塔防资源清单的每条资产行都必须包含 manifest `role`，且 `role` 段共用同一渲染函数。只要求「印出来」，不要求 `role` 成为机读分类（B-01/Q2 已裁 Out of scope）。
- **D-03**：① 第 n+1 发必须携带第 n 发的 config 可修失败摘要；非模型故障（http/timeout/truncated/empty-input）与包根因不喂回。② 要求 manifest 中不存在的 kind / 无该 kind 资产 ⇒ 归为上游根因，不重采样、不写「模型错」。误报边界：幻觉 id 与包缺失不可只靠 manifest 区分；Q3 单帧错误只要还有别的 ≥2 帧资产就「判据可过但语义可能错」。
- **D-04**：设计级结构化 goal 判据不满足语料零误伤（43/43）；config 级 gate 判据已存在且 0 新 error。剩余是**表达力/可追溯性**缺口，不是「合法 config 被拒」。不改契约的替代：继续用孤儿 gate + 把 `winConditions` 打印给 config 模型（`designBrief` 今天不打）。

### 语料重判口径（E3）

- 117 `game-config.json`（全部 schema 有效）、49 `game-design.json`（43 有效；6 份失败均为历史 `player.id == npcs[0].id`）、172 `manifest.json`（90 可解析、82 历史版本解析失败）。
- D-03：86 条 resampleable = 71 `entity-state-frames`（P1 Q3）+ 15 无码身份（历史缺 `sourceIntent`）；0 包根因、0 deterministic 额外。
- D-04：116/117 config 有 gate→goal；115 孤儿、1 个 `sourceIntent:"chest"`（已知同桶误归属，冻结）、1 无 goal（`out/__probe/empty` 故意坏探针）。43/43 设计无 goal 桶；100 配对 config 的 goal 资源 kind = animation 55 / sprite 45（P1 Q1 锁 0 新 error）。

### 前置裁定（逐字）

- Q9：「`modelHard` 归因「模型错」、盲重采样、`viewport`/`role` 未贯通 | **D** | …… **改善重采样反馈还需要模型调用验证** | 另立 effort」。
- Q10(d)：「设计无 goal 桶，而 `objective.gate` 必须指向 goal 实体 | **D** | 设计层缺桶与 config 契约冲突，超出本图终点 | 另立 effort」。
- P1 契约裁定：「**只给本图新增或加强的错误写码**」「**不 retrofit 历史 47 个构造点**」「**不改变现有错误的 severity/where/message 语义**」。
- `entity-identity-v1.1` 已知限制：「同桶误归属不在本矩阵射程内……记录为已知限制，不靠摘 `goal`/`solid` 制造误拒来假装解决」。

### 验证

`pnpm exec vitest run`（7 个相关文件）→ **exit 0，7 files / 250 tests passed**。E3 `/tmp` 脚本全部 exit 0（命令与结果见报告 §5）。全程零付费、零模型调用、零生图；未改生产代码/测试/fixture/契约。
