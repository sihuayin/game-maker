# PU-C5 空中控制证据生产 brief

Type: grilling
Status: open
Owner: —
Blocked by: 02
Map: ../map.md
Class: V1.1-CLOSURE / UNIT-BRIEF

## Question

把已冻结的 PU 条件 5 合同（`I03-PU-Air-Control-Closure`）落成可授权、可复核的证据生产 brief。条件是**只产出证据**：条件 5 在 PASS + 用户签署前恒 `BLOCKED`，`PUBLIC_PU` 不变（Q9=A）。

必须裁定：

1. **执行方式**：`.scratch` 内 Phaser 探针 + 只读源码证据 + 负向测试；不修改 Runtime / `reach.ts` / `scene.ts` / `profile.ts` / `graph.ts`；不新增依赖。
2. **C1–C17 矩阵**：逐项定义输入、期望、证据形式（E1/E2/E3）、PASS / FAIL / INSUFFICIENT_EVIDENCE / NOT_RUN 判定；哪些已由现有证据覆盖，哪些要新产出。
3. **证明义务**：A 垂直包容（用冻结 `jumpVelocity` / `gravity` 算 `maxJumpHeight`）与 B 保守弧线扫掠；C 运行时探针只作支持证据，不得单独证明。
4. **探针与夹具**：探针落点、运行环境、逐帧采样内容、两次重跑一致性、跨环境处理；是否复用 P1 的 `geometry-probe` 夹具或需要新夹具（新夹具需说明为何不违反「不新建产品 fixture」）。
5. **证据 / 复核**：E1/E2/E3 路径、`SHA256SUMS`、fresh 独立复核、用户签署；条件 5 的 gate 行如何记录（仍 BLOCKED，直到签署后由 PU-ADMIT 消费）。
6. **STOP**：用 `midAirHits=0` / conditional 图割 / NB 结果替代条件 5；修改 Runtime；新增依赖；探针不可复现。

产出：PU-C5 unit brief；不实现探针、不跑证据。
