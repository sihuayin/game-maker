# I03-IMPL-06 U3 执行 brief

Type: grilling
Status: resolved
Owner: claude (I03-IMPL-06 session 2026-11-16)
Blocked by: 05
Map: ../map.md
Class: I-03-IMPL / U3

## Question

为 **U3（contracts `mechanic.ts` gap 替换）** 产出一份可交接的执行 brief，至少覆盖：

- 授权包 §11.2 的 U3 逐文件白名单；fixture 只改 `wide-patrol` 行；
- 移除 `moving-hazard-phase` gap；temporal 层完整接管原诊断责任；
- 适用 / 非适用 / 缺失时序结果均不得出现诊断空窗或错误放行；`moving-platform-unsupported` 及其余 mechanic 语义不变；
- 受影响既有测试按新语义改写并保留负向覆盖；
- U3 专属门 + **回滚演练**；
- 独立复核输入、E1 / E2 / E3、不变量快照；
- **明确：本 brief 不写代码**。

## Answer

**Q1–Q7 = A。** 本 brief 是 U3 的规划，**不构成 U3 实施授权**。

**核心边界**：U3 移除机制层对 moving hazard 的旧 gap 判定，并验证公共聚合路径仍然保守；**不是**让 `auditPlayability` 自身继续伪造 IE，也**不是**开放公共 NB / PU。

### 0. Preconditions

U3 开始前必须：

1. U1、U2、U4、U5 已分别完成独立复核 PASS、用户签署、合并、Ledger 更新；
2. U3 取得独立增量授权记录 + docs PR 合入 `main`；
3. U3 分支从最新 `main` 切出，且只触碰白名单文件；
4. `wide-patrol` 旧 gap 移除、temporal takeover 测试通过、其他 mechanic 语义不变；
5. 回滚演练和独立复核全部完成，required AC 无 FAIL / NOT_RUN。

任何一项不满足 ⇒ 不能标记 U3 完成，也不能开放 `PUBLIC_NB` / `PUBLIC_PU`。

### 1. Scope / allowed files

**Scope**：`mechanic.ts` 移除 `moving-hazard-phase` gap；`wide-patrol` fixture 行；temporal takeover 测试；其他 mechanic 语义回归。

| 文件 | 操作 | 限定目的 |
| --- | --- | --- |
| `packages/contracts/src/playability/mechanic.ts` | 修改 | 移除 `moving-hazard-phase` gap |
| `packages/contracts/tests/playability-mechanic.test.ts` | 修改 | 按新语义改写，保留负向覆盖 |
| `packages/contracts/tests/fixtures/playability-mechanic-matrix.json` | 修改 | **仅 `wide-patrol` 行** |

- 只读 import：U1 类型 / U2 `mapPublicVerdict` / 第一阶段常量 / `auditPlayability`。
- 禁止：其他 fixture 行、`api.ts` / U1 / U2 / U4 / U5 改动、CLI / MCP / Runtime / probe / 新依赖 / 白名单外文件。

### 2. `mechanic.ts` 精确 diff（Q1）

- 删除 `const movingHazards = allHazards.filter((e) => e.motion);`；
- 删除 `if (movingHazards.length > 0) addGap("moving-hazard-phase");`；
- 更新注释：“moving hazard 由 temporal 层承载；moving-platform 仍记 `moving-platform-unsupported`”；
- 保留 `allHazards` / `staticHazards` / `movingSolids`；
- 不改其他 mechanic 行为。

### 3. `wide-patrol` fixture 行（Q2）

只改这一行：

- `expectedVerdict: "NO_PROVEN_BLOCKER"`
- `expectedJudgmentId: null`
- `expectedGap: null`
- `failureLocation: null`
- note：“机制层不再记 `moving-hazard-phase`；公共 IE 由 temporal 层 + U2 mapper 承担。”
- `legalPair` 不变；其余五行不动。

**`NO_PROVEN_BLOCKER` 仅描述机制层结果，不代表公共 Verdict 放行。**

### 4. Temporal takeover 测试（Q3）

在 `playability-mechanic.test.ts` 新增 `§U3：temporal 接管 moving hazard`：

1. `wide-patrol` 机制层不再产生 `moving-hazard-phase`；layer-local `NO_PROVEN_BLOCKER` + `checked`；evidence 为空。
2. `existing = auditPlayability(wide-patrol config, MANIFEST)`；确认机制层无旧 gap，layer-local 可为 NB / checked。
3. 构造 synthetic temporal evidence（符合 U1 **真实类型**、U2 mapper **实际输入契约**），用 `mapPublicVerdict` + `PHASE1_CAPABILITY_GATE` / `PHASE1_CAPABILITY_ADMISSION`：
   - applicable + `checked` + `nb-candidate` ⇒ 公共 IE；
   - applicable + `partial` / `unknown` ⇒ 公共 IE；
   - applicable 但无 evidence ⇒ `temporal:"unknown"` ⇒ 公共 IE；
   - not applicable（无移动 Hazard，如 `danger-wide-idle`）⇒ existing，无 temporal 字段。
4. 第一阶段 gate BLOCKED：公共路径不得产生 NB 或 PU。
5. synthetic evidence **不得 `as any`**，不得手工模拟 mapper 逻辑；必须走真实 `mapPublicVerdict`。
6. `playabilityIssues` 对公共 IE 为空；temporal evidence 非阻断。

### 5. 其他 mechanic 语义（Q4）

- 保留并断言 `moving-platform-unsupported`：clone `wide-patrol`，加入一个 moving solid；`auditMechanic` gaps 仍含该 gap，coverage `partial`。
- 静止 hazard / frame 几何的 `partial` 不变（`static-hazard-seals-path` 等现有矩阵 / 测试）。
- `danger` / `no-safe-window` 不变。
- 六例矩阵除 `wide-patrol` 外，其余行零改动。

### 6. 提交切片（Q5）

1. `mechanic.ts` + `wide-patrol` fixture 行；
2. `playability-mechanic.test.ts`：旧断言调整、temporal takeover、moving-platform 与其他语义回归；
3. **独立 evidence-only commit**：`evidence/U3/`、`reports/U3-*`、回滚演练记录。

第三个 commit **不得混入代码或测试变更**；`.scratch` 不因本裁定自动获准进入产品 PR。

### 7. 证据 / 复核 / 回滚（Q6）

- 证据：`evidence/U3/`（`commands.log`、`test-output.txt`、`invariant-before.txt`、`invariant-after.txt`、回滚演练日志 + SHA-256）。
- 复核输入：`reports/U3-review-input.md`；复核报告：`reports/U3-review.md`；fresh 独立 reviewer；逐项 `PASS / FAIL / NOT_RUN`；至少 2 条自选关键断言。
- **必须实际回滚演练**：在隔离 worktree / drill branch 中 revert U3 commit，跑 `playability-mechanic.test.ts` + 全量 `pnpm test`，保存命令、原始输出、退出码、hash；不污染交付分支。
- 证据独立 evidence-only commit；不预授权 `.scratch` 进入产品 PR。

### 8. Layer-local NB 与公共 IE 的边界（Q7）

| 层级 | `wide-patrol` 允许的结果 | 含义 |
| --- | --- | --- |
| `auditMechanic` / `auditPlayability` | `NO_PROVEN_BLOCKER` + `checked` | 机制层不再单独判定 `moving-hazard-phase` |
| 公共聚合层 | `INSUFFICIENT_EVIDENCE` | temporal 证据经过 U2 mapper，且第一阶段 gate BLOCKED |

- 测试必须**同时**断言“层内 NB / checked”与“公共 IE”，证明没有错误放行。
- `auditPlayability` **不**继续伪造 IE；公共 NB / PU **不**开放。

### 9. STOP

- 授权包 §11.3 的 12 条 STOP 全部适用。
- 任何白名单外文件、其他 fixture 行、`api.ts` / U1 / U2 / U4 / U5 改动、新增 gap、把 layer-local NB 当公共放行、公共 NB / PU 开放、未做 temporal takeover 证明、未做回滚演练、`.scratch` 未经归档决定进入产品 PR ⇒ **STOP + HITL**。
- 若 U1 / U2 / U4 / U5 未完成签署 / 合并 / Ledger 更新 ⇒ 不得开始 U3。

### 10. 授权边界

本 brief **不构成 U3 实施授权**。执行前必须：

1. U1 + U2 + U4 + U5 完成复核 PASS、用户签署、合并、Ledger 更新；
2. 用户签署 `reports/U3-incremental-authorization.md`；
3. 授权 docs PR 合入 `main`；
4. 从更新后的 `main` 切 U3 分支；
5. 独立复核 PASS + 用户签署 + Ledger 更新。

`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；`publicCapability` / `publicResult` 不变。

### 11. U3 最终执行边界

| 项目 | 裁定 |
| --- | --- |
| 机制层 | 移除 `moving-hazard-phase` gap；moving-platform 不变 |
| 层内结果 | `wide-patrol` 允许 NB + checked |
| 公共结果 | 经 U2 mapper + temporal coverage + gate BLOCKED ⇒ IE |
| Fixture | 仅 `wide-patrol` 行 |
| 测试 | temporal takeover + moving-platform + 其他语义回归 |
| 提交 | 3 个独立切片（含 evidence-only） |
| 复核 | fresh 独立 reviewer，逐项 PASS / FAIL / NOT_RUN |
| 回滚 | 必须实际演练，隔离 worktree / drill branch |
| 授权 | U1–U5 完成签署 / 合并 / Ledger 后，再单独授权 U3 |
