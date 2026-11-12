# U2-09 修复后实现报告 — 回归、白名单审计与 R2 重审输入包

- 会话：U2-09（修复后回归 / 审计 / R2 输入），2026-11-12，独立于 U2-08 修复会话。
- 分支：`wayfinder/level-playability-v1.1-u2`（审计起点工作区干净）。
- U2 base：`23a2027e30afaef033b2afe3d5a4a8a424fec20c`。
- 修复 head（审计起点）：`1fe09ef53a19eaedf425f2af75002e054a8441ef` `U2-08: conservative S2 lagPad and turn-crossing regressions`。
- 本票 claim 提交：`918103b46f0b52af01ab303f2be6378fa73e6cf4`。
- 授权包：`docs/v7.8/移动-I02.md` @ `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（本会话复算一致）。
- 首次 R2 FAIL 报告：`.scratch/level-playability-v1.1-i02/reports/R2-review.md`（`sha256:2f68456805c77ccd1fc7cb61386868c0d50037f676754ac356cfd525454e5fae`，未修改、未覆盖）。
- 本报告结论：**PASS（回归 / 范围 / 架构）**。R2 重审**未启动**；语义正确性仍由新的独立 R2 会话判定。

## 1. 结论摘要

1. U2-08 的对称 pad 修复已落地，S2 / 残差等待 / U9 停留三处共用同一对称 pad helper（读代码确认，见 §2）。
2. R2 §4.3 的官方 `16.67ms` 反例：修复前 `verified:true`，修复后由测试断言为 `verified:false` / `failure:"hazard"`；本会话用独立脚本复算同一几何，结果一致（§3）。
3. `pnpm build` / `pnpm typecheck` / U2 witness 定向 73/73 / input 定向 65/65 / 全量 `pnpm test` 173 files · 2747 tests 全部 exit 0（全量两次，§4）。
4. `23a2027..1fe09ef` 产品路径**只有 U2 白名单 3 文件**；无白名单外产品文件 / 新依赖 / JSON fixture / barrel / 公共导出；`docs/` 零 diff（§5、§6）。
5. T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全部 PASS；新模块 / 测试无禁用模式，`temporal-witness.ts` 不 import `temporal.ts`（§7）。
6. 无需扩 D9 闭集 / `BudgetProfile`；无 STOP 条件触发（§10）。

**范围声明：本票只做回归、审计与输入包整理；未推送、未创建 PR、未合并、未启动 R2 重审、未改 `R2-review.md`。**

## 2. 修复选择与三处 pad 的统一方式

### 2.1 修复选择：对称 pad（U2-08 方案 1）

`pad = conservativeLagPad(slope, lagMs) = |slope| × lagMs`，并把 Hazard 盒**左右各扩** `pad`：

- 宽度：`w + 2·pad`；
- 锚点：`anchor.x' = (anchor.x·w + pad) / (w + 2·pad)`；
- 静止 Hazard `slope = 0 ⇒ pad = 0`，盒不变。

该界与方向无关：三角波速度有界 ⇒ `|p(t+δ) − p(t)| ≤ |slope|·lagMs`（δ ∈ [0, lagMs]），
窗口跨折返点 `m·P/2` 时 Hazard 回到当前单调段另一侧也被覆盖。I02-03 §8.1 已证对称 pad 是
精确 `∃δ` 的保守超集；未选「精确滑动窗口」是因为它与对称 pad 等价而实现 / 预算记账更复杂。

原「按当前单调段方向单侧加宽」的分支已删除；`slope` 的符号只保留给 U9 诊断字段
`direction: "rising" | "falling" | "static"`，不再决定 pad 方向。

### 2.2 三处共用同一 helper（代码核对，不依赖测试名）

`packages/contracts/src/playability/temporal-witness.ts`：

| 位置 | 代码 | 用途 |
| --- | --- | --- |
| `:628` | `const conservativeLagPad = (slope, lagMs) => Math.abs(slope) * lagMs` | 唯一 pad 量函数 |
| `:634` | `const lagPaddedHazardBox(hazard, pad)` | 唯一对称加宽盒构造 |
| `:787`（S2，`verifyTransition`） | `const padded = lagPaddedHazardBox(hazard, conservativeLagPad(slope, lagMs))` | 每单调段一次 `intersectContinuous` |
| `:940-941`（`verifyResidualWait`） | 同一 `pad` + 同一 `padded`；`leftOffset = ax·w + pad`，并集扫掠盒左右各扩 `pad` | 整格残差等待 |
| `:1601-1604`（`verifyU9Stay`） | 同一 `pad`；`hazard: lagPaddedHazardBox(hazard, pad)` | 停留段逐单调段求交 |

三处不存在第二套方向性 pad。编码 / 诊断字段语义不变：`stay.lagPad` 仍为
`hazardSpeed·lagMs`，`segment.lagPad` 仍为 `|slope|·lagMs`，`encodeWitness` 的
U9 来源校验（`stay.lagPad === hazardSpeed·lagMs` 等）不变。

## 3. R2 §4.3 官方反例：修复前 / 修复后

### 3.1 几何（与 R2 §4.3 等价）

| 参数 | 值 |
| --- | --- |
| Hazard | `periodMs=200`、`distance=50`、`box 10×12`、`anchor (0.5,1)`、`hazardSpeed = 0.5 px/ms` |
| 玩家 | `2×20`、脚点 `(15,40)`、盒 `[14,16]×[20,40]` |
| 网格 | `maxSpeed=0.2 px/ms`、`N=40`、`dt=5ms` |
| 转移 | `wait (15,39) → (15,0)`，规范时间 `[195,200]`（下降段） |
| lag | `16.67ms` ⇒ `pad = 8.335` |

测试夹具用 `hazard.at.x = 5 + anchor 0.5` 复现 R2 的 `at.x = 0 + anchor 0`；因二者只差
整体平移 +5，绝对 Hazard 盒完全相同（`t=195` 盒 `[2.5,12.5]`、`t=211.6` 盒 `[5.8,15.8]`）。

### 3.2 修复前

旧实现（单侧 pad，下降段向左）在 cell 39 的 padded 盒为
`w' = 18.335`、`anchor.x' = 0.7272975`，即相对锚点 `[p − 13.335, p + 5]`；
段内 `p ∈ [5, 7.5]` ⇒ 盒右缘最大 `12.5 < 14` ⇒ 不碰撞 ⇒ `verified:true`。
与 R2 §4.3 记录的 `{"verified":true,"failure":null,"t0":195,"t1":200,"segments":1}` 一致。

### 3.3 修复后

- 产品测试断言（`playability-temporal-witness.test.ts:472`，`[I02-02][R2-FIX][AC-03][S2]`）：
  `verified === false`、`failure === "hazard"`；同一测试还断言精确 `∃δ` 见证：
  玩家盒与 `hazardBoxAt(t=200)` **不**重叠、与 `hazardBoxAt(t=211.6)` **正宽度重叠**。
- 独立复算（`node` 直接调用构建产物 `temporal-motion.js` 的 `intersectContinuous`，仅替换
  pad 盒为旧 / 新两种公式；原始输出 `evidence/09-r2-section4-repro.log`）：

```text
old padded box  {w:18.335, anchor.x:0.7272975…} → positiveIntervals: []            ⇒ verified:true
new padded box  {w:26.67,  anchor.x:0.5}         → positiveIntervals: [{start:195,end:200}] ⇒ verified:false
nominal box @t=195 [2.5,12.5]  vs player [14,16] → overlap:false
nominal box @t=200 [0,10]      vs player [14,16] → overlap:false
hazard @δ=16.6 (t=211.6) [5.8,15.8] vs player    → overlap:true
∃δ 扫描 [0,16.67]×0.01ms：367 个碰撞时刻，首个 δ=13.01（t=208.01，盒 [4.005,14.005]）
```

- `lagMs=200` 跨折返点变体（`N=3、k=2、footX=45`）：测试断言 `verified:false` /
  `failure:"hazard"`，且 `hazardBoxAt(t=200)` 不重叠、`hazardBoxAt(t=300)` 正宽度重叠。

### 3.4 回归测试清单（5 条新增 + 1 条更新，全部通过）

| 测试 | 覆盖 |
| --- | --- |
| `[R2-FIX][AC-03][S2]` 官方 16.67ms 反例（`:472`） | wait 边跨折返点 ⇒ `hazard` |
| `[R2-FIX][AC-03][S2]` `lagMs=200` 变体（`:497`） | 大 lag 跨折返点 ⇒ `hazard` |
| `[R2-FIX][AC-03][W/U9]` 跨折返点 move 转移（`:519`） | `W_{→s}` / `W_{→goal}` 同型 move 边 ⇒ `hazard`；cell 19 对照仍安全 |
| `[R2-FIX][AC-04][residual]` 残差等待整格覆盖（`:639`） | lag 0 安全 / lag 16.67 失败 |
| `[R2-FIX][AC-03][W]` cell 39 不再被覆盖（`:760`） | `status:"failed"`、`uncoveredPhases` 含 39 |
| `[S2] lagPad 两侧对称加宽`（更新，`:429`） | 保留上升段右扩 / 下降段左扩断言，新增上升段左扩 / 下降段右扩 |

`git diff` 核对：测试文件相对修复前只删除 1 行 import 与 1 行旧测试标题，**未删除 / 弱化任何断言**。

## 4. 命令、退出码与计数

环境：darwin 24.6.0，pnpm workspace，vitest 3.2.7。原始输出均存
`.scratch/level-playability-v1.1-u2/evidence/09-*.log`（`*.log` 被 `.gitignore` 忽略）。

| 命令 | 退出码 | 计数 | 证据 |
| --- | --- | --- | --- |
| `pnpm build` | **0** | 10 workspace 项目 bundle 完成 | `09-build.log` |
| `pnpm typecheck` | **0** | 全部 package typecheck Done | `09-typecheck.log` |
| `pnpm exec vitest run …/playability-temporal-witness.test.ts` | **0** | **73/73**（1 file） | `09-vitest-witness.log` |
| 同上 `-t "R2-FIX"` | **0** | **5 passed / 68 skipped** | `09-vitest-r2fix.log` |
| `pnpm exec vitest run …/playability-temporal-input.test.ts` | **0** | **65/65** | `09-vitest-input.log` |
| 同上 `--reporter=verbose` | **0** | **65/65**（T-55～T-65 逐条 ✓） | `09-vitest-input-verbose.log` |
| `pnpm test`（第 1 次） | **0** | **173 files / 2747 tests passed**；`Errors 5`；`Duration 216.86s` | `09-test-full-run1.log` |
| `pnpm test`（第 2 次复跑） | **0** | **173 files / 2747 tests passed**；`Errors 5`；`Duration 195.95s` | `09-test-full-run2.log` |

### 4.1 全量测试的 unhandled error 分类（超时 vs 断言失败）

两次全量运行的 `Errors` 全部是同一工具层错误：

```text
Error: [vitest-worker]: Timeout calling "onTaskUpdate"
```

- 均为 vitest worker → runner 的 RPC 回调超时，属**工具层 unhandled error**；
- **不是**测试超时（日志无 `test timed out` / hook timeout）、**不是**断言失败
  （`Tests 2747 passed`，无 `FAIL` / `AssertionError`）；
- 退出码 0；U2-07 / U2-08 会话记录同类错误（2～3 条），本次第 1 次 5 条与运行时长
  216.86s（环境较忙）一致；第 2 次复跑见上表。
- 结论：不影响验收判定；作为已知环境限制记录（§8）。

## 5. `git diff --stat`

```text
$ git diff --stat 23a2027..1fe09ef
 .../reports/03-u2-incremental-authorization.md     |   73 +
 .../reports/R2-review.md                           |  366 +++
 .../evidence/00-baseline.md                        |  141 ++
 .../issues/01-u2-00-init.md                        |   58 +
 .../issues/02-u2-01-grid-corridor-spawn.md         |   94 +
 .../issues/03-u2-02-wait-move.md                   |  114 +
 .../issues/04-u2-03-winning-set.md                 |  124 +
 .../issues/05-u2-04-u9.md                          |  202 ++
 .../issues/06-u2-05-witness-encoding.md            |  150 ++
 .../issues/07-u2-06-tests.md                       |  111 ++
 .../issues/08-u2-07-audit.md                       |  101 ++
 .../issues/09-u2-r2-review.md                      |  107 ++
 .../level-playability-v1.1-u2/issues/10-u2-sign.md |   33 +
 .../issues/11-u2-08-s2-lagpad-fix.md               |  166 ++
 .../issues/12-u2-09-fix-audit.md                   |   41 +
 .scratch/level-playability-v1.1-u2/map.md          |  154 ++
 .../reports/07-implementation.md                   |  300 +++
 .../contracts/src/playability/temporal-witness.ts  | 2604 ++++++++++++++++++++
 .../tests/playability-temporal-fixtures.ts         |  264 ++
 .../tests/playability-temporal-witness.test.ts     | 1409 +++++++++++
 20 files changed, 6612 insertions(+)
```

产品路径（`packages/**`）子集：

```text
 .../contracts/src/playability/temporal-witness.ts  | 2604 ++++++++++++++++++++
 .../tests/playability-temporal-fixtures.ts         |  264 ++
 .../tests/playability-temporal-witness.test.ts     | 1409 +++++++++++
 3 files changed, 4277 insertions(+)
```

修复提交本身（U2-08，`b14f7b5..1fe09ef`）：4 files，`+272 / −47`，产品侧只有
`temporal-witness.ts`（`+55/−44`）与 `playability-temporal-witness.test.ts`（`+117/−2`）；
`fixtures` **未改**。

## 6. U2 白名单核对表

### 6.1 产品路径（逐文件）

| 文件 | 变更 | 白名单依据 | 判定 |
| --- | --- | --- | --- |
| `packages/contracts/src/playability/temporal-witness.ts` | A（+2604 / −0） | 授权包 §5.2「新增 U2 Witness」 | **PASS** |
| `packages/contracts/tests/playability-temporal-witness.test.ts` | A（+1409 / −0） | §5.2「`playability-temporal*.test.ts` 只新增测试」；§8.1 U2/R2 | **PASS** |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | M（+264 / −0，纯增） | §5.2 **TEST_ONLY**，可扩展 | **PASS** |

`git diff --numstat 23a2027..1fe09ef`：三个产品文件删除行均为 0；fixtures 的 264 行全为新增，
未改既有导出。

### 6.2 禁止路径核对（全部为空）

| 检查 | 命令 | 结果 | 判定 |
| --- | --- | --- | --- |
| `packages/demo/**` / `cli/**` / `mcp/**` / `pipeline/**` / `assets/**` | `git diff --name-status 23a2027..1fe09ef -- <path>` | 空 | **PASS** |
| `ops.ts` / `graph.ts` / `profile.ts` / `reach.ts` / `targets.ts` / `geometry.ts` | 路径扫描 | 未出现 | **PASS** |
| `temporal.ts` / `temporal-motion.ts` / `temporal-result.ts` / `temporal-budget.ts` / `temporal-input.ts` | 路径扫描 | 未出现 | **PASS** |
| 公共 barrel（`playability/index.ts`、`contracts/src/index.ts`） | 路径扫描 + `grep temporal-witness` | 空 / 无引用 | **PASS** |
| `package.json` / `pnpm-lock.yaml` / workspace / tsconfig / vitest 配置 | 路径扫描 | 空 | **PASS** |
| 新依赖 | `package.json` / lockfile 无 diff | 无 | **PASS** |
| JSON fixture（`fixtures/packs/**`、`tests/fixtures/**`、`*.json`） | `git diff --name-only … -- '*.json' fixtures` | 0 行 | **PASS** |
| `docs/**` | `git diff --name-only … -- docs` | 0 行；授权包 SHA `797cd6fc…` 不变 | **PASS** |
| U3 / U4 模块（`temporal-gate.ts` / `temporal-evasion.ts`） | 名称扫描 | 未创建 | **PASS** |

自动化分类（对 `git diff --name-only 23a2027..1fe09ef` 逐项）：

```text
PRODUCT-WHITELIST 3
SCRATCH-U2 15
AUTH-RECORD 2      # 03-u2-incremental-authorization.md、R2-review.md（首次 FAIL 报告，未改）
OUT-OF-SCOPE 0
RESULT: PASS (no out-of-scope file)
```

## 7. 架构与静态扫描

### 7.1 既有架构断言（input verbose，65/65）

| 断言 | 实测 | 判定 |
| --- | --- | --- |
| T-55 contracts `src` 不含 `node:fs` / `node:crypto` | ✓ 1ms | **PASS** |
| T-57 `auditPlayabilityTemporal(` 生产调用者只有 `ops.ts` + `temporal.ts` | ✓ 1ms | **PASS** |
| T-58 生产 `analyze:` 实参只有 `stubTemporalAnalyzer` | ✓ 1ms | **PASS** |
| T-61 三处生产接线（`ops.ts` / `create-game.ts` / `publish-gate.ts`）各至少一次 | ✓ 1ms | **PASS** |
| T-62 `TEMPORAL_LAG_*` 常量唯一、不复用 `FRAME_MARGIN_MS` | ✓ 3ms | **PASS** |
| T-64 `Symbol(` 只在 `temporal-input.ts` 铸造 | ✓ 2ms | **PASS** |
| T-56 / T-59 / T-60 / T-63 / T-65 | ✓ | **PASS** |

证据：`09-vitest-input-verbose.log`（65/65，exit 0）。

### 7.2 新模块 / 新测试静态扫描

对 `temporal-witness.ts`、`playability-temporal-witness.test.ts`、`playability-temporal-fixtures.ts`
及 `23a2027..1fe09ef` 的全部新增 `packages/**` 行做扫描：

```text
analyze:                 0
auditPlayabilityTemporal( 0
Symbol(                  0
TEMPORAL_LAG_*           0
node:fs / node:crypto    0
```

- `temporal-witness.ts` 的 import 只有 `assetpack` / `game-config` / `geometry` / `graph` /
  `profile` / `temporal-budget` / `temporal-motion` / `temporal-result`；**不 import `temporal.ts`**（D6 DAG）。
- U2-08 新增的两个 helper 均为模块内 `const`（**不 export**）；模块无新增公共 barrel 导出。
- 未扩 D9 闭集（`temporal-result.ts` 零 diff、`TransitionFailureKind` 未变）、未扩 `BudgetProfile`
  （`temporal-budget.ts` 零 diff，模块只读使用 `BudgetProfile` 既有字段）。

## 8. 未覆盖项 / 已知限制

来自 U2-08 Answer：

1. 对称 pad 是**保守超集**而非最小精确集：贴边情形可能比精确窗口更保守，但不会产生假验证；
   这是恢复证明健全性的代价。
2. U9 停留段（静态玩家 + 整周期）上，对称 pad 与旧方向 pad 的并集等价（R2 §5.3 已指出停留段
   本身不受该缺陷影响），因此**没有可区分的失败回归**；一致性由共享 helper 保证。
3. 未构造出「W/U9 搜索 `complete→failed` 仅由一条跨折返点边导致」的隔离用例：同一 Hazard 下
   spawn 列其它相位格会先失败，`complete→failed` 无法只归因于该边。W 级回归改为断言 cell 39
   的整格覆盖结果，并用 `verifyTransition` 直接覆盖 wait / move 两种边。
4. W 编码仍不绑定 hazard / lag 来源（R2 §6 残留风险），本票未处理，留待重审判定。

来自 R2 §6–§7（重审时仍需逐项复核）：

5. **W 编码未绑定 hazard / lag**：`encodeWinningSetParts` 只消费 `result`，不读 `request.hazard` /
   `request.lagMs`；U9 编码只校验停留段 `lagPad` / `hazardSpeed`。属健壮性 / 误用防护问题。
6. R2 §7 第 1 条「lag 跨折返点未被测试覆盖」：**已由 U2-08 的 5 条回归关闭**（§3.4）。
7. 全量 `pnpm test` 的 vitest worker `onTaskUpdate` RPC 超时（工具层）未消除；两次运行分别
   5 / 5 条，均非断言失败、均 exit 0。
8. `spawn-not-standable` / `coverage.temporal` 的 D9 原因码映射偏宽（`gap` / `geometry-untrusted`），
   在闭集约束下可接受，但应在 U5 / I-03 诊断中保留结构化信息。
9. 未运行真实 19 关语料 / `last-train/v2` 的 U2 正样本；未覆盖真实关卡参数下的性能 / 预算分布。
10. 首次 R2 复核人未读取作者实现报告 / 地图 / 其它 U2 票（按隔离硬约束）。

## 9. 产品目录只改 U2 白名单（声明）

本 effort 自 `23a2027` 至修复 head `1fe09ef`，产品目录（`packages/**`）**只改**：

1. `packages/contracts/src/playability/temporal-witness.ts`（新增）
2. `packages/contracts/tests/playability-temporal-witness.test.ts`（新增）
3. `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，纯增）

**未修改**任何其它产品文件（含 `packages/demo/**`、`ops.ts`、`graph.ts`、`profile.ts`、
`temporal.ts`、`temporal-result.ts`、`temporal-budget.ts`、`temporal-motion.ts`、barrel、
`package.json`、lockfile、JSON fixture），**未新增依赖**，`docs/**` 零 diff，授权包 SHA 不变。

## 10. R2 重审输入包

> 重审由**新的独立会话**执行；不得把本报告的 PASS 结论 / 作者总结当复核结论。
> **不得覆盖首次 FAIL 报告**；重审结论写入新文件。

### 10.1 输入清单

| 项 | 值 |
| --- | --- |
| 授权包 | `docs/v7.8/移动-I02.md` @ `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| U2 base | `23a2027e30afaef033b2afe3d5a4a8a424fec20c` |
| 修复 head | `1fe09ef53a19eaedf425f2af75002e054a8441ef`（U2-08 修复提交） |
| 修复 delta | `git diff b14f7b5..1fe09ef`（4 files，`+272/−47`；产品 2 文件，fixtures 未改） |
| 累计 diff | `git diff 23a2027..1fe09ef`（20 files；产品 3 文件） |
| 首次 FAIL 报告（只读，不得覆盖） | `.scratch/level-playability-v1.1-i02/reports/R2-review.md` @ `sha256:2f68456805c77ccd1fc7cb61386868c0d50037f676754ac356cfd525454e5fae`；§4 为 FAIL 根因与官方反例，§6–§7 为残留风险 |
| 重审结论落点（**新文件**） | `.scratch/level-playability-v1.1-i02/reports/R2-review-rerun.md` |
| 复核清单 | 授权包 §9.2（Witness 模型 / S1–S4 / 残差等待 / U9 / 完整性 / Witness 形状 / 双档 / 反例 / 范围与模型条件），逐项 `PASS` / `FAIL` / `NOT_RUN` |

### 10.2 复核必须解释的两个问题

1. **R2 §4 FAIL 是否已修复**：S2 / 残差等待 / U9 停留是否都使用对称（无方向）pad；`16.67ms` 与
   `200ms` 跨折返点反例是否失败；是否存在第二套方向性 pad。
2. **修复是否引入新的过保守假失败 / 范围问题**：对称 pad 的代价、W/U9 搜索行为变化、U2 白名单。

### 10.3 复核命令

```bash
pnpm build
pnpm typecheck
pnpm exec vitest run packages/contracts/tests/playability-temporal-witness.test.ts --reporter=verbose
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose
pnpm test
git diff --stat 23a2027..1fe09ef
git diff --name-status 23a2027..1fe09ef
```

### 10.4 证据路径（作者侧原始输出，仅供对照；复核人须自行复跑）

- `../evidence/09-build.log` — `pnpm build`（exit 0）
- `../evidence/09-typecheck.log` — `pnpm typecheck`（exit 0）
- `../evidence/09-vitest-witness.log` — U2 witness 定向（73/73）
- `../evidence/09-vitest-r2fix.log` — 5 条 `[R2-FIX]` 回归（5 passed / 68 skipped）
- `../evidence/09-vitest-input.log` / `09-vitest-input-verbose.log` — 架构断言（65/65，T-55～T-65）
- `../evidence/09-test-full-run1.log` / `09-test-full-run2.log` — 全量两次（173 files / 2747 tests，exit 0）
- `../evidence/09-r2-section4-repro.log` — R2 §4.3 反例修复前 / 后独立复算
- `../evidence/08-full-rerun.log` — U2-08 修复会话的全量记录（对照）

`*.log` 被 `.gitignore` 忽略，仅本机保留；复核人不得引用上述日志作为自己的复核结论。

### 10.5 状态

- R2 重审：**未启动**（本票不启动；`R2-review-rerun.md` 尚不存在，由重审会话创建）。
- 首次 `R2-review.md`：**未修改**（SHA 见 10.1）。
- 推送 / PR / 合并：**未执行**。

## 11. STOP / 范围检查

| 停止条件 | 结果 |
| --- | --- |
| 白名单外产品文件 / 新依赖 / 公共导出 | **未触发**（§6 / §7.2） |
| 架构断言失败 | **未触发**（T-55 / 57 / 58 / 61 / 62 / 64 全 PASS） |
| 全量测试断言失败 / 重跑仍失败 | **未触发**（两次 exit 0，2747/2747；仅工具层 RPC 超时） |
| 需要扩 D9 闭集 / `BudgetProfile` | **未触发**（两者零 diff） |

**结论：PASS**（回归 / 范围 / 架构）。U2 的语义正确性仍由新的独立 R2 会话判定；
R2 PASS 不等于 U3 授权，也不等于用户签署。

## 12. 产物与提交

| 项 | 值 |
| --- | --- |
| Claim 提交 | `918103b` `docs(wayfinder): claim U2-09 post-fix regression and audit` |
| 关票提交 | `U2-09: post-fix regression, audit, and R2 re-review input`（含本报告、票 Answer、`map.md` 索引） |
| 修复 head（审计对象） | `1fe09ef` U2-08 |
| 推送 / PR / 合并 | **未执行** |
| R2 重审 | **未启动** |
