# I-04 负向与回归验收 brief

Type: grilling
Status: resolved
Owner: claude (wayfinder session 2026-11-18)
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

## Answer

**Q1–Q8 = 用户裁定（2026-11-18，全部采纳）。** I-04 性质正式定为：**受限测试补齐 + 只读验收扫描 + 独立复核**——允许新增测试证明已有行为，不允许修改被测行为来让验收通过。

交付：

- [`reports/I04-brief.md`](../reports/I04-brief.md) @ `sha256:94c7677d888ace785418e00592343c22115adf8592064ae4fb2d3d4fa30c9644`（162 行，冻结；I-04 仍 `NOT_AUTHORIZED`）。
- `docs/v7.8/移动-收口.md` §4 已由占位改为 I-04 授权面。

| # | 冻结 |
| --- | --- |
| Q1 | 只增测试 + scratch 扫描脚本；白名单逐文件（两个新测试文件、`i04-publish-gate-scan.mjs`、`evidence/i04/**`、`reports/I04-*`）；禁止改产品源码 / 既有测试 / fixtures / 已签署文档 / Lockfile / tsconfig |
| Q2 | G-01 正向交叉核对标 `NOT_RUN / deferred to P3+P6`，不计入 I-04 required；报告首页必须列出，unit PASS ≠ G-01 已闭合 |
| Q3 | G-03 接受为明确支持范围（相位自由 + U9；页面隐藏 / 暂停 / 后台 RAF 不在支持范围）+ 具名 `unknown-phase` 负例 |
| Q4 | 新增 moving platform 与 danger `strike` 两个 `model-out` 直接测试（IE + `model-out`） |
| Q5 | 19 关双层扫描：L1 全 16 config / 19 mover（temporal 全 IE + 静态 verdict 对齐 LP-06 基线）；L2 有 qa-report + pack 子集跑 `assertPublishableQa`；缺 qa-report 记 L2 未覆盖 |
| Q6 | 回归基线 = 单元切出时 `main`；LP-06/07 在干净临时 worktree 原样复跑；主工作树零污染；LP-06/07 非 CI 写入已知限制 |
| Q7 | 逐项 `PASS / FAIL / NOT_RUN`；单元 `PASS / INCOMPLETE / FAIL`；退出码 0 / 1 / 2；不消费 P7、不把 I-03 AC 当 I-04 PASS |
| Q8 | 证据 `evidence/i04/`；报告 / 复核 / 签署 `reports/I04-acceptance.md` / `I04-review.md` / `I04-signature.md`；fresh reviewer 复算 L1 + 抽查 3 个负例 + 核对 diff 与白名单 |

**Deferred（报告首页列出）**：G-01 正向交叉核对（P2/P3/P6）、G-04 正向闭合（PU-C5）、AC-10 / AC-12 / AC-14（Phase-2）。

**未做**：未实施 I-04、未跑验收、未新增测试、未改产品代码。**下游**：前沿 = `06-pu-c5-brief` / `10-i05-temporal-fixtures`；`05` 仍等 `04`（已 resolved）+ `10`，`07` 仍等 `06` + `10`。
