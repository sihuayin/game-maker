# I-02 U2 独立复核报告（R2）

| 项 | 值 |
| --- | --- |
| 复核对象 | I-02 U2（I02-02 安全通过 Witness） |
| 复核类型 | R2（授权包 §9.2） |
| 复核人 | **independent reviewer subagent, fresh context**（未参与 U2 编写） |
| 日期 | **2026-11-12** |
| Diff 范围 | `23a2027..f743c61`（U2 产品 / 审计 head） |
| 复核时 HEAD | `ef34df4`（`f743c61..HEAD` 仅含 scratch 票 / 地图） |
| 授权包 | `docs/v7.8/移动-I02.md` |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（现场复算，**匹配**） |
| 授权范围记录 | `.scratch/level-playability-v1.1-i02/reports/03-u2-incremental-authorization.md`：U2 实施 + R2；U3–U5 / `PUBLIC_*` / I-03 未授权 |
| **结论** | **FAIL —— R2 不通过；U2 不得标记完成** |

> 本报告只依据本次复核人自己的 diff 检查、源码通读与命令重跑；未读取
> `.scratch/level-playability-v1.1-u2/reports/07-implementation.md`、`map.md`、
> 或 `issues/` 下除 `09-u2-r2-review.md` 外的任何作者结论票。
> 证据日志只作为原始输出对照，未作为结论依据。

---

## 0. 结论摘要

- **FAIL 根因**：`S1–S4` 的 **S2 lagPad 不是保守覆盖**。实现按「当前单调段方向」单侧
  加宽 Hazard 盒；当 `lagMs` 窗口跨过折返点时，精确 `∃δ` 可达集包含折返后返回的另一侧
  位姿，而单侧 pad 不覆盖。复核人用**精确区间算术**构造了 `lagMs = 16.67ms`（官方档）
  的反例：`verifyTransition` 返回 `verified: true`，但存在 `δ ∈ [0, 16.67]` 使玩家盒与
  Hazard 盒**正宽度严格相交**。这会让 W（以及 U9 的接近 / 出口转移）出现「假验证」，
  属于证明健全性失败。
- **未通过项**：`S1–S4`（S2）、`U9`（接近 / 出口转移继承 S2；其结构项与停留段本身通过）。
- 其余项（Witness 模型、残差等待、完整性机制、Witness 形状、反例 13 条、范围与模型条件、
  T-55/57/58/61/62/64、未提前实现 U3–U5）经独立检查通过，详见下表。
- `pnpm build` / `pnpm typecheck` / U2 定向 vitest / `pnpm test` 均退出码 0；全量 173 文件 /
  2742 测试全部通过，但有 2 条 vitest worker RPC `onTaskUpdate` 超时（工具层，非断言失败），
  两次重跑复现同样 2 条。

---

## 1. 输入与 diff scope

### 1.1 授权包完整性

```text
$ shasum -a 256 docs/v7.8/移动-I02.md
797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56  docs/v7.8/移动-I02.md
```

匹配要求的 `797cd6fc…`。

### 1.2 U2 diff（`23a2027..f743c61`）

产品路径只有 3 个白名单文件：

```text
A  packages/contracts/src/playability/temporal-witness.ts          (+2593)
M  packages/contracts/tests/playability-temporal-fixtures.ts       (+264)
A  packages/contracts/tests/playability-temporal-witness.test.ts   (+1294)
```

其余新增全部落在
`.scratch/level-playability-v1.1-i02/reports/03-u2-incremental-authorization.md`
与 `.scratch/level-playability-v1.1-u2/**`（票 / 地图 / 证据），未进入 `packages/**`。

独立核对：

- 无 `package.json` / lockfile / tsconfig 改动；无新依赖。
- 无 `packages/demo/**`、`ops.ts`、`graph.ts`、`profile.ts`、`temporal.ts`、
  `temporal-result.ts`、`temporal-budget.ts`、`playability/index.ts`、
  `contracts/src/index.ts` 或 package exports 改动。
- 无新增 / 修改 JSON fixture；`fixtures/packs/**` 未动。
- `git diff f743c61..HEAD -- packages/ docs/` **为空**（HEAD 后仅 scratch 票 / 地图）。

文件 SHA-256（现场复算）：

```text
a10c7df1c8e639a90c16b289d22eef46ec8897b172a7c2244848c30e9b4fd319  packages/contracts/src/playability/temporal-witness.ts
a472186784949f7da1295cb132f5927e725a57b640c9d427a91ef0a18347e59e  packages/contracts/tests/playability-temporal-witness.test.ts
20b56290fbb76a978a849422fa91fcf1573426172c2d186f75889fc1c2a2b481  packages/contracts/tests/playability-temporal-fixtures.ts
```

### 1.3 白名单 / 未授权范围

- 增量授权记录确认：仅 U2 实施 + R2；U3–U5、`PUBLIC_NB` / `PUBLIC_PU`、I-03 接线均未授权。
- 复核未发现越权实现：无门区证明、图割、hop 加倍、性能证据、A–J 矩阵、公共导出、
  生产接线、JSON fixture 或新依赖。
- `WitnessSpaceFailure.reason` / `WitnessEncodingFailure.reason` 只使用
  `temporal-result.ts` 的 `DegradationReason` 闭集；D3 的 `spawn-not-standable` 等名称
  通过内部 `gap` / `failure` 细分承载，**未扩 D9 闭集**。

---

## 2. 命令重跑（退出码 / 计数 / 原始输出摘要）

| # | 命令 | 退出码 | 结果摘要 |
| --- | --- | ---: | --- |
| 1 | `pnpm build` | 0 | `tsc -b` + 10 个 workspace bundle 全部 Done |
| 2 | `pnpm typecheck` | 0 | 全部 workspace `typecheck: Done` |
| 3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-witness.test.ts` | 0 | `68 passed (68)`，1 文件通过 |
| 4 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts` | 0 | `65 passed (65)`，1 文件通过 |
| 5 | `pnpm test`（第 1 次） | 0 | `173 passed (173)` / `2742 passed (2742)`；`Errors 2` |
| 6 | `pnpm test`（第 2 次，环境空闲重跑） | 0 | `173 passed (173)` / `2742 passed (2742)`；`Errors 2` |

### 2.1 全量测试的 2 条 unhandled error（超时 vs 断言失败）

两次运行的 2 条错误完全相同，均为 vitest 工具层 RPC 超时，**不是断言失败、不是测试超时
用例**：

```text
Error: [vitest-worker]: Timeout calling "onTaskUpdate"
 ❯ Object.onTimeoutError node_modules/.pnpm/vitest@3.2.7_.../vitest/dist/chunks/rpc.-pEldfrD.js:53:10
```

`Test Files 173 passed`、`Tests 2742 passed`、进程退出码 0；两次重跑同样复现，排除偶发抖动
导致的假失败，但也未能消除该工具层告警。**复核人未把该告警当作 PASS 依据**；它是唯一的
环境噪声，列在 §7 未覆盖 / 风险。全量中与 U2 直接相关的是 `playability-temporal-witness.test.ts`
（68/68）与 `playability-temporal-input.test.ts`（T-55～T-65，65/65），二者单独重跑均干净通过。

### 2.2 架构断言 T-55 / T-57 / T-58 / T-61 / T-62 / T-64

显式定向重跑：

```text
$ npx vitest run packages/contracts/tests/playability-temporal-input.test.ts \
    -t 'T-(55|57|58|61|62|64)' --reporter=verbose
✓ T-55 contracts 源码不含 node:fs / node:crypto
✓ T-57 auditPlayabilityTemporal 生产调用者只有 ops.ts
✓ T-58 生产 analyze 实参只有 stubTemporalAnalyzer
✓ T-61 三处生产接线各至少一次
✓ T-62 常量唯一且不复用 FRAME_MARGIN_MS
✓ T-64 brand Symbol 只在 temporal-input.ts 铸造
Tests  6 passed | 59 skipped (65)
```

另对白名单源码做文本扫描：`temporal-witness.ts` 不含 `node:fs` / `node:crypto` /
`Symbol(` / `TEMPORAL_LAG_*` / `analyze:` / `auditPlayabilityTemporal(` / `FRAME_MARGIN_MS`
（`grep` 退出码 1，无命中）。

---

## 3. R2 逐项判定

| # | R2 项 | 判定 | 依据摘要 |
| --- | --- | --- | --- |
| 1 | Witness 模型 | **PASS** | 状态 `(footX,k)`、脚点整数格、静态走廊、精确 spawn、wait/move、恒速线性、每边一格、状态边界到达、Goal 四边内缩 0.5px 均在源码与测试中一致 |
| 2 | S1–S4 | **FAIL** | S1 / S3 / S4 正确；**S2 的 lagPad 非保守**：跨折返点的 `∃δ` 可达位姿可被漏掉（§4 反例） |
| 3 | 残差等待 | **PASS** | 对整格 Hazard 位姿范围做扫掠（跨折返点切段），不是只查端点；`symbolic` / `conservative-over-cell` 形状正确；静态玩家 + 全 N 格并集覆盖的论证成立 |
| 4 | U9 | **FAIL** | `∀φ0` 接近、整周期停留、`∃ψ` 出口、同一 pad、严格相交、无最小安全窗口的结构均正确；但接近 / 出口转移调用同一个 `verifyTransition`，**继承 S2 的 lag 不保守**，因此 U9 证书也可被假验证。停留段（静态玩家整周期）本身不受该配对问题影响 |
| 5 | 完整性 | **PASS（机制）** | 全部 N 个相位格、策略表 + 逐转移记录、从 spawn 可达闭包、严格递减 rank / 有限 trace、部分路径不提升、预算耗尽 ⇒ IE 均已实现；但「逐转移记录」的真实性受 S2 FAIL 影响，见 §4 |
| 6 | Witness 形状 | **PASS** | `policy + verification`；D9 信封 7 字段齐全；`derived:true`；规范化 JSON 确定性；`volume.bytes` 可由 `TextEncoder` 独立复算；超限无部分 Witness |
| 7 | 双档 | **PASS（附残留风险）** | 每次编码只接收一档 `lagMs` + 一个结果；U9 停留段强制校验 `lagPad` / `hazardSpeed`，跨档拼接 ⇒ `model-out`；`resolveTwoLagResults` 未改、回归通过。**风险**：W 编码不把结果绑定到请求的 hazard / lag（见 §6） |
| 8 | 反例 | **PASS** | D3 §11 十三条逐条存在且通过（测试名 + 源码路径核对）；但十三条不含「lag 窗口跨折返点」这一反例，见 §5 |
| 9 | 范围与模型条件 | **PASS** | 只改 U2 白名单；不发布公共 NB；无公共导出 / 生产接线；`coverage.temporal` 由显式前置输入约束，U9 不自行提升 coverage |
| 10 | 未提前实现 U3/U4/U5 | **PASS** | 无门区证明 / 图割 / hop 加倍 / 性能证据 / A–J 矩阵；无公共导出、无生产接线、无 JSON fixture、无新依赖；失败原因未扩 D9 闭集 |
| 11 | 架构断言 T-55/57/58/61/62/64 | **PASS** | §2.2 六条全部通过 |

**总判定：FAIL**（S1–S4 与 U9 两项 FAIL）。按授权包 §9.2 与票 09 的失败处理，
U2 不得标记完成；R2 PASS 也不能替代用户签署，何况本次为 FAIL。

---

## 4. FAIL 详情：S2 的 lagPad 不是保守覆盖

### 4.1 代码位置

- `packages/contracts/src/playability/temporal-witness.ts:755-771`（`verifyTransition` 的 S2）：
  ```ts
  // lagPad = hazardSpeed × lagMs；方向取该单调段。上升段向右加宽，下降段向左加宽。
  const pad = Math.abs(slope) * lagMs;
  ...
  ? (hazard.box.anchor.x * w) / paddedWidth
  : (hazard.box.anchor.x * w + pad) / paddedWidth;
  ```
- 同型逻辑在 `verifyU9Stay`（`:1580-1592`）与 `verifyResidualWait`（`:919-929`）。

### 4.2 语义冲突

授权包 §3.3 要求 Witness 方向使用
`hazardSpeed × lagMs` 的**保守扫掠带**；D1 / F6 的精确语义是
`∃δ ∈ [0, lagMs]`：在玩家时刻 `t`，Hazard 实际可达位置是
`p(t+δ)` 的集合（I02-03 §8.1 X5 的实测即此语义）。该集合在 `lagMs` 跨过折返点
`m·P/2` 时，会包含折返后返回的**另一侧**位姿；实现只按当前单调段方向单侧加宽，
把这些位姿排除在外，因此不是精确 `∃δ` 的超集，也不是「保守覆盖」。

### 4.3 可复现反例（官方 lag 16.67ms）

参数（全部在模型内，无越界）：

| 参数 | 值 |
| --- | --- |
| Hazard | `at=(0,40)`、`distance=50`、`periodMs=200`、`box w=10,h=12`、`anchor=(0,1)` |
| 玩家 | `size 2×20`、脚点 `(15,40)`、盒 `[14,16]×[20,40]` |
| 网格 | `maxSpeed=0.2 px/ms`、`N_max=40`、`N=40`、`dt=5ms`、`xStep=1` |
| 转移 | `wait (15,39) → (15,0)`，规范时间 `[195,200]` |
| lag | `16.67ms` |

`verifyTransition` 的实际输出：

```text
{"verified":true,"failure":null,"t0":195,"t1":200,"segments":1}
```

但精确 `∃δ` 存在碰撞：

```text
t = 195, δ = 16.6 (≤ 16.67), u = t+δ = 211.6
p(211.6) = 5.8；Hazard 盒 = [5.8, 15.8]
玩家盒 @ t=195 = [14, 16]
overlapsStrict(player@t, hazard@t+δ) = true   // 正宽度重叠 [14, 15.8]
```

原因：cell `[195,200]` 处于下降段，实现向左 pad `8.335px`，padded Hazard 的
anchor 范围是 `[-8.335, 2.5]`、盒右缘最大 `12.5`；玩家 `[14,16]` 不相交，因而判
`verified`。但 `lagMs` 窗口跨过 `t=200` 的谷底后，Hazard 在 `u=211.6` 已回到上升段
`p=5.8`，盒 `[5.8,15.8]` 与玩家正宽度相交。该位姿在 `[195,200]` 的名义扫掠范围
（anchor `[0,2.5]`、盒右缘 ≤ `12.5`）之外，所以单侧 pad 看不见它。

同一反例在 `lagMs=200` 下也存在（例如 `P=200,N=3,k=2,footX=45`，漏检深度达
`12px`）；`lagMs=16.67` 的上述例子已足以证明官方小档也不保守。

### 4.4 影响面

- `searchWinningSet` 的每条 `wait` / `move` 边都经 `verifyTransition`，因此 W 的
  `verified: true` 记录不保证在 `∃δ` 语义下安全；W 可含假验证边。
- U9 的接近段（`W_{→s}`）与出口段（`W_{→goal}`）同样经 `solveWinningCore` →
  `verifyTransition`，因此 U9 证书也可被假验证。U9 的**停留段**是静态玩家 + 整周期，
  名义全周期覆盖已覆盖全部 Hazard 位姿，不受该配对问题影响；残差等待（spawn 静态、
  全 N 格并集）同理。
- 现有 U2 测试的 `[S2] lagPad 按单调段方向加宽` 只覆盖 `lagMs` 窗口不跨折返点的
  情形（`P=200`、`lag=20`、cell 内无折返点），因此 68 条测试全过并不能排除该缺陷。

### 4.5 修复方向（供实施会话参考，不属于本次复核改动）

二选一即可恢复保守性：

1. **对称 pad**：Hazard 盒两侧各扩 `hazardSpeed × lagMs`（I02-03 §8.1 已证这是精确
   `∃δ` 的保守超集）；或
2. **精确滑动窗口**：在 `[t, t+lag]` 上求 Hazard 的 `min/max`（分段线性，含折返点），
   按窗口实际方向逐步处理，而不是按当前段方向单侧外扩。

并补一个「`lagMs` 窗口跨折返点」的 S2 / W / U9 回归测试（上述参数可直接作为用例）。

---

## 5. 逐项独立核查记录（不依赖测试名）

### 5.1 W 最小不动点 / rank / 全相位覆盖

- `solveWinningCore` 从全部 Goal 状态 rank 0 出发做反向 BFS；FIFO 分层保证首次入队 rank
  即到 Goal 的最少边数，即 `μX.(Goal ∪ Pre∃(X))` 的最小不动点，不是最大不动点。
- 策略后继 `successor[prev] = check` 且 `rank[prev] = rank[current] + 1`，沿策略走
  rank 严格递减到 0；`buildU9Exit` / `createChainWalker` 重放时再次检查
  `rank(next) === rank − 1`、`to.k = (from.k+1) mod N`、时间连续。
- `searchWinningSet` 对每个 `k` 要求 `residualWait.verified && rank[(spawn,(k+1)%N)] ≥ 0`；
  N 个格全过才 `complete`。永久屏障用例验证 spawn 列不进最小不动点（测试通过）。
- 结构正确；但被 S2 的假验证边污染（§4）。

### 5.2 残差等待

- `verifyResidualWait` 对每个 `C_k` 取 Hazard 在 `[t0,t1]` 的折返点切段，按段方向 pad，
  用 `overlapsStrict` 与 spawn 盒比较；不是端点采样。
- 静态玩家下，N 个格的名义范围并集覆盖整个 Hazard 周期；任一实际 Hazard 位姿 `p(u)`
  都会被包含 `u` 的格的名义扫掠盒检查到，因此该检查整体是保守的。
- 形状 `symbolic:true` / `residualWait:"conservative-over-cell"` 不冒充「每个具体 φ0
  已验证」。PASS。

### 5.3 U9

- 判据 ① `isValidWaitingCell`：整数脚点、走廊、`standableAt`、同脚点 y；正确。
- 判据 ② `∀k`：N 个残差等待 + 对齐状态 `(spawn,(k+1)%N)` 在 `W_{→s}` 中；正确。
- 判据 ③ 停留 `[T_arr,T_arr+P]`：只在折返点切段，逐段 `intersectContinuous`，
  `overlapsStrict`、无 ε、无最小安全窗口；结构正确，静态玩家下全周期名义覆盖保守。
- 判据 ④ `∃j`：取 rank 最小、同 rank 相位最小者，`buildU9Exit` 重放 rank 严格递减到 Goal；
  正确。
- 同一 pad：接近 / 停留 / 出口都由同一 `lagMs` 与 `hazardSpeed` 派生；U9 编码强制校验
  `stay.lagPad` / `stay.hazardSpeed` / 每段 `lagPad`，不借用另一档。
- **FAIL**：接近 / 出口的移动转移使用同一个 S2，继承 §4 的不保守 lag pad。

### 5.4 Witness 形状 / 体积

- D9 形状逐字段一致：`form / derived / verifications[7] / policy / termination /
  phaseCoverage / volume`。
- `policy` 的每个下标只指向 `verified = 1` 的元组；`witnessTransitionTuple` 拒绝
  `verified:false`、非整数状态、非规范时间。
- `serialized = canonicalJson(六个语义字段，不含 volume)`；`bytes =
  TextEncoder(serialized).length`；测试用独立的 `canonicalJson` 复算并逐字节比较。
- `maxWitnessTransitions` 在 append 时增量检查，`maxWitnessBytes` 在序列化后检查；
  任一超限返回 `{ok:false, reason:"witness-volume"}`，不返回部分 `witness` / `serialized`。
- 确定性：键排序、数组保序、不依赖 `Set` / `Map` 遍历 / 墙钟；两次独立编码逐字节相同。

### 5.5 双档 / `resolveTwoLagResults`

- `temporal.ts` 未改；`resolveTwoLagResults` 与 T-42～T-46 回归通过。
- U9 跨档拼接：`stay.lagPad` / `hazardSpeed` 不一致 ⇒ `model-out`（测试通过）。
- W 编码不读取 `request.hazard` / `request.lagMs` 与结果做绑定；见 §6 风险。

### 5.6 反例 D3 §11 十三条

逐条核对源码与测试：`move` 跨 solid、非整数 spawn、Goal 未内缩、残差端点、wait 区间碰撞、
预算前缀、无 rank 循环、跨 lag、`startCells()`、目标在走廊外、Goal 退化 / 不可表示、
只查端点 S1、把整格覆盖写成具体轨迹——**13/13 存在且通过**。
但 D3 §11 没有「lag 窗口跨折返点」这一条，故不覆盖 §4 的缺陷。

### 5.7 映射忠实性

- `spawn-not-standable`（D3 §3.4）不在 D9 闭集，实现用
  `reason:"spawn-not-on-lattice"` + `gap:"spawn-not-standable"` 表达；`spawn-box-out-of-world`
  与 `spawn-box-overlaps-solid` 同样由 `gap` 细分。未新增 D9 原因码，忠实但 `reason`
  语义偏宽（见 §7）。
- `goal-rect-degenerate` / `goal-not-representable` / `grid-resolution-infeasible` 与 D9
  闭集直接对应。
- `coverage.temporal !== "checked"` 与玩家几何不可信都用 `geometry-untrusted` +
  `failure:"temporal-coverage" | "player-geometry"`；D9 闭集无更贴切码，可接受，但
  「temporal coverage 不足」与「几何不可信」共用一个 reason，语义上略有混叠（见 §7）。

---

## 6. 双档 / 编码的残留风险（非本次 FAIL 根因）

- **W 编码未绑定 hazard / lag**：`encodeWinningSetParts` 只消费 `result`，不读取
  `request.hazard` / `request.lagMs` 来校验结果来源；U9 编码至少校验了停留段的
  `lagPad` / `hazardSpeed`。因此调用方若把一档的 W 结果配到另一档请求，编码仍会成功。
  当前 API 形状（一次一档、不接收数组）阻止了「拼接两个结果」，且 Witness 不含 lag 字段，
  故未判 FAIL；但建议与 U9 一样做来源绑定（例如在结果里带 lag / hazard 指纹，或重放校验）。
- **U9 编码只绑定停留段**：接近 / 出口转移没有对 `request.hazard` / `lagMs` 重新验证；
  与上条同源。
- 这些是健壮性 / 误用防护问题，不改变 §4 的根因判定。

---

## 7. 未覆盖项 / 风险清单

1. **lag 跨折返点**：现有 68 条 U2 测试没有覆盖 `lagMs` 窗口跨 `m·P/2` 的 S2 / W / U9
   转移；§4 的反例是本次复核新增的独立检查，未进入产品测试。
2. **全量 `pnpm test` 的 2 条 unhandled error**：`[vitest-worker]: Timeout calling
   "onTaskUpdate"`，两次运行均复现；工具层 RPC 超时，不是断言失败 / 测试超时，但未消除。
3. **W 跨档 / 跨 hazard 误配**：编码层未绑定来源（§6）。
4. `spawn-not-standable` / `coverage.temporal` 的 D9 原因码映射偏宽（§5.7），
   在闭集约束下可接受，但应在 U5 / I-03 诊断中保留结构化 `gap` / `failure`。
5. 复核人未运行真实 19 关语料 / `last-train/v2` 的 U2 正样本（U2 测试注释已说明其在模型下
   为 IE）；未覆盖真实关卡参数下的性能 / 预算分布。
6. 复核人未读取作者实现报告 / 地图 / 其它 U2 票（按硬约束）。

---

## 8. 用户签署栏（由 U2-SIGN 填写，复核人留空）

```text
用户结论：        [ ] 接受 R2 复核结论（FAIL，U2 退回实施）
                  [ ] 不接受 / 要求补充复核
签署人：          ______________________
日期：            ______________________
备注：            ____________________________________________________________
```

---

## 9. 复核声明

- 复核人未参与 U2 编写；本报告全部结论来自本次独立阅读源码、检查 diff 与重跑命令。
- 复核人**未读取** `.scratch/level-playability-v1.1-u2/reports/07-implementation.md`、
  `.scratch/level-playability-v1.1-u2/map.md`，也未读取 `.scratch/level-playability-v1.1-u2/issues/`
  下除 `09-u2-r2-review.md` 外的任何票；未把作者总结 / PASS 结论 / 调试笔记作为依据。
- 复核人未修改 `packages/**`、`fixtures/**`、产品代码、测试或配置；未推送、未创建 PR、
  未合并、未开始 U3。
- 本报告路径：`.scratch/level-playability-v1.1-i02/reports/R2-review.md`。
