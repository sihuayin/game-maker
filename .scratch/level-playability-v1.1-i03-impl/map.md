# I-03 实施治理计划（规划型 effort）

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-i03-impl
Authority: [`docs/v7.8/移动-I03.md`](../../docs/v7.8/移动-I03.md) @ 签署前 `sha256:2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` / 签署后 `sha256:f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb`（SIGNED，amber 2026-11-15）+ [`reports/I03-review.md`](../level-playability-v1.1-i03/reports/I03-review.md) @ `sha256:40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09`（PASS 23/23）+ F2 修正 [`evidence/10-f2-correction.md`](../level-playability-v1.1-i03/evidence/10-f2-correction.md) @ `sha256:17ea5f9137b9dbf3dbf7ab715fc26e598c0ee419ff94794a9b974584086a8c2a`
Baseline: `main` @ `e31df2f`
Branch: `wayfinder/level-playability-v1.1-i03-impl`
PR target: `main`（地图 / 票 docs-only；单元代码另开 PR）
Status: open · 2026-11-15 · I03-IMPL-03 完成；frontier：I03-IMPL-04

> **规划型 effort（Q1=A）。** 本图只产执行治理 brief，不修改产品代码、不执行 U1–U5、不开放 `PUBLIC_NB` / `PUBLIC_PU`。
> 执行由未来的独立会话按单元 brief 进行；每个单元仍是独立 branch / 独立 PR / 独立复核 / 独立授权。

## Destination

**I-03 实施治理计划完成：U1–U5 的逐单元授权、branch/PR 拓扑、独立复核、证据落盘、回滚、Ledger 与验收 / 关闭安排全部明确，可交给独立执行会话按单元实施；本图不修改产品代码、不开放 `PUBLIC_NB` / `PUBLIC_PU`。**

## Notes

### 已冻结的 charting 裁定

| # | 裁定 |
| --- | --- |
| Q1 | **A：规划型 hand-off**；不执行代码 |
| Q2 | **A：一次规划 U1–U5**；U1 为第一 frontier |
| Q3 | 采纳 `level-playability-v1.1-i03-impl`；地图分支从 `main` @ `e31df2f` |
| Q4 | **A：地图 + 票即 hand-off**；不另写 plan 文档 |
| Q5 | **A：7 张票**（1 执行协议 + 5 单元 brief + 1 验收 / 关闭） |
| Q6 | **A：地图 docs-only PR → main**；单元从更新后的 `main` 建 `...-i03-uX`，单元 PR 顺序合入 `main`；不设长期 integration branch |
| Q7 | **A：每单元独立 `reports/UX-incremental-authorization.md` + 独立 docs-only Ledger 更新** |
| Q8 | **A：单元复核 / 证据在新 effort；最终验收报告在授权包固定路径** |
| Q9 | **Out of scope 全部确认**（见下） |
| Q10 | **A：docs-only Ledger 例外仅 §12.2 目标单元行**；字段 / 时机 / 执行者 / pre-post hash / 锁住范围见 I03-IMPL-01 |

### 执行顺序与票结构

- 固定顺序 **U1 → U2 → U4 → U5 → U3**；上一单元签署后才开始下一单元（授权包 §11.1）。
- 7 张票：`I03-IMPL-01` 执行协议；`I03-IMPL-02` U1 brief；`I03-IMPL-03` U2 brief；`I03-IMPL-04` U4 brief；`I03-IMPL-05` U5 brief；`I03-IMPL-06` U3 brief；`I03-IMPL-07` 验收 / 关闭计划。
- 每张票一个独立会话；claim 后再工作；单元 brief 按上述顺序 wiring。
- 本图只产 brief / 协议 / 计划；**不写产品代码、不改 `packages/**` / `fixtures/**`、不推送单元代码、不合并单元 PR**。

### 授权与 Ledger（Q7=A + Q10=A）

- 每单元一份独立 `reports/UX-incremental-authorization.md`（用户签署；沿用 I-02 格式；不改授权包正文）。
- 签署后一次 **docs-only Ledger 更新**：仅 `docs/v7.8/移动-I03.md` §12.2 目标单元行；字段 `增量授权状态 / 实施 SHA / 复核证据路径+hash / 批准人 / 日期 / 回滚目标 SHA / 回滚演练证据 / 备注`；用户或用户明确授权的 docs-only 会话执行；每单元一次 commit；记录包文件 pre/post SHA-256 与精确 diff。
- **锁住**：§1–§11、§13–§17、§12.1、任何已签署结论、产品代码或其他 docs 文件。越界 ⇒ **STOP + HITL**。
- 已签署正文的签署前 hash `2f89d572…` 保持为签署对象；Ledger 更新是签署后的行政记录。

### 证据与复核（Q8=A）

- 单元复核报告：`.scratch/level-playability-v1.1-i03-impl/reports/UX-review.md`。
- 单元证据：`.scratch/level-playability-v1.1-i03-impl/evidence/UX-*`。
- 最终验收报告：`.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md`（授权包 §10.5 固定路径）。
- E1 / E2 / E3；逐项 `PASS / FAIL / NOT_RUN`；禁止通过率替代。

### 技能与执行形态

- 本图会话：`grilling` + `domain-modeling`（如需要）。
- 未来执行会话：`tdd` 用于实现 / 测试；`code-review` 用于独立复核；`diagnosing-bugs` 用于失败诊断。
- 执行必须遵守授权包 §11.2 白名单、§11.3 12 条 STOP、§11.4 五道复核门、§11.5 回滚、§11.6 关闭。
- 任何 STOP / 白名单外修改 / gate 变化 / 证据基线变化 ⇒ 停止并交回用户；不得在本图自行扩权。

## Decisions so far

- [I03-IMPL-03 U2 执行 brief](issues/03-i03-impl-u2.md): Q1–Q7=A；gate + admission 双重检查（`gate=OPEN` ≠ admission）；`mapPublicVerdict` 判别联合输入；evidence 替换旧 temporal（`applicable:false` 也移除）；coverage 三维取 existing、缺证据不伪造 geometry；冲突异常覆盖 NB / PU candidate（Q7=A）；2 commit slices；完整 synthetic 矩阵；不构成 U2 实施授权；下一 frontier I03-IMPL-04 U4 brief。
- [I03-IMPL-02 U1 执行 brief](issues/02-i03-impl-u1.md): Q1–Q6=A；Q3 依赖前置检查 PASS（`TemporalTwoLagInternalResult` 在 contracts `temporal.ts:940`；见 `reports/U1-dependency-check.md`）；Q4 真实 analyzer smoke 移交 U4（U4 票已加必需集成验收项）；brief 覆盖公共 temporal 类型 / 纯适配器 `toPublicTemporalEvidence` / 3 commit slices / synthetic 矩阵 + API 回归 / U1 证据与独立复核 / 回滚文档化；**不构成 U1 实施授权**；下一 frontier I03-IMPL-03 U2 brief。
- [I03-IMPL-01 执行协议与授权拓扑](issues/01-i03-impl-01-execution-protocol.md): Q1–Q6=A；协议 [`reports/01-execution-protocol.md`](reports/01-execution-protocol.md)（`sha256:b9e14b5ffddf8d075fdc895bd5638eadf21b2fdbbe27e1e4aea24359a7c86fd2`）冻结授权记录 / 独立复核 / 单元 PR + Ledger 顺序 / 证据与回滚 / docs-only Ledger 例外 / 单元 brief 清单；不授权任何单元、不改产品代码；下一 frontier I03-IMPL-02 U1 brief。

## Not yet specified

无已知雾区。U1–U5 的执行 brief 已拆票；执行中的 STOP / HITL 按授权包 §11.3 / §13 处理，不预先拆票。若某个 brief 暴露新的接口 / 测试决策，在该 brief 票内解决。

## Out of scope

- 实际修改 `packages/**` / `fixtures/**`；U1–U5 代码实现与测试执行。
- 几何 probe 实现 / AC-15、PU 条件 2 / 5 证明、`PUBLIC_NB` / `PUBLIC_PU` 开放。
- Runtime hitbox equality、CLI / MCP / Runtime / 持久化。
- I-04 / 后续 effort / 单元代码推送 / 单元 PR 合并。
- 修改已签署授权包除 §12.2 Ledger 目标行之外的任何内容；修改 I-02 / U5 冻结结果。
- 本图自身的 docs-only 地图 / 票 PR 不属于上述“推送 / 合并”禁区；它是 charting 交付。
