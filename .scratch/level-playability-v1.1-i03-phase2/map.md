# I-03 Phase-2 收口治理计划（规划型 effort）

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-i03-phase2
Authority: [`docs/v7.8/移动-I03.md`](../../docs/v7.8/移动-I03.md) @ `sha256:2bbe7c5534ecb2e28db28657d58de9be54007963c1d4f69f8883568fdc0478f8`（SIGNED）+ [`docs/v7.8/移动-I03-phase2.md`](../../docs/v7.8/移动-I03-phase2.md)（**SIGNED 2026-11-17，amber**；签署前 `sha256:0a3ee4a3…`；签署后 `sha256:100d0221db759cf2ce64835665691c410c76e6223ee8f9049655db6021537b21`；见 [`reports/00-annex-signature.md`](reports/00-annex-signature.md)）+ [`reports/00-execution-protocol.md`](reports/00-execution-protocol.md)
Baseline: `main` @ `dd10dff7dbd1f44d468fcea037aa9b6853671424`（phase-1 INCOMPLETE 关闭后）
Branch: `wayfinder/level-playability-v1.1-i03-phase2`
PR target: `main`（地图 / 票 / 协议 / annex 均 docs-only）
Status: open · 2026-11-17 · P0/P1/P2/P4 resolved；annex SIGNED；frontier = P5 · P6（均未 claim；P1/P2/P4 实施待各自增量授权）

> **规划型 effort（Q4=A）。** 本图只产 Phase-2 执行治理资产（协议、annex 草案、逐单元 brief、验收计划），不写产品代码、不运行 probe、不物化夹具、不执行 P7 验收。
> Phase-2 实施由后续独立会话按单元授权执行；每个单元仍是独立授权记录 / 独立分支 / 独立复核 / 用户签署 / 独立 Ledger 行。

## Destination

**Phase-2 执行治理计划完成：P0 协议 + SIGNED annex（签署前 `0a3ee4a3…`）+ P1–P6 逐单元执行 brief + P7 全量验收计划全部明确，可交给独立执行会话按单元授权实施；本图不修改产品代码、不运行 probe、不开放 `PUBLIC_NB` / `PUBLIC_PU`。**

## Notes

- **领域**：I-03 phase-1 遗留 required `NOT_RUN` 的收口；probe 证据生成、NB admission machinery、global gate close、AC-14 几何证据消费。
- **技能**：实现单元 brief 使用 `grilling` + `domain-modeling`；实施会话使用 `tdd`；复核使用 fresh 独立会话。
- **授权**：`docs/v7.8/移动-I03-phase2.md` 签署前，P1–P6 均不得开工；annex 签署不自动授权任何单元，也不自动授权 P7。
- **P3 门**：P3 是 P2 内的独立复核与用户签署门，不单独占 Ledger 行，但阻断 P6。
- **证据**：P1/P2 scratch 产物在 audit 分支 `wayfinder/i03-phase2-probe-evidence`；`main` 只收授权 / 复核 / 治理报告。
- **不变量**：`PUBLIC_NB` / `PUBLIC_PU` 恒 `BLOCKED`；`publicCapability="BLOCKED"` / `publicResult=null`；公共 `PlayabilityVerdict` 顶层形状不变；phase-1 报告不可变。
- **F2 负例**：P1 必须物化 F2 修正后的 **11 个负例**（10 `geometry-mismatch` 含 `body-bounds-mismatch` + 1 `missing-evidence`），manifest hash `dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b`。

## Decisions so far

- [Phase-2 执行协议、UNSIGNED annex 与 Ledger 模型](issues/01-phase2-protocol.md): 冻结 P1–P6 授权模型、5 行 Ledger、P7 独立验收授权；annex 已于 2026-11-17 由 amber 签署（签署前 `0a3ee4a3…`，签署后 `100d0221…`）；P1–P6、P7 仍需独立授权。
- [P1 · Probe 契约冻结与夹具物化 brief](issues/02-p1-probe-fixtures.md): 冻结 scratch 布局、F2 修正后 14 正例 / 11 负例、manifest `dd880628…`、两次重建字节一致、audit 分支与 P1 复核签署；P1 实施待增量授权。
- [P2 · Probe 实施 brief（含 P3 独立复核门）](issues/03-p2-probe-implementation.md): 只读复用 demo harness、CDP 只读采集、25 样本（14+10+1）、`i03-geometry-probe/v1` 语义 hash、P3 fresh 复核 + 用户签署才允许 P6 消费；P2 实施待 P1 完成 + P2 授权。
- [P4 · NB admission machinery brief](issues/04-p4-nb-admission.md): 证据级十项准入判定（`assessNbAdmission`，恒返 10 项、永不 throw）；attestation 输入 + 防伪不变量；17 行冻结矩阵与 matrix-hash / probe-manifest-hash 分离；gate `BLOCKED` 负向用未修改的 `mapPublicVerdict` 证明；AC-10 在 P4 保持 `NOT_RUN`；P4 实施待 P1 完成 + 增量授权。

## Not yet specified

无已知雾区。7 张票已覆盖 Phase-2 全部规划决策；P1–P7 的实现细节进入各自的执行 brief。

## Out of scope

- 实际修改 `packages/**`、`fixtures/**` 或运行 probe / 测试；P1–P6 实施与 P7 验收执行。
- PU 六条件、条件 2（几何）、条件 5（空中控制）、`I03-PU-Air-Control-Closure`。
- `PUBLIC_NB` gate `OPEN` / `ADMITTED`；`PUBLIC_PU` admission / gate 开放。
- 修改 `docs/v7.8/移动-I03.md` 正文或其 §12.2；修改 I-02 / U5 冻结结果 / phase-1 验收报告。
- 把 probe 脚本或夹具副本放进产品 package；把 `.scratch` 证据未经归档决定放进产品 PR。
- 把 AC-10 / AC-12 / AC-14 的 `NOT_RUN` 直接改写成 PASS；把 AC-15 升级为 required。
