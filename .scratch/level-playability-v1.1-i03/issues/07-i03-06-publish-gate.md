# I03-06 publish-gate 消费规则

Type: grilling
Status: open
Owner: —
Blocked by: 01, 02, 03
Map: ../map.md
Class: I-03 / DECISION

## Question

I-03 第一阶段 `publish-gate` 如何消费 `coverage.temporal` / evidence 而**不改变拒稿行为**？未来何时、如何允许时序结果影响拒稿？

### 必须裁定

- 第一阶段：只增加 coverage / evidence，不改变 `auditPlayability` 拒稿规则；
- 模型内 `PROVEN_UNPLAYABLE` 不直接拒稿；`NO_PROVEN_BLOCKER` 不改放行；IE 如实暴露；
- 未来 gate 变更的四项要求（coverage 独立验证、能力准入、负向场景、独立复核 / 授权）；
- feature flag / rollout / rollback；
- 不改现有 `publish-gate` 断言，除非授权包另列。

### 禁止

- 第一阶段改变生产拒稿 / 放行；
- 把时序 IE 当安全结论；
- 未经授权修改 `publish-gate`。

### 验收

第一阶段消费规则、未来 gate 变更门槛、负向场景、回滚路径。
