# I03-IMPL-05 U5 执行 brief

Type: grilling
Status: resolved
Owner: claude (I03-IMPL-05 session 2026-11-16)
Blocked by: 04
Map: ../map.md
Class: I-03-IMPL / U5

## Question

为 **U5（pipeline `publish-gate` 诊断字段）** 产出一份可交接的执行 brief，至少覆盖：

- 授权包 §11.2 的 U5 逐文件白名单；
- `PublishGateResult.temporal` 诊断字段；不落盘 / 不进 CLI / MCP / 不升契约；缺省 ≠ 不适用；
- G1–G11 + 变异测试；拒稿输入闭集、无新增 throw、时序证据不产 `CommandError`；
- U5 专属门：G1–G11 + 变异测试全过；
- **消费 U4 `TemporalAuditReport`**：使用 `coverage` / `evidence` / `publicVerdict`（不使用 legacy `verdict` / `degradation`）；把 `configProblem` 已有的 audit 传给 `runTemporalAudit({ existingAudit })`；不改变 U4 返回形状；
- **回滚演练**；
- 独立复核输入、E1 / E2 / E3、不变量快照；
- **明确：本 brief 不写代码**。

## Answer

**Q1–Q6 = A。** 本 brief 是 U5 的规划，**不构成 U5 实施授权**。

**U5 定位**：把 U4 已产生的 temporal 结果作为**非阻断诊断信息**附加到发布闸结果中；不改变现有拒稿逻辑、退出码或 `playabilityIssues` 的输入。

### 1. Scope / non-goals / precondition

**Scope**：`packages/pipeline/src/publish-gate.ts` 的 `PublishGateResult` 可选诊断字段、`configProblem` 结构化返回、U4 `TemporalAuditReport` 消费；`publish-gate.test.ts` 的 G1–G11 + 变异守卫。

**Non-goals**：`runTemporalAudit` / U1 adapter / U2 mapper（U4）；`mechanic.ts` gap（U3）；`create-game.ts` / `create-game.test.ts`；持久化 / sidecar / `qa-report/v1`；CLI / MCP 输出；公共 `PlayabilityVerdict`；gate / 能力开放；任何白名单外文件。

**Precondition**：U4 已完成独立复核 PASS、用户签署、合并、Ledger 更新；U5 取得独立增量授权记录 + docs PR 合入 `main`。

### 2. Allowed files（授权包 §11.2 U5）

| 文件 | 操作 | 限定目的 |
| --- | --- | --- |
| `packages/pipeline/src/publish-gate.ts` | 修改 | 诊断字段消费 |
| `packages/pipeline/tests/publish-gate.test.ts` | 修改 | G1–G11 + 变异守卫 |

- 只读 import：`@game-maker/assets` 的 `runTemporalAudit` / `TemporalAuditReport`；`@game-maker/contracts` 的 `TemporalCoverageState` / `PlayabilityVerdictState` / `PlayabilityEvidence`。
- 禁止：`create-game.ts` / `create-game.test.ts` / `ops.ts` / contracts / CLI / MCP / scripts / docs / fixtures / 新依赖 / 白名单外文件。

### 3. `configProblem` 结构化返回（Q1）

```ts
type ConfigProblemResult = {
  readonly problem?: string;
  readonly temporal?: PublishGateTemporalEvidence;
};
```

- `problem` 存在 ⇒ 按原有路径拒稿；`problem` 与 `temporal` 是**两个独立维度**，有 temporal 不得改变 problem 优先级。
- 无 `problem` ⇒ 正常构造发布闸结果。
- 只有实际取得 temporal 结果时，才用条件 spread 添加 `temporal`；**不写 `temporal: undefined`**。
- `assertPublishableQa` 末尾：
  ```ts
  const config = configProblem(opts.configPath, manifest, opts.packDir);
  if (config.problem !== undefined) throw new CommandError(...);
  return {
    report, reportPath, manifest,
    ...(config.temporal !== undefined ? { temporal: config.temporal } : {}),
  };
  ```

### 4. temporal 执行时机与字段语义（Q2）

保持现有 early return，**不为了诊断覆盖率改变执行顺序**。

| 场景 | `temporal` 字段 |
| --- | --- |
| `configPath` 缺省 | 缺席 |
| config 解不开 | 缺席 |
| `playabilityIssues` 硬失败 | 缺席 |
| QA 报告先拒稿 | 缺席 |
| 硬检查通过，无移动 Hazard | `{ applicable: false }` |
| 硬检查通过，有移动 Hazard | `{ applicable: true, coverage, verdict, evidence }` |

- **字段缺席 = 本次没有运行 temporal。**
- `applicable:false` = temporal 已运行，确认不适用。
- `applicable:true` = temporal 已运行，且存在适用对象；证据可能完整，也可能不足。
- 不得用 `{ applicable:false }` 伪装未执行状态。
- TD config 仍 `return undefined`；无 temporal。

### 5. `PublishGateTemporalEvidence` 形状与来源（Q3）

```ts
export type PublishGateTemporalEvidence =
  | { readonly applicable: false }
  | {
      readonly applicable: true;
      readonly coverage: TemporalCoverageState;
      readonly verdict: PlayabilityVerdictState;
      readonly evidence: readonly PlayabilityEvidence[];
    };
```

- `coverage` ← `report.coverage`（U4 `TemporalAuditReport`）。
- `verdict` ← `report.publicVerdict.verdict`（U2 权威公共结果）。
- `evidence` ← `report.evidence`（仅 temporal evidence）。
- **禁止**：使用 legacy `verdict` / `degradation`；暴露整个 `TemporalAuditReport`；把 temporal 诊断新增到公共 `PlayabilityVerdict`；把内部 analyzer 结果暴露给发布闸调用方。
- `PublishGateResult` 增加 `readonly temporal?: PublishGateTemporalEvidence`；**不落盘 / 不打印 / 不升契约版本**。

### 6. `existingAudit` 复用（Q4）

固定流程：

1. `configProblem` 调用一次 `auditPlayability(parsed.value, manifest)`；
2. `hard = playabilityIssues(audit).filter(severity === "error")`；
3. 硬检查通过后，`runTemporalAudit({ config, manifest, packDir, existingAudit: audit })`；
4. 不在 `runTemporalAudit` 中重复三维审计。

- `existingAudit` 必须来自**本次相同**的 `config` / `manifest`；不得复用跨配置旧结果。
- 硬失败时保持 early return，不运行 temporal。

### 7. 测试与变异守卫（Q5）

`publish-gate.test.ts`：

**现有断言零改动**；`create-game.test.ts` 不碰。

**真实 fixture**（last-train 等）覆盖：

- G1 适用 + 时序 IE ⇒ 放行；诊断记 IE。
- G4 适用 + partial / unknown ⇒ 放行；诊断 coverage 对应。
- G6 未传 `configPath` ⇒ 跳过；**字段缺席**；行为不变。
- G7 无移动 Hazard ⇒ `{applicable:false}`；零文件 I/O（U4 侧已保证，U5 断言字段）。
- G8 现有 `PROVEN_UNPLAYABLE` ⇒ 照旧拒稿；**字段缺席**（hard 失败 early return）。
- G9 QA 报告 error / 六条没跑全 ⇒ 照旧拒稿；**字段缺席**（QA 先拒稿）。

**可控 fake report**（`vi.mock("@game-maker/assets")`，默认委托实际 `runTemporalAudit`，仅指定测试替换返回值）覆盖：

- G2 `nb-candidate` + gate BLOCKED ⇒ 放行；公共映射 IE。
- G3 `pu-candidate` + gate BLOCKED ⇒ 放行；公共映射 IE。
- G5 时序审计内部抛错 ⇒ 不抛；降级 IE / unknown 记录（U4 never-throw 合约）。
- G10 未来 gate OPEN + 证据准入通过 ⇒ 第一阶段仍不改变拒稿。
- G11 证据字段缺省 ⇒ 按 unknown 记录；绝不当作 checked / 通过。

**补充边界**：

- `applicable:false` 不得被当成 `PROVEN_UNPLAYABLE` 或 `NO_PROVEN_BLOCKER`。
- **字段缺席 vs `applicable:false` 必须分别测试**，防止把“未执行”和“不适用”合并。
- fake report 必须满足真实 `TemporalAuditReport` 类型，**不得 `as any`**。

**变异守卫**：

- 行为测试：fake temporal report 即使 `publicVerdict.verdict = PROVEN_UNPLAYABLE` 且 `coverage = checked`，`assertPublishableQa` 也不得因 temporal 拒稿或抛错。
- 源级断言：`publish-gate.ts` 不得把 `temporal` 传入 `CommandError` 或 `playabilityIssues`。

### 8. 证据 / 复核 / 回滚（Q6）

- 证据：`evidence/U5/`（`commands.log`、`test-output.txt`、`invariant-before.txt`、`invariant-after.txt`、回滚演练日志 + SHA-256）。
- 复核输入：`reports/U5-review-input.md`；复核报告：`reports/U5-review.md`；fresh 独立会话；逐项 `PASS / FAIL / NOT_RUN`；至少 2 条自选关键断言。
- **证据归档（沿用 U4 Q8）**：
  - 独立 evidence-only commit，只含 `.scratch/.../evidence/U5/` 与 `reports/U5-*`；
  - **不预先授权 `.scratch` 进入产品 PR**；
  - 若 PR 不含证据，保留在独立审计归档位置，通过路径、commit SHA、文件 SHA-256 引用；
  - U5 **必须完成回滚演练**：revert U5 commit，跑 `publish-gate.test.ts` + 全量 `pnpm test`，保留日志 / 退出码 / hash；演练状态不是交付状态。

### 9. 提交切片（Q6）

1. **代码 commit**：`publish-gate.ts` 类型、可选 `temporal` 字段、`configProblem` 结构化返回、U4 report 消费；
2. **测试 commit**：`publish-gate.test.ts` G1–G11 + 变异守卫；
3. **evidence-only commit**：`evidence/U5/` + `reports/U5-*` + 回滚演练证据。

brief 只写在本票 Answer；不另建 `reports/05-u5-brief.md`。

### 10. STOP

- 授权包 §11.3 的 12 条 STOP 全部适用。
- 任何白名单外文件、新依赖、`create-game.ts` / `create-game.test.ts` 改动、`runTemporalAudit` / U1 / U2 改动、时序证据变成 `ConfigIssue` / warning / error、新增 `throw` 路径、退出码变化、`temporal: undefined`、`{applicable:false}` 伪装未运行、legacy 字段进入诊断、`.scratch` 未经归档决定进入产品 PR ⇒ **STOP + HITL**。
- 若 U4 未完成签署 / 合并 / Ledger 更新 ⇒ 不得开始 U5。

### 11. 授权边界

本 brief **不构成 U5 实施授权**。执行前必须：

1. U4 完成复核 PASS、用户签署、合并、Ledger 更新；
2. 用户签署 `reports/U5-incremental-authorization.md`；
3. 授权 docs PR 合入 `main`；
4. 从更新后的 `main` 切 U5 分支；
5. 独立复核 PASS + 用户签署 + Ledger 更新。

`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；不产公共 NB / PU；`publicCapability` / `publicResult` 不变。

### 12. U5 最终执行边界

| 项目 | 结论 |
| --- | --- |
| `configProblem` | 结构化返回，分离拒稿与诊断 |
| temporal 执行时机 | 保留全部现有 early return |
| 字段缺席语义 | 未运行 |
| `applicable:false` | 已运行，但不适用 |
| `applicable:true` | 已运行且适用 |
| 证据来源 | U4 `TemporalAuditReport` 的公共结果 |
| existingAudit | 复用本次 audit，不重复三维审计 |
| 发布行为 | temporal 纯诊断，永不成为拒稿输入 |
| 测试 | 真实 fixture + fake report + 变异守卫 |
| 提交 | 代码、测试、证据三个独立切片 |
| 回滚 | 必须演练 |

### 13. 四条不可妥协的不变量

1. **拒稿不变**：原有硬失败、QA 拒稿路径和退出码保持不变。
2. **诊断不阻断**：temporal 的 PU、NB、IE 都不能改变发布准入。
3. **未运行不伪装**：缺席、`applicable:false`、`applicable:true` 三种状态严格区分。
4. **证据不越权**：发布闸只消费 U4 的公共 temporal evidence，不把 legacy 字段或内部 analyzer 结果当成发布判据。

## Comments

- 2026-11-16 I03-IMPL-04：U5 消费 U4 `TemporalAuditReport` 新字段；legacy 字段不作为诊断来源；U4 返回类型已冻结。
