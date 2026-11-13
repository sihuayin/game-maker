# U4-03 `graph.ts` 独立 PR 推送与合并门 — 进度证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-12 |
| 分支 | `wayfinder/level-playability-v1.1-u4-graph-hop` @ `13b4e3b` |
| PR | [#37 U4: graph.ts HopSampling tail param](https://github.com/sihuayin/game-maker/pull/37) |
| PR base | `wayfinder/level-playability-v1.1-i02`（`c0d6981`） |
| 推送 | 已完成（经 ClashX `127.0.0.1:7890`） |
| PR 可合并性 | `MERGEABLE`（GitHub 报告） |
| CI | `check` / `test` / `typecheck` 三条 **pending**（[run 43238060410](https://github.com/sihuayin/game-maker/actions/runs/43238060410)） |
| 合并 | **未合并**；等待用户确认 + CI 绿 |
| 合并后动作 | 记录合并 commit / i02 HEAD；把 `wayfinder/level-playability-v1.1-u4` rebase 到新 i02 |

## 边界

- 本 PR 只含 `graph.ts` 尾参与默认等价测试；**不是 U4 实施 PR**，不授权 U4。
- 合并前 U4 执行门保持 `BLOCKED`。

## 合并结果（2026-11-13）

| 项 | 值 |
| --- | --- |
| PR #37 状态 | **MERGED** · 2026-11-13T01:31:51Z |
| 合并方式 | merge commit |
| 合并 commit | `2241e1192b26466b50d0e918d543aaf47cd340a8` |
| i02 HEAD（合并后） | `2241e11`（PR #37 merge） |
| CI | `check` 35s ✅ / `test` 5m1s ✅ / `typecheck` 50s ✅ |
| u4 分支并入 i02 | 本地 merge commit `b884a35`（`U4: take merged graph.ts tail param from i02`） |

> **基准确认**：U3 仍未并入 i02；因此 u4 分支采用「把已合并的 i02 merge 进 u4」而不是 rebase，以保留 U3 提交。待 U3 并入 i02 后，U4 PR 只需呈现本单元增量。

## 合并后复跑（u4 分支 @ `b884a35`）

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| graph + evasion + gate + temporal-input | **0** | 4 files / **129 tests passed**（11 + 5 + 48 + 65） |
| `pnpm test` | **0** | **175 files / 2800 tests passed**；2 条 `onTaskUpdate` RPC 超时（非断言失败） |

## 执行门状态

U4 执行门的两项条件均已满足：

1. `graph.ts` `HopSampling` 独立书面审批（U4-01，amber，2026-11-12）；
2. 独立 PR #37 先合并（2026-11-13）。

⇒ **U4 实施解锁**，下一 frontier 为 U4-04（图割模块 API 骨架与输入契约）。

## 后续更新（2026-11-13）

U3 已完整并入 i02：PR #36（U3 产品，`c9aaf1e`）+ PR #38（R3 / U3-SIGN 台账，`d1cee1c`）。i02 现为 `d1cee1c`；u4 分支相对 i02 的产品 diff 只剩 U4 的两个白名单文件。
