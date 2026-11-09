# I00-09 I-01～I-05 实施计划骨架

Type: task
Status: claimed
Owner: —
Blocked by: 10
Map: ../map.md
Class: I-01～I-05 / PLAN

## Question

按 PRD §8 的 I-01～I-05，写出正式实施的顺序、依赖与验收条件。**这是计划，不是执行**；所有条目只能是 `PLANNED`。

### 每阶段必须给出

- 交付物清单。
- 前置依赖（含本图已冻结的契约条目）。
- 测试矩阵落点：哪些落 `packages/contracts/tests/`，哪些落 `packages/pipeline/tests/`，哪些只能 scratch 取证。
- 验收条件与**退出条件**（什么情况下必须停下来转 HITL）。
- 相对 PRD 的偏离（若有），以及偏离需要谁批准。
- 成本量级（人时 / 会话数），标明是估算。

### 必须回答的两个问题

1. **I-04 的「V1 完整回归」到底覆盖什么**：LP-06 / LP-07 只有 scratch 脚本、无 vitest；若 I-04 要证明「旧有静态关卡行为不回退」，是用既有测试 + 语料复跑，还是要先补测试？补测试属于哪个阶段？
2. **真实关卡案例从哪来**（I-05 要求）：现有语料里含移动 hazard 的关卡是否足以作验收样本；若不足，是否需要在授权范围内新建 fixture。

### 产出

`evidence/09-implementation-plan.md`。**不写任何实现代码，不标任何条目为已完成。**
