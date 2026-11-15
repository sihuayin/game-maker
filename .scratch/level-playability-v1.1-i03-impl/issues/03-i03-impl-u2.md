# I03-IMPL-03 U2 执行 brief

Type: grilling
Status: open
Owner: —
Blocked by: 02
Map: ../map.md
Class: I-03-IMPL / U2

## Question

为 **U2（contracts 能力门 + 公共 Verdict 映射）** 产出一份可交接的执行 brief，至少覆盖：

- 授权包 §11.2 的 U2 逐文件白名单；`api.ts` 只改 U2 职责，且只能在 U1 独立复核通过并签署后修改；
- `PublicCapabilityGate` 硬编码 `BLOCKED`、`coverage.temporal` 聚合、Verdict 映射与优先级、冲突 STOP；
- 测试名与断言（AC-05–AC-09；V1–V10 / N1–N8）；
- 独立复核输入、证据、不变量快照；
- 回滚目标（文档化）与 STOP 触发；
- **明确：本 brief 不写代码**。

## Answer

（resolved 时填写）
