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
- **身份判据（硬失败，视觉族）**：同一实体 id 的 VDS `role` ↔ GameConfig `kind` 不一致（串桶式错误）+ VDS 有
  `sourceIntent` 的实体在 GameConfig 里**缺失** —— 都硬失败，落视觉族。判法沿用 `意图覆盖`/`串桶`
  （`contracts/intent-coverage.ts`）的中性函数模式（判据代码接缝由本票确认）。
- **几何观察（只报、不阻断）**：只比尺寸 w/h（VDS `bounds` vs GameConfig 几何），**无阈值**，措辞描述性
  （**不许暗示「错」**，`QAFinding` 走 `warning` 而非 `error`）。
- **无 `sourceIntent` 的纯装饰**不进覆盖分母（与票 02/04 对齐）。

**测试**（TDD）：同 id 角色一致/不一致（串桶）各一条；`sourceIntent` 缺失判据；几何漂移只出观察不出判据；
`assertQaPassed`（`create-game.ts:226`）自动把第 7 条未查判据当阻断。
