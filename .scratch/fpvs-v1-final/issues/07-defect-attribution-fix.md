# FA-03 缺陷归因与有限修复

Type: task
Status: closed
Owner: main session · 2026-10-28
Map: ../map.md
Blocked by: 06

## Question

基于 FA-02 的证据判定未通关/未覆盖的原因；对**配置/管线级确定性缺陷**做有限修复并重新取证；
对超出范围的缺陷停止修复、按实际证据收口。同时补齐 FR-03 的离线判定边界测试。

1. **归因复核**：逐项复核 FA-02 的 outcome 与证据，区分游戏缺陷 / 代理限制 / 环境故障 /
   证据不足 / 超时；每条结论必须有可复核依据（事件、状态、trace、截图），不能只写类别。
2. **缺陷判定**：若证据直接显示游戏违反必要行为（例如不可完成的通路、目标永远不可达），
   记为游戏缺陷；不得用「可能是代理限制」掩盖。

   **误归因风险**（FA-01A）：`gateReached=true` + `won=false` 会被规则 ④ 判成 `GAMEPLAY_FAILURE`，
   但这可能是漏捡宝箱（代理限制）而非游戏缺陷。复核时必须先看「是否集齐」「是否 gate 停点缺口」
   再下 `GAMEPLAY_FAILURE` 结论；必要时回看 FA-02 的 `collected` 守卫与 FA-01B 的停点证据。
3. **有限修复**：只修配置/管线级确定性缺陷；生成**新版本**产物（不覆盖旧版、遵守版本分配与原子提交），
   在新版本上重跑 FA-02 的通关证据与七维覆盖。需要重写 Runtime 或重新付费生成的修复 → 停止，
   在本票记录原因，最终按 `fail` / `blocked` / `incomplete` 收口。
4. **离线边界测试**（FR-03 / §6.1）：核对现有测试是否覆盖——版本不匹配、视觉审核未完成/不通过、
   历史报告可读但不升级、未知状态不映射为通过、CLI/MCP/交付报告一致；缺什么补什么（纯离线、零付费）。
5. **产出**：`runs/<date>-attribution/`（归因记录 + 修复决定 + 新版本证据如适用 + 测试清单与结果）。

完成条件：每个未通过/未覆盖项都有归因或明确标「证据不足」；修复范围与版本变更可追溯；新增测试全绿。

## Answer

**结果：FA-02 的 `SUCCESS` 复核成立；没有需要修复的配置/管线级确定性缺陷 ⇒ 零修复、零新版本产物。**

1. **归因复核**：21 项只读检查全过（`runs/2026-10-28-attribution/verify.mjs` → `attribution.json`）。
   重建证据交给真实 `attribute()` = `executed / SUCCESS / evaluate`（环境健康、7/7 动作完成、
   8/8 断言 pass、终止达成、0 runtime-error、0 reset）；身份三方一致、快照/参考 80 条哈希零变化、
   work 只有 `run/v1/qa-report.json` 变（FA-02 写回）。失败迭代 1 复核为 `AGENT_LIMITATION`
   （19 reset、3138 步、`won` 断言 unknown），未被升成 `GAMEPLAY_FAILURE`；历史
   `playtest/v1..v3` 与阶段C 的 visual pass 可读、不继承。
2. **缺陷判定**：无游戏缺陷。**误归因风险未触发** —— trace 中「到 gate 但 won=false」采样 = 0，
   `wait_until collected>=6` 守卫先满足，win 时 collected=6；规则 ④ 的潜在路径（未集齐到 gate →
   GAMEPLAY_FAILURE）作为**已知限制**记录，改语义需审批，本票不修（游戏本身把胜利门控在
   `collected >= pickupCount`，`scene.ts:362`）。
   另：FA-02 报告的「危险物最小净空 25.8px」无法从持久化 trace 复现；可复现读数为
   **18.75px**（|dx|≤14）/ **6.25px**（玩家盒与危险物盒水平重叠），453 采样 0 重叠、reset=0，
   定性结论不变；历史报告不改写。
3. **有限修复**：无配置/管线级确定性缺陷阻断验收 ⇒ 不生成新版本产物、不重写 Runtime、零付费；
   快照/站点/pack/config 零写入，历史产物未覆盖。
4. **离线边界测试**：新增 **7** 个纯离线用例 —— pack/shell 身份不匹配拒写、delivery 无 site 拒写、
   UNKNOWN 不升级为通过、沉默（无失败/无终止/无超时）⇒ UNKNOWN、历史阶段C 旧 PASS 读回不升级、
   无 delivery 的报告不读成 pass、CLI/MCP/交付报告在四种 verdict 下同源一致。
   结果：`pnpm test` **2160/145 绿** · `pnpm typecheck` 绿 · `pnpm test:playtest` self-test 4/4 +
   **96 绿**。`pnpm test:acceptance` 未跑（未触达该链路）。
5. **产物**：`runs/2026-10-28-attribution/`（README + verify.mjs + attribution.json）。
   报告：[runs/2026-10-28-attribution/README.md](../runs/2026-10-28-attribution/README.md)。
