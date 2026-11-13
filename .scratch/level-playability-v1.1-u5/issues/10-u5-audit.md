# U5-AUDIT 最终审计（AC-12 / AC-13）

Type: task
Status: resolved
Owner: independent reviewer (U5-AUDIT session 2026-11-13)
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

最终审计报告：[`U5-final-audit.md`](../../level-playability-v1.1-i02/reports/U5-final-audit.md)（独立会话，2026-11-13，审计 HEAD `e7822f7`，授权包 SHA `797cd6fc…`）。

逐项结论（现场重跑 / 独立核对）：

| AC | 状态 | 关键证据 |
| --- | --- | --- |
| AC-08 预算 | **PASS** | 预算测试 26/26；A–J H；累计 cut 按 segments、恰好 / 超限、非法、溢出均覆盖 |
| AC-09 双档 lag | **PASS**（附限制） | U5-05 6 条 + A–J I；限制：未找到同一输入两档完整不一致世界，不一致合并由不同完整结果直接测试 |
| AC-10 确定性 | **PASS** | U5-03 7 条；独立 FNV-1a 重算一致；`wallClockMs`/`detail` 排除；3 进程摘要一致 |
| AC-11 模型外 IE | **PASS** | U5-01 模型外测试、A–J C/E；六条件 2/5 `BLOCKED` |
| AC-12 白名单 | **PASS** | 产品 diff 恰好 7 文件、全部 §5.2 白名单；禁止文件 / barrel / 依赖 / JSON 零 diff |
| AC-13 核心测试 + 回归 + 性能 | **PASS**（附限制） | 176 files / 2877 tests；架构 65/65；LP-06/07 逐字段 + stdout 逐字节一致；bench 完整、3 进程一致 |

无 FAIL、无 NOT_RUN。审计已恢复所有被脚本覆盖的 tracked 证据；除本票与本报告外无 diff。边界不变：`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`，I-03 未接线，未推送 / PR / 合并；本审计不是 R5 门，不授权后续能力。下一步为用户签署（`11-u5-sign`）。
