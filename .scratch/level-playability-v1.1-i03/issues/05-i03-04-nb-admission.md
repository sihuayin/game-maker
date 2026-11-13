# I03-04 PUBLIC_NB 三阶段准入链

Type: grilling
Status: open
Owner: —
Blocked by: 01, 02, 03, 04
Map: ../map.md
Class: I-03 / DECISION

## Question

定义 `PUBLIC_NB` 的三阶段——**接线完成 / 证据准入 / 公共开放**——以及每阶段的入口条件、证据、独立审查、授权与回滚。

### 必须裁定

- 接线完成：生产链路消费内部 NB 候选 + Witness；**不等于开放**；
- 证据准入：几何 `checked`、`coverage.temporal`、lag 语义、Witness 完整性、确定性、预算等条件；
- 公共开放：独立审查 + 增量授权 + 发布开关；只有证据准入通过才可；
- 公共 NB 的 release gate / feature flag / 回滚；
- 不得因 I-02 `nb-candidate` 或接线成功自动开放；
- 与 `PUBLIC_PU` 的独立关系。

### 禁止

- 把三阶段压成一个“接通即开放”；
- 在几何 / 时序证据未准入时发布公共 NB；
- 由 NB 推导 PU。

### 验收

三阶段状态机、每阶段证据 / 审查 / 授权 / 回滚、负向场景（接线完成但未准入）。

## Answer

（resolved 时填写）
