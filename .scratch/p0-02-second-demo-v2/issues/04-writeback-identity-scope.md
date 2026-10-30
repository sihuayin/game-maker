# 写回前校验 Demo 身份：范围与落点

Type: grilling
Status: resolved
Blocked by: （无）

## Question

HITL：当前写回只校验部分身份 —— Playtest 写回比对 config/pack checksum，但两者「报告带才比」；`harnessVersion/rulesVersion` 只记录不与常量比较；`review-verdict` 只查 run 目录形状、qa-report 存在、verdict 合法，不校验截图/材料/Demo 身份（`packages/cli/src/cli.ts:784-818`）。请裁定：

1. **Playtest 写回身份**
   - (a) 收紧现有字段：config/pack checksum 变为必填并强制比对；`harnessVersion/rulesVersion` 与常量比较；site/pack/shell 保持现有校验。字段已在报告里，不需要扩 schema。
   - (b) (a) + 在 `delivery` 中记录 harness/rules / attempt 身份（需扩 `DeliveryReportSchema`）。
   - (c) 只记录、不强制。
2. **`review-verdict` 身份**
   - (a) 写回前要求 `--review-record`（或 run 内审核记录），比对记录的 subject 与 `qa-report.delivery` 的 pack/site/shell/config；不校验截图/材料哈希。
   - (b) (a) + 截图/材料路径与哈希校验（需要新记录格式/契约）。
   - (c) 不改 `review-verdict`，只做 Playtest 写回。
3. **契约批准**：若选择需要新增输入/字段，是否在本票批准？

已知事实：`delivery` 身份只有 `runId`、`pack`、`config`、可选 `site`，没有 harness/rules；`DeliveryVisualReviewSchema` 只有 `status/reviewer/reviewedAt/note`；阶段 A 不做新人工视觉审核（Q9）。

建议（待裁定）：**1(a) + 2(a) + 3 批准必要输入**。理由：覆盖「写回前校验 Demo 身份」的核心，不把截图/材料哈希（阶段 B 的视觉审核才需要）塞进阶段 A；Playtest 身份字段已存在，不需要扩 `delivery` schema。

产物：票内 Answer + 追加裁定；未裁定前不写生产代码。

## Answer

**2026-10-29 HITL 收口。** 逐字裁定见 [rulings-2026-10-29.md 第 6 节](../rulings-2026-10-29.md)。

### 已定契约

| 项 | 决定 |
|---|---|
| Playtest schema | **不改** `PlaytestIdentitySchema` / `DeliveryReportSchema`；checksum 字段仍可选 |
| Playtest 写回 | 要求 `configChecksum` / `packChecksum` **必须存在**并强制比对：config 对当前 config 字节重算，pack 用 `manifestChecksumOf(packDir)` 重算；`harnessVersion` / `rulesVersion` 对当前常量比对；任一缺失/不符 → exit 4，写 `writeback-error.json`，qa-report 原样 |
| 旧报告 | 冻结 Demo 现有 harness v1 / rules v1 的 `playtest/v2/result.json` 会被拒写；由票 14 产新的 v2 attempt |
| review-verdict | 必填 `--review-record <path>`；要求 `delivery.site` 已存在；记录 `subject` 与 delivery（pack/site/shell）+ 实际 pack/config 字节比对；不校验截图/材料哈希 |
| 审核记录 | 新增 `visual-review-record/v1`（`packages/contracts`）：`format`、`reviewedAt`、`reviewer`、`overall`、六字段 `subject`、可选 `note`；旧 `fpvs-visual-review-record/v1` 仅作历史证据，不被生产 CLI 消费 |
| 记录权威 | `delivery.visualReview` 直接取记录的 `reviewer` / `reviewedAt` / `note`；CLI 移除 `--reviewer` / `--note`；记录 `overall` 必须与 `--verdict` 一致 |
| 初始化分支 | 删除 `initialDeliveryWithReview` 及对应测试（`delivery.site` 缺失即拒绝，不再初始化 delivery） |
| 失败语义 | 缺 `--review-record` → exit 2；记录不可用/schema 不过/subject 不符/overall 不一致 → exit 4，写 `run/vN/review-verdict-error.json`，qa-report 原样 |
| 批准例外（Q5 边界内） | ① 新增 `visual-review-record/v1`；② `review-verdict` 必填 `--review-record` 并移除 `--reviewer`/`--note`；③ Playtest 写回行为收紧；④ 删除不可达初始化分支。不改 MCP、不新增依赖、不校验截图/材料哈希 |

### 实现义务（已回写下游票）

- [写回身份实施](../issues/10-writeback-identity-implementation.md)：先红负向测试、Playtest 写回强制比对、`review-verdict` 记录校验、schema、诊断文件、删除初始化分支、E2/E3 证据。
