# I03-IMPL-02 U1 执行 brief

Type: grilling
Status: resolved
Owner: claude (I03-IMPL-02 session 2026-11-15)
Blocked by: 01
Map: ../map.md
Class: I-03-IMPL / U1

## Question

为 **U1（contracts 公共证据类型 + 适配器）** 产出一份可交接的执行 brief，至少覆盖：

- 授权包 §11.2 的 U1 逐文件白名单与禁止扩张；
- 适配器输入 / 输出形状、`coverage.temporal` 规则、13 个公共 degradation 值、`perLag` 两档、`limits` 字段；
- 测试名与断言（AC-01–AC-04；P1–P4 / N1–N6 的映射）；
- 独立复核输入、E1 / E2 / E3、修改前后不变量快照；
- 回滚目标（文档化）与 STOP 触发；
- **明确：本 brief 不写代码**；执行由未来 U1 执行会话在独立 branch / PR 完成。

## Answer

**Q1–Q6 = A；Q3 依赖前置检查 PASS；Q4 真实 analyzer smoke 移交 U4。** 本 brief 是 U1 的规划，**不构成 U1 实施授权**。

### 0. 依赖前置检查（Q3）

- `TemporalTwoLagInternalResult` → `packages/contracts/src/playability/temporal.ts:940`（contracts）。
- `TemporalInternalResult` → `packages/contracts/src/playability/temporal-result.ts:41`（contracts）。
- `packages/assets/src` 无 `TemporalTwoLagInternalResult` 定义 / 引用；`packages/contracts` 不依赖 assets。
- 依赖方向：`geometry ← verdict ← temporal ← temporal-evidence`；`verdict.ts` 保持叶子（只 import `geometry.js`）。
- 证据：[`reports/U1-dependency-check.md`](../reports/U1-dependency-check.md) · `sha256:825924af8b106418e112a84c386326663771e1cfc1aa55b8d1fc0e423f105936`。
- **PASS**；不需要复制类型 / 新建共享类型文件 / 增加依赖 / 扩大白名单。若实施时事实变化 ⇒ **STOP + HITL**。

### 1. Scope / non-goals

**Scope**：contracts 公共 temporal 类型 + 纯适配器 + 指定测试。

**Non-goals**：公共 Verdict 映射（U2）；`ops.ts` 生产接线（U4）；`publish-gate`（U5）；`mechanic.ts` gap（U3）；几何 probe / PU 条件 2/5；`PUBLIC_NB` / `PUBLIC_PU` 开放；任何白名单外文件。

**No-code**：本 brief 不写代码；执行由未来 U1 会话在独立 branch / PR 完成，先取得 U1 增量授权。

### 2. Allowed files（授权包 §11.2 U1）

| 文件 | 操作 | 限定目的 |
| --- | --- | --- |
| `packages/contracts/src/playability/verdict.ts` | 修改 | 公共 temporal 类型 + coverage / witness / evidence 加法字段 |
| `packages/contracts/src/playability/temporal-evidence.ts` | 新增 | 纯适配器 |
| `packages/contracts/src/playability/api.ts` | 修改 | 公共类型 / 适配器导出 + U4 所需 internal 入口 |
| `packages/contracts/tests/playability-api.test.ts` | 修改 | U1 API / 非时序回归 |
| `packages/contracts/tests/playability-temporal-evidence.test.ts` | 新增 | 适配器矩阵 |

- 只读 import：`temporal.ts` / `temporal-result.ts` / `geometry.ts`；**不修改 `temporal.ts`**。
- 禁止：assets / pipeline / demo / cli / mcp / scripts / docs / fixtures / 新依赖 / 白名单外文件。

### 3. 公共类型（Q1 / Q3）

在 `verdict.ts` 增加：

- `TemporalCoverageState = "checked" | "partial" | "unknown"`；
- `PlayabilityCoverage.temporal?` / `.geometry?`；
- `PublicTemporalDegradation`（13 值）；
- `PublicGeometryCoverage`、`PublicPuCondition`；
- `TemporalModelEvidence`、`TemporalLagConclusion`、`TemporalLagEvidence`、`TemporalDegradationEvidence`、`TemporalLimitsEvidence`；
- `PlayabilityWitness` 的 `kind:"temporal"` 变体；
- `PlayabilityEvidence.model? / lag? / degradation? / limits?`。

约束：

- 只有 temporal evidence 设置四个字段；非时序 evidence 保持原结构，**不添加值为 `undefined` 的字段**。
- `api.ts` 统一 re-export；不引入第二套 summary 类型。
- `verdict.ts` 保持叶子；`temporal-evidence.ts` import `temporal.ts` / `temporal-result.ts` / `verdict.ts`；无循环。

### 4. 适配器（Q2）

```ts
export function toPublicTemporalEvidence(args: {
  readonly twoLag: TemporalTwoLagInternalResult;
  readonly firstLagMs: number;
  readonly secondLagMs: number;
  readonly existingCoverage: PlayabilityCoverage;
  readonly assetId?: string;
}): PlayabilityEvidence
```

行为：

- 纯函数；不修改 `twoLag` / `existingCoverage`；输出新对象 / 新数组，不通过共享可变引用改输入。
- `firstLagMs` / `secondLagMs` 必须有限且非负；无效 ⇒ `RangeError`（显式失败，不生成公共 evidence；U4 在既有 try/catch 内调用，捕获后降级 IE；U1 测试断言 throw）。
- `assetId` 仅在非空字符串时输出；不伪造默认值。
- 未知内部 D9 码 ⇒ `invalid-input`；公共输出不出现原始 D9 字符串。
- `secondary` 去重 + 字典序。
- `COMPLETE` ⇒ `degradation.reason = null`、`secondary = []`；`INCOMPLETE` ⇒ 至少一个非 null 原因。
- `perLag` 恰好 `[first, second]`；每项含 `lagMs` / `internalResult` / `certificateKind` / `certificateStatus` / `degradation`；不含 Witness / proof / stats。
- `coverage = { ...existingCoverage, temporal, geometry }`；不重算 / 不篡改原有三维。
- `model`：`conditional:true`；三份 `PublicGeometryCoverage` 固定 `{chain:"manifest+atlas-metadata", runtimeBody:"unverified", coverage:"partial"}`；`movementModelClosure:"not-proven-air-control"`；`puConditions` 仅在 `combined.certificate.kind==="permanent-gate"` 时映射；`witness` / `none` 省略。
- `lag`：`mode:"gate-independent; witness-only"`、`invariantByConstruction:true`、`perLag`。
- `degradation`：从 `combined.diagnostics` 映射；`secondary` 去重排序。
- `limits`：从 `combined.stats.budget` / `combined.stats.work` / `budgetProfile`；`hopSamplesChecked` 如实取 0；不冒充 `maxHopSamples`；`geometryCoverage:"partial"`。
- `witness`：`kind:"temporal"`、`result`、`certificateKind`、`certificateStatus`、`degradation`；`certificate.kind==="none"` ⇒ `certificateStatus:"INCOMPLETE"`。
- `judgmentId:"PLAYABILITY_TEMPORAL_EVIDENCE"`、`target:"objective.gate"`、`detail` 人话且不含原始 D9 码。

`coverage.temporal` 算法：

- `unknown`：`combined` 或任一档的公共主因 ∈ {`invalid-input`, `model-out`, `geometry-untrusted`}，或没有可消费结果；不适用由 U4 在调用前处理（不调用适配器）。
- `checked`：两档 `budgetStatus==="complete"` 且无上述 unknown 主因；`lag-disagreement` **不**降级 coverage。
- `partial`：其余（分析开始、输入 / 模型检查通过，但一档 / 两档因预算 / 墙钟 / Witness 体积不完整）。
- `coverage.temporal="checked"` **不**推出 geometry checked / 公共 NB。

`coverage.geometry`：三份 `model.geometryCoverage` 汇总（全 checked ⇒ checked；全 not-checked ⇒ not-checked；否则 partial）；I-02 内部恒 partial ⇒ 公共 summary `"partial"`。

`api.ts` 导出：

- 公共 temporal 类型 + `toPublicTemporalEvidence`；
- `analyzeTemporalInternalTwoLag` + `TemporalTwoLagInternalResult` 加入既有 `@internal` 导出块（U4 从 `@game-maker/contracts` 导入；不扩 U4 白名单）；
- 不导出内部 `Witness` / `PermanentGateProof` / `Stats`。

### 5. Commit slices（Q6）

1. **类型**：`verdict.ts` + `api.ts` re-export；typecheck。
2. **适配器**：`temporal-evidence.ts` + `playability-temporal-evidence.test.ts` 映射矩阵。
3. **回归**：`playability-api.test.ts` 加法 / 非时序兼容 + `evidence/U1/`；**不含真实 analyzer smoke**。

`.scratch` 证据是审计材料，**不默认混入产品代码 commit**；若进入 PR / Ledger，按证据归档规则另处理。

### 6. Tests（Q4）

`playability-temporal-evidence.test.ts`（synthetic **完整真实契约形状** fixture，不用 partial mock）：

- 20 个 D9 code → 13 个公共值完整覆盖；
- `secondary` 去重 / 字典序；
- `COMPLETE` ⇒ null / []；`INCOMPLETE` ⇒ 至少一个原因；
- `coverage.temporal` checked / partial / unknown；含“两档 complete 但 `lag-disagreement`”仍 checked 的边界；
- `perLag` 恰好两项、顺序、`lagMs`、字段排除；
- `limits` 字段、`hopSamplesChecked=0`、不冒充 `maxHopSamples`；
- P1–P4；§3.7 N1–N6；
- 未知码 ⇒ `invalid-input`；公共输出不泄漏原始 D9；
- 输入不可变（`twoLag` / `existingCoverage`）；
- `assetId` 有 / 无；
- geometry 汇总 `"partial"`；
- `certificate.kind==="none"` ⇒ `INCOMPLETE`；
- invalid lag ⇒ `RangeError`。

`playability-api.test.ts`：

- 现有 `auditPlayability` / `playabilityIssues` 行为不变；
- 新增类型 / 适配器导出可用；
- 非时序 evidence 不带 `model/lag/degradation/limits`。

**真实 analyzer smoke 不在 U1**：移交 U4，作为 U4 必需验收项；U4 必须证明 `analyzeTemporalInternalTwoLag` 的真实结果可被 U1 adapter 直接消费，不得用测试专用转换层掩盖类型 / 字段漂移。

### 7. 证据 / 不变量 / 复核 / 回滚（Q5）

- 证据：`evidence/U1/`（`commands.log`、`test-output.txt`、`invariant-before.txt`、`invariant-after.txt` + SHA-256）。
- 不变量：`publicCapability="BLOCKED"`、`publicResult=null`、`auditPlayability` / `playabilityIssues` 基线；修改前后都保存。
- 复核输入：`reports/U1-review-input.md`；复核报告：`reports/U1-review.md`；fresh 独立会话；逐项 `PASS / FAIL / NOT_RUN`；至少 2 条自选关键断言。
- 回滚：记录 U1 分支切出时的 `main` SHA + 精确命令；不做演练。
- `.scratch` 证据是交付审计材料，不默认混入产品代码提交。

### 8. STOP

- **最重要**：若 `TemporalTwoLagInternalResult` 不在 contracts 合法依赖范围 ⇒ STOP；不得复制类型 / 增加依赖 / 修改白名单 / 临时桥接；提交依赖证据并请求裁定。（本次检查 **PASS**。）
- 任何白名单外文件、新依赖、`temporal.ts` 修改、跨包依赖、gate / 能力 / 基线变化、公共 Verdict、`publicCapability` / `publicResult` 变化、在 U1 内实现真实 analyzer smoke ⇒ STOP + HITL。
- 授权包 §11.3 的 12 条 STOP 全部适用。

### 9. 授权边界

本 brief **不构成 U1 实施授权**。执行前必须：

1. 用户签署 `reports/U1-incremental-authorization.md`（协议 §2）；
2. 授权 docs PR 合入 `main`；
3. 从更新后的 `main` 切 U1 分支；
4. 独立复核 PASS + 用户签署 + Ledger 更新。

`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；不产公共 Verdict；`publicCapability` / `publicResult` 不变。

### 10. U1 最终执行边界

| 项目 | 裁定 |
| --- | --- |
| 实施范围 | contracts 公共 temporal 类型、纯适配器、指定测试 |
| 类型依赖 | 前置检查 PASS：`TemporalTwoLagInternalResult` 在 contracts `temporal.ts:940` |
| 测试 | 完整 synthetic 矩阵 + API 回归 |
| 真实 analyzer smoke | 移交 U4，不在 U1 引入跨包依赖 |
| 提交 | 3 个逻辑切片 |
| 证据 | U1 独立目录，保存修改前后不变量 |
| 复核 | 独立新会话，逐项 PASS / FAIL / NOT_RUN |
| 回滚 | 记录目标 SHA 和命令，不演练 |
| 授权 | U1 独立授权记录、授权文档 PR 合并 main 后，才可切出 U1 分支 |
