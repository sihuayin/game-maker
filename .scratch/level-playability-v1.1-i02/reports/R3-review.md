# I-02 U3 独立复核报告（R3）

| 项 | 值 |
| --- | --- |
| 复核对象 | I-02 U3（I02-03 永久门区证明 / 门区半部） |
| 复核类型 | R3（授权包 [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) §9.3） |
| 复核输入包 | [`.scratch/level-playability-v1.1-u3/reports/07-r3-input-package.md`](../../level-playability-v1.1-u3/reports/07-r3-input-package.md) |
| 复核人 | **independent reviewer subagent, fresh context**（未参与 U3 编写） |
| 日期 | **2026-11-12** |
| Diff 范围 | `c0d6981170967f0145a26901425835dd8df7ba1e..d479816e414cf04ccf3a9e59a12ef32e1a4cb384` |
| 复核时 HEAD | `d479816e414cf04ccf3a9e59a12ef32e1a4cb384`（现场 `git rev-parse HEAD` 复核） |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（现场复算，**匹配**） |
| 授权范围记录 | 输入包 §1 引用的 `.scratch/level-playability-v1.1-i02/reports/04-u3-incremental-authorization.md`：U3 实施 + R3；U4–U5、`PUBLIC_NB` / `PUBLIC_PU`、I-03 接线未授权 |
| **结论** | **PASS —— R3 通过；U3 可标记完成，但仅可据此申请 U4 增量授权** |

> 本报告只依据本次复核人自己的 diff 检查、冻结规格 / 产品源码通读、数学独立核算与命令重跑。
> 未读取 `.scratch/level-playability-v1.1-u3/reports/07-implementation.md`、`07-draft-pr.md`、
> `.scratch/level-playability-v1.1-u3/map.md`，也未读取 `.scratch/level-playability-v1.1-u3/issues/`
> 下除 `09-u3-r3-review.md` 外的任何票；未把 `.scratch/level-playability-v1.1-u3/evidence/`
> 作为结论依据（本次复核也未读取该目录）。

---

## 0. 结论摘要

- **结论：PASS**。R3-01 ～ R3-08 全部为 `PASS`，无 `FAIL`、无 `NOT_RUN`。
- 产品路径 diff 干净：只新增 `temporal-gate.ts` 与 `playability-temporal-gate.test.ts`；
  `temporal.ts` / `graph.ts` / `reach.ts` / `docs/` / `fixtures` 零 diff；无新依赖、无锁文件、
  无 JSON fixture、无公共 barrel 导出。
- 门区闭式与 D4 §1.1 一致；复核人用自写的三角波与 4001 相位密集采样独立算得
  全相位交集 `[L,R]=[50,60]`、`width=10=w−d`，既不是扫掠带 `[40,70]`（宽 30），
  也不含 lag pad。判侧、注入、反例与输出边界均经源码检查 + 独立脚本复核通过。
- 命令全部退出码 0：`pnpm build` / `pnpm typecheck` / 门区定向测试（48/48）/
  input 定向测试（65/65）/ `pnpm test`（174 文件 / 2795 测试）。
  全量测试有 2 条 vitest worker RPC `onTaskUpdate` 超时（工具层，非断言失败，退出码 0）。
- 非阻塞观察见 §6；R3 PASS 的授权边界见 §7。

---

## 1. 输入与 diff scope

### 1.1 授权包完整性

```text
$ shasum -a 256 docs/v7.8/移动-I02.md
797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56  docs/v7.8/移动-I02.md
```

匹配输入包 §1 要求的 `797cd6fc…`。

### 1.2 U3 diff（`c0d6981..d479816`）

产品路径只有 2 个新增文件：

```text
$ git diff --name-status c0d6981..HEAD -- packages/ docs/ fixtures/
A	packages/contracts/src/playability/temporal-gate.ts
A	packages/contracts/tests/playability-temporal-gate.test.ts
```

独立核对：

- `git diff --name-only c0d6981..HEAD -- '**/package.json' pnpm-lock.yaml` **为空**（无新依赖 / 锁文件改动）。
- `git diff --name-only c0d6981..HEAD -- '*.json'` **为空**（无 JSON fixture）。
- `playability-temporal-fixtures.ts`、`temporal.ts`、`graph.ts`、`reach.ts`、`docs/` 均为 **0** 个变更文件。
- 其余新增全部落在 `.scratch/level-playability-v1.1-i02/reports/04-u3-incremental-authorization.md`
  与 `.scratch/level-playability-v1.1-u3/**`（票 / 地图 / 证据），未进入 `packages/**`。
- `packages/contracts/src/playability/` 下本次唯一的变更就是新增 `temporal-gate.ts`。
- 未新增 / 修改 package exports；两个公共 barrel 均不含 `temporal-gate`。

> 工作区在复核开始时已存在一条对 `.scratch/level-playability-v1.1-u3/issues/09-u3-r3-review.md`
> 的未提交修改（票本身 in-progress），**非本会话产生，本会话未改动它**；本次复核唯一写入的
> 文件是本报告。

### 1.3 公共面与依赖边界（源码检查）

```text
$ grep -nE 'from "\./temporal(\.js|-witness\.js)"' packages/contracts/src/playability/temporal-gate.ts
（无匹配）
$ grep -n "temporal-gate" packages/contracts/src/playability/index.ts packages/contracts/src/index.ts
（无匹配）
$ grep -rn --include='*.ts' "temporal-gate" packages/ | grep -v playability-temporal-gate.test.ts
（无产品 / 其它测试引用；仅编译产物 dist 的 sourcemap 注释命中，dist 不入库）
```

`temporal-gate.ts` 的全部 import：

```text
./geometry.js            （expandBox 运行时；Aabb / Size 类型）
./graph.js               （MovementGraph 类型，只读）
./temporal-motion.js     （epsilon 运行时；HazardBoxSpec / TriangleMotion 类型）
./temporal-result.js     （DegradationReason / PermanentGateProof / ProofStatus，全部 import type）
```

无 `temporal.ts` / `temporal-witness.ts`（不成环）；无新依赖；无文件系统 / 随机 / 时钟调用。

---

## 2. 命令重跑（退出码 / 计数）

| # | 命令 | 退出码 | 结果摘要 |
| --- | --- | ---: | --- |
| 1 | `pnpm build` | 0 | `tsc -b` + 10 个 workspace bundle 全部 Done |
| 2 | `pnpm typecheck` | 0 | 全部 workspace `typecheck: Done` |
| 3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts` | 0 | `1 passed (1)` / `48 passed (48)` |
| 4 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts` | 0 | `1 passed (1)` / `65 passed (65)` |
| 5 | `pnpm test` | 0 | `174 passed (174)` / `2795 passed (2795)`；`Errors 2` |

### 2.1 全量测试的 2 条 unhandled error

两条均为 vitest 工具层 RPC 超时，不是断言失败、不是测试用例失败：

```text
Error: [vitest-worker]: Timeout calling "onTaskUpdate"
 ❯ Object.onTimeoutError node_modules/.pnpm/vitest@3.2.7_.../vitest/dist/chunks/rpc.-pEldfrD.js:53:10
```

`Test Files 174 passed`、`Tests 2795 passed`、进程退出码 0。复核人**未**把该告警当作 PASS 依据；
它与 U3 无关，是本次唯一的环境噪声（见 §6）。

---

## 3. R3 逐项判定

| # | 验收项 | 判定 | 证据（本次独立核查） |
| --- | --- | --- | --- |
| R3-01 | 门区闭式 `L/R`、`w−d>ε`、全周期交集、无 pad | **PASS** | 源码 `gateGeometryOf` 逐字实现 `L=at+d−anchorX·w`、`R=at+(1−anchorX)·w`、`width=w−d`、`width > epsilon(at.x, at.x+distance)`；无 pad 字段。独立核算：4001 相位采样交集 = `[50,60]` = 闭式；`width=10`；ε=1e-8（行程 10）。见 §5.2、§5.6。 |
| R3-02 | `∀φ0` 交集；无幸运相位 / 无整段扫掠区 | **PASS** | `gateGeometryOf` / `periodCoverageOf` 内无相位采样循环（测试亦以括号配平检查断言）；`periodCoverage` 记录 `[0,P/2]`、`[P/2,P]` 两段解析半周期，`complete:true` 只在门宽 > ε 后才可达。独立核算：相位含 0、P/2、P 的 4001 点交集恰为 `[L,R]`；单点「幸运相位」50ms 会给出 `[45,65]`（宽 20），实现没有这样做。见 §5.2。 |
| R3-03 | 左→右 / 右→左 spawn 与 `goalRegion` 条件；外扩 0.5px | **PASS** | `sideRuleOf` 用 `expandBox(goalRect, 0.5)`，四边各外扩；spawn 用传入的精确盒不外扩；两个方向的不等式与 D4 §2 逐字一致。独立边界（anchorX=0.3 ⇒ L=54,R=64）：`spawnRight=54 ∧ goalRegion.x=64` 与 `spawn.x=64 ∧ goalRight=54` 均 PASS；各偏移 `+1e-7` 后均 `no-permanent-gate`。见 §5.6。 |
| R3-04 | 原始 `gateRect` 原样注入、只扩张一次、不进 `blocked`、门顶不是地板 | **PASS** | `forbiddenInjectionOf` 先 `buildGraph([])` 校验同源，再以模块内由 `L/R/y/height` 构造的**原始** `gateRect` 调一次 `buildGraph([gateRect])`；按 `graph.ts` 公式重算 `forbidden` / `standable` 掩码并逐格比对，任何预扩张 / 重复扩张 / 扫掠区注入都会 `geometry-untrusted`。独立重算全部脚点格的严格重叠谓词：注入掩码 0 处不一致；`blocked` 完全不变；新增可站立格 0；`expandedRect={49,20,12,40}` 与连续包络一致。见 §5.4、§5.5。 |
| R3-05 | D4 §11 反例 1–4、6、13 全覆盖 | **PASS** | 测试文件对 1、2、3、4、6、13 各有一条具名反例测试，48/48 通过；复核人另行独立复算 1（闭式 vs 扫掠 / pad）、3（扫掠区注入拒绝）、4（预扩张拒绝）、13（lag 不加 pad）。见 §5.2–§5.6。 |
| R3-06 | 未生成 / 伪造 `graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure` / 完整 `PermanentGateProof` / 完整 `TemporalInternalResult` | **PASS** | 运行时输出键恰为 `forbiddenInjection, gate, gateStatus, periodCoverage, reason, sideRule` 六项；无 `graphCut` / hop / `movementModelClosure` / `puConditions` 等字段。源码无 `assessReachability(`、无 `startCells()` 调用、无 `graphCut:` 字段；`PermanentGateProof` 只作 `import type` 的子字段别名，不构造完整对象。见 §5.6（输出形状）与 §1.3。 |
| R3-07 | 未实现 U4 / U5；未修改 `temporal.ts` / `graph.ts` / `reach.ts`；`temporal.ts` 零 diff | **PASS** | diff 仅两个新增产品文件；`temporal.ts` / `graph.ts` / `reach.ts` / `docs/` / fixtures 均 0 diff；无 `temporal-evasion.ts`、无 hop 能力、无图割实现。见 §1.2。 |
| R3-08 | 独立验证 ≥2 条关键反例 + 1 条边界值 | **PASS** | 复核人自写 `/tmp` 脚本（未入库）：自写三角波与产品 `trianglePosition` 交叉校验；反例 1、13、3、4；边界值 G1 门宽 ε、G2 判侧闭边界（双方向）、G3 y 严格重叠、G4 周期记录。见 §5。 |

---

## 4. 文件 SHA-256 与源码边界证据

### 4.1 现场复算的 SHA-256

```text
$ shasum -a 256 packages/contracts/src/playability/temporal-gate.ts \
               packages/contracts/tests/playability-temporal-gate.test.ts \
               packages/contracts/tests/playability-temporal-fixtures.ts
03ec5ef656815028afb9ef5bb7b9d19b5f7e02e1b63a7c095721d2eebf9913a2  packages/contracts/src/playability/temporal-gate.ts
3303b7f25468f713e5c0b9d8dc049e57f4652b67c1db606bb93087689035d58d  packages/contracts/tests/playability-temporal-gate.test.ts
20b56290fbb76a978a849422fa91fcf1573426172c2d186f75889fc1c2a2b481  packages/contracts/tests/playability-temporal-fixtures.ts
```

前两个 hash 与输入包 §2 在 U3-07 时点的记录**完全一致**；fixtures 的 hash 与 R2 时点一致，
且本单元 diff 为 0。无证据文件被作为结论依据。

### 4.2 源码边界断言（复核人自己运行）

- `temporal-gate.ts` 无 `lagPad`、无 `overlapsStrict`、无 `Math.random` / `Date.now` / `performance.now`。
- 无对 `blocked[...]` / `forbidden[...]` 的写入；对 `blocked` 只读（`sameStatics` / `expectedStandable`）。
- 导出符号只有 `computePermanentGate` 与 5 个类型别名，均标 `@internal`；两个公共 barrel 均未导出。
- 失败原因只用 D9 闭集中的 `no-permanent-gate` / `geometry-untrusted`，未新增原因码。

---

## 5. 独立验证（自选反例 + 边界值）

### 5.1 选择理由

- **反例 1（门宽用 pad / 扫掠并集）**：这是门区半部的核心健全性声明；若这里错了，后面所有
  side rule / injection 都建立在被放大的假门上。因此用**自写三角波 + 密集全相位采样**
  独立重算交集，而不是重读作者断言。
- **反例 13（把 Witness 的 lag pad 用到门区）**：这是最容易被「保守一点更安全」误导的方向；
  D4 §1.2 声称 `⋂δ` 与 `∀φ0` 等价，必须用区间算术复核。
- **反例 3 / 4（扫掠区注入 / 预扩张）**：直接检验注入校验器是否 fail-closed。
- **边界值**：`width > ε` 是严格不等式、`goalRegion` 是 0.5px 过近似、y 重叠是严格重叠，
  这三处最易出现差一 / 差 ε 的错误，故自选临界值。

所有脚本位于 `/tmp/r3-verify/`（用 `esbuild` 打包仓库源码到 `/tmp`），**未在仓库内新增任何文件**。

### 5.2 反例 1：全相位交集 = 闭式核心，不是扫掠 / pad

- 自写 `tri(at,d,P,t)` 与产品 `trianglePosition` 在 `t = 0,1,50,100,150,199.999,200,200.0001,350,-50,-200,1000.5`
  上逐一相符（误差 < 1e-12）。
- 对默认输入（`at=(50,40)`、`d=10`、`P=200`、`w=20`、`anchorX=0.5`）取 4001 个相位
  （含 `0`、`P/2`、`P`）：

```text
全相位交集       = [50, 60]
D4 闭式          = [50, 60]
产品 gate        = L=50, R=60, width=10
整段扫掠并集     = [40, 70]（宽 30）
单点「幸运相位」50ms = [45, 65]（宽 20）
```

结论：实现取的是全相位交集（宽 `w−d=10`），既不是扫掠带，也不是单相位采样；
测试断言 `L=50 / R=60 / width=10` 真的钉住了该性质。

### 5.3 反例 13：lag 扫掠不扩大 / 缩小门区

对 4001 个 `φ0` × 23 个 `δ∈[0, 16.67]ms` 的全组合求交集：

```text
含 lag 交集 = [50, 60]
无 lag 交集 = [50, 60]
产品 width  = 10（= w−d，无 pad）
```

与 D4 §1.2 的等价性一致：`∀φ0` 已覆盖整个周期，lag 不扩大位姿集合；门区不需要、
也不应该加 pad。实现确实没有引用 `lagPad`。

### 5.4 反例 3 / 4：注入校验器 fail-closed

用产品 `computePermanentGate` + 真实 `buildMovementGraph`：

```text
正确注入（原样 gateRect）                 => COMPLETE
builder 内预扩张（x−1, w+2, h+20）        => INCOMPLETE / geometry-untrusted
builder 忽略入参、注入扫掠矩形 [40,70]×[20,40] => INCOMPLETE / geometry-untrusted
```

### 5.5 注入语义逐格复算

对默认输入，独立按 `overlapsStrict` 在全部整数脚点格上重算「玩家盒是否严格撞原始 gateRect」，
与 `build([gateRect]).forbidden` 对比：

```text
掩码不一致格数        = 0
新增禁入格            = 220
blocked 是否改变      = 否（逐元素相等）
新增可站立格          = 0（门顶不是地板）
记录 expandedRect     = {x:49, y:20, w:12, h:40} = 连续包络 [L−w/2, R+w/2] × [y, y+h+H]
```

即：扩张只发生一次、由 graph 完成、不进 `blocked`、不产生新支撑。

### 5.6 自选边界值

| 边界 | 输入 | 结果 |
| --- | --- | --- |
| G1 门宽 ε（`d=10 ⇒ ε=1e-8`） | `width≈1.00000008e-9` | `INCOMPLETE / no-permanent-gate` |
| G1 门宽 ε | `width≈1.99999999e-8` | `COMPLETE` |
| G1 严格 `>`（`d=0 ⇒ ε=1e-9`） | `width=1e-9` 恰好等于 ε | `INCOMPLETE / no-permanent-gate` |
| G1 严格 `>` | `width=1.0000001e-9` | `COMPLETE` |
| G2 左→右（anchorX=0.3 ⇒ L=54,R=64） | `spawnRight=54 ∧ goalRegion.x=64` | `COMPLETE / left->right` |
| G2 左→右 | `spawnRight=54+1e-7` 或 `goalRegion.x=64−1e-7` | `INCOMPLETE / no-permanent-gate` |
| G2 右→左 | `spawn.x=64 ∧ goalRight=54` | `COMPLETE / right->left` |
| G2 右→左 | `spawn.x=64−1e-7` 或 `goalRight=54+1e-7` | `INCOMPLETE / no-permanent-gate` |
| G3 y 严格重叠 | `hazY=40` 恰好与玩家顶边相切 | `INCOMPLETE / no-permanent-gate` |
| G3 y 严格重叠 | `hazY=40−1e-7` | `COMPLETE` |
| G4 周期记录 | 默认周期 200ms | `{periodMs:200, complete:true, intervals:[[0,100],[100,200]]}` |

另核对运行时输出：`Object.keys` 恰为六字段；`INCOMPLETE` 时四个半部全为 `null`；
`graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure` / `puConditions`
等字段均不存在。

### 5.7 测试断言是否真正钉住性质

- **R3-01 / R3-03 / R3-04**：测试用精确数值（`L=50/R=60/width=10`、`goalRegion={86.5,19.5,7,21}`、
  `expandedRect={49,20,12,40}`）与掩码级断言，确实钉住性质；复核人的独立脚本给出相同数值。
- **R3-02**：反例 2 的测试本身只断言 `periodCoverage` 的两段区间与总长，**没有**直接构造
  「相位采样实现会给出不同门宽」的对照；它相对最弱。但源码中 `periodCoverageOf` 无采样循环，
  且复核人的 4001 相位独立采样确认了交集等式，故该项仍判 PASS。
- **R3-05 反例覆盖**：六条反例都有具名测试；其中反例 1 / 4 / 13 的断言与我的独立复算一致。

---

## 6. 未覆盖项 / 限制 / 非阻塞观察

1. **未在真实 19 关语料 / 生产数据上运行** U3 门区半部；本次只覆盖内存夹具与定向 / 全量测试。
2. **U4 / U5 不在 R3 范围**：未验证图割、hop 双档、`movementModelClosure`、PU 六条件组装；
   本报告不对这些半部作任何结论。
3. **`periodCoverage.intervals` 的语义是模块冻结的**（D9 只给了字段形状）：它表示「周期内
   门区核心被覆盖的时间窗口」，完整性由 `width > ε` 的几何前提保证。语义自洽，但不是
   D9 原文逐字定义；若 U4 / U5 需要不同语义，应在 D9 层重申。
4. **`spawnBox` 未与 `graph.player.foot` 交叉校验**：模块信任调用方传入 D3 精确 spawn 盒；
   若调用方传错 y，y 重叠前置条件会随之偏移。这是输入契约的责任边界，不是本单元实现的缺陷，
   但 U4 接线时应保证同源。
5. **模块拒绝携带既有 `forbiddenBoxes` 的基线图**（`sameGraph(base, input.graph)` 要求
   `buildGraph([])` 全等）。这与模块声明的「基线图不带 forbiddenBoxes」一致，且 fail-closed；
   但 U4 若要把门区与其它静态 hazard 掩码组合，需要在 U4 的建图入口处决定组合方式。
6. **`INCOMPLETE` 用 `no-permanent-gate` 承载判侧失败**（同侧 / 跨门 / 起点不严格在一侧）。
   D9 闭集中没有更贴切的码，语义偏宽但可接受；不影响 R3 判定。
7. **测试文件顶部注释已过时**：仍写着「本文件当前只覆盖 API 形状 … 全周期覆盖 / 判侧 /
   forbiddenInjection 在后续票补齐」，与实际已包含 U3-03～U3-06 的内容不符。纯文档性小瑕疵。
8. **全量 `pnpm test` 的 2 条 unhandled error**：`[vitest-worker]: Timeout calling "onTaskUpdate"`，
   工具层 RPC 超时；174 文件 / 2795 测试全部通过、退出码 0，未消除但不影响断言结论。
9. 复核人**未读取**作者实现报告 / 草稿 PR / 地图 / 其它 U3 票 / evidence 目录；未使用作者结论。

---

## 7. 授权边界声明

**R3 PASS 不等于 U4 / U5 授权。** 具体地：

- 本 PASS **不授权** U4（垂直规避图割）或 U5（hop 加倍 / 硬化）的实施；
- **不授权** `PUBLIC_NB` / `PUBLIC_PU`，不授权发布 `PROVEN_UNPLAYABLE`；
- **不授权** I-03 接线或任何公共 Verdict / 公共 Contract 变更；
- **不授权** push / 建 PR / 合并；
- 按 `docs/v7.8/移动-I02.md` §9.3，R3 PASS 只允许**申请** U4 的增量授权；U4 仍需
  `graph.ts` 的**独立增量审批**，且生产 PU 仍受几何 `partial` 与移动模型未闭合两项独立阻塞。

---

## 8. 用户签署栏（由 U3-SIGN 填写，复核人留空）

```text
用户结论：        [ ] 接受 R3 复核结论（PASS）
                  [ ] 不接受 / 要求补充复核
签署人：          ______________________
日期：            ______________________
备注：            ____________________________________________________________
```

---

## 9. 复核声明（隔离）

- 复核人**未参与 U3 实现**，本报告全部结论来自本次独立的 diff 检查、冻结规格 / 产品源码阅读、
  自写 `/tmp` 数学 / 边界脚本与命令重跑。
- 复核人**未读取** `.scratch/level-playability-v1.1-u3/reports/07-implementation.md`、
  `07-draft-pr.md`、`.scratch/level-playability-v1.1-u3/map.md`，也未读取
  `.scratch/level-playability-v1.1-u3/issues/` 下除 `09-u3-r3-review.md` 外的任何票；
  未把 `.scratch/level-playability-v1.1-u3/evidence/` 作为结论依据。
- 复核人未修改 `packages/**`、`fixtures/**`、`docs/**`、产品代码、测试或配置；未提交、未推送、
  未创建 PR、未合并、未开始 U4；本次唯一写入的文件是本报告。
- 独立脚本位于 `/tmp/r3-verify/`（仓库外），未向仓库新增任何夹具 / 测试 / 依赖。
- 本报告路径：`.scratch/level-playability-v1.1-i02/reports/R3-review.md`。
