# 存量覆盖盘点：I-04 / I-05 / PU 条件 2/5 的证据差集

Type: research
Status: resolved
Owner: research-subagent (2026-11-18)
Blocked by: —
Map: ../map.md
Class: V1.1-CLOSURE / RESEARCH

## Question

盘点仓库现有的测试、证据、语料与已签署验收记录，回答「I-04 / I-05 / PU-ADMIT 还缺什么证据」，而不是重新实现或重跑全部测试。

必须产出：

1. **I-04 差集**：逐项列出 G-01～G-07 硬门槛的负向测试、伪造几何 / 未知相位 / 错误 lag 拒绝案例、V1 完整回归（既有 vitest + LP-06/07 scratch）、确定性 / 重复执行、19 个 moving-hazard config 无误拒，各自「已有证据（file:line / test name / evidence path）」与「缺口」。
2. **I-05 差集**：现有 21 configs / 19 moving hazards 中，哪些可作 NB / PU / IE 真实案例；Pipeline 验收所需的 `create` / `build` / `publish-gate` / `qa-report` 证据哪些已存在、哪些缺失；最终报告需要哪些输入。
3. **PU 条件 2/5 差集**：U5 六条件中 1/3/4/6 的 PASS 证据位置；条件 2 依赖的 P3/P6 证据现状；条件 5 的 C1–C17 矩阵在现有源码 / 测试中已覆盖哪些、缺哪些。
4. **候选 evidence 路径**：给每个缺口建议落点（I-04 / I-05 / PU-C5 / PU-ADMIT），但不做范围裁定。

可读来源（至少覆盖）：

- `docs/v7.8/移动.md`（PRD I-04/I-05、DoD）
- `docs/v7.8/移动-I00.md` §14、`.scratch/level-playability-v1.1-integration/issues/12-i00-09-implementation-plan.md`
- `docs/v7.8/移动-I03.md`（AC-01～AC-21、PU 六条件、§9）
- `.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md`
- `.scratch/level-playability-v1.1-i03-phase2/map.md`、`docs/v7.8/移动-I03-phase2.md`
- `.scratch/level-playability-v1.1-i02/evidence/**`（A–J、G1–G11、N1–N18、T-55～T-65、LP-06/07）
- `.scratch/level-playability-v1/corpus/inventory.json`
- `packages/contracts/tests/playability-*.test.ts`、`packages/pipeline/tests/*`、`packages/assets/tests/ops.test.ts`、`packages/mcp/tests/*`
- `.scratch/level-playability-v1.1-i03/issues/18-i03-pu-air-control.md`（C1–C17）

产出：`.scratch/level-playability-v1.1-closure/evidence/01-coverage-inventory.md`，含矩阵（requirement → existing evidence → gap → candidate unit）与文件路径 / 行号 / test 名。**只读产品代码，不修改 `packages/**` / `fixtures/**`；不解决其他票。**

## Answer

**Resolved 2026-11-18 by the research subagent; read-only inventory.**

证据：[`evidence/01-coverage-inventory.md`](../evidence/01-coverage-inventory.md) @ `sha256:9cba8e38e01d2b6c9201265ce3b80a4b6595254223847096b5eead70948ee837`

### 判定

| 块 | 判定 | 关键事实 |
| --- | --- | --- |
| I-04 | **PARTIAL** | PASS 6（G-02 / G-06 / 伪造几何否定侧 / 错误 lag / V1 回归 / 确定性）；PARTIAL 7（G-01 / G-03 / G-04 / G-05 / G-07 / 未知相位 / 19 关无误拒） |
| I-05 | **PARTIAL** | 19 mover / 16 config；19 个 mover 在时序层全部 `IE`；时序 NB = 0、时序 PU = 0；V1 静态层候选 NB 11 / PU 3 / IE 2；Pipeline 证据 PARTIAL；最终报告 MISSING |
| PU | **MISSING（2/5）** | 条件 1/3/4/6 仅在合成 `PU_WORLD` 上 PASS；条件 2 / 5 硬 `BLOCKED`；`ADMITTED` 资格 MISSING；PU-C5 C1–C17 = PASS 3 / PARTIAL 9 / MISSING 4 / NOT_RUN 1；A/B 证明与 probe 整体 MISSING |

### 最关键缺口

1. **I-05 没有真实时序 NB / PU 案例**：19 个 mover 全部 `IE` 早退（11 `goal-not-representable` / 6 `model-out` / 2 `spawn-not-on-lattice`）；V1 静态层的 NB/PU 不能冒充时序证据。⇒ 新开 `10-i05-temporal-fixtures` 决定 fixture 授权路径。
2. **G-01 / PU 条件 2**：真实帧几何 ↔ Runtime body 依赖 P2 probe + P3 复核 + P6 消费；P3 报告不存在，P2/P4/P5/P6 未授权；AC-14 required `NOT_RUN`、AC-15 非 required `NOT_RUN`。
3. **条件 5**：C1–C7 只有 E1 源码 / 少量 E2，不是 E3；C10 仅源码；C11/C12/C13 的 A/B 证明未实现；C14/C15 部分；C16 `NOT_RUN`。
4. **I-04 没有自己的 fresh 验收报告**：19 config 无误拒没有逐 config publish-gate 扫描，只有 last-train 样本 + 源级「temporal 不参与放行」测试。
5. **G-03 / G-05 未测分支**：页面暂停 / 后台 RAF（U1 未解除）；moving platform / danger strike 的 `model-out` 分支实现了但无直接测试。
6. **证据可复算性**：`I03-acceptance` 引用的 `acceptance-run2/` 目录在工作树缺失，只能引用报告 hash；LP-06/07 非 CI。

### 限制

- 本盘点只转述现有报告 / 测试，未现场复跑 vitest、LP-06/07、probe。
- 票面原列的 `.scratch/level-playability-v1.1-i02/evidence/**` 中的 A–J / G1–G11 / N1–N18 / T-55–T-65 / LP-06/07 实际不在该目录；盘点已按真实位置（contracts 测试、I-03 acceptance、`level-playability-v1-p1`）引用。
- `acceptance-run2` 证据目录缺失，相关日志 hash 无法复算。
