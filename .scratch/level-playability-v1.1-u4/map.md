# I02-U4：垂直规避图割（执行型 effort）

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-u4
Authority: [`docs/v7.8/移动-I02.md`](../../docs/v7.8/移动-I02.md) @ `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（已签署；U4 由 `BLOCKED` 转为本图待实施）
Incremental authorization: 用户 `amber` · 2026-11-12 · 指令原文「授权 U4 并开图」· 范围**仅 U4 实施 + R4 复核门 + `graph.ts` `HopSampling` 独立审批前置**（依据 R3 PASS 与 U3-SIGN 2026-11-12）；记录落点 `.scratch/level-playability-v1.1-i02/reports/05-u4-incremental-authorization.md`（U4-00 创建）
Baseline: `wayfinder/level-playability-v1.1-u3` @ `1405c3f`（含 U3 实现、R3 与 U3-SIGN）**+** `wayfinder/level-playability-v1.1-i02` @ `2241e11`（PR #37 合并，含 `HopSampling` 尾参）；**U3 尚未并入 i02**
Branch: `wayfinder/level-playability-v1.1-u4`
PR target: `wayfinder/level-playability-v1.1-i02`
Status: open · 2026-11-13 · PR #37 已合并（`2241e11`）；**U4 执行门解除，待 U4-04**

> **执行型 effort。** 本图 override wayfinder 默认的 plan-only：票是执行切片，不是纯决策。执行范围**严格等于**用户 2026-11-12 授权的 U4（I02-04：垂直规避图割）；不进入 U5，不改 `reach.ts`，不接生产，不发布公共 Verdict。
>
> **硬前置**：`graph.ts` 的 `HopSampling` 可选尾参必须**先取得独立书面增量审批、再以独立 PR 合并**。未合并前 U4 实施保持 `BLOCKED`；不得用测试专用实现、复制实现或其他路径绕过审批（D6 §3）。
>
> 任何新增文件 / 白名单外修改 / 扩 D9 闭集（含 `DegradationReason`）/ 需要修改 `reach.ts` 或跳跃公式 / 需要组装完整 `PermanentGateProof` 的情况 ⇒ STOP + HITL，不得由票自行扩权。
>
> **授权边界**：**R4 PASS ≠ U5 授权。** U4 完成不自动开放后续单元；`PUBLIC_NB` / `PUBLIC_PU` 仍为 `BLOCKED`；推送 / 建 PR / 合并仅在 U4-03 且收到用户明确指令时执行。

## Destination

**U4（垂直规避图割）实现完成，并通过独立 R4 复核及用户签署，地图收口。**

完成条件：

1. `graph.ts` `HopSampling` 尾参取得独立书面增量审批，并以独立 PR 先合并（合并需用户明确指令）。
2. U4 白名单内实现完成：`graphCut`（`verdict: "conditional"`）、`hopDoubling`（60 / 120Hz 双档）、`hopSamplingCoverage`、`movementModelClosure = "not-proven-air-control"`。
3. U4 定向测试 + `playability-graph.test.ts` 默认行为回归 + 全量 `pnpm test` 通过；D4 §11 反例 5、7–12 全覆盖。
4. `.scratch/level-playability-v1.1-i02/reports/R4-review.md` 逐项记录 `PASS / FAIL / NOT_RUN`。
5. 独立复核人自行检查 diff、重跑命令并完成复核。
6. 用户审阅并签署 R4。
7. 地图收口，不启动 U5。

**R4 未通过或用户未签署，地图不得标记完成。U4 完成不等于 U5 授权，也不等于公共 NB / PU 能力。**

## Notes

### 授权与范围

- 增量授权：用户 `amber` · 2026-11-12 · 指令原文「授权 U4 并开图」；依据 R3 PASS + U3-SIGN（2026-11-12）。
- **U4 在 `graph.ts` 独立审批通过并合并前保持 `BLOCKED`**（授权包 §7.3 / §7.4、D6 §3、D8 Q6/Q10）。
- U4 允许文件（逐文件，不得扩张）：
  - `packages/contracts/src/playability/temporal-evasion.ts`（新增）
  - `packages/contracts/tests/playability-temporal-evasion.test.ts`（新增）
  - `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，可扩展）
  - `packages/contracts/src/playability/graph.ts`（**仅** `HopSampling` 可选尾参；独立审批 + 独立 PR 合并后）
- 只读引用（不得修改）：`reach.ts`、`temporal-motion.ts`、`temporal-budget.ts`、`temporal-result.ts`、`geometry.ts`、`profile.ts`、`targets.ts`、`game-config.ts`。
- **`temporal.ts` 默认零改动**；任何 `temporal.ts` 修改（含最小编排 / dispatch）⇒ STOP + HITL，逐行列明后另行确认。
- 不授权：U5、A–J 矩阵、公共 Contract / barrel / package exports、Runtime / Pipeline / CLI / MCP、I-03 接线、新依赖、JSON fixture、`fixtures/packs/**`。
- 预算如需扩 `BudgetProfile` 或 `DegradationReason` 闭集 ⇒ STOP + HITL。
- 增量签署记录写入 `.scratch/level-playability-v1.1-i02/reports/05-u4-incremental-authorization.md`；`graph.ts` 独立审批记录写入 `.scratch/level-playability-v1.1-i02/reports/06-u4-graph-approval.md`；**不改已签署授权包**，`docs/v7.8/移动-I02.md` 的 SHA `797cd6fc…` 必须保持不变。

### `graph.ts` 独立审批（冻结）

- 仅允许 `hopSamples` / `hopEdges` / `hopTargets` 新增可选尾参 `HopSampling = { hz?: number; maxSamples?: number }`；默认 `{ hz: 60, maxSamples: 120 }`。
- 不得修改跳跃公式、既有采样语义、其他导出或调用语义；**`reach.ts` 不在范围**。
- 必须有回归测试证明显式传默认参数与无参调用行为一致；可序列化场景验证稳定序列化结果一致。
- 该审批独立于 I-00 R2，不得以「已列入白名单」推定获批。
- 变更走**独立分支、独立 PR**：先审批、合并，再由 U4 实施 PR 引用（授权包 §7.2、§7.3）。
- 未获批准：U4 停在 `BLOCKED`，不得以 scratch 分析替代正式实施与 R4。

### U4 输出边界（冻结）

`temporal-evasion.ts` 只实现**垂直规避图割半部**，对外输出限定为：

- `graphCut: { verdict: "conditional"; reachableFootpoints; goalIntersections; midAirHits; evidence }`
- `hopDoubling: { base; doubled; connectivityPreserved; normalizedCoverage }`
- `hopSamplingCoverage: { covered; method: "normalized" | "insufficient" }`
- `movementModelClosure: "not-proven-air-control"`
- `status: "COMPLETE" | "INCOMPLETE"`
- 失败原因（只取 D9 `DegradationReason` 闭集）

U4 **不生成、不伪造**：`puConditions`、`geometryCoverage`、`lagMode`、`lagInvariantByConstruction`、完整 `PermanentGateProof`、完整 `TemporalInternalResult`、`certificate`、公共 Verdict。完整组装留给 U5。

`temporal-evasion.ts` **不得** import `temporal.ts` 或 `temporal-gate.ts`（D6 DAG 未列 gate）；门区数据由调用方以显式几何传入。

### 冻结语义（引用）

- **D4 §4 图割判据**：精确 spawn 脚点格（不得用 `startCells()`）；`assessReachability(graph, move, [{ rect: goalRegion }], { full: true })`；检查 `covered` / `midAir`；`midAirHits = 0` **只作否决证据**，永不作为正面证明；`graphCut.verdict` 只能 `"conditional"`。
- **D4 §5–§6 hop 双档**：主档 `{60,120}`、倍档 `{120,240}`；两档各自独立跑完整可达性检查；验证 `F1 ⊆ F2`（整数交叉乘，不用浮点容差）；**不要求 `n_double = 2·n_prime`**；记录每档 `n` / 端点 / cap；cap 绑定、双档不一致、连通性改变 ⇒ `INCOMPLETE`。
- **D4 §7 模型闭合**：`movementModelClosure = "not-proven-air-control"`；`scene.ts:89` 空中水平控制未闭合；图割不连通不得写成 Runtime 不可达；生产 PU 不授权。
- **D4 §11 反例 5、7–12**：U4 / R4 必须覆盖（1–4、6、13 已由 U3 / R3 覆盖，不得回归）。
- **D9 契约**：字段与闭集冻结；`puConditions` 六条不得用布尔替代（U5）。
- **降级原因映射（冻结，不新增码）**：
  - `hop-sample-budget` ← 任一档 cap 绑定；
  - `hop-doubling-changed` ← `F1 ⊆ F2` 不可证明 / 双档不一致 / 连通性改变；
  - `graph-cut-incomplete` ← 图割未完成 / 任一档目标可达；
  - `movement-model-unclosed` ← 模型闭合失败；
  - `geometry-untrusted` ← 输入几何不可信。
- **预算**：`maxHopSamples = 240 / arc`；U4 与 U2 预算独立；不得按关卡配置预算。
- **D6 DAG**：`temporal-evasion.ts` 只依赖 `temporal-result.ts` / `temporal-budget.ts` / `temporal-motion.ts`，并只读消费 `graph.ts` / `reach.ts` 既有符号。

### 执行形态

- 一票一 commit：`U4-0x: …`；每张实现票一个独立会话。
- 依赖：U4-00 → U4-01 → U4-02 → U4-03 → U4-04 → U4-05 → U4-06 → U4-07 → U4-08 → U4-09 → U4-R4 → U4-SIGN。
- `graph.ts` 尾参：U4-01 只出审批包，U4-02 在**独立分支**实现并本地验证，U4-03 才在有明确指令时推送 / 建 PR / 合并。
- R4 复核会话必须与实现会话隔离；不得读作者总结 / PASS 结论 / 调试笔记。
- U4-09 准备 Draft PR 描述与证据，但**不推送、不创建 PR**。
- 不自动合并；R4 通过 + 用户签署后才讨论 PR 后续。
- U3 尚未并入 i02：u4 分支已 merge i02 @ `2241e11`（保留 U3 提交）；U3 合并后，U4 PR 只需呈现本单元增量。

### 冻结的扫描约束

新模块必须继续通过既有架构断言：

- T-55：contracts `src` 不引 `node:fs` / `node:crypto`；
- T-57：不新增 `auditPlayabilityTemporal(` 的生产调用者；
- T-58：生产 `analyze:` 实参仍只有 `stubTemporalAnalyzer`；
- T-61：三处生产接线不变；
- T-62：不新增 `TEMPORAL_LAG_*` 同名常量；
- T-64：不出现 `Symbol(`；
- 新模块不得出现 `analyze:` 属性标签；
- `temporal-evasion.ts` **不得** import `temporal.ts` / `temporal-gate.ts`；
- 不新增公共 barrel 导出；`temporal-result.ts` 不得反向导入 evasion。

### 命令

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-temporal-evasion.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts
pnpm exec vitest run packages/contracts/tests/playability-graph.test.ts
pnpm test
```

### 证据落点

- 实现证据 / 临时材料 / 实现报告：`.scratch/level-playability-v1.1-u4/`。
- `graph.ts` 独立审批记录：`.scratch/level-playability-v1.1-i02/reports/06-u4-graph-approval.md`。
- 正式 R4 报告（唯一权威）：`.scratch/level-playability-v1.1-i02/reports/R4-review.md`。
- 证据格式沿用 E1 / E2 / E3；逐项 `PASS` / `FAIL` / `NOT_RUN`，不得用总通过率替代。

### 依赖图

```text
U4-00 初始化与授权台账
  └─ U4-01 graph.ts HopSampling 独立审批
       └─ U4-02 尾参实现与默认行为回归（独立分支）
            └─ U4-03 独立 PR 推送与合并门（用户明确指令）
                 └─ U4-04 图割模块 API 骨架与输入契约
                      └─ U4-05 图割判据与 reach 消费
                           └─ U4-06 hop 双档与规范化采样覆盖
                                └─ U4-07 模型闭合、降级映射与输出边界
                                     └─ U4-08 测试矩阵与 D4 反例 5、7–12
                                          └─ U4-09 回归 / 白名单审计 / R4 输入包
                                               └─ U4-R4 独立复核
                                                    └─ U4-SIGN 用户签署
```

## Decisions so far

- [U4-00 初始化、授权台账与基线](issues/01-u4-00-init.md): 基线全绿（build/typecheck 0；174 files / 2795 tests）；增量授权 05 就绪，仅 U4 实施 + R4 + `graph.ts` 审批前置；U4 执行门仍 `BLOCKED`；R4 协议已冻结。
- [U4-01 graph.ts HopSampling 独立增量审批](issues/02-u4-01-graph-approval.md): 用户 `amber` 2026-11-12 批准（命名导出）；仅三项 hop 函数可选尾参，默认 `{60,120}` 逐点不变；`HopSampling` 经 internal barrel 可见但不进包根；U4 执行门仍 `BLOCKED`，待独立 PR 合并。
- [U4-02 graph.ts HopSampling 尾参实现与默认行为回归](issues/03-u4-02-graph-param-impl.md): 独立分支 `wayfinder/level-playability-v1.1-u4-graph-hop` @ `13b4e3b`；仅 `graph.ts` + 5 条默认等价断言；build/typecheck 0，evasion 5/5，全量 174 files / 2752 tests；**未推送**；U4 执行门仍 `BLOCKED`。
- [U4-03 graph.ts 尾参独立 PR 推送与合并门](issues/04-u4-03-graph-merge-gate.md): [PR #37](https://github.com/sihuayin/game-maker/pull/37) CI 全绿后合并（`2241e11`，2026-11-13）；u4 分支已并入 i02（`b884a35`）；合并后全量 175 files / 2800 tests 绿。**U4 执行门解除。**

## Not yet specified

<!-- 路线由已签署授权包 §3.7 / §7.2 / §9.4、D4 §4–§7、D6 §3、D9 冻结；无已知雾区。任何新增文件 / 扩权需求 = STOP + HITL，不在此处自行毕业。 -->

## Out of scope

- **U5**：预算 / 确定性硬化、A–J 矩阵、性能基准、最终集成与完成报告。
- **完整 `PermanentGateProof` / `TemporalInternalResult` 组装**与 `certificate` 顶层断言（A–J F 行）。
- **`puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` 的组装与状态判定**（U5）。
- **`reach.ts` 的任何修改或参数化**（含把 mid-air 检查改成双档）。
- **跳跃公式 / 既有采样语义的修改**；只允许 `HopSampling` 可选尾参。
- **`temporal.ts` 修改**（含最小编排与 `analyzeTemporalInternal` 派发）——需 STOP + HITL。
- **I-03 生产接入**：`coverage.temporal`、`mechanic.ts` / `api.ts` 接线、公共 Verdict 聚合。
- **公共 Contract / Runtime / Pipeline / CLI / MCP / 持久化 / 新依赖 / JSON fixture / `fixtures/packs/**`。**
- **生产 PU 与公共 `PUBLIC_NB` / `PUBLIC_PU`**：模型闭合未证明，仍 `BLOCKED`。
- **推送、建 PR、合并、i02 → main**：除 U4-03 的 `graph.ts` 合并门在收到明确指令后执行外，其余另行明确指令。
- **修改已签署授权包 / I-00 / I-02 原文**（增量授权只写独立记录，不改原包）。
- **把 U4 完成写成 U5 授权或公共 NB / PU 能力。**
