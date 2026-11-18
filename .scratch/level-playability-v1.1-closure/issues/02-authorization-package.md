# 收口授权包与 Ledger 拓扑

Type: grilling
Status: resolved
Owner: claude (wayfinder session 2026-11-18)
Blocked by: —
Map: ../map.md
Class: V1.1-CLOSURE / DECISION

## Question

冻结 `docs/v7.8/移动-收口.md` 的结构，使 I-04 / I-05 / PU-C5 / PU-ADMIT 四个单元可以各自独立授权、实施、复核、签署与记账。

必须裁定：

1. **包的范围与非目标**：只覆盖 4 个收口单元；P2–P7 只作为前置引用 Phase-2 annex，不重复授权；不改变 `PUBLIC_NB` / `PUBLIC_PU` gate。
2. **单元表与依赖**：4 个单元的定义、输入、输出、启动条件、复核门。
3. **Ledger**：4 行，字段至少含单元 / 文件（操作/目的）/ 增量授权状态 / 实施 SHA / 复核证据路径+hash / 批准人 / 日期 / 回滚目标 SHA / 回滚演练证据 / 备注；与 Phase-2 Ledger 的格式一致。
4. **白名单与证据路径**：每单元的允许文件、只读输入、证据落点、复核报告路径、STOP 条件；具体白名单以 `04-i04-brief` / `05-i05-brief` 为准，本票只冻结格式与默认值（默认产品代码零改动）。
5. **签署与闭合模型**：增量授权记录 → 用户签署 → docs-only PR → 分支 → 实施/证据 → fresh 复核 → 用户签署 → 合并/归档 → Ledger；最终收口报告与 V1.1 closure 声明的关系。
6. **基线与回滚**：baseline SHA、回滚目标、纯 audit 单元（PU-C5）与产品单元（I-04/I-05/PU-ADMIT 若改代码）的不同回滚方式。
7. **不可变边界**：不修改已签署的 I-00 / I-02 / I-03 / Phase-2 annex 正文；不把 `NOT_RUN` 写成 PASS。

产出：授权包草案（可在本票 Answer 中给结构 + 关键条文，或直接落 docs 草案）；不签署、不授权任何单元。

## Answer

**Q1–Q8 = 用户裁定（2026-11-18，全 A）。** 交付 [`docs/v7.8/移动-收口.md`](../../../docs/v7.8/移动-收口.md) **UNSIGNED 草案** @ `sha256:77837e46309caca850bd1260c888f5422ca034ef051387162b5066b647e8fec3`（175 行；§4–§7 / §11 为待填占位）。未签署、未授权任何单元、未改产品代码。

| # | 冻结 |
| --- | --- |
| Q1 | 完整镜像 Phase-2 annex §0–§14；差异仅 4 单元 / 4 行 Ledger / DoD 由 `09` 填充 |
| Q2 | 四份 brief 填完后一次签署；签署只建立逐单元申请依据，不授权单元；改正文 ⇒ 重签并记录新旧 hash |
| Q3 | 本票冻结硬依赖边（I-04、PU-C5 ← 包签署；I-05 ← I-04 + `10`；PU-ADMIT ← PU-C5 + `10`）；五 Wave 归 `08`，改边须回开本票 |
| Q4 | 增量授权记录 10 字段 + 落点 `.scratch/level-playability-v1.1-closure/reports/<UNIT>-incremental-authorization.md`；有效期至 Ledger 行闭合或用户撤回 |
| Q5 | Ledger 4 行、10 列与 Phase-2 一致；最终收口报告不占行，记入 I-05 行备注，收口声明另立 `final-closure-signature.md` |
| Q6 | 产品代码默认零改动；只读 ≠ 可改；证据 `evidence/<unit>/`；复核 `reports/<UNIT>-review.md` 且 fresh；PU-C5 audit 分支；brief 只能收窄 |
| Q7 | 基线 = 签署时 `main` SHA；回滚目标 = 单元切出时 `main` SHA；audit 单元丢分支、产品相邻单元强制 drill、docs-only 直接 revert |
| Q8 | 继承 12 + 4 条 STOP，追加 6 条（越界 / 静态冒充时序 / `NOT_RUN`→PASS / gate 变化 / 未授权 fixture / 未签署即开工） |

关键边界：

- 本包不改 `PUBLIC_NB` / `PUBLIC_PU` gate，不改变 `publicCapability="BLOCKED"` / `publicResult=null`。
- §1 范围外的最终措辞归 `03-out-of-scope`；本票只留粗线条与 STOP 挂钩。
- 单元白名单以 `04`–`07` 为准；本票只冻结格式与默认值。
- 草案路径已写入地图 Decisions-so-far；签署前不构成任何授权。

**下游**：`04-i04-brief` 与 `06-pu-c5-brief` 解锁；`05-i05-brief` 仍等 `04` + `10`，`07-pu-admit-brief` 仍等 `06` + `10`。本票未启动任何后续票。
