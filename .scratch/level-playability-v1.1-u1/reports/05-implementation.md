# U1-05 实现报告与 R1 输入包

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-12 |
| 分支 | `wayfinder/level-playability-v1.1-u1` |
| 审计基线 | `ed02339a57ca1c1d9d2df5c553ca92a863492e92`（= `wayfinder/level-playability-v1.1-i02` head） |
| 审计 HEAD | `75368a6ec41b6062c9d9e98b2f1e6ce8d2798ade`（U1-05 claim；报告与证据随后提交） |
| 授权包 | `docs/v7.8/移动-I02.md` · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（复算一致） |
| 范围 | 仅 I-02 的 **U1**；未实现 `analyzeTemporalInternal`，未接生产 |
| 环境 | macOS Darwin 24.6.0 · Node 22.23.2 · pnpm 10.7.1 |
| 结论 | 命令全绿；产品改动严格落在 U1 白名单；架构断言原样通过；无新依赖 / 公共导出 / JSON fixture |

## 1. 命令与结果

| 命令 | 退出码 | 计数 / 备注 | 日志 |
| --- | ---: | --- | --- |
| `pnpm build` | 0 | `tsc -b` + 各包 bundle 完成 | [`evidence/05-build.log`](../evidence/05-build.log) |
| `pnpm typecheck` | 0 | 10 个 workspace 包全部 Done | [`evidence/05-typecheck.log`](../evidence/05-typecheck.log) |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-motion.test.ts packages/contracts/tests/playability-temporal-budget.test.ts` | 0 | **2 files / 58 tests passed** | [`evidence/05-vitest-u1.log`](../evidence/05-vitest-u1.log) |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | 0 | **1 file / 65 tests passed**（含 T-55～T-65） | [`evidence/05-architecture.log`](../evidence/05-architecture.log) |
| `pnpm test` | 0 | **172 files / 2674 tests passed**；2 条已知 `[vitest-worker]: Timeout calling "onTaskUpdate"`（与 U1-00 基线同型，非产品失败） | [`evidence/05-test.log`](../evidence/05-test.log) |

基线（U1-00）：170 files / 2616 tests。U1-04 新增 2 个测试文件 / 58 条测试，全量计数与增量一致。

## 2. diff 范围

`git diff --stat ed02339..75368a6`：

```text
 .../evidence/00-baseline.md                        |  97 ++++++
 .../issues/01-u1-00-init.md                        |  46 +++
 .../issues/02-u1-01-types-budget.md                |  83 +++++
 .../issues/03-u1-02-motion.md                      |  70 ++++
 .../issues/04-u1-03-temporal-wiring.md             |  65 ++++
 .../issues/05-u1-04-tests.md                       |  94 ++++++
 .../issues/06-u1-05-regression-audit.md            |  39 +++
 .../issues/07-u1-r1-review.md                      |  56 ++++
 .../level-playability-v1.1-u1/issues/08-u1-sign.md |  33 ++
 .scratch/level-playability-v1.1-u1/map.md          | 127 +++++++
 .../contracts/src/playability/temporal-budget.ts   | 308 +++++++++++++++++
 .../contracts/src/playability/temporal-motion.ts   | 371 +++++++++++++++++++++
 .../contracts/src/playability/temporal-result.ts   | 280 ++++++++++++++++
 packages/contracts/src/playability/temporal.ts     |  77 +++++
 .../tests/playability-temporal-budget.test.ts      | 322 ++++++++++++++++++
 .../tests/playability-temporal-fixtures.ts         | 189 +++++++++++
 .../tests/playability-temporal-motion.test.ts      | 314 +++++++++++++++++
 17 files changed, 2571 insertions(+)
```

- 产品路径改动 **7 个文件**，全部在 U1 白名单内；其余为 `.scratch/level-playability-v1.1-u1/**` 的票 / 地图 / 证据。
- `temporal.ts` 为**纯增**：diff 中没有任何被删除行（`grep '^-[^-]'` 为空）。
- `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` 零改动。
- `fixtures/**`、`packages/demo/**`、`packages/assets/**`、`packages/pipeline/**`、`packages/cli/**`、`packages/mcp/**`、`packages/contracts/tests/fixtures/**` 零改动。
- `graph.ts` / `profile.ts` / `temporal-input.ts` / `playability/index.ts` / `contracts/src/index.ts` / `api.ts` 零改动。

审计原始输出：[`evidence/05-diff-audit.log`](../evidence/05-diff-audit.log)。

## 3. 白名单核对

| # | 文件 | 变更 | 授权包 §5.2 | 单元 |
| ---: | --- | --- | --- | --- |
| 1 | `packages/contracts/src/playability/temporal.ts` | M（纯增） | 允许 | U1 |
| 2 | `packages/contracts/src/playability/temporal-result.ts` | A | 允许（新增纯类型） | U1 |
| 3 | `packages/contracts/src/playability/temporal-budget.ts` | A | 允许（新增预算与降级） | U1 |
| 4 | `packages/contracts/src/playability/temporal-motion.ts` | A | 允许（新增三角波 / AABB / 连续求交） | U1 |
| 5 | `packages/contracts/tests/playability-temporal-motion.test.ts` | A | 允许（只新增测试） | U1 |
| 6 | `packages/contracts/tests/playability-temporal-budget.test.ts` | A | 允许（只新增测试） | U1 |
| 7 | `packages/contracts/tests/playability-temporal-fixtures.ts` | A | 允许（**TEST_ONLY**） | U1 |

`temporal.ts` 未实现 `analyzeTemporalInternal`，未改变 I-01 既有导出 / `TemporalAuditResult` / `auditPlayabilityTemporal` / `stubTemporalAnalyzer`。

## 4. 架构断言与静态扫描

| 断言 | 结果 | 备注 |
| --- | --- | --- |
| T-55 contracts `src` 不含 `node:fs` / `node:crypto` | PASS | 新模块无 Node 内建导入 |
| T-57 `auditPlayabilityTemporal(` 生产调用者只有 `ops.ts` | PASS | 新模块零命中 |
| T-58 生产 `analyze:` 实参只有 `stubTemporalAnalyzer` | PASS | 新模块零 `analyze:` 标签 |
| T-61 三处生产接线各至少一次 | PASS | 未改接线 |
| T-62 `TEMPORAL_LAG_*` 常量唯一 | PASS | 新模块零同名常量 |
| T-64 `Symbol(` 只在 `temporal-input.ts` | PASS | 新模块零命中 |
| 公共 barrel 未转出内部符号 | PASS | `TemporalInternalInput` / `TemporalInternalAnalyzer` / `determinismSignature` / `TemporalInternalResult` / `BudgetProfile` 在 `index.ts` / `playability/index.ts` / `api.ts` 零命中 |
| 模块 DAG | PASS | result → 仅 `geometry.js` 类型；budget → result 类型；motion → `geometry.js` + budget 常量；无循环、无反向导入 |

## 5. 未覆盖项 / 已知限制

1. **`analyzeTemporalInternal` 未实现**：U1 只有类型、预算骨架、运动原语、签名与测试；没有任何内部编排入口，也没有生产接线。
2. **预算只到 U1 前置**：仅执行单次 check 的 `maxCutsPerCheck`；`maxCutsPerBranch` 只定义不执行；没有 state / edge 计数器、Witness 体积、相位网格。不得读成 U5 硬化已通过。
3. **无 U2–U5 语义**：Witness / U9 / Winning Set、门区闭式、图割与 hop 加倍均未实现；门区的“临界门宽”只在 ε 阈值层面测了两侧。
4. **性能证据未跑**：`bench-temporal.mjs`、LP-06 / LP-07 acceptance corpus 属 U5；本报告不构成性能验收。
5. **确定性只在进程内验证**：跨进程签名比较属 U5 / 基准证据；32-bit 签名只是指纹。
6. **Runtime hitbox equality 未证**：几何链仍是 `manifest+atlas-metadata`、`runtimeBody = "unverified"`、`coverage = "partial"`。
7. **已知测试环境噪声**：全量 `pnpm test` 有 2 条 `[vitest-worker]: Timeout calling "onTaskUpdate"`，U1-00 基线同样存在；测试计数全通过、退出码 0。
8. **U1-03 的导入差异**：`temporal.ts` 只引用 `temporal-result.ts` 的类型；budget / motion 尚无入口消费者，故未加未使用 import（已在 U1-03 票内登记）。

## 6. 声明

- 产品目录（`packages/**`、`fixtures/**`）只改 U1 白名单的 7 个文件；其余全部改动位于 `.scratch/level-playability-v1.1-u1/**`。
- 未新增依赖、未新增 / 修改 JSON fixture、未修改测试配置、未改既有测试。
- 未推送、未创建 PR、未合并；未启动 U2。
- 内部结果仍为 `modelConditional: true`、`publicCapability: "BLOCKED"`、`publicResult: null`；没有公共 NB / PU 能力声明。

## 7. Draft PR 描述（仅草稿，未推送）

**Base**：`wayfinder/level-playability-v1.1-i02`
**Head**：`wayfinder/level-playability-v1.1-u1`
**Title**：`I-02 U1: continuous-time motion core, internal result types, budget skeleton, and tests`

```markdown
## 范围

I-02 的 U1：连续时间求交核心、内部结果类型、预算骨架、确定性签名与 U1 测试。
白名单 7 个文件，无生产接线、无公共 Verdict、无 U2–U5 语义。

## 改动

- `temporal-result.ts`：D9 内部结果契约（纯类型）。
- `temporal-budget.ts`：D5 / D5B 默认值与硬上限、派生上界、合法性检查、work counter、墙钟 abort、单次 check cut 预算。
- `temporal-motion.ts`：三角波、不取整 AABB、ε、方向性 lagPad、解析连续求交。
- `temporal.ts`：内部入口类型 + FNV-1a 确定性签名（纯增；未实现 `analyzeTemporalInternal`）。
- 3 个测试侧文件：58 条 U1 定向测试 + TEST_ONLY 内存夹具。

## 验证

- `pnpm build` / `pnpm typecheck`：exit 0
- U1 定向 vitest：2 files / 58 tests passed
- 架构断言：1 file / 65 tests passed（T-55 / 57 / 58 / 61 / 62 / 64 原样通过）
- `pnpm test`：172 files / 2674 tests passed（基线 170 / 2616）；2 条已知 Vitest worker RPC 超时

## 不在本 PR

U2–U5、`analyzeTemporalInternal`、生产接线、公共 Verdict、性能证据、LP-06 / LP-07。

## 复核状态

R1 尚未签署。不得在 R1 PASS + 用户签署前合并，也不得据此授权 U2。
```

## 8. R1 输入包

> 供**独立复核会话**使用。复核人应自行检查 diff、重跑命令并形成结论；本报告只作范围与证据索引，不代替复核。

| 项 | 值 |
| --- | --- |
| 授权包 | `docs/v7.8/移动-I02.md` · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| U1 白名单 | 第 3 节 7 个文件 |
| R1 清单 | 授权包 §9.1：运动模型 / AABB 语义 / 连续求交 / ε / 数值稳定性 / 反例 / 范围与确定性 |
| diff 范围 | `ed02339a57ca1c1d9d2df5c553ca92a863492e92..75368a6ec41b6062c9d9e98b2f1e6ce8d2798ade` |
| 正式报告落点 | `.scratch/level-playability-v1.1-i02/reports/R1-review.md`（唯一权威） |
| U1 实现证据 | `.scratch/level-playability-v1.1-u1/evidence/05-*.log` |
| U1 测试文件 | `packages/contracts/tests/playability-temporal-motion.test.ts` · `playability-temporal-budget.test.ts` · `playability-temporal-fixtures.ts` |

复核命令（复核人自行执行并记录退出码 / 计数）：

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-temporal-motion.test.ts packages/contracts/tests/playability-temporal-budget.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts
pnpm test
git diff --stat ed02339..75368a6
git diff --name-status ed02339..75368a6
```

## 9. 证据索引

> `.log` 匹配仓库 `.gitignore` 的 `*.log`，与 U1-00 一致：日志是本地证据，不随提交入库；下表记录其 SHA-256 供复核人重跑后比对。

| 文件 | SHA-256 |
| --- | --- |
| `evidence/05-build.log` | `e7e0f7e381526cbaccc7e72beb3198cc6408704271223cf48d1f2f5a87d7ddab` |
| `evidence/05-typecheck.log` | `34079e0854a892735b87bd72afc41ff8a54312214e9f7f28e52e8b09ba52f1ec` |
| `evidence/05-vitest-u1.log` | `e1a94685578e431f11ec723d1bb825b03b13ca221aec53f4516e86d3ddf98879` |
| `evidence/05-architecture.log` | `c6c28af70aebc9e0b048265a14556a4347213c49407989a63dd162d1d23aeabc` |
| `evidence/05-test.log` | `22d58ca631c076ccc957ad6416c358d8029ef6603adfe718f7fb4ab4d77dfa47` |
| `evidence/05-diff-audit.log` | `3706bd7930afc9fbf753565132fe1888e9d76971d166c3e5049761a31e388c9a` |
