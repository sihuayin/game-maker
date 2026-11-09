# I00-01 现有审计语义与 coverage 缺口

Type: research
Status: resolved
Owner: research subagent · 2026-11-09
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

## Answer

证据全文：[`evidence/01-audit-semantics.md`](../evidence/01-audit-semantics.md)（E1 源码行号、E2 测试与退出码、E3 探针原始输出与输入 SHA 均在文内）。

- **F1/F2：partial 不参与任何聚合。** `aggregateLayer` 的 `coverage` 入参在函数体（`verdict.ts:110-114`）**从未被读取**；顶层 fold（`api.ts:87-92`）只读三层 `verdict`，不读 coverage / gaps / evidence。层内与整关的降级都只由 evidence、gaps 决定。
- **F3：文字冲突已确认。** `verdict.ts:18-19` 与 `profile.ts:22-23` 声称 LP-05 整关聚合会用 partial 把总 verdict 拉向 IE；`api.ts:14-18` 明说这是**用户 2026-11-06 裁定的有意偏离**，并**允许** `NO_PROVEN_BLOCKER + coverage.spatial = partial`。实际实现以 `api.ts` 为准，前两处说明未被实现。
- **F4/F5：泄漏面。** `coverage.spatial` 在 **39/39** fixture 用例中都是 `partial`（玩家几何无条件 partial：`profile.ts:113` → `graph.ts:97`）；9 个 NO_PROVEN 用例 **9/9** 至少一维 partial。最强形状 `pit-chest-with-reset-hazard`：三层全 NO_PROVEN、三层 gaps 全空、spatial+mechanic 均 partial、整关仍 NO_PROVEN——mechanic 的 partial 仅来自静止 hazard 帧几何（`profile.ts:97` + `mechanic.ts:127`），不需要任何降级 gap。
- **F6：降级原因在整关丢失。** `PlayabilityVerdict` 不含 layer gaps（`api.ts:44-48,104`）；13 个 IE 用例中 **11 个整关 `evidence` 为空**（如 `baseline-last-train`、`wide-patrol`、`moving-platform`），原因只存在于层 gaps。
- **F7：§6.2 七要素映射。** 现有结构能表达「判定状态（仅内存）」「关键几何证据」「danger 安全窗口的时间量」；「降级原因」只在层内可表达、整关无处；「运动模型」「`lagMs`」**完全无处可放**（全仓无 `lagMs` 字段）；「覆盖范围与限制」只有三维三态摘要。
- **Q4 选项（不裁定，交 R1）：** (a) 顶层聚合 / (b) 机制层内部——两者都会因 spatial 恒 partial 而使 NO_PROVEN 对可解析关卡的关卡实际不可达，且 `playability-api.test.ts:43-48`（(b) 另加 spatial `:60-82,275-277`、mechanic `:93-102`）必失败；`config-audit.test.ts` / `publish-gate.test.ts` 只消费 issue，不受 verdict 降级影响。(c) 证据结构加法字段——语义零变化、预计现有 137 测试全过，需 R1 冻结契约字段。(d) 仅 scratch——零影响、零新增授权，但产品运行时解释力不增加。详见证据 §5 对照表。
- **Q5：可审计性落点。** 在 PRD §3.4（禁新增持久化 verdict / `ConfigIssue.code`）、`api.ts:62`（不落盘）、`config-audit.ts:53` 与 `publish-gate.ts:140` 立即压成 issue 的约束下，一次 NO_PROVEN / IE 运行**不留下任何持久化痕迹**；PROVEN 也只留下人话 `message` + `where`（无 `code`、无 coverage、无 witness）。解释性与可审计性只能落在：内存返回值（L1，需调用方保留）、测试/fixture 矩阵（L3）、scratch 证据（L4）、冻结文档（L5）——今天实际存在的只有 L4/L5，且都在产品之外。
- **复现：** `scripts/probe-coverage.ts` + 文内命令；`vitest run` 上述 6 个测试文件 **137/137 通过，退出码 0**；未修改 `packages/**`、`docs/**`、`fixtures/**`。
