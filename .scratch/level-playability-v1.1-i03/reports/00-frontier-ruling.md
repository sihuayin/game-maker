# I-03 地图前沿裁定

| 项 | 值 |
| --- | --- |
| 记录类型 | 新 effort charter / frontier ruling（**不是授权包**） |
| 裁定人 | **amber**（用户） |
| 日期 | **2026-11-13** |
| 指令 | 「开 I-03 新地图」 |
| 输入 | I-02 已签署授权包 + U5 完成报告 / 最终审计 PASS / U5-SIGN（i02 @ `2b57f2a`） |
| 结论 | **Q1=A / Q2=分阶段 / Q3=最小面 / Q4=A**；建图，停在授权包审查与签署，**不启动生产实施** |
| 本记录作用 | 冻结 I-03 地图的 destination、第一阶段范围与六条边界；不授予任何实施权限 |

## Q1 — Destination

**A：产出一份可签署的 I-03 实施授权包**，形式参照 [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md)。授权包至少包括：

- I-02 内部结果到公共证据的映射；
- 公共 Verdict 与 `coverage.temporal` 的语义；
- `PlayabilityEvidence.model / lag / degradation / limits` 的字段和来源；
- 发布门消费规则与 release gate；
- `PUBLIC_NB` / `PUBLIC_PU` 的准入条件；
- 验收矩阵、负向测试、回归要求；
- 实施单元拆分、依赖关系、复核点；
- Authorization Ledger、白名单、停止与回滚规则。

地图 Destination：**I-03 实施授权包完成、独立审查、用户签署，形成可单独启动实施 effort 的正式依据。**

**不在本图执行 `ops.ts`、`publish-gate` 等生产修改。** 实施必须另开 effort，并取得授权包规定的单元授权。

## Q2 — 公共能力范围（分阶段）

第一阶段围绕 `PUBLIC_NB` 建立接线与证据门槛；`PUBLIC_PU` 保持 `BLOCKED`。

必须区分三个状态：

1. **NB 接线完成**：生产链路能够消费内部 NB 候选及其 Witness。
2. **NB 证据准入通过**：几何可信度、时序覆盖、lag 语义、Witness 完整性等公共准入条件全部通过。
3. **`PUBLIC_NB` 开放**：只有第二项通过，并经过独立审查和授权，才允许发布公共 `NO_PROVEN_BLOCKER`。

**接线完成 ≠ 证据准入 ≠ 公共开放。** 当前 `coverage.geometry` 仍为 `partial`，Runtime hitbox 一致性尚未闭合；I-02 的模型条件性 NB 候选不得直接提升为公共 NB。I-03 授权包必须把几何证据补齐列为独立 gate。

`PUBLIC_PU` 继续 `BLOCKED`，至少需要独立解决：

- `coverage.geometry` 达到要求的 `checked` 状态；
- 空中控制及其他模型外规避得到健全性闭合；
- hop 图割与加倍采样的完整性；
- I-00 六项 PU 条件全部满足；
- 独立审查和增量授权。

`PUBLIC_NB` 与 `PUBLIC_PU` 是两条独立能力准入链，不得因为 NB 通过而推导 PU 可用。

## Q3 — 生产接线面（最小面）

第一阶段限定为：

| 模块 | 第一阶段范围 |
| --- | --- |
| `contracts` | 必要的 `coverage.temporal` 与 evidence 字段 |
| `assets/ops.ts` | 在取得授权后替换 `stubTemporalAnalyzer` |
| `pipeline/publish-gate` | 消费公共 coverage / evidence，但**不改变拒稿行为** |
| `mechanic.ts` / `api.ts` | 仅在确有必要时做最小聚合适配 |

**DEFERRED：**

- CLI / MCP 输出；
- Runtime 改造；
- 持久化证据链；
- 额外公共导出和不必要的 API 扩张；
- 与第一阶段无关的历史产物迁移。

**边界：** `mechanic.ts` / `api.ts` 虽可列为条件性适配文件，但**不能默认授权修改**。授权包必须逐文件列出允许修改的内容；若实际需要扩大白名单，先暂停并重新审批。

## Q4 — 时序结果对发布拒稿的影响（A：第一阶段非阻断）

I-03 第一阶段只增加 `coverage.temporal` 与 evidence 暴露，**不改变现有拒稿行为**。

- `PROVEN_UNPLAYABLE` 的模型内结果**不直接触发**生产拒稿。
- `NO_PROVEN_BLOCKER` **不直接改变**放行条件。
- `INSUFFICIENT_EVIDENCE` 必须如实暴露，不能转成安全结论。
- 现有 `auditPlayability` 的拒稿规则保持不变。

后续如果要让时序结果影响发布拒稿，必须另开 gate 变更审查，至少要求：

1. coverage 的语义和完整性经过独立验证；
2. 公共能力准入通过；
3. 负向场景证明不会把 IE 当作可玩或不可玩结论；
4. 独立复核和明确授权。

## 本轮冻结结果

- **Destination**：可签署的 I-03 实施授权包；实施另开 effort。
- **第一阶段能力**：`PUBLIC_NB` 的接线与准入规则进入授权包，实际公开仍受几何可信度等 gate 阻断；`PUBLIC_PU` 持续 `BLOCKED`。
- **生产改动**：最小面 `contracts` / `ops.ts` / `publish-gate`；`mechanic.ts` / `api.ts` 仅必要时、逐文件授权；CLI / MCP / Runtime / 持久化 DEFERRED。
- **发布行为**：第一阶段不改变拒稿行为，不把时序候选直接用于生产放行或拒稿。

## 建图时必须写入的 Notes

1. **`PUBLIC_NB` 接线完成 ≠ `PUBLIC_NB` 开放。**
2. **`PUBLIC_PU` 不属于第一阶段实施目标。**
3. I-02 的 `publicCapability=BLOCKED`、`publicResult=null` 保持原样；I-03 通过适配层消费内部结果，不回写或篡改 I-02 结果。
4. **`INSUFFICIENT_EVIDENCE` 必须保留为独立状态**，不能映射为 `NO_PROVEN_BLOCKER`。
5. **时序结果第一阶段不改变 `publish-gate` 的拒稿行为。**
6. **授权包签署只建立后续实施依据，不自动授权所有实施单元。**

## 记录性声明

- 本记录是 I-03 地图的 charter，不是授权包，不修改 I-02 原文 / U5 结果。
- 本记录不授权生产代码修改、`PUBLIC_NB` / `PUBLIC_PU` 开放、I-03 实施、推送 / PR / 合并。
- 地图完成后停在授权包审查与签署；实施必须另开 effort。
