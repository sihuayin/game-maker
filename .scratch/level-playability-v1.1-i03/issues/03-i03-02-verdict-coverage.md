# I03-02 公共 Verdict 与 coverage 语义

Type: grilling
Status: open
Owner: —
Blocked by: 01, 02
Map: ../map.md
Class: I-03 / DECISION

## Question

I-03 适配层如何把内部结果映射为公共 `PlayabilityVerdictState` 与 `coverage`？在 `PUBLIC_NB` / `PUBLIC_PU` 未准入前，公共 Verdict 应如何保持 IE / 不发布？

### 必须裁定

- `nb-candidate` 在公共层是什么？（不得直接 `NO_PROVEN_BLOCKER`，除非 NB 证据准入通过）
- `pu-candidate` 在公共层是什么？（`PUBLIC_PU` 为 `BLOCKED` 时不得 `PROVEN_UNPLAYABLE`）
- `insufficient-evidence` 如何保持独立，绝不映射为 `NO_PROVEN_BLOCKER`；
- `coverage.temporal` 如何参与整关 aggregate；`partial` 是否拉低整关 verdict；
- 现有 `auditPlayability` 的三层聚合与 `playabilityIssues` 拒稿规则是否原样保留；
- 公共 Verdict 与内部结果的双层状态如何并存；
- **不得用接线完成替代证据准入**。

### 禁止

- 在准入前发布公共 `NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE`；
- 把 IE 转成安全结论；
- 未经授权修改 `verdict.ts` / `api.ts` 的公共语义。

### 验收

公共 Verdict / coverage 状态表、聚合规则、IE 不变量、与现有三层的关系、负向场景。
