# I02-U1：连续时间求交实现（执行型 effort）

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-u1
Authority: [`docs/v7.8/移动-I02.md`](../../docs/v7.8/移动-I02.md) @ `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（已签署；首次签署仅放行 U1）
Baseline: `wayfinder/level-playability-v1.1-i02` @ `ed02339`
Branch: `wayfinder/level-playability-v1.1-u1`
PR target: `wayfinder/level-playability-v1.1-i02`
Status: open · 2026-11-11 开图

> **执行型 effort。** 本图 override wayfinder 默认的 plan-only：票是执行切片，不是纯决策。执行范围**严格等于**已签署授权包的 U1；不进入 U2，不接生产，不发布公共 Verdict。
>
> 任何新增文件 / 白名单外修改 / 需要扩 D9 闭集的情况 ⇒ STOP + HITL，不得由票自行扩权。

## Destination

**U1（连续时间求交）实现完成，并通过独立 R1 复核及用户签署。**

完成条件：

1. U1 白名单内代码实现完成。
2. U1 定向测试 + 全量 `pnpm test` 通过。
3. `.scratch/level-playability-v1.1-i02/reports/R1-review.md` 逐项记录 `PASS / FAIL / NOT_RUN`。
4. 独立复核人自行检查 diff、重跑命令并完成复核。
5. 用户审阅并签署 R1。
6. 地图收口，不启动 U2。

**R1 未通过或用户未签署，地图不得标记完成。**

## Notes

### 授权与范围

- 授权包：`docs/v7.8/移动-I02.md`（签署版本 SHA `797cd6fc…`）；首次签署只放行 U1。
- U1 允许文件（逐文件，不得扩张）：
  - `packages/contracts/src/playability/temporal.ts`（仅新增内部类型 / 导入 / `determinismSignature` 辅助；**不实现** `analyzeTemporalInternal`）
  - `packages/contracts/src/playability/temporal-result.ts`（纯类型）
  - `packages/contracts/src/playability/temporal-budget.ts`
  - `packages/contracts/src/playability/temporal-motion.ts`
  - `packages/contracts/tests/playability-temporal-motion.test.ts`
  - `packages/contracts/tests/playability-temporal-budget.test.ts`
  - `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`）
- 不授权：U2–U5、`temporal-witness.ts` / `temporal-gate.ts` / `temporal-evasion.ts`、`graph.ts`、`profile.ts`、`temporal-input.ts`、`ops.ts`、Pipeline、Runtime、CLI、MCP、公共 Contract、公共 Verdict、新依赖、JSON fixtures、`fixtures/packs/**`。
- **推送 / 合并 / i02 → main 均不在本图授权内**；需要另行明确指令。

### 执行形态

- 一票一 commit：`U1-0x: …`；每张实现票一个独立会话。
- U1-01 与 U1-02 可并行；U1-03 双前置（U1-01 + U1-02）；U1-04 → U1-05 → U1-R1 → U1-SIGN 串行。
- R1 复核会话必须与实现会话隔离；不得读作者总结 / PASS 结论 / 调试笔记。
- U1-05 准备 Draft PR 描述与证据，但**不推送、不创建 PR**；需要用户另行授权。
- 不自动合并；R1 通过 + 用户签署后才讨论 PR 后续。

### 冻结的扫描约束

新模块必须继续通过既有架构断言：

- T-55：contracts `src` 不引 `node:fs` / `node:crypto`；
- T-57：不新增 `auditPlayabilityTemporal(` 的生产调用者；
- T-58：生产 `analyze:` 实参仍只有 `stubTemporalAnalyzer`；
- T-61：三处生产接线不变；
- T-62：不新增 `TEMPORAL_LAG_*` 同名常量；
- T-64：不出现 `Symbol(`；
- 新模块不得出现 `analyze:` 属性标签（会撞 T-58 扫描）。

### 预算 / 签名边界

- U1 实现：`BudgetProfile` 默认 / 硬上限、合法性校验、work counter、`now` 注入的 wall-clock abort、`budgetStatus` / `budgetKind`、`maxCutsPerCheck`、`cutPointsTotal` / `segmentsTotal`、`invalid-budget` / `budget-bound-overflow`。
- U1 只定义不执行：`maxCutsPerBranch`（U2）、Witness 体积（U2）、相位网格容量（U2）。
- U1 的 `workUnitsSinceLastCheckpoint` 覆盖本单元实际执行的确定性工作；checkpoint 按工作计数触发；墙钟只 abort，不参与策略 / 碰撞 / 签名。
- `determinismSignature` 只覆盖 U1 可构造子集（motion 结果 + 预算计数 + `certificate: { kind: "none" }` + U1 诊断码）；FNV-1a 仅作指纹，测试同时比较剔除 `wallClockMs` / `detail` 的完整规范化序列化。

### 命令

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-temporal-motion.test.ts packages/contracts/tests/playability-temporal-budget.test.ts
pnpm test
```

实际命令以仓库现有脚本与包路径为准；不得为方便修改测试配置。

### 证据落点

- 实现证据 / 临时材料 / 实现报告：`.scratch/level-playability-v1.1-u1/`。
- 正式 R1 报告（唯一权威）：`.scratch/level-playability-v1.1-i02/reports/R1-review.md`。
- 新 effort 可以放索引 / 链接，但不得形成两份可能分歧的正式 R1 报告。
- 证据格式沿用 E1 / E2 / E3；逐项 `PASS` / `FAIL` / `NOT_RUN`，不得用总通过率替代。

### 依赖图

```text
U1-00 初始化与基线
  ├─ U1-01 类型与预算骨架 ─┐
  └─ U1-02 运动原语与连续求交 ─┤
                               └─ U1-03 temporal.ts 类型 / 签名 / 导入
                                     └─ U1-04 测试矩阵与 TEST_ONLY 夹具
                                           └─ U1-05 回归 / 白名单审计 / 实现报告
                                                 └─ U1-R1 独立复核（独立会话）
                                                       └─ U1-SIGN 用户签署
```

## Decisions so far

<!-- 索引：每张已关闭票一行；细节在票里。 -->

- [U1-00 初始化、基线与白名单确认](issues/01-u1-00-init.md): BASE `ed02339`（i02 head），建图提交仅 scratch；授权包 `797cd6fc…` 复算一致，仅放行 U1；白名单七文件与 §5.2 逐文件一致（`temporal.ts` 已有 115 行，其余六个待建）；基线 `pnpm build` / `typecheck` / `test` 全 exit 0（170 files / 2616 tests，2 条已知 Vitest RPC flake）；T-57/58/61/62/64 全 PASS；产品目录零改动。证据 [`evidence/00-baseline.md`](evidence/00-baseline.md)。
- [U1-01 内部结果类型与预算骨架](issues/02-u1-01-types-budget.md): D9 纯类型全集 + 预算常量 / 解析 / 计数器落地；`BudgetProfile` 类型依 DAG 留在 result，`maxEdges` 解析时派生；非法预算 / 溢出即 IE；架构断言 65/65、全量 2616 绿。
- [U1-02 运动原语与连续时间求交](issues/03-u1-02-motion.md): 三角波 / 不取整 AABB / ε / 单侧 lagPad + 解析连续求交落地；折返点切段、`c1 === 0` 精确分支、切点真实重叠才合并、`cut-budget` 前置守卫；T-55…T-65 65/65、全量 2616 绿。
- [U1-03 `temporal.ts` 类型、签名辅助与导入](issues/04-u1-03-temporal-wiring.md): 内部入口类型 + FNV-1a 确定性签名落地；签名排除 `wallClockMs` / `detail` / `budgetProfile`，键序无关；`analyzeTemporalInternal` 仍未实现；架构断言 65/65、全量 2616 绿。
- [U1-04 测试矩阵与 TEST_ONLY 夹具](issues/05-u1-04-tests.md): 35 条运动 / 几何 / ε / 连续求交 + 23 条预算 / 确定性测试落地；6 处 P0 差异、采样陷阱、折返点相切全覆盖；无 JSON / fs 夹具；定向 58 tests、全量 172 files / 2674 tests 绿。

## Not yet specified

<!-- 无已知雾区。路线已清楚；任何新增文件 / 扩权需求 = STOP + HITL，不在此处自行毕业。 -->

## Out of scope

- **U2–U5**：Witness、永久门区、垂直规避图割、预算硬化 / 性能基准 / 最终集成。
- **I-03 生产接入**：`coverage.temporal`、`mechanic.ts` / `api.ts` 接线、公共 Verdict 聚合。
- **公共 Contract / Runtime / CLI / MCP / Pipeline / 持久化 / 新依赖。**
- **`graph.ts`、`profile.ts`、`temporal-input.ts`、`ops.ts`、`packages/demo/**`。**
- **推送、合并、i02 → main。**
- **修改已签署授权包或 I-00 / I-02 原文。**
- **把 U1 完成写成公共 NB / PU 能力。**
