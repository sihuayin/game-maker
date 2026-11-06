# LP-07 最终收口

Type: grilling
Status: resolved
Owner: amber · 2026-11-06
Blocked by: 10
Map: ../map.md

## Question

汇总 LP-00～LP-06 的实现与证据，形成可审查、可复现、可回退的完整交付，并由用户裁定收口（PRD §4.8）。本票 HITL。

## Context

- LP-04 / LP-05 的实现与文档在本地，**未推送**；Draft PR #28 仍停在 LP-03。收口前需推送并更新 PR。
- `pnpm test` 依赖 `vitest.config.ts` 的 20s 超时 + `dangerouslyIgnoreUnhandledErrors`（Vitest worker RPC 超时）；LP-07 必须复核是否可移除。
- LP-06 已完成：96 配对 / 20 config；3 历史真实缺陷、0 playability 误报、6 probe 排除；合法 gate no-walk 0。
- **矩阵双口径（用户裁定 A）**：层内 / 案例级预期 **19 / 16 / 4**；实际 `auditPlayability` 组合 **19 / 9 / 11**（7 个带合法宽巡逻 hazard 的空间边界是覆盖缺口，不是误报/硬拒）。LP-07 必须两列并陈，并保留 `NO_PROVEN_BLOCKER` ≠「可玩」。
- 整关 aggregate 采用用户 2026-11-06 裁定的三层 verdict 组合；`coverage` 单独暴露。
- 已知残余：`assembleSite` 直调不过闸；QA standalone 不看机制 / 完成性；3 条历史缺陷 + 1 probe 会被机制 A 硬拒。

### 必须交付

1. 完整实现代码、全部自动化测试。
2. 历史语料回归报告与 39 例矩阵验收报告。
3. Runtime 语义证据档案（LP-00）。
4. 判据结果及误报分析。
5. Pipeline 集成证据。
6. 版本与 commit 记录。
7. 已知限制与回退说明（含未证明项与 `INSUFFICIENT_EVIDENCE` 清单）。

### 必须裁定

1. AC-01～AC-12 逐项是否满足。
2. 是否存在越界修改（Runtime / Contract / CLI / MCP / 历史产物）。
3. 是否将 Draft PR 转为正式 PR。**不自动合并、不推送 `main`**。
4. 是否关闭本图；未决问题如何交接。

### 输出

- `../evidence/07-final-report.md`（或更新同名报告）：完整验收结论与证据索引。
- 本票 `## Answer`：逐项裁定、PR 链接、已知限制、回退点。
- 更新 `../map.md` 的 Status 与 Decisions so far，关闭地图。

### 通过标准

- 最终 PR、完整证据与回退说明齐全。
- 最终报告保留 `NO_PROVEN_BLOCKER` ≠ 「可玩」的语义区别。

## Answer

**2026-11-06 · 用户裁定 · 收口通过。** 最终报告：[07-final-report.md](../evidence/07-final-report.md)；PR [#28](https://github.com/sihuayin/game-maker/pull/28)。

### Q1：AC-01 ～ AC-12

| AC | 裁定 | 说明 |
|---|---|---|
| AC-01 Runtime 语义 | PASS | 以 LP-00 最终复核为准，含 P4 降级 |
| AC-02 几何模型 | PASS | 实际 Runtime 几何语义 |
| AC-03 空间可达性 | PASS | 含 mid-air touch-only 保守降级 |
| AC-04 机制可通行性 | PASS | 含跨层归因规则 |
| AC-05 关卡完成性 | PASS | 收集状态 + 通关条件 |
| AC-06 三态模型 | PASS | `NO_PROVEN_BLOCKER` ≠ 已证明可玩 |
| AC-07 Pipeline | PASS | deterministic + Publish Gate |
| AC-08 历史回归 | PASS | 39 例最终分布 19 / 16 / 4 |
| AC-09 误报控制 | PASS | 修正后矩阵与逐条归因 |
| AC-10 工程质量 | **PASS_WITH_KNOWN_LIMITATION** | 2550 例通过；Vitest runner RPC workaround 仍在 |
| AC-11 范围约束 | PASS | 范围审计无越界 |
| AC-12 交付审查 | PASS | 正式 PR + 最终报告完成后成立 |

### Q2：范围审计

**无越界。** Runtime / CLI / MCP / 历史版本产物未改；C1 加法导出、CONTEXT 词汇表、测试夹具
`fixtures/upstream/canned.json` 均在已批准范围内。详见最终报告 §5.2。

### Q3：分支 / PR

采用 **`wayfinder/level-playability-v1`** 现有分支与 PR #28；不迁移、不新建 PR。
PRD §6.1 的分支名偏差（`p1/level-playability-v1`）经用户批准，记录在最终报告 §5.3；
不构成功能范围或架构边界变更。

### Q4：Vitest workaround

保留为残余交接：Vitest 3.2.7；2551 例通过；长集成文件偶发
`[vitest-worker]: Timeout calling onTaskUpdate`；当前 workaround 为 20s testTimeout +
`dangerouslyIgnoreUnhandledErrors`。**这不是业务测试失败，也不表示 runner 问题已解决。**
后续任务：LP-07 后移除 workaround，评估升级 Vitest 或拆分长集成测试文件。

### Q5：收口执行

- 推送 LP-04 ～ LP-07 全部本地 commit。
- PR #28 标题/正文更新为 **LP-00 ～ LP-07**，Draft 转正式 PR。
- 最终报告 `evidence/07-final-report.md`。
- 地图 Status 关闭；残余交接见最终报告 §6。
- **不合并 PR、不推送 `main`、不自动关闭 PR。**

### 已知限制与回退

- `NO_PROVEN_BLOCKER` ≠「可玩」；`INSUFFICIENT_EVIDENCE` ≠「不可玩」。
- 7 个带合法宽巡逻 hazard 的空间边界在整关组合里是 INSUFF（覆盖缺口），不是误报。
- `assembleSite` 直调不过闸；QA standalone 只看空间层；3 条历史缺陷 + 1 probe 会被机制 A 硬拒。
- 回退点见最终报告 §7；判据级回退不得用「全部关闭」伪造验收。
