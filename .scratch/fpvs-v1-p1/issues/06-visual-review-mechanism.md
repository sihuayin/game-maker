# 06. 视觉评审状态记录机制裁定

Type: grilling
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md
Blocked by: 01

## Question

裁定视觉评审状态如何记录（FR-04），至少定：

1. **状态**：`PENDING/PASS/FAIL`（spec）—— 复用审计（票 01）发现的 `HumanVerdict=pending|pass|fail`
   （`animation-acceptance.ts:131`），还是新建一套？是否需要「取消/无效/重新评审」？
2. **写入方式**：人类结论怎么进系统？（a）复用/扩展现有 `accept` CLI 的 human block（审计：`acceptance.ts` 有
   `AcceptanceHuman` 但生产端只写冻结占位、无代码填真实 verdict）；（b）新增一条 CLI 命令 / 扩展现有命令；（c）
   qa-report.json 里一个字段由人编辑。哪个最小、最可追溯？
3. **绑定信息**：参考风格图 · 被评审资源包版本 · 关键资源/最终截图 · 结论 · 问题说明 · 时间 · 来源 ——
   哪些必填、字段类型（复用 `AcceptanceHuman` 的 `reviewer`/`reviewedAt`/`evidence` 形状？）。
4. **防误继承**：新资源包不得继承旧包视觉 PASS（FR-04 验收标准）—— 靠版本绑定保证，还是额外机制？
5. **与 P0-06（票 02）的关系**：票 02 的人工 verdict 先以 prose 记，本机制落地后如何写回、由谁写回。

HITL：用户逐字裁定，不替用户答。

## Answer（裁定 · 2026-10-27 用户逐字）

| 问题 | 裁定 | 关键约束 |
|---|---|---|
| Q1 状态 | 采纳 | 复用 `HumanVerdict` 三值 |
| Q2 写入入口 | 有条件采纳 | 新增 CLI、不加 MCP；**校验归属并原子更新** |
| Q3 绑定信息 | 采纳 | 评审字段最小化，复用 `delivery` 现有身份与证据 |
| Q4 防误继承 | 采纳 | 每个 run 独立初始化 `pending`，禁止跨 run 复制结论 |
| Q5 P0-06 写回 | 采纳 | 转录真实历史裁定，不冒充重新评审 |

补充约束（Q2）：`review-verdict` 写报告时须**校验归属**（确认目标 run/pack 正确）并**原子更新**（不就地覆写）。
补充约束（Q5）：阶段C 从票 02 转写的 `pass` 是**转录真实历史裁定**，不冒充一次新的重新评审。
