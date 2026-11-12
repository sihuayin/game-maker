# U2-07 实现报告 — 回归、白名单审计与 R2 输入包

| 项 | 值 |
| --- | --- |
| 票 | [U2-07 回归、白名单审计与实现报告](../issues/08-u2-07-audit.md) |
| 执行会话 | claude（U2-07 audit session 2026-11-12） |
| 日期 | 2026-11-12 |
| 分支 | `wayfinder/level-playability-v1.1-u2` |
| U2 base | `23a2027e30afaef033b2afe3d5a4a8a424fec20c`（`wayfinder/level-playability-v1.1-i02` head，含签署 U1） |
| claim head | `7e3c83756844f1f125d8f673c7833f82b4a51d13` |
| audit head | 本报告所在提交 `U2-07: regression, whitelist audit, and implementation report`（`git log -1 --format=%H`） |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) @ `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（复算一致） |
| 产品目录改动 | **只有 U2 白名单 3 个文件**（见 §3） |
| 结论 | **PASS**：`pnpm build` / `pnpm typecheck` / U2 定向 133/133 / 全量 `pnpm test` 两次 exit 0（173 files・2742 tests）；无断言失败、无测试超时；STOP 条件未触发 |

> 本票只做回归与范围审计，**不做 R2 语义复核**。R2 由独立会话按授权包 §9.2 逐项判定；本报告的 PASS 不构成 R2 PASS，也不构成 U2 签署。

## 1. 命令、退出码与测试计数

全部命令在本会话工作区（分支 `wayfinder/level-playability-v1.1-u2`）执行，原始输出存于 `../evidence/07-*.log`（`*.log` 被 `.gitignore` 忽略，仅本地保留）。

### 1.1 退出码与计数

| # | 命令 | 退出码 | 计数 / 摘要 | 证据 |
| --- | --- | ---: | --- | --- |
| C1 | `pnpm build` | **0** | `tsc -b` + `packages/demo` / `packages/cli` / `packages/mcp` bundle 全部 `Done` | `07-build.log` |
| C2 | `pnpm typecheck` | **0** | 10 个 workspace `typecheck: Done`（contracts / qa / game-design / vision / demo / assets / visual-design / pipeline / mcp / cli） | `07-typecheck.log` |
| C3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-witness.test.ts` | **0** | **68 / 68 passed**，1 file（116ms） | `07-witness.log` |
| C4 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | **0** | **65 / 65 passed**，1 file；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 逐条 ✓（见 §4） | `07-temporal-input.log` |
| C5 | `pnpm test`（全量，第 1 次） | **0** | **173 / 173 files，2742 / 2742 tests passed**；`Duration 119.78s`；退出码 0；2 条已知 runner RPC unhandled error（见 §1.2） | `07-test-run1.log` |
| C6 | `pnpm test`（全量，第 2 次复跑） | **0** | **173 / 173 files，2742 / 2742 tests passed**；`Duration 119.83s`；退出码 0；同样 2 条已知 runner RPC unhandled error | `07-test-run2.log` |

- **U2 定向合计 133 / 133**（68 witness + 65 input），两次均 exit 0。
- 全量相对 U2-00 基线（172 files / 2674 tests）为 **+1 file / +68 tests**，与 U2-06 添加的 `playability-temporal-witness.test.ts` 一致；本票未新增 / 修改任何测试。
- 原始输出中的 `✓ packages/contracts/tests/playability-temporal-witness.test.ts (68 tests)` 说明 68 条 U2 测试已被全量跑覆盖。

### 1.2 超时与 runner 错误分析（不假设、逐项分类）

上一次独立全量复跑曾记录 **10 条 `Test timed out in 20s/60s/120s`**（既有测试、无断言失败、整轮 2187s）。本会话**未复现**：

| 检查 | 第 1 次全量 | 第 2 次全量 |
| --- | --- | --- |
| `Test timed out`（测试级超时） | **0 条** | **0 条** |
| `FAIL` / `×`（断言失败） | **0 条** | **0 条** |
| 整轮时长 | 119.78s（`Start at 16:00:38`） | 119.83s（`Start at 16:03:00`） |
| 退出码 | 0 | **0** |

- **分类**：唯一出现在日志里的 `Timeout` 是 `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`，共 **2 条**，属 vitest 3.2.7 的 **runner RPC 层 unhandled error**，不是测试超时，也不是断言失败；与 U2-00 基线（同为 2 条）同类。`vitest.config.ts` 以 `dangerouslyIgnoreUnhandledErrors: true` 让退出码忠实反映测试结果。日志中 2742/2742 测试通过、无 `FAIL`。
- 本会话**未**因为上一轮的失败而修改产品代码、削弱测试、调整 `testTimeout` 或重试掩盖：两次全量都是完整跑，原始输出保留在证据日志。
- 环境负载（证据）：第 1 次全量开始前 load average `1.59 3.40 2.99`；运行中峰值约 7–11（10 核 M4）；第 2 次开始前 load `7.36 5.72 4.08`。两次均在 ~2 分钟内完成，未出现超时。

### 1.3 环境

| 项 | 值 |
| --- | --- |
| OS | macOS 15.7.9（Darwin 24.6.0），arm64（Apple M4，10 核，16 GB） |
| Node | v22.23.2 |
| pnpm | 10.7.1 |
| vitest | 3.2.7（darwin-arm64） |

## 2. `git diff --stat`（U2 base → audit head）

```text
 .../reports/03-u2-incremental-authorization.md     |   73 +
 .../evidence/00-baseline.md                        |  141 ++
 .../issues/01-u2-00-init.md                        |   58 +
 .../issues/02-u2-01-grid-corridor-spawn.md         |   94 +
 .../issues/03-u2-02-wait-move.md                   |  114 +
 .../issues/04-u2-03-winning-set.md                 |  124 +
 .../issues/05-u2-04-u9.md                          |  202 ++
 .../issues/06-u2-05-witness-encoding.md            |  150 ++
 .../issues/07-u2-06-tests.md                       |  111 +
 .../issues/08-u2-07-audit.md                       |   86 +
 .../issues/09-u2-r2-review.md                      |   56 +
 .../level-playability-v1.1-u2/issues/10-u2-sign.md |   33 +
 .scratch/level-playability-v1.1-u2/map.md          |  141 ++
 .../reports/07-implementation.md                   |  300 +++
 .../contracts/src/playability/temporal-witness.ts  | 2593 ++++++++++++++++++++
 .../tests/playability-temporal-fixtures.ts         |  264 ++
 .../tests/playability-temporal-witness.test.ts     | 1294 ++++++++++
 17 files changed, 5834 insertions(+)
```

按目录归类：

- **产品（3 个文件，全部在白名单内）**：`temporal-witness.ts`（新增）、`playability-temporal-witness.test.ts`（新增）、`playability-temporal-fixtures.ts`（`TEST_ONLY` 纯增）。
- **scratch（本 effort）**：`.scratch/level-playability-v1.1-u2/**`（map / 10 张票 / 基线证据 / 本报告），合计 17 files。
- **授权记录**：`.scratch/level-playability-v1.1-i02/reports/03-u2-incremental-authorization.md`（U2 增量授权独立记录）。
- 其余路径**零改动**。

## 3. U2 白名单核对表

### 3.1 产品路径（逐文件）

| 文件 | 变更 | 白名单依据 | 判定 |
| --- | --- | --- | --- |
| `packages/contracts/src/playability/temporal-witness.ts` | A（+2593 / −0） | 授权包 §5.2「新增 U2 Witness」 | **PASS** |
| `packages/contracts/tests/playability-temporal-witness.test.ts` | A（+1294 / −0） | §5.2「`playability-temporal*.test.ts` 只新增测试」；§8.1 U2/R2 | **PASS** |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | M（+264 / −0，纯增） | §5.2 **TEST_ONLY**，可扩展 | **PASS** |

`git diff --numstat`：三个文件删除行均为 0；`fixtures` 的 264 行全部为新增，未改既有导出。

### 3.2 禁止路径核对（全部为空）

| 检查 | 命令 | 结果 | 判定 |
| --- | --- | --- | --- |
| `packages/demo/**` | `git diff --name-status 23a2027..HEAD -- packages/demo` | 空 | **PASS** |
| `packages/cli/**` / `packages/mcp/**` | 同上 | 空 | **PASS** |
| `packages/pipeline/**` / `packages/assets/**` | 同上 | 空 | **PASS** |
| `ops.ts` | 名称扫描 | 未出现 | **PASS** |
| `graph.ts` / `profile.ts` | 名称扫描 | 未出现 | **PASS** |
| `temporal.ts` / `temporal-result.ts` / `temporal-budget.ts` / `temporal-input.ts` / `temporal-motion.ts` | 名称扫描 | 未出现 | **PASS** |
| 公共 barrel（`playability/index.ts`、`contracts/src/index.ts`） | 名称扫描 | 未出现 | **PASS** |
| `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` / vitest・tsconfig | 路径扫描 | 空 | **PASS** |
| 新依赖 | `package.json` / lockfile 无 diff | 无 | **PASS** |
| JSON fixture（`fixtures/packs/**`、`tests/fixtures/**`） | 路径扫描 | 无新增 / 无修改 | **PASS** |
| U3 / U4 模块（`temporal-gate.ts` / `temporal-evasion.ts`） | 名称扫描 | 未创建 | **PASS** |
| `docs/v7.8/移动-I02.md` | `git diff 23a2027..HEAD -- docs/` + SHA | 空；SHA `797cd6fc…` 不变 | **PASS** |

自动化白名单断言（对 `git diff --name-only 23a2027..HEAD` 逐项分类）：

```text
RESULT: PASS (no out-of-scope file)
```

允许类别：`PRODUCT-WHITELIST`（3）、`SCRATCH-U2`（13）、`AUTH-RECORD`（1）；无 `OUT-OF-SCOPE`。

## 4. 架构与静态扫描

### 4.1 既有架构断言（C4，`--reporter=verbose`）

| 断言 | 标题 | 结果 |
| --- | --- | --- |
| T-55 | contracts 源码不含 `node:fs` / `node:crypto` | **✓ PASS** |
| T-57 | `auditPlayabilityTemporal` 生产调用者只有 `ops.ts` | **✓ PASS** |
| T-58 | 生产 `analyze` 实参只有 `stubTemporalAnalyzer` | **✓ PASS** |
| T-61 | 三处生产接线各至少一次 | **✓ PASS** |
| T-62 | 常量唯一且不复用 `FRAME_MARGIN_MS` | **✓ PASS** |
| T-64 | brand `Symbol` 只在 `temporal-input.ts` 铸造 | **✓ PASS** |

同一文件 `Test Files 1 passed (1)`、`Tests 65 passed (65)`，exit 0。

### 4.2 新模块 / 新测试静态扫描

扫描范围：`temporal-witness.ts`、`playability-temporal-witness.test.ts`、`playability-temporal-fixtures.ts`。

| 模式 | 结果 | 判定 |
| --- | --- | --- |
| `analyze:` 属性标签 | 0 | **PASS** |
| `auditPlayabilityTemporal(` | 0 | **PASS** |
| `Symbol(` | 0 | **PASS** |
| `TEMPORAL_LAG_` | 0 | **PASS** |
| `node:fs` / `node:crypto` | 0 | **PASS** |
| `Buffer` / `process.` / `Date.now` / `new Date` | 0 | **PASS** |
| `permanent-gate` / `evasion` / `hop-doubling` / `graph-cut` / 性能基准 | 0（未提前实现 U3–U5） | **PASS** |

### 4.3 模块 DAG 与公共面

| 检查 | 证据 | 判定 |
| --- | --- | --- |
| `temporal-witness.ts` **不 import** `temporal.ts` | import 列表只有 `assetpack / game-config / geometry / graph / profile / temporal-budget / temporal-motion / temporal-result` | **PASS** |
| 无公共 barrel 导出 | `playability/index.ts`、`contracts/src/index.ts`、`packages/contracts/package.json` 均不含 `temporal-witness` / witness 导出；三处文件本身无 diff | **PASS** |
| 无生产接线 | `grep -rn "temporal-witness" packages --include=*.ts`（排除 `dist/` 构建产物）只命中 `playability-temporal-witness.test.ts` 与 `playability-temporal-fixtures.ts` 的 `import type`；`src/**` 无引用 | **PASS** |
| fixtures 不被 `src/**` 引用 | `grep -rn "playability-temporal-fixtures" packages/contracts/src` 无命中 | **PASS** |
| fixtures 不注册测试、不读写文件系统 | 文件无 `describe(` / `it(` / `test(`，无 `node:fs` | **PASS** |
| 失败原因不扩 D9 闭集 | 只使用 `spawn-not-on-lattice` / `goal-not-representable` / `goal-rect-degenerate` / `model-out` / `geometry-untrusted` / `no-witness-found` / 预算原因码等既有 `DegradationReason` | **PASS** |

## 5. 未覆盖项与已知限制

以下限制**不构成本票 FAIL**（不涉及范围 / 回归 / 架构），但必须进入 R2 视野：

1. **S1 与静态走廊冗余**（U2-06 记录）：若静态 solid 会被 S1 扫到，同一条 `blocked` 规则也会把中间脚点格移出走廊，因此真实走廊下跨墙 `move` 先被走廊截断拒绝（`state`）。S1 分支本身用测试内放宽的走廊对象单测到 `static`，证明它不是端点采样；产品语义不变。
2. **`maxCutsPerCheck` 无法从 U2 入口单独耗尽**：U2 在调用 `intersectContinuous` 前已按折返点预切段，单次 check 没有内部 cut；测试以 `maxCutsPerCheck = 0` 验证跨折返点格仍按两段解析检查。per-check 上限的执行归 U1 运动原语。
3. **失败侧策略措辞不一致**：`searchWinningSet` 的 `status: "failed"` 结果可能携带 goal 侧策略条目（类型注释允许），而模块头注释写「失败侧不携带部分策略（`policy: []`）」。`encodeWitness` 拒绝非 `complete`，无提升路径；仅为文档措辞问题，U2 白名单外（模块头注释在 `temporal-witness.ts` 内，但本票只做审计，不改产品代码）。
4. **W 转移记录不携带 lag**：D9 `Witness` 无 `lagMs` / `lagPad` / `hazardSpeed` 字段；跨档隔离由「`encodeWitness` 一次只收一档」的入口形状与 U9 停留记录（`hazardSpeed` / `lagPad`）的 `model-out` 检查承担，测试已覆盖后者。
5. **残差等待的表示**：半格、逐 `φ0` 的保守覆盖不是 D9 转移元组，由 `phaseCoverage`（N 个半开相位格全覆盖）+ 对齐状态承载；U9 整周期停留被分解为 N 个规范相位格单格 `wait`（周期重复 + 玩家静止保证逐相位同值）。这是 D9 已冻结字段的用途，不是省略验证。
6. **`spawn-not-standable` 的表达**：该细分不在 D9 闭集，产品用 `reason: "spawn-not-on-lattice"` + 内部 `gap: "spawn-not-standable"` 表达，未扩 `DegradationReason` / `BudgetProfile`。
7. **未实现 / 未覆盖**：A–J 矩阵（U5）、U3 门区、U4 图割、U5 预算硬化 / 性能证据；`analyzeTemporalInternal` 与 `temporal.ts` 修改仍归 U5；无生产接线、无公共 Verdict。
8. **真实夹具限制**：`fixtures/packs/last-train/v2` 在 U2 模型下是 IE（luggage solid 截断走廊），U2 正样本使用内存世界夹具；未新增 JSON fixture。
9. **本票不是 R2**：本报告只判定回归 / 范围 / 架构；Witness 模型、S1–S4、U9、完整性、双档、反例的语义正确性由 R2 独立会话逐项判定。
10. **历史超时不可外推**：上一轮 10 条测试超时未在本会话复现；本会话证据是两次各 ~120s 的全量 exit 0，但 R2 仍应自行复跑，不得引用本报告代替。

## 6. 产品目录只改 U2 白名单（声明）

**本 effort 的产品目录改动严格等于 U2 白名单 3 个文件**：`packages/contracts/src/playability/temporal-witness.ts`、`packages/contracts/tests/playability-temporal-witness.test.ts`、`packages/contracts/tests/playability-temporal-fixtures.ts`。其余变更为 `.scratch/level-playability-v1.1-u2/**` 与本 effort 的授权记录。未修改任何禁止清单文件、未新增依赖、未新增 JSON fixture、未新增公共导出、未接生产、未推送 / 建 PR / 合并。

## 7. Draft PR 描述（不推送、不创建）

```text
Title: U2 — safe-passage Witness (I02-02) implementation + tests

Base: wayfinder/level-playability-v1.1-i02
Head: wayfinder/level-playability-v1.1-u2
Diff: 23a2027e30afaef033b2afe3d5a4a8a424fec20c..<U2-07 head>

## Scope
U2 (I02-02) only: state grid, static corridor, exact spawn, wait/move,
S1–S4, residual wait, U9 safe waiting cell, full-phase winning set with
termination, Witness encoding / volume / determinism, D3 §11 counterexamples.

## Files (U2 whitelist only)
- packages/contracts/src/playability/temporal-witness.ts (new)
- packages/contracts/tests/playability-temporal-witness.test.ts (new)
- packages/contracts/tests/playability-temporal-fixtures.ts (TEST_ONLY, additive)

## Non-goals / untouched
- no packages/demo, ops.ts, graph.ts, profile.ts, temporal.ts,
  temporal-result.ts, temporal-budget.ts, barrels
- no package.json / lockfile / new dependency / JSON fixture
- no production wiring, no public Verdict, PUBLIC_NB / PUBLIC_PU stay BLOCKED
- U3–U5 not started

## Verification (2026-11-12)
- pnpm build: exit 0
- pnpm typecheck: exit 0
- vitest witness: 68/68; vitest input (T-55/57/58/61/62/64): 65/65
- pnpm test: 173 files / 2742 tests passed, exit 0 (two runs)
- whitelist audit: PASS; architecture assertions: PASS

## Review gate
R2 (independent session) and user sign-off are required before merge.
```

## 8. R2 输入包

R2 复核会话只使用以下输入；**不得**把作者总结 / 本报告的 PASS 结论 / 调试笔记当作复核结论。

### 8.1 输入清单

| 项 | 值 |
| --- | --- |
| 授权包 | `docs/v7.8/移动-I02.md` @ `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（复算一致） |
| U2 base | `23a2027e30afaef033b2afe3d5a4a8a424fec20c` |
| audit head | 本报告所在提交（`git log -1 --format=%H`；claim 提交 `7e3c837`） |
| diff 范围 | `git diff 23a2027..HEAD`（17 files；产品 3 文件） |
| R2 清单 | 授权包 §9.2（下表） |
| 报告落点 | `.scratch/level-playability-v1.1-i02/reports/R2-review.md`（唯一权威） |

### 8.2 U2 白名单（逐文件）

- `packages/contracts/src/playability/temporal-witness.ts`（新增）
- `packages/contracts/tests/playability-temporal-witness.test.ts`（新增）
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，可扩展）

只读引用（不得修改）：`graph.ts`、`reach.ts`、`targets.ts`、`profile.ts`、`game-config.ts`、`temporal-motion.ts`、`temporal-budget.ts`、`temporal-result.ts`、`geometry.ts`。

### 8.3 R2 清单（授权包 §9.2，逐项判 PASS / FAIL / NOT_RUN）

| 项 | 通过条件 |
| --- | --- |
| Witness 模型 | 与 D3 一致：`(footX,k)`、静态走廊、精确 spawn、wait / move、恒速线性、每边一格、状态边界到达、Goal 内缩 0.5px |
| S1–S4 | 静态连续 solids、折返点切段 + `lagPad`、相位 / 时间、连接连续性；任一失败即该转移无效 |
| 残差等待 | 对整格位姿范围保守验证，跨折返点切段；不得只查端点 |
| U9 | 接近 `∀φ0`、整周期等待、出口 `∃ψ`；同一 pad；严格相交；无最小安全窗口 |
| 完整性 | 全部 N 个相位格；策略表 + 逐转移验证记录；从 spawn 可达的全部状态 / 转移；终止 rank 或有限轨迹；部分路径不得提升；预算耗尽 ⇒ IE |
| Witness 形状 | `policy + verification`；信封字段齐全；可确定性重放；体积阈值；派生轨迹标 `derived: true` |
| 双档 | 每档独立 Witness；禁止跨档共享 / 拼接；`resolveTwoLagResults` 行为不变 |
| 反例 | D3 §11 十三条全覆盖 |
| 范围与模型条件 | 只改 U2 白名单；不发布公共 NB；`coverage.temporal` 处理符合 D2/D10 |

### 8.4 复核命令

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-temporal-witness.test.ts
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose
pnpm test
```

### 8.5 证据路径（原始输出，供复核人自行判断）

- `../evidence/07-build.log` — `pnpm build`
- `../evidence/07-typecheck.log` — `pnpm typecheck`
- `../evidence/07-witness.log` — U2 witness 定向（68/68）
- `../evidence/07-temporal-input.log` — 架构断言（65/65，verbose）
- `../evidence/07-test-run1.log` — 全量第 1 次（173 files / 2742 tests，exit 0）
- `../evidence/07-test-run2.log` — 全量第 2 次复跑（173 files / 2742 tests，exit 0，`Duration 119.83s`）

`*.log` 被 `.gitignore` 忽略，仅本机保留；R2 应自行复跑并记录自己的退出码，不得引用本目录日志作为复核结论。

## 9. STOP / 范围检查

| 停止条件 | 结果 |
| --- | --- |
| 白名单外文件 / 新依赖 / 公共导出 | **未触发**（§3 / §4.3） |
| 架构断言失败 | **未触发**（T-55 / 57 / 58 / 61 / 62 / 64 全 PASS） |
| 全量测试断言失败 / 重跑仍失败 | **未触发**（两次 exit 0，0 断言失败） |
| 需要新增文件或扩 D9 闭集 | **未触发** |

**结论：PASS**（回归 / 范围 / 架构）。U2 的语义正确性由 R2 判定；R2 PASS 不等于 U3 授权，也不等于用户签署。

## 10. 产物与提交

| 项 | 值 |
| --- | --- |
| Claim 提交 | `7e3c837` `docs(wayfinder): claim U2-07 regression and whitelist audit` |
| 关票提交 | `U2-07: regression, whitelist audit, and implementation report`（含本报告、票 Answer、`map.md` 索引） |
| 推送 / PR / 合并 | **未执行** |
| U2-R2 | **未启动** |
