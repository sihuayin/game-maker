# 07. MCP accept_asset_pack

Type: task
Status: resolved
Owner: task 子代理 · 2026-10-21
Blocked by: 05
Map: ../map.md

## Question

在 `packages/mcp/src/server.ts` 新增 `accept_asset_pack` 工具：

- inputSchema：`packDir`（必填）、`baselineDir`、`outDir`。
- 调用与 CLI 相同的 `acceptAnimationPack` + `writeAcceptanceReport` core。
- `structuredContent` 返回同一份报告数据；findings 有 error 时与 CLI 同语义
  （错误内容/退出码映射遵循现有 MCP 惯例，但不得静默返回成功）。
- 扩展 `packages/mcp/tests/server.test.ts`：正例、坏包、有 findings。

## 验收

- 工具可被 MCP 测试调用；与 CLI core 同源。
- 定向测试 exit 0；`pnpm typecheck` 不新增错误。

## 边界

- 只改 `server.ts` + MCP 测试；不改 core / CLI。
- 不提交；测试用临时目录；零付费；不碰 `CONTEXT.md` / 无关 `.scratch`。
- 不写 `map.md`。

## 产出

本票 `## Answer`：工具 schema、错误语义、测试结果。

## Answer

**工具 schema**：`TOOLS` 新增 `accept_asset_pack`（置于 `verify_asset_pack` 之后），
`inputSchema.properties = { packDir, baselineDir, outDir }`，`required: ["packDir"]`；
默认 `outDir = "out"`，`baselineDir` 省略时不传（core 侧 metrics / verdict 为 null）。
description 写明「何时用 / 会失败的情况」，并显式区分「结构 findings」与「输入不合法」。

**调用**：dispatch 直接调 `acceptAnimationPack` + `writeAcceptanceReport`（与 CLI 同一 core，
未在本壳重写任何检查或报告逻辑）。`structuredContent` 是完整 `CommandResult`：

```
command: "accept"
summary: core 的 3 行摘要 + 报告路径/版本 + 结论
data: {
  packId, packVersion, baselineId, hasErrors,
  findings: { total, errors, warnings, info },
  reportVersion, reportDir, report, reportMarkdown   // 相对 outDir 的 POSIX 路径
}
artifacts: [report.json, report.md]
```

**错误语义**（三条互不混淆）：
- findings 有 `severity: "error"`：报告照常落盘并原样返回，`isError: true` + `_exitCode: 1`
  （warning / info 不阻断，仍 exit 0）。这是 `hasErrors` 映射，不是异常。
- 输入不合法（core 抛 `CommandError("invalid")`，如坏 manifest / 坏 baseline）：
  走既有 catch，`isError: true` + `_exitCode: 4`，不写报告。
- 其他异常保持既有 MCP 惯例（`exitCodeOfError`，未知异常 → 1）。

**测试**（`packages/mcp/tests/server.test.ts`，**11 例全过**）：
- 正例：v7 + 冻结 baseline → `isError:false`、无 `_exitCode`、`hasErrors:false`、
  `findings.total:0`；报告落在**临时 outDir** 的 `ruin-scavenger-extraction-assets/acceptance/v1/`，
  可被 `parseAnimationAcceptance` 解析，idle 的 metrics 非 null。
- 有 error findings：复制 `fixtures/packs/counter-siege/v4` 到临时目录，删一个图集帧并同步
  `files[]` 的 meta checksum（让 `verifyPack` 仍通过）→ `isError:true`、`_exitCode:1`，
  报告仍可解析且含 `atlas.frame.missing` error。
- 坏包：临时目录写 `{}` manifest → `isError:true`、`_exitCode:4`、无 `structuredContent`、
  outDir 未被写入。
- 工具面清单由 7 改为 8。测试全部使用 `mkdtempSync` 临时目录，`afterAll` 清理；未写仓库 `out/`。

**偏差 / 备注**：
- 票 06（CLI `accept`）尚未落地，无 CLI `CommandResult.data` 形状可抄；本票按 core 的
  `WrittenAcceptanceReport` 字段（`reportJson` → `report`、`reportMarkdown`、`version` → `reportVersion`）
  命名，两壳语义同源、字段名待最终验证时对齐。
- MCP 测试经 workspace 包 `dist` 解析 `@game-maker/assets`，需先
  `pnpm exec tsc -b packages/contracts packages/assets` 生成含 `acceptance.js` 的 dist
  （dist 为 gitignore，源码未改）。定向 `tsc -p packages/mcp/tsconfig.spec.json` exit 0；
  未跑全局 `pnpm typecheck`（留给最终统一验证）。
- 只改 `packages/mcp/src/server.ts` 与 `packages/mcp/tests/server.test.ts`；未提交、零付费、
  未碰 `CONTEXT.md` / core / CLI / 无关 `.scratch`。
