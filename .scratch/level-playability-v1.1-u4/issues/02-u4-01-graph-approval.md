# U4-01 graph.ts HopSampling 独立增量审批

Type: task
Status: open
Owner: —
Blocked by: 01
Map: ../map.md
Class: U4 / APPROVAL (HITL)

## Task

准备并取得用户对 `graph.ts` 可选尾参 `HopSampling = { hz?: number; maxSamples?: number }` 的**独立书面增量审批**。**本票只出审批包与提案，不修改产品代码。**

### 必须完成

1. 复核允许面（D4 §5、D6 §3）：
   - 仅 `hopSamples` / `hopEdges` / `hopTargets` 新增可选尾参；
   - 默认 `{ hz: 60, maxSamples: 120 }`；
   - 不得修改跳跃公式、既有采样语义、其他导出或调用语义；`reach.ts` 不在范围；
   - `reachableCells` 仅在逐项列明时包含。
2. 写出**最小加法式 diff 提案**（不应用、不落产品目录）：函数签名、默认值合并、调用传递；逐行列明。
3. 写出回归计划（与提案一并送审）：
   - 显式传默认参数 vs 无参调用的行为一致；
   - 可序列化场景验证稳定序列化结果一致；
   - 既有 `playability-graph.test.ts` / `playability-temporal-input.test.ts` 断言不修改；
   - 回归断言落点：`packages/contracts/tests/playability-temporal-evasion.test.ts`（U4 白名单测试文件，新建；本票只提案，不创建）。
4. 明确审批边界：该审批独立于 I-00 R2；不得以「已列入白名单」推定；未批 U4 保持 `BLOCKED`；不得用临时改动、测试专用实现或复制实现绕过。
5. 向用户呈现审批包，取得**书面**结论（批准 / 修改后批准 / 拒绝）与日期；记录用户原文。
6. 写审批记录 `.scratch/level-playability-v1.1-i02/reports/06-u4-graph-approval.md`：
   - 审批对象、允许面、逐行 diff 提案、回归计划、用户结论与日期；
   - 若批准，明确授权文件范围：`graph.ts` + `playability-temporal-evasion.test.ts`（仅默认等价断言）。
7. 写证据 `.scratch/level-playability-v1.1-u4/evidence/01-graph-approval.md`（含 `graph.ts` 当前 hash、提案 diff 文本 hash）。

### 禁止

- 修改 `packages/**`；
- 自行判定审批通过或代填用户结论；
- 推送 / 建 PR / 合并。

### 验收

审批记录完整；允许面与 D4/D6 逐条一致；回归计划可执行；用户书面结论与日期在案。**未取得批准 ⇒ 本票不 resolved，U4 保持 `BLOCKED`。**

## Answer

（resolved 时填写）
