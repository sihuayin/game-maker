# 07. VDS ↔ GameConfig 交叉验证（第 7 判据）

Type: task
Status: open
Owner: —
Blocked by: 01, 06
Map: ../map.md

## Question

实现 `visual-design-v1` 票 07 锁定的 VDS↔GameConfig 交叉验证，作为 QA 的**第 7 条判据**（视觉族）。接缝已由
`assets/codebase-facts.md` §6 钉死。

- **判据挂名**：`QA_JUDGEMENTS` 6→7（`qa.ts:110-152`，追加名词，自动扩展 `QAJudgement`/`QAJudgementResults`/`checked`）+
  `QA_JUDGEMENT_LABELS`（`qa.ts:402`）+ `assemble.ts:90-97` 的 6-key `judgements` 对象加 key（编译强制）+
  `QaContext` 加 `vdsPath`（`qa.ts:455`）+ `runBuild` 传 `vdsPath`（`create-game.ts:585-595`）。
- **join 键 = 实体 id**。
- **身份判据（硬失败，视觉族）** —— ⚠️ **票 02 的 Q1 已改本判据的语义**（2026-10-24）：identity 从「VDS `role` =
  GameConfig `kind` 精确对账」改成「**设计桶（`sourceIntent` 落桶）↔ GameConfig `kind` 家族兼容**」。
  理由：确定性布局的 `role` 是**视觉分组默认（猜的）**，不是身份断言；设计桶才是真值 —— wasteland 真夹具里
  `interactables` 一个桶既有 `chest` 又有 `hazard`，证明桶→EntityKind **不是 1:1**，而结构化字段里没有 kind 信号。
  join 键仍是实体 id：对每个 VDS 带 `sourceIntent` 的实体，查它在 GameDesignSpec 落哪个桶，再看它在 GameConfig 的
  `kind` 是否落在该桶允许的集合里。**允许集合（精确枚举，不是自然语言标签）**：
  | 设计桶 | 允许的 EntityKind |
  |---|---|
  | `enemies` | `{hazard, danger}` |
  | `npcs` | `{decor}` |
  | `interactables` | `{chest, pickup, goal, hazard, danger, solid}`（= EntityKind 除 `decor`；`decor` = 丢交互 = 串桶） |
  | `resources` | `{pickup}` |
  | `player` | —（GameConfig 里是顶层字段、非 entity，**不进 role↔kind 对账**；覆盖走票 04） |
  允许集合外的 kind = 串桶硬失败；+ VDS 有 `sourceIntent` 的实体在 GameConfig **缺失** = 硬失败。
  判法沿用 `intent-coverage.ts` 的中性函数模式（只返回「哪几项越界」，措辞由本票渲染）。
- **几何观察（只报、不阻断）**：只比尺寸 w/h（VDS `bounds` vs GameConfig 几何），**无阈值**，措辞描述性
  （**不许暗示「错」**，`QAFinding` 走 `warning` 而非 `error`）。
- **无 `sourceIntent` 的纯装饰**不进覆盖分母（与票 02/04 对齐）。

**测试**（TDD）：同 id 角色一致/不一致（串桶）各一条；`sourceIntent` 缺失判据；几何漂移只出观察不出判据；
`assertQaPassed`（`create-game.ts:226`）自动把第 7 条未查判据当阻断。
