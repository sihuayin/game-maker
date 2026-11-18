# Level Playability V1.1 剩余收口

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-closure
Authority: [`docs/v7.8/移动.md`](../../docs/v7.8/移动.md)（V1.1 PRD）· [`docs/v7.8/移动-I00.md`](../../docs/v7.8/移动-I00.md)（集成契约）· [`docs/v7.8/移动-I02.md`](../../docs/v7.8/移动-I02.md)（判定核心）· [`docs/v7.8/移动-I03.md`](../../docs/v7.8/移动-I03.md)（公共接线/准入，SIGNED）· [`docs/v7.8/移动-I03-phase2.md`](../../docs/v7.8/移动-I03-phase2.md)（SIGNED 2026-11-17）· [`I03-PU-Air-Control-Closure`](../level-playability-v1.1-i03/issues/18-i03-pu-air-control.md)（PU 条件 5 合同）· [`Phase-2 地图`](../level-playability-v1.1-i03-phase2/map.md)（P1–P7 规划；P1 CLOSED）
Baseline: `main` @ `16c0375f1df726c13c58a8e1febbb6b77dfac942`（P1 CLOSED 后）
Predecessor: `level-playability-v1.1-i03-phase2`（planning complete；P1 CLOSED）
Status: working · 2026-11-18 · 10 tickets（1 research + 9 decisions）；前沿 = `10-i05-temporal-fixtures`；`01` / `02` / `03` / `04-i04-brief` / `06-pu-c5-brief` resolved；本图只规划，不执行任何单元

## Destination

一份可签的《V1.1 剩余收口执行计划》：把 **I-04**（负向/回归验收）、**I-05**（Pipeline 验收 + 最终收口报告）、**PU-C5**（空中控制证据生产）、**PU-ADMIT**（PU 六条件准入验收）四个独立授权单元、五 Wave 依赖、授权/证据/验收拓扑、closure DoD 追溯矩阵与最终报告路径全部冻结，并落成 `docs/v7.8/移动-收口.md` 总授权包。

本图不执行任何单元、不改产品代码、不改变 `PUBLIC_NB` / `PUBLIC_PU` gate。

## Notes

- **领域**：Level Playability V1.1 的单移动 Hazard 能力收口；I-04/I-05 验收、PU 条件 2/5、六条件 ADMITTED 资格。
- **技能**：决策票用 `grilling` + `domain-modeling`；未来实施单元用 `tdd`；复核用 `code-review`。
- **执行形态**：planning-only（Q1=A）。每个单元未来仍走 Phase-2 的九步：增量授权记录 → 用户签署 → docs-only PR → 实施分支 → 实施/证据 → fresh 独立复核 → 用户签署 → 合并/归档 → 独立 Ledger 行。
- **决策只存一处**：P2–P7 的决策归 `level-playability-v1.1-i03-phase2`；本图只引用，不重开。

### Charting rulings（Q1–Q14，2026-11-18）

| # | 裁定 | 冻结 |
| --- | --- | --- |
| Q1 | A | 只产可签执行计划；不施工 |
| Q2 | A | `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；开放是独立 effort |
| Q3 | A | PU 条件 2/5 + 六条件 `ADMITTED` 资格；不开放 |
| Q4 | A | I-04/I-05 是验收/证据阶段；不新增算法 |
| Q5 | A | 收口伞图引用 Phase-2；不重复 P2–P7 |
| Q6 | A | 4 个独立授权单元：I-04 / I-05 / PU-C5 / PU-ADMIT |
| Q7 | A | 既有 vitest 全绿 + LP-06/07 原样 scratch 复跑；不转 vitest |
| Q8 | A | I-05 只筛现有 19 个 moving-hazard config；不自建 fixture |
| Q9 | A | 只验收资格；PU gate 不变 |
| Q10 | A | 一份总授权包 + 4 行 Ledger；P2–P7 只作前置引用 |
| Q11 | A | 五 Wave，按证据依赖推进 |
| Q12 | A | `docs` 授权包 + `.scratch` briefs/报告 |
| Q13 | A | 1 张 research 票 + 8 张决策票；research 由实际 subagent 执行，不虚报 |
| Q14 | A | 执行、公开状态、产品改动、新 fixture 等全部出图；fixture 未来另行授权 |

### 不变量

- `PUBLIC_NB` / `PUBLIC_PU` 恒 `BLOCKED`；`publicCapability="BLOCKED"` / `publicResult=null` 不变。
- 本图不修改 `packages/**` / `fixtures/**`；未来单元以各自授权白名单为准，默认产品代码零改动；I-04 是否允许只增测试见 `04-i04-brief`。
- 不修改已签署的 I-00 / I-02 / I-03 / Phase-2 annex 正文。
- 不把 `NOT_RUN` 改写成 PASS；不用通过率替代逐项判定。
- 每个决策/证据只存一处；引用而不复述。
- I-04 的回归口径：既有 vitest 全绿 + LP-06/07 scratch 复跑；LP-06/07 不转 vitest。
- I-05 的真实案例只从现有 21 configs / 19 moving hazards 筛选；新建 fixture 需另开授权票。

## Decisions so far

- [存量覆盖盘点：I-04 / I-05 / PU 条件 2/5 的证据差集](issues/01-coverage-inventory.md): I-04 PARTIAL（PASS 6 / PARTIAL 7）；I-05 PARTIAL（19 mover 全 IE；时序 NB/PU = 0；静态层 NB 11 / PU 3 / IE 2）；PU 1/3/4/6 仅合成 `PU_WORLD` PASS、2/5 BLOCKED；PU-C5 C1–C17 多为 PARTIAL/MISSING。
- [收口授权包与 Ledger 拓扑](issues/02-authorization-package.md): 冻结 `docs/v7.8/移动-收口.md` 结构（镜像 Phase-2 §0–§14，4 单元 / 4 行 Ledger）；包签署只建立逐单元申请依据；硬依赖边归本票、五 Wave 归 `08`；产品代码默认零改动，audit / 产品相邻 / docs-only 三类回滚；继承 12+4 条 STOP 并追加 6 条。草案 UNSIGNED；`06` 后 @ `sha256:4402561a…`。
- [Out of scope 与不变量](issues/03-out-of-scope.md): 六类固定归属 + 四列排除表；PRD 非目标只列关键子集并声明 §2.2 为唯一权威；P2–P7 只消费已签署产物；fixture 新建另票授权且 I-05 不得自建；行为四档（读取 / 只读执行 / 证据写入 / 修改）；增量授权须列「不触碰项」并做双门检查；§1/§10/§13 单点存放。§13 已核对 I-02 / I-03 精确措辞，gate 状态与 `publicCapability` 字段分开。
- [I-04 负向与回归验收 brief](issues/04-i04-brief.md): I-04 = 受限测试补齐 + 只读验收扫描 + 独立复核；只增两个测试文件与扫描脚本，不改产品 / 既有测试 / fixtures；G-01 正向核对 deferred（NOT_RUN，不计 required）；G-03 写支持范围 + 具名 unknown-phase 负例；G-05 补 moving platform / danger strike `model-out` 测试；19 关双层扫描（L1 全量 + L2 qa-report 子集）；LP-06/07 在干净 worktree 原样复跑；判定 `PASS/FAIL/INCOMPLETE`、退出码 0/1/2。Brief @ `sha256:94c7677d…`。
- [PU-C5 空中控制证据生产 brief](issues/06-pu-c5-brief.md): 纯证据生产（纯 audit）；required C1–C15、C16/C17 为规则项；A 垂直包容 + B 保守弧线扫掠在 scratch 实现，只读复用 `maxJumpHeight`；探针复用 `probe-harness.mjs`、同环境两次零容差；scratch-only audit 夹具不进 `fixtures/**`；复核报告保留合同路径；证据 PASS 不改 gate / 产品常量；回滚 = 丢弃 audit 分支。Brief @ `sha256:696dbfaf…`。

## Not yet specified

- PU-ADMIT 与 P7 / AC-11 的关系细节（等 `07-pu-admit-brief`）。
- 最终收口声明的措辞、支持范围与残余风险清单（等 `04`–`09`）。
- `I03-acceptance` 引用的 `acceptance-run2/` 证据目录缺失：I-04 已记为已知限制，I-05 如何披露或复算（等 `05-i05-brief`）。

## Out of scope

- `PUBLIC_NB` / `PUBLIC_PU` gate 状态变化（含 `ADMITTED` / `OPEN`）。
- P2–P7 的执行（归 Phase-2 annex / protocol）。
- 新算法、Runtime、CLI、MCP 或任何产品代码改动。
- 新建 fixture；I-05 若覆盖不足，另开 fixture 授权票。
- 多移动 Hazard、moving platform、y 轴、Danger strike、通用动态规划。
- 修改已签署的 I-00 / I-02 / I-03 / Phase-2 annex 正文。
- LP-06/07 转 vitest。
- 付费上游调用。
- I-04 / I-05 / PU-C5 / PU-ADMIT 的实际执行（本图只规划；执行由各自授权会话进行）。
- 重开或重复 P2–P7 的决策（归 `level-playability-v1.1-i03-phase2`）。
