# U1-05 回归、白名单 / diff 审计与实现报告

Type: task
Status: open
Owner: claude (wayfinder session 2026-11-12)
Blocked by: 05
Map: ../map.md
Class: U1 / AUDIT

## Task

对 U1 实现做回归与范围审计，产出实现报告与 R1 输入包。**不推送、不创建 PR、不合并。**

### 必须完成

1. 全量命令：`pnpm build`、`pnpm typecheck`、U1 定向 vitest、`pnpm test`；记录退出码与测试计数。
2. `git diff ed02339..HEAD` 逐文件审计：
   - 只允许 U1 白名单七个文件；
   - 无白名单外文件、无新依赖、无 JSON fixture、无 `packages/demo/**` / `ops.ts` / `graph.ts` / `profile.ts`；
   - 无公共 barrel 导出。
3. 架构断言：T-57 / T-58 / T-61 / T-62 / T-64 通过；扫描新模块不得出现 `analyze:` 属性标签、`auditPlayabilityTemporal(`、`Symbol(`、`TEMPORAL_LAG_*` 同名常量。
4. 写 `.scratch/level-playability-v1.1-u1/reports/05-implementation.md`：
   - 命令、退出码、测试计数；
   - `git diff --stat`；
   - 白名单核对表；
   - 未覆盖项 / 已知限制；
   - “产品目录只改 U1 白名单”声明。
5. 准备 Draft PR 描述（base = `wayfinder/level-playability-v1.1-i02`，head = `wayfinder/level-playability-v1.1-u1`），但**不推送、不创建 PR**。
6. 为 U1-R1 准备输入包：授权包 SHA、U1 白名单、R1 清单、命令、diff 范围 / head SHA、证据路径。

### 停止条件

- 任一白名单外文件 / 新依赖 / 公共导出 ⇒ STOP；
- 任一架构断言失败 ⇒ STOP；
- 需要新增文件或扩 D9 闭集 ⇒ STOP + HITL。

### 验收

报告完整；全量测试通过；diff 只含 U1 白名单；R1 输入包可交付。
