# 写回前校验 Demo 身份：实施

Type: task
Status: resolved
Blocked by: 01, 04

## Question

按票 04 的裁定收紧写回身份校验。最低不变量：

1. **先红**：新增失败测试，证明当前以下路径会被错误接受 ——
   - Playtest 报告缺 `configChecksum` / `packChecksum` 时仍写回；
   - `harnessVersion` / `rulesVersion` 与当前常量不一致时仍写回；
   - `review-verdict` 缺 `--review-record`、记录 subject 与交付不符、或 `overall` 与 `--verdict` 不一致时仍写回。
2. **Playtest 写回**：按票 04 —— 要求 `configChecksum` / `packChecksum` 存在；config 对当前 config 字节重算、pack 用 `manifestChecksumOf(packDir)` 重算；`harnessVersion` / `rulesVersion` 对 `PLAYTEST_HARNESS_VERSION` / `PLAYTEST_RULES_VERSION` 比对。任一缺失/不符 → exit 4，写 `writeback-error.json`（attempt 目录），qa-report 原样。**不改** `PlaytestIdentitySchema` / `DeliveryReportSchema`。
3. **`review-verdict`**：按票 04 ——
   - 在 `packages/contracts` 新增 `visual-review-record/v1`（`format` / `reviewedAt` / `reviewer` / `overall` / 六字段 `subject` / 可选 `note`）；
   - 必填 `--review-record <path>`；移除 `--reviewer` / `--note`，`delivery.visualReview` 直接取记录字段；
   - 要求 `delivery.site` 已存在；记录 subject 与 delivery pack/site/shell + 实际 pack/config 字节比对；`overall` 必须等于 `--verdict`；
   - 缺参数 → exit 2；记录不可用/schema 不过/subject 不符/overall 不一致 → exit 4，写 `run/vN/review-verdict-error.json`，qa-report 原样；
   - 删除 `initialDeliveryWithReview` 及对应测试；不校验截图/材料哈希；不改 MCP。
4. **测试**：负向测试覆盖每条身份不符/缺失；`visual-review-record/v1` schema 测试；`review-verdict` 正向写回（记录字段权威、只动视觉三处）；删除初始化分支后不留回归；现有测试更新。
5. **真实证据**：冻结 Demo 现有 harness v1 / rules v1 报告必须被拒（记录该负向 E3）；成功写回的真实证据使用 HEAD CLI 在**独立副本**上产出的新 v2 attempt（票 14 也会产一份）；记录命令、退出码、attempt、身份、历史零改动。阶段 A 不做新人工视觉（Q9），`review-verdict` 只做 E2。
6. **回归**：目标测试 + `pnpm typecheck`；不改历史。

产物：代码 + 测试 + `research/10-writeback-identity-evidence.md`。未获票 04 裁定前不开工。

## Answer

**2026-10-30 实施收口。** 证据：[research/10-writeback-identity-evidence.md](../research/10-writeback-identity-evidence.md)。

### 实现

- Playtest 写回：`configChecksum` / `packChecksum` 必须存在；config 对实际字节、pack 用 `manifestChecksumOf` 重算；`harnessVersion` / `rulesVersion` 必须等于 v2 常量；缺失/不符 exit 4，qa-report 原样。
- 新 `visual-review-record/v1`（contracts）：`reviewer` / `reviewedAt` / `overall` / 六字段 `subject` / 可选 `note`。
- `review-verdict`：必填 `--review-record`；`--reviewer` / `--note` 移除；记录是权威来源；要求 `delivery.site`；比对记录 subject 与 delivery 的 pack/site/shell + 实际 pack/config 字节 + 站点 config；`overall` 必须等于 `--verdict`；失败写 `run/vN/review-verdict-error.json`，qa-report 原样。
- 删除 `initialDeliveryWithReview` 初始化分支与测试；不改 `PlaytestIdentitySchema` / `DeliveryReportSchema`、不扩 MCP、不校验截图/材料哈希。

### 证据

- 全量 `pnpm test` **150 文件 / 2256 tests** 全绿；`pnpm typecheck` exit 0；历史证据验收 exit 0。
- 负向 E3：旧 harness v1 / rules v1 报告被拒（`harnessVersion=playtest-harness/v1 … v2`），副本 qa-report 未变。
- 正向 E3：HEAD CLI 在独立副本上真实 playtest **exit 0 / 24s / attempt v3**，新报告 harness/rules v2 + 正确 checksums；写回 `playable-smoke=pass`、`verdict=pass`；副本仅 qa-report 变化，基线副本未动。
- 零付费；未提交；阶段 A 不做新人工视觉，`review-verdict` 只有 E2。
