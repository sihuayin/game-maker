# I03-IMPL-05 U5 执行 brief

Type: grilling
Status: open
Owner: —
Blocked by: 04
Map: ../map.md
Class: I-03-IMPL / U5

## Question

为 **U5（pipeline `publish-gate` 诊断字段）** 产出一份可交接的执行 brief，至少覆盖：

- 授权包 §11.2 的 U5 逐文件白名单；
- `PublishGateResult.temporal` 诊断字段；不落盘 / 不进 CLI / MCP / 不升契约；缺省 ≠ 不适用；
- G1–G11 + 变异测试；拒稿输入闭集、无新增 throw、时序证据不产 `CommandError`；
- U5 专属门：G1–G11 + 变异测试全过；
- **消费 U4 `TemporalAuditReport`**：使用 `coverage` / `evidence` / `publicVerdict`（不使用 legacy `verdict` / `degradation`）；把 `configProblem` 已有的 audit 传给 `runTemporalAudit({ existingAudit })`；不改变 U4 返回形状；
- **回滚演练**；
- 独立复核输入、E1 / E2 / E3、不变量快照；
- **明确：本 brief 不写代码**。

## Answer

（resolved 时填写）

## Comments

- 2026-11-16 I03-IMPL-04：U5 消费 U4 `TemporalAuditReport` 新字段；legacy 字段不作为诊断来源；U4 返回类型已冻结。
