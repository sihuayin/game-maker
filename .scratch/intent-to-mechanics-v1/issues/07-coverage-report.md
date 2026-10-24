# 07. 意图覆盖报告：per-mechanic 矩阵（设计/运行时/QA 三层）

Type: grilling
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 01
Map: ../map.md

## Question

意图覆盖报告（文档 FR-07）的 per-mechanic 矩阵放哪、什么形状：是扩 `intent-coverage.ts`（现只返回缺失项），还是
新契约？三层「设计覆盖 / 运行时覆盖 / QA 覆盖」分别由什么填（`auditIntentCoverage` / 见证 / probe），以及如何保证
「单个必需机制失败不被总体通过掩盖」（FR-07 末）。

## 现状（E1）

- `auditIntentCoverage` 只返回缺失项（空数组 = 覆盖成立），无 per-mechanic satisfied/missing 矩阵。
- `QA_JUDGEMENTS` 是 6 条封闭判据；`pixel.ts:56` 明确「不加第 7 判据」的既有政策。

## 建议

**新契约（或扩 `intent-coverage.ts`）产 per-mechanic 结果**，状态枚举 `satisfied / missing / unsupported /
not-tested / failed`，三层分别由「设计覆盖（R12/`auditIntentCoverage`）+ 运行时覆盖（见证/probe）+ QA 覆盖」填充；
**不做成第 7 判据**（避免打破 6 判据 + `pixel.ts` 政策），做**独立报告 + 门禁**（[票 08](08-gate-placement.md) 消费）。
承载实现：覆盖报告契约 + 生成器 + 与 R12/probe 的接线。

## Answer

**裁定（2026-10-23）** —— 新契约 `mechanic-coverage.ts`（`mechanic-coverage/v1`），不做第 7 判据。全仓 **1846 测试全绿**。

- **形状**：`{ format, mechanics[], verdict }`；`mechanics[]` 每条 `{ mechanic, design, runtime, qa }`，三层状态合并成一个
  封闭枚举 `satisfied / missing / unsupported / not-tested / failed`（FR-07 末的五态）。
- **三层填充来源**：
  - `design` = `deriveMechanicStatus`（**机制状态**，R12 `mechanic-experimental` 那条硬约束的结果）；
  - `runtime` = `RUNTIME_IMPLEMENTED_MECHANICS`（**运行时实现见证**）；
  - `qa` = `QA_PROBED_MECHANICS`（**行为级 probe**，词表转录，`mechanic-probe.mjs` 自证同源）。
- **门禁语义**：`missing / unsupported / failed` 阻断，**`not-tested` 不阻断**（基线机制靠 witness + 既有金字塔盖住，
  不是「查漏了」）。`verdict` = 「无阻断」不是「大多数」—— 单条失败不被总体掩盖。
- **输入只有 `design`**：报告活在门禁那一环（QA 之后），那时 R12 已保证「意图 ⊆ 设计」，缺机制是 R12 的事。

`mechanicCoverageProblem(report)` 逐格点名给 [票 08](08-gate-placement.md) 消费。

