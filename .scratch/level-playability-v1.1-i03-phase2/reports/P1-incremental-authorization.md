# P1 增量实施授权记录（SIGNED）

| 项 | 值 |
| --- | --- |
| 记录类型 | 增量实施授权；**独立记录**；不修改已签署 annex 正文 |
| 签署人 | **amber** |
| 日期 | 2026-11-17 |
| 指令原文 | ① 对完成度分析建议「1/2/3」回复「**1**」；② 在「签署 P1 授权 / 先审阅草稿 / 暂不签署」中选 **「签署 P1 授权（推荐）」**（2026-11-17） |
| 授权依据 | Phase-2 annex `docs/v7.8/移动-I03-phase2.md`（SIGNED 2026-11-17；签署前 `sha256:0a3ee4a308ed6ad26d83f764af778b95dcb5288edda170e28b045668f9ef009d`；签署后 `sha256:100d0221db759cf2ce64835665691c410c76e6223ee8f9049655db6021537b21`）；执行协议 `reports/00-execution-protocol.md` §4；P1 brief `issues/02-p1-probe-fixtures.md`；当前 `main` @ `0d6494a384555df10bda8c953740d98ed66e06b9` |
| 授权范围 | **仅 P1**（probe 契约冻结 + 夹具物化；只写 audit 证据，不改产品） |
| 执行 effort | `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/`；audit 分支 `wayfinder/i03-phase2-probe-evidence`，从本记录合入后的 `main` 切出 |
| 结论 | P1 **AUTHORIZED**（限实施 + 独立复核 + 用户签署）；P2–P6、P7、`PUBLIC_NB` / `PUBLIC_PU` 仍 **NOT_AUTHORIZED / BLOCKED** |

> 本记录只授权 P1。P2 / P4 / P5 / P6 各需独立增量授权记录；P3 是 P2 内的复核门；P7 需用户另行授权。

## 0. 签署记录

| 项 | 值 |
| --- | --- |
| 签署方式 | 用户在会话中以「1」选择建议 1，并在授权确认中选择「签署 P1 授权（推荐）」 |
| 签署时间 | 2026-11-17 |
| 签署对象 | 本记录（签署后生效） |
| 授权结论 | P1 AUTHORIZED；其余单元与公共能力不变 |

> 签署只建立 P1 的实施依据；不授权 P2–P7，不开放 `PUBLIC_NB` / `PUBLIC_PU`，也不改变任何产品文件。

## 1. 授权范围

| # | 授权项 | 状态（签署后） | 边界 |
| --- | --- | --- | --- |
| A1 | P1 实施：probe 契约冻结 + 夹具物化 | **AUTHORIZED** | 仅 `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/**` |
| A2 | P1 独立复核 | **AUTHORIZED** | fresh reviewer；报告 `reports/P1-review.md` |
| A3 | P1 重建确定性验证（两次 rebuild） | **AUTHORIZED** | 只读消费已冻结输入；不新增依赖 |

## 2. 允许文件

| 路径 | 操作 |
| --- | --- |
| `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/contract/**` | 新增：I03-03A 契约冻结副本 + hash |
| `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/fixtures/**` | 新增：source 只读副本、v4 归一化副本、manifest、normalization、11 个负例配方 |
| `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/scripts/build-fixtures.py` | 新增：Phase-2 自有副本；仅修正 docstring 旧口径，行为不变 |
| `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/evidence/p1/**` | 新增：命令日志、两次 rebuild 输出、各层 SHA-256、`SHA256SUMS` |
| `.scratch/level-playability-v1.1-i03-phase2/reports/P1-*` | 新增：授权 / 复核 / 治理报告 |

只读输入：产品 `fixtures/packs/last-train/v2/**`、`.scratch/level-playability-v1.1-i03/evidence/geometry-probe/**`。**不得修改**。

## 3. 明确不放行

- P2 probe 实施、P3 复核、P4 NB admission、P5 global gate close、P6 AC-14 几何证据消费、P7 全量验收。
- 任何 `packages/**` / `fixtures/**` / `package.json` / lockfile / tsconfig / CLI / MCP / `publish-gate` 改动。
- `PUBLIC_NB` / `PUBLIC_PU` 的 `WIRED` / `ADMITTED` / `OPEN` 任一阶段；公共 Verdict 顶层形状变化。
- 把 probe 脚本或夹具副本放进产品 package；把 `.scratch` 证据未经归档决定放进产品 PR。
- 修改 annex 正文、I-03 正文或其 §12.2、I-02 / U5 / phase-1 报告。
- 推送 / 合并除本单元规定的 docs-only PR 与 audit 分支归档外。

## 4. 冻结输入与验收

| 输入 | 冻结值 |
| --- | --- |
| I03-03A 契约 | `.scratch/level-playability-v1.1-i03/issues/13-i03-03a-probe-format.md` |
| I03-03B2 manifest | `sha256:dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b` |
| build script（旧） | `sha256:4253bbbb4c849d94654239f90c074e7d3161d07c97a8ed7beb3ba5a4c7a3ea66` |
| 源 pack tree | `sha256:570535deff5c2f4e1626b2680a4b555f631e51d6d87721507a0a1f6e2feb7383` |
| 源 manifest | `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` |
| 归一化 manifest | `sha256:19f4da6fb9bf25b96b48b96e2e44bb1773ad0c1222dc865f72e77a56fc85cb98` |
| 正例 | **14**：hazard 2 / player 9（8 帧 + body 1）/ graph 3 |
| 负例 | **11**：10 `geometry-mismatch`（含 `body-bounds-mismatch`）+ 1 `missing-evidence` |

验收：manifest 与 `dd880628…` 逐字节一致；14 / 11 计数与类别正确；两次重建字节一致；产品 fixture 零改动；证据可独立复算。

## 5. 证据 / 复核 / 回滚

- 证据落点：`geometry-probe/evidence/p1/`；独立复核报告 `reports/P1-review.md`。
- fresh 独立 reviewer，逐项 `PASS / FAIL / NOT_RUN`；至少检查 manifest hash、14/11 计数、`body-bounds-mismatch`、两次重建字节一致、source / v4 tree hash、产品零改动。
- P1 review PASS + 用户签署后才算完成；P2 才能启动。
- 回滚目标：P1 分支切出时的 `main` SHA `0d6494a384555df10bda8c953740d98ed66e06b9`；P1 为纯 audit 产物，回滚即丢弃 audit 分支与证据，产品无需回滚。
- `main` 只收 P1 授权 / 复核 / 治理报告；audit 分支记录 commit SHA。

## 6. STOP

- manifest hash ≠ `dd880628…`，或负例回退到旧 10 个口径。
- 缺 `body-bounds-mismatch`、正例 ≠ 14、负例 ≠ 11。
- 两次重建字节不一致。
- 修改原始产品 fixture，或把副本放进产品 package。
- `git add -f` 夹带白名单外文件。
- 任何需要扩大白名单、修改契约语义或产品代码的请求 ⇒ STOP + HITL。

## 7. 生效与失效

- 生效：本记录由用户签署并合入 `main` 之时。
- 失效：P1 用户签署完成后耗尽；P1 `FAIL` 或 STOP 时退回。
- 本记录不产生 P2–P7 或任何公共能力的隐含授权。
