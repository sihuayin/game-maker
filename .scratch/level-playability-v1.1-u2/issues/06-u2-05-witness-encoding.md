# U2-05 Witness 编码、体积与确定性

Type: task
Status: resolved
Owner: claude (U2-05 session 2026-11-12)
Blocked by: 04, 05
Map: ../map.md
Class: U2 / IMPLEMENTATION

## Task

把 W / U9 的验证记录编码为 D9 `Witness`，并执行体积与确定性约束。

### 必须实现

- D9 §6.2 形状：`form: "u9" | "winning-set"`；`derived: true`；`verifications: WitnessTransition[]`；`policy` 下标；`termination`；`phaseCoverage`；`volume`。
- 每转移 `[fromFoot, fromK, toFoot, toK, t0, t1, verified]`；`policy` 只引用 `verified = 1`。
- 体积：**最终确定性序列化 UTF-8 字节数**；`maxWitnessTransitions = 1M`、`maxWitnessBytes = 64 MiB`；任一超限 ⇒ IE `witness-volume`，**不得截断**。
- 确定性序列化：键序固定、数字格式固定、无 `undefined`；同策略重复序列化逐字节一致。
- 派生盒与解析盒一致：由 `(footX, k, t)` + 冻结公式派生，标 `derived: true`。
- 两档 lag 各自独立编码；禁止跨档共享 / 拼接。
- 输出 `Witness` + 状态；**不组装 `TemporalInternalResult`**（入口与完整结果归 U5）。

### 禁止

- 修改 `temporal-result.ts` / `temporal.ts`；公共导出；A–J；门区 / 图割；测试文件（U2-06 负责）。

### 验收

`pnpm build` / `pnpm typecheck` 通过；字节数可复算；超限 IE；无 `TemporalInternalResult` 入口；diff 只含 `temporal-witness.ts`。

## Answer

**2026-11-12 完成。** 产品路径只改 `packages/contracts/src/playability/temporal-witness.ts`（`+662 / −2`；删除行只来自模块头注释的 U2-05 状态更新）。未修改 `temporal-result.ts`（D9 形状冻结）、`temporal.ts`、`temporal-budget.ts`、`temporal-motion.ts`、公共 barrel、测试 / fixture；未新增依赖、JSON fixture、`DegradationReason` / `BudgetKind` / `BudgetProfile` 字段，也未组装 `TemporalInternalResult`。

### 实现摘要

- 在 `temporal-witness.ts` 末尾追加 U2-05 段：`encodeWitness` 把 U2-03 的 `WinningSetResult` / U2-04 的 `U9Result` 中**已通过 S1–S4** 的转移压成 D9 `Witness`，并执行体积与确定性约束。
- W 从 N 个 spawn 对齐相位各沿 rank 严格递减的后继走到 Goal，按「相位格升序 → 链内顺序」去重成 `verifications`；U9 把接近段 `∀k`、停留段整周期、出口段 `∃j` 全部编码进同一张策略表。
- 序列化 / 体积 / 去重都不依赖 `Set` / `Map` 遍历顺序、对象键枚举顺序或墙钟；`Map` 只做确定性去重查表，输出顺序由 push 顺序决定。

### 新增 / 变更的导出 API（全部 `@internal`，无 barrel 导出）

```ts
type WinningSetWitnessEncodingRequest = {
  form: "winning-set";
  space: WitnessSpace;
  hazard: WitnessHazard;
  lagMs: number;                 // 一次只一档
  budget: BudgetProfile;         // 只读；只用 maxWitnessTransitions / maxWitnessBytes
  result: WinningSetResult;
};

type U9WitnessEncodingRequest = {
  form: "u9";
  space: WitnessSpace;
  hazard: WitnessHazard;
  lagMs: number;                 // 一次只一档
  budget: BudgetProfile;
  result: U9Result;
};

type WitnessEncodingRequest = WinningSetWitnessEncodingRequest | U9WitnessEncodingRequest;

type WitnessEncodingSuccess = {
  ok: true;
  witness: Witness;
  serialized: string;            // Witness 去掉 volume 的规范化 JSON
  bytes: number;                 // UTF-8(serialized).length
};

type WitnessEncodingFailure = {
  ok: false;
  reason: DegradationReason;     // 只用 D9 闭集；不带部分 Witness
};

type WitnessEncodingResult = WitnessEncodingSuccess | WitnessEncodingFailure;

function encodeWitness(request: WitnessEncodingRequest): WitnessEncodingResult;
```

内部实现（不导出）：`canonicalJson`、`coversAllPhases`、`witnessBudgetValid`、`witnessTransitionTuple`、`createWitnessDraft` / `addWitnessTransition`、`buildPolicyLookup`、`createChainWalker`、`encodeWinningSetParts` / `encodeU9Parts`。

### W → D9 `Witness` 字段映射

- `form: "winning-set"`、`derived: true`。
- **`verifications`**：对每个 `k ∈ [0,N)`，从 `phases[k].aligned = (spawn.footX, (k+1) mod N)` 沿策略后继走到 rank 0 的 Goal 状态；要求 `residualWait.verified`、`alignedWinning`、每条转移 `verified` 且后继 rank 严格 −1。所有路径用到的转移按首次遇到顺序去重，元组为 `[fromFoot, fromK, toFoot, toK, t0, t1, 1]`，时间为 `witnessPhaseCellBounds(grid, fromK, 0)` 的规范相位格（整周期偏移由重放器补）。
- **`policy`**：去重记录的下标（`0..m−1`）。重放按 `(fromFoot, fromK)` 选后继；编码器已验证该键在 W 表中唯一（无记忆策略）。
- **`termination`**：`{ kind: "rank", rank }`，`rank[i]` 是 `verifications[i]` 源状态的 rank；沿任一链严格 −1，rank 1 的后继是 Goal（rank 0）。
- **`phaseCoverage`**：`cells = N`、`covered = N`、`complete = true`；`coveredPhases` 必须恰好是 `0..N−1`（升序、无缺、无重复），否则 `no-witness-found`。
- **`volume`**：见下。

### U9 → D9 `Witness` 字段映射（approach / stay / exit）

`form: "u9"`、`derived: true`；`policy` 顺序固定为 **接近段 → 停留段 → 出口段**。

- **接近段（`∀k`）**：N 个对齐 spawn 状态各自的 `W_{→s}` 链，全部进入 `verifications`；每条转移 `verified`、后继 rank 严格 −1、终点必须是等待格 `s`（rank 0）。`phaseCoverage` 取 `approach.phaseCoverage`（`cells = N`、`covered = N`、`complete = true`，`coveredPhases` 必须是 `0..N−1`）。
  - **残差等待**是整格保守覆盖，不是逐 `φ0` 采样，D9 元组无法表达半格等待；它由 `phaseCoverage.complete`（N 个半开相位格全覆盖）+ 对齐状态承载。编码器要求每格 `residualWait.verified && failure === null`，不把未验证格写进证书。这不是 D9 形状缺口：D9 已冻结的 `phaseCoverage` 就是全相位覆盖字段。
- **停留段（整周期）**：U2-04 的 `[T_arr, T_arr+P]` 记录跨多格，编码器把它分解为 **N 个单格 `wait`**：`k = 0..N−1`，`[s, k, s, (k+1) mod N, cell_k.t0, cell_k.t1, 1]`。Hazard 严格以 `P` 周期重复、玩家在 `s` 静止，因此 `[T_arr,T_arr+P]` 的解析检查与规范相位格 `[0,P)` 逐相位同值；这不是按 `dt` 采样，也不是伪造。编码器先验证 `stay.segments` 从 `tArrival` 到 `tEnd` 逐段首尾相接、无正宽度碰撞、每段 `lagPad === |slope| × lagMs`，并要求 `stay.hazardSpeed` / `stay.lagPad` 与传入 `hazard` / `lagMs` 一致。
- **出口段（`∃j`）**：只编码 U2-04 选中的相位 `j` 与 `(s,j)` 沿 rank 严格递减到 Goal 的链；**不**要求所有相位都能出去，**不**把 `∃` 改成 `∀`。链终点必须是 `goalStates` 中的状态、rank 0 且无后继。
- **跨段 `(fromFoot, fromK)`**：例如 `(s,j)` 既是停留 wait 的起点，也是出口链的起点，允许出现不同后继；这是 U9 复合证书的语义。段内按 `(fromFoot, fromK)` 可重放，段间按上述固定段序解释。
- **`termination`**：`{ kind: "trace", finite: true, length }`。`length = max_k(approachRank(k) + waits(arrivalPhase(k) → exit.phase) + exit.rank)`，即任一 spawn 相位到 Goal 的最长有限排程上界。接近 / 出口的严格递减 rank 在编码时逐链校验；整周期停留是长度 N 的有界循环，不存在跨段全局严格递减 rank，因此用 D9 的有限 trace 形式而不是伪造一个全局 rank。
- **`volume`**：见下。

### 体积口径（可独立复算）

- `volume.transitions = verifications.length`。
- 序列化对象 = **D9 `Witness` 去掉 `volume`** 的六个语义字段（`form / derived / verifications / policy / termination / phaseCoverage`）。这样 `bytes` 不进入自己的计量，避免自指；`volume.transitions` 由数组长度表达。
- `serialized = canonicalJson(上述对象)`：对象键字典序、数组保留语义顺序、数字用 `JSON.stringify` 的确定性格式、跳过 `undefined`。
- `volume.bytes = new TextEncoder().encode(serialized).length`，返回的 `bytes` 与 `witness.volume.bytes` 相同。独立复算方式：`new TextEncoder().encode(encoded.serialized).length`；或把 `witness` 的 `volume` 去掉后按同一规范化规则重新序列化。
- 任一超过 `maxWitnessTransitions`（转移上限在构建过程中增量检查）或 `maxWitnessBytes`（序列化后检查）⇒ `{ ok: false, reason: "witness-volume" }`，**不截断、不返回部分 Witness**。

### 确定性与双档

- 同一输入重复调用 `encodeWitness`：`serialized` 逐字节相同，`bytes` / `witness` 结构相同。
- 不依赖 `Set` / `Map` 遍历顺序 / 对象键枚举顺序 / 墙钟；不输出 `undefined`。
- 入口一次只接受一档 `lagMs` 与一个结果；不接收跨档数组、不做跨档合并 / 拼接。U9 额外校验停留段 pad / hazardSpeed，跨档复用结果 ⇒ `model-out`。W 的转移表不携带 `lagMs` / `lagPad` / `hazardSpeed`（D9 `Witness` 无这些字段，未硬塞）；双档隔离由「一次一档」的入口形状与 U2-06 的逐档独立调用测试保证。

### 失败原因

只用 D9 闭集：`witness-volume`（体积超限）、`no-witness-found`（结果非 complete / 策略链断裂 / 残差等待或停留段未验证 / `coveredPhases` 不完整）、`invalid-budget`（两个 Witness 上限非有限非负整数）、`model-out`（Hazard / lag 非有限，或 U9 停留段的 pad / hazardSpeed / period 与输入不一致）。结果本身是 `failed` / `insufficient` 时，直接沿用其 `degradationReason`（缺省 `no-witness-found`）。失败侧不携带 `witness` / `serialized` / `bytes`。

### 验证结果

- `pnpm build`：exit 0；`pnpm typecheck`：exit 0。
- `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts`：**65/65 passed**（T-55 / 57 / 58 / 61 / 62 / 64 原样通过）。另跑 temporal 三件套 **123/123**（input 65、budget 23、motion 35）。
- 新代码无 `analyze:` / `Symbol(` / `TEMPORAL_LAG_` / `node:fs` / `node:crypto` / `Buffer`，不 import `temporal.ts`；无公共 barrel 导出。
- 一次性本地探针（`/tmp`，不入库；对 `dist` 运行）全部通过：
  - **真实夹具端到端**（last-train，移除 solid、Hazard y=100、`periodMs=3999`、`N=359`、走廊 `16..1424`、`maxStep≈1.0025`）：W `complete`，`winningStates=505831`，编码 `verifications=479983`、`bytes=32507217`、`rank` 最大 1337；U9 `complete`，`s=16`，接近段 `8616` 条唯一转移、停留段 `359` 条、出口段 `1361` 条，总 `10336` 条 / `615691` bytes，出口相位 `0`、exit rank `1361`、`trace.length=1743`。
  - **形状 / 策略**：两种 form 的每个 `policy` 下标都指向 `verified=1`；`volume.transitions === verifications.length`；`bytes` 可由返回的 `serialized` 复算；序列化键序固定、无 `undefined`、不含 `volume`。
  - **W 重放**：N 个 spawn 相位都沿 `(fromFoot,fromK)` 唯一后继抵达 `goalStates`；rank 沿链严格 −1。
  - **U9 段映射**：`approach.policy` 的每条转移、N 个停留单格 wait、选中的出口链都在 `verifications` 中；停留覆盖 N 个不同相位格；`trace.length` 与公式复算一致。
  - **确定性**：W / U9 重复编码逐字节相同。
  - **双档**：lag 40 / 50 各自独立搜索与编码成功，数组不共享；lag 40 结果用 lag 50 编码、lag 50 结果用 lag 40 编码均 ⇒ `model-out`。
  - **派生盒 == 解析盒**：`witnessPlayerBox` 与 `boxFromFoot(foot)` 一致；`hazardBoxAt` 与 `trianglePosition` + manifest `size/anchor` 手算一致；移动中玩家盒与 `boxFromFoot(插值脚点)` 一致。
  - **体积超限**：1,000,001 条转移 + `maxWitnessTransitions = 1,000,000` ⇒ `witness-volume`，无部分 Witness；约 1,000,000 条转移 + 长数字时间使序列化 > 64 MiB ⇒ `witness-volume`，无部分 Witness；真实 W 用 `maxWitnessTransitions = 1000` 也干净失败。

### D9 形状缺口 / 与票面的说明

- **未发现需要 STOP 的 D9 形状缺口**：未改 `temporal-result.ts`、未扩 D9 闭集、未扩 `BudgetProfile`。
- 两处需要显式说明的表示选择：
  1. 残差等待不是 D9 元组（半格、逐 `φ0` 保守覆盖），由 `phaseCoverage`（N 个半开格全覆盖）+ 对齐状态承载；这是 D9 已冻结的相位覆盖字段的用途，不是把验证省略。
  2. U9 整周期停留被分解为 N 个规范相位格单格 `wait`；周期重复 + 玩家静止保证与 `[T_arr,T_arr+P]` 的解析检查逐相位同值，未截断 / 伪造验证。
- U9 使用 `termination.kind = "trace"` 而非全局 `rank`：停留段是长度 N 的有界循环，全局严格递减 rank 不存在；接近 / 出口的 rank 严格递减在编码时逐链校验。

### 下游（U2-06）

- 定向测试直接调用 `encodeWitness`，输入用 U2-03 / U2-04 的真实搜索结果；不要构造「`status: complete` 但记录未验证」的假结果来绕过编码器的结构性拒绝。
- 建议覆盖：两种 form 的 `policy` 只引用 `verified=1`；W 重放按 `(fromFoot,fromK)` 抵达 Goal；U9 approach `∀k` / stay N 格 / exit `∃j`；重复编码逐字节一致；`bytes` 复算；`maxWitnessTransitions` 与 `maxWitnessBytes` 两条超限路径均 `witness-volume` 且无部分 Witness；lag 40 / 50 独立调用 + 跨档复用 ⇒ `model-out`；派生盒 == 解析盒。
- U2-06 不需要修改任何产品代码；本票不新增测试文件、fixture、公共导出。
