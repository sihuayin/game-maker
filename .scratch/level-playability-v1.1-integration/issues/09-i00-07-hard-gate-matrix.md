# I00-07 七项硬门槛验证矩阵

Type: task
Status: claimed
Owner: —
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
