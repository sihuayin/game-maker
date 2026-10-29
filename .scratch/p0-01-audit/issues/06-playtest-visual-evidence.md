# Playtest、人工视觉与证据完整性审计（P0-01E）

Type: research
Status: resolved
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

## Answer

**已收口（2026-10-29，只读）。** 八项结论与证据索引见 [research/06-playtest-visual-evidence.md](../research/06-playtest-visual-evidence.md)。

- Playtest 真跑系统 Chrome/CDP/真实按键；交付内 v1/v2 为 E3（harness/rules v1），06 两份 v2 attempt 未归因；HEAD 的 v2 CLI 写回无 E3。
- 状态靠轮询快照差分，瞬时事件结构性可漏；读不到状态会记 gap 并降为 UNKNOWN，但两次成功读取间漏采不会留 gap。
- 五态 + UNKNOWN + not-executed 分类完整（19 个归因用例）；交付默认只要求一个 happy-path，非 SUCCESS 状态无真实 E3。
- 报告身份绑到 site/pack/config/shell/harness/rules；缺口是 runId/attempt nonce 与 harness/rules 版本不强制。
- 人工视觉有独立记录且与冻结身份匹配（11/11 identity verified），是 verdict pass 的必要条件；但机器只验记录完整性与一致性，不重判人工结论。
- `verify-delivery` 验清单/路径/哈希/身份/三方/站点/引用/视觉/playtest/六项重导出/verdict；缺失或身份不符会 blocked/fail，exit 0 只在 pass；信任根是 git 固定清单。
- 负向测试：18 个验收器用例 + 6 个 CLI 用例 + playtest/归因/视觉写回用例；缺口是 CLI playtest 准备校验无测试、视觉非全 pass 与 playtest 摘要不一致无负向、失败重跑不撤销旧 pass。
