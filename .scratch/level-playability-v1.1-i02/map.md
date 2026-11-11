# Level Playability V1.1 I-02：连续时间判定核心（实施授权包）

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-i02
Baseline: `docs/v7.8/移动-200.md` @ `sha256:14a3816d8d5975765e3a9301c5f06612ab03f6f14130ca4ca865550ec165b7d5`；权威输入提交 `a3b8a54`
Status: open · 2026-11-10 开图
Predecessor: [Level Playability V1.1 Integration](../level-playability-v1.1-integration/map.md)（I-00 冻结包已签署并收口）

> **2026-11-10 开图。** 授权来源：[`docs/v7.8/移动-200.md`](../../docs/v7.8/移动-200.md)（I-02 需求文档：单移动 Hazard 连续时间判定核心）。
> I-02 需求 §12 明确：该文档**不构成实施授权**；正式启动前应另行提交 I-02 实施授权包。§12 的最终建议是「先批准 I-02-01 的算法设计与测试夹具准备；在连续时间求交语义和数值稳定性得到独立复核前，不授权完整 I-02 实施」。
> 因此本图的终点是**可签署、可审计、分阶段放行的 I-02 授权包**，不是 I-02 算法实现，也不是 I-03 生产接入。

## Destination

交付一份**可签署的 I-02 实施授权包** `docs/v7.8/移动-I02.md`，使 I-02 能在独立授权下分阶段实施。

授权包必须包含 I-02 需求 §12 要求的七项内容：

1. 具体文件白名单和允许修改的模块。
2. I02-01～I02-05 的提交拆分。
3. AABB、epsilon、三角波和图割的正式数学语义。
4. 默认预算及硬上限的最终冻结值。
5. 测试命令、性能基准和停止条件。
6. 公共接口、依赖和 Runtime 变更的审批边界。
7. 每个强制复核点的通过条件。

另加（用户 2026-11-10 裁定）：

8. **I-00 / I-02 冲突登记表**，作为独立章节；冲突必须单独裁定，不得静默择一。
9. 五个单元的完整定义与授权状态：I02-01 `AUTHORIZED`，其余 `PLANNED`。
10. I02-03 与 I02-04 的依赖、先后顺序及各自授权条件。
11. R1（I02-01 完成后）与 R2（I02-02 完成后、进入 I02-04 前）的复核清单。
12. 范围与证据审计记录、签署记录。

**终点不是** I02-01～I02-05 的实现，也不是「证明这些算法都能在现有代码结构下落位」。若某项决定在现有冻结语义或代码事实下无法成立，授权包允许以「缩范围 / 加白名单 / 回 HITL / 停止」结束，不得为了交包而把「必须证明」降级为「尽量证明」。

## Notes

### 权威输入与冻结边界

- **I-02 需求（只读冻结）**：[`docs/v7.8/移动-200.md`](../../docs/v7.8/移动-200.md)，`sha256:14a3816d…`。不得直接修改原文来消除冲突；冲突走 [I02-02 冲突登记](issues/03-i02-02-conflict-register.md) 与独立裁定票。
- **I-00 冻结包（只读基线，已签署）**：[`docs/v7.8/移动-I00.md`](../../docs/v7.8/移动-I00.md)。I-00 已冻结的语义**优先**于 I-02 需求文档与现有代码事实；任何冲突必须显式裁定并记录。
- **父 PRD（只读）**：[`docs/v7.8/移动.md`](../../docs/v7.8/移动.md)。
- **P0 结论与原型（只读证据）**：[P0 结论包](../level-playability-v1.1-p0/evidence/04-final-report.md)、[P0 模型](../level-playability-v1.1-p0/prototype/MODEL.md)。P0 的 `verticalEvasionImpossible` 布尔声明确认作废（I-00 G-04）；P0 性能样本不是生产预算。
- **领域词汇**：`CONTEXT.md` 是唯一权威；本图不新增同义词。

### 用户 2026-11-10 裁定（Q1–Q4）

| 问题 | 裁定 |
| --- | --- |
| Q1 终点 | 交付完整 I-02 实施授权包，不直接实施算法。 |
| Q2 执行承载 | 允许 scratch 原型、只读实验和证据采集；禁止生产代码修改。 |
| Q3 放行形态 | 一个包覆盖五个单元，首次签署只授权 I02-01。 |
| Q4 冻结冲突 | I-00 已签署语义优先；冲突必须单独裁定并记录，不得静默择一。 |

### 执行覆盖（有限只读，scratch）

**允许**（仅限 `.scratch/level-playability-v1.1-i02/`）

- `scripts/`：扫描 / 验证 / 复现脚本。
- `evidence/`：事实清单、冲突登记、证据摘要。
- `experiments/`：三角波/AABB 解析求交、图割与 hop 加倍、P0 与 I-00 差异复核。
- `reports/`：范围审计、证据审计、性能报告。
- 读取 `packages/**`、`docs/**`、`fixtures/**`、`.scratch/level-playability-v1.1-p0/**`、`.scratch/level-playability-v1/**`。
- 运行不修改产品文件的测试或小型验证程序。

**禁止**

- 修改 `packages/**`、Runtime、CLI、MCP、公共 Contract。
- 修改生产 stub 或生产分析器。
- 接入最终 Playability Verdict。
- 新增第三方依赖、调用付费模型或外部付费服务。
- 将 scratch 实验结果表述为生产验收通过。
- 修改 `docs/v7.8/移动-200.md`、`docs/v7.8/移动-I00.md` 或历史验收证据。

### 票分类与状态

| 前缀 | 含义 | 允许的产出 |
| --- | --- | --- |
| `EVIDENCE` | 只读取证 / scratch 实验 | `evidence/`、`experiments/` 下的证据 |
| `DECISION` | 需要用户裁定的设计决策 | 裁定记录（票内 `## Answer`） |
| `DELIVERABLE` | 授权包与审计 | `docs/v7.8/移动-I02.md`、`reports/` |
| `SIGN` | 签署 | 签署记录 |

- 票类型（`Type:`）：`research` / `prototype` / `grilling` / `task`。
- 状态（`Status:`）：`open` / `claimed` / `resolved`。
- 认领即改 `Status: claimed` 并保存，先于任何工作。
- 裁定票（grilling）只产出裁定记录，不产生产品代码 commit；未通过时后续票保持 blocked。
- **PLANNED 不等于隐含授权**：授权包中五个单元即使全部定义完整，也只有首次签署时明确列出的单元获得实施授权。

### 证据标准

- **E1**：源码 / 契约 `file:line`。
- **E2**：测试名 + 断言 + 退出码。
- **E3**：scratch 复跑（命令、路径、计数、原始输出摘要）。
- 每个取证任务必须记录：对应需求 / 硬门槛编号、输入文件与 SHA、命令与环境、原始结果、是否修改产品目录（必须为否）、结论与限制、复现方法。

### 复核门槛（用户 2026-11-10 裁定）

- **R1：I02-01 完成后。** 独立复核运动模型、AABB 语义、连续时间求交、epsilon、数值稳定性及反例测试。未通过不得进入 I02-02。
- **R2：I02-02 完成后、进入 I02-04 前。** 复核 Witness 完整性、连续时间安全性和证明健全性。后续单元仍需增量授权。
- **D8 已扩为四个复核点**：R1(U1) → R2(U2) → R3(U3) → R4(U4)；U5 由完成报告 + AC-08～AC-13 验收；R4 通过不等于公共 NB/PU 获准。详见 [I02-D8](issues/14-i02-d8-review-gates.md)。
- **R1/R2 的通过条件与 I02-03/04 的先后、各自授权条件，由 [I02-D8](issues/14-i02-d8-review-gates.md) 显式裁定**；不得因 R2 通过就默认全部放行。

### 依赖图

```
I02-00 Effort 初始化与输入冻结（task · AFK）
  └─ I02-01 代码事实与 I-01 能力核对（research · AFK）
        ├─ I02-02 I-00 / I-02 冲突登记（task · AFK）
        │     ├─ I02-D1 相位与时间语义裁定（grilling · HITL）
        │     ├─ I02-D2 运动模型与输入契约裁定（grilling · HITL）
        │     └─ I02-D10 U9 与全相位 Winning Set 的可执行判据（grilling · HITL）
        ├─ I02-03 连续时间求交可行性实验（task · AFK）
        ├─ I02-04 图割与 hop 加倍可行性实验（task · AFK）
        ├─ I02-05 性能与预算基线采集（task · AFK）
        └─ I02-06 Phaser overlap 语义直接证据（research · AFK）

I02-D1 + I02-D2 + I02-03 + I02-06 + I02-D10 ─→ I02-D3 安全通过 Witness 模型裁定（grilling · HITL）
I02-D1 + I02-D2 + I02-04 + I02-06 + I02-D10 ─→ I02-D4 永久封锁门与垂直规避图割裁定（grilling · HITL）
I02-05 ─────────────────→ I02-D5 预算、确定性与降级裁定（grilling · HITL）
I02-D5 ─────────────────→ I02-D5B 累计 cut 预算基准（task · AFK） ─→ I02-D9 / I02-AUTH

I02-D3 + I02-D4 + I02-D5 ─→ I02-D6 文件白名单增量与模块布局裁定
I02-D3 + I02-D4 + I02-D5 ─→ I02-D7 测试矩阵与证据口径裁定
I02-D3 + I02-D4 + I02-D5 + I02-D10 ─→ I02-D9 内部分析结果与诊断契约裁定
I02-D3 + I02-D4 ─────────→ I02-D8 复核门槛、单元依赖与增量授权裁定

全部裁定 ─→ I02-AUTH 授权包编写 ─→ I02-AUDIT 范围与证据审计 ─→ I02-SIGN 授权包签署
```

- **I02-03 与 I02-04 的先后不在建图时预设**：两票都只挂在证据族之后，先后与授权条件由 [I02-D8](issues/14-i02-d8-review-gates.md) 裁定。
- **I02-D1 是本图的拱心石**：相位全称/存在语义直接决定 Witness 与永久封锁证明的量化方向；D1 已于 2026-11-10 裁定（`∀φ0` + per-phase 策略；`NB ⇔ U9 ∨ ∀φ0 W`）。
- **I02-D10 是 D1 的显式后续**：D1 只裁定证书的充分性与量化方向，不裁定 U9 / Winning Set 的可执行判据；D3 / D4 / D9 都依赖 D10。
- **I02-D6 可能触发 I-00 R2 之外的增量授权**：`graph.ts` 的 hop 参数化仍在 I-00「需单独裁定」名单；若 D4 判定必须改 `graph.ts`，授权包必须写清额外的审批形态，不能把它当作白名单内改动。
- **I02-D4 已裁定生产 PU 不授权**：`movementModelClosure = "not-proven-air-control"`（`scene.ts:89` 空中水平控制）与几何 `partial` 是两项独立阻塞；I02-03 / I02-04 只做模型条件性内部计算，不得发布 `PROVEN_UNPLAYABLE`。PU 六条件第 2、5 条 `BLOCKED`，第 6 条为构造性 lag 无关。
- **I02-D5 的累计 cut 预算未冻结**：`maxCutsPerBranch` 由 [I02-D5B](issues/21-i02-d5b-cut-budget-benchmark.md) 基准确定；在此之前 U2 不得声称完整确定性工作预算，D9/AUTH 不得签署 U1–U2 完整预算验收。

### 分支与产物

- 图与票：`wayfinder/level-playability-v1.1-i02`（本分支）。
- 产物：`.scratch/level-playability-v1.1-i02/{map.md,issues/,scripts/,evidence/,experiments/,reports/}`。
- 最终授权包：`docs/v7.8/移动-I02.md`（由 [I02-AUTH](issues/16-i02-auth-package.md) 产出，签署前不构成实施授权）。
- 不复活或改写 I-00 / P0 的 effort 目录；引用可以，重开结论不行。

## Decisions so far

<!-- 索引：每张已关闭票一行，够判断相关性即可；细节永远在票里。 -->

- [I02-01 代码事实与 I-01 能力核对](issues/02-i02-01-code-facts.md): I-01 信任链只到 Atlas JSON 元数据（逐帧 `sourceSize` / `anchor` / `rotated` / `trimmed`），不含 PNG / manifest / Runtime hitbox，且缺 Phaser overlap 直接证据；入口缺 profile / `T_arr` / 预算，`TemporalAuditResult` 装不下 witness / proof / stats；生产仍由架构测试 T-58 钉死为 stub；三角波只在禁改的 `demo`；hop 采样固定；语料 21/19，但 `perf-probe` 绑定 P0 模型不能原样复用。登记 C-01～C-14，供 D1/D2/D4/D6/D9。证据见 [`evidence/01-code-facts.md`](evidence/01-code-facts.md)。

- [I02-00 Effort 初始化与输入冻结](issues/01-i02-00-effort-init.md): 基线 `a3b8a54` / 分支 `wayfinder/level-playability-v1.1-i02`；I-02 需求冻结为 `sha256:14a3816d…`（**git 未跟踪，以 SHA 为准**），I-00 包 `d9fea112…`、父 PRD `3598cc19…`、`CONTEXT.md` `c623d018…`；用户 Q1–Q4、五单元目标状态、R1/R2、scratch 边界与停止线写入 [`evidence/00-baseline.md`](evidence/00-baseline.md)；只读复跑 `pnpm test` exit 0（170 files / 2616 tests）。

- [I02-02 I-00 / I-02 冲突登记](issues/03-i02-02-conflict-register.md): 20 条冲突（A-01～A-05 用户点名 + B-01～B-15 取证新增）；16 条待裁定、2 条归 I-03、1 条已核对一致（网格约束）、1 条已核对（Phaser overlap：strict 未被推翻）。相位→D1；速度/运动模型→D2；hop/PU/P0 声明→D4；预算→D5；结果形状→D9；`coverage.temporal` 与机制层 gap→I-03。见 [`evidence/02-conflict-register.md`](evidence/02-conflict-register.md)。

- [I02-06 Phaser overlap 语义直接证据](issues/19-i02-06-phaser-overlap.md): Phaser 3.90.0 矩形 AABB 用严格不等号（`World.js:1698-1713`），`overlap` / `collide` 共用同一谓词；相切、角接触、零面积接触均不算撞，`1e-9` 正面积重叠算撞；与 `overlapsStrict` 一致，**strict 未被推翻**。predicate 已证，runtime hitbox equality 仍属 C-11 / B-02；圆 body 是闭区间但 demo 未用。见 [`evidence/06-phaser-overlap.md`](evidence/06-phaser-overlap.md)。
- [I02-D1 相位与时间语义裁定](issues/07-i02-d1-phase-semantics.md): `NB ⇔ U9 ∨ ∀φ0 (spawn,φ0)∈W`；量化 = `universal-per-phase`，每相位可有自己的策略，策略可依赖精确相位，碰撞用 `hazardSpeed × lagMs` pad；`T_arr` 不进入入参、由策略派生；Witness 是相位索引的路径族（策略表 + 全相位轨迹可作超限等价证据）；PU 由 I-00 六条件独立判定，门区 = `⋂φ0 ⋂δ H(φ0,δ)`，无 witness 永不参与 PU；U9 仍是 canonical 充分证书，Winning Set 是另一充分证书（操作性澄清，不放宽 PU）；11 个诊断字段进内部结果。详见票内 `## Answer`。
- [I02-D10 U9 与全相位 Winning Set 的可执行判据](issues/20-i02-d10-u9-winning-set.md): U9 = 同 y walk 接近段（`∀φ0`，含残差等待）+ 停留整周期（折返点切段、常数 pad）+ 出口段（`∃ψ`）；W 是 1D 走廊 × 相位格上的**最小**不动点 `μX.(Goal ∪ Pre∃(X))`，N 个半开相位格 + 残差等待构成覆盖证明而非抽样，策略必须带严格递减 rank 终止；两证书任一成立即 NB，均失败仍只 IE；门区为全相位 × 全 lag 的**交集**。证据见票内 `## Answer`。
- [I02-03 连续时间求交可行性实验](issues/04-i02-03-continuous-intersection.md): 三角波 + AABB 的连续时间解析求交**可行**：切段 + 开区间求交在 123/123 条断言上通过（含 `2e-10 ms` 碰撞窗口、`1.005e-6 ms` 安全窗口、折返点/负时间/同速/非有限值）；ε 的「门宽」与「区间宽度」两种用法语义不同，且世界 span 会让临界门判定翻转；P0 与精确语义在 2000 例常规参数上 0 分歧，差异集中在 6 处近临界行为（y 判据 ±EPS、`|c1|<1e-9` 钳位、`hi−lo>1e-9`、端点跳切点、`dt=0` 分支谓词、lag 对称 pad）。证据见 [`evidence/03-continuous-intersection.md`](evidence/03-continuous-intersection.md)。
- [I02-04 图割与 hop 加倍可行性实验](issues/05-i02-04-graph-cut-hop.md): `forbiddenBoxes` 语义成立（不可穿越、不提供支撑、门顶不是地板；世界外只在采样/覆盖扫描中自由）；水平门区可被上方平台（N1）或下方坑道（N2）绕过，PU 必须证整图割；hop 60→120Hz 可改变连通性，方向以「连通→断连」为主（图级 37/8,000；边级 95/100,000），反向仅边级 4/100,000、图级 0/8,000 ⇒ 加倍不变性必须两档比较。证据见 [`evidence/04-graph-cut-hop.md`](evidence/04-graph-cut-hop.md)。
- [I02-05 性能与预算基线采集](issues/06-i02-05-performance-baseline.md): P0 代理下，语料状态容量 p50 `137,800` / max `177,800`、有效搜索墙钟 p50 `32.8ms` / max `42.3ms`；`500k / 2s` 对语料够（2.81× / 9.23× 余量），但 `W=5760` 合成最坏用例容量 `572,200` **超过 500k**、`1M` 硬上限够；状态计数确定而墙钟超时的 visited 不稳定；图形态（若 D3 采用）容量约 2×，`W=5760` 外推 ≈1.15M 超过 `1M`。证据见 [`evidence/05-performance.md`](evidence/05-performance.md)。
- [I02-D2 运动模型与输入契约裁定](issues/08-i02-d2-motion-input-contract.md): 三角波原式（折返点导数未定义、单侧斜率切段）；速度 = `2d/P` 派生、非输入；Hazard Box = manifest `size/anchor`（忽略 `body`），I-01 帧信任只作门禁；连续核心不取整，空间层取整差 ≤0.5px/边由 D4 保守包络；玩家盒未取整，合法范围按盒左上角 `x_left∈[0,W−pw]`、`y_top∈[0,H−ph]`；Goal Rect 用空间层取整盒（到达谓词归 D3）；模型外 = `applicable:true` + IE；**coverage 保持 `partial`，I-02 只产模型条件性结果、不发布正式 PU/NB**；I-02 §4 的「速度/相位」标为需求误述。

- [I02-D3 安全通过 Witness 模型裁定](issues/09-i02-d3-witness-model.md): Witness = 策略表 + 逐转移验证记录 + 终止 rank（路径族为派生视图）；状态 `(footX,k)` 锚在脚点整数格；走廊收窄为 spawn 脚点 y 的 `standable` 连通段（**显式收窄 D10 §2.1**），每条 move 必须做静态连续 `graph.solids` 检查；spawn 必须真实落在整数格，禁止 `round()` 吸附与 `startCells()` 宽松起点；段原语只有 wait / move；到达 = 未取整玩家盒与内缩 0.5px 的取整 Goal Rect 严格相交；残差等待按整格位姿保守验证；碰撞用 `overlapsStrict` 无 ε；U9 复用同一信封；每档 lag 独立证据。反例清单 13 条，D9 字段集已列。

- [I02-D4 永久封锁门与垂直规避图割裁定](issues/10-i02-d4-gate-graphcut.md): 门区 = 全周期闭式恒覆盖核心 `[at+d−a·w, at+(1−a)·w]`，宽度 `w−d>ε`，`⋂δ` 在 `∀φ0` 下冗余、无 pad；`gateRect` 原样注入 `forbiddenBoxes`（只扩张一次、不进 `blocked`），判侧用精确 spawn 与外扩 0.5px 的 goal；图割判据 = 无任何可达落脚点 / hop 弧采样盒覆盖 goal，`midAirHits=0` **只能否决、不能证明**；hop 双档记录 n / 端点 / cap 并验证规范化采样覆盖（不要求 `n` 精确 2×）；**生产 PU 不授权**：`movementModelClosure="not-proven-air-control"` 与几何 `partial` 两项独立阻塞；六条件 2/5 `BLOCKED`、6 构造性 lag 无关；I02-03 → I02-04，`graph.ts` 尾参需独立增量审批。

- [I02-D8 复核门槛、单元依赖与增量授权裁定](issues/14-i02-d8-review-gates.md): 实施单元 U1–U5（连续求交 / Witness / 永久门 / 图割 / 预算集成）；强制复核 R1(U1)→R2(U2)→R3(U3)→R4(U4)，U5 由完成报告 + AC-08～AC-13 验收；首次签署只授权 U1，后续单元须独立增量签署；预算接口是 U1 前置、不是独立单元；U4 依赖 `graph.ts` 独立审批，未批则 `BLOCKED`，scratch 分析不构成 U4 授权；单元授权 ≠ 公共能力授权，`PUBLIC_NB`/`PUBLIC_PU` 仍由 I-03 准入；任何假 PU 是严重证明健全性失败。

- [I02-D5 预算、确定性与降级裁定](issues/11-i02-d5-budget-determinism.md): 工作预算是唯一语义预算，墙钟只 abort-only、不计入确定性签名；U9/W 共用 NB 预算，U2/U4 独立、每档 lag 独立；`500k/2s` 默认、`1M/10s` 硬；新增 `maxCutsPerBranch`（数值待 [I02-D5B](issues/21-i02-d5b-cut-budget-benchmark.md)）；`N=min(N_max, floor(maxStates/xPositions))`、`stateCapacity` 是完整空间上界、`phaseGridCapped` 是诊断；检查点改为 1024 work units；双档「不完整」与「不一致」分开；发布门不覆盖内部结果；确定性要求所有策略遍历顺序固定。**U1–U2 完整预算验收待 D5B。**

## Not yet specified

<!-- 雾：知道方向、还不足以写成票的问题。前沿推进后再毕业。 -->

- **是否需要新 fixture pack。** I-00 将 `fixtures/packs/**` 列为「需单独裁定」；I-02 测试优先用内存夹具，若必须加 pack，审批路径未定。
- **I-02 内部结果能否在不改 `TemporalAnalyzer` 签名的前提下承载 proof / stats / diagnostics。** D9 会给出结论；若不能，I-03 之前的接口边界需重新设计。
- **非整数出生点的支持形态。** D3 冻结「脚点 x 非整数 ⇒ IE `spawn-not-on-lattice`」；若 19 关语料显示非整数出生点普遍存在，需要单独 HITL 裁定如何支持精确非整数起点（不得静默吸附），并判断对 I-02 可用范围的影响。

## Out of scope

- **I02-01～I02-05 的生产实现**：本图只产出授权包。任何 `packages/**` 修改都不属于本图。
- **I-03 生产接入**：`moving-hazard-phase` gap 消解、`coverage.temporal`、顶层 Verdict 聚合、`mechanic.ts` / `api.ts` 接线。
- **I-04 / I-05**：负向与回归验收、Pipeline 验收、19 个既有移动 Hazard 关卡的误拒证明。
- **Runtime、CLI、MCP、公共 Contract、持久化 Verdict、`ConfigIssue.code`、新第三方依赖。**
- **修改 I-00 冻结语义或 I-02 原文。** 冲突只登记、只裁定，不靠改原文消除。
- **扩大模型范围**：多移动 Hazard、Y 轴移动 Hazard、Moving Platform、Danger 联合、跳跃/下落/重力与 Hazard 的精确时序耦合。
- **把 scratch 实验或 P0 原型当作生产验收证据。**
- **PU 的重新授权与过近似图割研究**：I-02 只把「空中水平控制未闭合」记录为阻塞；若未来恢复 PU，需另开 HITL effort 证明过近似图是 Runtime 可达集的超集，不塞进本图。
