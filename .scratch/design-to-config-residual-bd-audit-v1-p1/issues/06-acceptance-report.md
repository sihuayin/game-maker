# 验收、全局语料重判与 report.md

Type: task
Status: resolved
Owner: amber
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

## Answer

**已验收并产出报告。** commit `0bffe7d`（`P1-acceptance: combined verification and report`），
基线 `8e4d624`。实施报告：[report.md](../report.md)。

### 命令与结果

| 命令 | 退出码 / 结果 |
|---|---|
| `pnpm build` | 0 |
| `pnpm typecheck` | 0 |
| 批次 1（`compile-runtime` / `compile-td-game`） | 0 · 68 tests |
| 批次 2（`reachability` / `config-audit` / `compile-runtime` / `create-game` / `gameplay`） | 0 · 146 tests |
| 批次 3（`publish-gate` / `cli-site-gate` / `assemble-site-qa-gate`） | 0 · 34 tests |
| 批次 4（`create-game` / `world` / `site` / `td-site` / `plan-background-gate` / `layers`） | 0 · 159 tests |
| 批次 5（`config-audit` / `compile-runtime` / `create-game`） | 0 · 114 tests |
| `pnpm test` | 0 · **162 文件 / 2425 tests passed** |

### 全局语料重判（`/tmp/p1-acceptance-scan.mjs`，只读）

5243 份 JSON；config 151、manifest 171、design 49；按「最近前缀 + 同层最高 pack 版本」配对 **151/151**。

| 指标 | 结果 |
|---|---|
| B-02 reachability 新增 error | **0** |
| D-01 `world.size.h = 270` | **151/151** |
| D-02 manifest `role` | **1599/1599 非空、0 换行**（186 个取值、最长 32、共 24,951 字符） |
| D-03 resampleable | **146**（71 `entity-state-frames` + 75 无码）；新分类器**包根因 0** |
| publish-gate 三元组 | **23** 组、reachability **0** |
| QA 报告 | **31** 份；**28** 有 subject；**0** 有 `configChecksum` |

- D-03 的 146 条高于 plan 的 86 条预测：本口径纳入的合成负例 / 原始实验 config 引用了包里不存在的 id
  （全部为 config 可修）；**包根因仍为 0**。research 的 134/17 口径更严，两套口径下关键结论一致。
- 五项组合结果（B-02×D-03、B-02×publish-gate、D-01×D-02×site/QA、D-02×B-01、publish-gate×D-01）
  逐项记录在 `report.md` §5；没有新增拒绝需要解释。

### 边界

- `git status` 只有本票与 `report.md`（授权范围）；未改 `out/**`、`fixtures/**`、既有 `.scratch` 产物。
- 零付费：未调用模型、未生图、未重建站点。
- 失败与回退记录见 `report.md` §8（B-02 的 F3 裁定点、票 48 用例调整、D-01 测试构造、D-03 schema/配对修正）；
  无未处置失败。
