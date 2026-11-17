# I-03 验收基线重冻结授权记录

| 项 | 值 |
| --- | --- |
| 记录类型 | 验收基线重冻结授权；**独立记录**；不修改已签署授权包正文 / AC |
| 签署人 | **amber** |
| 日期 | **2026-11-17** |
| 触发 | 最终独立验收 `FAIL`（报告 `sha256:7996e705110516e83f6736a53f6c33ab172b87b8bd2334e126edc914ae478ba0`），AC-21 的 LP-06/07 冻结基线与 U3 授权变更后层内结果不一致 |
| 用户裁定 | Q1「授权重冻结基线」；Q2「接受 INCOMPLETE 关闭」 |
| 授权依据 | 已签署 U1–U5（含 U3、U4 amendment-02）；授权包当前 `2bbe7c5534ecb2e28db28657d58de9be54007963c1d4f69f8883568fdc0478f8`；`main` @ `148b89b` |
| 授权范围 | **仅 LP-06/07 tracked 基线重冻结 + 验收重跑**；不改变产品 / 契约 / gate / 能力 |

## 1. 事实

U3（已签署，PR #67 `fa9e76c`）按授权移除机制层 `moving-hazard-phase` gap；LP-06/07 脚本只跑 spatial / mechanic / completion，不消费 temporal 层，因此其层内结果按设计变化。公共路径仍由 `runTemporalAudit` + `mapPublicVerdict` 接管为 IE（AC-07 特别复核 PASS）；冻结基线未随 U3 更新，导致 AC-21 逐项比较 FAIL。

组成基线本身一致：**20 unique configs / 96 pairs / 19 个 x 轴移动 Hazard**。

| 项 | 冻结（旧） | 复跑（U3 后） |
| --- | --- | --- |
| LP-06 语义 hash（去 `generatedAt`） | `sha256:533b78b9df79bcb1b651fa702a390f3dca59f84666945442b7613c0baceb5a4f` | `sha256:071ae5d58502984374ae0c3c20748571303a1675cb43ef9da1f45456682bb4c3` |
| LP-07 语义 hash（去 `generatedAt`） | `sha256:59064484…` | `sha256:5c7d9391…` |
| tracked 文件 SHA-256（旧） | `06-corpus-regression.json` `4bd95026…`；`06-matrix-acceptance.json` `21161ea8…` | — |

## 2. 授权动作

1. 运行 LP-06 / LP-07 原命令，将**仅**以下两个 tracked 证据文件更新为 U3 后输出：
   - `.scratch/level-playability-v1-p1/evidence/06-corpus-regression.json`
   - `.scratch/level-playability-v1-p1/evidence/06-matrix-acceptance.json`
2. 重冻结提交必须为 **evidence-only**，记录旧 / 新文件 SHA-256、去 `generatedAt` 语义 hash、组成不变量（20 / 96 / 19）。
3. 由 fresh 独立验收会话在新基线上重跑 AC-21 与全量验收；未变化的产品 / 证据必须逐项复核。
4. AC-10 / AC-12 / AC-14 仍为 required `NOT_RUN`；整体状态允许且预期为 **INCOMPLETE**（无 required FAIL），报告必须逐项披露。
5. 用户审阅并签署验收报告后，方可记录 phase-1 关闭；关闭 ≠ 能力开放。

## 3. 明确不放行

- 修改 `packages/**`、`fixtures/**`、契约、gate、发布拒稿行为、AC 文本或授权包正文。
- 开放 `PUBLIC_NB` / `PUBLIC_PU`；改变 `publicCapability="BLOCKED"` / `publicResult=null`。
- 把 AC-10 / AC-12 / AC-14 的 `NOT_RUN` 转成 PASS。
- 修改 U1–U5 产品 evidence 以外的历史复核 / Ledger 记录。

## 4. 生效与失效

- 生效：本记录合入 `main` 之时。
- 失效：验收报告用户签署完成；或重跑出现 required FAIL / STOP 时退回。
