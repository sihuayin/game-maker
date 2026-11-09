# I00-05 连续时间边界与数值容差

Type: grilling
Status: open
Owner: —
Blocked by: 01
Map: ../map.md
Class: I-00 / DECISION

## Question

连续时间求交的边界与容差必须冻结，否则同一关卡会因为网格 / 浮点差异给出不同结论。P0 原型用 `dt = periodMs / N`（`dt=20ms`）、`maxStepPx=3.2`、严格 AABB（相切不算碰撞）、折返点切段后解析求交。

### 必须裁定

1. **相切算不算碰撞**：`overlapsStrict` 与 `overlapsInclusive`（`packages/contracts/src/playability/geometry.ts`）在时序路径上分别用于什么；边界接触的语义。保持与 V1 一致还是另立规则。
2. **正宽度门的最小宽度**：P0 用 `L < R`（严格）。是否引入最小宽度阈值（例如 ≥ 1px 或 ≥ 玩家半宽）？阈值过大会制造假 IE。
3. **浮点容差**：比较用绝对容差、相对容差还是整数化坐标？在什么量级上会不稳定。
4. **网格与步长**：`xStep` / `phaseSteps` 是否进入契约（可配置）还是固定；它们与 `periodMs`、`distance`、`maxSpeed` 的关系；结论对步长的稳定性如何测试。
5. **数值稳定性测试**：如何证明「步长减半不改变结论」（在什么容差内），以及这种测试放在哪一层。

### 产出

裁定记录（本票 `## Answer`）+ 一份可执行的稳定性测试设计（不写生产测试）。可在 `scripts/` 内用 P0 模型做敏感性试算。

### 下游

作为 [I00-R1](10-i00-r1-contract-freeze.md) 的输入。
