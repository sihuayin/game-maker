# I00-01 现有审计语义与 coverage 缺口

Type: research
Status: open
Owner: —
Blocked by: 01
Map: ../map.md
Class: I-00 / EVIDENCE

## Question

查清 `coverage` 与三态聚合的真实关系，并给出「满足 PRD §3.2 / G-06 需要改哪里」的选项清单。这是契约冻结的**阻断问题**：如果部分可信的证据今天仍能产出 `NO_PROVEN_BLOCKER`，那么「证据不足必须降级」在现有系统里**不是**已经被保证的。

### 必须回答（逐条 E1 `file:line`）

1. **聚合实际行为**：`aggregateLayer`（`verdict.ts:104-115`）与顶层 fold（`api.ts:87-92`）分别如何处理 blocking / evidence / gaps / coverage。`verdict.ts:18-19` 的意图与 `api.ts:14-18` 的允许项是否矛盾？给一个最小示例。
2. **partial 的实际泄漏面**：哪些 coverage 会因帧来源几何（`profile.ts:92-97`）或其它原因变成 `partial`；在什么具体关卡形状下，`partial` 与 `NO_PROVEN_BLOCKER` 会共存。
3. **证据承载能力**：把 PRD §6.2 的七项解释要素（判定状态 / 运动模型 / 关键几何证据 / 时间窗口或永久封锁证据 / lag 假设 / 降级原因 / 覆盖范围与限制）逐条对照 `PlayabilityEvidence`（`verdict.ts:74-86`）、`Witness`（`verdict.ts:47-72`）、coverage（`verdict.ts:88-102`）：哪些能表达、哪些必须外挂、哪些无处可放。
4. **最小改动点**：若要满足 G-06 与 §3.2，改动应落在 (a) 顶层聚合语义、(b) 机制层内部（把 partial 直接压成 IE）、(c) 证据结构扩展，还是 (d) 仅靠 scratch 取证不改生产？各自影响哪些既有语义与测试（LP-02～LP-05、`config-audit.test.ts`、`publish-gate.test.ts`）。
5. **PRD 约束的碰撞**：PRD §3.4 禁止新增持久化 verdict / `ConfigIssue.code`；`api.ts:62` 明说结果「不落盘」。在这些约束下，解释性与可审计性只能落在哪里？

### 产出

`evidence/01-audit-semantics.md`：事实表 + 选项清单（每项标注所需授权类别）。**不实施任何修改。**

### 边界

不改 `packages/**`；不裁决选项——裁定在 [I00-R1](10-i00-r1-contract-freeze.md)。
