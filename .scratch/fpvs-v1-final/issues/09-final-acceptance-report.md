# FA-05 最终报告与 verdict

Type: task
Status: open
Owner: unclaimed
Map: ../map.md
Blocked by: 06, 07, 08, 05

## Question

汇总身份、QA、试玩、归因/修复、视觉审核，用现有 `delivery` 模型产出最终 verdict，
并另出一份逐项证据引用的 Markdown 最终验收报告；核对 CLI / MCP / 交付报告一致。

1. **判定维度**（FR-05）：产物身份与版本一致性；构建/配置/QA；真实启动与必要操作；真实目标完成；
   试玩失败归因；P0-06 人工视觉审核；未解决阻塞与证据缺口。
2. **verdict**：由现有 `buildDeliveryReport` / `deriveDeliveryVerdict` 确定性计算
   （`fail > blocked > incomplete > pass`）；必需项不得绕过；不新增枚举/字段。
3. **报告** `final-acceptance.md`：逐项强制条件 → 结论 → 证据引用（命令/退出码/路径/身份）；
   未解决项与限制；最终 verdict 与理由；「任何人可据此判断是否达标」。
4. **一致性**：同一验收对象上，CLI 摘要 / MCP `create_game` / 交付报告 / 报告文本不得互相矛盾；
   缺席证据明示「尚无结论」，不默认 pass。
5. **契约边界**：若某项强制条件在现有契约里无处落点，停止并单开审批票；不得私自加字段。
6. **落盘**：`.scratch/fpvs-v1-final/runs/<date>-final-acceptance/`
   （`qa-report.json` + `final-acceptance.md` + 证据索引）。
7. **收口语义**：`pass` / `fail` / `blocked` / `incomplete` 按用户 2026-10-27 规则；
   非 pass 也是合法收口，但必须列清缺口与原因。

完成条件：最终结论可从报告与证据复核；四类结果语义正确；CLI/MCP/报告一致。

## Answer

<!-- pending -->
