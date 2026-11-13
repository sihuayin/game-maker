# I03-02 公共 Verdict 与 coverage 语义

Type: grilling
Status: resolved
Owner: claude (I03-02 session 2026-11-13)
Blocked by: 01, 02
Map: ../map.md
Class: I-03 / DECISION

## Question

I-03 适配层如何把内部结果映射为公共 `PlayabilityVerdictState` 与 `coverage`？在 `PUBLIC_NB` / `PUBLIC_PU` 未准入前，公共 Verdict 应如何保持 IE / 不发布？

### 必须裁定

- `nb-candidate` 在公共层是什么？（不得直接 `NO_PROVEN_BLOCKER`，除非 NB 证据准入通过）
- `pu-candidate` 在公共层是什么？（`PUBLIC_PU` 为 `BLOCKED` 时不得 `PROVEN_UNPLAYABLE`）
- `insufficient-evidence` 如何保持独立，绝不映射为 `NO_PROVEN_BLOCKER`；
- `coverage.temporal` 如何参与整关 aggregate；`partial` 是否拉低整关 verdict；
- 现有 `auditPlayability` 的三层聚合与 `playabilityIssues` 拒稿规则是否原样保留；
- 公共 Verdict 与内部结果的双层状态如何并存；
- **不得用接线完成替代证据准入**。

### 禁止

- 在准入前发布公共 `NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE`；
- 把 IE 转成安全结论；
- 未经授权修改 `verdict.ts` / `api.ts` 的公共语义。

### 验收

公共 Verdict / coverage 状态表、聚合规则、IE 不变量、与现有三层的关系、负向场景。

## Answer

**Q1=A / Q2=A / Q3=A / Q4=A / Q5=A。** 全部进入 I-03 授权包；**仍不授权生产实施、不开放 `PUBLIC_NB` / `PUBLIC_PU`、不改变现有发布拒稿行为。**

> 本票只冻结公共 Verdict / coverage 语义与聚合规则；`mechanic.ts` / `api.ts` 的实际修改、`docs/v7.8/移动-I03.md` 的组装、准入与发布门均留给后续票 / 实施 effort。

### 0. 冻结结论

| 题 | 选择 | 结论 |
| --- | --- | --- |
| Q1 | A | **能力门控**：`PUBLIC_NB` / `PUBLIC_PU` 未开放时，内部 `nb-candidate` / `pu-candidate` 一律映射为 `INSUFFICIENT_EVIDENCE` |
| Q2 | A | **替换** `moving-hazard-phase` gap：含移动 Hazard 时由 temporal 层给出 `coverage.temporal` + evidence；第一阶段仍 IE |
| Q3 | A | **适用即约束**：无移动 Hazard ⇒ `temporal` 缺省、不影响 verdict；适用时 `partial/unknown/checked 但未准入` ⇒ 整关 IE |
| Q4 | A | 保留现有三层优先；temporal 只加 IE；`PROVEN_UNPLAYABLE` 只在 `PUBLIC_PU` 准入后才可能由 temporal 贡献 |
| Q5 | A | 公共 evidence 保留候选名；`PLAYABILITY_TEMPORAL_EVIDENCE` 非阻断；`playabilityIssues` 映射不变 |

### 1. 公共能力门控（内部输入，不是公共字段）

```ts
/** @internal 只由 I-03 准入机制设置；第一阶段两项都 BLOCKED。 */
export type PublicCapabilityGate = {
  readonly nb: "BLOCKED" | "OPEN";
  readonly pu: "BLOCKED" | "OPEN";
};
```

- 第一阶段：`{ nb: "BLOCKED", pu: "BLOCKED" }` 硬编码；不允许按关卡配置，不进入 `GameConfig` / profile / 公共 API。
- 门控状态**不从 evidence 推断**：不能因为 `coverage.temporal="checked"` 或 `certificate COMPLETE` 就把 gate 当成 OPEN。
- `gate = OPEN` 只由 I03-04 / I03-05 的准入链设置；本票不实现开启逻辑。

### 2. 公共 Verdict 映射表

记 `existing` = 现有 `auditPlayability` 三层聚合结果；`temporal` = 时序适配层。

| 条件 | 公共 Verdict |
| --- | --- |
| `existing = PROVEN_UNPLAYABLE` | **`PROVEN_UNPLAYABLE`**（现有 PU 不被 temporal 削弱） |
| `existing = INSUFFICIENT_EVIDENCE` | **`INSUFFICIENT_EVIDENCE`**（现有 IE 优先于 temporal） |
| 无移动 Hazard（`temporal` 不适用） | **`existing`**（`coverage.temporal` 缺省） |
| 有移动 Hazard，`coverage.temporal` 缺失 | 按 `unknown` 处理 ⇒ **IE**（防御性；适配器必须设置字段） |
| 有移动 Hazard，`coverage.temporal = partial / unknown` | **IE** |
| 有移动 Hazard，`checked` + 内部 `insufficient-evidence` | **IE** |
| 有移动 Hazard，`checked` + `nb-candidate`，`gate.nb = BLOCKED` | **IE** |
| 有移动 Hazard，`checked` + `nb-candidate`，`gate.nb = OPEN` 且证据准入通过 | **`NO_PROVEN_BLOCKER`** |
| 有移动 Hazard，`checked` + `pu-candidate`，`gate.pu = BLOCKED` | **IE** |
| 有移动 Hazard，`checked` + `pu-candidate`，`gate.pu = OPEN` 且证据准入通过 | **`PROVEN_UNPLAYABLE`** |

> **`gate = OPEN` 不是发布充分条件。** 它只表示能力准入链已获准；I03-04 / I03-05 的
> **证据准入**仍必须通过。gate OPEN 但证据准入未通过 ⇒ **IE**，不得发布公共 NB / PU。

**优先级（Q4）：**

```text
existing PROVEN_UNPLAYABLE
  > existing INSUFFICIENT_EVIDENCE
  > temporal 适用导致的 IE
  > NO_PROVEN_BLOCKER
```

- temporal **不能**把现有 `PROVEN_UNPLAYABLE` 改成更弱结论。
- temporal **不能**把现有 `INSUFFICIENT_EVIDENCE` 改成 `NO_PROVEN_BLOCKER`。
- temporal 只有在 `existing = NO_PROVEN_BLOCKER` 时才可能产生 `NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE`（后者需 `gate.pu = OPEN`）。
- **冲突规则**：`existing = PROVEN_UNPLAYABLE` 且 temporal 给出 `nb-candidate`/`pu-candidate` 且对应 gate `OPEN` ⇒ **STOP + HITL**；不得静默择一。第一阶段 gate 全 BLOCKED，不触发。

### 3. `coverage.temporal` 聚合规则

- 适用性由 `temporalScope(config).applicable` 决定；**字段缺省**表示“不适用”，不参与 verdict。
- 适用时适配器必须设置 `coverage.temporal`；缺失按 `unknown` 处理 ⇒ 在 `existing = NO_PROVEN_BLOCKER` 时拉成 IE。
- `checked` 只表示输入 / 模型检查完成（I03-01 §3）；**不**表示 geometry `checked`，也**不**表示公共 NB / PU 准入。
- `partial` / `unknown` 一律不得聚合为 `NO_PROVEN_BLOCKER`（I-00 §8.5）。
- `coverage.spatial / mechanic / completion` 的既有行为不变；temporal 是加法字段。

### 4. `moving-hazard-phase` gap 的替换（Q2）

第一阶段**授权包**规定（实施留给未来 effort）：

- `auditMechanic` 不再因“存在移动 Hazard”而加 `moving-hazard-phase` gap；
- 移动 Hazard 的不确定性由 temporal 层的 `coverage.temporal` + evidence 承载；
- `coverage.mechanic` 不再因该 gap 被置 `partial`；其余静止 Hazard / frame 几何导致的 `partial` 保持不变；
- 聚合按 §2 / §3 处理；第一阶段 `gate.nb/pu = BLOCKED` ⇒ 含移动 Hazard 的关卡仍是 **IE**，拒稿行为不变；
- `mechanic.ts` / `api.ts` 的修改必须逐文件列入 I03-07 白名单；受影响的既有测试（`moving-hazard-phase` gap 断言）必须在 I03-08 明确列出，**不得删除或放宽**既有安全断言，只能按新语义改写并保留负向覆盖。

> 本票不修改 `mechanic.ts` / `api.ts`；这是未来实施单元的授权边界。

### 5. `playabilityIssues` 与非阻断（Q5）

- `judgmentId = PLAYABILITY_TEMPORAL_EVIDENCE` 第一阶段**非阻断**：不产 `ConfigIssue`，不进入 `publish-gate` 拒稿。
- `playabilityIssues` 的既有映射不变：只有 `PROVEN_UNPLAYABLE` 的阻断型 evidence 产 error；temporal 候选名（`nb-candidate` / `pu-candidate`）不是公共 Verdict，不产 issue。
- 未来 `PUBLIC_PU` 准入若需要阻断型 temporal ID，必须另开 gate 变更审查（I03-05 / I03-06），不得由本票推导。

### 6. 负向场景与不变量

| # | 场景 | 期望 |
| --- | --- | --- |
| N1 | `nb-candidate` + `gate.nb=BLOCKED` | 公共 `INSUFFICIENT_EVIDENCE`，不是 `NO_PROVEN_BLOCKER` |
| N2 | `pu-candidate` + `gate.pu=BLOCKED` | 公共 `INSUFFICIENT_EVIDENCE`，不是 `PROVEN_UNPLAYABLE` |
| N3 | `coverage.temporal="checked"` 但 gate BLOCKED | 仍是 IE；不得因 checked 发布 NB |
| N4 | 无移动 Hazard，`coverage.temporal` 缺省 | 不拉 IE；沿用 existing verdict |
| N5 | 有移动 Hazard，`coverage.temporal` 缺省 | 按 `unknown` ⇒ IE（若 existing 不是 PU） |
| N6 | `coverage.temporal="partial/unknown"` + existing `NO_PROVEN_BLOCKER` | IE；不得聚合为 NB |
| N7 | existing `PROVEN_UNPLAYABLE` + temporal `nb-candidate`（gate OPEN） | STOP + HITL 冲突；不静默 PU |
| N8 | existing `INSUFFICIENT_EVIDENCE` + temporal `nb-candidate`（gate OPEN） | 保持 IE；temporal 不得覆盖既有 IE |
| N9 | temporal evidence 被映射为 `ConfigIssue` | 禁止；第一阶段非阻断 |
| N10 | `partial/unknown` 被写成 `checked`，或 `certificate INCOMPLETE` 无 degradation | 禁止；违反 I03-01 不变量 |

### 7. 边界

- **全部进入 I-03 授权包**：I03-09 必须把 §1–§6 转录进 `docs/v7.8/移动-I03.md` 的公共 Verdict / coverage / release gate / 准入章节。
- **不授权生产实施**：本票未改 `mechanic.ts` / `api.ts` / `verdict.ts` / `publish-gate`，也未改任何测试。
- **不开放 `PUBLIC_NB` / `PUBLIC_PU`**：第一阶段 gate 两项 BLOCKED；公共能力仍由 I03-04 / I03-05 独立准入。
- **不改变现有拒稿行为**：`playabilityIssues` / `publish-gate` 的拒稿规则不变；temporal evidence 非阻断。
- I-02 的 `publicCapability="BLOCKED"` / `publicResult=null` 保持原样；适配层只消费内部结果。

### 8. 下游

- **I03-03**：几何 / Runtime hitbox gate；`coverage.temporal="checked"` 不等于 geometry `checked`。
- **I03-04 / I03-05**：设置 `PublicCapabilityGate` 的准入链；只有它们能把 gate 从 BLOCKED 改为 OPEN。
- **I03-06**：`PLAYABILITY_TEMPORAL_EVIDENCE` 的非阻断消费规则与未来 gate 变更门槛。
- **I03-07**：逐文件白名单必须覆盖 `mechanic.ts` / `api.ts` 的最小聚合改动与受影响测试。
- **I03-08**：把 §2 / §3 / §6 的映射表与负向场景转成验收矩阵。
- **I03-09**：组装授权包；不得把本票的“未来实施规定”写成当前已实施。
