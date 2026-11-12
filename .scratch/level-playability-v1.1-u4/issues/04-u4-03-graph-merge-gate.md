# U4-03 graph.ts 尾参独立 PR 推送与合并门

Type: task
Status: in-progress
Owner: claude (U4-03 session 2026-11-12) / merge pending user confirmation
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
