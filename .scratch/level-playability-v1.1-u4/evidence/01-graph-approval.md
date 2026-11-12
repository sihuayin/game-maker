# U4-01 `graph.ts` 审批包证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-12 |
| `graph.ts` SHA-256 | `def3fa7132b9142e5f9441f1b5b6f5b6e4d8ef97096bd0db0b2c5b620445e55b` |
| 提案 diff SHA-256 | `3213ecfe85d344a9a3617ed9d648f7000c437f4992edbacf31fd0f463444c62f` |
| 提案正文 | [`01-graph-approval-proposal.diff`](./01-graph-approval-proposal.diff) |
| 审批记录 | [`.scratch/level-playability-v1.1-i02/reports/06-u4-graph-approval.md`](../../level-playability-v1.1-i02/reports/06-u4-graph-approval.md) |
| 产品目录改动 | **无**（本票只出审批包） |

## 事实核对

- `hopSamples` 定义于 `graph.ts:225`，现行采样数：`Math.max(6, Math.min(120, Math.ceil(t * 60)))`。
- `hopEdges`（`graph.ts:253`）内部调用 `hopSamples`；`hopTargets`（`graph.ts:272`）调用 `hopEdges`。
- 既有 4 参调用点：`reach.ts:129`、`completion.ts:220`、`reachableCells`（`graph.ts:293`）；尾参可选后均不受影响。
- `graph.ts` 经 `playability/index.ts:10` 的 `export *` 可见；`packages/contracts/src/index.ts` 只导出 `playability/api.js`，包 `exports` 只暴露 `.`。
- 未运行新命令：本票不产生产品改动；回归在 U4-02 执行。

## 状态

审批结论待用户填写。**未批准前 U4 执行门保持 `BLOCKED`。**
