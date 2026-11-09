# I00-07 七项硬门槛验证矩阵

Type: task
Status: resolved
Owner: agent（AFK）· 2026-11-09
Blocked by: 02, 03, 04, 05, 06, 07, 08
Map: ../map.md
Class: I-00 / DELIVERABLE

## Question

把 G-01～G-07 逐条转成**可执行**的验证项，使 I-04 的负向验收有判据，而不是一句「已满足」。

### 每项门槛必须给出

- 判据（可机器检查的条件）。
- 证据类型（E1 / E2 / E3）。
- **正例**：满足门槛时应得到什么结论。
- **负例**：伪造 / 缺失 / 不一致时应落什么状态（绝大多数应为 `INSUFFICIENT_EVIDENCE`）。
- 测试落点：`packages/contracts/tests/` 单测、`packages/pipeline/tests/` 集成、还是 scratch 取证。
- 在 I-01～I-05 中的位置。
- 若当前架构无法满足：显式标 **BLOCKED**，附阻塞原因，转 HITL 裁定（不得写成「尽量满足」）。

### 已知的阻塞点（必须出现在矩阵里）

- **G-01**：无逐帧几何传递通道（见 [I00-02](03-i00-02-asset-geometry-provenance.md)）。
- **G-02**：无 `lagMs` 入口（见 [I00-04](05-i00-04-lagms-source.md)）。
- **G-03**：无 phase 字段、U1/U8 未确认（见 [I00-03](04-i00-03-hazard-phase-time-origin.md)）。
- **G-04**：`verticalEvasionImpossible` 目前是调用方假设（见 [I00-10](08-i00-10-vertical-evasion-proof.md)）。

### 产出

`evidence/07-gate-matrix.md`（表格 + 每项一段说明）。**不写测试代码。**

### 验收

七项门槛无一遗漏；每项都有负例；BLOCKED 项都有对应裁定路径。

## Answer

矩阵已产出：[`evidence/07-gate-matrix.md`](../evidence/07-gate-matrix.md)（221 行，逐项含判据 / 现状 / 正例 / 负例 / 测试落点 / I-0x 落位 / 状态）。

**速览**

| 门槛 | 状态 | 阻塞点 |
| --- | --- | --- |
| G-01 Hitbox 来源 | BLOCKED | manifest 无逐帧几何；acceptance 无生产消费者；anchor 比对条件式 |
| G-02 Lag 来源 | BLOCKED | auditor 无任何可达 lag 输入 |
| G-03 时间行为 | NEEDS-RULING | 「相位未知 ⇒ IE」与「`T_arr` 相位不可确定」的映射 |
| G-04 垂直规避 | NEEDS-RULING | 图割可行，但依赖 G-01 的几何可信度 |
| G-05 模型边界 | SATISFIABLE | — |
| G-06 判定语义 | BLOCKED | 现有聚合无法表达 partial 约束；全局 `partial ⇒ IE` 不可行 |
| G-07 独立验收 | SATISFIABLE | 「可审计证据」无持久化落点，待 R1 裁 |

**三条硬结论**

1. 全局「`coverage = partial` ⇒ IE」不可行：`coverage.spatial` 在 39/39 fixture 恒 partial，执行该规则会让 `NO_PROVEN_BLOCKER` 不可达并推翻 9 个既有用例。约束必须**按维度**设计。
2. G-01 / G-02 是**数据通道缺失**，不是待办事项；任何解法都要动公共输入面。
3. G-04 以「全部参与判定的几何 `checked`」为前提；G-01 不成立时 G-04 自动不成立 ⇒ `PROVEN_UNPLAYABLE` 不可达。

依赖：`G-01 → G-04 → G-06`、`G-03 → G-06`、`G-02 → G-06`、全部 → `G-07`。七项门槛的负例全部进 I-04；BLOCKED 项未解时 R3 只能出「阻塞 / 改 PRD / 缩范围 / 停」。
