# Playtest、人工视觉与证据完整性审计（P0-01E）

Type: research
Status: open
Blocked by: 01, 02, 03

## Question

只读核实以下八项：

1. Playtest 是否执行真实浏览器操作；
2. 关键游戏状态如何采集，瞬时事件是否可能遗漏；
3. 结果分类是否区分玩法失败、环境故障、执行器限制、超时和未知结果；
4. Playtest 报告如何关联 Demo 身份及版本；
5. 人工视觉确认是否有独立记录，是否与当前交付身份匹配；
6. `verify-delivery` 实际验证哪些证据、身份、路径和判定关系；
7. 缺失证据或身份不一致时是否会拒绝通过；
8. 现有测试覆盖哪些负向场景。

明确区分证据存在、证据有效和证据真实性；明确人工视觉确认在最终判定中的作用；明确哪些风险已验证、哪些仅在文档中声明。

产物：`.scratch/p0-01-audit/research/06-playtest-visual-evidence.md`。
