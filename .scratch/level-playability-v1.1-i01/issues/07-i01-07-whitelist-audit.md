# I01-07 白名单与 R2 一致性审计

Type: task
Status: resolved
Owner: amber
Blocked by: 01, 05, 06
Map: ../map.md
Class: I-01 / EVIDENCE

## Question

对 I-01 执行包做一次逐项范围审计：每个计划改动是否在 I-00 §11 白名单内、是否落在 R2 已批准范围内、是否触碰既有测试或公共面第 5 项。

### 必须交付

1. **逐文件审计表**：`文件 → 白名单条目 → 改动性质 → 结论（允许 / 需 R2 / 禁止）`。
2. **公共面审计**：逐项对照 R2 已批准的 4 项加法；任何新增项标 `STOP`。
3. **测试审计**：证明没有修改既有测试文件；没有删除 / 放宽既有断言；新增测试文件符合「只增不改」。
4. **偏离审计**：把 map 的「对 I-00 冻结计划的显式偏离」逐项落到具体文件与签名，确认偏差仍在白名单内。
5. **越界结论**：若存在任何越界，写出「停止 + 回 I-00 R2」的具体请求，不把它包装成授权票的一部分。
6. **范围审计证据**：`git diff --stat`（相对于 `main @ 29ea1d1`）在**实施阶段**的预期形状；本票只写预期，不产生生产 diff。

### 产出

`../evidence/07-scope-audit.md`。**不修改任何生产文件。**

### 收口条件

- 审计表无未分类项；
- 越界清单为空，或明确停止；
- 审计结论可直接作为授权票的附件。

## Answer

审计记录：[`evidence/07-scope-audit.md`](../evidence/07-scope-audit.md)。

- **逐文件：7 个文件全部落在 I-00 §11 白名单内，越界清单为空。** 预期实施 diff = **3 个新增**（`temporal.ts`、`temporal-input.ts`、`playability-temporal-input.test.ts`）+ **4 个修改**（`api.ts`、`assets/ops.ts`、`create-game.ts`、`publish-gate.ts`）；无 `D`、无 `package.json` / `pnpm-lock.yaml`、无 `fixtures/**`、无 `docs/v7.8/**`、无 demo / cli / mcp。
- **既有测试零改动、零删除、零放宽**。唯一新增测试是 `playability-temporal-input.test.ts`；`publish-gate.test.ts` 按 I01-06 裁定不新增用例（`:193` 已穿过新接线）。
- **公共面没有第 5 项功能类别**：R2 第 2–4 项一项不用；第 1 项（`auditPlayability` 第三参数）由新时序入口**替代**，`auditPlayability` 签名一字不改。无新 `ConfigIssue.code`、持久化字段、CLI / MCP 参数或新依赖。
- **边界项（必须 R1 逐符号签署，不是越界）**：`stubTemporalAnalyzer`、`temporalScope` 是新模块内部导出，不在 I01-01 的逐项枚举里；判定属「第 1 项替代集合」。若签署人或 R2 授权人认为任何新符号都算第 5 项 ⇒ 本包不得签署，`STOP → I-00 R2`。
- **偏离审计**：map 的 5 项显式偏离全部落在白名单；另登记 I01-05 的 `compileRuntime` 只接 `:1284`（不接 `:1247`），以及 I01-06 的发布闸测试不加法。`profile.ts` / `graph.ts` / `fixtures/packs/**` 三项「需单独裁定」全部未触发。
- **无硬越界，无需回 I-00 R2。** R1 必须显式列明 4 条边界：第 1 项替代形态、`stubTemporalAnalyzer` / `temporalScope` 导出、`:1284` 收敛、读取器无独立单元测试 + 接线只能结构证明。
- 本票只产出审计证据；不构成 I-01 实施授权。
