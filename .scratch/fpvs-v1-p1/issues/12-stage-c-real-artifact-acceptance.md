# 12. 阶段C 真实产物验收（§8.4 + P0-06 写回）

Type: task
Status: resolved
Owner: main session · 2026-10-27
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

## Answer（验收 · 2026-10-27）

**验收脚本**：`.scratch/fpvs-v1-p1/acceptance.mjs`（`node` 跑一次，**零付费、只读** `fpvs-v1-p0` 历史产物）。
**统一报告**：`.scratch/fpvs-v1-p1/runs/2026-10-27-stage-c/qa-report.json`（QA 层 + `delivery`，过 `qa-report/v1` schema）。

- **试玩**：读 `smoke3/playable/result.json`（`ok:false`、`stage:"navigate"`、`collected=1/4`）→ `mapPlayableSmoke`
  归 **incomplete + UNKNOWN**（不提前认定 AGENT_LIMITATION）；`knownLimitations[]` 写票 05 Q3 事实化措辞；
  证据 4 条（result.json / console.json / exceptions.json / fail-navigate.png）。
- **视觉**：转录票 02 Answer 的 P0-06 裁定 `{status:"pass", reviewer:"人（本次会话用户）", reviewedAt:"2026-10-27"}`
  —— **转录真实历史裁定，不冒充重新评审**。
- **verdict**：`incomplete` —— 由 `buildDeliveryReport` 确定性算出来（试玩 UNKNOWN ⇒ 不满足完整交付，不是手打的布尔）。
- **版本关联**：`pack = { packId:"wasteland-scavenger-recipe", packVersion:1, manifestChecksum:… }`（复用 subject）·
  `config.file = wasteland-scavenger-recipe/run/v1/game-config.json` · `site = { version:1, shell:"2" }`。

**§2.1 八问落点**：① 生成完整执行（asset-pack/config/qa/site 全 pass）· ② 资源/配置过确定性校验（pass）·
③ 站点构建成功（site pass + v1）· ④ 试玩未完成、卡 `navigate`（incomplete + 证据）· ⑤ 归因 UNKNOWN（尚未确定）·
⑥ 视觉已人工确认（visual-review pass + 人 + 2026-10-27）· ⑦ 不满足正式交付（verdict incomplete）·
⑧ 每条结论绑 pack/v1 ↔ config ↔ site/v1。

**验证**：报告 `QAReportSchema.safeParse` 过、`delivery.verdict = "incomplete"`、QA 层 `subject` 原样保留、
`site` 不伪造（版本号来自真实 `site/v1` + `site.json`）。
