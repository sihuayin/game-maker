# 04. P0-05b · 像素阈值判据落地

Type: task
Status: resolved
Owner: main session · 2026-10-21
Blocked by: 03
Map: ../map.md

## Question

按用户在票 03 上的逐字裁定，把阈值化后的像素完整性指标接进 QA，使其能产 `error` 并阻断发布。
对应 `CAP-QA-02`。

- 阈值集中在一处并文档化；报告里写明来源（票 03 的测量包、样本数、选择理由）。
- 判据产 `error` 时阻断发布；未阈值化的指标继续留在 `observations`，不影响裁决。
- 与票 09 的发布闸门对接：本票只负责「QA 能产 error」，不重复实现闸门。

## 验收

- 已知坏统计 fixture（长宽比严重漂移 / 大量色板外像素）⇒ QA `error`，发布被拒。
- 已接受包（v7 或团队认可 baseline）⇒ 在阈值内通过；阈值数字有记录。
- 阈值边界：刚好在阈值内 / 外各一条测试。
- 观察字段仍出现在 `observations`，且不影响未阈值化指标。
- 证据：阈值来源文档 + 正例 / 负例 / 边界测试；`pnpm test` / `pnpm typecheck` 全绿。

## 边界

- 不做参考图 vs 交付图的风格相似度（P1）；不调用付费视觉模型 / `review`。
- 不改变 `inspectPack` 的只读、免费性质与输出契约；若需新增字段，按 Q5 交逐项清单获批后才动。
- 不自动修复 / 不重生成；不改 v7 包与 `fixtures/`；零付费；不提交。
- 阈值不得静默调整：任何偏离票 03 裁定的数字都要单独说明并获得批准。

## 产出

`## Answer`：阈值表（指标 / 数值 / 来源）、改动 `path:line`、测试用例与结果、
任何契约变更清单及批准状态。

## Answer（施工与验证完成 · 待关票授权）

按票 03 的逐字裁定（A+）落地。**未新增第七判据**：长宽比挂 `constructive-constraint`，色板外挂
`palette-binding`；`checked` 仍 5/6、`qaVerdict` 仍 `incomplete`（第六条归票 08），发布闸门未改。

### 阈值表（唯一落点 `packages/qa/src/pixel.ts:26`）

| 指标 | 数值 | 落点 | 来源 / 理由 |
|---|---|---|---|
| 长宽比 | `\|ΔAR\| ≥ 25%` ⇒ error；`24.9%` 不触发、`25.0%` 触发；全部 `sourceSizes`（背景不豁免） | `constructive-constraint` | 票 03；7 包 / 47 样本；已验收最大 2.70%，正常帧间 ≤ 9.1% |
| 色板外 error | `share ≥ 25%` 且 `不透明像素 ≥ 16` ⇒ error | `palette-binding` | 票 03 A+；7 包 / 89 资产 |
| 色板外 observation | `10% ≤ share < 25%` 且 `不透明像素 ≥ 16` ⇒ observation（不阻断） | `inspect` 观察行 | `health-icon` 41/256（16.02%）、`tile-wall` 29/225（12.89%） |
| 色板外不判 | `< 10%` 或 `< 16` 个不透明像素 | — | 票 03 边界 |
| 背景层覆盖率 | 不新增 P0 数值阈值 | 保持 observation | 装配期 `auditLayerCoverage` + 票 08 的第 6 条判据 |
| unavailable | 无 `sourceSizes` ⇒ 「没跑（unavailable）」，不得记绿 | `inspect` 观察行 | 票 03 裁定 5 |

### 改动

- `packages/qa/src/pixel.ts`（新）：阈值表 + `pixelIntegrity()`（度量 → findings / observation lines）+
  `withPixelFindings()`（用 `buildQAReport` 重建；同一 `(judgement,target)` 按契约并进 detail）。
- `packages/qa/src/index.ts:25`：导出。
- `packages/pipeline/src/create-game.ts:31,554-575`：`inspectData` → `pixelIntegrity`；观察行追加到
  `inspect` 观察；`withPixelFindings` 在 `QAReportSchema` 校验之前把 error 挂回报告。
- 测试：`packages/qa/tests/pixel.test.ts`（13 条）+ `packages/pipeline/tests/create-game.test.ts:876`（4 条）。

**测试夹具修正（只改测试）**：三个假上游固定回 512×270 / 480×256，新阈值正确判为 -29.7% / -62.5% 坏例。
改为按提示词里的目标尺寸/比例出图：`pipeline/tests/upstream.ts:49` · `cli/tests/cli-create.test.ts:33` ·
`mcp/tests/create-game-no-digest.test.ts:46`。**不改生产逻辑、不改真 fixtures。**

### 红 → 绿

- 红（临时还原生产改动）：17 failed / 44 passed，exit 1 → `runs/2026-10-21-ticket-04/red-demo-tests.log`
- 绿：61 passed，exit 0 → `green-demo-tests.log`
- 全量：`pnpm test` **1772 passed / 114 files**（exit 0）· `typecheck` / `build` / `check:deps` 全 0。
- 生产文件红运行后逐字节恢复（`cmp` 三条 same）。

### 契约与批准状态

无 contracts / CLI / MCP / 依赖 / `inspectPack` 输出变更；新增的是 `@game-maker/qa` 的工作区导出，
`pipeline → qa` 本就在 `check-deps.mjs` 白名单里，按 Q5 无需另行报批。发布闸门未改（票 09 的活）。

### 诚实边界

- A+ 的 observation 档落在**既有 `inspect` 观察行**：契约要求每个观察来源恰好一条，加第二个结构化来源
  会是契约变更；追加在既有观察里既可见又不影响裁决。
- `unavailable` 行只在 inspect 成功但无 `sourceSizes` 时出现；inspect 抛错时整条观察为 `unavailable` + reason。
- 未对真实包重跑 `create`（零付费）；阈值分布依据票 03 的 7 包只读测量。

### 证据

`runs/2026-10-21-ticket-04/`（`summary.md` · red/green/full-test/typecheck/build/check-deps 日志与退出码）
