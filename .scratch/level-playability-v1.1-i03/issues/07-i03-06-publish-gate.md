# I03-06 publish-gate 消费规则

Type: grilling
Status: resolved
Owner: claude (I03-06 session 2026-11-14)
Blocked by: 01, 02, 03
Map: ../map.md
Class: I-03 / DECISION

## Question

I-03 第一阶段 `publish-gate` 如何消费 `coverage.temporal` / evidence 而**不改变拒稿行为**？未来何时、如何允许时序结果影响拒稿？

### 必须裁定

- 第一阶段：只增加 coverage / evidence，不改变 `auditPlayability` 拒稿规则；
- 模型内 `PROVEN_UNPLAYABLE` 不直接拒稿；`NO_PROVEN_BLOCKER` 不改放行；IE 如实暴露；
- 未来 gate 变更的四项要求（coverage 独立验证、能力准入、负向场景、独立复核 / 授权）；
- feature flag / rollout / rollback；
- 不改现有 `publish-gate` 断言，除非授权包另列。

### 禁止

- 第一阶段改变生产拒稿 / 放行；
- 把时序 IE 当安全结论；
- 未经授权修改 `publish-gate`。

### 验收

第一阶段消费规则、未来 gate 变更门槛、负向场景、回滚路径。

## Answer

（resolved 时填写）
**Q1=A / Q2=A / Q3=A / Q4=A / Q5=A / Q6=A / Q7=A / Q8=B / Q9=A / Q10=A / Q11=全部冻结。**
第一阶段发布闸只**记录**时序证据、不参与判定；现有拒稿行为、断言、CLI / MCP 输出全部不变。本票不授权生产实施。

### 0. 冻结结论

| 题 | 选择 | 结论 |
| --- | --- | --- |
| Q1 | A | 捕获并暴露为只读证据，不参与判定 |
| Q2 | A | 拒稿输入闭集：三项现有检查，无新增 `throw` 路径 |
| Q3 | A | publish-gate **不读** `PublicCapabilityGate`；gate 只在适配层消费 |
| Q4 | A | 第一阶段无运行时 feature flag；正常 release；revert-only rollback |
| Q5 | A | 未来拒稿变更四项同时满足 + 另开授权 effort；本票不构成 gate 变更授权 |
| Q6 | A | 未来默认关闭 + 能力 gate 作 kill switch + 基线失效三重回退 |
| Q7 | A | 现有 publish-gate 断言零改动 |
| Q8 | B | 暴露 I03-01 公共证据摘要，不透传内部 `TemporalAuditResult` |
| Q9 | A | 只在内存：不写 `qa-report.json`、不加 sidecar、不改 `qa-report/v1` |
| Q10 | A | 不打印、不升契约版本；字段是加法诊断，不属于发布契约 |
| Q11 | 全冻结 | G1–G11 负向矩阵 + 一条变异测试 |

### 1. 第一阶段消费语义（Q1 / Q8 / Q9 / Q10）

`assertPublishableQa` 保留 `runTemporalAudit` 调用，把结果经 I03-01 适配层映射为公共时序证据摘要，放进 `PublishGateResult` 的新增**只读诊断字段**：

```ts
/** 发布闸的时序诊断快照。⚠️ 不属于发布契约：形状可变、不参与放行 / 拒稿。 */
export type PublishGateTemporalEvidence =
  | { readonly applicable: false }
  | {
      readonly applicable: true;
      readonly coverage: TemporalCoverageState;   // "checked" | "partial" | "unknown"
      readonly verdict: PlayabilityVerdictState;  // 公共映射后的结果（gate BLOCKED ⇒ IE）
      readonly evidence: readonly PlayabilityEvidence[]; // 仅 kind: "temporal"
    };

export type PublishGateResult = {
  readonly report: QAReport;
  readonly reportPath: string;
  readonly manifest: AssetPackManifest;
  /** 诊断字段；未运行 config 检查时缺省。 */
  readonly temporal?: PublishGateTemporalEvidence;
};
```

- 形状取 I03-01 §1–§3：`coverage.temporal` 用 `TemporalCoverageState`，evidence 带 `model / lag / degradation / limits` 与 `kind:"temporal"` witness；**不透传**内部 `TemporalAuditResult` / `PermanentGateProof` / `Witness`。
- **不落盘**：不写 QA 报告、不加 sidecar、不改 `qa-report/v1`；持久化证据链仍在地图 Out of scope。
- **不打印**：CLI / MCP 的四个发布入口用户可见输出一字不变；字段只供程序化调用与测试。
- **不升契约版本**：字段加法、可选、标注 diagnostic；未来形状可变。它**不是**发布放行条件的一部分。
- **未运行 ≠ 不适用**：`configPath` 缺省 / config 解不开 ⇒ 字段缺省（未运行），不得读成 `{applicable:false}`，也不得当作任何证据。

### 2. 拒稿输入闭集（Q2 / Q3）

第一阶段 `assertPublishableQa` **只允许**从现有三项检查抛错：

1. `subjectProblem`（报告身份）；
2. `verdictProblem`（error / 六条没跑全）；
3. `configProblem` 中的硬失败：`playabilityIssues(auditPlayability(...)).filter(severity === "error")`。

不可违反的约束：

- **无新增 `throw` 路径**；时序证据不得产生 `CommandError`。
- `playabilityIssues` 语义不变：仅三层聚合为 `PROVEN_UNPLAYABLE` 时由阻断型 evidence 产 error；时序派生的 `PROVEN_UNPLAYABLE` **不进入**该函数。
- 时序证据不得变成 `ConfigIssue` / warning / error；`PLAYABILITY_TEMPORAL_EVIDENCE` 保持非阻断。
- 时序 IE **如实记录**在 §1 字段里，既不算通过也不算失败。
- 证据缺省按 `unknown` 记录；绝不当作 `checked` 或通过。
- `runTemporalAudit` 继续**同步**、**绝不抛**、**不得改变退出码**；捕获失败降级为 `unknown` / IE 记录，不能拒稿。
- publish-gate **不直接读取** `PublicCapabilityGate`；gate 状态只影响适配层把候选映射为公共 Verdict。第一阶段 gate 无论 `BLOCKED` / `OPEN`，发布闸行为不变。

### 3. 第一阶段 feature flag / rollout / rollback（Q4）

- **不引入运行时 feature flag**：改动非阻断、纯加法；flag 本身会多一条绕过路径与一种“状态组合”。
- rollout：走正常发布流程。
- rollback：回滚该提交即可；无数据迁移、无持久化痕迹。
- 若证据捕获本身失败：记录 `unknown` / IE，**不改变**发布结果。

### 4. 未来允许时序结果影响拒稿的门槛（Q5）

下列四项**必须同时满足**，缺一不可：

1. **coverage 独立验证**：对应关卡 `coverage.temporal = "checked"`，且所需几何分项由 I03-03 独立复核链确认 `checked`；适配层自报不算。
2. **能力准入**：对应 `PUBLIC_NB` / `PUBLIC_PU` gate 为 `OPEN`，且 I03-04 / I03-05 的证据准入通过；gate `BLOCKED` 或证据未准入 ⇒ 仍为 IE。
3. **负向场景**：G1–G11、NB / PU 的 false-positive 负例、19 关 IE 不回归全部通过。
4. **独立复核与授权**：复核人未参与实现 / probe / 夹具；用户显式签署**新的授权包 / ADR**。

追加冻结：

- 未来变更必须是**另开的授权 effort / 新授权包**，不得塞进 I-03 实施单元、不得由本票或 I-03 签署自动推导。
- 必须给出完整的 verdict → 闸门动作映射表。
- 新增拒稿**只能**来自「PU gate `OPEN` + 证据准入通过 + 时序 `PROVEN_UNPLAYABLE`」。
- `INSUFFICIENT_EVIDENCE` **永不拒稿**。
- NB 的 `NO_PROVEN_BLOCKER` **永不改变放行条件**。
- **本票不构成任何 gate 变更授权。**

### 5. 未来 rollout / rollback 机制（Q6）

- 拒稿变更默认**关闭**（release-level flag 或等价机制），打开前必须完成独立复核 + 用户显式授权。
- **能力 gate 就是 kill switch**：关闭 `PUBLIC_NB` / `PUBLIC_PU` 必须让拒稿行为**立即**回到第一阶段。
- 证据基线元组失效（I03-04 §6 / I03-05 §4）时同样立即回退，不得继续用旧 hash。
- 不允许只按关卡回滚而让全局能力继续开放。
- 重开需根因分析、修复、独立复核、用户显式授权。

### 6. 发布闸负向矩阵（Q11，交 I03-08）

| # | 场景 | 期望 |
| --- | --- | --- |
| G1 | 适用 + 时序 IE | 放行；证据记 IE |
| G2 | 适用 + `nb-candidate` + `gate.nb=BLOCKED` | 放行；公共映射 IE |
| G3 | 适用 + `pu-candidate` + `gate.pu=BLOCKED` | 放行；公共映射 IE |
| G4 | 适用 + `partial` / `unknown` | 放行 |
| G5 | 时序审计内部抛错 | 不抛；降级 IE / `unknown` 记录 |
| G6 | 未传 `configPath` | 跳过；字段缺省；行为不变 |
| G7 | 无移动 Hazard | `applicable:false`；零文件 I/O |
| G8 | 现有 `PROVEN_UNPLAYABLE` | 照旧拒稿（回归，不变） |
| G9 | QA 报告 error / 六条没跑全 | 照旧拒稿（回归，不变） |
| G10 | 未来 gate `OPEN` + 证据准入通过 | 第一阶段仍不改变拒稿 |
| G11 | 证据字段缺省 | 按 `unknown` 记录；绝不当作 `checked` 或通过 |

另加**变异测试**：任何让时序证据直接产生 `CommandError` / 改动退出码的实现，必须让测试失败。

### 7. 现有断言（Q7）

- 现有 `packages/pipeline/tests/publish-gate.test.ts` 与 `packages/pipeline/tests/create-game.test.ts` 的断言**一条不删、不放宽**。
- 新增覆盖只在 I03-08 写。
- 未来确需改动任何现有断言：逐文件、逐条列入 I03-07 白名单，并走 HITL。

### 8. 边界

- **全部进入 I-03 授权包**：I03-09 必须把 §1–§7 转录进 `docs/v7.8/移动-I03.md` 的发布门 / release gate / 回滚章节。
- **不授权生产实施**：本票未改 `publish-gate.ts` / `ops.ts` / `contracts`，也未改任何测试。
- **不开放 `PUBLIC_NB` / `PUBLIC_PU`**；两者仍 `BLOCKED`。
- **不改变现有拒稿行为**；I-02 的 `publicCapability="BLOCKED"` / `publicResult=null` 保持原样。
- 本票只覆盖 **publish-gate**；`create-game` 构建路径的 `runTemporalAudit` 仍保持“只接通、丢结果”，其证据暴露留给 I03-07 单元判断，不因本票自动扩大。

### 9. 下游

- **I03-07**：白名单至少覆盖 `packages/pipeline/src/publish-gate.ts`、`packages/assets/src/ops.ts`、`packages/contracts/src/playability/*`（公共 evidence 类型与适配层）；`runTemporalAudit` 如何产出完整摘要由单元定义，但同步 / 不抛 / 不改退出码的约束不得变。
- **I03-08**：把 G1–G11 + 变异测试写进验收矩阵；现有断言零改动。
- **I03-09**：转录 §1–§7；不得写成已实施。
- **I03-PU-Air-Control-Closure**：与本票独立；不受影响。
