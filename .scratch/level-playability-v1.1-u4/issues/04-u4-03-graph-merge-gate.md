# U4-03 graph.ts 尾参独立 PR 推送与合并门

Type: task
Status: resolved
Owner: claude (U4-03 session 2026-11-12/13) + amber (merge authorization)
Blocked by: 03
Map: ../map.md
Class: U4 / APPROVAL (HITL)

## Task

把 U4-02 的独立分支按授权包 §7.2 的要求**单独 PR、先合并**。本票是**推送 / 建 PR / 合并的唯一许可点**，且**只在用户明确指令下执行**。

### 必须完成

1. 确认 U4-01 书面批准与 U4-02 本地证据齐全。
2. **等待用户明确指令**（推送 / 建 PR / 合并分别或合并授权）。未收到指令前票保持 open，U4 保持 `BLOCKED`；不得自动执行。
3. 收到指令后：
   - 经 ClashX 代理推送独立分支；
   - 创建指向 `wayfinder/level-playability-v1.1-i02` 的 PR，标题注明 `U4: graph.ts HopSampling tail param`；
   - 记录 PR 号与 CI / 本地回归结果；
   - 经用户许可后合并，记录合并 commit 与合并后 i02 HEAD。
4. 合并后把 `wayfinder/level-playability-v1.1-u4` rebase 到合并后的 i02，并记录新的 base SHA。
5. 写证据 `.scratch/level-playability-v1.1-u4/evidence/03-graph-merge.md`（PR 号、合并 commit、i02 HEAD、回归结果）。

### 禁止

- 在无明确指令时推送 / 建 PR / 合并；
- 在同一 PR 中混入 U4 实现；
- 修改产品代码。

### 验收

PR 已合并并记录 commit；u4 分支已 rebase；`graph.ts` 默认行为回归通过。**未合并前 U4 实施不得开始。**

## Answer

（resolved 时填写）

## Answer

**完成。PR #37 已合并，U4 执行门解除。**

| 项 | 结果 |
| --- | --- |
| PR | [#37 U4: graph.ts HopSampling tail param](https://github.com/sihuayin/game-maker/pull/37) |
| 状态 | **MERGED** · 2026-11-13T01:31:51Z（merge commit） |
| 合并 commit | `2241e1192b26466b50d0e918d543aaf47cd340a8` |
| i02 HEAD | `2241e11` |
| CI | `check` 35s ✅ / `test` 5m1s ✅ / `typecheck` 50s ✅ |
| 用户指令 | 2026-11-12 授权「CI 绿后合并」 |
| u4 分支 | merge i02 @ `2241e11` → 本地 merge commit `b884a35`（保留 U3 提交；U3 尚未并入 i02） |
| 合并后复跑 | build / typecheck 0；graph+evasion+gate+input **129 / 129**；全量 **175 files / 2800 tests**，退出码 **0** |

**执行门**：独立审批（U4-01）+ 独立 PR 先合并（U4-03）均已完成 ⇒ **U4 实施解锁**。

证据：[`../evidence/03-graph-merge.md`](../evidence/03-graph-merge.md)。

**下游**：U4-04（图割模块 API 骨架与输入契约）已 **unblocked**。本票未启动 U4-04。

**后续更新（2026-11-13）**：U3 已完整并入 i02（PR #36 + PR #38，`d1cee1c`）；ticket 中的「U3 尚未并入 i02」为当时状态，现已解除。
