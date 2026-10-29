# Phase 0 只读审计：记录 schema、证据依赖图与差距清单

Type: task
Status: resolved

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

## Answer

**已完成（2026-10-29，只读）。** 全案：[research/phase0-audit.md](../research/phase0-audit.md)（309 行）。

核心事实：

- **正式路径不重算证据哈希**：`DeliveryReportSchema.superRefine` 只做报告内部自洽（`contracts/src/delivery.ts:172-257`）；
  publish gate 只比较 pack 身份；`delivery.evidence` 只有 `{ref,path}`。
- **07 是唯一证据核验器**：27 项清单已逐条列在审计 §3；缺口是路径安全、不可读、引用图、六项从证据重导出、declared/recomputed 并列。
- **现有 `hashes.json` 不是合格清单**：80 条 = 66 snapshot + 14 reference；work 未逐条列，且冻结后 work 已从 66 增至 95（playtest v1/v2、rejections）。
- **身份矩阵基本可行**：playtest 用 `packChecksum`，其余用 `manifestChecksum`；09 用 `siteHashes.*`；qa-report.subject 无 site/shell/config；consistency/regression 无身份（不在 Q12 名单）。
- **入库事实**：fpvs-v1-final 511/530、generic-playtest-v1 202/535 跟踪；差集是 `*.log` 与 `self-test-run/out/` ⇒ 非日志证据可由 git 锚定，日志不能作必需证据。
- **六项重导出的两种来源**：`playable-smoke` 以 `delivery.playtest.report` 指向的 harness v1 报告重导；06 两份 harness v2 attempt 作为额外必需证据核对（D1）。
- **最小改动可行**：新模块落 `packages/pipeline`（依赖图允许），CLI 薄壳，报告 schema 本地；不扩 contracts、不加第七个检查项。

产出：证据依赖图（§4）、记录 schema × 身份矩阵（§5）、差距清单 EI/AC（§7）、最小改动方案（§8）、
清单冻结前必裁定的 D1–D12（§9）、Phase 0 六问逐条回答（§10）。

## Notes for 03

清单冻结时按 §9 的 D1–D12 逐条裁定并记录理由；至少覆盖：work 显式枚举（D5）、outRoot 映射（D4）、
playtest v1/v2 双来源（D1）、reference 14 文件 optional（D6）、`*.log` 不入必需项（D12）。
