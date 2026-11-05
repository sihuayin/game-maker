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
