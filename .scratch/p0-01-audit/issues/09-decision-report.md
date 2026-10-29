# 开发决策报告与缺口分类（P0-01G）

Type: task
Status: resolved
Blocked by: 04, 05, 06, 07, 08

## Question

把发现分为六类：

1. 已具备，无需改动；
2. 已实现，但需要补充真实验收证据；
3. 生产实现存在明确缺口；
4. 机制存在但不可有效观测或判定；
5. 证据、身份或版本管理存在缺口；
6. 证据不足，暂不能判断。

每个缺口必须包含：观察到的事实、对应证据、影响的验收目标、最小建议动作、是否需要独立审批、是否阻塞第二个 Demo、建议优先级及理由。

最后只提出一个下一步优先事项并说明选择依据；明确第二个 Demo 是否可以进入实施；若不可，给出最小阻塞解除方案。

产物：`.scratch/p0-01-audit/research/09-decision-report.md`。

## Answer

**已收口（2026-10-29，只读综合）。** 六类缺口与逐条证据见 [../research/09-decision-report.md](../research/09-decision-report.md)。

- 六类计数：已具备 6 · 已实现需补证据 7 · 生产实现缺口 10 · 机制不可观测/判定 6 · 证据/身份/版本管理缺口 7 · 证据不足 7。
- **下一步唯一优先事项：P0-02 A 付费试跑。** 依据用户 HITL 裁定 Q2(a) 与 A 的证据强度；它同时补 G2-1（delivery 壳级 E3）、G2-2（v2 playtest 写回）、G6-1（第二个 Demo 未运行）。
- **第二个 Demo 可进入实施（A），但条件性**：预算授权 + 新输入（intent/参考图/自定义 scenario）+ 不改生产代码/不手改中间 JSON；核心验收 `collect-pickup` + `reach-goal`；`open-chest` 可选；新参考图 → 新视觉世界/资源包；证据 = 真实运行 + delivery + 真实浏览器 Playtest；正式清单/`verify-delivery` 后续补齐。
- 最高风险：`buildAndSite` delivery 无壳级 E3、HEAD v2 playtest 写回无 E3、默认场景写死 wasteland 常量、无平台可通关求解器、新交付无正式清单。
- B 的假绿链（G3-2/G3-5/G4-1/G4-2）是独立缺口，不阻塞 A，也不作为 A 的隐含验收项。
- 不得用历史 E3 替代新证据，也不得把壳级 delivery E3 / v2 写回 / 清单缺失默认为已通过。
