# U2-09 修复后回归、审计与 R2 重审输入

Type: task
Status: open
Owner: claude (U2-09 audit session 2026-11-12)
Blocked by: 11
Map: ../map.md
Class: U2 / AUDIT

## Task

对 U2-08 的修复做回归与范围审计，更新实现报告并准备 R2 重审输入包。**不推送、不创建 PR、不合并。**

### 必须完成

1. 全量命令：`pnpm build`、`pnpm typecheck`、U2 witness 定向、input 定向、`pnpm test`；记录退出码与计数。若出现环境超时，区分超时与断言失败并至少重跑一次。
2. `git diff 23a2027..HEAD` 逐文件审计：
   - 产品路径仍只允许 U2 白名单 3 文件；
   - 无 U3–U5 / 其它产品文件 / 新依赖 / JSON fixture / barrel 改动；
   - 授权包 SHA `797cd6fc…` 不变。
3. 架构断言 T-55 / T-57 / T-58 / T-61 / T-62 / T-64；新模块无禁用模式；`temporal-witness.ts` 不 import `temporal.ts`。
4. 写 `.scratch/level-playability-v1.1-u2/reports/08-fix-implementation.md`：
   - 修复内容与选择（对称 pad / 精确滑动窗口）；
   - R2 §4.3 反例修复前后的复现结果；
   - 命令、退出码、计数、`git diff --stat`；
   - 白名单核对表、未覆盖项 / 已知限制；
   - “产品目录只改 U2 白名单”声明；
   - R2 重审输入包：首次 R2 FAIL 报告路径、修复 diff / head SHA、命令、证据路径。
   - 不覆盖 `.scratch/level-playability-v1.1-i02/reports/R2-review.md`（首次 FAIL 保留）。
5. 不推送 / 不建 PR / 不合并；不启动 R2 重审。

### 停止条件

- 任一白名单外文件 / 新依赖 / 公共导出 ⇒ STOP；
- 任一架构断言失败 ⇒ STOP；
- 全量测试有断言失败 / 重跑后仍失败 ⇒ 记录 FAIL，票保持 open；
- 需要扩 D9 闭集 / `BudgetProfile` ⇒ STOP + HITL。

### 验收

报告完整；全量测试通过；diff 仍只含 U2 白名单；R2 重审输入包可交付。
