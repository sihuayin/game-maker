# 冻结 FPVS-V1 基线重验与只读性证据

Type: task
Status: open
Blocked by: 03, 05, 06

## Question

对未变化的冻结 FPVS-V1 交付执行正式基线重验（AC-01 / Phase 3）：

1. 运行 `pnpm test:evidence`（或用固定清单直接跑 `verify-delivery`），产出**新的**运行目录报告，不覆盖历史。
2. 断言：必需证据全部识别、哈希核验通过、身份与引用关系通过、人工审核记录被正确读取（不重判）、
   Playtest 报告与 `delivery` 摘要一致、`declared` 与 `recomputed` 一致（均为 `pass`）。
3. 运行前后对受保护文件做快照比对：快照 66 文件、`pack/site` 50 文件、FA-04/05/06/09 证据、qa-report —— 断言零变化。
4. 与 `07-verify-inherited.mjs` 的 27 项结果**交叉比较**，逐条解释任何差异；不得为匹配旧结果跳过校验。
5. 记录命令、退出码、耗时、读取规模、报告路径与清单 SHA-256。

失败时的处理：如实记录差异（E3），不修改原始证据、不回写清单、不降阈值；若重算结论不是 `pass`，
把失败项定位到文件/引用/规则，并交由票 08 决定结论。产物写入 `.scratch/evidence-integrity-v1/runs/<timestamp>-baseline/`。
