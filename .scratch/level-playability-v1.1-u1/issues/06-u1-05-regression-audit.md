# U1-05 回归、白名单 / diff 审计与实现报告

Type: task
Status: resolved
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

## Answer

**2026-11-12 完成。全量回归通过；产品改动严格落在 U1 白名单 7 文件；报告与 R1 输入包已就绪。**

### 命令结果

| 命令 | 退出码 | 计数 |
| --- | ---: | --- |
| `pnpm build` | 0 | tsc + bundle 全部完成 |
| `pnpm typecheck` | 0 | 10 个 workspace 包 Done |
| U1 定向 vitest | 0 | 2 files / 58 tests |
| 架构断言（verbose） | 0 | 1 file / 65 tests（T-55～T-65 全 PASS） |
| `pnpm test` | 0 | 172 files / 2674 tests；2 条已知 Vitest worker RPC 超时（与基线同型） |

基线 170 files / 2616 tests；+2 files / +58 tests，与 U1-04 增量一致。

### diff 审计

- `git diff --name-status ed02339..75368a6`：产品路径只有 7 个白名单文件（`temporal.ts` M 纯增 + 3 个新源文件 + 3 个新测试文件）；其余为本 effort 的 scratch 票 / 地图 / 证据。
- `temporal.ts` 无删除行；`package.json` / lockfile / workspace 零改动；`fixtures/**`、`packages/demo/**`、`ops.ts`、`pipeline` / `cli` / `mcp`、`graph.ts`、`profile.ts`、`temporal-input.ts`、两层 barrel 与 `api.ts` 零改动。
- 新模块无 `analyze:` 标签、`auditPlayabilityTemporal(` 调用、`Symbol(`、`TEMPORAL_LAG_*`、`node:fs|crypto`；无公共新导出；DAG 无反向导入 / 循环。

### 产出

- [`reports/05-implementation.md`](../reports/05-implementation.md)：命令 / 退出码 / 计数、完整 `git diff --stat`、白名单核对表、未覆盖项与已知限制、产品目录声明、Draft PR 描述、R1 输入包、证据 SHA-256。
- `evidence/05-*.log`：build / typecheck / U1 vitest / architecture / full test / diff audit 六份原始日志。

### 停止条件检查

无白名单外文件、无新依赖、无公共导出、无架构断言失败、无 D9 闭集扩张 ⇒ 未触发 STOP。

### 下游

U1-R1 独立复核进入 frontier。**必须由未参与 U1 编写、且未读作者总结 / PASS 结论的独立会话执行**；正式报告只写 `.scratch/level-playability-v1.1-i02/reports/R1-review.md`。
