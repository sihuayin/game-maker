# PU-ADMIT 六条件准入验收 brief

Type: grilling
Status: open
Owner: —
Blocked by: 02, 06, 10
Map: ../map.md
Class: V1.1-CLOSURE / UNIT-BRIEF

## Question

冻结 PU-ADMIT 的六条件准入验收。它只判定「是否具备 `ADMITTED` 资格」，不改变 PU gate（Q9=A）。

必须裁定：

1. **六条件来源**：条件 1/3/4/6 消费 U5 的 PASS 证据，但 `01-coverage-inventory` 证明它们只在**合成 `PU_WORLD`** 上 PASS；条件 2 消费 P6 的几何证据（hazard/player/graph checked）；条件 5 消费 PU-C5 的签署证据。必须裁定「合成世界 PASS」是否足以作为 `ADMITTED` 资格的正向证据，还是必须真实关卡证据（若后者，与 `10-i05-temporal-fixtures` 联动）。逐项定义「什么算 PASS」与证据 hash。
2. **不重复实现**：PU-ADMIT 不重新跑 P2/P3/P6/PU-C5，只做消费、逐项核对与准入判定；若证据缺 hash / 未签署 / 环境不匹配 ⇒ `NOT_RUN` / `IE`，不得伪造 PASS。
3. **准入判定**：六项全部 PASS ⇒ `ADMITTED-eligibility = true`；任一项非 PASS ⇒ false；不使用总分/加权/通过率。输出形态（报告 / JSON / 只读汇总）与落点。
4. **gate 边界**：`PUBLIC_PU` 仍 `BLOCKED`；不修改 `public-verdict` / `capability-gate`；资格 ≠ ADMITTED ≠ OPEN。
5. **与 P7 / AC-11 的关系**：P7 的 AC-11 是非 required `NOT_RUN`；PU-ADMIT 是否更新 AC-11、如何记录、是否影响 P7 的 19 条 required 结论。
6. **证据 / 复核**：报告路径、fresh 独立复核、用户签署、STOP 条件。

产出：PU-ADMIT unit brief；不实施、不判定任何真实关卡。
