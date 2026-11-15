# I03-IMPL-03 U2 执行 brief

Type: grilling
Status: resolved
Owner: claude (I03-IMPL-03 session 2026-11-15)
Blocked by: 02
Map: ../map.md
Class: I-03-IMPL / U2

## Question

为 **U2（contracts 能力门 + 公共 Verdict 映射）** 产出一份可交接的执行 brief，至少覆盖：

- 授权包 §11.2 的 U2 逐文件白名单；`api.ts` 只改 U2 职责，且只能在 U1 独立复核通过并签署后修改；
- `PublicCapabilityGate` 硬编码 `BLOCKED`、`coverage.temporal` 聚合、Verdict 映射与优先级、冲突 STOP；
- 测试名与断言（AC-05–AC-09；V1–V10 / N1–N8）；
- 独立复核输入、证据、不变量快照；
- 回滚目标（文档化）与 STOP 触发；
- **明确：本 brief 不写代码**。

## Answer

**Q1–Q6 = A；Q7 = A（冲突异常覆盖 NB 与 PU 两种 candidate）。** 本 brief 是 U2 的规划，**不构成 U2 实施授权**。

### 1. Scope / non-goals / precondition

**Scope**：contracts 公共 Verdict mapper、内部 gate / admission、第一阶段常量、冲突异常、指定测试。

**Non-goals**：准入链实现（I03-04 / I03-05）；`runTemporalAudit` / `ops.ts`（U4）；`publish-gate`（U5）；`mechanic.ts` gap（U3）；几何 probe / PU 条件 2/5；`PUBLIC_NB` / `PUBLIC_PU` 开放；任何白名单外文件。

**Precondition**：U1 已完成、独立复核 PASS、用户签署、合并且 Ledger 更新。U2 才能修改 `api.ts`（授权包 §11.2 特别约束 1：`api.ts` 跨 U1/U2 不是一次性授权）。本 brief 不启动执行。

### 2. Allowed files（授权包 §11.2 U2）

| 文件 | 操作 | 限定目的 |
| --- | --- | --- |
| `packages/contracts/src/playability/public-verdict.ts` | 新增 | 能力门 + 公共 Verdict 映射 + 第一阶段常量 + 冲突异常 |
| `packages/contracts/src/playability/api.ts` | 修改 | U2 相关 `@internal` 导出；仅限 U2 职责 |
| `packages/contracts/tests/playability-public-verdict.test.ts` | 新增 | U2 映射 / 优先级 / 冲突 / 合并测试 |

- 只读 import：`verdict.ts`（叶子类型）；不 import `api.ts`。
- 禁止：`temporal.ts` / `temporal-result.ts` 修改；assets / pipeline / demo / cli / mcp / scripts / docs / fixtures / 新依赖 / 白名单外文件。

### 3. 类型与第一阶段常量（Q1 / Q4）

在 `public-verdict.ts`：

```ts
export type PublicCapabilityGate = {
  readonly nb: "BLOCKED" | "OPEN";
  readonly pu: "BLOCKED" | "OPEN";
};

export type CapabilityAdmission = {
  readonly nb: boolean;
  readonly pu: boolean;
};

export const PHASE1_CAPABILITY_GATE = {
  nb: "BLOCKED",
  pu: "BLOCKED",
} as const;

export const PHASE1_CAPABILITY_ADMISSION = {
  nb: false,
  pu: false,
} as const;

export type PublicVerdictInput = {
  readonly verdict: PlayabilityVerdictState;
  readonly evidence: readonly PlayabilityEvidence[];
  readonly coverage: PlayabilityCoverage;
};

export type PublicVerdictResult = PublicVerdictInput;
```

- `PublicVerdictInput` / `PublicVerdictResult` 只用 `verdict.ts` 叶子类型；**不 import `api.ts`**，避免 `api ↔ public-verdict` 环。
- `api.ts` 在既有 `@internal` 区块统一导出 `mapPublicVerdict` / 两个类型 / 两个常量 / `PublicVerdictConflictError`。
- `PlayabilityVerdict` 不增加 gate 字段；gate 不是公共字段，不进入 `GameConfig` / profile / 公共 API。
- mapper 的 `gate` / `admission` **必填**，不默认。U4 必须显式传第一阶段常量；测试显式传 synthetic 状态。

### 4. mapper 签名（Q2）

```ts
export function mapPublicVerdict(args: {
  readonly existing: PublicVerdictInput;
  readonly temporal:
    | { readonly applicable: false }
    | { readonly applicable: true; readonly evidence?: PlayabilityEvidence };
  readonly gate: PublicCapabilityGate;
  readonly admission: CapabilityAdmission;
}): PublicVerdictResult
```

**能力判断**：

```text
gate.nb === "OPEN" && admission.nb
gate.pu === "OPEN" && admission.pu
```

- NB / PU **独立**判断；`gate=OPEN` **不等于** admission 通过。
- 第一阶段 `BLOCKED / false`；即使 synthetic 输入 `OPEN`，admission 为 `false` 也不得开放对应能力。

### 5. Evidence 合并（Q2）

1. 先从 `existing.evidence` 移除旧的 `PLAYABILITY_TEMPORAL_EVIDENCE`。
2. `applicable && evidence` ⇒ 追加新 temporal evidence，且只追加一次。
3. `applicable && !evidence` ⇒ 不追加 temporal evidence。
4. `applicable:false` ⇒ 保留既有非时序 evidence，不产生 temporal 字段；**旧 temporal evidence 也必须移除**。
5. 整个过程不修改输入对象；输出新数组 / 新对象。

### 6. Coverage 合并（Q2）

| 输入情况 | temporal | geometry |
| --- | --- | --- |
| `applicable:false` | 不设置 | 不设置 |
| `applicable:true` 且有 evidence | 复制 evidence 的值（缺失按 `unknown`） | **仅复制 evidence 中已有值** |
| `applicable:true` 且无 evidence | `"unknown"` | **不设置** |

- 三维 coverage **始终**取 `existing.coverage`；不得被 temporal evidence 覆盖。
- 缺 temporal evidence 时，**不得**把 geometry 擅自改为 `"unknown"`，也**不得**沿用旧 temporal evidence 的 geometry。
- `coverage.temporal="checked"` 不推出 geometry checked / 公共 NB。

### 7. Verdict 映射（Q1 / Q3 / Q7）

记 `candidate` = temporal evidence 的 `witness.result`；`cov` = 合并后的 `coverage.temporal`。

| 条件 | 结果 |
| --- | --- |
| `existing = PROVEN_UNPLAYABLE` | `PROVEN_UNPLAYABLE`，除冲突分支外不被 temporal 削弱 |
| `existing = INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE`（优先于 temporal） |
| `applicable:false` | `existing`（不设 temporal / geometry） |
| `applicable:true`，`cov` 缺失 / `partial` / `unknown` | IE（若 existing 不是 PU / IE） |
| `cov = checked` + `candidate = insufficient-evidence` | IE |
| `cov = checked` + `nb-candidate`，NB gate/admission 未同时通过 | IE |
| `cov = checked` + `nb-candidate`，`gate.nb=OPEN && admission.nb` | `NO_PROVEN_BLOCKER` |
| `cov = checked` + `pu-candidate`，PU gate/admission 未同时通过 | IE |
| `cov = checked` + `pu-candidate`，`gate.pu=OPEN && admission.pu` | `PROVEN_UNPLAYABLE` |
| `existing = INSUFFICIENT_EVIDENCE` + candidate + 对应 gate/admission | 保持 IE |
| `existing = PROVEN_UNPLAYABLE` + candidate + 对应 gate/admission | **`PublicVerdictConflictError`** |

**冲突（Q7=A）**：

- 覆盖 **NB 与 PU 两种 candidate**：existing PU + candidate + 对应 `gate.X=OPEN` + `admission.X=true` ⇒ `PublicVerdictConflictError`。
- 若 gate OPEN 但 admission false ⇒ 不触发冲突；返回 existing PU（candidate 未获准入）。
- 第一阶段 `BLOCKED / false`，不可达。
- 异常摘要只用于诊断（existing verdict、candidate result、gate/admission、coverage.temporal）；**不得**携带未筛选的内部原始证据，**不得**泄漏内部 D9 degradation code。

### 8. 测试矩阵（Q5）

`playability-public-verdict.test.ts`（synthetic，不依赖 U4/U5 真实链路）：

- existing PU / IE 优先级；无移动 Hazard ⇒ existing 且无 temporal 字段；
- `applicable + 无 evidence` ⇒ `temporal:"unknown"` ⇒ IE；geometry 不设置；
- `partial` / `unknown` ⇒ IE；`checked` + 内部 IE ⇒ IE；
- NB：`gate.nb=BLOCKED` ⇒ IE；`OPEN + admission.nb=true` ⇒ `NO_PROVEN_BLOCKER`；`OPEN + admission.nb=false` ⇒ IE；
- PU：`gate.pu=BLOCKED` ⇒ IE；`OPEN + admission.pu=true` ⇒ `PROVEN_UNPLAYABLE`；`OPEN + admission.pu=false` ⇒ IE；
- **NB / PU admission 独立性**：NB 准入不使 PU 准入，反之亦然；
- **冲突 V7**：existing PU + NB candidate + `gate.nb=OPEN` + `admission.nb=true` ⇒ `PublicVerdictConflictError`；
- **冲突 PU 分支**：existing PU + PU candidate + `gate.pu=OPEN` + `admission.pu=true` ⇒ 同一异常；
- existing PU + candidate + `OPEN` + admission false ⇒ existing PU，不冲突；
- V1–V10、N1–N8；
- evidence 合并：旧 temporal evidence 移除；新 evidence 追加一次；`applicable:false` 也移除旧 temporal evidence；无重复；
- coverage：三维不被 evidence 覆盖；temporal / geometry 语义；不伪造 geometry unknown；不沿用旧 temporal geometry；
- 输入无 mutation；
- `playabilityIssues` 不变；temporal evidence 不直接阻断；
- 第一阶段常量冻结 / 类型导出；冲突摘要不含原始 D9。

### 9. 提交切片与 brief 形态（Q6）

1. `public-verdict.ts`：类型、第一阶段常量、mapper、`PublicVerdictConflictError`；`api.ts` 增加 `@internal` 导出。
2. `playability-public-verdict.test.ts`：完整 synthetic 矩阵。

brief 只写在本票 Answer；不另建 `reports/03-u2-brief.md`。

### 10. 证据 / 不变量 / 复核 / 回滚

- 证据：`evidence/U2/`（`commands.log`、`test-output.txt`、`invariant-before.txt`、`invariant-after.txt` + SHA-256）。
- 不变量：`publicCapability="BLOCKED"`、`publicResult=null`、`auditPlayability` / `playabilityIssues` 基线；gate 不进入公共字段。
- 复核输入：`reports/U2-review-input.md`；复核报告：`reports/U2-review.md`；fresh 独立会话；逐项 `PASS / FAIL / NOT_RUN`；至少 2 条自选关键断言。
- 回滚：记录 U2 分支切出时的 `main` SHA + 精确命令；U2 只文档化回滚，不做演练。
- `.scratch` 证据是审计材料，不默认混入产品代码提交。

### 11. STOP

- 授权包 §11.3 的 12 条 STOP 全部适用。
- 任何白名单外文件、新依赖、`temporal.ts` / `temporal-result.ts` 修改、`api.ts` 超出 U2 导出、gate 默认值 / `OPEN` 隐含 admission、公共 gate 字段、准入链实现、真实 U4/U5 链路依赖、冲突摘要泄漏原始 D9 ⇒ **STOP + HITL**。
- 若 U1 未完成签署 / 合并 / Ledger 更新 ⇒ 不得修改 `api.ts`，不得开始 U2。

### 12. 授权边界

本 brief **不构成 U2 实施授权**。执行前必须：

1. U1 完成独立复核 PASS + 用户签署 + 合并 + Ledger 更新；
2. 用户签署 `reports/U2-incremental-authorization.md`；
3. 授权 docs PR 合入 `main`；
4. 从更新后的 `main` 切 U2 分支；
5. 独立复核 PASS + 用户签署 + Ledger 更新。

`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；不产公共 NB / PU；`publicCapability` / `publicResult` 不变。

### 13. U2 最终执行边界

| 项目 | 裁定 |
| --- | --- |
| 实施范围 | public verdict mapper、内部 gate / admission、第一阶段常量、冲突异常 |
| 类型依赖 | 只依赖 `verdict.ts` 叶子类型，不 import `api.ts` |
| Gate | 必填，NB / PU 独立判断 |
| 第一阶段 | NB / PU 均 `BLOCKED` + `false` |
| 冲突 | **NB 或 PU candidate** + existing PU + 对应 gate OPEN + admission true ⇒ `PublicVerdictConflictError`（Q7=A） |
| Evidence | 替换旧 temporal evidence，不修改输入 |
| Coverage | 三维取 existing；temporal / geometry 按本次证据合并；缺证据不伪造 geometry |
| 测试 | 完整 synthetic 矩阵，不依赖 U4/U5 真实链路 |
| 提交 | 2 个逻辑切片 |
| Brief | 仅 U2 票 Answer |
| 回滚 | 沿用总协议：记录目标 SHA 与精确命令，不擅自扩大回滚演练范围 |

**三个不可妥协的实现约束**：

1. `gate=OPEN` 不等于 admission 通过。
2. `applicable=true` 不等于 evidence 已经存在。
3. 旧 temporal evidence 不能在本次不适用或缺证据时冒充当前证据。
