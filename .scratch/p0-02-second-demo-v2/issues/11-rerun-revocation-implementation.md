# 失败重跑不遗留旧 pass：实施

Type: task
Status: resolved
Blocked by: 01, 05

## Question

按票 05 的裁定实现撤销语义。最低不变量：

1. **先红**：新增失败测试，覆盖「旧 pass → 新失败 attempt」的当前缺口 ——
   - 准备阶段拒绝（QA/site 检查不过、site/config 缺失、身份不符、`--scenario-dir` 无效）；
   - harness 崩溃、无 `result.json`；
   - 写回被拒（身份不符 / I/O 失败）；
   - 撤销后 `verify-delivery` 重算与声明状态一致（不能因保留旧摘要而重算出 pass）。
   当前这些情况都会保留旧 `playable-smoke=pass`（或重算出 pass）；测试应证明。
2. **实施（撤销 + 预失效，票 05）**：
   - `runDir` 形状合法且 `qa-report.json` 可读带 `delivery` 后，**立即原子写回**：移除 `delivery.playtest`、移除旧 `playtest-*` 证据引用、`playable-smoke=blocked`（detail 说明旧结果已撤销 / attempt 进行中）、重算 verdict；
   - 写 `run/vN/playtest/invalidations/<timestamp>.json`（原因、前后 `playable-smoke`、被移除的 refs）；
   - 准备/执行失败按表保持或重算：SUCCESS→pass；GAMEPLAY_FAILURE→fail；ENVIRONMENT_FAILURE / 身份不符 / 准备拒绝 / harness 无结果 / 写回 I/O 失败→blocked；TIMEOUT / AGENT_LIMITATION / UNKNOWN→incomplete；
   - 成功写回复用现有 `applyPlaytest` 恢复摘要与证据；
   - `runDir` 不合法或报告不可读时属于撤销边界，在 CLI 输出/证据中明确记录；
   - **不扩** delivery schema / 不新增 attempt 字段。
3. **测试**：补「pass → 准备拒绝 / 无结果 / GAMEPLAY_FAILURE / ENVIRONMENT_FAILURE / TIMEOUT / UNKNOWN」用例；断言 `playable-smoke` / verdict / `delivery.playtest` 缺席 / 旧 `playtest-*` 引用已移除 / invalidation 记录内容；补「成功写回恢复 pass」与 verify-delivery 声明↔重算一致性用例。
4. **真实证据**：在**独立副本**上制造失败 attempt（至少覆盖「准备拒绝」与「harness/无结果或身份不符」各一次），确认旧 pass 在失败前已被撤销、`playable-smoke=blocked`、旧 `playtest-*` 引用消失、invalidation 记录可读；再在另一独立副本上跑一次成功写回，确认恢复 `pass`。记录命令、退出码、attempt、delivery 前后、历史零改动；基线副本不被污染。
5. **回归**：目标测试 + `pnpm typecheck`。

产物：代码 + 测试 + `research/11-rerun-revocation-evidence.md`。未获票 05 裁定前不开工。

## Answer

**2026-10-30 实施收口。** 证据：[research/11-rerun-revocation-evidence.md](../research/11-rerun-revocation-evidence.md)。

### 实现

- 新 `invalidatePlayableSmoke(runDir, reason)`：移除 `delivery.playtest`、移除旧 `playtest-*` 引用、`playable-smoke=blocked`（detail：旧结果已撤销 / attempt 进行中）、重算 verdict、原子写回；写 `playtest/invalidations/<timestamp>.json`（before/after/removedRefs）；重复撤销幂等。
- `playtest` CLI 在任何准备校验之前撤销；准备拒绝时把撤销结果写进 rejection；有可解析报告按 `mapPlaytest` 重算；无结果/准备拒绝/写回 IO 失败保持 blocked；成功恢复 pass。
- 不扩 `delivery` schema / 不新增 attempt 字段。

### 证据

- 全量 `pnpm test` **152 文件 / 2268 tests** 全绿；`pnpm typecheck` exit 0；历史证据验收 exit 0。
- 准备拒绝 E3（独立副本）：exit 4；旧 pass **先撤销**为 blocked；playtest 摘要与 8 条旧引用移除；invalidation/rejection 记录齐全。
- 成功恢复 E3（独立副本）：exit 0 / 19s / attempt v3；撤销 before pass→blocked，最终恢复 playable-smoke=pass、verdict=pass。
- 基线副本 qa-report 仍为 `dc20e301…5ee6`；旧 work / 快照零改动；零付费、未提交。
- 无结果/硬崩溃由单元测试覆盖；本轮真实 E3 覆盖准备拒绝与成功恢复。
