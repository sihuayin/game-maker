# 09. 综合：缺口判定、Phase 1 文件级实施计划与四份交付物

Type: grilling
Status: resolved
Owner: claude（2026-10-21 认领 · grilling · 待人裁）
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08
Map: ../map.md

## Question

汇总 01–08 的证据，产出 `docs/v5/` 四份交付物：

1. `phase-0-current-state.md`
2. `phase-0-gap-analysis.md`
3. `phase-0-implementation-plan.md`
4. `phase-0-test-inventory.md`

要求：

- 每条结论有证据：`path:line` / 测试文件与用例 / 命令 + 退出码 / 真实产物路径。
- 每项能力标 `implemented` / `partial` / `missing` / `unverified`；**`unverified` 不得自动转 `missing`**。
- 缺口按任务书 §5 分类：缺失能力 / 已有但缺少覆盖 / 已有但缺少追溯 / 已有但尚未验证 / 设计不一致；
  每条缺口有证据、影响、建议归属、验收条件。
- Phase 1 最小范围：复用模块、需要修改的文件、可能新增的文件、依赖关系、测试方案、实施顺序、
  风险与待裁定问题。每项列：目标文件 · 当前职责 · 拟改动 · 为什么 · 对应测试 · 潜在依赖影响。
  无法确定目标文件时，说明还需确认什么，不得猜路径。
- **基准冻结**（Q5 裁定）：v7 `scavenger-actor` idle 4 帧 + 票 12 标准；
  给出基准冻结、版本固定、证据保存方案；`fixtures/packs/last-train/v2` 仅作辅助候选。
- 产出任务书 §7 最终摘要：核心结论 5 问 + 需求映射矩阵 + 文件级实施计划。
- 报告用相对链接引用 `.scratch/animation-acceptance-v1/research/` 的证据；报告只索引，不复述细节。
- 未解决问题和证据不足之处明确记录。

## 验收

- 任务书 §8 完成标准全部满足。
- 四份文档交叉引用可解析；每条结论可回溯到证据文件或 `path:line`。
- Phase 1 计划可直接交给编码代理执行；明确「不应修改的范围」。
- 不宣称任何未实际运行的验证已通过；不把静态实现写成运行已验证。

## 边界

- HITL：缺口取舍、Phase 1 范围、风险接受由用户裁定；代理只准备证据与建议。
- 不改业务代码 / 测试 / 契约 / 资源 / 配置；不执行写 `out/` 的命令；零付费；不提交。
- 只写 `docs/v5/phase-0-*.md` 与本票；不写 `map.md`（由主会话追加 Decisions）。

## 产出

`docs/v5/` 四份文档 + 本票 `## Answer`（逐字记录用户裁定与 Phase 1 范围）。

## Answer（2026-10-21 · 人裁）

**裁定原文：「Q1–Q8 全部选择 A，接受全部推荐。」**

| 问题 | 裁定 | 约束 |
|---|---|---|
| Q1 运行时保真 | A | 不修运行时；`accept` 只做只读运行取证，报告「声明 vs 实际」；修复另立票 |
| Q2 命令与门禁 | A | 新 `game-maker accept` + MCP `accept_asset_pack`；opt-in；**不接入 `runBuild` 阻断** |
| Q3 结构验收落点 | A | `packages/assets` 新模块；不新建 package、不破 `check-deps` |
| Q4 报告与追溯 | A | 新 `animation-acceptance/v1`；可选 `run-build-record/v1`；不扩 `qa-report/v1` 语义 |
| Q5 基准冻结 | A | `fixtures/animation-baselines/scavenger-idle/` + `baseline.json` + 回归测试；**不重生成** |
| Q6 视觉审查 | A | 免费带标签联系表 + 循环预览 + 7 项人裁模板，写回 `humanVerdict`；不引入付费视觉模型 |
| Q7 测试与前置 | A | 先修两处 typecheck；负例 + 回归 + 阈值 + schema；CDP 探针 opt-in，不引入 Playwright |
| Q8 分层顺序 | A | Tier 1 先交付，Tier 2 随后，Tier 3 延后 |

### 交付物

1. [phase-0-current-state.md](../../../docs/v5/phase-0-current-state.md) — 现状、架构、数据结构、检查能力、
   基准、视觉审查、运行时、报告追溯、测试体系、已验证/未验证。
2. [phase-0-gap-analysis.md](../../../docs/v5/phase-0-gap-analysis.md) — 需求映射、G-01–G-50、
   五类缺口、优先级与 Phase 1 分流。
3. [phase-0-implementation-plan.md](../../../docs/v5/phase-0-implementation-plan.md) — Tier 1/Tier 2/Tier 3、
   文件级改动、契约草案、基准冻结方案、CLI/MCP 接口、依赖顺序、测试方案、风险。
4. [phase-0-test-inventory.md](../../../docs/v5/phase-0-test-inventory.md) — 测试框架、实测结果、
   安全执行清单、动画/资源测试矩阵、覆盖缺口、补测建议。

### Phase 1 范围（摘要）

- **Tier 1**：修 typecheck；`AtlasJson` + `animation-acceptance/v1` 契约；纯动画指标；
  v7 baseline fixture + 回归；交付态结构验收器；CLI/MCP `accept`；v7 第一份报告。
- **Tier 2**：共享 compare；带标签联系表/循环预览/人裁模板；CDP 只读探针；
  `run-build-record/v1`。
- **Tier 3**：运行时 fps/loop 修复、固定动画场景、录屏、付费视觉模型、Playwright/CI、
  把验收接入 `runBuild` 门禁。

### 边界（本图）

- 本轮**只交调查报告与文件级计划**；未改业务代码 / 测试 / 契约 / 资源 / 配置 / 锁文件。
- 未写 `out/`；未跑 `pnpm check` / `pnpm build`；未发起任何生图 / 文本 / 视觉模型调用；零付费。
- `game-maker.local.json` 一个字未动；未提交。
- 证据：`research/a..h` 八份（2847 行）、`runs/2026-10-21-runtime/`（2.0MB）、v7 包 `verify` exit 0。

### 证据要点

- v7 `scavenger-actor` idle 4 帧机械读数全绿（alpha 0.4% / 宽差 0.2% / L1 3 / off-palette 0）。
- `verifyPack` 只验 schema + 大小 + sha256；`/tmp` 探针证明非 PNG、越界、`frames` 说谎、`v99` 均通过。
- 运行时播放真实通过；`fps/loop` 写死（lunge 8fps 无限循环 vs 14fps/loop:false）。
- `pnpm test` exit 0（105/1647）；`pnpm typecheck` exit 2（两处测试类型错误）。
- `run-ledger` 无 pack/site 版本；`qa-report/v1` 无身份且重跑覆盖。
