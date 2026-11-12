# I-02 U2 独立复核报告（R2 重审）

| 项 | 值 |
| --- | --- |
| 复核对象 | I-02 U2（I02-02 安全通过 Witness） |
| 复核类型 | **R2 重审**（授权包 §9.2；首次 R2 FAIL 后的修复回归复核） |
| 复核人 | **independent reviewer subagent (rerun), fresh context**（未参与 U2 编写 / U2-08 修复） |
| 日期 | **2026-11-12** |
| 首次报告（未被覆盖） | [`.scratch/level-playability-v1.1-i02/reports/R2-review.md`](./R2-review.md)（**FAIL**） |
| Diff 范围 | U2 全量 `23a2027..1fe09ef`；修复段 `f743c61..1fe09ef` |
| 复核时 HEAD | `1e0a948`（其后本票 claim 提交 `7595a56` 仅改 scratch 票；产品 / 授权包未漂移） |
| 授权包 | `docs/v7.8/移动-I02.md` |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（现场复算，**匹配**） |
| 授权范围记录 | [`.scratch/level-playability-v1.1-i02/reports/03-u2-incremental-authorization.md`](./03-u2-incremental-authorization.md)：仅 U2 实施 + R2；U3–U5 / `PUBLIC_*` / I-03 未授权 |
| **结论** | **PASS —— R2 重审通过；首次 FAIL 的 S2 / U9 项已解决。U2 可提交 U2-SIGN；R2 PASS 不替代用户签署。** |

> 本报告只依据本次复核人自己的 diff 检查、源码逐行通读、命令重跑与独立探针。
> 按硬约束，**未读取** `.scratch/level-playability-v1.1-u2/reports/07-implementation.md`、
> `08-fix-implementation.md`、`map.md`、`issues/` 下除 `09-u2-r2-review.md` 外的任何票，
> 也未读取 U2-08 / U2-09 的票与报告。证据日志只作原始输出对照，未作为结论依据。

---

## 0. 结论摘要

- **首次 FAIL 根因已解决**：首次报告 §4 指出的 S2 `lagPad` 单侧加宽，已改为
  **三处共用同一 helper 的对称 pad**（`conservativeLagPad` + `lagPaddedHazardBox`）。
  复核人用首次报告的**原始参数**（`at=(0,40)`、`anchor=(0,1)`、官方 `lag=16.67ms`）
  独立复现：修复后 `verifyTransition` 返回 `verified:false` / `failure:"hazard"`；
  精确 `∃δ` 反例仍成立（`t=195, δ=16.6 ⇒ u=211.6`，Hazard 盒 `[5.8,15.8]` 与玩家盒
  `[14,16]` 正宽度重叠）。
- **U9 的继承 FAIL 已解决**：接近 / 出口 / 停留与 S2 共用同一对称 pad；跨折返点的
  `move` 边（`(14,39)→(15,0)`）同样返回 `hazard`；U9 在该反例场景下不再出具证书
  （`failed / residual-wait`）。
- **§9.2 全部 11 项 PASS**；无 `FAIL`、无必要项 `NOT_RUN`。
- 命令：`pnpm build` / `pnpm typecheck` / 两个定向 vitest / 两次全量 `pnpm test` 均
  **退出码 0**。全量 `173 passed` / `2747 passed`；只有 vitest worker RPC
  `onTaskUpdate` 工具层超时（非断言失败），两次运行均复现，未作为 PASS 依据。
- 独立探针：598 条随机 S2 转移（373 条 verified）**0 条假验证**；499 条残差等待
  （335 条 verified）**0 条假验证**；399 条 U9 停留（215 条 verified）**0 条假验证**；
  W 最小不动点 / rank / 全 N 格闭包核查通过；Witness 编码不变量通过；U9 跨档隔离通过。

---

## 1. 输入完整性与 diff scope

### 1.1 授权包完整性

```text
$ shasum -a 256 docs/v7.8/移动-I02.md
797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56  docs/v7.8/移动-I02.md
```

与授权记录 `797cd6fc…` **逐字符匹配**。

### 1.2 U2 全量 diff（`23a2027..1fe09ef`）

产品路径只含 3 个白名单文件：

```text
$ git diff --numstat 23a2027..1fe09ef -- packages/
2604  0  packages/contracts/src/playability/temporal-witness.ts
264   0  packages/contracts/tests/playability-temporal-fixtures.ts
1409  0  packages/contracts/tests/playability-temporal-witness.test.ts
```

其余变更全部落在 `.scratch/level-playability-v1.1-i02/reports/03-u2-incremental-authorization.md`
与 `.scratch/level-playability-v1.1-u2/**`（票 / 地图 / 证据），未进入 `packages/**`。

### 1.3 修复段（`f743c61..1fe09ef`）

```text
$ git diff --numstat f743c61..1fe09ef -- packages/
55   44  packages/contracts/src/playability/temporal-witness.ts
117   2  packages/contracts/tests/playability-temporal-witness.test.ts
```

- 修复**改的是产品逻辑**（源码 +55/−44），不是只改测试；测试 +117/−2。
- `playability-temporal-fixtures.ts` 在修复段**未被修改**。
- 测试 diff 只改了 1 个旧测试名称并补了对称方向的断言；新增 5 条回归测试，
  **没有删除 / 弱化**既有断言。

### 1.4 漂移检查与未授权面

```text
$ git diff 1fe09ef..HEAD -- packages/ docs/
(空)
```

- 无 `package.json` / lockfile / tsconfig 改动；**无新依赖**。
- 无 `packages/demo/**`、`ops.ts`、`graph.ts`、`profile.ts`、`temporal.ts`、
  `temporal-result.ts`、`temporal-budget.ts`、`temporal-motion.ts`、barrel / package exports 改动。
- 无新增 / 修改 JSON fixture；`fixtures/packs/**` 未动。
- `git status --short` 为空；无产品路径的未跟踪文件。

现场复算的文件 SHA-256：

```text
67ecea21d2b29b524ea1ac3503999a58a327515312f2db92efbdf301f55a4668  packages/contracts/src/playability/temporal-witness.ts
10a6ce1e8a2735b94c4556a3d10bdbc5d78366522e73f77e8f0826c2b6dc75ed  packages/contracts/tests/playability-temporal-witness.test.ts
20b56290fbb76a978a849422fa91fcf1573426172c2d186f75889fc1c2a2b481  packages/contracts/tests/playability-temporal-fixtures.ts
```

修复前源码（`f743c61`）为 `a10c7df1c8e639a90c16b289d22eef46ec8897b172a7c2244848c30e9b4fd319`
（与首次报告记录一致）。

---

## 2. 首次 FAIL 根因与独立复现

### 2.1 首次报告结论引用

首次 [`R2-review.md`](./R2-review.md) §4 判定：

- `verifyTransition` 的 S2 按「当前单调段方向」**单侧**加宽 Hazard 盒；
- 当 `lagMs` 窗口跨过折返点 `m·P/2` 时，精确 `∃δ` 可达集包含折返后返回的**另一侧**
  位姿，单侧 pad 不覆盖 ⇒ 假验证；
- U9 的接近 / 出口使用同一 `verifyTransition`，继承该缺陷；
- 反例参数：Hazard `at=(0,40)`、`distance=50`、`P=200`、`w=10,h=12`、`anchor=(0,1)`；
  玩家 `2×20`、脚点 `(15,40)`；`N=40`、`dt=5`、`lag=16.67`，cell `[195,200]`。

### 2.2 修复代码位置（逐行核对）

`packages/contracts/src/playability/temporal-witness.ts`：

- `:619-628` 唯一 pad 量：`conservativeLagPad(slope, lagMs) = |slope| × lagMs`；
- `:630-646` 唯一加宽盒 helper：`lagPaddedHazardBox` 把盒子两侧各扩 `pad`
  （`paddedWidth = w + 2·pad`，anchor 折算为 `(ax·w + pad) / (w + 2·pad)`）；
- `:787` S2 使用该 helper；
- `:940-957` 残差等待使用同一 `pad` + 同一 helper；
- `:1601-1604` U9 停留使用同一 `pad` + 同一 helper；
- 全文件 `grep 'slope > 0\|slope < 0'` 只剩 `:1621` 的**方向标签**（`rising/falling/static`
  仅用于记录），不再参与 pad 方向。

`verifyTransition` / `verifyResidualWait` / `verifyU9Stay` **共用同一 pad helper**，
U2 内没有第二套方向性 pad。

### 2.3 独立复现（首次报告原始参数）

命令（探针在 `/tmp`，只读编译后的 `packages/contracts/dist/**`）：

```text
$ node /tmp/u2-probe-first-exact.mjs
{"N":40,"wait":{"verified":false,"failure":"hazard","t0":195,"t1":200},
 "playerBox":{"x":14,"y":20,"w":2,"h":20},"at200":false,"at2116":true,
 "hazardBox2116":{"x":5.799999999999997,"y":28,"w":10,"h":12}}
```

- 修复后 `verifyTransition(wait, (15,39)→(15,0), lag=16.67)`：`verified:false` /
  `failure:"hazard"`，时间 `[195,200]`。
- 精确 `∃δ` 反例仍成立：`u=211.6` 时 Hazard 盒 `[5.8,15.8]` 与玩家盒 `[14,16]`
  严格正宽度重叠；名义 `u=200` 不相交（`at200:false`）。

同一反例的 `move` 变体（`(14,39)→(15,0)`）与远离谷底的对照：

```text
$ node /tmp/u2-probe.mjs   # Part A
{"partA":{"grid":{"N":40,"dt":5},
 "wait":{"verified":false,"failure":"hazard","t0":195,"t1":200},
 "move":{"verified":false,"failure":"hazard"},
 "control":{"verified":true,"failure":null},
 "exactDeltaHit":true,"atTurn":false}}
```

- 跨折返点 `move` 已判 `hazard`；
- 同一 `move` 在 cell 19（`t∈[95,100]`，远离谷底）仍 `verified:true`，说明失败来自
  lag 窗口跨折返点，而不是 move / 静态检查本身。

### 2.4 为什么修复不是只改测试

- 修复段源码 +55/−44，删除了 S2 / 残差等待 / U9 停留里的三套单侧公式，改为共享
  helper；旧实现的 `paddedWidth = w + pad` 与按 `slope` 符号选 anchor 的代码已不存在。
- 独立探针直接调用**编译后的产品模块**复现出 `verified:false`，不是依赖测试名或作者日志。
- 旧公式对本反例的算术预测（复核人手算）：`slope=−0.5`、`pad=8.335`、
  `paddedWidth=18.335`、下降段 anchor `0.4546`；`t∈[195,200]` 时盒子右缘最大 `12.5 < 14`，
  旧实现会判 `verified:true`；新对称 pad 宽 `26.67`、右缘最大 `p+13.335`，与玩家盒相交。

### 2.5 U9 继承项的独立复现

```text
$ node /tmp/u2-probe-u9.mjs
{"N":40,"residual39":{"verified":false,"failure":"hazard"},
 "u9":{"status":"failed","failure":"residual-wait","reason":"no-witness-found","cell":null},
 "crossTurnMove":{"verified":false,"failure":"hazard"}}
```

- U9 的接近 / 出口 / 停留都经共享的 `verifyTransition` / `verifyU9Stay`；
- 反例场景的 cell 39 残差等待已 `hazard`，U9 整体 `failed / no-witness-found`；
- 与 W/U9 同型的跨折返点 `move` 边直接判 `hazard`。

### 2.6 对称 pad 的保守性论证（独立于测试）

三角波 `p(t)` 的速度绝对值处处 `≤ v_max = 2·distance / P`，因此对任意
`δ ∈ [0, lagMs]` 有 `|p(t+δ) − p(t)| ≤ v_max·lagMs`。把 Hazard 盒在时刻 `t`
**两侧各扩** `v_max·lagMs`，就包含所有 `δ` 下的 `hazardBox(t+δ)`；玩家盒在 `t`
与之严格重叠 ⇒ `intersectContinuous` 在 `t` 处给出正宽度开区间。该论证对窗口跨过任意
多个折返点都成立（Lipschitz 界不依赖单调段）。因此对称 pad 是精确 `∃δ` 的**保守超集**，
不会产生假验证；代价只是可能多判一些实际安全的转移（保守，不影响健全性）。

---

## 3. 命令重跑（退出码 / 计数 / 原始输出摘要）

| # | 命令 | 退出码 | 结果摘要 |
| --- | --- | ---: | --- |
| 1 | `pnpm build` | 0 | `tsc -b` + workspace bundle 全部 `Done`（`Scope: 10 of 11 workspace projects`；有 bundle 脚本的 demo / cli / mcp 均 Done） |
| 2 | `pnpm typecheck` | 0 | 全部 workspace `typecheck: Done` |
| 3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-witness.test.ts` | 0 | `1 passed (1)` / `73 passed (73)` |
| 4 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts` | 0 | `1 passed (1)` / `65 passed (65)` |
| 5 | `npx vitest run packages/contracts/tests/playability-temporal-input.test.ts -t 'T-(55\|57\|58\|61\|62\|64)' --reporter=verbose` | 0 | `6 passed \| 59 skipped (65)` |
| 6 | `pnpm test`（第 1 次） | 0 | `173 passed (173)` / `2747 passed (2747)`；`Errors 4` |
| 7 | `pnpm test`（第 2 次，环境空闲重跑） | 0 | `173 passed (173)` / `2747 passed (2747)`；`Errors 5` |

### 3.1 全量测试的 unhandled error：超时 vs 断言失败

两次运行都退出码 0，`Test Files 173 passed`、`Tests 2747 passed`。4 条 unhandled error
全部是 vitest 工具层 RPC 超时，**不是断言失败、不是测试超时用例**：

```text
Error: [vitest-worker]: Timeout calling "onTaskUpdate"
 ❯ Object.onTimeoutError node_modules/.pnpm/vitest@3.2.7_.../vitest/dist/chunks/rpc.-pEldfrD.js:53:10
```

- 首次复核时作者环境同样报告该工具层告警；本次复核两次复现，数量分别为 4 与 5（API 工具层抖动），
  属环境噪声，**未作为 PASS 依据**。
- U2 相关文件单独重跑均干净：witness `73/73`、input `65/65`；全量中亦全部通过。
- 不存在“测试超时”用例；错误栈均为 `onTaskUpdate` RPC。

### 3.2 架构断言 T-55 / T-57 / T-58 / T-61 / T-62 / T-64

```text
✓ T-55 contracts 源码不含 node:fs / node:crypto
✓ T-57 auditPlayabilityTemporal 生产调用者只有 ops.ts
✓ T-58 生产 analyze 实参只有 stubTemporalAnalyzer
✓ T-61 三处生产接线各至少一次
✓ T-62 常量唯一且不复用 FRAME_MARGIN_MS
✓ T-64 brand Symbol 只在 temporal-input.ts 铸造
Tests  6 passed | 59 skipped (65)
```

另对白名单源码做文本扫描：`temporal-witness.ts` 不含 `node:fs` / `node:crypto` /
`Symbol(` / `TEMPORAL_LAG` / `analyze:` / `auditPlayabilityTemporal(` / `FRAME_MARGIN_MS`
（`grep` 退出码 1，无命中）。

---

## 4. R2 逐项判定（对照首次报告）

| # | §9.2 项 | 首次 R2 | 本次重审 | 依据摘要 |
| --- | --- | --- | --- | --- |
| 1 | Witness 模型 | PASS | **PASS** | `(footX,k)`、脚点整数格、静态走廊、精确 spawn、wait/move、恒速线性、每边一格、状态边界到达、Goal 四边内缩 0.5px 均在源码与测试中一致 |
| 2 | S1–S4 | **FAIL（S2）** | **PASS（已解决）** | S2 改为三处共用的对称 pad；首次反例独立复现为 `verified:false` / `hazard`；S1 连续扫掠、S3 相位/时间、S4 链式连续性均正确 |
| 3 | 残差等待 | PASS | **PASS** | 整格位姿范围、跨折返点切段、非端点采样；修复后与 S2 共用对称 pad；随机探针 335 条 verified 中 0 假验证 |
| 4 | U9 | **FAIL（继承 S2）** | **PASS（已解决）** | `∀φ0` 接近、整周期停留、`∃ψ` 出口、同一 pad、严格相交、无最小安全窗口均正确；接近/出口经共享 `verifyTransition`，跨折返点 move 已判 `hazard`；反例场景 U9 不再出证 |
| 5 | 完整性 | PASS（机制） | **PASS** | 全 N 相位格、策略表 + 逐转移、从 spawn 可达闭包、严格递减 rank / 有限 trace、部分路径不提升、预算耗尽 ⇒ IE 均已实现；记录真实性不再受 S2 污染 |
| 6 | Witness 形状 | PASS | **PASS** | `policy + verification`；D9 信封 7 字段齐全；`derived:true`；规范化 JSON 确定性；`volume.bytes` 可独立复算；超限无部分 Witness |
| 7 | 双档 | PASS（附风险） | **PASS（附同一风险）** | 每次编码只接收一档 `lagMs` + 一个结果；U9 停留段强制校验 `lagPad` / `hazardSpeed`，跨档拼接 ⇒ `model-out`；`resolveTwoLagResults` 未改、回归通过。W 编码仍未绑定 hazard / lag 来源（见 §6） |
| 8 | 反例 | PASS | **PASS** | D3 §11 十三条逐条存在且通过（测试名 + 源码路径核对）；修复新增 5 条跨折返点回归，未削弱原 13 条 |
| 9 | 范围与模型条件 | PASS | **PASS** | 只改 U2 白名单；不发布公共 NB；无公共导出 / 生产接线；`coverage.temporal` 由显式前置输入约束，U9 不自行提升 coverage |
| 10 | 未提前实现 U3/U4/U5 | PASS | **PASS** | 无门区 / 图割 / hop 加倍 / 性能证据 / A–J 矩阵；无公共导出、无生产接线、无 JSON fixture、无新依赖 |
| 11 | T-55/57/58/61/62/64 | PASS | **PASS** | §3.2 六条全部通过 |

**总判定：PASS。** 首次报告的 2 个 FAIL（S1–S4 的 S2、U9 的接近/出口继承）均已解决；
其余项维持 PASS。无 `FAIL`、无必要项 `NOT_RUN`。

---

## 5. 独立探针记录（不依赖测试名）

探针位置：`/tmp/u2-probe.mjs`、`/tmp/u2-probe-u9.mjs`、`/tmp/u2-probe-stay.mjs`、
`/tmp/u2-probe-wbind.mjs`、`/tmp/u2-probe-first-exact.mjs`；只读编译后的
`packages/contracts/dist/**`，不修改仓库文件。

### 5.1 S2 / 残差等待 / U9 停留的随机健全性扫描

对每个随机世界，若产品判 `verified:true`，复核人用独立公式扫描
**玩家时刻 `t` / Hazard 时刻 `u=t+δ` 的精确 Hazard 位姿范围**（三角波极值在端点或
折返点取得），寻找任何正宽度碰撞；找到即“假验证”反例。

| 探针 | 覆盖 | verified 数 | **假验证** | 说明 |
| --- | --- | ---: | ---: | --- |
| S2 转移 | 598 条随机 `wait`/`move`，`lag ∈ {0,16.67,200}` | 373 | **0** | 扫描 `t∈[t0,t1]` 4000 点，逐点精确 `∃δ` 范围 |
| 残差等待 | 499 个随机格，`lag ∈ {0,16.67,200}` | 335 | **0** | 扫描 `u∈[C_k.start, C_k.end+lag]` |
| U9 停留 | 399 个随机 `s` / `T_arr`，`lag ∈ {0,16.67,200}` | 215 | **0** | 扫描 `u∈[T_arr, T_arr+P+lag]` |

结论：修复后的对称 pad 在随机参数下未发现假验证路径。

### 5.2 U9 停留的全周期 / 折返点切段 / 方向性 pad

`tArr` 取 50 / 75 / 100 / 0（`P=200`）：

- `tArr=50`：`segments=3`、`turnarounds=[100,200]`、`span=200`、方向
  `rising/falling/rising`、每段 `lagPad=|slope|×lagMs`、时间游标连续；独立全周期+lag
  扫描无碰撞。
- `tArr=100` / `tArr=0`：分别为 2 段；同样连续、单调、pad 一致、无碰撞。
- 结论：停留段**不是 dt 采样**，只在折返点切段；覆盖 `[T_arr, T_arr+P]` 整周期；
  pad 对称且与 `lagMs` 一致。

### 5.3 W 最小不动点 / rank / 全 N 格

独立核查三项（不依赖 `searchWinningSet` 的返回文案）：

1. 每个 rank 0 且无后继的状态都在 `arrival.goalStates`；每个 Goal 状态（所有 `k`）
   rank 均为 0（`goalRankMismatch=0`）；
2. 每个 rank > 0 的策略项都有 `verified:true` 的后继，`to.k=(from.k+1) mod N`，
   且后继 rank = 当前 rank − 1；
3. 每个**未入 W** 的状态都不存在指向 W 中状态的已验证转移（闭包补集检查）。

```text
safe world:        status=complete, winningStates=476, rankedStates=476,
                   spawnCovered=4/4, coveredPhases=[0,1,2,3],
                   goalRankMismatch=0, problems=[], closureViolations=0
cross-turn world:  status=failed,   winningStates=2574, rankedStates=2574,
                   spawnCovered=0, uncoveredPhases=[0..39],
                   goalRankMismatch=0, problems=[], closureViolations=0
```

这同时验证了「最小不动点」的闭包性质与「全 N 格覆盖」不是抽样。

### 5.4 Witness 编码不变量

对 safe world 的 W 编码：

- `policy` 每个下标都指向 `verified=1` 的元组，且下标在界内；
- `volume.transitions == verifications.length`；
- `volume.bytes == TextEncoder(serialized).length`（独立复算）；
- `serialized` 与复核人独立规范化 JSON（六个语义字段、键排序）逐字符相同；
- 每条元组 7 字段且 `verified=1`；
- `maxWitnessTransitions=0` / `maxWitnessBytes=10` 超限：`ok:false`，且**没有**
  `witness` / `serialized` 属性（无部分 Witness）。

```text
{"partF":{"fProblems":[],"ok":true,"bytes":10283,"transitions":368}}
```

### 5.5 跨档隔离

- U9：16.67ms 档结果用 200ms 请求编码 ⇒ `model-out`；同档 ⇒ `ok:true`：
  ```text
  {"partG":{"u9Status":"complete","crossOk":false,"crossReason":"model-out","sameOk":true,"sameReason":null}}
  ```
- W：API 一次只接受一个结果；`resolveTwoLagResults` / `temporal.ts` 未改。
- **残留风险**：W 编码不绑定 hazard / lag 来源，复核人实测把 `lagMs=0` 的 W 结果用
  `lagMs=200` 请求编码仍 `ok:true`。这与首次报告 §6 的风险一致，属调用方误用防护，
  不是实现层「拼接两个结果」；R2 项按首次口径 PASS，建议在 U5 / I-03 增加来源绑定。

---

## 6. 未覆盖项 / 风险清单

1. **W 编码未绑定 hazard / lag**：见 §5.5；U9 有绑定，W 没有。非本次 FAIL 根因，
   不改变 §9.2 判定，但应在 U5 / I-03 前补强。
2. **全量 `pnpm test` 的工具层 RPC 超时**：两次运行分别为 4 / 5 条
   `[vitest-worker]: Timeout calling "onTaskUpdate"`；退出码 0、测试全过，属工具噪声，
   未用于 PASS 论证。
3. **未运行真实 19 关语料 / 性能分布**：R2 不要求；U2 测试注释已说明真实
   `last-train/v2` 在 U2 模型下为 IE。真实参数下的预算 / 性能留给 U5。
4. **D9 原因码映射偏宽**：`spawn-not-standable` 等由 `gap` 细分承载；
   `coverage.temporal` 与玩家几何不可信共用 `geometry-untrusted`。在闭集约束下可接受，
   建议 U5 / I-03 保留结构化 `gap` / `failure`。
5. **U1 的 `temporal-motion.lagPad` 仍是有方向的导出**：它属 U1 既有 API，U2 白名单未改，
   `temporal-witness.ts` 也没有 import 它（只 import `intersectContinuous` /
   `pieceSlope` / `triangleMaxRate` / `trianglePosition`）。U2 内不存在第二套方向性 pad。
6. 复核人未读取作者实现报告 / 修复报告 / 地图 / 其它 U2 票（按硬约束）。

---

## 7. 用户签署栏（由 U2-SIGN 填写，复核人留空）

```text
用户结论：        [ ] 接受 R2 重审结论（PASS，U2 可提交 U2-SIGN）
                  [ ] 不接受 / 要求补充复核
签署人：          ______________________
日期：            ______________________
备注：            ____________________________________________________________
```

> R2 PASS 只表示 U2 复核通过，**不替代**用户签署，也不构成 U3 / U4 / U5、
> `PUBLIC_NB` / `PUBLIC_PU` 或 I-03 接线的授权。

---

## 8. 复核声明

- 复核人未参与 U2 编写或 U2-08 修复；本报告全部结论来自本次独立阅读源码、
  检查 diff、重跑命令与自建探针。
- 复核人**未读取**以下作者结论路径：
  `.scratch/level-playability-v1.1-u2/reports/07-implementation.md`、
  `.scratch/level-playability-v1.1-u2/reports/08-fix-implementation.md`、
  `.scratch/level-playability-v1.1-u2/map.md`、
  `.scratch/level-playability-v1.1-u2/issues/` 下除 `09-u2-r2-review.md` 外的任何票，
  以及 U2-08 / U2-09 的票与报告；未把作者总结 / PASS 结论 / 调试笔记作为依据。
- 复核人未修改 `packages/**`、`fixtures/**`、产品代码、测试或配置；未覆盖首次
  `R2-review.md`；未推送、未创建 PR、未合并；未开始 U3。
- 本报告路径：`.scratch/level-playability-v1.1-i02/reports/R2-review-rerun.md`。
