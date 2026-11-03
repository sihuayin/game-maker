# 验收、全局语料重判与 report.md

Type: task
Status: open
Owner: —
Blocked by: 05
Map: ../map.md

## Question

在五项实施全部完成并各自验收后，验证组合结果、执行全局语料重判，并产出实施报告。
依据：[final-report.md](../../design-to-config-residual-bd-audit-v1/final-report.md) §3.1；
[plan.md](../../design-to-config-residual-bd-audit-v1/plan.md) §7–§8。

### 允许修改

- 新增 `.scratch/design-to-config-residual-bd-audit-v1-p1/report.md`。
- 只在 `/tmp` 写一次性语料扫描脚本（不提交）。
- 不得修改 `out/**`、`fixtures/**`、`.scratch/**` 的既有产物；不得 `reset` / `clean`。

### 验收要求

- `pnpm build`、`pnpm typecheck`、`pnpm test` 全绿。
- 逐项测试批次（`plan.md` §7.2）各自绿，失败必须归因到某一项。
- 全局语料重判（`plan.md` §7.3）：扫描 `out/**`、`fixtures/**`、`.scratch/**`，跳过
  `node_modules` / `.git`；记录配对、B-02 新增 error、D-01 `world.size.h`、D-02 role、
  D-03 resampleable、publish-gate 三元组、QA 报告。
- 06 必须验证**五项的组合结果**，不能只汇总五张票各自的测试通过情况。
- 任何新增 error / 新拒绝都必须逐条解释为真实缺陷；无法解释 ⇒ 失败，停止链条（F3）。
- 写 `report.md`：修改面、契约变更、逐项测试证据、语料重判结果、fixture 同步、已知限制、失败与回退记录。
- 检查 `git status`，确认只有授权范围内的文件变化。

### 通过标准

- 上述命令全绿；`report.md` 完整；无未授权变更；无付费调用、无生图、无站点重建。
- 票内 `## Answer` 记录命令、退出码、语料指标、commit SHA；指向 `report.md`。

### 回退方法

- 本票不产生生产代码；若发现某项组合回归，定位到对应实施票并回退该项，按 F3 停止链条。

### 提交

- 独立 commit：`P1-acceptance: combined verification and report`。

### 证据

- 测试与语料输出、`report.md`、commit SHA；供 PR 审阅。
