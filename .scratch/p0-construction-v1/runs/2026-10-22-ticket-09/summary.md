# 票 09 · P0-02b · 发布闸门统一 —— 验证记录（2026-10-22）

## 变更范围（Q5 逐项清单已获逐字批准：「全部批准（推荐）」）

1. `packages/contracts/src/qa.ts:279`：`QAReportSchema` 增**可选** `subject { packId, packVersion, manifestChecksum? }`；
   `qa-report/v1` 与既有字段语义不变，旧四字段报告仍可解析。
2. `packages/pipeline/src/create-game.ts:606`：pipeline 在 schema 校验前注入 subject，覆盖 runner 自带值；
   `manifestChecksum = sha256(manifest.json 原始字节)`。
3. `packages/pipeline/src/create-game.ts:227`：`assertQaPassed` 扩为 error **与** incomplete 都拒；
   报告仍先落盘再抛。
4. 新增 `packages/pipeline/src/publish-gate.ts`：`assertPublishableQa` / `findQaReport` 语义（自动查找 +
   显式路径 + 身份/checksum/error/incomplete 校验）；`pipeline/src/index.ts` 导出。
5. `packages/cli/src/cli.ts:227,626`：`build` / `create --yes` 的 `buildAndSite` 与 `site` 都在
   `assembleFromConfig` 之前过闸；`site` 增 `--qa-report <path>`；USAGE 同步。
6. `packages/mcp/src/server.ts:366,405`：`create_game` 与 `assemble_site` 都在 `assembleSite` 之前过闸；
   `assemble_site` inputSchema 增可选 `qaReportPath`；description 同步。
7. 测试 / 文档同步（见下）。

**裁定**：standalone `site` **不**跑 `verifyPack`（本票只做 QA 闸；字节完整性归 P0-04 的 create/build 链）。
**未改**：QA judgement 语义、失败账本、版本目录、原子发布规则、依赖、v7 包 / `fixtures/`、
`game-maker.local.json`、提交 / 推送。

## 命令与结果（E3）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `pnpm test` | 0 | **119 test files / 1810 tests passed**（本票前 115 / 1779） |
| `pnpm typecheck` | 0 | 9 个包全绿 |
| `pnpm build` | 0 | `tsc -b` + 三份 bundle 全绿 |
| `pnpm check:deps` | 0 | 依赖图合法（9 个包） |
| `pnpm exec vitest run packages/contracts/tests/qa.test.ts packages/pipeline/tests/publish-gate.test.ts packages/cli/tests/cli-site-gate.test.ts packages/mcp/tests/assemble-site-qa-gate.test.ts` | 0 | 60 通过 |
| `pnpm exec vitest run packages/pipeline/tests/create-game.test.ts packages/mcp/tests/create-game-qa-failure.test.ts` | 0 | 50 通过 |

## 发布路径 × 测试矩阵

| 发布路径 | 缺 QA | 旧 pack（subject 不符） | error | incomplete | 全绿 | warning |
|---|---|---|---|---|---|---|
| CLI `site` | ✅ 4 / 无站点 | ✅ 4 | ✅ 4 | ✅ 4 | ✅ 产 `site/v1` | ✅ 不阻断 |
| MCP `assemble_site` | ✅ 4 / 无站点 | ✅ 4 | ✅ 4 | ✅ 4 | ✅ 产 `site/v1` | （由同一闸覆盖） |
| CLI `create --yes` / `build` | ✅ 闸（`runBuild` + `buildAndSite`） | ✅ subject 复核 | ✅ `runBuild` 抛 4 | ✅ `runBuild` 抛 4（新增用例） | ✅ 既有全链用例 | ✅ 既有用例 |
| MCP `create_game` | ✅ 闸 | ✅ subject 复核 | ✅ 真链 reachability 失败：`isError` / `_exitCode=4` / 无站点 / 报告在盘 | ✅ `runBuild` 抛 4 | ✅ 既有全链用例 | ✅ 既有用例 |
| TD `site` / `assemble_site` | — 显式跳过（P2） | — | — | — | ✅ 无报告也装配 | — |

## 负例见证（临时变异，已还原）

1. **去掉 incomplete 阻断**（`create-game.ts:227` 的 `missing` 恒空）⇒
   `create-game.test.ts` 的「incomplete（一条 runner 没跑）」**1 failed**；还原后 49/49 绿。
2. **去掉 `site` 的发布闸调用**（`cli.ts:626`）⇒ `cli-site-gate.test.ts` 的拒绝组
   **4 failed**（缺报告 / 旧包 / error / incomplete 全部放行成 0）；还原后 8/8 绿。

## 诚实边界 / 残余风险

1. **只钉 pack，不钉 config**：`reachability` / `reference-resolution` 吃配置；一份绿色 pack 报告
   仍可给另一份手写 config 放行。P0-02 票面只要求 pack id + version。
2. **同 id/version 的内容被改**：`manifestChecksum` 能发现 manifest 声明改动；逐文件字节完整性归
   P0-04 的 `verifyPack`（create/build 链已跑）。**standalone `site` 不重算 checksum**（本票裁定）。
3. **旧报告（无 subject）一律拒绝**：这是「无法证明」的正确结果；兼容口是重跑 `build`。
4. **TD 显式跳过**（`td-config/v1`）：P0 只做横版，TD QA 等价 = P2。
5. **库调用方**：`assembleSite` / `assembleFromConfig` 是公开导出，绕过两个壳的调用方不受此闸约束。
6. **自动查找只对规范 out 树有效**：`<out>/<packId>/run/v*/qa-report.json`；外部包必须显式
   `--qa-report` / `qaReportPath`。
7. **README 的 fixture 快速开始已改**：side-scroller fixture 没有 QA 报告、`fixtures/` 只读，
   因此不再能直接 `site`；离线可玩入口改为 TD 示例。旧手工 `plan/pack/compile-runtime/site`
   路线要发布必须另有一份属于该包的报告（有意收紧）。
8. **`create --yes` / `build` 的闸对 error / incomplete 与 `runBuild` 有重叠**：保留它是为了
   身份复核与「QA 被关掉」（`paths.qaReport` 缺席）这条路径，不是重复判定。
9. `pnpm test:playable` 未跑（浏览器依赖，归票 10 / 票 11）；未提交、未推送（Q4）。
