# 12. 阶段C 真实产物验收（§8.4 + P0-06 写回）

Type: task
Map: ../map.md

## Question

落地 §8.4：用 `fpvs-v1-p0` 的真实 E2E 产物 `2026-10-26-e2e-r4`（**零付费、不重跑生图/构建**）做一次端到端报告验收，
输出统一报告 + 版本关联 + 试玩证据 + 视觉状态 + 最终结论：

1. 读 `smoke3/playable/result.json`（`ok:false`、`stage:"navigate"`、`collected=1/4`）→ `mapPlayableSmoke` 归 **UNKNOWN**、
   写 `knownLimitations[]`（票 05 Q3 事实化措辞）、证据引用 `result.json` / `console.json` / `exceptions.json` / `fail-navigate.png`。
2. 视觉评审：从票 02 Answer **转录** `{status:"pass", reviewer:人类, reviewedAt:2026-10-27}`（P0-06 真实历史裁定，**不冒充重新评审**）
   写进 `delivery.visualReview`。
3. 最终 `delivery.verdict` 由确定性规则算出来（试玩 UNKNOWN → incomplete，不是手打的布尔）。
4. 产出统一报告并落盘；确认报告能回答 §2.1 的八个问题（哪些检查过了 / 还剩哪些 / 证据是否足以交付）。

边界：零付费、不重跑生图/构建、不改 `fpvs-v1-p0` 的历史产物；复用 09/10 已落地的映射函数与写回函数。
P0-06 的 `reviewedAt` 用票 02 记录的 2026-10-27（真实历史裁定日期），不写成现在这一刻。
