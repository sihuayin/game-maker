# 05. 自动试玩结果与失败分类接入裁定

Type: grilling
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md
Blocked by: 01

## Question

裁定 headless smoke 结果如何进统一报告（FR-03），至少定：

1. **接入字段**：审计（票 01）确认 smoke 只产 `result.json`（`ok/stage/reason/expected` + 截图 + console/exceptions），
   **无**步骤数/最后成功步骤/失败步骤/已知限制字段。报告里记哪些字段？（试玩是否启动/是否完成/`stage`/`reason`/
   截图证据引用；spec「步骤数（如果现有工具提供）」既然没提供，是接受缺位还是补 `playable-smoke.mjs` 输出？）
2. **失败分类**：`GAMEPLAY_FAILURE / AGENT_LIMITATION / UNKNOWN / NOT_RUN / INCOMPLETE` 五类如何映射到
   smoke 的 `stage`+`reason`？已知场景（move/jump/pickup 过、win 卡巡逻 hazard，`stage:"navigate"`、
   `collected=1/4 won=false`）归哪类？spec §FR-03 已知场景要求「无充分证据不得判游戏不可玩、标记原因未确定」。
3. **已知限制**：「自动玩家跳不过移动宽巡逻、真人可达」如何显式记录为已知限制（而非 FAIL/INCOMPLETE 的静默）？
4. **是否补 smoke 输出**：若报告需要「步骤数/最后成功步骤」，是否小改 `playable-smoke.mjs` 补字段，还是先接受
   `stage` 级粒度（§9.5 最小改动原则）？

HITL：用户逐字裁定，不替用户答。

## Answer（裁定 · 2026-10-27 用户逐字）

**裁定原则：最小改动、证据优先、不扩大硬失败范围。**

### Q1 — 接入字段：采纳
只接入 smoke 现有的 result.json 字段和证据引用，不补造步骤统计。

### Q2 — 失败分类：采纳
不新增五类交付状态；`DeliveryCheckStatus` 决定检查结果，`detail` 记录失败归因（`GAMEPLAY_FAILURE` / `AGENT_LIMITATION` / `UNKNOWN`）。

### Q3 — 已知限制 + 3/4 场景归类：更严格证据标准
「跳跃距离约 66px < 巡逻宽度 100px 且巡逻会移动」只能说明存在试玩器受限的**可能性**，尚不足以证明真人一定可以通过。
没有真人实测通关、也没有确定性的无碰撞通路证据 ⇒ **归 UNKNOWN，不提前认定 AGENT_LIMITATION**。
（系统不把「推测试玩器受限」写成确定结论。）

### Q4 — 是否补 smoke 输出：采纳
不修改 playable-smoke.mjs；现有 stage + reason + 截图 + console/exceptions 足以作为当前版本的证据粒度。
