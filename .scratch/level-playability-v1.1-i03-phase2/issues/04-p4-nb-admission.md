# P4 · NB admission machinery brief

Type: grilling
Status: resolved
Owner: claude (P4 session 2026-11-17)
Blocked by: 02
Map: ../map.md
Class: I-03-Phase2 / P4

## Question

为 P4 产出一份可交接的执行 brief：如何实现 NB 十项准入规则、固定 synthetic 夹具、正负路径与 `ADMITTED` 判定，使 gate `BLOCKED` 时任何输入都不得 `ADMITTED`，并在 P3 签署后接入 checked 几何正例？

必须覆盖：`packages/contracts/src/playability/admission.ts`；`playability-admission.test.ts`；`playability-admission-matrix.json`；`api.ts` 仅导出；不修改 `public-verdict.ts` / `verdict.ts` / `capability-gate.ts`；gate `BLOCKED` 负路径；synthetic 正例必须真实满足准入合同；P3 前不得把 AC-10 标 PASS；回滚。

约束：见 `reports/00-execution-protocol.md` §6 与 annex §6；公共 `PlayabilityVerdict` 形状不变。

## Answer

**Q1–Q17 = 用户全部采纳（2026-11-17）。** 本 brief 冻结 P4 的执行边界；**不构成 P4 实施授权**。

### 1. 目标与前置

P4 只实现**证据级** NB admission 判定：回答 I-03 §8.2 十项证据条件是否同时满足。P4：

- 不接收 gate 状态，不实现 `WIRED / ADMITTED / OPEN` 阶段机（归 P5）；
- 不修改 `public-verdict.ts` / `verdict.ts` / `capability-gate.ts`；
- 不设置公共 `coverage.geometry = "checked"`，不打开任何 gate；
- 不验证真实复核、签名真实性或跨进程执行——这些是 attestation 声明，由 P3 / P7 独立验证。

实施前置：P1 合并 + 独立复核 + 用户签署 + Ledger；用户另行签署 P4 增量授权记录。P1 未完成 ⇒ P4 保持 BLOCKED。

### 2. 模块与导出面

新文件：`packages/contracts/src/playability/admission.ts`。

```ts
export type NbAdmissionRuleId = /* 十字面量闭集，顺序见 §4 */;
export const NB_ADMISSION_RULE_IDS: readonly NbAdmissionRuleId[];
export type NbAdmissionConditionStatus =
  | "PASS" | "BLOCKED" | "INSUFFICIENT_EVIDENCE" | "NOT_RUN";
export type NbAdmissionCondition = {
  readonly id: NbAdmissionRuleId;
  readonly status: NbAdmissionConditionStatus;
  readonly detail: string;
};
export type NbAdmissionInput = {
  readonly evidence: PlayabilityEvidence;
  readonly geometry: NbGeometryAttestation;
  readonly determinism: NbDeterminismAttestation;
  readonly fixtures: NbFixtureAttestation;
};
export type NbAdmissionResult = {
  readonly version: "nb-admission/v1";
  readonly admitted: boolean;
  readonly conditions: readonly NbAdmissionCondition[];
};
export const NB_ADMISSION_MATRIX_HASH: string;
export const NB_PROBE_FIXTURE_MANIFEST_HASH: string;
export function assessNbAdmission(input: NbAdmissionInput): NbAdmissionResult;
```

同时导出 `NbGeometryAttestation`、`NbReviewFact`、`NbDeterminismAttestation`、`NbFixtureAttestation` 四个类型。`api.ts` **只做追加导出**，不改现有导出。P4 不导出任何组合 gate / 公共 Verdict 的函数；P5 负责把 `admitted` 映射为 `CapabilityAdmission.nb`。

### 3. 输入契约

```ts
type NbReviewFact = {
  readonly status: "PASS" | "FAIL" | "NOT_RUN";
  readonly ref?: string;              // status="PASS" 时必填且非空
};

type NbGeometryAttestation = {
  readonly source: "synthetic" | "p3-signed";
  readonly hazard: "checked" | "partial" | "unknown";
  readonly player: "checked" | "partial" | "unknown";
  readonly graph: "checked" | "not-applicable" | "partial" | "unknown";
  readonly graphInvolved: boolean;
  readonly review: { readonly a: NbReviewFact; readonly b: NbReviewFact; readonly c: NbReviewFact };
};

type NbDeterminismAttestation = {
  readonly runs: number;
  readonly equal: boolean;
  readonly signature: string;        // sha256:<64 位小写 hex>
  readonly normalizedHash: string;   // sha256:<64 位小写 hex>
};

type NbFixtureAttestation = {
  readonly admissionSetStatus: "PASS" | "FAIL" | "NOT_RUN";
  readonly admissionMatrixHash: string;   // sha256:<64hex>，矩阵文件字节 hash
  readonly probeManifestHash: string;     // sha256:<64hex>，P1 冻结 manifest 语义 hash
};
```

- `evidence` 必须是 `judgmentId = "PLAYABILITY_TEMPORAL_EVIDENCE"` 的公共 `PlayabilityEvidence`；P4 不扩展 `PlayabilityEvidence`。
- **防伪边界**：attestation 是调用方声明，不是已完成的真实复核证明。P4 只校验形状与一致性；不得把布尔值、签名或 hash 的存在读成“P3 已完成复核”。
- `graphInvolved: false` 时 `graph` 必须为 `"not-applicable"`；`graphInvolved: true` 时不得为 `"not-applicable"`。二者矛盾 ⇒ `geometry-coverage = BLOCKED`。
- P4 **禁止**从 `coverage.geometry`（I-02 恒 `partial`）反推 `checked`。

### 4. 十条件与判定语义

`NB_ADMISSION_RULE_IDS` 按 §8.2 顺序冻结：

`geometry-coverage` → `geometry-review` → `temporal-coverage` → `lag-consistency` → `certificate-complete` → `budget` → `determinism` → `witness-volume` → `public-mapping` → `admission-fixtures`

**分类总则**：

- 必需输入缺失 ⇒ `NOT_RUN`；
- 存在但明确否定 / 硬越界 / 自相矛盾 ⇒ `BLOCKED`；
- 存在但 partial / unknown / 无法验证 ⇒ `INSUFFICIENT_EVIDENCE`。

| 条件 | 读取字段 | PASS | BLOCKED | INSUFFICIENT_EVIDENCE | NOT_RUN |
| --- | --- | --- | --- | --- | --- |
| `geometry-coverage` | `geometry.hazard/player/graph/graphInvolved` | hazard 与 player 均 `checked`，且（`graphInvolved ? graph="checked"` : `graph="not-applicable"`） | graph 与 `graphInvolved` 矛盾 | hazard/player/graph 为 `partial` 或 `unknown` | `geometry` 缺失 |
| `geometry-review` | `geometry.review.a/b/c` | 三项 `PASS` 且 `ref` 非空 | 任一 `FAIL` | 任一 `PASS` 但 `ref` 为空 | 缺项 / 任一 `NOT_RUN` |
| `temporal-coverage` | `evidence.coverage.temporal` | `"checked"` | — | `"partial"` / `"unknown"` / 缺省 | `evidence` 缺失 |
| `lag-consistency` | `evidence.lag` | 恰好两档；`mode="gate-independent; witness-only"`、`invariantByConstruction=true`；两档均 `nb-candidate`、`witness`、`COMPLETE`、`degradation=null`；`lagMs` 有限正数且互不相等 | 任一档非 `nb-candidate`、两档结论不一致、`lagMs` 相等/非正/非有限、`COMPLETE` 但 `degradation≠null` | — | `lag` 缺失 |
| `certificate-complete` | `evidence.witness` + `evidence.degradation` | `witness.kind="temporal"`、`certificateKind="witness"`、`certificateStatus="COMPLETE"`、`degradation.reason=null` | `INCOMPLETE`、`certificateKind="none"`、或 `COMPLETE` 但 `degradation.reason≠null` | `witness.kind≠"temporal"` | `evidence` 缺失 |
| `budget` | `evidence.limits` | `budgetStatus="complete"` 且 `budgetKind=null` | `exhausted` / `aborted` / `budgetKind≠null`（含 `wall-clock-abort`）/ `hopSamplesChecked > maxHopSamples` | `budgetStatus="invalid"` | `limits` 缺失 |
| `determinism` | `determinism` | `runs ≥ 2`、`equal=true`、两 hash 均 `sha256:<64hex>` | `equal=false` | `runs < 2` 或 hash 形状不合法 | `determinism` 缺失 |
| `witness-volume` | `evidence.limits` + `degradation.reason` | `witnessTransitions ≤ maxWitnessTransitions` 且 `witnessBytes ≤ maxWitnessBytes` 且 `degradation.reason ≠ "witness-volume"` | 任一越界或 `degradation.reason="witness-volume"` | — | `limits` 缺失 |
| `public-mapping` | 见 §5 | 全部映射检查成立 | 无 `p3-signed` 背书的 checked / 组件与 attestation 不一致 / 混入 PU 条件 / 明确否定结果 | — | `evidence` 缺失 |
| `admission-fixtures` | `fixtures` | `admissionSetStatus="PASS"` 且两 hash 等于冻结常量 | 状态 `FAIL` 或任一 hash 不匹配 | — | `NOT_RUN` / 缺失 |

**责任边界（互不代偿）**：

- `lag-consistency` 只判每档 `perLag` 自身，不看合并 `witness`；
- `certificate-complete` 只判合并 `witness` 与 `degradation.reason`，不重判双档；
- `temporal-coverage` 只判聚合 `coverage.temporal`。

**结果形状**：恒返回 10 项、顺序固定、不短路；`admitted === true` 当且仅当十项全部 `PASS`；`detail` 为中文短句、不参与机检；数据问题一律映射为状态，**永不 throw**。夹具行结构校验放在测试 helper（夹具坏 ⇒ 测试红）。

### 5. `public-mapping` 与防伪不变量

`public-mapping = PASS` 需同时满足：

- `judgmentId = "PLAYABILITY_TEMPORAL_EVIDENCE"`；
- `witness.kind = "temporal"` 且 `witness.result = "nb-candidate"`；
- `coverage.temporal = "checked"`；
- 降级一致：`COMPLETE ⇒ degradation.reason = null && secondary = []`；`INCOMPLETE ⇒ degradation.reason ≠ null`；
- `model.conditional = true` 且 `movementModelClosure = "not-proven-air-control"`；
- `model.puConditions` 不得出现（PU 条件进入 NB ⇒ `BLOCKED`）；
- **防伪（2026-11-17 与 P6 联动修订）**：
  - 公共 evidence **未**声称 checked / verified（`coverage.geometry` 缺省或为 `"partial"` / `"not-checked"` / `"unknown"`，且 `model.geometryCoverage.*.runtimeBody` 均为 `"unverified"`）⇒ 可接受；admission 的几何事实只来自 `attestations.geometry`。
  - 公共 evidence **一旦**声称 checked / verified（`coverage.geometry === "checked"`，或任一 `model.geometryCoverage.*.coverage === "checked"` / `runtimeBody === "verified"`）⇒ 必须同时满足：
    1. `attestations.geometry.source === "p3-signed"`；
    2. `attestations.geometry.review.a/b/c` 均 `PASS` 且 `ref` 非空；
    3. 逐组件一致：对 hazard / player / graph，`model.geometryCoverage[axis].coverage` 等于该组件状态（`not-applicable` 记 `unknown`），`runtimeBody === (status === "checked" ? "verified" : "unverified")`；
    4. `evidence.coverage.geometry` 与 `limits.geometryCoverage` 等于按 P6 合并规则（任一 unknown ⇒ unknown；否则任一 partial ⇒ partial；否则全 checked ⇒ checked）得到的聚合值。
  - 任一不一致或缺少背书 ⇒ `BLOCKED`（伪造 / 错配）。

错通道（PU 条件进入 NB） ⇒ `BLOCKED`；`witness.result` 为 `insufficient-evidence` / `pu-candidate` ⇒ `BLOCKED`。

### 6. 夹具矩阵

`packages/contracts/tests/fixtures/playability-admission-matrix.json`：

- `version: "nb-admission-matrix/v1"`；
- 固定 **17 行**：1 个 Synthetic NB 正例 + 10 个单条件负例 + 3 个 False-NB 负例 + 3 个真实 IE 负例；
- False-NB 三类固定：`insufficient-evidence` 结果 / lag 不一致 / witness `INCOMPLETE`；
- 真实 IE 三类固定：model-out / budget-exhausted / 缺证据；
- 每行含完整 `NbAdmissionInput` 与 `expect`；负例带 `variesFrom`，测试用规范化 JSON 深比较证明**恰好一个**条件字段变化；
- 正例 `geometry.source = "synthetic"`，A/B/C 复核使用占位 `ref`，不得冒充 P3。

**冻结 hash（两者语义分离）**：

- `NB_ADMISSION_MATRIX_HASH`：矩阵 JSON 的**文件字节** SHA-256；先写夹具再冻结；测试重算并断言。
- `NB_PROBE_FIXTURE_MANIFEST_HASH = "sha256:dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b"`：P1 冻结的 probe 夹具 **manifest 语义 hash**；P4 只引用、不重算。

矩阵文件任何变更 ⇒ 常量失效 ⇒ STOP，需重新冻结并写回 Ledger。禁止根据测试结果调整样本。

### 7. 测试

新文件：`packages/contracts/tests/playability-admission.test.ts`，单文件五个 describe 块：

1. **矩阵行驱动**：17 行逐行断言 `admitted` 与逐条件 `status`；断言 `rows.length===17` 与 id 集合；负例单变量证明。
2. **十条件四态**：每条规则至少 `PASS / BLOCKED / INSUFFICIENT_EVIDENCE / NOT_RUN` 各一个单元用例，构造输入使目标规则翻转、其余九项不受影响。
3. **防伪（修订）**：无 `p3-signed` 背书的 checked / verified、组件状态与 attestation 不一致、或夹带 `model.puConditions` ⇒ `public-mapping = BLOCKED`；正例：`source:"p3-signed"` + 完整 review + 逐项一致 ⇒ `public-mapping = PASS`（P6 enriched evidence 可进入 admission）；graph 与 `graphInvolved` 矛盾 ⇒ BLOCKED；`determinism.equal=false` ⇒ BLOCKED。
4. **gate `BLOCKED` 负向**：十项全 PASS + **未修改的** `mapPublicVerdict` + `PHASE1_CAPABILITY_GATE` ⇒ 公共 verdict 仍 `INSUFFICIENT_EVIDENCE`；对照用假设 `OPEN` gate + `{ nb: admitted }` ⇒ `NO_PROVEN_BLOCKER`，证明结果可被 P5 消费。
5. **冻结 hash**：重算矩阵文件 SHA-256 === `NB_ADMISSION_MATRIX_HASH`；`NB_PROBE_FIXTURE_MANIFEST_HASH` 字面量 === `sha256:dd880628…`。

目标命令：`pnpm vitest run packages/contracts/tests/playability-admission.test.ts`。

### 8. AC-10 边界

P4 阶段 **AC-10 保持 `NOT_RUN`**：

- synthetic 正例只证明十项判定规则可实现，不替代 P3 签署的真实 checked 几何；
- 真实 checked 几何正例由 P3 完成后经 P6 / P7 验证；
- 任何把 AC-10 标 `PASS`、在 P4 代码里合成 / 写入 geometry 字段、或打开 gate 的行为 ⇒ STOP；读取 P6 提供的 enriched evidence 做一致性校验不在 P4 实施范围内，仅作为判定输入。

### 9. 白名单

仅允许：

- 新 `packages/contracts/src/playability/admission.ts`
- 新 `packages/contracts/tests/playability-admission.test.ts`
- 新 `packages/contracts/tests/fixtures/playability-admission-matrix.json`
- `packages/contracts/src/playability/api.ts`（仅追加导出）

`public-verdict.ts` / `verdict.ts` / `capability-gate.ts` 零 diff；既有测试断言零修改；产品其他 `packages/**` / `fixtures/**` 零改动。

### 10. STOP

1. 改动超出 §9 白名单；
2. `public-verdict.ts` / `verdict.ts` / `capability-gate.ts` 出现任何 diff；
3. 既有测试断言被修改或放宽；
4. 矩阵行数 ≠ 17 或单变量证明失败；
5. `NB_ADMISSION_MATRIX_HASH` 与文件实际 hash 不一致；
6. `NB_PROBE_FIXTURE_MANIFEST_HASH` ≠ `sha256:dd880628…`；
7. 把 AC-10 标 PASS、在 P4 代码里合成 / 写入 geometry 字段、允许无 `p3-signed` 背书的 checked、或打开 gate；
8. `admission.ts` 引入文件 I/O、新依赖或读取 `.scratch`；
9. 为让测试通过而修改规则语义 / 输入契约；
10. 回滚演练未全绿。

任一 STOP ⇒ HITL；不得自行缩范围或改写历史记录。

### 11. 交付、证据与分支

- 实施分支：`wayfinder/i03-phase2-p4-impl`（授权后从更新后的 `main` 切出）；实施 PR 合入 `main`，含代码 / 测试 / 夹具 / `reports/P4-review.md`。
- 证据分支：`wayfinder/i03-phase2-p4-evidence`；raw 证据不随实施 PR 进入 `main`。
- 证据目录：`.scratch/level-playability-v1.1-i03-phase2/evidence/phase2/P4/`，固定文件：
  `commands.log`、`matrix-sha256.txt`、`test-target.txt`、`test-full.txt`、`typecheck.txt`、`check.txt`、`invariant-before-after.txt`、`rollback/target-or-full-test.txt`、`rollback/typecheck.txt`、`rollback/check.txt`、`SHA256SUMS`。
- 提交顺序：先实施 commit，再 evidence commit；`commands.log` 记录实施 SHA 与分支基点 `main` SHA。

**invariant before/after**：

- `git diff <base>..<impl-tip> -- packages/contracts/src/playability/{public-verdict,verdict,capability-gate}.ts` 为空；
- 现有测试文件零 diff；
- `git diff --stat` 只含白名单文件。

**回滚演练**（必须真实执行）：

1. 从实施分支 tip 切一次性 `p4-rollback-drill`；
2. `git revert --no-edit <impl-commit>`；
3. 依次跑目标测试（记录“测试文件随 revert 消失”这一事实）、全量 `pnpm test`、`pnpm typecheck`、`pnpm check`；
4. 全部退出码 0 才算通过；演练分支用完即弃，不合入。

### 12. 复核、签署与 Ledger

- fresh reviewer 未参与 P4 实施；报告固定 `.scratch/level-playability-v1.1-i03-phase2/reports/P4-review.md`。
- 报告固定章节：独立性声明 / 日期与环境 / 输入（实施 SHA、矩阵 hash、probe manifest hash）/ 十条件逐项核对 / 17 行矩阵结果 / 单变量证明 / gate `BLOCKED` 负向与防伪 / invariant 零 diff / 限制（P4 不验证跨进程真实性、AC-10 仍 `NOT_RUN`）/ 结论 `PASS|FAIL` + 用户签署行。
- 复核 PASS + 用户签署后，P4 才算完成；Ledger P4 行填：实施 SHA、evidence commit SHA、矩阵 hash、复核报告 hash、批准人、日期、回滚目标 = 分支基点 `main` SHA、演练证据路径。
- 本 brief 不构成 P4 实施授权；P1 / P2 / P3 的既有门不变。

### 13. 授权顺序

1. P1 合并 + 独立复核 + 用户签署 + Ledger；
2. 用户签署 P4 增量授权记录（引用 annex §6 与本 brief）；
3. docs-only PR 合入 `main`；
4. 从更新后的 `main` 切 `wayfinder/i03-phase2-p4-impl`；
5. 实施 / 证据；
6. fresh 复核 PASS；
7. 用户签署；
8. 实施 PR 合并；
9. 独立 Ledger 行。

本会话未写产品代码、未创建实施 / 证据分支、未运行测试。

## Comments

- 2026-11-17：grilling 三轮 Q1–Q17 全部裁定 A；brief 冻结。P4 实施仍待 P1 完成 + P4 增量授权。

- 2026-11-17 P6 联动修订：`public-mapping` 的防伪条款由“公共 evidence 一律不得 checked”改为“无 `p3-signed` 背书与逐项一致性的 checked 才 BLOCKED”。原因：P6 需把 P3 签署后的真实 checked 几何写入同一份 temporal evidence；按原文两者无法同时成立。P4 尚未实施，修订在实施前完成。
