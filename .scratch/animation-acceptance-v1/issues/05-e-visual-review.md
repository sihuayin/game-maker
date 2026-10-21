# 05. E · 视觉审查能力

Type: research
Status: resolved
Owner: research 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

检查仓库是否已有以下视觉审查能力：动画帧预览、动画循环播放、基线与候选结果并列展示、帧序列查看、
游戏内效果截图、人工审查记录、视觉模型辅助分析、可复用的图像比较工具。

回答任务书 §4.5 的 7 个问题：

1. 当前能否独立查看全部动画帧？
2. 能否按指定顺序播放动画？
3. 能否在统一展示条件下比较两个版本？
4. 能否查看角色在游戏中的实际效果？
5. 是否保存人工审查结论？
6. 审查结果能否追溯到具体资源版本？
7. 是否已有视觉模型分析能力，且其结果是否被错误地当作确定性判定？

不要因为当前没有独立的「视觉审查模块」，就断定没有可复用的预览页面或工具。

必查：`.scratch/asset-integration-v1/runs/2026-10-21*/` 的 contact sheet / loop preview、
`runs/2026-10-20e-site/` 的 `cdp-*.png` 与 `drive-cdp.mjs`、
`.scratch/p0-00-audit/runs/2026-10-20a-head-replay/visual-compare/`、
`packages/assets/src/review.ts`、`packages/vision/src/*`、`packages/qa/src/visual.ts`、
任何 HTML 预览页 / 生成脚本。

## 验收

- 能力清单，按四类归位：可直接复用 / 可通过少量改造复用 / 需要新增 / 目前无法确认。
- 每个能力给路径 / 入口 / 证据；明确它是「能看」还是「能判」，以及是否阻断。
- 明确视觉模型分析的调用条件（是否付费）、结果如何被消费、是否被当作确定性判定。
- 明确人工审查记录的存放位置与可追溯性；没有记录的地方标 `missing`，不要推断。
- 给出 Phase 1 视觉审查最小方案的建议（复用现有联系表 / CDP 截图 / 人眼裁定）。

## 边界

- 只读；不改预览工具 / 不生成新资源；零付费；不调用任何视觉模型。
- 允许对现有产物做只读检查；禁止 `pnpm check` / `pnpm build` / 写 `out/`。
- 不写 `map.md`；只写本票与 `research/e-visual-review.md`；不提交。

## 产出

`research/e-visual-review.md`：能力分类表 + 证据 + 视觉模型边界 + Phase 1 建议。
完成后在本票追加 `## Answer`（10–20 行摘要），`Status: resolved`。

## Answer

- **结论：视觉审查不是空白，而是“能看”的半成品** —— 联系表库、真实站点截图、基线/候选循环预览与机械指标都已在付费 run 里跑通；缺的是免费统一入口、共享比较模块、结构化人裁记录与版本绑定。
- **1/2 逐帧与顺序**：`packContactSheet`（`packages/assets/src/review.ts:24`，E2）能拼全帧但无标签/无 CLI；预览页 `style-migration-v1/preview/index.html:84-99` 按动画 + manifest fps 循环，硬编码旧包且未入库 → **partial**。
- **3 并列比较**：`qualify.mjs:123-145,237` / `finalist.mjs:241` 用同一 trim 框、同尺寸、8× nearest 生成 baseline|candidate 联系表 + 绿/黄/红阈值 → 真实可用，但 4 份拷贝、无测试、PNG 无标签 → **partial**。
- **4 游戏内**：`game-maker site`（`cli.ts:575`）+ `site/v3` + `cdp-*.png` 成立；但 shell fps 写死（`scene.ts:140,193`），不能选 clip / 步进 / 冻结帧 → **implemented（HEAD 运行时 unverified）**。
- **5 人工记录**：04 / 08 / 15 / 16 的 `## Answer` 有逐字裁定；票 15/16 要求的逐项清单缺失；`humanVerdict` 仍是 `pending`（`2026-10-21f-finalist/result.json:1007`）→ **partial**。
- **6 追溯**：manifest 有 `id/version/files[].checksum`，但 `result.json` / `contact.png` / `loop-preview.html` 不内嵌版本；脚本硬编码 v7 路径（`finalist.mjs:27-28`）→ **partial**。
- **7 视觉模型**：`reviewPack` 付费、人工、只描述差异、不判分、不阻断、不进链（`review.ts:9-13,152-158`；`qa/assemble.ts:96-103`），`qaVerdict` 字面不看 observations（`contracts/qa.ts:356-378`）；`analyzeReference` 是设计输入而非验收判定 → **未发现被当确定性判定**。
- **Phase 1 最小方案**：冻结 v7（manifest checksum）+ 免费联系表/预览入口 + 抽出 `assets/src/compare.ts`（票 12 阈值 + 单测）+ `site`/CDP 固定取证 + 7 项人裁模板并回写 `humanVerdict`；视觉模型保持可选付费旁路。
- **已验证**：`pnpm exec vitest run packages/assets/tests/review.test.ts packages/qa/tests/visual.test.ts` → 25/25 通过（E2）。
- **未验证**：`game-maker review` 真实 live（无 `"step":"review"` 的 ledger）、`site/v3` 在 HEAD 重跑、旧 contact-sheet / visual-compare 的生成脚本。
- 完整报告：`../research/e-visual-review.md`。
- 边界遵守：只读、零付费、未调用视觉模型、未写 `out/`、未改预览工具、未提交。
