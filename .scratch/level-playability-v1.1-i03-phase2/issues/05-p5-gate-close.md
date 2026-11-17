# P5 · Global gate close brief

Type: grilling
Status: resolved
Owner: claude (P5 session 2026-11-17)
Blocked by: 04
Map: ../map.md
Class: I-03-Phase2 / P5

## Question

为 P5 产出一份可交接的执行 brief：如何实现 capability gate 状态、假 NB / 假 PU 的全局关闭、证据基线失效与关闭优先，且保持 `PublicVerdictResult` 形状不变？

必须覆盖：`packages/contracts/src/playability/capability-gate.ts`；测试与矩阵；`public-verdict.ts` 仅最小接线；`api.ts` 仅导出；gate `BLOCKED` 时 admission 成功不得放行；关闭优先于缓存 / 历史 / 逐关；NB / PU 两 gate 独立负路径；若需改 `PublicVerdictResult` ⇒ STOP；回滚。

约束：见 `reports/00-execution-protocol.md` §7 与 annex §7；P5 不依赖 P3 / P6。

## Answer

**Q1–Q12 = 用户全部采纳（2026-11-17）。** 本 brief 冻结 P5 的执行边界；**不构成 P5 实施授权**。

### 1. 目标与前置

P5 只实现**关闭机制**：一旦全局能力被确认假 NB / 假 PU，或证据基线失效，任何声明 `OPEN`、缓存、历史产物、逐关准入都不得放行。P5：

- 不决定“何时可以 `OPEN`”，不实现`WIRED / ADMITTED / OPEN` 阶段机，不提供重新打开入口；
- 不修改 `public-verdict.ts` / `verdict.ts` / `ops.ts` / `pipeline/**`；生产继续使用 `PHASE1_CAPABILITY_GATE`；
- 不接收 admission，不把 P4 的 `admitted` 预先接成放行路径；
- 不依赖 P3 / P6，不读取任何 probe 结果。

实施前置：P4 合并 + 独立复核 + 用户签署 + Ledger；用户另行签署 P5 增量授权记录。

### 2. 模块与导出面

新文件：`packages/contracts/src/playability/capability-gate.ts`。

```ts
export type CapabilityAxis = "nb" | "pu";
export type EvidenceBaselineAxis =
  | "algorithmVersion" | "geometryBaseline" | "proofRulesVersion" | "fixtureVersion";
export type EvidenceBaselineTuple = {
  readonly algorithmVersion: string;
  readonly geometryBaseline: string;
  readonly proofRulesVersion: string;
  readonly fixtureVersion: string;
};
export type InvalidatedBaseline = {
  readonly axis: EvidenceBaselineAxis;
  readonly value: string;
};
export type CapabilityGateCloseReason =
  | "false-nb" | "false-pu" | "manual-close" | "evidence-baseline-invalidated";
export type CapabilityGateCloseEvent =
  | { readonly reason: "false-nb"; readonly axis: "nb" }
  | { readonly reason: "false-pu"; readonly axis: "pu" }
  | { readonly reason: "manual-close"; readonly axis: CapabilityAxis }
  | {
      readonly reason: "evidence-baseline-invalidated";
      readonly axis: CapabilityAxis;
      readonly invalidated: readonly [InvalidatedBaseline, ...InvalidatedBaseline[]];
    };
export type CapabilityGateInput = {
  readonly declared: PublicCapabilityGate;   // 仅 type import，可被削弱
  readonly baselines: Readonly<Record<CapabilityAxis, EvidenceBaselineTuple>>;
  readonly closes: readonly CapabilityGateCloseEvent[];
};
export type CapabilityGateCloseRecord = {
  readonly axis: CapabilityAxis;
  readonly reason: CapabilityGateCloseReason;
  readonly matched?: readonly InvalidatedBaseline[];
};
export type CapabilityGateResolution = {
  readonly version: "capability-gate/v1";
  readonly gate: PublicCapabilityGate;
  readonly closed: readonly CapabilityGateCloseRecord[];
};
export function resolveCapabilityGate(input: CapabilityGateInput): CapabilityGateResolution;
```

- `PublicCapabilityGate` 只做 type import，避免 `public-verdict.ts ↔ capability-gate.ts` 运行期环。
- `api.ts` **仅追加导出**；不新增可变状态、不引入 I/O。
- 不导出自动的 `admitted → CapabilityAdmission` 映射；跨单元边界见 §10。

### 3. 判定语义

- **单调削弱**：`resolveCapabilityGate` 只把 `OPEN` 变成 `BLOCKED`，永不把 `BLOCKED` 变成 `OPEN`。
- **关闭优先**：`declared` 为 `OPEN`，只要该轴存在任一有效关闭事件，结果即 `BLOCKED`。
- **NB / PU 独立**：`false-nb` 只关 `nb`，`false-pu` 只关 `pu`；`manual-close` / 基线失效按事件的 `axis` 关闭。关 nb 不改变 pu，反之亦然。
- **无重开入口**：同一轴一旦关闭，后续事件不改变结果；重新开放属于 scope 外的阶段 3。
- **缓存 / 历史 / 逐关**：P5 不为它们设输入通道；它们只能作为“声明 `OPEN`”进入 `declared`，因此无法覆盖关闭。测试用 `declared: "OPEN"` + 关闭事件复现这些场景。
- **事件合法性**：§2 的判别联合在类型层排除 `false-nb` 配 `pu`、`false-pu` 配 `nb`；运行期遇到类型外畸形事件（cast / 数据）⇒ **忽略、不改变状态、不记录**，不 throw；`invalidated` 为空数组 ⇒ 无匹配、不关闭。
- **去重与顺序**：同一轴多个有效关闭事件，只记录**输入顺序第一条**；`closed` 固定按 `nb` → `pu` 输出，保证同输入逐字节一致。
- **审计**：关闭记录含 `axis` / `reason`；`evidence-baseline-invalidated` 额外含 `matched`（实际命中的 `{axis, value}` 列表）。不新增自由文本 `detail`。

### 4. 证据基线失效匹配

- 四轴值均为**不透明非空字符串**；P5 不解析、不格式化、不做规范化；调用方提供规范值（hash / composite id）。
- 匹配规则：事件 `invalidated` 中**任一** `{axis, value}` 与目标轴 `baselines[axis]` 逐字相等 ⇒ 关闭该轴（保守：不默认豁免其他关卡对同一失效值的依赖）。
- 未列出的轴、未匹配的值不改变状态。
- 失效值 `""` 不与任何基线匹配（空值视为无匹配）。
- 模块不新增 `*_HASH` 常量；矩阵文件 SHA-256 只进证据与 Ledger。

### 5. `public-verdict.ts` 零 diff

现有 `mapPublicVerdict` 已接收 `PublicCapabilityGate`；P5 的解析结果结构上可直接传入，无需改动 mapper。授权记录白名单可保留 `public-verdict.ts` 但注明**预期零 diff**。若实施中发现必须改动 ⇒ STOP。

生产两处调用（`ops.ts:1055`、`ops.ts:1131`）继续硬编码 `PHASE1_CAPABILITY_GATE` / `PHASE1_CAPABILITY_ADMISSION`；P5 不接生产。

### 6. 夹具矩阵

`packages/contracts/tests/fixtures/playability-capability-gate-matrix.json`：

- `version: "capability-gate-matrix/v1"`；
- 固定 **10 行**场景：① phase-1 `BLOCKED/BLOCKED`；② 声明 `OPEN/OPEN` 无关闭 ⇒ 保持；③ `false-nb` 只关 nb；④ `false-pu` 只关 pu；⑤ 声明 OPEN + `false-nb` ⇒ nb 关闭、pu 保持；⑥ 声明 OPEN + `false-pu` ⇒ pu 关闭、nb 保持；⑦ `geometryBaseline` 失效匹配 nb ⇒ nb 关闭；⑧ `fixtureVersion` 失效匹配 pu ⇒ pu 关闭；⑨ 失效值不匹配 ⇒ 不改变；⑩ 双关闭独立记录；
- 每行 `{ id, input, expect: { gate, closed } }`；
- 矩阵只驱动 resolver；公共组合放在测试块（§7 ④）；
- 不套用 P4 的 `variesFrom` 单变量规则：P5 行是独立场景，不是单条件变异。

### 7. 测试

新文件：`packages/contracts/tests/playability-capability-gate.test.ts`，六个 describe 块：

1. **矩阵行驱动**：10 行断言 `gate` 与 `closed`（含顺序、去重、`matched`）。
2. **事件合法性**：畸形事件忽略、空 `invalidated` 忽略、重复关闭首条胜出。
3. **独立与关闭优先**：声明 `OPEN` + 关闭 ⇒ `BLOCKED`；关 nb 不影响 pu，反之亦然；无重开入口。
4. **公共组合（未修改的 `mapPublicVerdict`）**：admission 成功 + `PHASE1_CAPABILITY_GATE` ⇒ 公共 IE；假设 `OPEN` + `{ nb: true }` ⇒ `NO_PROVEN_BLOCKER`；PU 对称。
5. **基线失效细节**：任一列出轴值匹配即关闭；未匹配不关；四轴逐字比较；空值不匹配。
6. **不可变性与导出面**：输入对象及嵌套数组未被修改；`api.ts` 追加导出可用；`PHASE1_CAPABILITY_GATE` 仍 `BLOCKED/BLOCKED` 且 frozen。

目标命令：`pnpm vitest run packages/contracts/tests/playability-capability-gate.test.ts`。

### 8. 白名单

仅允许：

- 新 `packages/contracts/src/playability/capability-gate.ts`
- 新 `packages/contracts/tests/playability-capability-gate.test.ts`
- 新 `packages/contracts/tests/fixtures/playability-capability-gate-matrix.json`
- `packages/contracts/src/playability/api.ts`（仅追加导出）

`public-verdict.ts` / `verdict.ts` / `ops.ts` / `pipeline/**` 零 diff；既有测试断言零修改；`PHASE1_CAPABILITY_GATE` / `PHASE1_CAPABILITY_ADMISSION` 未变。

### 9. STOP

1. 改动超出 §8 白名单；
2. `public-verdict.ts` / `verdict.ts` / `ops.ts` / `pipeline/**` 出现任何 diff；
3. 既有测试断言被修改或放宽；
4. 矩阵行数 ≠ 10；
5. 出现主动 `OPEN` 或重新打开入口；
6. resolver 引入文件 I/O、新依赖、可变状态或 throw；
7. 为让测试通过而修改关闭 / 失效语义；
8. `PHASE1_CAPABILITY_GATE` 变化；
9. 空失效值被当成匹配；
10. 回滚演练未全绿。

任一 STOP ⇒ HITL；不得自行缩范围或改写历史记录。

### 10. 与 P4 brief 的边界收敛

P4 brief §2 写了“P5 负责把 `admitted` 映射为 `CapabilityAdmission.nb`”。在 P5 的 Q3 / Q5 裁定下，该映射收敛为：调用方显式构造 `{ nb: admitted, pu: false }`；P5 **不导出**自动映射、不接生产、不修改 `public-verdict.ts`。P5 只在测试中用未修改的 mapper 证明“admission 成功 + gate `BLOCKED` ⇒ 公共 IE”。

### 11. 交付、证据与回滚

- 实施分支：`wayfinder/i03-phase2-p5-impl`（授权后从更新后的 `main` 切出）；实施 PR 合入 `main`，含代码 / 测试 / 夹具 / `reports/P5-review.md`。
- 证据分支：`wayfinder/i03-phase2-p5-evidence`；raw 证据不随实施 PR 进入 `main`。
- 证据目录：`.scratch/level-playability-v1.1-i03-phase2/evidence/phase2/P5/`，固定文件：
  `commands.log`、`matrix-sha256.txt`、`test-target.txt`、`test-full.txt`、`typecheck.txt`、`check.txt`、`invariant-before-after.txt`、`rollback/target-or-full-test.txt`、`rollback/typecheck.txt`、`rollback/check.txt`、`SHA256SUMS`。
- 提交顺序：先实施 commit，再 evidence commit；`commands.log` 记录实施 SHA 与分支基点 `main` SHA。
- **invariant**：除 `capability-gate.ts` / 测试 / 矩阵 / `api.ts` 追加导出外，产品文件零 diff；重点 `public-verdict.ts` / `verdict.ts` / `ops.ts` / `pipeline/**` 零 diff；既有测试文件零修改；两个 phase-1 常量未变。
- **回滚演练**：从实施分支 tip 切一次性 `p5-rollback-drill`，`git revert --no-edit <impl-commit>`；依次跑目标测试（记录测试文件随 revert 消失）、全量 `pnpm test`、`pnpm typecheck`、`pnpm check`；全部退出码 0 才通过；演练分支用完即弃。

### 12. 复核、签署与 Ledger

- fresh reviewer 未参与 P5 实施；报告固定 `.scratch/level-playability-v1.1-i03-phase2/reports/P5-review.md`。
- 固定章节：独立性 / 日期与环境 / 输入（实施 SHA、矩阵 hash）/ 10 行矩阵逐项 / 事件合法性与去重 / 关闭优先与公共组合 / 基线失效匹配 / invariant 零 diff / 限制（P5 不开放任何能力，`OPEN` 仅为输入）/ 结论 `PASS|FAIL` + 用户签署行。
- 复核 PASS + 用户签署后，P5 才算完成；Ledger P5 行填：实施 SHA、evidence commit SHA、矩阵 hash、复核报告 hash、批准人、日期、回滚目标 = 分支基点 `main` SHA、演练证据路径。
- 本 brief 不构成 P5 实施授权。

### 13. 授权顺序

1. P4 合并 + 独立复核 + 用户签署 + Ledger；
2. 用户签署 P5 增量授权记录（引用 annex §7 与本 brief）；
3. docs-only PR 合入 `main`；
4. 从更新后的 `main` 切 `wayfinder/i03-phase2-p5-impl`；
5. 实施 / 证据；
6. fresh 复核 PASS；
7. 用户签署；
8. 实施 PR 合并；
9. 独立 Ledger 行。

本会话未写产品代码、未创建实施 / 证据分支、未运行测试。

## Comments

- 2026-11-17：grilling 两轮 Q1–Q12 全部裁定 A；brief 冻结。P5 实施仍待 P4 完成 + P5 增量授权。
