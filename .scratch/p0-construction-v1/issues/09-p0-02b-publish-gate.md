# 09. P0-02b · 发布闸门统一

Type: task
Status: resolved
Owner: main session · 2026-10-22
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

## Answer

**已收口（施工）** —— 采纳票 05 推荐 **A + C**，所有发布入口在装配站点之前过同一把闸。

### 当前包判定方案

1. **报告自带身份**：`qa-report/v1` 增可选 `subject { packId, packVersion, manifestChecksum? }`
   （`contracts/src/qa.ts:279`）。`create --yes` / `build` 的 pipeline 在落盘前注入它
   （`pipeline/src/create-game.ts:606`），`manifestChecksum = sha256(manifest.json 原始字节)`；
   **runner 自带的值被覆盖** —— 身份只有一个来源。
2. **共享闸**：`pipeline/src/publish-gate.ts:145` `assertPublishableQa({ packDir, configPath?, qaReportPath?, outRoot? })`。
   放行条件：报告存在；`subject.packId/packVersion` 与 manifest 逐字相等；存在
   `manifestChecksum` 时必须与当前 manifest 字节一致；无 `severity:"error"`；
   `checked.length === 6`。否则 `CommandError("invalid")`（退 4）。
3. **定位报告**：显式 `--qa-report` / `qaReportPath` 优先（外部包 / 非规范 out 树）；
   否则只扫规范 out 树 `<outRoot>/<packId>/run/v<N>/qa-report.json`，按 subject 精确匹配。
   不用 packDir 反推 runDir（runVersion ≠ packVersion，票 05 §3.2）。错误文案带包身份、
   查过的路径、每份候选为什么不能用、以及修复方式。
4. **TD 显式跳过**：`configPath` 的 `format === "td-config/v1"` 时闸返回 `undefined`（P2 例外，
   有源码注释与测试钉住，不是漏判）。
5. **incomplete 也阻断**：`create-game.ts:227` 的 `assertQaPassed` 扩为 error 与
   `checked < QA_JUDGEMENTS.length` 都拒；报告仍**先落盘再抛**。`warning` 不阻断。
6. **五个发布入口接线**：CLI `site`（`cli.ts:626`，`assembleFromConfig` 之前）、CLI
   `build` / `create --yes`（`cli.ts:227`，`buildAndSite` 内）、MCP `assemble_site`
   （`server.ts:405`）、MCP `create_game`（`server.ts:366`）。全部在 `assembleSite` /
   `assembleFromConfig` 之前 ⇒ 任何拒绝都不会创建 `site/v<N>`。

### Q5 批准记录

用户逐字批准：「**全部批准（推荐）**」；附带裁定：「**不跑（推荐）**」（standalone `site` 不跑
`verifyPack`）、「**改 TD 示例 + 说明（推荐）**」（README fixture 快速开始）。
契约 / CLI / MCP 变更逐项即本票请求批准的那 11 项，无一项超出清单。

### 测试矩阵（全部通过）

| 发布路径 | 缺 QA | 旧 pack | error | incomplete | 全绿 | warning |
|---|---|---|---|---|---|---|
| CLI `site` | 退 4 / 无站点 | 退 4 | 退 4 | 退 4 | 产 `site/v1` | 不阻断 |
| MCP `assemble_site` | 退 4 / 无站点 | 退 4 | 退 4 | 退 4 | 产 `site/v1` | 同一闸 |
| CLI `create --yes` / `build` | 闸 | subject 复核 | `runBuild` 退 4 | `runBuild` 退 4 | 既有全链 | 既有 |
| MCP `create_game` | 闸 | subject 复核 | 真链 `reachability` error：`isError` / `_exitCode=4` / 无站点 / 报告在盘 | `runBuild` 退 4 | 既有全链 | 既有 |
| TD | 显式跳过（P2） | — | — | — | 无报告也装配 | — |

新增测试文件 4 个（`pipeline/tests/publish-gate.test.ts` 12 条、
`cli/tests/cli-site-gate.test.ts` 8 条、`mcp/tests/assemble-site-qa-gate.test.ts` 6 条、
`mcp/tests/create-game-qa-failure.test.ts` 1 条）；`contracts/tests/qa.test.ts` +3、
`pipeline/tests/create-game.test.ts` +1（并修正既有「注入报告」用例为 6/6 + subject）。

**负例见证（临时变异、已还原）**：去掉 incomplete 阻断 ⇒ create-game 的 incomplete 用例红；
去掉 `site` 的闸调用 ⇒ CLI 拒绝组 4 条全红。

### 验证

`pnpm test` **1810 passed / 119 files**（本票前 1779 / 115）· `pnpm typecheck`（exit 0）·
`pnpm build`（exit 0）· `pnpm check:deps`（exit 0）。零付费、未启动浏览器、未提交 / 未推送。
证据：`runs/2026-10-22-ticket-09/summary.md`。

### 诚实边界 / 残余风险

- **只钉 pack，不钉 config**：`reachability` / `reference-resolution` 吃配置；一份绿色 pack 报告
  仍可给另一份手写 config 放行（P0-02 票面只要求 pack 身份）。
- **同 id/version 内容被改**：`manifestChecksum` 能发现 manifest 声明改动；逐文件字节完整性归
  P0-04 的 `verifyPack`（create/build 链已跑）。**standalone `site` 不重算 checksum**（本票裁定）。
- **旧报告无 subject 一律拒绝**（「无法证明」；重跑 `build` 生成带身份的报告）。
- **TD 显式跳过**（P2）。
- **库调用方**：`assembleSite` / `assembleFromConfig` 公开导出，绕过两个壳的调用方不受闸约束。
- **自动查找只对规范 out 树有效**；外部包必须显式给报告路径。
- **README fixture 快速开始已改**：side-scroller fixture 无 QA 报告且 `fixtures/` 只读 ⇒ 不再能直接
  `site`；离线可玩入口改为 TD。旧手工 `plan/pack/compile-runtime/site` 路线要发布必须另有一份报告
  （有意收紧）。
- `pnpm test:playable` 未跑（浏览器依赖，归票 10 / 票 11）。
