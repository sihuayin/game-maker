# I02-U3：永久门区证明（执行型 effort）

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-u3
Authority: [`docs/v7.8/移动-I02.md`](../../docs/v7.8/移动-I02.md) @ `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（已签署；U3 原为 `PLANNED`）
Incremental authorization: 用户 `amber` · 2026-11-12 · 指令原文「授权 U3 及其复核门」· 范围**仅 U3 实施 + R3 复核门**（依据 R2 PASS 2026-11-12 与用户签署）；记录落点 `.scratch/level-playability-v1.1-i02/reports/04-u3-incremental-authorization.md`（U3-00 创建）
Baseline: `wayfinder/level-playability-v1.1-i02` @ `c0d6981`（已含 U1、U2；U2 经 PR #34 并入）
Branch: `wayfinder/level-playability-v1.1-u3`
PR target: `wayfinder/level-playability-v1.1-i02`
Status: open · 2026-11-12 开图

> **执行型 effort。** 本图 override wayfinder 默认的 plan-only：票是执行切片，不是纯决策。执行范围**严格等于**已签署授权包的 U3（I02-03：永久门区证明）；不进入 U4–U5，不改 `graph.ts` / `reach.ts`，不接生产。
>
> 任何新增文件 / 白名单外修改 / 需要扩 D9 闭集 / 需要组装完整 `PermanentGateProof` 的情况 ⇒ STOP + HITL，不得由票自行扩权。
>
> **授权边界**：本图只放行 U3 实施与其 R3 复核门。**R3 PASS ≠ U4 授权。U4 必须另行增量授权；U3 的完成不自动开放后续单元。** `PUBLIC_NB` / `PUBLIC_PU` 仍为 `BLOCKED`。推送 / 建 PR / 合并 / i02 → main 仍需另行明确指令。

## Destination

**U3（永久门区证明）实现完成，并通过独立 R3 复核及用户签署，地图收口。**

完成条件：

1. U3 白名单内代码实现完成：门区闭式（`L/R/width`）、全周期覆盖、判侧规则、`forbiddenInjection`。
2. U3 定向测试 + 全量 `pnpm test` 通过。
3. `.scratch/level-playability-v1.1-i02/reports/R3-review.md` 逐项记录 `PASS / FAIL / NOT_RUN`。
4. 独立复核人自行检查 diff、重跑命令并完成复核。
5. 用户审阅并签署 R3。
6. 地图收口，不启动 U4。

**R3 未通过或用户未签署，地图不得标记完成。U3 完成不等于 U4 授权，也不等于公共 NB / PU 能力。**

## Notes

### 授权与范围

- 增量授权：用户 `amber` · 2026-11-12 · 指令原文「授权 U3 及其复核门」；依据 R2 PASS（2026-11-12）与用户签署。
- U3 允许文件（逐文件，不得扩张）：
  - `packages/contracts/src/playability/temporal-gate.ts`（新增）
  - `packages/contracts/tests/playability-temporal-gate.test.ts`（新增）
  - `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，可扩展）
- 只读引用（不得修改）：`graph.ts`、`reach.ts`，以及 `temporal-result.ts`、`temporal-budget.ts`、`temporal-motion.ts`、`geometry.ts`、`profile.ts`、`targets.ts`、`game-config.ts`。
- **`temporal.ts` 零改动**，包括不实现 / 不派发 `analyzeTemporalInternal`；不得以「完整证书需要组装」为由扩大范围。
- 不授权：修改或参数化 `graph.ts` / `reach.ts`、U4–U5、A–J 矩阵、公共 Contract / barrel / package exports、新依赖、JSON fixture、`fixtures/packs/**`、Runtime / Pipeline / CLI / MCP、I-03 接线。
- 预算如需扩 `BudgetProfile` 或 D9 闭集 ⇒ STOP + HITL。
- 推送 / 建 PR / 合并 / i02 → main 不在本图授权内；需要另行明确指令。
- 增量签署记录写入 `.scratch/level-playability-v1.1-i02/reports/04-u3-incremental-authorization.md`；**不改已签署授权包**，`docs/v7.8/移动-I02.md` 的 SHA `797cd6fc…` 必须保持不变。

### U3 输出边界（冻结）

`temporal-gate.ts` 只实现**门区半部**，对外提供 `computePermanentGate(...)`，输出限定为：

- `gate`（`L / R / width / y / height / epsilon`）
- `periodCoverage`
- `sideRule`
- `forbiddenInjection`
- `gateStatus: "COMPLETE" | "INCOMPLETE"`
- 失败原因（只取 D9 `DegradationReason` 闭集）

U3 **不生成、不伪造**：`graphCut`、`hopDoubling`、`hopSamplingCoverage`、`movementModelClosure`、完整 `PermanentGateProof`、完整 `TemporalInternalResult`。完整 `PermanentGateProof` 组装留给 U4/U5。

因此 R3 的验收对象是**门区模块 API 与证明行为**，不是顶层 `certificate`。A–J F 行的顶层断言推迟到后续集成阶段；不得为提前满足它而在 U3 填造 U4 字段。

### 冻结语义（引用）

- **D4 §1–§11**：门区闭式 `L = at + d − anchorX·w`、`R = at + (1−anchorX)·w`，`width = w − d > ε`；`p(θ) = at + d·k(θ/P)`；门区不带 Witness 的 lag pad；`∀φ0` 全周期交集；判侧规则；`forbiddenBoxes` 原样注入、只扩张一次、不写 `blocked`、门顶不是地板；反例 1–4、6、13。
- **D2**：连续核心用未取整 `p(t) − anchor.x·w`；Hazard 不是 solid、不提供支撑；门区只消费 y 区间。
- **D9 §6.1–§6.3**：`PermanentGateProof` 字段冻结；U3 只填门区半部字段。
- **授权包 §3.6 / §5.2 / §7.1 / §8.1–§8.4 / §9.3**。
- ε 是 I-00 §6.4 的单一具名常量，只用于门宽 / 显式区间阈值，不进碰撞谓词。

### 执行形态

- 一票一 commit：`U3-0x: …`；每张实现票一个独立会话。
- 依赖：U3-00 → U3-01 → U3-02 → U3-03 → U3-04 → U3-05 → U3-06 → U3-07 → U3-R3 → U3-SIGN。
- U3-01、U3-02 先立 API 与几何；U3-03 / U3-04 / U3-05 各自只增自己那一段；U3-06 收束测试矩阵与反例。
- R3 复核会话必须与实现会话隔离；不得读作者总结 / PASS 结论 / 调试笔记。
- U3-07 准备 Draft PR 描述与证据，但**不推送、不创建 PR**。
- 不自动合并；R3 通过 + 用户签署后才讨论 PR 后续。

### 冻结的扫描约束

新模块必须继续通过既有架构断言：

- T-55：contracts `src` 不引 `node:fs` / `node:crypto`；
- T-57：不新增 `auditPlayabilityTemporal(` 的生产调用者；
- T-58：生产 `analyze:` 实参仍只有 `stubTemporalAnalyzer`；
- T-61：三处生产接线不变；
- T-62：不新增 `TEMPORAL_LAG_*` 同名常量；
- T-64：不出现 `Symbol(`；
- 新模块不得出现 `analyze:` 属性标签；
- `temporal-gate.ts` **不得** import `temporal.ts`（D6 DAG；否则循环）；
- 不新增公共 barrel 导出；`temporal-result.ts` 不得反向导入 gate。

### 命令

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts
pnpm test
```

### 证据落点

- 实现证据 / 临时材料 / 实现报告：`.scratch/level-playability-v1.1-u3/`。
- 正式 R3 报告（唯一权威）：`.scratch/level-playability-v1.1-i02/reports/R3-review.md`。
- 证据格式沿用 E1 / E2 / E3；逐项 `PASS` / `FAIL` / `NOT_RUN`，不得用总通过率替代。

### 依赖图

```text
U3-00 初始化与授权台账
  └─ U3-01 门区模块 API 骨架与输入契约
       └─ U3-02 门区几何与闭式公式
            └─ U3-03 全周期覆盖
                 └─ U3-04 判侧规则
                      └─ U3-05 forbiddenInjection
                           └─ U3-06 测试矩阵与 D4 反例
                                └─ U3-07 回归 / 白名单审计 / 实现报告
                                     └─ U3-R3 独立复核
                                          └─ U3-SIGN 用户签署
```

## Decisions so far

- [U3-00 初始化、授权台账与基线](issues/01-u3-00-init.md): 基线全绿（build/typecheck 0，全量 2747 tests passed）；增量授权记录 04 就绪，仅 U3 + R3；R3 协议已冻结（报告 `R3-review.md`、会话隔离、逐项 PASS/FAIL/NOT_RUN）。
- [U3-01 门区模块 API 骨架与输入契约](issues/02-u3-01-api-skeleton.md): `computePermanentGate` 契约冻结（输入为已派生显式几何，输出取 D9 索引类型）；骨架恒 `INCOMPLETE` + `no-permanent-gate`，原因闭集两项，无 barrel 导出。
- [U3-02 门区几何与闭式公式](issues/03-u3-02-geometry.md): 门区闭式 `L/R/width` 与 y 严格重叠判定落地；ε 取锚点行程 `[at, at+d]`；失败分 `geometry-untrusted` / `no-permanent-gate`，门区无 pad。
- [U3-03 全周期覆盖](issues/04-u3-03-period-coverage.md): `periodCoverage` 由闭式极值 `at` / `at+d` 生成，记录 `[[0,P/2],[P/2,P]]`（不合并）；模块无采样循环，非法周期 ⇒ `geometry-untrusted`。

## Not yet specified

<!-- 路线由已签署授权包 D3 / D4 / D9 / §3.6 / §5.2 / §9.3 冻结；无已知雾区。任何新增文件 / 扩权需求 = STOP + HITL，不在此处自行毕业。 -->

## Out of scope

- **U4 图割与 hop 双档**：`graphCut`、`hopDoubling`、`hopSamplingCoverage`、`movementModelClosure`、`graph.ts` 尾参（`HopSampling`）及其独立审批。
- **U5**：预算 / 确定性硬化、A–J 矩阵、性能基准、最终集成与完成报告。
- **完整 `PermanentGateProof` / `TemporalInternalResult` 组装**与 `certificate` 顶层断言（A–J F 行推迟）。
- **`analyzeTemporalInternal` 与 `temporal.ts` 修改**；入口归 U5 / 后续。
- **I-03 生产接入**：`coverage.temporal`、`mechanic.ts` / `api.ts` 接线、公共 Verdict 聚合。
- **公共 Contract / Runtime / Pipeline / CLI / MCP / 持久化 / 新依赖 / JSON fixture。**
- **`graph.ts` / `reach.ts` 的任何修改或参数化。**
- **推送、建 PR、合并、i02 → main**（另行明确指令）。
- **修改已签署授权包 / I-00 / I-02 原文**（增量授权只写独立记录，不改原包）。
- **把 U3 完成写成 U4 授权或公共 NB / PU 能力。**
