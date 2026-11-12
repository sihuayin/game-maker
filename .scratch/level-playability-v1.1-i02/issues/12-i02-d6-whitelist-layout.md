# I02-D6 文件白名单增量与模块布局裁定

Type: grilling
Status: resolved
Owner: amber
Blocked by: 09, 10, 11
Map: ../map.md
Class: I-02 / DECISION

## Question

冻结 I-02 的生产文件白名单增量与模块布局，使授权包能明确「允许改什么、禁止改什么、什么需要额外审批」。

### 必须裁定

1. **模块布局**：算法是全部塞进现有 `temporal.ts`，还是新增内部模块（例如 `temporal-motion.ts` / `temporal-witness.ts` / `temporal-gate.ts` / `temporal-evasion.ts` / `temporal-search.ts`）。给出取舍：可审性、循环依赖、I-03 接线面。
2. **新增文件**是否在 I-00 §11 白名单内：白名单只列了 `temporal.ts` 与 `temporal-input.ts`；新增模块是否构成白名单外改动，需要什么授权。
3. **测试文件**：`packages/contracts/tests/playability-temporal.test.ts`；只增不改；夹具位置。
4. **`graph.ts` hop 参数化**：按 D4 的裁定，是否进入 I-02 白名单；若进入，需要 I-00 R2 之外的什么审批。
5. **`profile.ts`**：是否需要改；I-00 将其列为「需单独裁定」。
6. **`mechanic.ts` / `api.ts` / `verdict.ts` / `index.ts`**：I-02 是否动；I-03 才接线。
7. **明确禁止**：`game-config.ts`、`assetpack.ts`、`playability/{geometry,graph?,reach,spatial,completion,targets}.ts`（按 D4 调整）、`packages/demo/**`、`packages/cli/**`、`packages/mcp/**`、既有断言删除/放宽、新依赖。
8. **公共面**：是否需要导出新的内部类型；`@internal` 约定；不新增公共参数/持久化字段。
9. **fixtures**：内存夹具优先；`fixtures/packs/**` 需单独裁定。
10. **授权边界声明**：本图只产出授权包，不授权实现。

### 产出

票内 `## Answer`：白名单增量表（允许 / 禁止 / 需单独裁定）+ 模块布局图。

### 下游

I02-AUTH。

## 相关证据

- [I02-03 连续时间求交可行性实验](../evidence/03-continuous-intersection.md)：实现应在局部坐标帧内计算，否则 `|x| ~ 1e9` 时 `1e-9` 重叠不可表示（F7）；这可能影响是否需要新增内部模块/辅助文件。
- [I02-04 图割与 hop 加倍可行性实验](../evidence/04-graph-cut-hop.md)：若 D4 裁定 hop 参数化进产品，最小改动是给 `hopSamples`/`hopEdges`/`hopTargets` 加向后兼容的尾参；`graph.ts` 在 I-00「需单独裁定」名单，授权形态归本票。

## 上游裁定（D2）

- [I02-D2 运动模型与输入契约裁定](08-i02-d2-motion-input-contract.md)：三角波 canonical 公式放 contracts 内部模块（demo 不动）；只读 cross-check 只防漂移、不作正确性证明；内部模块不得新增公共导出/schema；具体文件、导出边界、测试路径与白名单由本票裁定，批准前不构成修改授权。

## 上游裁定（D4，2026-11-11）

[I02-D4](10-i02-d4-gate-graphcut.md) 对 `graph.ts` 的授权边界：

1. `graph.ts` 必须进入 I-02 白名单。
2. 增量审批独立于 I-00 R2，不得以 R2 已批准推定。
3. 只允许 `hopSamples` / `hopEdges` / `hopTargets` 的可选尾参 `HopSampling = { hz?, maxSamples? }`；`reachableCells` 仅在逐项列明时包含。
4. 默认 `{ hz: 60, maxSamples: 120 }`，默认行为不变；不得顺带改跳跃公式、采样语义或其他导出。
5. `reach.ts` 不在本次授权范围。

## 上游裁定（D8，2026-11-11）

白名单必须按 U1–U5 分单元列出；`graph.ts` 尾参单独审批；预算接口 / 降级骨架是 U1 前置，不单列 U0 或第六个实施单元。


## 上游裁定（D5，2026-11-11）

预算常量是模块级常量，不进 `GameConfig` / profile / 公开 API；白名单必须容纳预算接口与 `wall-clock-abort` 的独立原因。U1–U2 完整预算验收待 [I02-D5B](21-i02-d5b-cut-budget-benchmark.md)。

## Answer

用户 2026-11-11 逐题裁定。Q1–Q8 **全部按推荐方案接受**，并追加四条收紧条款：依赖 DAG 无歧义、`graph.ts` 独立审批是 U4 前置门、内部 analyzer ≠ 生产 analyzer、禁止修改 ≠ 禁止只读引用。

**修改产品目录：否**（仅本票、地图与下游票尾；未触碰 `packages/**`、Runtime、CLI、MCP、公共 Contract、I-00 / I-02 原文）。

> 本轮只冻结**文件边界与模块布局**，不扩大实施授权。文件被点名、模块被拆分、测试通过，都不自动代表相应实施单元获得授权。

### 0. 裁定总表

| 问题 | 裁定 | 核心边界 |
| --- | --- | --- |
| Q1 模块布局 | **B：按单元拆分** | 六个内部模块，`temporal.ts` 只负责入口与编排 |
| Q2 新文件白名单 | **A：逐文件显式命名** | 未列名的新源文件一律 STOP / HITL |
| Q3 `graph.ts` | **A：白名单内、独立增量审批** | 仅允许 `HopSampling` 可选尾参；未批 U4 保持 `BLOCKED` |
| Q4 `profile.ts` | **A：不改，列入禁止修改** | 只读消费不等于修改授权 |
| Q5 生产 stub | **A：I-02 不接生产** | 内部算法独立测试，`ops.ts` 和 T-58 原样保留 |
| Q6 公共导出 | **A：一律不转出** | 不加入任何公共 barrel 或 package exports |
| Q7 测试与夹具 | **A 为默认，允许 B 的分文件形式** | 测试只增、内存夹具优先、不新增 pack |
| Q8 禁止清单 | **A：I-02 显式收窄** | 白名单只代表 I-02 实际授权面 |

### 1. 模块布局与依赖 DAG（Q1）

冻结六个内部模块；`temporal.ts` 只保留 I-01 已有入口与 I-02 编排。

箭头表示「**上层依赖下层**」：

```text
temporal-result.ts
    ↑
temporal-budget.ts
    ↑
temporal-motion.ts
    ↑
    ├── temporal-witness.ts
    ├── temporal-gate.ts
    └── temporal-evasion.ts
             ↑
        temporal.ts
```

等价的无歧义依赖表：

| 模块 | 依赖 | 职责 |
| --- | --- | --- |
| `temporal-result.ts` | 无（不依赖任何 I-02 模块） | 纯类型；D9 填充形状。**不得反向导入 budget 或算法实现** |
| `temporal-budget.ts` | result | 预算常量、work counter、wall-clock abort、降级原因 |
| `temporal-motion.ts` | result、budget | 三角波、AABB、连续时间求交、ε |
| `temporal-witness.ts` | result、budget、motion | U2 安全通过 Witness |
| `temporal-gate.ts` | result、budget、motion | U3 永久封锁门 |
| `temporal-evasion.ts` | result、budget、motion；只读 `graph.ts` / `reach.ts` 既有符号 | U4 垂直规避图割 |
| `temporal.ts` | 以上全部 | 入口与编排；**不得被以上任一模块 import** |

- 任何**循环依赖** ⇒ 架构验收失败，不得以「类型只在编译期」为由豁免。
- 模块内部可以有必要的 `export`（供同包测试/内部调用），但**不因此形成公共导出**（见 §5）。
- `temporal-result.ts` 不得导入 budget / motion / witness / gate / evasion 中的任何一个。

### 2. 新文件白名单表达（Q2）

- 采用**逐文件显式命名**；I-00 §11 原文不动，本票只增量授权 I-02 范围。
- 未列名的新源文件 —— 包括测试辅助模块、helper、fixture 文件 —— **一律 STOP / HITL**，不得以「内部使用」「只是测试」为由自行扩张范围。
- 授权包必须按 U1–U5 分单元列出文件归属；单个单元的 PR 只能新增/修改本单元列明的文件。

### 3. `graph.ts` 的独立审批（Q3）

`graph.ts` **进入 D6 白名单，但不等于已获修改授权**：白名单解决文件范围，独立审批解决修改权限。冻结如下状态转换：

1. 只允许 `hopSamples` / `hopEdges` / `hopTargets` 新增可选尾参 `HopSampling = { hz?: number; maxSamples?: number }`。
2. 默认参数固定为 `{ hz: 60, maxSamples: 120 }`。
3. 不得修改 `reach.ts`、跳跃公式、既有采样语义、其他导出或调用语义。
4. 必须有回归测试证明显式传入默认参数与无参调用行为一致；对输出可序列化的场景，验证**稳定序列化结果一致**。
5. **独立书面增量审批通过后**，才允许 U4 修改 `graph.ts`；该审批独立于 I-00 R2，不得以「I-00 R2 已批准」或「已列入白名单」推定获批。
6. 没有该审批时，U4 只能进行**不修改 `graph.ts`** 的已授权工作；需要参数化的部分保持 `BLOCKED`，**不得**用临时改动、测试专用实现、复制一份实现或其他路径绕过审批。

### 4. `profile.ts`（Q4）

- 不改，列入禁止修改（见 §7）。
- 只读消费现有符号（`FIXED_RUNTIME_PROFILE`、`runtimeEntityGeometry`、`footOf`、`overlapsStrict` 等）**不是**修改授权，也无需额外授权。
- 若实现中发现必须修改 `profile.ts`（含新增字段/导出）⇒ **STOP / HITL**，不得在 I-02 内顺手加。

### 5. 内部 analyzer 与生产 stub（Q5）

- I-02 可以交付**独立的内部函数或工厂**，供 I-02 专项测试直接调用。
- **不替换** `stubTemporalAnalyzer`；**不修改** `packages/assets/src/ops.ts`。
- T-57、T-58、T-61 既有断言保持原样：不删除、不放宽、不改写成绕过式断言。
- I-02 完成**不代表** Runtime、Pipeline 或生产 Verdict 已具备动态 Hazard 能力。
- 生产接线属于 I-03 的独立授权；届时重新裁定 stub 替换及相关断言变更。
- 新模块必须避开现有架构测试的文本扫描陷阱：不得出现 `analyze:` 属性标签（T-58），不得调用 `auditPlayabilityTemporal(`（T-57），不得出现 `Symbol(`（T-64），不得导出 `TEMPORAL_LAG_*` 同名常量（T-62）。

### 6. 公共导出面（Q6）

- 六个新模块**一律不转出**：不加入 `playability/index.ts`，不加入 `packages/contracts/src/index.ts`，不进入 `packages/contracts/package.json` 的 exports。
- 测试与内部调用一律相对路径直接 import（与 `playability-temporal-input.test.ts` 现有做法一致）。
- 内部符号加 `@internal` JSDoc；不新增 `GameConfig` / `profile` / schema 字段；预算常量是模块级 `export const`，但不进任何公共桶。
- 不新增公共参数、不新增持久化字段、不新增 `ConfigIssue.code`。

### 7. 测试与夹具（Q7）

- 新增 `packages/contracts/tests/playability-temporal*.test.ts`：**只新增**，不修改既有测试文件（特别是 `playability-temporal-input.test.ts` 的 T-55～T-65 与 I-01 矩阵）。
- 允许按模块分文件（如 `playability-temporal-motion.test.ts` / `-witness.test.ts`），便于 R1–R4 逐单元定位；文件名必须匹配 `playability-temporal*.test.ts`。
- 夹具**内存优先**：直接构造 `GameConfig` / manifest 字面量。
- 需要真包时只读复用 `fixtures/packs/last-train/v2`；三角波 cross-check 用 `node:fs` **只读** `packages/demo/src/hazard.ts` 文本（测试可用 fs；T-55 只扫 `src`）。
- **不新增任何 `fixtures/packs/**`**；若将来必须新增 ⇒ 单独 HITL。

### 8. 白名单落版（Q8）

#### 8.1 允许修改 / 新增（仅 I-02）

| 文件 | 授权范围 |
| --- | --- |
| `packages/contracts/src/playability/temporal.ts` | I-02 内部入口与编排 |
| `packages/contracts/src/playability/temporal-result.ts` | 新增纯类型模块 |
| `packages/contracts/src/playability/temporal-budget.ts` | 新增预算与降级模块 |
| `packages/contracts/src/playability/temporal-motion.ts` | 新增三角波、AABB、连续求交模块 |
| `packages/contracts/src/playability/temporal-witness.ts` | 新增 U2 Witness 模块 |
| `packages/contracts/src/playability/temporal-gate.ts` | 新增 U3 门区证明模块 |
| `packages/contracts/src/playability/temporal-evasion.ts` | 新增 U4 垂直规避图割模块 |
| `packages/contracts/tests/playability-temporal*.test.ts` | 只新增测试，不修改既有测试文件 |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | **TEST_ONLY**：内存构造器 / 断言 / 边界辅助；不得含产品逻辑、不得被 `src/**` 引用、不得注册测试或读写文件系统；需 AUTH 单列 |
| `packages/contracts/src/playability/graph.ts` | 仅 `HopSampling` 可选尾参；**独立增量审批通过后方可修改** |

按单元归属：

| 单元 | 首次允许新增/修改 |
| --- | --- |
| U1 | `temporal.ts`（编排骨架）、`temporal-result.ts`、`temporal-budget.ts`、`temporal-motion.ts`、对应测试 |
| U2 | `temporal-witness.ts`、对应测试 |
| U3 | `temporal-gate.ts`、对应测试 |
| U4 | `temporal-evasion.ts`、对应测试；`graph.ts` **仅在独立审批后** |
| U5 | 硬化与集成测试；不新增白名单文件，除非另行裁定 |

#### 8.2 禁止修改（但允许只读 import 既有符号）

- `profile.ts`、`reach.ts`、`geometry.ts`、`spatial.ts`、`completion.ts`、`targets.ts`
- `mechanic.ts`、`api.ts`、`verdict.ts`、`index.ts`、`config-audit.ts`
- `packages/assets/src/ops.ts`
- `packages/pipeline/src/create-game.ts`、`packages/pipeline/src/publish-gate.ts`
- `packages/demo/**`、`packages/cli/**`、`packages/mcp/**`
- `game-config.ts`、`assetpack.ts`
- `fixtures/packs/**`
- 所有既有架构断言和回归断言
- 任何新依赖

解释规则：

- 禁止修改 ≠ 禁止只读引用。上述文件仍可在获准模块中只读 import 其既有符号。
- `graph.ts` 在独立审批通过前只允许只读消费；未审批不得修改。
- 禁止清单中的文件不得因编译、测试或「方便接线」而顺手修改。
- 白名单外的新增源文件、测试辅助模块或 fixture 文件，不得以「内部使用」为由自行扩张范围。

#### 8.3 需单独 HITL / 增量审批

1. `graph.ts` 的 `HopSampling` 尾参修改。
2. 任何新增 pack fixture。
3. T-57 / T-58 等既有断言的修改 —— 留给 I-03 重新裁定。
4. 任何未列入白名单的新源文件。
5. 任何公共导出、公共 Contract、Runtime、CLI 或 MCP 改动。

### 9. 授权解释（本轮不扩大实施授权）

- U1 仍是唯一已授权实施单元。
- U2–U5 的状态不因本轮文件布局裁定而改变。
- `graph.ts` 独立审批未通过前，U4 仍为 `BLOCKED`。
- `PUBLIC_NB`、`PUBLIC_PU` 仍为 `BLOCKED`。
- `ops.ts` stub 继续保留；I-02 不构成生产接入。

### 10. 停止条件

实现中若出现以下任一情况，停止回 HITL，不得自行扩大白名单：

- 需要白名单外文件（含 helper / fixture）；
- 需要修改 `graph.ts` 的 `HopSampling` 尾参之外的部分；
- 需要修改 `profile.ts` 或任何禁止清单文件；
- 需要新增 `fixtures/packs/**`；
- 需要改动 T-57 / T-58 / T-61 或任何既有断言；
- 需要新增公共导出或公共 Contract 字段；
- 出现循环依赖或 `temporal.ts` 被新模块 import。

## 增补（D7，2026-11-11）

按 [I02-D7 测试矩阵与证据口径裁定](13-i02-d7-test-matrix.md) 做一次**显式白名单增量**；D6 其余边界与停止条件不变：

1. 新增允许文件 `packages/contracts/tests/playability-temporal-fixtures.ts`，标记 `TEST_ONLY`。允许内容仅限：`GameConfig` / manifest 内存构造器、公共测试断言辅助、边界值与反例构造辅助。
2. 禁止：产品算法或生产逻辑；被 `src/**` 引用；注册测试或产生测试副作用；文件系统读写；新增 pack fixture。
3. 该 helper **不是** `playability-temporal*.test.ts` 通配的一部分，必须由 AUTH 显式列入白名单增量，并在 diff 审计中单独检查。
4. 六个测试文件（`playability-temporal-{motion,budget,witness,gate,evasion}.test.ts` 与 `playability-temporal.test.ts`）确认落在既有通配内，不需要额外授权。
5. 时间注入 `now` 是**内部测试专用**，只用于 wall-clock abort；不构成公共接口，不进入公共签名 / Contract / 配置 / barrel export（边界见 D7 §6.1）。
6. U1 仍是唯一已授权实施单元；本增补不改变 U2–U5 状态。
