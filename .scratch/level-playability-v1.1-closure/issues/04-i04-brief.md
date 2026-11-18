# I-04 负向与回归验收 brief

Type: grilling
Status: open
Owner: —
Blocked by: 01, 02
Map: ../map.md
Class: V1.1-CLOSURE / UNIT-BRIEF

## Question

冻结 I-04 的可执行范围与验收判据。I-04 是**验收/证据阶段**，不新增算法（Q4=A）。

必须裁定：

1. **范围**：G-01～G-07 硬门槛负向矩阵、伪造几何 / 未知相位 / 错误 lag 拒绝案例、V1 完整回归、确定性 / 重复执行、19 个 moving-hazard config 无误拒。逐项对应到 `01-coverage-inventory` 的差集。
   - **依赖**：G-01 的真实帧几何 ↔ Runtime body 证据依赖 P2/P3/P6；I-04 只消费 P6 签署证据，若 P3/P6 未闭合则该项 `NOT_RUN`，不得用 P1 夹具替代。
   - **未测分支**：G-03 页面暂停 / 后台 RAF（U1 未解除）、G-05 moving platform / danger strike 的 `model-out` 分支无直接测试；裁定补测试、接受已知限制还是 STOP。
2. **回归口径**：既有 vitest 全绿 + LP-06/07 原样 scratch 复跑；LP-06/07 不转 vitest，缺口如何写入已知限制（Q7=A）。
3. **19 关无误拒**：用哪个脚本 / 命令跑 19 个 config；如何定义「误拒」；出现任一假阳时是 STOP、回滚该关卡类别还是修算法（I-04 不允许新增算法 ⇒ 只能 STOP/HITL）。
4. **测试与白名单**：I-04 是否允许新增测试文件（只增不改）？允许改哪些路径？是否允许新增 scratch 脚本/证据？产品代码是否零改动？
5. **证据与复核**：证据落点、复核报告路径、fresh reviewer 标准、逐项 `PASS / FAIL / NOT_RUN`、退出码 / 整体状态定义。
6. **与 P7 的关系**：I-04 消费 P7 的 AC-01～AC-21 报告，还是重跑全部 AC？如何避免重复证据与混基线。

产出：I-04 unit brief；不实施、不跑验收。
