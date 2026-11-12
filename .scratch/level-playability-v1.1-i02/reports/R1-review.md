# R1 独立复核报告 — U1 连续时间求交（I-02）

- 复核对象：U1（产品代码 head `75368a6`；diff 范围 `ed02339..75368a6`）
- 授权包：`docs/v7.8/移动-I02.md`
- 复核人：**independent reviewer subagent, fresh context**（未参与 U1 编写）
- 日期：**2026-11-12**
- 结论：**PASS**（R1 通过；不替代 U1-SIGN 用户签署）

> 本报告的每一项结论均来自复核人自己检查 diff、逐行阅读 7 个白名单文件、重跑命令与独立探针；
> 未读取 `.scratch/level-playability-v1.1-u1/reports/05-implementation.md`、`map.md` 及其它 U1 票的 Answer。

---

## 0. 输入与范围校验

| 项 | 命令 | 结果 | 判定 |
| --- | --- | --- | --- |
| 授权包 SHA-256 | `shasum -a 256 docs/v7.8/移动-I02.md` | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` | **PASS**（与规定值逐字符相同） |
| base SHA | `git rev-parse ed02339` | `ed02339a57ca1c1d9d2df5c553ca92a863492e92` | PASS |
| 产品 head | `git rev-parse 75368a6` | `75368a6ec41b6062c9d9e98b2f1e6ce8d2798ade` | PASS |
| 产品 diff 未漂移 | `git diff --name-status 75368a6..HEAD -- packages fixtures package.json pnpm-lock.yaml pnpm-workspace.yaml` | 空 | **PASS**（复核开始时 HEAD=`61511bd`，claim 后 HEAD=`8f88628`，两次均为空） |

---

## 1. Diff scope

`git diff --name-status ed02339..75368a6`（17 个文件，2571 行新增、0 行删除）：

产品路径 **7 个，与授权包 §5.2 U1 白名单完全一致**：

| 状态 | 文件 |
| --- | --- |
| M | `packages/contracts/src/playability/temporal.ts`（纯增） |
| A | `packages/contracts/src/playability/temporal-result.ts` |
| A | `packages/contracts/src/playability/temporal-budget.ts` |
| A | `packages/contracts/src/playability/temporal-motion.ts` |
| A | `packages/contracts/tests/playability-temporal-motion.test.ts` |
| A | `packages/contracts/tests/playability-temporal-budget.test.ts` |
| A | `packages/contracts/tests/playability-temporal-fixtures.ts` |

其余 10 个文件全部位于 `.scratch/level-playability-v1.1-u1/**`（票 / 地图 / 基线证据）。

白名单外检查：

| 检查 | 结果 |
| --- | --- |
| `package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` | 无改动 ⇒ **无新依赖** |
| `packages/contracts/tests/fixtures/**`（JSON fixture） | 无新增 / 无修改 |
| `packages/demo/**` | 无改动 |
| `ops.ts` / `graph.ts` / `profile.ts` / `playability/index.ts` / `contracts/src/index.ts` | 无改动 |
| `temporal-witness.ts` / `temporal-gate.ts` / `temporal-evasion.ts` | 不存在（未提前创建） |
| `temporal.ts` 删除行 | `git diff ... | grep '^-'` 仅匹配到 `---` 头，**0 行删除 ⇒ 纯增** |

---

## 2. 命令、退出码与原始输出摘要

| # | 命令 | 退出码 | 原始输出摘要 | 日志 SHA-256（本次会话 `/tmp` 快照） |
| --- | --- | --- | --- | --- |
| 1 | `pnpm build` | **0** | `tsc -b` + demo/cli/mcp bundle 全部 Done | `723c3502df3a37eb78a230c3a28f844539b88ebaa58dac4dc989e9c721d6b68b` |
| 2 | `pnpm typecheck` | **0** | 10 个 workspace 项目全部 `Done` | `34079e0854a892735b87bd72afc41ff8a54312214e9f7f28e52e8b09ba52f1ec` |
| 3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-motion.test.ts packages/contracts/tests/playability-temporal-budget.test.ts` | **0** | `Test Files 2 passed (2)`；`Tests 58 passed (58)`（motion 35 + budget 23） | `70843a9c00ec3899c5b490c5cf494ef051c4a7640beb8fae29be72af6d43bb83` |
| 3b | 同上 `--reporter=verbose`（二次运行） | **0** | 58 个 `✓`，结果与 #3 一致 | 逐项名称见 §4 引用 |
| 4 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | **0** | `Test Files 1 passed (1)`；`Tests 65 passed (65)`，T-55～T-65 全 `✓` | `1bc51a11f552b4d3f2a50192fe16f3c886cb78488fa9f10ffa90ec0ba4dec953` |
| 5 | `pnpm test` | **0** | `Test Files 172 passed (172)`；`Tests 2674 passed (2674)`；`Errors 2 errors` | `f54afea91f79c991c3d1a1fabf621883557798bba0cfd4f6fc60c00a3c41d259` |
| 6 | 独立探针 `node /tmp/r1-probe/probe.mjs`（导入 `packages/contracts/dist`） | **0** | 见 §4.3；全部输出与冻结语义一致 | 探针源码与输出见下 |

关于 #5 的 `Errors 2 errors`：两条均为 `[vitest-worker]: Timeout calling "onTaskUpdate"`（worker RPC 超时），
**不是测试失败**；本轮 exit code 仍为 0。作者原始 `evidence/05-test.log` 中同样存在这两条（`Errors 2 errors`，
`Test Files 172 passed`，`Tests 2674 passed`），可判定为环境 / worker 抖动，而非 U1 行为回归。

独立探针关键输出（摘要）：

```text
c1=0 tangent      -> intervals []                         (相切不算撞)
c1=0 full         -> [{start:0,end:500}]                  (整段撞)
c1=0 miss         -> []
near 1e-15        -> [{start:0,end:500}]                  (近速不归零)
turn tangent      -> [{350,500},{500,650}]                (零测度安全点保留)
turn overlap      -> [{375,625}]                          (切点真实重叠才合并)
tiny turn span    -> cutPoints=1, segments=2              (D-P0-4)
neg               -> [{-300,-150}]
multi 0..3000     -> cuts=5, segments=6, 6 intervals
dt0 hit/miss      -> [{200,200}] / []
y 1e-12           -> [{0,0}]                              (ε 不进 y 谓词)
x tangent         -> []
tiny window       -> width 2.000000165480742e-10 ms
lag t0/turn/fall  -> [50,60] / [140,150] / [90,100]       (方向性 pad)
charge at cap     -> stopped=false；over cap -> cut-budget
wallclock at 10   -> aborted / wall-clock-abort
sig wallClock/detail excluded -> true；cutPoints/grid/reason/budget covered -> true
```

---

## 3. R1 清单（授权包 §9.1）逐项判定

| 项 | 判定 | 复核依据（E1 file:line / E2 测试 / E3 重跑） |
| --- | --- | --- |
| 运动模型 | **PASS** | E1：`temporal-motion.ts:118-141`（`p(t)=at+d·k(u)`、`t=0→at`、`P/2→at+d`、`P→at`、负时间 / 多周期用 `((t%P)+P)%P`；`triangleSpeed` 在 `phase===0` / `P/2` 返回 `null`）。E2：motion 测试 `[I02-01][AC-01]` 6 条（含两端不停留、负时间对称、多周期、折返点速度 `null`）。E3：探针 `pos t0/P2/P = [0,100,0]`、`pos -137 == 137`、`speed at turn = [null,null,null]`。 |
| AABB 语义 | **PASS** | E1：直接复用 `geometry.ts:14-15` 的 `overlapsStrict`（四处严格 `<`），`temporal-motion.ts:174-187` 由 manifest `size`+`anchor` 派生、忽略 `entity.body`、不取整。E2：`[I02-01][AC-02] overlapsStrict…`（相切 / 角接触 / 零面积 false，`1e-12` 正面积 true）、`[I02-01][ε] ε 不进入碰撞谓词`（x/y 各 5e-10 重叠算撞）。E3：探针 `y 1e-12` 撞、`x tangent` 不撞。与 I02-06 strict 结论一致。 |
| 连续求交 | **PASS** | E1：`temporal-motion.ts:260-371`；只在 `t0<k·P/2<t1` 切段（`:292-306`），每段解两个严格线性不等式（`:322-348`），开区间 `hi-lo>intervalTolerance`（默认 0，`:343`），切点真实重叠才合并（`:351-368`）。E2：折返点切段 / 相切零测度点 / 真实重叠合并 / 同速 / 近速 / `dt=0` / 非有限 / 非法输入 / `maxCuts` 共 15 条。E3：探针多周期 `cuts=5,segments=6`、`pieceSlope` 跨折返点 `null`。产品代码无任何固定帧采样（grep `sample/frame/16.67` 为空）。 |
| ε | **PASS** | E1：`temporal-motion.ts:194-195`，唯一具名计算 `max(1e-9, 1e-9×(xMax−xMin))`；碰撞谓词与区间端点均不使用 ε；`intervalTolerance` 是独立显式参数，默认 0。E2：`[I02-01][ε] epsilon…`、`默认 0 保留任意小窗口`、`显式阈值两侧`、`极短安全窗口`。E3：探针 `tiny window width = 2.0e-10 ms` 被保留。 |
| 数值稳定性 | **PASS** | E1：`solveOpen` 以 `c1 === 0` 精确分支（`temporal-motion.ts:224`），无速度差绝对容差；`hi-lo > intervalTolerance`，默认 0，不用 `1e-9` 吞窗口。E2：`c1 === 0 精确分支`、`近速不被绝对容差归零（D-P0-2，1e-12）`、`极短安全窗口（1.005e-6 ms）`。E3：探针近速 `1e-15` 仍得到整段碰撞。 |
| 反例 | **PASS** | E2/E3：I02-03 §8 六处 P0 差异逐条映射见 §5；采样陷阱（`不采样：短于 60Hz 帧间隔的窗口`）、折返点相切、负时间窗口、同速、非有限输入均有测试并通过。 |
| 范围与确定性 | **PASS** | diff 仅含 7 个白名单文件（§1）；无新依赖；`temporal.ts` 纯增且未实现 `analyzeTemporalInternal`；无公共导出 / 生产接线。确定性：`determinismSignature` 覆盖 grid/work/internalResult/certificate/diagnostics/budget 状态，排除 `wallClockMs`/`detail`/testHooks；测试 `[I02-01][budget][AC-10]` 同时比较签名与剔除 `wallClockMs`/`detail` 的规范化完整序列化。E3：探针对 6 类变体逐一确认覆盖 / 排除。 |

**R1 结论：PASS（7/7）。**

---

## 4. 重点核查逐条

### 4.1 `c1 === 0` 精确分支、近速不归零

- `solveOpen(c0, c1, dt)`：`c1 === 0` 时仅按 `c0 > 0` 返回 `[0,dt]` 或 `null`（`temporal-motion.ts:223-233`）。
- 近速 `playerSpeedX = 0.2 + 1e-12` / 独立探针 `+1e-15` 均走一般分支并得到整段碰撞。
- 测试：`[I02-01][AC-01] c1 === 0 精确分支…`、`近速不被绝对容差归零（D-P0-2）`；独立探针复现。

### 4.2 `dt = 0`、非有限值、极短安全窗口

- `t0 === t1`：直接调用同一 `poseCollides`（`overlapsStrict`，不再缩 EPS），撞则返回 `[t0,t0]`，与区间表达一致（`temporal-motion.ts:283-290`）。
- 任一数值非有限：`non-finite`；周期 ≤0、`t1<t0`、负 `intervalTolerance`、非法 `maxCuts`：`invalid-input`（`:265-281`），不静默修复。
- 极短安全窗口（约 `1.005e-6 ms`）由测试与探针双重确认保留（`gap > 0`）。

### 4.3 折返点切段 / 相切 / 合并

- 边界集合 `{t0, t1} ∪ {k·P/2}`，仅严格内部折返点入切点（`:292-306`）。
- 切点相切（姿态不严格重叠）：保留两个区间、共享端点，零测度安全点不丢（`:358-364`）。
- 切点真实重叠：`poseCollides` 为真才合并（`:356-362`）。
- 独立探针：`turn tangent -> [{350,500},{500,650}]`；`turn overlap -> [{375,625}]`；`tiny turn span -> cuts=1,segments=2`。

### 4.4 I02-03 §8 六处 P0 差异 / 采样替代 / 折返点相切

| 编号 | P0 错误 | U1 实现 | 证据 |
| --- | --- | --- | --- |
| D-P0-1 | y 重叠用 `±EPS` | y 严格 `<`，无 ε（`temporal-motion.ts:309-311`） | 测试 `ε 不进入碰撞谓词`；探针 `y 1e-12` 撞 |
| D-P0-2 | `|c1|<1e-9` 钳位 | 只认 `c1 === 0` | 测试 D-P0-2；探针 `1e-15` |
| D-P0-3 | `lo < hi − EPS` | `hi−lo > intervalTolerance`，默认 0 | 测试极短窗口；探针 `2e-10 ms` |
| D-P0-4 | 折返点距端点 `1e-9` 内跳过 | 严格 `turn > t0 && turn < t1`，无 eps | 测试 `D-P0-4：极短跨折返点段仍切成两段` |
| D-P0-5 | `dt ≤ EPS` 走另一套缩 EPS 谓词 | `dt=0` 与区间共用 `poseCollides` | 测试 `dt = 0 …与区间表达一致` |
| D-P0-6 | 对称 lag pad | 按右极限方向单侧外扩（`:203-220`） | 测试 lagPad 方向 / 折返点；探针三例 |
| 采样替代 | 固定帧采样 | 解析切段 + 闭式解；产品无采样 | 测试 `不采样：短于 60Hz 帧间隔…` |
| 折返点相切 | — | 零测度安全点保留 | 测试 `折返点相切`；探针 |

### 4.5 `temporal.ts` 纯增 / 未实现 `analyzeTemporalInternal`

- `git diff ed02339..75368a6 -- temporal.ts` 无删除行；新增内容仅为内部入口类型 `TemporalInternalInput` / `TemporalInternalAnalyzer`、`stableStringify` / `fnv1a32` / `determinismSignature`（`:118-192`）。
- `grep -rn analyzeTemporalInternal packages` 仅命中注释中的“不在 U1 实现”。
- 未接生产：`api.ts:132-136` 只按名字转出 I-01 公共符号；`playability/index.ts` 不导出 `temporal.js`；`contracts/src/index.ts:150` 只导出 `api.js`。新内部符号无公共面。

### 4.6 `determinismSignature` 覆盖 / 排除 + 完整序列化

- 覆盖：`internalResult`、`certificate`、`stats.grid`、`stats.work`、`stats.budget.{budgetStatus,budgetKind}`、`diagnostics.{degradationReason,secondaryReasons}`（`temporal.ts:177-192`）。
- 排除：`stats.timing.wallClockMs`（整个 `timing` 不进入签名）、`diagnostics.detail`、时间戳、`testHooks`；`budgetProfile` 也不进入签名。
- 测试同时比较签名与 `canonicalJson(deterministicView(...))`（剔除 `wallClockMs`/`detail` 后的完整结果），并有“键序不影响”“budgetProfile 不进签名但完整序列化可区分”等断言。
- E3：探针逐项确认 `wallClock`/`detail` 排除、`cutPointsTotal`/`phaseSteps`/原因码/预算状态覆盖。

### 4.7 `temporal-result.ts` 纯类型 / 依赖方向

- 全文均为 `export type`；唯一 import 是 `import type { Aabb } from "./geometry.js"`（`:24`）。
- 无反向导入 budget/motion/witness/gate/evasion，无循环；`geometry.ts` 无任何 import。
- 依赖方向符合 §5.1 DAG：result ← budget ← motion ← temporal。

---

## 5. T-57 / T-58 / T-61 / T-62 / T-64

命令：`pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose`，退出码 **0**，`65 passed`。

| 测试 | 结果 |
| --- | --- |
| T-57 `auditPlayabilityTemporal` 生产调用者只有 `ops.ts` | ✓ PASS |
| T-58 生产 `analyze` 实参只有 `stubTemporalAnalyzer` | ✓ PASS |
| T-61 三处生产接线各至少一次 | ✓ PASS |
| T-62 常量唯一且不复用 `FRAME_MARGIN_MS` | ✓ PASS |
| T-64 brand Symbol 只在 `temporal-input.ts` 铸造 | ✓ PASS |

---

## 6. U1 预算边界 / 范围核查

| 检查 | 结果 |
| --- | --- |
| 单次 check 的 `maxCutsPerCheck`（cutPoints）生效 | `intersectContinuous` 默认 `BUDGET_DEFAULTS.maxCutsPerCheck`；`chargeCheck` 在 `cutPoints > maxCutsPerCheck` 时 `exhausted/cut-budget`，恰好等于上限不触发（`temporal-budget.ts:284-298`） |
| work counter + 检查点 | `chargeWork` 累计到 `timeBudgetCheckpointWork` 才读注入时钟（`:267-282`） |
| 墙钟 abort | 只产生 `aborted/wall-clock-abort`，不产出更强结论；`wallClockMs` 不进签名 |
| `maxCutsPerBranch` 不得被执行 | 仅常量 / 解析 / 快照字段；`grep` 无任何执行累计逻辑（U2 才按 `segmentsTotal` 执行） |
| 无 Witness 体积实现 | `witnessTransitions` / `witnessBytes` 仅在契约类型中，无计量代码 |
| 无相位网格搜索 | 无 BFS / 状态枚举；仅 `deriveMaxBranching` 供预算派生 |
| 无公共导出 | 见 §4.5 |
| 无生产接线 | `analyzeTemporalInternal` 仅注释；T-58 仍为 stub |
| 无 JSON fixture / 新依赖 | 见 §1 |

---

## 7. 未覆盖项与观察（不构成 R1 FAIL）

1. **`analyzeTemporalInternal` 按 U1 范围未实现**：因此端到端内部结果的确定性只通过 D9 夹具 + `determinismSignature` 验证，真实分析器确定性留待 U2/U5。
2. **A–J 矩阵**（`playability-temporal.test.ts`）尚不存在（U2+ 交付），本轮不在 R1 范围。
3. **墙钟边界约定**：`finish` / 检查点使用 `elapsed >= timeBudgetMs` 判定 abort；工作 / cut 预算使用“超过才触发”。授权包未固定墙钟的 `>` / `>=` 边界，且墙钟仅 abort-only，故不作为 FAIL；建议在 U5 硬化时明确写死。
4. **`maxEdges: 0` 覆盖被接受**：`resolveBudgetProfile` 对 `maxEdges` 检查非负安全整数并受派生上界约束，但允许测试覆盖为 0（U1 不使用 `maxEdges`，不影响本单元）。
5. **I02-03 random differential（§8.3）未重跑**：该实验不属于 §8.8 R1 命令集；本轮以定向测试 + 独立解析探针覆盖近临界差异。
6. **y 近临界枚举**：测试显式覆盖 5e-10 与相切；独立探针补了 1e-12；未逐一枚举 1e-9 / 1e-6，但判据本身无阈值，语义已由 strict 谓词保证。
7. `pnpm test` 的 2 条 vitest-worker `onTaskUpdate` 超时为环境抖动（原始证据同样存在），无测试失败、exit code 0。

---

## 8. 复核方法声明

- 复核人未参与 U1 编写，且**未读取**以下作者结论路径：
  - `.scratch/level-playability-v1.1-u1/reports/05-implementation.md`
  - `.scratch/level-playability-v1.1-u1/map.md`
  - `.scratch/level-playability-v1.1-u1/issues/` 下除 `07-u1-r1-review.md` 以外的任何票
- 仅读取：授权包、R1 清单、`issues/07-u1-r1-review.md`、产品 diff、7 个白名单文件、I02-03 证据（§5/§8）、原始命令日志（仅用于对照），并自行重跑全部命令与独立探针。
- 复核过程中未修改 `packages/**`、`fixtures/**`、产品代码、测试或配置；未推送、未创建 PR、未开始 U2。

---

## 9. 用户签署栏（已由 U1-SIGN 填写）

| 签署人 | 范围 | 结论 | 日期 | 备注 |
| --- | --- | --- | --- | --- |
| amber | U1 / I-02 R1 | 签署 U1 完成（R1 PASS 7/7） | 2026-11-12 | 签署不等于 U2 授权 |

> R1 PASS 只表示独立复核通过，不表示 U1 已完成，也不替代 U1-SIGN 用户签署。
