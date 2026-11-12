# U2-07 回归、白名单审计与实现报告

Type: task
Status: open
Owner: claude (U2-07 audit session 2026-11-12)
Blocked by: 07
Map: ../map.md
Class: U2 / AUDIT

## Task

对 U2 做回归与范围审计，产出实现报告与 R2 输入包。**不推送、不创建 PR、不合并。**

### 必须完成

1. 全量命令：`pnpm build`、`pnpm typecheck`、U2 定向 vitest、架构断言（`playability-temporal-input.test.ts`）、`pnpm test`；记录退出码与测试计数。
2. `git diff <U2 base>..HEAD` 逐文件审计：
   - 产品路径只允许 U2 白名单 3 个文件；
   - 无其它产品改动、无新依赖、无 JSON fixture、无 `packages/demo/**` / `ops.ts` / `graph.ts` / `profile.ts` / barrel 改动。
3. 架构断言 T-55 / T-57 / T-58 / T-61 / T-62 / T-64；新模块无 `analyze:` / `auditPlayabilityTemporal(` / `Symbol(` / `TEMPORAL_LAG_*`；`temporal-witness.ts` **不 import** `temporal.ts`。
4. 写 `.scratch/level-playability-v1.1-u2/reports/07-implementation.md`：
   - 命令、退出码、测试计数；
   - `git diff --stat`；
   - 白名单核对表；
   - 未覆盖项 / 已知限制；
   - “产品目录只改 U2 白名单”声明；
   - Draft PR 描述（base = `wayfinder/level-playability-v1.1-i02`，head = `wayfinder/level-playability-v1.1-u2`）；
   - R2 输入包（授权包 SHA、U2 白名单、§9.2 清单、命令、diff 范围 / head SHA、证据路径）。
5. 不推送 / 不建 PR / 不合并。

### 停止条件

- 任一白名单外文件 / 新依赖 / 公共导出 ⇒ STOP；
- 任一架构断言失败 ⇒ STOP；
- 需要新增文件或扩 D9 闭集 ⇒ STOP + HITL。

### 验收

报告完整；全量测试通过；diff 只含 U2 白名单；R2 输入包可交付。
