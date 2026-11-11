# I02-02 I-00 / I-02 冲突登记表

| 项 | 值 |
| --- | --- |
| 票 | [`03-i02-02-conflict-register.md`](../issues/03-i02-02-conflict-register.md) |
| 日期 | 2026-11-10 |
| 基线 | `a3b8a54`；I-02 需求 `sha256:14a3816d…`；I-00 冻结包 `sha256:d9fea112…` |
| 性质 | **只登记，不消解**；本文件不给出倾向性结论 |
| 修改产品目录 | **否** |
| 上游证据 | [`01-code-facts.md`](01-code-facts.md)（C-01～C-14） |

> 本表是授权包的独立章节草案。每条冲突必须在 D1 / D2 / D4 / D5 / D6 / D9 或新开裁定票中显式裁定；未裁定的条目在授权包中保持 `OPEN`，不得由实现静默择一。

## A. 用户点名的五组冲突

| ID | 冲突 | I-00 冻结条文 | I-02 需求条文 | 代码事实 / 证据 | 影响 | 裁定票 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-01 | Motion 相位 | §4.3 / §5.1：相位当自由变量；不假设首次看到 Hazard 时在 `t=0`（`移动-I00.md:72,76-84`） | §4 I02-01「输入要求」列「相位信息」（`移动-200.md:89-95`） | `Motion` 只有 `kind/axis/distance/periodMs`（`game-config.ts:79-85`）；相位字段不存在；`TemporalAnalyzer` 无 phase（`temporal.ts:39-44`） | 若把「相位自由」误读为「有相位输入」，Witness / 门区量化会建立在错误前提上。D1 裁定：`∀φ0 ∃ strategy`；`T_arr` 由策略派生，不新增入参 | I02-D1 | `RESOLVED（D1）` |
| A-02 | 速度 | §4 / §5：速度由 `distance / periodMs` 导出（`移动-I00.md:68-84`） | §4 I02-01 输入列「速度」（`移动-200.md:89-95`） | `Motion` 无速度字段（`game-config.ts:79-85`）；不得新增配置速度字段 | 新增速度字段会扩大输入契约，且与 I-00 冻结冲突 | I02-D2 | `RESOLVED（D2）` |
| A-03 | Hazard 运动模型 | §4：单 x 轴、`cycle`、`periodMs` 往返整周期、`t=0` 在 `at`、`P/2` 折返、两端不停留（`移动-I00.md:68-75`） | §3 / §4 I02-01：运动区间、方向、折返点、周期边界；功能要求 1–8（`移动-200.md:61-115`） | `Motion` 只有四字段；contracts 无三角波函数；唯一实现在 `packages/demo/src/hazard.ts:14-19`（I-00 禁止修改 demo） | I-02 若在 contracts 另写一份，与 demo 形成两份实现；共享方式未定 | I02-D2、I02-D6 | `RESOLVED（D2）` |
| A-04 | 图割 hop 参数 | §7 PU 第 4 条要求 hop 采样加倍不变性（`移动-I00.md:101`）；§11 把 `graph.ts`（hop 采样参数化）列为「需单独裁定」（`:167`） | §4 I02-04 功能要求 7 与验收要求（`移动-200.md:164-185`） | `hopSamples` 的 `n=max(6,min(120,ceil(t*60)))` 固定、坐标 `Math.round`（`graph.ts:237,242-243`）；无参数、无加倍对比 API | 不改 `graph.ts` 只能复制采样逻辑；改则触发 I-00 R2 之外的审批形态 | I02-D4、I02-D6、I02-D8 | `RESOLVED（D4；graph.ts 尾参 + 独立增量审批）` |
| A-05 | PU 六条件 | §7 `PROVEN_UNPLAYABLE` 六条同时成立（`移动-I00.md:96-104`） | §5 判定约束表（`移动-200.md:224-245`）；I02-03 / I02-04 功能要求 | 当前无 PU 实现；hazard / 玩家 / graph coverage 恒 `partial`（`profile.ts:97,113`；`graph.ts:97`） | I-02 必须逐条映射；任何修改需独立裁定；coverage 不接线则第 2 条不可满足 | I02-D4 | `RESOLVED（D4；六条件表冻结，2/5 BLOCKED）` |

## B. 取证过程中登记的其余冲突

| ID | 冲突 | I-00 冻结条文 | I-02 需求条文 | 代码事实 / 证据 | 影响 | 裁定票 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B-01 | 入口签名缺 profile / `T_arr` / 预算 / phase | §3.1 输入表含 `FixedRuntimeProfile`、可选 `T_arr`、运动校验（`移动-I00.md:44-58`）；§5.6 `T_arr` 与 U9（`:83`） | I02-01 输入要求含「玩家碰撞体和合法移动范围」「Runtime 所需的碰撞体与边界参数」（`移动-200.md:89-95`） | `TemporalAnalyzer` 入参只有 `config/manifest/lagMs/trustedInput`（`temporal.ts:39-44`）；`temporalScope` 对 Y 轴/多移动返回 `applicable:true`（`:60`） | I-02 无法在现有入口表达完整输入；扩签名会动公共面。D1 已裁定 `T_arr`/phase 不新增入参；profile/预算仍待 D6/D9 | I02-D9、I02-D6 | `PARTIAL（D1）` |
| B-02 | 几何 coverage `partial` vs `checked` | §7.2：参与判定的几何必须 `checked`；hazard 帧几何通过 §3.1 信任链（`移动-I00.md:99`） | I02-03 / I02-04 要求几何可信才可出结论（`移动-200.md:141-185`） | `runtimeEntityGeometry` 不接收 `TrustedAtlasInput`；hazard / 玩家 / graph 恒 `partial`（`profile.ts:97,113`；`graph.ts:97`） | 不接线，PU 第 2 条不可满足；接线可能动 `profile.ts`（I-00「需单独裁定」） | I02-D2、I02-D4、I02-D6 | `OPEN（D4：条件 2 阻塞）` |
| B-03 | `coverage.temporal` 与 evidence 扩展字段 | §3.2 / §8：新增内存内 `coverage.temporal`；`PlayabilityEvidence` 可选 `model/lag/degradation/limits`（`移动-I00.md:59-66,119-126,127-132`） | §8.2：未经单独审批不得修改公共 Contract / 持久化 Verdict（`移动-200.md:320-334`） | `PlayabilityCoverage` 只有 `spatial/mechanic/completion`（`verdict.ts:33-37`）；`PlayabilityEvidence` 无上述字段（`:74-86`） | I-00 要求新增，I-02 默认禁止；归属 I-03 还是 I-02 未定 | I02-D6（边界）、I03（不在本图） | `OPEN` |
| B-04 | 机制层未检查 `coverage.temporal` | §8.3：移动 Hazard 的机制判定必须检查 `coverage.temporal`，非 `checked` ⇒ IE（`移动-I00.md:123`） | §11 把 gap 消解列为 I-03（`移动-200.md:371-380`） | `mechanic.ts:119` 对任一移动 Hazard 无条件 `addGap("moving-hazard-phase")` 并置 `mechanic=partial`；`api.ts:86-92` 顶层 `PU>IE>NB` | 当前移动 Hazard 关卡恒 IE；I-02 结果无法通过机制层出口表达 | I03（出局） | `OPEN` |
| B-05 | 统一 gate ε / 连续求交缺失 | §6.3–6.4：门宽 `R−L>ε`；单一具名常量 `ε=max(1e-9,1e-9×(xMax−xMin))`（`移动-I00.md:89-92`） | I02-01 功能要求 4–7：AABB 语义、epsilon 集中定义、连续时间求交（`移动-200.md:97-107`） | 只有 `ANCHOR_EQUAL_EPSILON=1e-9`（`temporal-input.ts:28,236-237`）；无 gate ε、无连续求交 | I-02 必须新建统一 ε 与解析求交；不得各算法自带容差 | I02-03、I02-D1 | `OPEN`（实验可先行） |
| B-06 | 三角波实现位置 | §11 白名单禁止 `packages/demo/**`（`移动-I00.md:145-168`） | §4 I02-01 要求三角波运动模型（`移动-200.md:97-107`） | 唯一实现在 `packages/demo/src/hazard.ts:14-19`；contracts 无对应函数 | contracts 内实现会与 demo 形成两份；共享方式需裁定 | I02-D2、I02-D6 | `PARTIAL（D2）` |
| B-07 | 预算常量与计数/超时缺失 | §12：默认 `maxStates=500_000`、`timeBudgetMs=2_000`，硬 1M/10s；超限逐层降级（`移动-I00.md:169-175`） | I02-05：预算、计量口径、网格规则、超限 IE（`移动-200.md:186-223`） | `temporal.ts` 只有两个 lag 常量；无 `maxStates/timeBudgetMs`/计数/超时路径（`completion.ts:69` 的 `EDGE_BUDGET` 不是时序预算） | I-02 必须新建预算机制；终值需性能证据 | I02-05、I02-D5 | `RESOLVED（D5；maxCutsPerBranch 待 D5B）` |
| B-08 | 架构测试把生产 `analyze` 钉死为 stub | §11：`playability-*.test.ts` 只增不改（`移动-I00.md:157`）；不得删除/放宽断言（`:184`） | §8.2：不得提前完成 I-03 生产接入（`移动-200.md:320-334`） | T-58 / T-61（`playability-temporal-input.test.ts:589-596,612-615`）要求生产 `analyze` 只能是 `stubTemporalAnalyzer`；`ops.ts:1039` 符合 | I-02 真实分析器不能替换防产 stub；I-03 接线时若改该断言，与「只增不改」张力 | I02-D6、I02-D9 | `OPEN` |
| B-09 | `TemporalAuditResult` 装不下 witness / proof / stats | §9：`PlayabilityEvidence` 加法 `model/lag/degradation/limits`（`移动-I00.md:127-132`） | I02-02 / I02-03 / I02-05：每段路径起止状态与时间、诊断信息（`移动-200.md:116-140,186-223`） | `TemporalAuditResult` 只有 `applicable/verdict/degradation`（`temporal.ts:31-37`）；无 stats/proof/witness 出口 | 内部结果只能藏闭包或另建类型；经 `api.ts` 转出会扩大公共面 | I02-D9 | `OPEN` |
| B-10 | Phaser overlap 直接证据缺失 | §6.1：相切与 `overlapsStrict` 同义；须由 I-01 补 Phaser overlap 直接证据（`移动-I00.md:87`） | I02-01 功能要求 5：AABB 相交语义固定（`移动-200.md:97-107`） | I-01 代码/测试无该证据；`verifyTemporalInput` 只验 Atlas JSON 元数据，不验 PNG/运行时碰撞体（`01-code-facts.md` C-11） | 若证据推翻 strict，改的是 Runtime 语义基线，不是 I-02 epsilon | I02-06、I02-D1、I02-D3 | `已核对（strict 未被推翻）` |
| B-11 | `localeCompare` 与跨环境确定性 | §5 / §12 要求确定性结果（`移动-I00.md:76-84,169-175`） | I02-05 功能要求 7 / AC-10：相同输入重复运行结果确定（`移动-200.md:199-222,335-356`） | `temporalScope` 与失败/文件排序用无显式 locale 的 `localeCompare`（`temporal.ts:63`；`temporal-input.ts:96,150,277`） | 通常只影响诊断顺序，不直接改 verdict；确定性口径需显式覆盖 | I02-D5 | `PARTIAL（D5）` |
| B-12 | P0 `verticalEvasionImpossible` | §7 / 禁止：调用方标记一律不接受（`移动-I00.md:100-102,113-117`） | §5：无法排除垂直规避 ⇒ IE；PU 必须结合图割（`移动-200.md:224-245`） | `TemporalAnalyzer` 无 assumptions 参数，与 I-00 一致；但 P0 原型与 B 案例仍以该声明为 PU 前提（`.scratch/level-playability-v1.1-p0/prototype/MODEL.md:86`） | I-02 不能复用 P0 的 B 结论；必须图割 | I02-D4 | `RESOLVED（D4：图割替代，P0 声明不复用）` |
| B-13 | I-02 §8.2 与 I-03 gap 消解边界 | §8.3 / §14：I-03 负责 gap 消解、`coverage.temporal`、顶层优先级（`移动-I00.md:123,200`） | §8.2 禁止改 V1 既定语义 / 禁止接入最终 Verdict；§11 把 gap 消解列为 I-03（`移动-200.md:320-334,371-380`） | `mechanic.ts:119` 与 `api.ts:86-92` 是当前 V1 语义；I-02 不能改 | I-02 算法结果只能停在内部；I-03 前无法通过 Verdict 出口表达 | I03（出局） | `OPEN` |
| B-14 | 网格约束一致性 | §6.5：`N≥2`、`N≤floor(maxSpeed×periodMs/xStep)`（`移动-I00.md:91`） | §4 I02-05 网格约束：同式（`移动-200.md:212-223`） | 两处条文一致；B1 证据已证明方向 | **条文一致，无需裁定**；实现细节归 D5 | I02-D5 | `已核对（一致）` |
| B-15 | 双档 lag 比较口径 | §5.3–5.4：两档 16.67/200，结论不一致 ⇒ IE（`移动-I00.md:80-84`） | §6.4：两档分别完整分析，不一致 ⇒ IE，不允许只留乐观档（`移动-200.md:288-294`） | I-01 `resolveTwoLagResults` 只比 `verdict`，`lag-invalid` 优先（`temporal.ts:107-115`）；结果形状无 witness/proof | 条文一致；「只比 verdict」是否足以承载 I-02 的量化结论，待 D5/D9。D1 已固定 lag 方向并确认 NB/PU 分支独立 | I02-D5、I02-D9 | `PARTIAL（D1/D5）` |
| B-16 | NB 与 PU 是否共用一条搜索链 | §7：PU 由六条件独立判定；NB 由连续时间 witness（`移动-I00.md:96-107`） | §5 判定约束表（`移动-200.md:224-245`）；I02-05 §5「部分搜索结果不得提升」 | 当前无实现；P0 先证明门区、再搜索 witness（`temporal-model.mjs:383-397`） | 若把「搜不到 witness」或 witness 预算耗尽量成 PU，会产出错误 PU | I02-D1 | `RESOLVED（D1）`：NB 与 PU 是独立证明分支；PU 不依赖 Witness 搜索完成；无 witness 永不参与 PU |
| B-17 | U9 的必要性 | §4.4 / §5.6：U9 是相位自由的前提；`T_arr` 不可确定且 U9 不成立 ⇒ IE（`移动-I00.md:73,83`） | §5：无法证明安全通过 ⇒ IE；I02-05 预算与降级（`移动-200.md:224-245,186-223`） | 当前无 U9 实现；P0 要求 `certainty.phase = known`（`temporal-model.mjs:363`） | 若 U9 被当成 NB 的必要条件，会拒绝全相位 Winning Set 已证明的关卡；若被忽略，会丢掉 I-00 的 canonical 证书 | I02-D1、I02-D10 | `RESOLVED（D1，操作性澄清）`：U9 仍是 canonical 充分证书；`∀φ0` Winning Set 是另一充分证书；不改 U9 定义、不放宽 PU |

## C. 登记状态统计

| 状态 | 数量 | 条目 |
| --- | ---: | --- |
| `OPEN`（待裁定） | 5 | B-02（D4：条件 2 阻塞）、B-03、B-05、B-08、B-09 |
| `PARTIAL`（D1/D2/D5 部分裁定） | 4 | B-01（D1）、B-06（D2）、B-11（D5）、B-15（D1/D5） |
| `RESOLVED`（D1/D2/D4/D5） | 9 | A-01～A-05、B-07（D5；数值待 D5B）、B-12、B-16、B-17 |
| `OPEN`（出局到 I-03） | 2 | B-04、B-13（I-03 范围，本图不裁定） |
| `已核对（一致 / 未被推翻）` | 2 | B-14（网格约束）、B-10（Phaser overlap：strict 未被推翻） |

> 统计以条目当前状态为准；裁定票关闭后由 [I02-AUTH](../issues/16-i02-auth-package.md) 汇总更新。

## D. 未登记但需在授权包中说明的边界

- I-02 §1 对 I-01 的描述（`移动-200.md:17-24`）比 I-01 实际保证宽：I-01 只验 Atlas JSON 元数据，不含 PNG / manifest / Runtime hitbox；已在 B-10 与 C-11 登记，授权包不得把它写成「Runtime hitbox 已证明」。
- I-02 §12 要求新的实施授权包（`移动-200.md:381-394`）；I-00 R2 已批准「分阶段放行」。两者不是同一层：前者是新的授权形态，后者是白名单与阶段纪律。授权包必须同时引用，不得把 R2 当成 I-02 的授权。
- I-02 §10 的两个强制复核点（I02-01 后、I02-02 后）与用户 2026-11-10 的 R1/R2 一致；具体通过条件归 I02-D8。
- I-02 §2.2 非目标（`移动-200.md:48-59`）与 I-00 §13 非目标基本一致；新增的「不新增第三方算法依赖」归 I02-D6。
- Phaser overlap 直接证据已补齐（[I02-06](../issues/19-i02-06-phaser-overlap.md)）：Phaser 3.90.0 矩形 AABB 为严格不等号，相切不算撞，`strict` 未被推翻；它证明的是**谓词语义**，不证明 runtime hitbox equality（后者仍属 C-11 / B-02）。
- D1 的 U9 操作性澄清（2026-11-10）：U9 仍是 I-00 的 canonical 充分证书；I-02 新增 `∀φ0` Winning Set 作为另一独立充分证书；两者任一成立即可支持 NB；**不改变 U9 定义、不放宽任何 PU 条件**。授权包必须原样引用，不得把 I-00 原文改写成「U9 非必要」。

## E. 复现

```bash
cd /Volumes/shy/some-projects/game-maker
shasum -a 256 docs/v7.8/移动-200.md docs/v7.8/移动-I00.md
grep -n "相位当自由变量\|全部参与判定的几何\|hop 采样加倍\|需单独裁定" docs/v7.8/移动-I00.md
grep -n "运动区间、速度\|hop 采样加倍\|N ≥ 2\|实施授权" docs/v7.8/移动-200.md
```
