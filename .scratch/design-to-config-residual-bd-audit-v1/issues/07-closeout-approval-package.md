# 收口 / P1 审批包：五项修复的批准问题与实施授权边界

Type: grilling
Status: resolved
Owner: amber · 2026-11-03
Blocked by: 06
Map: ../map.md

## Question

在合并方案（06）完成后，形成收口票 / P1 审批包：

1. **汇总五项方案**（引用 `../plan.md`），不重复方案票的技术研究。
2. **逐项呈现契约候选的批准问题**：变更内容、必要性、不改契约的替代方案、影响面、
   不实施的后果、兼容性 / 迁移要求、明确的批准问题。所有候选在用户批准前保持**未批准**。
3. **决定审批包形态**：沿用 P0 的 `final-report.md` + 审批问题清单，还是另定；
   是否逐项批准、是否允许部分批准、实施授权边界。
4. **记录本图的最终边界**：五项进入同一份方案不等于一次性批准；publish-gate 只处理
   `reachability`；第七条 `visual-config-coherence` 按 Q8 交接；零付费验证不等于
   付费模型效果验收；本图不修改生产代码、不改变契约、不启动付费调用、不生图。
5. **产出**：审批包文件（如 `../final-report.md` 或 `../approval-package.md`，按决定）、
   P1 审批问题清单、实施授权边界；本票 `## Answer` 记录批准 / 未批准结果与后续实施入口。
   本票是 HITL；本票的结论仍不构成本图内的实施。

## Answer

**裁定日期**：2026-11-03 · **裁定人**：amber · **性质**：HITL（本图最后一轮）。
**产出**：[`../final-report.md`](../final-report.md)（P1 审批包；按 Q1 采用 P0 收口结构）。

### 1. Q1–Q8 裁定

| 问题 | 裁定 |
|---|---|
| Q1 审批包形态 | **A**：`final-report.md`，沿用 P0 结构，审批问题内嵌 |
| Q2 实施授权粒度 | **A，有条件批准**：五项均进入 P1 实施；每项独立授权边界、测试与回退；顺序固定 |
| Q3 D-01 viewport API | **批准**：纯可选字段、向后兼容；CLI/MCP、默认值、序列化、Runtime 不变 |
| Q4 B-02 `ConfigIssue.code` | **不加**：本轮不扩展 contracts 闭集，沿用 `where/message` |
| Q5 `subject.configChecksum` | **以后做**：交接给完整 QA 输入身份 effort；本轮不改 `QAReport` 契约 |
| Q6 D-03 对外归因码 | **确认不加**：仅内部纯函数与私有分类结果 |
| Q7 付费验证 | **A，有条件批准预算上限**：≤6 次文本调用；P1 代码落地后、执行前再次 go/no-go |
| Q8 实施入口 | **A**：本图在审批包处收口；P1 另起 effort，本图不改生产代码 |

### 2. 批准 / 未批准 / 条件批准

- **批准**：五项修复进入 P1 实施（D-02 → B-02 → publish-gate → D-01 → D-03）；
  D-01 的 `UnderstandingInput.viewport?` / `AssembleOptions.viewport?` / `SiteOptions.viewport?` /
  world builder opts 可选 `viewport`。
- **未批准**：B-02 机读码、`QAReport` checksum、D-03 对外归因码、Q8 推迟项，
  以及任何额外契约或对外接口扩展。
- **条件批准**：付费验证预算上限 ≤6 次文本调用（2 场景）、零生图、零站点重建、既有 fixture；
  仅在 P1 实施完成后执行，执行前另做明确 go/no-go；**当前不执行任何付费调用**。

### 3. 实施授权边界

每一项必须有独立测试、独立验收记录与独立回退点；某项失败不得自动扩大到其它项，
也不得以其它项通过抵消。授权不包含未列入五项的生产代码或契约修改、CLI/MCP 对外扩展、
Q8 推迟项顺带修复、付费验证自动执行、推送 `main` 或发布生产版本。
方案批准、实施批准与付费执行是三层独立授权；本票只完成前两层，并只给第三层设上限。

### 4. 本图收口与后续入口

- 本图 Destination 到达：审批包交付，`Status: resolved`。
- P1 实施入口：`.scratch/design-to-config-residual-bd-audit-v1-p1/`，以 `final-report.md` 为输入与授权依据。
- P1 不得把本图研究票、方案票重新解释为更宽授权；本图审批裁定不在 P1 中重开。
- 本票结论不构成本图内的实施；未修改生产代码、契约、测试、fixture 或历史证据；
  零付费、零模型调用、零生图。
