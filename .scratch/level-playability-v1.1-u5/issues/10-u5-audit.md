# U5-AUDIT 最终审计（AC-12 / AC-13）

Type: task
Status: open
Owner: —
Blocked by: 09
Map: ../map.md
Class: U5 / AUDIT

## Task

由**未参与 U5 实现的独立会话**执行 AC-12 / AC-13 最终审计。**这不是 R5 门**，不授权任何后续能力；通过后仅进入用户签署。

### 必须完成

1. 只依据审计输入包、完成报告、冻结规格、产品源码与证据路径工作；自己重跑命令、检查 diff、逐项判断。
2. 独立重跑并记录退出码：
   ```bash
   pnpm build
   pnpm typecheck
   pnpm test
   pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs
   pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs
   pnpm build && node .scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs
   ```
3. 逐项判定 AC-08～AC-13：`PASS / FAIL / NOT_RUN`，不得用总通过率替代。
   - AC-08 预算；AC-09 双档；AC-10 确定性；
   - AC-11 模型外 IE；AC-12 白名单 / 范围；AC-13 核心测试 + 回归 + 性能证据。
4. 独立检查：A–J 矩阵覆盖、六条件 `puConditions`、`publicCapability="BLOCKED"`、T-55/57/58/61/62/64、生产接线零改动。
5. 独立验证至少 2 条关键断言（自选并记录理由与结果）。
6. 写 `.scratch/level-playability-v1.1-i02/reports/U5-final-audit.md`：逐项结论、命令与退出码、证据 hash、未覆盖项、限制、独立签署。
7. 不修改产品代码；不推送 / 建 PR / 合并；不把审计结论扩展为公共能力 / I-03 授权。

### 禁止

- 以作者总结替代自己的复核；
- 修改产品代码 / 测试 / 证据；
- 宣称 `PUBLIC_NB` / `PUBLIC_PU` 获准。

### 验收

审计报告完整；AC-08～AC-13 均有结论；命令有退出码；证据有 hash；未覆盖项显式列出；审计会话独立。

## Answer

（resolved 时填写）
