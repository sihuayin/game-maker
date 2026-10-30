# 失败重跑不遗留旧 pass：撤销语义

Type: grilling
Status: resolved
Blocked by: （无）

## Question

HITL：当前失败重跑的撤销只做了一半 —— 有可解析 `result.json` 时，旧 `playtest-*` 证据引用被移除、`playable-smoke` 与 verdict 重算并降级；但准备阶段拒绝、harness 崩溃无 `result.json`、写回被拒三种情况，旧 `pass` 原样保留（`packages/cli/src/playtest.ts:170-176,350-387,405-410`）。请裁定：

1. **撤销时机与语义**
   - (a) **预失效**：每次 attempt 开始前把 `playable-smoke` 置为 `incomplete`（detail 说明 attempt 进行中）；成功写回才恢复 `pass`；任何失败/崩溃保持 `incomplete` / `blocked`。不新增 schema 字段。
   - (b) 只在已知失败路径上事后降级；硬崩溃仍可能遗留旧 pass。
   - (c) 新增 `delivery.attempt` / `lastAttempt` 字段记录最近 attempt 状态（契约扩展）。
   - (d) 删除旧 pass / 旧证据。
2. **状态映射**：准备拒绝、harness 无结果、身份不符、环境失败、超时、UNKNOWN 分别落 `blocked` / `incomplete` 的哪一档？是否需要沿用五态归因？
3. **契约批准**：若选 (c)，是否批准扩 `delivery` schema？

已知事实：`DeliveryCheckStatus` 有 `pass/fail/incomplete/blocked/not-required`；`DeliveryVerdict` 有 `pass/fail/incomplete/blocked`；现有测试没有「旧 pass → 新失败 attempt」用例。

建议（待裁定）：**1(a) + 2 按五态归因映射（环境/身份/准备拒绝 → blocked；超时/未知/写回失败 → incomplete）+ 3 不扩契约**。理由：预失效对硬崩溃也成立，能真正保证「不遗留旧 pass」；用现有状态即可表达，不必扩 schema。

产物：票内 Answer + 追加裁定；未裁定前不写生产代码。

## Answer

**2026-10-29 HITL 收口。** 逐字裁定见 [rulings-2026-10-29.md 第 7 节](../rulings-2026-10-29.md)。

### 已定契约

| 项 | 决定 |
|---|---|
| 撤销时机 | `runDir` 形状合法 + `qa-report.json` 可读且带 `delivery` 后**立即**撤销；此后任何准备/执行失败都保持撤销态 |
| 撤销动作 | 原子写回：移除 `delivery.playtest`、移除旧 `playtest-*` 证据引用、`playable-smoke=blocked`（detail：旧结果已撤销 / attempt 进行中）、重算 verdict |
| 旧 attempt | 文件保留在磁盘；只从当前 delivery 摘要与 `delivery.evidence` 引用中移除 |
| 成功 | 复用现有 `applyPlaytest` 写回，恢复 `playable-smoke` / `delivery.playtest` / 证据 |
| 有可解析报告 | 沿用 `mapPlaytest`：SUCCESS→pass；GAMEPLAY_FAILURE→fail；ENVIRONMENT_FAILURE→blocked；TIMEOUT/AGENT_LIMITATION/UNKNOWN→incomplete |
| 无新摘要 | 准备拒绝、身份不符、harness 无结果、写回 I/O 失败 → 保持 `blocked`（**不**用 incomplete） |
| 例外边界 | `runDir` 不合法或 qa-report 不可读/无 delivery 时无法写回撤销；必须在 CLI 输出与证据中明确记录 |
| 审计 | 新增 `run/vN/playtest/invalidations/<timestamp>.json`：原因、撤销前后 `playable-smoke`、被移除的 `playtest-*` refs；并写 rejection/invalidation 记录 |
| 契约 | **不扩** `delivery` schema / 不新增 attempt 字段；行为收紧而已 |

### 实现义务（已回写下游票）

- [失败重跑撤销实施](../issues/11-rerun-revocation-implementation.md)：撤销函数与时机、原子写回、映射表、invalidation 记录、verify-delivery 一致性测试、独立副本 E3。
