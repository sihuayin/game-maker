# 06. 行为级 QA Probe：机制驱动探针怎么做

Type: grilling
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 04, 05
Map: ../map.md

## Question

行为级 per-mechanic QA probe（文档 FR-06 / 风险三）怎么做：扩展现有 `packages/demo/probe/playable-smoke.mjs` 的
headless-Chrome 运行时状态探针为**机制驱动**（每机制一个场景，读运行时状态断言），还是另起新 harness？
probe 结果如何关联 `requirementId` / `mechanicId`（FR-06 末）？

## 现状（E1）

- 玩法 QA 纯静态（`qa/src/gameplay.ts:77-81`，`auditReferences` + `auditReachability`「不跑游戏」）。
- `playable-smoke.mjs` **已有** headless Chrome CDP 运行时状态探针（player x/y/onFloor、collected、won、pickups[]、
  hazards[]、gate、solids、scrollX）+ 截图 + console 错误 + trace，但**写死** v7 fixture，非机制驱动。

## 建议

**复用 playable-smoke 的状态探针，抽成机制驱动的 probe**：每机制声明其运行时断言（如 open-chest：进入范围 →
状态 open → 奖励 +1 → 再进不重复 → 范围外无效），probe 读运行时状态逐条验证；静态覆盖仍由 `intent-coverage` 承担，
行为验证由 probe 承担（两者**不混**，呼应 CONTEXT.md「观察 ≠ 判据」的纪律）。承载实现：probe 机制化 + 每机制场景 +
结果关联 `mechanicId`。

## Answer

**裁定（2026-10-23 · 用户逐字）**：

- **Q1 harness = (a) 扩展 playable-smoke**：复用 headless-Chrome CDP 运行时状态探针，机制化成「每机制一个场景 + 运行时断言」。
- **Q2 = (a) probe 独立 QA 覆盖层**：**不进** `supported` 状态推导（[票 12](12-registry-witness-impl.md) 的 `deriveMechanicStatus` 不变）；「必须有通过的 probe」由 gate（[票 08](08-gate-placement.md)）强制。

**落定**：

1. probe = 覆盖报告的「QA 层」；`status` 仍是「运行时层」（runtime 实现 → supported/experimental）。
2. 一个 probe = `{ mechanicId, config 夹具, 驱动脚本, 运行时断言 }`，断言读 playable-smoke 的 CDP 状态。
3. 具体 open-chest / avoid-danger 场景脚本要等 [票 13](13-open-chest-impl.md) / [票 14](14-avoid-danger-impl.md) 落地后写。

实现切片 → 毕业成 [票 15](15-probe-harness.md)。
