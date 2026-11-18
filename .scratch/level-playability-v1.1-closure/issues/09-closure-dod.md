# V1.1 Closure DoD 追溯矩阵

Type: grilling
Status: resolved
Owner: claude (wayfinder session 2026-11-18)
Blocked by: 01, 04, 05, 06, 07, 11
Map: ../map.md
Class: V1.1-CLOSURE / DECISION

## Question

把 PRD 的 Definition of Done 与七项硬门槛映射到 4 个单元、证据与验收，冻结 V1.1 closure 的判定方式与最终能力声明边界。

必须裁定：

1. **DoD 逐项映射**：PRD §12 的 10 个 checkbox（I-00～I-05、七项硬门槛、A/B/C、补充正向/负向/边界、V1 回归、模型外降级、证据可解释/复现/审计、Pipeline 真实流程、修改范围与授权一致、最终报告）→ 单元 / 证据 / 验收。
2. **七项硬门槛**：G-01～G-07 逐项映射到 I-01～I-05 的哪些证据；哪些由 P7 覆盖、哪些由 I-04/I-05/PU-ADMIT 补。
3. **状态定义**：closure `PASS / FAIL / INCOMPLETE` 的判定；逐项不得用通过率；required / supporting 的区分。
4. **能力声明**：最终声明必须限定为单 X 轴 moving hazard 的受限时序分析；不得宣称通用动态障碍物；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED` 如何写进声明。
5. **最终报告**：Closure DoD 矩阵在 `.scratch/level-playability-v1.1-closure/reports/V1.1-closure.md` 中的位置与签名；与 I-05 报告的关系。
6. **残余风险**：LP-06/07 非 vitest、PU 资格未开放、公共 gate BLOCKED、模型外边界等如何披露。

产出：Closure DoD 追溯矩阵 + 状态规则；不判定任何证据为 PASS。

## Answer

**Q1–Q8 采纳；三处修正已定稿（2026-11-18）：Q3 增加 `FAIL` 优先级与 FIX 唯一例外；Q5 第 3 项证据只认 I-02 + I-04；Q8 增加 R9。** 交付：DoD 追溯矩阵（10 项）、七门槛矩阵、状态规则、能力声明、报告结构、R1–R9；`移动-收口.md` §11 已由占位改为矩阵。包仍 `UNSIGNED`，5 个单元仍 `NOT_AUTHORIZED`。

### 1. DoD 追溯矩阵（10 项，全部 required）

| # | PRD DoD 项 | 判定对象 | required 证据 | 单元 |
| --- | --- | --- | --- | --- |
| D1 | I-00–I-05 全部完成并有审查记录 | **P7 签署 `PASS`** ∧ I-04 / I-05 签署 | I-03 验收报告（现 `INCOMPLETE`）→ P4/P5/P6 关闭 AC-10/12/14；P7 报告 hash；I-04 / I-05 签署 | P2–P7（外部前置）+ I-04 + I-05 |
| D2 | 七项生产集成硬门槛全部通过 | G-01–G-07 逐项 `PASS`，不留 `NOT_RUN` | 见 §2 七门槛矩阵 | P2 / P3 / PU-C5 / I-04 / I-05 |
| D3 | A/B/C 核心案例全部通过 | **判定核心层**：A ⇒ `nb-candidate`、B ⇒ `pu-candidate`、C ⇒ `insufficient-evidence` | `playability-temporal.test.ts` A/B/C；I-04 负向矩阵；**FIX 不引用** | I-02 + I-04 |
| D4 | 补充正向、负向和边界测试全部通过 | PRD §7.1 四组 + 三重点负例全 `PASS` | I-01 / I-02 既有测试；I-04 acceptance 逐项矩阵（伪造几何 / 未知相位 / 错误 lag） | I-01 / I-02 / I-04 |
| D5 | V1 既有静态审计回归通过 | 既有 vitest 全绿 + LP-06/07 原样 scratch 复跑一致 | I-04 acceptance（自有基线，不采信 I-03 报告） | I-04 |
| D6 | 未支持模型输入全部正确降级 | y 轴 / 多 Hazard / 非 cycle / moving platform / danger strike ⇒ IE | I-02 `model-out` 测试；I-04 新增两项直接测试 | I-02 / I-04 |
| D7 | 结果证据可解释、可复现、可审计 | `SHA256SUMS` + 两次零容差 + fresh 复核 + Ledger | 各单元 `evidence/<unit>/` + `reports/<UNIT>-review.md` | 全部收口单元 |
| D8 | Pipeline 真实流程验收通过 | 真实流程中时序诊断存在、可追溯、不改变放行；判定字段 = `publish-gate` 内部 `witness.result` | FIX 三案例 + `last-train` 冒烟；I-05 5A 报告；公共 verdict 仍 IE 必须披露 | FIX + I-05 |
| D9 | 修改范围与授权记录一致 | 每单元白名单逐项比对 `PASS` + Ledger 行闭合 | 各单元 review 的 `git diff --stat` / 文件清单；P7 对 P2–P7 的验收 | 全部单元（含 P2–P7 外部前置） |
| D10 | 最终报告明确支持范围、限制和残余风险 | `V1.1-closure.md` 含 §1 支持范围 / §5 残余风险 / §6 能力声明并签署 | `V1.1-closure-signature.md` | I-05 5B |

**项状态**：required 证据全 `PASS` ⇒ `PASS`；任一 required 证据 `FAIL` ⇒ `FAIL`；其余（含 `NOT_RUN` / 未签署）⇒ `NOT_RUN`。supporting 证据只加注，不改变判定。禁止通过率 / 加权。

**证据引用规则**：每行带「单元 + 证据路径 + SHA-256 + 签署或 Ledger 行」；未签署证据只能记 `NOT_RUN`；P2–P7 证据必须带 P7 报告 hash；同一证据可作多行 supporting，但只计入一个 required 结论。

### 2. 七项硬门槛矩阵

| 门槛 | 判定对象 | required 证据 | 单元 | 当前 |
| --- | --- | --- | --- | --- |
| G-01 Hitbox 来源可信 | 真实 pack 帧几何 ↔ 运行时 body 的交叉核对 | P2 探针 + P3 独立复核签署；P6 消费 | P2 / P3 / P6 | `PARTIAL` |
| G-02 Lag 来源明确 | 显式 / 可审计；两档；非法 / 缺省 / 不一致 ⇒ IE | I-01 `playability-temporal-input.test.ts` T-37–T-45 / T-63 | I-01 | `PASS` |
| G-03 时间行为确定 | 相位自由 + U9；不得墙钟判据 | I-02 U9 测试 + I-04 具名 `unknown-phase` 负例 | I-02 / I-04 | `PARTIAL` |
| G-04 垂直规避有真实证据 | 不以调用方声明代替证明；不能证明 ⇒ 不得 PU | PU-C5 条件 5 A/B 证明 + fresh 复核 + 签署 | PU-C5 | `PARTIAL` |
| G-05 运动模型边界严格 | 模型外必须降级、不得近似 | I-02 `model-out` + I-04 moving platform / danger strike 直接测试 | I-02 / I-04 | `PARTIAL` |
| G-06 判定语义受限 | V1 三态；IE 不提升；NB 不当 PU | I-03 / contracts 既有测试 + N1–N12 | I-03 | `PASS` |
| G-07 生产集成独立验收 | 独立测试 / 审查 / V1 回归 / 构建打包 / 可审计 | I-04 acceptance + I-05 5A + 各单元 fresh 复核 | I-04 / I-05 | `PARTIAL` |

D2 只有在 G-01–G-07 全部 `PASS` 后才可勾；任一 `PARTIAL` / `NOT_RUN` ⇒ D2 `NOT_RUN`。

### 3. closure 状态规则（含 Q3 优先级例外）

- **`PASS`** = D1–D10 全 `PASS` ∧ 5 个收口单元全 `PASS` ∧ P7 `PASS`。
- **`FAIL`** = 任一**非 FIX** 收口单元 `FAIL`，或任一 required DoD 证据 `FAIL`。
- **`INCOMPLETE`** = 其余全部情形（`NOT_RUN`、`INFEASIBLE`、未签署、P7 未跑）。
- **优先级**：`FAIL` > `INCOMPLETE` > `PASS`；同时满足 `FAIL` 与 `INCOMPLETE` 条件时判 `FAIL`。
- **FIX 唯一例外**：FIX 的 `FAIL` / `INFEASIBLE` 只降为 `INCOMPLETE`，且仅在无其他 `FAIL` 时生效。
- **PU-ADMIT `eligible=false` 不是失败**：G-04 由 PU-C5 条件 5 关闭，不由 `ADMITTED` 资格关闭；能力声明不宣称 `ADMITTED`。

### 4. 能力声明（逐字，报告 §6 不得改写）

> 系统能够在可信输入和确定性运动假设成立的条件下，对单个沿 X 轴运动的 Hazard 进行受限时序可达性分析，并对安全窗口、正宽度永久封锁及证据不足作出符合既有三态语义的判断。

五条限定（缺一不可）：

1. 支持范围仅限单个 `cycle` / `axis:"x"` mover，且相位自由 + U9 成立；页面暂停 / 后台 RAF 不在支持范围。
2. 公共能力未开放：`PUBLIC_NB` / `PUBLIC_PU` = `BLOCKED`，`publicCapability="BLOCKED"`，`publicResult=null`；真实 Pipeline 的公共 verdict 仍为 IE；内部候选不是公共结论。
3. 不宣称通用动态障碍物、多 Hazard、移动平台、跳跃 / 下落 / 重力时序。
4. `NO_PROVEN_BLOCKER` 不是绝对可玩保证；`INSUFFICIENT_EVIDENCE` 不得提升。
5. 不宣称 PU `ADMITTED` 资格；资格 ≠ `ADMITTED` ≠ `OPEN`。

### 5. 最终报告结构与签署

`reports/V1.1-closure.md` 固定八节：§0 摘要与三态结论；§1 支持范围与非目标；§2 DoD 追溯矩阵（D1–D10）；§3 七项硬门槛矩阵；§4 单元结果与证据索引（5 个收口单元 + P2–P7 引用）；§5 残余风险（R1–R9）；§6 能力声明（逐字）；§7 签署与不可变性。

签署 `reports/V1.1-closure-signature.md`，用户签署；报告是 **I-05 的 5B 交付物**，只占 I-05 一行 Ledger，不另立行；签署后只可 addendum。票面「4 个单元」按 5 个执行。

### 6. 残余风险（R1–R9）

| # | 风险 | 披露要求 |
| --- | --- | --- |
| R1 | LP-06/07 非 vitest、不在 CI | 报告 §5 与 D5 行注明「原样 scratch 复跑」 |
| R2 | 公共 gate `BLOCKED`、公共 verdict 恒 IE | 报告 §5 与 §6 限定 2；内部候选不得写成公共结论 |
| R3 | PU `ADMITTED` 资格预期 `false`（§9.4 夹具门 `UNMET`） | 报告 §5；注明资格 ≠ `ADMITTED` ≠ `OPEN` |
| R4 | G-01 正向交叉核对依赖 P3 / P6，未签则 `NOT_RUN` | D2 行注明 deferred；不得用 I-04 负向结果替代 |
| R5 | 页面暂停 / 后台 RAF / 隐藏页时间行为不在支持范围（U1） | 报告 §1 / §5 |
| R6 | 模型外：多 Hazard / moving platform / y 轴 / danger strike / 跳跃下落重力 | 报告 §1 非目标 |
| R7 | FIX 不可行 ⇒ 时序能力未在真实关卡验证，closure `INCOMPLETE` | 报告 §5；DoD D8 保持 `NOT_RUN` |
| R8 | `acceptance-run2/` 不可复算 | I-05 不引用；报告 §5 注明 |
| R9 | **Phase-2 / P7 依赖**：P7 与 P2–P6 未签署 ⇒ D1 / D2 `NOT_RUN`，closure 最高 `INCOMPLETE`；收口包不能替代 Phase-2 验收 | 报告 §5；D1 / D2 行引用 P7 报告 hash |

### 7. 包与当前状态

- `移动-收口.md` §11 已由占位改为 D1–D10 矩阵 + 状态规则 + 指针；包 hash `baa2fce597a9da5ad249048154bab392ee48af3334ec5b6492dffd95d4bd8820`（UNSIGNED；§14 待签）。
- 当前所有 DoD 项为 `NOT_RUN`：5 个单元未授权、P2–P7 未完成。本票只冻结判定方式，不预填结果。

### 8. 未做与下游

未执行任何单元、未跑 probe / 测试、未改产品代码、未签署任何授权。地图 11 张票全部 resolved，destination（可签的收口执行计划 + `移动-收口.md` 总授权包）已达成；后续执行归各单元独立授权会话。
