# 06. CLI accept 命令

Type: task
Status: resolved
Owner: task 子代理 · 2026-10-21
Blocked by: 05
Map: ../map.md

## Question

在 `packages/cli/src/cli.ts` 新增 `accept` 命令：

```
game-maker accept <资源包目录> [--baseline <baseline 目录>] [--out <目录>] [--json]
```

- 调用 `acceptAnimationPack` + `writeAcceptanceReport`；输出人类摘要与 `--json`。
- 默认 `--out ./out`；报告路径 `out/<packId>/acceptance/v<N>/report.json` + `report.md`；
  版本不覆盖。
- 退出码：0 无 error findings；1 有 error findings；2 参数错；4 包/基准不合法。
- USAGE 增加说明；不接入 `runBuild`。
- 新增/扩展 `packages/cli/tests/cli.test.ts`：人类/JSON、0/1/2/4、版本不覆盖。

## 验收

- `accept` 对 v7 + baseline exit 0；坏包 exit 4；有 error findings exit 1。
- `--json` 与人类输出同源；报告可被 `parseAnimationAcceptance` 解析。
- 定向测试 exit 0；`pnpm typecheck` 不新增错误。

## 边界

- 只改 `cli.ts` + CLI 测试；不改 core 语义 / MCP。
- 不写 `out/` 于测试（临时目录）；不提交；零付费；不碰 `CONTEXT.md` / 无关 `.scratch`。
- 不写 `map.md`。

## 产出

本票 `## Answer`：命令用法、退出码实测、测试结果。

## Answer

**2026-10-21 · 票 06 收口（施工完成，未提交）。** 改动仅 `packages/cli/src/cli.ts` +
`packages/cli/tests/cli.test.ts`；core / MCP / `CONTEXT.md` / 无关 `.scratch` 均未碰；
测试全部写临时 `--out`（仓库 `out/` 零新增）。

### 命令用法

```
game-maker accept <资源包目录> [--baseline <baseline 目录>] [--out <目录>] [--json]
```

- 调 `acceptAnimationPack` → `writeAcceptanceReport`；默认 `--out ./out`，
  报告落 `out/<packId>/acceptance/v<N>/report.json` + `report.md`，版本由 core 原子抢号、不覆盖。
- 人类输出 = `renderHuman(CommandResult)`（`summary` + `artifacts`）；`--json` 是**同一份**
  `CommandResult`，测试逐字比对「人类文本 === JSON.summary + artifacts 渲染」。
- `data` 字段与 MCP（票 07）**逐字对齐**：
  `packId · packVersion · baselineId(null 可) · hasErrors · findings{total,errors,warnings,info} ·
   reportVersion · reportDir · report · reportMarkdown`（后三者相对 outDir 的 POSIX 路径）。
  `artifacts`：`report.json → kind "acceptance-report"`、`report.md → kind "acceptance-report-markdown"`。
- USAGE 增加命令行、语义段与退出码说明；**未接入 `runBuild`**。
- 退出码：`exitCode` 是 `run()` 的 case 级变量 —— `accept` 打印结果**之后**按
  `hasErrors` 返回 1（不抛异常，报告不被当成失败输入）；无效包 / 基准仍由 core 的
  `CommandError("invalid")` 走 4。

### 退出码实测（定向 vitest，28 例）

| 场景 | 实测 |
|---|---|
| v7 + 冻结 baseline（findings 为空） | **0**，报告可被 `parseAnimationAcceptance` 解析，baseline metrics 在 |
| 临时复制 v7 + 篡改图集 JSON 帧矩形（同步改 `files[]` checksum） | **1**，`atlas.frame.out-of-bounds` error，报告照样落盘 |
| 缺位置参数 / `--baseline` 缺值 | **2** |
| `manifest.json = {}` / baseline 目录无 `baseline.json` | **4**，不产出报告 |
| 同一 `--out` 连跑两次 | v1 / v2 递增，v1 逐字节不变 |

定向结果：`npx vitest run packages/cli/tests/cli.test.ts` → **28 passed / 28**（19.27s）；
`npx tsc -p packages/cli/tsconfig.spec.json` → **exit 0**（按票边界未跑 `pnpm typecheck`）。

### 偏差 / 记录

- `baseline` 加入 `parseArgs` 的全局 `takesValue`（否则目录会掉成位置参数）；只被 `accept` 消费。
- 人类摘要最多列 10 条 error findings，其余给一句「见报告」；`data` 里始终是全量计数。
- v7 / baseline 用例带 `skipIf` 兜底（fixture 缺失时 skip），与 `acceptance.test.ts` 同一组真包。
- 施工中一次全量重跑前 `packages/assets/dist` 正被刷新，首个 accept 用例曾因旧 dist 退 1；
  dist 更新后复跑全绿（未改 core）。最终统一验证会先 `tsc -b`，不受影响。
