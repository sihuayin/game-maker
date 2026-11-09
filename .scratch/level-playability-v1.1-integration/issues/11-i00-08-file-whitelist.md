# I00-08 文件影响分析与白名单提案

Type: task
Status: claimed
Owner: —
Blocked by: 10
Map: ../map.md
Class: I-00 / DELIVERABLE

## Question

基于 [I00-R1](10-i00-r1-contract-freeze.md) 冻结的契约，产出生产修改的影响分析与**最小白名单提案**。提案不是授权；授权在 [I00-R2](13-i00-r2-whitelist-authorization.md)。

### 必须交付

1. **改动点清单**：按文件列出（预期涉及 `packages/contracts/src/playability/{mechanic,verdict,api,profile}.ts`、`config-audit.ts`、`packages/pipeline/**`、`packages/cli/**`、`packages/mcp/**`、`packages/demo/**` 中实际需要的那部分），每项写：改动性质、为什么必须在生产侧而不能留在审计侧、不做的后果。
2. **公共面判定**：是否新增 / 修改公开函数签名、CLI 参数、MCP 工具、`ConfigIssue.code`、持久化 schema、第三方依赖。每一项单独标为「需独立授权」。
3. **回归影响面**：列出会受影响的既有测试与 fixtures（`playability-{spatial,mechanic,completion,api}.test.ts`、`config-audit.test.ts`、`publish-gate.test.ts`、矩阵 fixture），并说明「旧行为不变」的判据。
4. **白名单草案**：允许改 / 明确禁止 / 需单独裁定，三栏。
5. **不做的替代**：对每个改动点写出「不做它会怎样」（通常意味着范围缩小或能力不可达）。

### 产出

`evidence/08-file-impact.md`。**不修改任何代码。**
