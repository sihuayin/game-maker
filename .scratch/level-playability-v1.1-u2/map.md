# I02-U2：安全通过 Witness 实现（执行型 effort）

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-u2
Authority: [`docs/v7.8/移动-I02.md`](../../docs/v7.8/移动-I02.md) @ `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（已签署；首次签署仅放行 U1）
Incremental authorization: 用户 `amber` · 2026-11-12 · 指令原文「授权 U2 及其复核门」· 范围**仅 U2 实施 + R2 复核门**（依据 R1 PASS 2026-11-12）；记录落点 `.scratch/level-playability-v1.1-i02/reports/03-u2-incremental-authorization.md`（U2-00 创建）
Baseline: `wayfinder/level-playability-v1.1-i02` @ `23a2027`（已含签署 U1）
Branch: `wayfinder/level-playability-v1.1-u2`
PR target: `wayfinder/level-playability-v1.1-i02`
Status: open · 2026-11-12 开图

> **执行型 effort。** 本图 override wayfinder 默认的 plan-only：票是执行切片，不是纯决策。执行范围**严格等于**已签署授权包的 U2（I02-02：安全通过 Witness）；不进入 U3–U5，不接生产，不发布公共 Verdict。
>
> 任何新增文件 / 白名单外修改 / 需要扩 D9 闭集的情况 ⇒ STOP + HITL，不得由票自行扩权。
>
> **授权边界**：本图只放行 U2 实施与其 R2 复核门。R2 通过**不等于** U3 授权；U3 需要 R2 PASS + 另行增量签署。`PUBLIC_NB` / `PUBLIC_PU` 仍为 `BLOCKED`。推送 / 合并 / i02 → main 仍需另行明确指令。

## Destination

**U2（安全通过 Witness）实现完成，并通过独立 R2 复核及用户签署。**

完成条件：

1. U2 白名单内代码实现完成：状态格、静态走廊、精确 spawn、`wait` / `move`、S1–S4、U9、全相位 Winning Set、终止性、Witness 编码与体积。
2. U2 定向测试 + 全量 `pnpm test` 通过。
3. `.scratch/level-playability-v1.1-i02/reports/R2-review.md` 逐项记录 `PASS / FAIL / NOT_RUN`。
4. 独立复核人自行检查 diff、重跑命令并完成复核。
5. 用户审阅并签署 R2。
6. 地图收口，不启动 U3。

**R2 未通过或用户未签署，地图不得标记完成。U2 完成不等于公共 NB 能力。**

## Notes

### 授权与范围

- 增量授权：用户 `amber` · 2026-11-12 · 范围仅 U2 + R2；依据 R1 PASS（2026-11-12）。
- U2 允许文件（逐文件，不得扩张）：
  - `packages/contracts/src/playability/temporal-witness.ts`（新增）
  - `packages/contracts/tests/playability-temporal-witness.test.ts`（新增）
  - `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，可扩展）
- 只读引用（不得修改）：`graph.ts`、`reach.ts`、`targets.ts`、`profile.ts`、`game-config.ts`、`temporal-motion.ts`、`temporal-budget.ts`、`temporal-result.ts`、`geometry.ts`。
- 不授权：修改 `temporal.ts`（U2 不实现 `analyzeTemporalInternal`，测试直接调用 witness 模块）、修改 `temporal-budget.ts` / `temporal-result.ts`、U3–U5、`graph.ts` 尾参、Pipeline / Runtime / CLI / MCP / 公共 Contract / 新依赖 / JSON fixtures / `fixtures/packs/**`。
- 预算如需扩 `BudgetProfile` 或 D9 闭集 ⇒ STOP + HITL。
- 推送 / 合并 / i02 → main 不在本图授权内；需要另行明确指令。
- 增量签署记录写入 `.scratch/level-playability-v1.1-i02/reports/03-u2-incremental-authorization.md`；**不改已签署授权包**，`docs/v7.8/移动-I02.md` 的 SHA `797cd6fc…` 必须保持不变。

### 冻结语义（引用）

- **D3 §1–§11**：状态 `(footX, k)`、`wait` / `move`、S1–S4、静态走廊、精确 spawn、0.5px 内缩到达谓词、残差等待、终止性、Witness 形状、13 条反例。
- **D10 §1–§5**：U9 四项、全相位 Winning Set 最小不动点 `μX.(Goal ∪ Pre∃(X))`、严格递减 rank / 有限轨迹、组合语义、体积六条件。
- **授权包 §3.5 / §6.2 / §9.2**；A–J 矩阵（`playability-temporal.test.ts`）归 U5，不在 U2。
- 预算：`maxStates` / `maxEdges` / `maxCutsPerBranch`（**segments**）/ `maxWitnessTransitions` / `maxWitnessBytes`；两档 lag 独立，禁止共享 / 拼接。

### 执行形态

- 一票一 commit：`U2-0x: …`；每张实现票一个独立会话。
- 依赖：U2-00 → U2-01 → U2-02 → U2-03 → U2-04 → U2-05 → U2-06 → U2-07 → U2-R2 → U2-SIGN。
- U2-04（U9）复用 U2-03（W）的搜索，故排在 W 之后。
- R2 复核会话必须与实现会话隔离；不得读作者总结 / PASS 结论 / 调试笔记。
- U2-07 准备 Draft PR 描述与证据，但**不推送、不创建 PR**。
- 不自动合并；R2 通过 + 用户签署后才讨论 PR 后续。

### 冻结的扫描约束

新模块必须继续通过既有架构断言：

- T-55：contracts `src` 不引 `node:fs` / `node:crypto`；
- T-57：不新增 `auditPlayabilityTemporal(` 的生产调用者；
- T-58：生产 `analyze:` 实参仍只有 `stubTemporalAnalyzer`；
- T-61：三处生产接线不变；
- T-62：不新增 `TEMPORAL_LAG_*` 同名常量；
- T-64：不出现 `Symbol(`；
- 新模块不得出现 `analyze:` 属性标签；
- `temporal-witness.ts` **不得** import `temporal.ts`（D6 DAG；否则循环）；
- 不新增公共 barrel 导出。

### 命令

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-temporal-witness.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts
pnpm test
```

### 证据落点

- 实现证据 / 临时材料 / 实现报告：`.scratch/level-playability-v1.1-u2/`。
- 正式 R2 报告（唯一权威）：`.scratch/level-playability-v1.1-i02/reports/R2-review.md`。
- 证据格式沿用 E1 / E2 / E3；逐项 `PASS` / `FAIL` / `NOT_RUN`，不得用总通过率替代。

### 依赖图

```text
U2-00 初始化与授权台账
  └─ U2-01 状态格 / 静态走廊 / 精确 spawn / 目标状态
       └─ U2-02 wait / move、S1–S4 与预算计数
            └─ U2-03 全相位 Winning Set 与终止性
                 └─ U2-04 U9 证书
                      └─ U2-05 Witness 编码、体积与确定性
                           └─ U2-06 测试矩阵与 D3 §11 反例
                                └─ U2-07 回归 / 白名单审计 / 实现报告
                                     └─ U2-R2 独立复核（独立会话）
                                          └─ U2-SIGN 用户签署
```

## Decisions so far

<!-- 索引：每张已关闭票一行；细节在票里。 -->

- 2026-11-12 · **U2-00 初始化 / 授权台账 / 基线** — `resolved`；授权包 SHA `797cd6fc…` 不变；基线全绿（`pnpm test` 172 files / 2674 tests，2 条已知 RPC 超时）；产品目录零改动 → [票](issues/01-u2-00-init.md) · [证据](evidence/00-baseline.md)。U2-01 unblocked。
- 2026-11-12 · **U2-01 状态格 / 静态走廊 / 精确 spawn / 到达** — `resolved`；新增 `temporal-witness.ts`（唯一产品改动）：`xStep=1`、`N`/`N_max`/容量/`phaseGridCapped`、`standable-run` 走廊（合法范围裁剪）、`boxFromFoot` 精确 spawn、取整 Goal Rect 内缩 0.5px 到达；失败只用 D9 闭集原因码（`spawn-not-standable` 记为 `gap`，不扩闭集）；build / typecheck / input 65/65 全绿 → [票](issues/02-u2-01-grid-corridor-spawn.md)。U2-02 unblocked。
- 2026-11-12 · **U2-02 wait / move、S1–S4 与预算计数** — `resolved`；`temporal-witness.ts` 只增：`(footX,k)` 转移（wait / move、`|Δx| ≤ maxStep`、整周期偏移）、S1 扫掠并集连续静态检查、S2 折返点切段 + 分段方向 `lagPad` 的保守加宽盒逐段 `intersectContinuous`、S3 单相位格、S4 链式连续、残差等待整格覆盖（`symbolic / conservative-over-cell`）、`createWitnessWorkBudget`（分列 `statesEnqueued` / `statesVisited` / `edgesChecked`，按 `segmentsTotal` 执行 `maxCutsPerBranch`，墙钟仅 abort）；build / typecheck / input 65/65 全绿 → [票](issues/03-u2-02-wait-move.md)。U2-03 unblocked。

## Not yet specified

<!-- 路线由已签署授权包 D3 / D10 / §3.5 / §9.2 冻结；无已知雾区。任何新增文件 / 扩权需求 = STOP + HITL，不在此处自行毕业。 -->

## Out of scope

- **U3–U5**：永久门区、垂直规避图割、预算硬化 / 性能基准 / 最终集成。
- **I-03 生产接入**：`coverage.temporal`、`mechanic.ts` / `api.ts` 接线、公共 Verdict 聚合。
- **`analyzeTemporalInternal` 与 `temporal.ts` 修改**（U2 只产出 Witness 模块；入口归 U5 / 后续）。
- **A–J 矩阵**（`playability-temporal.test.ts`）与跨单元组合。
- **公共 Contract / Runtime / CLI / MCP / Pipeline / 持久化 / 新依赖。**
- **`graph.ts` 尾参、`profile.ts`、`temporal-input.ts`、`ops.ts`、`packages/demo/**`。**
- **推送、合并、i02 → main**（另行明确指令）。
- **修改已签署授权包 / I-00 / I-02 原文**（增量授权只写独立记录，不改原包）。
- **把 U2 完成写成公共 NB / PU 能力。**
