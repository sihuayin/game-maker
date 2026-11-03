# Design-to-Config Residual B/D P1：五项修复的实施与验收

Labels: wayfinder:map
Tracker: local-markdown
Effort: design-to-config-residual-bd-audit-v1-p1
Baseline: 代码基线 `main` @ `3b1b61d`；授权与图表提交：待记录（见「基线记录」）
Status: open · 2026-11-03 开图
Predecessor: [B/D 残余审计](../design-to-config-residual-bd-audit-v1/map.md)（已收口）

> **2026-11-03 开图。** 授权来源：[final-report.md](../design-to-config-residual-bd-audit-v1/final-report.md) §3；
> 路线与判据：[plan.md](../design-to-config-residual-bd-audit-v1/plan.md)。
> 用户裁定 F1–F5 全部 A。本图按 Notes 的「执行覆盖」**承载 P1 执行**，
> 不采用 wayfinder 的「只做决策」默认。

## Destination

五项修复（D-02 → B-02 → publish-gate → D-01 → D-03）在生产代码中实现，每项独立测试、验收与回退；
`pnpm build` / `pnpm typecheck` / 逐项测试批次 / 全局语料重判通过；专用分支逐项 commit；最后开 PR（不合并）；
付费验证只完成 go/no-go 决策，不执行。五项全部有最终处置：已实施并验收，或由用户在失败裁定点明确推迟。

## Notes

### 执行覆盖（本图承载实施）

- wayfinder 默认「只做决策、不做交付」；本图按 07 的授权与 F1–F5 裁定覆盖为**承载执行**。
- `01`–`06` 为 `task`（AFK）；`07` 为 `grilling`（HITL）。
- 票据不能扩大 `final-report.md` 的授权范围；任何越界即停止链条，回到失败票的裁定点。

### 不可变执行规则（用户裁定，2026-11-03）

1. `final-report.md` 是实施授权的唯一规范来源；票据不能扩大其范围。
2. P1 基线必须包含审批包与 P1 map / 票据。
3. 实施严格串行，不能并行越过 `Blocked by`。
4. 每项独立 commit、测试、验收与回退。
5. 付费验证必须经过 07 的再次 go/no-go。
6. PR 可以由本图创建，但合并不属于本图授权。

### 授权边界（来自 07）

- **批准**：五项修复进入 P1；D-01 可选 viewport API 增量；≤6 次文本调用的条件预算上限（执行另批）。
- **不批准**：B-02 机读码；`QAReport` checksum；D-03 对外归因码；Q8 推迟项；任何额外契约或对外接口扩展。
- **不包含**：CLI/MCP 对外参数或行为扩展；推送 `main`；合并 PR；付费验证自动执行；
  历史 run / pack / site / fixture 改写；五项之外的顺手修复。

### 分支、提交与推送

- 分支：`p1/design-to-config-residual-bd-audit`，从包含审批包与 P1 map/票据的基线 commit 创建。
- 每项一个 commit：`P1-D-02: ...` / `P1-B-02: ...` / `P1-publish-gate: ...` / `P1-D-01: ...` / `P1-D-03: ...`。
- `06`：`P1-acceptance: ...`；`07`：`P1-closeout: ...`。
- 实施期间只在本地分支提交；`07` 通过 HITL 后才推送分支并开 PR（走 ClashX 代理）。
- 不推送 `main`；不自动合并 PR；合并由用户在图外完成。

### 验收与证据

- **逐票**：该票的测试批次绿 + `pnpm typecheck` 绿 + 该票相关的零付费检查；票内 `## Answer` 记录命令、结果、commit SHA 与回退点。
- **06**：`pnpm build` / `pnpm typecheck` / `pnpm test`；`plan.md` §7.3 的全局语料重判；产出 `report.md`。
  06 必须验证五项的组合结果，而不是只汇总五张票各自的测试通过情况。
- **零付费**：全部实施与验证不调用模型、不生图、不重建站点、不使用付费链。

### 失败语义（F3 对 Q5 的细化）

- 任何失败、回退或需要扩大范围 ⇒ **链条停止，不得跳票**；由用户在失败票的裁定点决定推迟、改范围或放弃。
- Q5 的「逐项隔离」指回退与记录互不污染，不表示可以越过失败票继续后续票。
- 失败票不得被静默算作完成；目的地只在五项全部有最终处置时到达。

### 票流

1. [01 D-02](issues/01-d02-role-prompt-parity.md)（task，AFK）
2. [02 B-02](issues/02-b02-deterministic-reachability.md)（task，AFK，blocked by 01）
3. [03 publish-gate](issues/03-publish-gate-reachability.md)（task，AFK，blocked by 02）
4. [04 D-01](issues/04-d01-viewport-passthrough.md)（task，AFK，blocked by 03）
5. [05 D-03](issues/05-d03-modelhard-attribution.md)（task，AFK，blocked by 04）
6. [06 验收与报告](issues/06-acceptance-report.md)（task，AFK，blocked by 05）
7. [07 收口](issues/07-closeout-hitol.md)（grilling，HITL，blocked by 06）

本图不创建 research 票：`plan.md` 与 01 / 02 / 04 研究已覆盖全部所需事实。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

## Not yet specified

（无。五项路线、切法、分支与验收口径已定；执行中的失败按 F3 停在裁定点。）

## Out of scope

- **B-01 / B-03 / B-04 / B-05 / B-06 / B-07 / D-04**：维持 03 §4 的推迟交接，本图不重开。
- **Q8 交接项**：第七条 `visual-config-coherence`、完整 QA 输入身份（含 `subject.configChecksum`）、
  规划循环 / 塔防循环的盲重采样 —— 均不在本图。
- **付费执行**：本图只到 07 的 go/no-go 决策；执行需另一次明确授权与确认。
- **任何额外契约 / API / CLI / MCP / Runtime / 依赖变更**。
- **推送 `main`、合并 PR、发布生产版本**。
- **改写历史 run / pack / site / fixture 或既有验收证据**。
- **五项之外的顺手修复**；发现的新问题只记录，不实施。

## 基线记录

- **代码基线**：`main` @ `3b1b61d`。
- **授权与图表提交**：待记录（提交后填写 SHA）。
- **P1 分支**：`p1/design-to-config-residual-bd-audit`（从上述提交创建）。
