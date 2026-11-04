# Level Playability V1：只读审计与判据规格

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1
Baseline: `main` @ `fa17c14`
Status: open · 2026-11-04 开图
Predecessor: [Design-to-Config Residual B/D P1](../design-to-config-residual-bd-audit-v1-p1/map.md)（已收口）

> **2026-11-04 开图。** 授权来源：[开图裁定](rulings-2026-11-04.md)（Q1–Q7 全部采纳推荐方案 A）。
> 输入：[`docs/v7.7/配置.md`](../../docs/v7.7/配置.md) §13（建议下一优先级进入 Level Playability V1）。
> 本图是**只读审计与规格设计**图：不在本图修改生产代码；实施另起 effort，沿用 B/D Audit → P1 的两段式治理。

## Destination

完成 Level Playability V1 的当前能力审计、确定性判据规格、历史语料重判、合成负例矩阵、最小实施方案与独立审批包；不修改生产代码，停在实施审批门前。

交付至少包括：

1. 当前源码能力与缺口审计；
2. 「不可玩 / 证据不足 / 未发现确定性问题」的判定定义；
3. 机制组合、空间布局、可通行性的原子判据；
4. 每条判据的精确算法、输入、输出和失败定位；
5. 历史语料重判结果；
6. 合成负例测试矩阵；
7. 最小实施方案、修改面、测试计划和回退策略；
8. 独立实施 effort 的票据与审批问题。

## Notes

### 权威与输入

- **PRD（只读冻结）**：[`docs/v7.7/配置.md`](../../docs/v7.7/配置.md)；§13 是本图的启动依据。
- **开图裁定（冻结输入）**：[rulings-2026-11-04.md](rulings-2026-11-04.md)。Q1–Q7 全 A；逐字边界见该文件，本图不复述全文。
- **领域词汇**：`CONTEXT.md` 是唯一权威；本图不新增同义词。新术语先在规格中定义，是否写入 `CONTEXT.md` 由 [判定框架与输入/结果/集成边界裁定](issues/01-framework-and-boundaries.md) 决定。
- **前序**：[Design-to-Config Residual B/D Audit](../design-to-config-residual-bd-audit-v1/map.md) · [P1 实施](../design-to-config-residual-bd-audit-v1-p1/map.md)（均已收口）。本图**不重开** B-03 / B-04 / B-05 / D-04 的既有裁定；只在前序边界内审计 **config 侧**可确定的判据。
- **代码基线**：`main` @ `fa17c14`（PR #27 合并后）。

### 执行边界（来自裁定）

- **只读**：不修改生产代码；允许在 `.scratch/level-playability-v1/` 下写一次性分析脚本与夹具。
- **不改 Runtime / 不新增机制**：不动 `packages/demo/**` 的行为；不新增 EntityKind / Motion / 机制 / 斜坡碰撞。
- **契约形状变更单列审批**：允许提出审计纯函数与契约候选；任何 contracts schema/API 形状变化必须列必要性、替代方案、影响面、不做后果，等待独立审批。
- **零付费**：不调用模型、不生图、不重建站点、不产生新付费 Demo；只用现有 fixture、历史语料和确定性测试。
- **不改历史**：不修改 `run/**`、`pack/**`、`site/**`、`fixtures/**`、`.scratch/**` 中既有产物或验收证据。
- **试玩边界**：`AGENT_LIMITATION` / `TIMEOUT` / `ENVIRONMENT_FAILURE` **不得**自动转成 `PROVEN_UNPLAYABLE`；试玩只作证据。
- **停止线**：判据若只能依靠模型判断、主观难度评价或 Agent 试玩成功率，就不进入确定性 error，保留为观察项或 `INSUFFICIENT_EVIDENCE`。

### 判定框架（裁定原文摘要）

三层：

| 层次 | 要回答的问题 | 示例 |
|---|---|---|
| 空间可达性 | 目标是否存在几何上的可达路径？ | 拾取物是否被地形完全隔断 |
| 机制可通行性 | 路径在现有机制约束下是否实际可走？ | 巡逻危险区是否封死唯一通路 |
| 关卡完成性 | 必须完成的目标是否能在关卡规则下完成？ | 必需物品是否可取得、终点是否可到达 |

三态：

- `PROVEN_UNPLAYABLE`：确定性证明不可玩。
- `INSUFFICIENT_EVIDENCE`：当前算法无法证明可玩或不可玩。
- `NO_PROVEN_BLOCKER`：没有发现确定性阻断。**不等于**保证玩家一定能通关。

判据门槛：精确可算；能证明错误不是设计意图；只有可证明不可玩才进入确定性 error；难度、节奏、路线优劣、体验仍为观察项。

### 证据分级

沿用前序 effort 的 E1/E2/E3：

- **E1**：源码/契约定位（`file:line`）。
- **E2**：既有测试或新增的只读分析（测试名 + 断言）。
- **E3**：零付费语料重判或合成夹具复现（命令、退出码、路径、计数）。

### 02 审计基线（2026-11-04）

- 现有可玩性判据只有 `auditReachability`（只报「够不到」）加 `auditGameConfig` 的台阶高 / 行程越界 **warning**；其余是引用、身份、HUD、背景、机制存在性。
- 三态 `PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 全仓不存在；严格三态需要新结果形状。
- QA 实际是 7 条判据（`QA_JUDGEMENTS.length`），不是多处注释写的 6 条。
- 历史语料不能直接重判：171 份 manifest 中 81 份不是 v4；152 份 config 中 21 份唯一、96 份配对；reachability 新增 error 0；0 moving solid / 0 非 hazard motion / 0 `body` 覆盖；53 个 chest 实例 / 5 份唯一 config。
- 发布闸只重跑 `auditReachability`；新判据若不在该函数内，standalone `site` / `assemble_site` 不会执行。
- 设计层 `levels[].layout` 是自由文本、无坐标；只能判 config 自身几何 + 运行时语义。
- 低天花板 / 走路走廊有一个可复现的 reachability 误报（只建跳跃弧、不建走路边）。

详见 [02-capability-gap-audit.md](research/02-capability-gap-audit.md)。

### 票流

1. [判定框架与输入/结果/集成边界裁定](issues/01-framework-and-boundaries.md)（grilling，HITL）— open
2. [现有可玩性能力与缺口源码审计](issues/02-capability-gap-audit.md)（research，AFK）— resolved
3. [空间布局候选判据](issues/03-spatial-layout-judgments.md)（research，AFK，blocked by 01, 02）— open
4. [机制组合候选判据](issues/04-mechanic-composition-judgments.md)（research，AFK，blocked by 01, 02）— open
5. [关卡完成性候选判据](issues/05-level-completion-judgments.md)（research，AFK，blocked by 01, 02）— open
6. [历史语料清单、去重与覆盖缺口](issues/06-corpus-inventory.md)（task，AFK）— open
7. [合成负例与合法边界矩阵](issues/07-negative-positive-matrix.md)（task，AFK，blocked by 03, 04, 05）— open
8. [历史语料重判](issues/08-corpus-rejudgment.md)（task，AFK，blocked by 03, 04, 05, 06）— open
9. [最小实施方案与契约候选](issues/09-implementation-plan.md)（research，AFK，blocked by 01–08）— open
10. [审批包与独立实施交接](issues/10-approval-package.md)（grilling，HITL，blocked by 09）— open

## Decisions so far

- [现有可玩性能力与缺口源码审计](issues/02-capability-gap-audit.md)：现有判据只有 `auditReachability` + 台阶/行程 warning；chest、收集后返回 gate、hazard/danger 时序、moving solid、低天花板误报均未覆盖；三态不存在；历史语料 96 配对 / 0 新 error。报告见 [02-capability-gap-audit.md](research/02-capability-gap-audit.md)。

## Not yet specified

- 哪些空间布局判据能在**不改契约**的前提下精确可算，且不与 `auditGameConfig` 既有警告重复 —— 02 已给出候选缺口（chest、单向路径、低天花板误报、moving solid、`body` 语义）；具体取舍取决于 [空间布局候选判据](issues/03-spatial-layout-judgments.md)。
- `danger` 的安全窗口、`motion` 巡逻与跳跃时序能否给出**不误伤**的确定性判据，还是只能落到 `INSUFFICIENT_EVIDENCE` —— 取决于 [机制组合候选判据](issues/04-mechanic-composition-judgments.md)。
- 三态结果是否需要新的 contracts 形状，还是可完全落在现有 `ConfigIssue[]` + 只读审计报告（02 已确认：严格三态需要新结果形状；`ConfigIssue[]` 只能表达有/无 error）—— 取决于 [判定框架与输入/结果/集成边界裁定](issues/01-framework-and-boundaries.md) 与 [最小实施方案与契约候选](issues/09-implementation-plan.md)。
- 未来实施是否在编译/汇合点硬拒、失败分档如何变化 —— 取决于同上两票与 [审批包与独立实施交接](issues/10-approval-package.md)。
- 「可通行性 / 空间可达性 / 机制可通行性 / 关卡完成性」是否写入 `CONTEXT.md` —— 取决于 [判定框架与输入/结果/集成边界裁定](issues/01-framework-and-boundaries.md)。

## Out of scope

- **生产代码实施**：任何 `packages/**` 的 contracts / pipeline / assets / demo / qa 修改；实施另起 effort。
- **Runtime 修改**：新 EntityKind、Motion、机制、斜坡碰撞、外壳行为。
- **契约形状变更**：未经单列审批的 contracts schema/API 变化。
- **塔防 `td-config/v1`**：本轮只覆盖横版 `game-config/v1`。
- **付费验证**：模型调用、生图、站点重建、新付费 Demo。
- **把 Agent 试玩结果当判据**：`AGENT_LIMITATION` / `TIMEOUT` / `ENVIRONMENT_FAILURE` 不得转成不可玩。
- **难度 / 节奏 / 路线优劣 / 体验评价**：保留为观察项，不进确定性 error。
- **重开前序冻结裁定**：B-03 / B-04 / B-05 / D-04、`interactables` 同桶误归属、`decor` 无 kind 锁等；本图只在其边界内审计 config 侧可判定的部分。
- **修改历史**：`run/**`、`pack/**`、`site/**`、`fixtures/**`、既有验收证据。
- **多关卡索引、CLI/MCP 扩展、推送 `main`、合并 PR。**
