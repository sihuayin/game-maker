# Draft PR（U4 垂直规避图割）— **未推送、未创建**

| 项 | 值 |
| --- | --- |
| Title | `U4: vertical evasion graph cut and hop doubling` |
| Base | `wayfinder/level-playability-v1.1-i02` |
| Head | `wayfinder/level-playability-v1.1-u4` @ `d14481c` |
| 状态 | **draft only**（U4-09 不推送、不建 PR） |

## 前置条件（合并顺序）

1. **U3 PR 必须先并入 i02**（U3 已推送、已签署，但 PR 尚未创建/合并）。
2. 之后把 `wayfinder/level-playability-v1.1-u4` rebase 到新 i02，使本 PR 只呈现 U4 增量。
3. `graph.ts` 尾参已由 [PR #37](https://github.com/sihuayin/game-maker/pull/37) 先行合并（`2241e11`），本 PR 不重复包含。

## Summary

- 新增 `temporal-evasion.ts`：图割判据（精确 spawn + `assessReachability(..., { full: true })`）、hop 60/120Hz 双档、规范化采样覆盖 `F1 ⊆ F2`、模型闭合声明。
- 新增 `playability-temporal-evasion.test.ts`：36 tests，覆盖 API 契约、反例 5/7–12、降级映射与输出边界。
- 不组装 `puConditions` / `geometryCoverage` / 完整 `PermanentGateProof` / `TemporalInternalResult`；不发布公共 Verdict。

## Verification

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | 0 | 通过 |
| `pnpm typecheck` | 0 | 通过 |
| evasion 定向 | 0 | 36 / 36 |
| gate 回归 | 0 | 48 / 48 |
| graph 回归 | 0 | 11 / 11 |
| temporal-input 架构断言 | 0 | 65 / 65；T-55/57/58/61/62/64 ✓ |
| `pnpm test` | 0 | 175 files / 2831 tests |

## diff stat（U4 范围 `b884a35..d14481c`）

```text
 packages/contracts/src/playability/temporal-evasion.ts  | 329 +++++++++++++++++
 packages/contracts/tests/playability-temporal-evasion.test.ts | 411 +++++++++++++++++++++
 2 files changed, 740 insertions(+)
```

## 白名单声明

产品路径改动仅上述两个文件；`graph.ts` 仅含 PR #37 已批准的 `HopSampling` 尾参；`temporal.ts` / `reach.ts` / docs / fixtures / 依赖 / 锁文件 / JSON fixture 零 diff；无新增公共 barrel 导出。

## 证据

- 实现报告：`.scratch/level-playability-v1.1-u4/reports/09-implementation.md`
- R4 输入包：`.scratch/level-playability-v1.1-u4/reports/09-r4-input-package.md`
- R4 报告（待写）：`.scratch/level-playability-v1.1-i02/reports/R4-review.md`
- 授权 / 审批：`.scratch/level-playability-v1.1-i02/reports/05-u4-incremental-authorization.md`、`06-u4-graph-approval.md`
