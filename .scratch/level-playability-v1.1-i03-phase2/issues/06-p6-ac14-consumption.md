# P6 · AC-14 几何证据消费 brief

Type: grilling
Status: resolved
Owner: claude (P6 session 2026-11-17)
Blocked by: 03
Map: ../map.md
Class: I-03-Phase2 / P6

## Question

为 P6 产出一份可交接的执行 brief：如何在 P3 复核并签署后，以显式 `GeometryEvidenceInput` 接入 temporal evidence，保守合并 `coverage.geometry`，并保持 `PublicVerdictResult` 顶层形状不变？

必须覆盖：新 `playability/geometry-evidence.ts`；`temporal-evidence.ts` 扩展；`verdict.ts` 仅 geometry 类型加法式放宽（`runtimeBody: "unverified"|"verified"`、`coverage: "checked"|"partial"|"unknown"`、`limits.geometryCoverage` 同步）；`api.ts` 仅导出；`ops.ts` 仅显式可选参数接线（不自动读 scratch、不硬编码签署）；synthetic 测试无文件 I/O；合并语义（任一 unknown ⇒ unknown；否则任一 partial ⇒ partial；全 checked ⇒ checked；partial/unknown 不得提升；checked 必须带完整 review；`applicable:false` 不生成 geometry）；若需改 `public-verdict.ts` 或扩大白名单 ⇒ STOP；回滚。

约束：见 `reports/00-execution-protocol.md` §8 与 annex §8；P6 只能消费 P3 已签署证据，不自行验证签署真实性。

## Answer

**Q1–Q11 = 用户裁定（2026-11-17）。** 其中 **Q1 = B**：正式修订 P4 的防伪规则（已提交 `210b96d`，更新 PR #76），P6 不绕过 P4 admission。本 brief 冻结 P6 的执行边界；**不构成 P6 实施授权**。

### 1. 目标与前置

P6 在 P3 独立复核并签署后，以显式 `GeometryEvidenceInput` 把 checked 几何接入 temporal evidence，保守合并 `coverage.geometry`，并保持 `PublicVerdictResult` 顶层形状不变。P6：

- 只消费 P3 已签署证据的**显式输入**，不读 `.scratch`、不运行 probe、不验证签名真实性；
- 不修改 `public-verdict.ts`，不改变 `PlayabilityVerdict` 顶层形状；
- 不把 AC-14 标 `PASS`（synthetic 测试只证明消费语义）。

实施前置：P3 独立复核 `PASS` + 用户签署 + P2 Ledger；用户另行签署 P6 增量授权记录。P4 的防伪规则修订必须先于 P4 实施（已完成，见 §8）。

### 2. 模块与导出面

新文件：`packages/contracts/src/playability/geometry-evidence.ts`。

```ts
export type GeometryComponentStatus = "checked" | "partial" | "unknown" | "not-applicable";
export type GeometryReviewFact = {
  readonly status: "PASS" | "FAIL" | "NOT_RUN";
  readonly ref?: string;   // status="PASS" 时必填且非空
};
export type GeometryEvidenceInput = {
  readonly applicable: boolean;
  readonly components: {
    readonly hazard: GeometryComponentStatus;
    readonly player: GeometryComponentStatus;
    readonly graph: GeometryComponentStatus;
  };
  readonly review: {
    readonly a: GeometryReviewFact;
    readonly b: GeometryReviewFact;
    readonly c: GeometryReviewFact;
  };
  readonly hashes: {
    readonly probeManifestHash: string;    // sha256:<64hex>
    readonly evidenceHash: string;         // sha256:<64hex>
    readonly reviewReportHash: string;     // sha256:<64hex>
  };
};
export type GeometryEvidenceResolution = {
  readonly applicable: boolean;
  readonly aggregate?: "checked" | "partial" | "unknown";   // 仅 applicable 时存在
  readonly components?: {                                    // 仅 applicable 时存在；原样组件状态
    readonly hazard: GeometryComponentStatus;
    readonly player: GeometryComponentStatus;
    readonly graph: GeometryComponentStatus;
  };
};
export function resolveGeometryEvidence(input: GeometryEvidenceInput): GeometryEvidenceResolution;
```

- 纯函数、无 I/O、不 throw；`applicable:false` ⇒ `{ applicable:false }`。
- 不设 `source` 字段：P6 不区分 synthetic / p3-signed；产物不自证来源。
- `api.ts` 仅追加导出；公共字段映射留给 `temporal-evidence.ts`。

### 3. 合并语义

1. `applicable:false` ⇒ 不生成任何 geometry 字段（`coverage.geometry` 缺省，`model` / `limits` 保持现状常量）。
2. 归一化：`hazard` / `player` 为 `not-applicable` ⇒ 按 `unknown` 处理；`graph` 允许 `not-applicable`。
3. 聚合（剔除 `not-applicable`）：
   - 任一 `unknown` ⇒ `unknown`；
   - 否则任一 `partial` ⇒ `partial`；
   - 否则剩余全 `checked` ⇒ 需要额外门：A/B/C 均 `PASS` 且 `ref` 非空、三个 hash 均 `sha256:<64hex>` ⇒ `checked`；否则降为 `partial`。
4. `partial` / `unknown` 永不提升；任一 `FAIL` / `NOT_RUN` ⇒ 聚合最多 `partial`。

### 4. `verdict.ts` 加法式放宽

- `PublicGeometryCoverage.runtimeBody: "unverified" | "verified"`；
- `PublicGeometryCoverage.coverage: "checked" | "partial" | "unknown"`；
- `TemporalLimitsEvidence.geometryCoverage: "checked" | "partial" | "unknown"`；
- `PlayabilityCoverage.geometry?: CoverageState | "unknown"`；
- `chain` 保持 `"manifest+atlas-metadata"` 不扩。

逐组件映射：`checked` ⇒ `runtimeBody:"verified"` + `coverage:"checked"`；`partial` ⇒ `"unverified"` + `"partial"`；`unknown` / `not-applicable` ⇒ `"unverified"` + `"unknown"`。顶层 `coverage.geometry` 与 `limits.geometryCoverage` 取聚合值。

### 5. `temporal-evidence.ts` 扩展

- `ToPublicTemporalEvidenceArgs` 增加可选 `geometry?: GeometryEvidenceInput`；
- 内部函数增加可选 resolution：`geometrySummaryOf(resolution?)`、`modelOf(combined, resolution?)`、`limitsOf(combined, resolution?)`；
- 无 resolution ⇒ 输出与现状**逐字段一致**（`coverage.geometry="partial"`、三组件 `unverified/partial`、`limits.geometryCoverage="partial"`）；
- resolution `applicable:false` ⇒ `coverage.geometry` 缺省，`model` / `limits` 保持现状常量；
- resolution `applicable:true` ⇒ 按 §3/§4 写入三处。

### 6. `ops.ts` 接线

`runTemporalAudit(args)` 增加可选 `geometryEvidence?: GeometryEvidenceInput`，只透传给 `toPublicTemporalEvidence`：

- 不自动读 `.scratch`、不读 P3 报告、不硬编码签署或 hash；
- 现有调用方不传 ⇒ 行为逐字节一致；
- `mapPublicVerdict` 自动带出 `coverage.geometry`，`public-verdict.ts` 零 diff。

### 7. 夹具矩阵与测试

- `packages/contracts/tests/fixtures/playability-geometry-evidence-matrix.json`，`version:"geometry-evidence-matrix/v1"`，固定 **10 行**：
  ① 三组件 checked + 完整 review ⇒ checked；② graph `not-applicable` + hazard/player checked ⇒ checked；③ 一个 partial ⇒ partial；④ 一个 unknown ⇒ unknown；⑤ checked + review FAIL ⇒ partial；⑥ checked + review NOT_RUN ⇒ partial；⑦ hash 形状非法 ⇒ partial；⑧ `applicable:false` ⇒ 不生成；⑨ unknown 压过 partial；⑩ hazard `not-applicable` ⇒ unknown。
- 每行 `{ id, input, expect: { applicable, aggregate?, components? } }`。
- 矩阵 SHA-256 写入 `evidence/phase2/P6/matrix-sha256.txt` 与 Ledger；模块不新增 hash 常量。
- 新测试文件 `packages/contracts/tests/playability-geometry-evidence.test.ts`，六块：矩阵 / 合并与归一化 / review 与 hash 门 / `toPublicTemporalEvidence` 集成（三处一致）/ 无 geometry 向后兼容 / 导出面与不可变性。
- 现有测试文件**零修改**且全绿。

### 8. 与 P4 的联动（Q1 = B）

P4 brief §5 已修订为：

- 公共 evidence **未**声称 checked / verified ⇒ 可接受；几何事实只来自 attestations。
- 公共 evidence **声称** checked / verified ⇒ 必须同时满足：`attestations.geometry.source="p3-signed"`、A/B/C `PASS` 且 `ref` 非空、逐组件状态一致、`coverage.geometry` 与 `limits.geometryCoverage` 等于 P6 合并聚合值；任一不一致 ⇒ `public-mapping = BLOCKED`。
- P4 矩阵仍 17 行；防伪正/负例放在测试块 3；P4 的 synthetic 正例（evidence 未声称 checked）仍然 `PASS`。
- P6 产物必须满足该契约才可被 admission 接受；P6 不实现 P4、不修改 P4 代码。

### 9. 白名单

仅允许：

- 新 `packages/contracts/src/playability/geometry-evidence.ts`
- 改 `packages/contracts/src/playability/temporal-evidence.ts`
- 改 `packages/contracts/src/playability/verdict.ts`（仅 §4 的 geometry 类型加法式放宽）
- `packages/contracts/src/playability/api.ts`（仅追加导出）
- `packages/assets/src/ops.ts`（仅加可选参数透传）
- 新 `packages/contracts/tests/playability-geometry-evidence.test.ts`
- 新 `packages/contracts/tests/fixtures/playability-geometry-evidence-matrix.json`

`public-verdict.ts` / `publish-gate.ts` / CLI / MCP 零 diff；现有测试文件零修改。

### 10. STOP

1. 改动超出 §9 白名单；
2. `public-verdict.ts` / `publish-gate.ts` / CLI / MCP 出现任何 diff；
3. `PlayabilityVerdict` / `PublicVerdictResult` 顶层形状变化；
4. 既有测试断言被修改或放宽；
5. `applicable:false` 仍生成 geometry 字段；
6. `partial` / `unknown` 被提升为 `checked`；
7. `checked` 缺完整 review 或 hash 形状非法仍被放行；
8. P6 自动读 `.scratch`、P3 报告，或硬编码签署 / hash；
9. P4 修订后的规则被绕过（P6 产物与 attestation 不一致仍被接受）；
10. AC-14 在 P6 被标 `PASS`；
11. 回滚演练未全绿。

任一 STOP ⇒ HITL；不得自行缩范围或改写历史记录。

### 11. 交付、证据与回滚

- 实施分支：`wayfinder/i03-phase2-p6-impl`（授权后从更新后的 `main` 切出）；实施 PR 合入 `main`。
- 证据分支：`wayfinder/i03-phase2-p6-evidence`；raw 证据不随实施 PR 进入 `main`。
- 证据目录：`.scratch/level-playability-v1.1-i03-phase2/evidence/phase2/P6/`，固定文件：
  `commands.log`、`matrix-sha256.txt`、`test-target.txt`、`test-full.txt`、`typecheck.txt`、`check.txt`、`invariant-before-after.txt`、`rollback/target-or-full-test.txt`、`rollback/typecheck.txt`、`rollback/check.txt`、`SHA256SUMS`。
- invariant：`public-verdict.ts` / `publish-gate.ts` / CLI / MCP 零 diff；`verdict.ts` diff 仅限 §4 的 geometry 类型；现有测试文件零修改；无 geometry 输入时输出与冻结现状逐字段一致。
- 回滚演练：从实施分支 tip 切一次性 `p6-rollback-drill`，`git revert --no-edit <impl-commit>`，跑目标测试（记录测试文件随 revert 消失）、全量 `pnpm test`、`pnpm typecheck`、`pnpm check`；全部退出码 0 才通过；演练分支用完即弃。

### 12. 复核、签署与 Ledger

- fresh reviewer 未参与 P6 实施；报告固定 `.scratch/level-playability-v1.1-i03-phase2/reports/P6-review.md`。
- 固定章节：独立性 / 日期与环境 / 输入（实施 SHA、矩阵 hash、P3 证据 hash）/ 10 行矩阵逐项 / 合并与 review 门 / `toPublicTemporalEvidence` 三处一致 / 无输入向后兼容 / P4 防伪契约一致性 / invariant 零 diff / 限制（P6 不验证签名真实性、AC-14 仍 `NOT_RUN`）/ 结论 + 用户签署行。
- 复核 PASS + 用户签署后，P6 才算完成；Ledger P6 行填：实施 SHA、evidence commit SHA、矩阵 hash、复核报告 hash、批准人、日期、回滚目标 = 分支基点 `main` SHA、演练证据路径。
- **AC-14 在 P6 保持 `NOT_RUN`**；真实 P3 签署证据由 P7 验收。

### 13. 授权顺序

1. P3 独立复核 `PASS` + 用户签署 + P2 Ledger；
2. 用户签署 P6 增量授权记录（引用 annex §8 与本 brief）；
3. docs-only PR 合入 `main`；
4. 从更新后的 `main` 切 `wayfinder/i03-phase2-p6-impl`；
5. 实施 / 证据；
6. fresh 复核 PASS；
7. 用户签署；
8. 实施 PR 合并；
9. 独立 Ledger 行。

本会话未写产品代码、未创建实施 / 证据分支、未运行测试。

## Comments

- 2026-11-17：grilling 两轮 Q1–Q11 全部裁定；Q1 采纳 B，P4 防伪规则先修订（`210b96d`）；P6 brief 冻结。P6 实施仍待 P3 完成 + P6 增量授权。
