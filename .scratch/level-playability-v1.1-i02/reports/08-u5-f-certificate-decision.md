# I-02 U5 增量裁定 08 — F（短暂安全窗口）的证书形状

| 项 | 值 |
| --- | --- |
| 记录类型 | 增量语义裁定（**独立记录**；不修改已签署授权包正文） |
| 裁定人 | **amber** |
| 日期 | **2026-11-13** |
| 触发 | U5-01 实现发现 D9 `PermanentGateProof` 类型与 D7 §305 / U5-04 票面的 F 断言冲突 |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未修改） |
| 结论 | **方案 ③：F 允许 `certificate.kind = "none"` + `insufficient-evidence` + `no-permanent-gate`**；不得伪造门区证明 |
| 范围 | **仅 F（门区不成立 / 短暂安全窗口）**；不改变 A–E、G–J 的断言，不改变 D9 其余字段，不授权公共能力 |

## 1. 冲突事实

- D9 §3 冻结的 `PermanentGateProof` 要求 `gate` / `periodCoverage` / `sideRule` / `forbiddenInjection` 全部存在，且 `periodCoverage.complete` 是字面量 `true`。
- U3 `computePermanentGate` 在门宽 `≤ ε`、y 区间不重叠、判侧失败或注入失败时，把四个半部全部置 `null`，不保留部分几何（U3-01 / R3 冻结）。
- 因此门区不成立时，组装层无法**如实**构造 `permanent-gate + INCOMPLETE` 证明。任何填充都会把不存在的永久门区包装成部分证明，违反 D9 §10 与「不得伪造」边界。
- 这与 D9 §9 F / D7 §305「E/F/G 不得压扁成 `none`」的字面要求冲突；该冲突已在 U5-01 / U5-02 / U5-03 证据中登记为待裁定缺口。

## 2. 可选方案

| 方案 | 内容 | 代价 |
| --- | --- | --- |
| ① | 修改 `temporal-gate.ts`，INCOMPLETE 时保留可如实记录的候选几何 / 子检查状态 | 需扩 U5-04 白名单；U3 输出形状变化；可能把无效门区误读为部分证明 |
| ② | 放宽 D9 `PermanentGateProof` 的必填 / `complete: true` 约束 | 需修订已冻结的 D9 契约；影响 I-03 消费边界 |
| ③ | **F 允许 `certificate.kind = "none"`** | 与 D7 §305 的字面表述不同，但保留 D9 证明完整性 |

## 3. 裁定（用户 2026-11-13）

用户选择 **方案 ③**，理由原文：

> 这条路径保留了 D9 的证明完整性，也避免把一个不存在的永久门区包装成部分证明。

### 3.1 F 的冻结结果形状

```text
internalResult = "insufficient-evidence"
certificate    = { kind: "none" }
diagnostics.degradationReason = "no-permanent-gate"
publicCapability = "BLOCKED"
publicResult     = null
```

- `certificate.kind = "none"` ⇒ 按 D9 §10.5 只能是 `insufficient-evidence`。
- 不得升级为 `pu-candidate`；不得伪造 `gate` / `periodCoverage` / `sideRule` / `forbiddenInjection`。
- `budgetStatus` 保持 `"complete"`（除非 F 路径同时命中预算原因；预算原因优先）。

### 3.2 不受影响的断言

- E（等待阶段碰撞）：仍允许 `witness + INCOMPLETE` **或** `none`（D9 §9 E 原文）。
- G（垂直规避）：门区 COMPLETE、图割 INCOMPLETE 时仍必须保留 `permanent-gate + INCOMPLETE` 部分证明；本裁定不适用于 G。
- A/B/C/D/H/I/J 不变。

## 4. 执行后果

1. **无需产品代码改动**：U5-01 的 `runPermanentGateProof` 已在门区半部 INCOMPLETE 时返回 `proof: null`，组装层输出 `certificate.kind = "none"`；现有测试 `[I02-03][AC-05] 门区不成立（无恒覆盖核心）⇒ IE + no-permanent-gate，不伪造证明` 已断言该行为。
2. **U5-04 票面更新**：F 的断言改为 `insufficient-evidence` + `no-permanent-gate` + `certificate.kind = "none"`；不再要求 `permanent-gate + INCOMPLETE`。
3. **U5-04 必须保留一条具名 F 测试**，并显式断言 `publicCapability = "BLOCKED"` / `publicResult = null`。
4. **最终审计（AC-12 / AC-13）** 以本记录为 F 的权威口径；完成报告必须写明该裁定与理由。

## 5. 记录性声明

1. **授权包原文 SHA 不变**：`docs/v7.8/移动-I02.md` = `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（本记录创建时现场复算，逐字符相同）。
2. **本记录不修改授权包**：只作为 U5 执行期的增量裁定；不触碰已签署正文、§15.2 首次签署范围表与台账原文。
3. **不授权公共能力**：`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 仍未接线；推送 / PR / 合并仍未授权。
4. **不扩权**：本裁定只处理 F 的证书形状；不授权修改 `temporal-gate.ts`、`temporal-result.ts`、D9 字段或 `DegradationReason` 闭集。
5. **可追溯**：U5-04 的 F 测试、U5-08 完成报告与最终审计必须引用本记录。
