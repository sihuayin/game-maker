# 09. P0-02b · 发布闸门统一

Type: task
Status: open
Owner: —
Blocked by: 01, 04, 05, 08
Map: ../map.md

## Question

让**所有发布路径**都验证**当前包**的 QA；`error` 与 `incomplete` 均拒绝发布，`warning` 不阻断。
对应 `CAP-QA-08`，范围见 `docs/v4/P0-00-p0-scope.md` §3 P0-02。

- 发布路径 = `create --yes` / `build` / `site` / MCP `create_game` / MCP `assemble_site`。
- 当前包判定：采用票 05 推荐的方案；若需要新增 CLI flag / MCP 参数 / 契约字段，
  **先按 Q5 交逐项变更清单、获批后才动**，不得静默加参数。
- `site` / `assemble_site` 如何拿到 QA：优先复用 `run/v<N>/qa-report.json` 或就地跑 QA（依票 05）。
- MCP `create_game` 补 QA 失败路径测试：`isError`、`_exitCode=4`、站点不产、报告在盘。
- 补齐「缺 QA / error / incomplete / 全绿」四类路径的测试，CLI 与 MCP 各至少一条。

## 输入事实（来自票 05，仍须报批）

- 事实底座：`.scratch/p0-construction-v1/research/site-qa-seam.md`；推荐 **A + C**。
- 最小变更清单（研究文件 §8.2，11 项）：`qa-report` 可选 `subject {packId, packVersion, manifestChecksum?}`；
  pipeline 注入 subject；`assertQaPassed` 扩成含 `incomplete` 的闸；新 `publish-gate.ts` 共享
  `findQaReport` / `assertPublishableQa`；CLI `--qa-report`；MCP `qaReportPath`；四个发布入口接线；
  入口级测试；文档同步。
- 必须写进本票的边界（研究文件 §8.4）：只钉 pack、不钉 config；同 id/version 内容被改靠
  `manifestChecksum` + P0-04 的 `verifyPack`；旧报告无 subject 一律拒绝；TD 显式跳过并记 P2；
  公开导出的 `assembleSite` / `assembleFromConfig` 库调用方不在本票闸门内；自动查找只对规范 out 树有效。

## 验收

- 任何发布路径都不能在缺 QA / error / incomplete 时产出 `site/v<N>`。
- QA 报告属于旧 pack version ⇒ 拒。
- 干净包全绿 ⇒ 产站点；`warning` 仍不阻断。
- 负例：故意删掉 `layer-coverage` 的 runner，测试必须红。
- `pnpm test` / `pnpm typecheck` 全绿。

## 边界

- 不新增 QA judgement 语义；不改变 `qa-report/v1` 既有字段语义；不改变失败账本 / 版本目录 /
  原子发布规则；`warning` 的「不阻断」语义不变。
- 旧手工「先 build 失败、再手工 site」被拒绝是**有意的**；错误信息必须说清缺什么报告。
- 不得为过测试而放行或隐藏 findings；不得永远返回 0。
- **契约 / CLI / MCP 变更**：逐项清单 + 逐字批准，未获批则本票停住。
- 零付费；不改 v7 包与 `fixtures/`；不提交。

## 产出

`## Answer`：当前包判定方案、批准记录（若有契约变更）、各发布路径的测试矩阵与结果、
改动 `path:line`。
