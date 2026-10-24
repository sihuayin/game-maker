# 01. 机制能力注册表：扩 RuntimeProfile 还是另建 schema，`supported` 如何判定

Type: grilling
Status: resolved
Owner: main session · 2026-10-23
Blocked by: —
Map: ../map.md

## Question

「机制能力注册表」（文档 FR-01）的**形状**是：扩展现有 `packages/contracts/src/vocabulary.ts` 的 `MECHANICS` +
`RuntimeProfile`（给每机制加 `status: experimental | supported | deprecated`，及必要的关联元数据），还是另建一套
`MechanicCapability` schema（文档 §5.2 的 entities / triggers / stateChanges / configSchema / runtimeSupport /
qaProbes / status）？

以及：`status = supported` 是**手写声明**，还是由「设计表达 + GameConfig 表达 + Runtime 实现 + QA probe 四样齐全」
**推导/见证**（文档 AC-01 与风险一：「注册表与实际运行时能力不一致」必须被测试/构建检查防住）？

## 现状（E1，见 findings-codebase.md）

- 机制单一来源 `vocabulary.ts:34-51` `MECHANICS`；`RuntimeProfile` 仅 `{id, version, mechanics, capabilities}`
  （`runtime-profile.ts:84-94`），**无 status、无 per-mechanic 元数据**。
- 无任何「declared vs 实际实现」的机械核对：`moving-platform` 在 `MECHANICS`/config/reachability 里都在，
  但渲染器从不移动带 motion 的 solid（见 [票 09](09-moving-platform-marking.md)），今天无任何东西能测出这一点。
- 文档 §5.2 的 `MechanicCapability` 是**概念模型**，§5 末明写「优先复用现有 contracts 包」。

## 建议

**扩展现有、不另建**：给 `RuntimeProfile` 加 per-mechanic `status`（最小字段集），`status` **由见证推导**而非手写
——用一条 witness/覆盖检查证明「四样齐全」才算 `supported`，否则落到 `experimental`（正好让
[moving-platform](09-moving-platform-marking.md) 现形）。**不**引入文档 §5.2 的完整 `MechanicCapability`
（§10 风险二：不过度抽象）。承载实现：`vocabulary.ts` / `runtime-profile.ts` 的字段扩展 + 见证检查 + 测试。

## Answer

**裁定（2026-10-23 · 用户逐字）**

| 问题 | 裁定 |
|---|---|
| Q1 注册表形态 | (a) 最小账本 — `MECHANICS` 保持纯 ID 列表；注册表不复制机制细节 |
| Q2 supported 来源 | (a) 见证推导 + 阻断 — supported 由四项能力见证推导，不能手写宣称 |
| Q3 status 语义 | (a) 硬约束 — 设计引用非 supported 机制，R12 拒绝；物理闸位由 [票 08](08-gate-placement.md) 定 |

**落地含义**

1. `vocabulary.ts` 的 `MECHANICS` **不动**（纯 id，`z.enum(MECHANICS)` 派生照旧）；另加 per-mechanic `status`
   （experimental / supported / deprecated）。
2. **不建** `MechanicCapability`（§5.2 概念模型弃用）；机制契约细节留在 game-config.ts / world.ts / probe。
3. `status` **由见证推导**（四样齐全才算 `supported`），错误标 `supported` 在构建期失败；`deprecated` 是生命周期
   手标，不参与能力推导。
4. R12 **新增拒绝理由**（`mechanic-experimental`）：设计 `mechanics[]` 引用非 `supported` 机制即拒绝（硬约束）。
5. 实现切片 → 毕业成 [票 12](12-registry-witness-impl.md)。
