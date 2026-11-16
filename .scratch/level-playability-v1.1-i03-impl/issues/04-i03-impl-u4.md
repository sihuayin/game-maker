# I03-IMPL-04 U4 执行 brief

Type: grilling
Status: resolved
Owner: claude (I03-IMPL-04 session 2026-11-16)
Blocked by: 03
Map: ../map.md
Class: I-03-IMPL / U4

## Question

为 **U4（assets `runTemporalAudit` 接入真实分析并产出证据）** 产出一份可交接的执行 brief，至少覆盖：

- 授权包 §11.2 的 U4 逐文件白名单；T-58 只按批准语义改写，保留禁止路径；
- `analyzeTemporalInternalTwoLag` 经 U1 适配器接入；`runTemporalAudit` 保持同步 / 不抛 / 不改退出码；
- 双档运行、确定性证据、AC-10 / AC-18 / AC-19、T-56 / T-57 / T-58 / T-60 / T-61 / T-62 / T-64；
- U4 专属门：T-58 允许路径 + 禁止路径；stub 负向覆盖；双档可重放确定性；
- **消费 U1 adapter + U2 `mapPublicVerdict` + 第一阶段常量**：gate / admission 显式传 `PHASE1_CAPABILITY_GATE` / `PHASE1_CAPABILITY_ADMISSION`，不得默认，不得把 `OPEN` 解释为 admission；
- **真实 analyzer → U1 adapter 集成 smoke（必需，来自 I03-IMPL-02 Q4）**：必须证明 `analyzeTemporalInternalTwoLag` 的真实结果可被 U1 `toPublicTemporalEvidence` 直接消费；不得用测试专用转换层掩盖类型 / 字段漂移；在 U4 的 assets 授权范围内完成；
- **回滚演练**（revert 后跑相关测试，保留日志与 hash）；
- 独立复核输入、E1 / E2 / E3、不变量快照；
- **明确：本 brief 不写代码**。

## Answer

**Q1–Q9 = A（Q8 为有条件 A：独立 evidence-only commit，不预先授权 `.scratch` 进入产品 PR）。** 本 brief 是 U4 的规划，**不构成 U4 实施授权**。

### 0. Preconditions / dependency chain

U4 执行前必须：

- U1 已完成独立复核 PASS、用户签署、合并、Ledger 更新；
- U2 已完成独立复核 PASS、用户签署、合并、Ledger 更新；
- U4 取得独立增量授权记录 + docs PR 合入 `main`；
- U4 分支从更新后的 `main` 切出。

本 brief 只规划，不写代码。

### 1. Scope / non-goals

**Scope**：`packages/assets/src/ops.ts` 的 `runTemporalAudit` 接入真实 `analyzeTemporalInternalTwoLag`，经 U1 adapter 产出公共 evidence，经 U2 mapper 产出公共 verdict；更新 `ops.test.ts` 与 **仅 T-58**；产出 U4 证据。

**Non-goals**：`publish-gate` 诊断字段 / G1–G11（U5）；`mechanic.ts` gap（U3）；公共能力开放；几何 probe / PU 条件 2/5；`create-game.ts` / `publish-gate.ts` 调用点的业务改动（U5 负责传 `existingAudit` / 消费报告）；任何白名单外文件。

### 2. Allowed files（授权包 §11.2 U4）

| 文件 | 操作 | 限定目的 |
| --- | --- | --- |
| `packages/assets/src/ops.ts` | 修改 | `runTemporalAudit` 接真实分析并产出证据 / 公共 verdict |
| `packages/assets/tests/ops.test.ts` | 修改 | U4 真实接线、集成 smoke、失败路径、兼容性测试 |
| `packages/contracts/tests/playability-temporal-input.test.ts` | 修改 | **仅 T-58** |

- `packages/assets/src/index.ts` 已 `export * from "./ops.js"`；新类型自动导出，**不改 barrel**。
- 只读 fixtures：`fixtures/packs/last-train/v2`、`fixtures/game-configs/last-train.json`；不得修改。
- 禁止：其他 contracts 文件、pipeline / demo / cli / mcp / scripts / docs / fixtures 修改、新依赖、白名单外文件。

### 3. 架构守卫边界（Q1）

- **T-57 不能改**：保留 `ops.ts` 中的 `auditPlayabilityTemporal(` 调用（legacy stub 路径），T-57 继续通过。
- **T-58 只按本 brief 改写**：允许旧 `analyze: stubTemporalAnalyzer`；断言 `ops.ts` 调 `analyzeTemporalInternalTwoLag(` 恰一次；禁止其他 analyzer；保留 `stubTemporalAnalyzer` export 断言。
- **T-61 不变**：`runTemporalAudit(` 生产调用者仍恰好 `ops.ts` / `create-game.ts` / `publish-gate.ts`；U4 不新增调用者。
- **T-60**：`runTemporalAudit` 仍同步；**T-56 / T-62 / T-64** 不变。

### 4. `runTemporalAudit` 返回类型（Q2）

在 `ops.ts` 新增并导出：

```ts
export type TemporalAuditReport =
  | { readonly applicable: false }
  | {
      readonly applicable: true;
      /** legacy 字段：来自旧 stub 路径，保留兼容。 */
      readonly verdict: PlayabilityVerdictState;
      readonly degradation?: "lag-invalid" | "lag-disagreement";
      /** 权威公共字段：来自真实路径。 */
      readonly coverage: TemporalCoverageState;
      readonly evidence: readonly PlayabilityEvidence[];
      readonly publicVerdict: PlayabilityVerdict;
    };
```

- 旧 `TemporalAuditResult` 字段是 `TemporalAuditReport` 的子集；`TemporalAuditReport` 可赋给 `TemporalAuditResult`。
- `coverage = publicVerdict.coverage.temporal ?? "unknown"`。
- `evidence` 仅含本次 temporal evidence；无证据时为 `[]`。
- `publicVerdict` 来自 U2 `mapPublicVerdict`。
- **`verdict` / `degradation` 是 legacy 字段，不是 U5 的权威来源**；U5 必须使用 `publicVerdict.verdict` / `coverage` / `evidence`。

### 5. 签名（Q3）

```ts
export function runTemporalAudit(args: {
  config: GameConfig;
  manifest: AssetPackManifest;
  packDir: string;
  existingAudit?: PlayabilityVerdict;
}): TemporalAuditReport
```

- 保持同步、绝不抛、不改退出码。
- `existingAudit` 可选：有则复用；无则内部 `auditPlayability(config, manifest)`。
- U5 在 `publish-gate` 把 `configProblem` 已有的 audit 传入；`create-game` 不传，走 fallback。
- 不新增 `runTemporalAudit` 调用者；不改 `create-game.ts` / `publish-gate.ts`（U5 负责 `publish-gate` 的传参与消费）。

### 6. 路径组合（Q1 / Q4）

```text
scope = temporalScope(config)
if (!scope.applicable) => { applicable:false }（零文件 I/O）

trusted = readTrustedAtlasInput(packDir, manifest, scope.assetIds)
if (!trusted.ok) => IE + coverage:"unknown" + evidence:[] + safe publicVerdict

// legacy stub 路径（独立 try/catch；只产 legacy 字段）
legacy = resolveTwoLagResults(
  auditPlayabilityTemporal(config, manifest, { lagMs: TEMPORAL_LAG_MS, trustedInput: trusted.value, analyze: stubTemporalAnalyzer }),
  auditPlayabilityTemporal(config, manifest, { lagMs: TEMPORAL_LAG_BASELINE_MS, trustedInput: trusted.value, analyze: stubTemporalAnalyzer }),
)

// 真实权威路径（独立 try/catch）
existingAudit = args.existingAudit ?? auditPlayability(config, manifest)
input = { config, manifest, lagMs: TEMPORAL_LAG_MS, trustedInput: trusted.value }
twoLag = analyzeTemporalInternalTwoLag(input, TEMPORAL_LAG_BASELINE_MS)
assetId = 恰好一个 kind==="hazard" && motion 的 entity 的 asset，否则 undefined
evidence = toPublicTemporalEvidence({
  twoLag, firstLagMs: TEMPORAL_LAG_MS, secondLagMs: TEMPORAL_LAG_BASELINE_MS,
  existingCoverage: existingAudit.coverage, assetId,
})
publicVerdict = mapPublicVerdict({
  existing: existingAudit,
  temporal: { applicable: true, evidence },
  gate: PHASE1_CAPABILITY_GATE,
  admission: PHASE1_CAPABILITY_ADMISSION,
})
return { applicable:true, ...legacy, coverage: publicVerdict.coverage.temporal ?? "unknown", evidence:[evidence], publicVerdict }
```

- `assetId`：多个移动 Hazard ⇒ 省略；不得伪造。
- `gate` / `admission` 必须显式传第一阶段常量；不得默认。
- `applicable:false` 不产生任何文件 I/O。

### 7. 异常处理（Q7）

- **分层 catch**：
  - legacy stub 路径独立 try/catch；失败只把 legacy 字段置为 `INSUFFICIENT_EVIDENCE`，不阻断真实路径。
  - 真实路径独立 try/catch；非冲突异常 ⇒ `IE + coverage:"unknown" + evidence:[]`；`publicVerdict` 用已有 `existingAudit`；无 `existingAudit` 时用最小安全 verdict（`INSUFFICIENT_EVIDENCE`、空 evidence、三维 `not-checked`）。**绝不抛**。
- `PublicVerdictConflictError` 在 phase-1（gate `BLOCKED` / admission `false`）**不可达**：
  - `PHASE1_CAPABILITY_GATE` / `PHASE1_CAPABILITY_ADMISSION` 冻结；
  - 加测试证明 phase-1 常量不会触发冲突；
  - 不写隐藏 rethrow；未来 gate `OPEN` 若可达，必须另开 effort 做 STOP 处理，U4 不静默降级。
- `trusted` 不可用 ⇒ IE/unknown/evidence[]；不抛。
- U4 测试必须覆盖：trusted 失败、注入抛错、`applicable:false`、正常运行都不抛。

### 8. 测试与 T-58（Q5）

`ops.test.ts`：

- **真实接线 / 集成 smoke**：`fixtures/packs/last-train/v2` + `fixtures/game-configs/last-train.json`；`runTemporalAudit` → 真实 `analyzeTemporalInternalTwoLag` → U1 adapter → U2 mapper；断言 `publicVerdict`、`coverage`、`evidence`（`witness.kind==="temporal"`）；**无测试专用转换层**；gate BLOCKED ⇒ 移动 Hazard 仍 IE。
- **legacy 字段兼容**：
  - 编译期类型断言 `expectTypeOf<TemporalAuditReport>().toMatchTypeOf<TemporalAuditResult>()`（或等价 typed assignment）；
  - 运行时断言 `report.verdict` / `report.degradation` 存在（legacy stub 路径）；
  - `pnpm build` 证明 `create-game` / `publish-gate` 现有调用编译。
- `existingAudit` 复用：传入 synthetic audit 时不重复 `auditPlayability`；不传时 fallback 可用。
- `applicable:false`：零文件 I/O、无真实分析。
- 失败：trusted 失败 / 注入抛错 ⇒ IE/unknown/evidence[]，不抛。
- 确定性：同一真实输入跑两次，公共 `evidence` / `coverage` / `publicVerdict` 深度相等；公共 evidence 不含 `wallClockMs`。
- 不变量：`publicCapability="BLOCKED"`、`publicResult=null`、`publish-gate` / `create-game` 现有断言零改动、退出码不变。
- 回滚演练：U4 必须在 scratch worktree / drill branch 上 revert U4 commit，跑 `ops.test.ts` + `temporal-input.test.ts` + 全量 `pnpm test`，保留日志 / 退出码 / hash；演练状态不是交付状态。

`temporal-input.test.ts`（**仅 T-58**）：

- 旧 `analyze: stubTemporalAnalyzer` 仍允许；
- `ops.ts` 调 `analyzeTemporalInternalTwoLag(` 恰一次；
- 禁止其他 analyzer；
- 保留 `stubTemporalAnalyzer` export 断言；
- T-57 / T-61 / T-60 / T-56 / T-62 / T-64 零改动。

### 9. 证据 / 复核 / 归档（Q8）

- 证据：`evidence/U4/`（`commands.log`、`test-output.txt`、`invariant-before.txt`、`invariant-after.txt`、回滚演练日志 + SHA-256）。
- 复核输入：`reports/U4-review-input.md`；复核报告：`reports/U4-review.md`；fresh 独立会话；逐项 `PASS / FAIL / NOT_RUN`；至少 2 条自选关键断言。
- **证据归档边界（有条件 A）**：
  - 证据是**独立 evidence-only commit**，只含 `.scratch/level-playability-v1.1-i03-impl/evidence/U4/` 与 `reports/U4-*`；
  - **不预先授权 `.scratch` 进入产品 PR**；产品 PR 是否包含证据，需要单独的归档决定；
  - 若 PR 不含证据，review / PR / Ledger 链接证据路径 + hash。

### 10. 提交切片（Q6）

1. `ops.ts` 真实路径 + `TemporalAuditReport` + T-58 改写；
2. `ops.test.ts` 真实接线路 / 集成 smoke / 失败路径 / 兼容性；
3. **独立 evidence-only commit**（`.scratch` 证据 + reports；不预授权进入产品 PR）。

brief 只写在本票 Answer；不另建 `reports/04-u4-brief.md`。

### 11. STOP

- 授权包 §11.3 的 12 条 STOP 全部适用。
- 任何白名单外文件、新依赖、`temporal.ts` / `temporal-result.ts` / `verifyTemporalInput` / 其他 contracts 修改、T-57 / T-61 / T-60 / T-56 / T-62 / T-64 改动、T-58 超出本 brief、新增 `runTemporalAudit` 调用者、async / 抛错 / 退出码变化、gate / admission 默认值、公共 gate 字段、真实路径被测试专用转换层替代、`.scratch` 未经归档决定进入产品 PR ⇒ **STOP + HITL**。
- 若 U1 / U2 未完成签署 / 合并 / Ledger 更新 ⇒ 不得开始 U4。

### 12. 授权边界

本 brief **不构成 U4 实施授权**。执行前必须：

1. U1 + U2 完成复核 PASS、用户签署、合并、Ledger 更新；
2. 用户签署 `reports/U4-incremental-authorization.md`；
3. 授权 docs PR 合入 `main`；
4. 从更新后的 `main` 切 U4 分支；
5. 独立复核 PASS + 用户签署 + Ledger 更新。

`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；不产公共 NB / PU；`publicCapability` / `publicResult` 不变。

### 13. U4 最终执行边界

| 项目 | 裁定 |
| --- | --- |
| 实施范围 | `runTemporalAudit` 真实分析接入、U1 adapter、U2 mapper、证据 |
| 旧 stub | 保留，仅产 legacy `verdict` / `degradation`；T-57 / T-58 保持 |
| 真实路径 | `analyzeTemporalInternalTwoLag` → `toPublicTemporalEvidence` → `mapPublicVerdict` |
| 返回类型 | `TemporalAuditReport` 旧字段兼容 + 新 `coverage` / `evidence` / `publicVerdict` |
| existingAudit | 可选；无则内部 `auditPlayability` fallback |
| 异常 | 分层 catch；phase-1 冲突不可达；绝不抛 |
| 架构守卫 | T-58 改写；T-57 / T-61 / T-60 / T-56 / T-62 / T-64 零改动 |
| 测试 | 真实集成 smoke + 失败路径 + 兼容性 + 确定性 + 不变量 |
| 证据 | `evidence/U4/` + `reports/U4-*`；独立 evidence-only commit；不预授权进入产品 PR |
| 提交 | 3 个逻辑切片 |
| 回滚 | U4 必须实际演练（revert + 相关测试 + 全量测试） |
| 授权 | U1 + U2 签署 / 合并 / Ledger 后，再单独授权 U4 |

## Comments

- 2026-11-15 I03-IMPL-02 Q4 裁定：真实 analyzer → adapter smoke 从 U1 移入 U4，作为 U4 必需验收项；U1 不引入跨包依赖。
- 2026-11-15 I03-IMPL-03 Q1/Q4：U4 必须显式传第一阶段 gate/admission 给 U2 mapper；`gate=OPEN` ≠ admission。
