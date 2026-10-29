# Phase 0 只读审计：记录 schema、证据依赖图与差距清单

Type: task
Status: open

## Question

只读审计当前仓库，回答 PRD §9 Phase 0 的六问，并核实现有记录的实际 schema 是否支持 Q12 的身份契约：

1. `07-verify-inherited.mjs` 实际检查的全部证据及其来源（列到文件/字段级）。
2. 正式验收当前读取哪些文件、哪些报告、哪些哈希（含 `DeliveryReportSchema` 的自洽约束）。
3. 最终结论的计算入口及优先级规则（`deriveDeliveryVerdict` / `deliveryVerdictOf` 的调用面）。
4. 当前文件系统路径解析与原子写入约定（`writeJsonAtomic` / `acceptance` 报告目录分配）。
5. 已有纯函数、contracts、CLI 与 QA 的职责边界（哪些可直接复用、哪些缺口要新写）。
6. 哈希清单的生成方式及其可信来源（现状：证据自述哈希 + effort 脚本）。
7. **逐份核对** FA-04 `review-record.json` / `capture.json` / `materials.json`、FA-05 `evidence.json` / `consistency.json` /
   `qa-report.json#delivery`、FA-06 `regression.json`、两份 `06-attempt-*/attempt-v1/result.json`、FA-09 `supplement.json`
   的身份字段（packId / packVersion / siteVersion / shellVersion / manifestChecksum / configChecksum）
   与 Q12 契约的差异；缺字段、命名不一致、来源不同都要如实列出。
8. 产出「证据依赖图 + 差距清单 + 最小改动方案」。

约束：全程只读；不改任何证据、历史报告、`pack/site`；不跑付费流程。
产物：`.scratch/evidence-integrity-v1/research/phase0-audit.md`（E1 源码 + E3 文件事实，带路径与行号）。
