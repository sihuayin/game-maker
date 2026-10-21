# 04. D · 动画基准与历史验收材料

Type: research
Status: resolved
Owner: research 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

检查动画验收基准与历史验收材料：当前验收标准文档、与 `scavenger-actor idle` 有关的资源和测试、
已有动画帧样本、实验记录、与模型 / Prompt / 动画质量 / 资源集成有关的提交、当前已确认的验收口径。

回答任务书 §4.4 的 8 个问题：

1. 样本实际存放在哪里？
2. 原始参考图是否可追溯？
3. 生成后的帧和资源包是否存在？
4. 是否有对应的模型、Prompt 和处理版本记录？
5. 当前验收标准是否有明确版本？
6. 同一输入能否用于后续模型或 Prompt 的对比？
7. 当前记录能否关联到真实的资源产物？
8. 是否存在只有文档结论、但缺少原始证据的历史记录？

已知入口（只作线索）：`.scratch/asset-integration-v1/issues/09|12|14|15|16*.md`、
`runs/2026-10-21{a..f}/`、v7 包、`runs/2026-10-20e-site/` 的 CDP 截图与 `site-report.md`、
`fixtures/packs/last-train/v2`。

## 验收

- 基准资产清单：项目 · 路径 / 引用 · 是否存在 · 是否可复现 · 证据完整性 · 建议
  （原始参考图 / 动画帧 / 动画元数据 / 资源包 / 验收规则 / 实验记录）。
- 每个路径实际存在性已核实；不得为填表臆造路径或数据。
- 明确哪些记录只有文档结论、哪些缺原始证据、哪些不可复现。
- 明确票 12 的标准版本与可执行阈值是否完整（机械闸 + 人眼闸 + 样本量 + 成本口径）。
- 给出 v7 `scavenger-actor` idle 4 帧作为主基准的冻结 / 版本固定 / 证据保存可行性结论
  （Phase 1 计划输入）；`last-train/v2` 仅作辅助候选评估。

## 边界

- 只读；不改资源、不重生成、不改验收规则、不跑付费。
- 允许只读 `verify` / `inspect` 与定向测试；禁止 `pnpm check` / `pnpm build` / 写 `out/`；零付费。
- 不写 `map.md`；只写本票与 `research/d-baseline-history.md`；不提交。

## 产出

`research/d-baseline-history.md`：基准资产清单 + 可追溯性结论 + 冻结建议 + 证据弱点。
完成后在本票追加 `## Answer`（10–20 行摘要），`Status: resolved`。

## Answer（2026-10-21 · research）

**结论：v7 `scavenger-actor` idle 4 帧可以作为主基准并冻结；`fixtures/packs/last-train/v2` 只能做辅助结构夹具。**

- **基准成立**：v7 包 158 文件 / 19 资源 / 76 帧 / 61 动画；`verify` exit 0、157 checksum 全对；4 张 raw 和 4 张交付帧都在库。4 帧最差 alpha 0.4%、宽差 0.2%、key L1 3、off-palette 0、边界 87.4%，按票 12 全部绿档。
- **追溯链成立**：19i 失败现场 → 19j v1 → 19k patch → 20a v2–v4 → 20d v6 → 20f v7，4 帧 raw 逐字节相同；19i 日志记录 `gemini-2.5-flash-image`（70 发 / 68×200 / 66×PNG）。
- **同一输入不严格成立**：v7 包内 `*.prompt.txt` 是 34 色重建版；真正生成用的 32 色 Prompt 只在未入库的 `.scratch/style-migration-v1/runs/2026-10-19i-real-frames/ruin-scavenger-extraction-assets/failed-2026-10-19T11-50-47-861Z/`，两者只差 `#59503b #50432b` 两个色号。21a–21f 的候选对比用的是 34 色版。
- **版本记录**：manifest 无 model / git SHA；`ledger.json` 为 0 调用；19i `http-calls.log`、19k patch、21c–21f `http-calls.log` 均未入库。
- **验收标准**：票 12 `## Answer` 是唯一文本来源，**无版本号 / 无独立文件 / 无共享实现或测试**；`qualify.mjs` 与 `finalist.mjs` 各自复制 tier 阈值；`result.json` 的 `humanVerdict` 仍为 `"pending"`，人眼逐项清单只在票面。
- **冻结建议**：不重生成；建小 fixture（4 raw + 4 交付帧 + 32 色真实 Prompt + 34 色重建 Prompt + `baseline.json`：raw/交付 hash、atlas/manifest checksum、reference/master hash、模型、阈值、期望指标），并加一条基线 regression test（当前 v7 零测试引用）。
- **证据弱点**：v7 站点 `site/v3` 未入库且无 CDP 日志（v6 的 CDP 7130 像素差已复算）；19h 母版真实 Prompt 不可考；`last-train/v2` 无 raw / 参考图 / Prompt，idle 仅 2 帧。

证据：`.scratch/animation-acceptance-v1/research/d-baseline-history.md`；v7 包 `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`；`runs/2026-10-21d-qualification/result.json` / `2026-10-21f-finalist/result.json`；`runs/2026-10-20e-site/` 的 CDP 截图。
