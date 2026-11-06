# LP-05 Pipeline 集成

Type: task
Status: open
Owner: —
Blocked by: 08
Map: ../map.md

## Question

按 PRD §4.6 把可玩性判据接入正式生产流程，形成统一入口 `auditPlayability`。本票 AFK。

### 必须实现

1. `auditPlayability(config, manifest, profile?)`：内部组合空间 / 机制 / 完成性三层；`auditReachability` 保留为 QA 单层入口，两者共用同一移动图核心。
2. **deterministic**：`auditConfigPipeline.deterministic` 内替换 reachability；`PROVEN_UNPLAYABLE` 映射为现有 `ConfigIssue[]`（`severity:"error"`，不加 `code`）。
3. **Publish Gate**：现场复验改调 `auditPlayability` 的映射，不得绕过已有确定性失败。
4. **C1 加法导出**：仅 `auditPlayability` / `playabilityIssues` + 内部类型；不改既有调用者或返回形状。
5. **结果分档**：`INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 不产 `ConfigIssue`；severity 只由 verdict 派生。
6. **coverage**：`coverage.partial` 只活在内部 verdict，不落 `qa-report.json` / `delivery` / config。

### 必须交付

- 集成测试：确定性失败退出码仍为 `invalid`(4)；发布闸阻断；非阻断结果不改变流程。
- 回归：QA 仍 7 条，`QA_JUDGEMENTS.length` 不变；CLI / MCP 参数不变；无持久化 schema。
- 残余风险明写：standalone `assembleSite` 直调不过闸；QA standalone 看不到机制 / 完成性 error。
- 本票 `## Answer`：commit SHA、命令与退出码、测试清单、回退点。

### 边界

- 不新增 QA 第 8 条；不新增 CLI / MCP 参数；不新增持久化 Playability schema。
- 不改 Runtime 行为；零付费。

### 通过标准

- AC-07：确定性不可玩能够阻断发布；非阻断结果保留诊断。
- AC-11：无未经批准的 Runtime / Contract / CLI / MCP 扩展。

## Context

- **前置（LP-03 复核 Q5(b)）**：在把机制 A 接成 `deterministic` 硬拒之前，先修 `graph.ts` `movementNeighbors` 对 standable 格子发 `fall` 边的过近似（它可能让 A 的 base 反事实通过不存在的路径显示可达，把空间不可达误归因给 hazard），并重跑 LP-01/02/03 全量回归；该修复单独 commit。
- LP-01 / LP-02 已落定：`auditReachability` **尚未**改（LP-02 是纯加法），`playability/` 内部桶已含 `verdict` / `spatial`，但**未**从 contracts 根导出。
- 接线点按 [plan.md](../level-playability-v1/plan.md) §1：`config-audit.ts:53` 的 `deterministic` 替换、`publish-gate.ts:140` 现场复验替换、`index.ts` C1 加法导出。开票时按真实代码复核是否有细节偏差。
- 层内 verdict 与整关 aggregate 分层（plan R21(a)）：`auditPlayability` 做整关聚合；`coverage.spatial` 在 LP-02 恒为 `partial`（玩家 / 帧几何不可见），整关 aggregate 因此多为 `INSUFFICIENT_EVIDENCE`，但**不得**掩盖 `PROVEN_UNPLAYABLE`。
