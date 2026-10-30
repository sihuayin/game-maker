# 票 10 · 写回前校验 Demo 身份实施证据

- 日期：2026-10-30
- 票：[写回身份实施](../issues/10-writeback-identity-implementation.md)
- 上游裁定：[票 04](../issues/04-writeback-identity-scope.md) · `rulings-2026-10-29.md` 第 6 节
- 结论：**Playtest 写回严格身份 + `review-verdict` 审核记录写回完成；E2 全绿；E3 正/负各一次通过**。零付费；未提交；基线副本与旧历史零改动。

## 1. 红：改动前的缺陷

[00-stage-a-facts.md](00-stage-a-facts.md) §2 / §6 记录（HEAD `f0411e6`）：

- `writePlaytestToReport` 只在报告**带** checksum 时比对；缺字段直接放行。
- `harnessVersion` / `rulesVersion` 只记录，不与常量比较（CLI import 了常量但未使用）。
- `review-verdict` 只校验 run 形状 / qa-report 存在 / verdict 合法；不接审核记录、不校验 Demo 身份。
- `writeVisualReviewToReport` 在无 `delivery` 时会**初始化**一份交付结论（不伪造站点版本，但仍是无身份来源的写回）。

本轮新增测试把上述行为逐条取反（缺 checksum、harness/rules 旧版、缺记录、subject 不符、overall 不符、无 delivery 初始化）。

⚠️ 诚实说明：实现与测试在同一会话完成，未单独保留改前代码的失败运行日志；红状态由事实快照与测试断言固定。

## 2. 绿：实现内容

### 2.1 Playtest 写回（`packages/pipeline/src/playtest.ts`）

- `configChecksum` / `packChecksum` **必须存在**；缺失即 exit 4。
- config 对当前 `delivery.config.file` 字节重算；pack 用 `manifestChecksumOf(packDir)` 重算。
- `delivery.pack.manifestChecksum` 若存在，必须与实际包一致。
- `harnessVersion` / `rulesVersion` 必须等于 `PLAYTEST_HARNESS_VERSION` / `PLAYTEST_RULES_VERSION`。
- 任一不符 → `CommandError("invalid")`（exit 4），qa-report 原样；CLI 写 `writeback-error.json`。
- **不扩** `PlaytestIdentitySchema` / `DeliveryReportSchema`。

### 2.2 视觉审核记录（票 04）

- 新 `packages/contracts/src/visual-review-record.ts`：`visual-review-record/v1`
  （`format` / `reviewedAt` / `reviewer` / `overall` / 六字段 `subject` / 可选 `note`）。
- 新 `writeVisualReviewRecordToReport`（pipeline）：
  - 记录 `overall` 必须等于 `--verdict`；
  - 要求 `delivery.site` 存在；
  - pack checksum 用实际 `manifest.json` 重算；config 用 `delivery.config.file` 与实际站点 config 重算；
  - site.json 的 shell/pack/config 必须与 delivery 一致；
  - 记录 subject 六字段必须与上述实际身份一致；
  - `delivery.visualReview` 的 reviewer/reviewedAt/note **直接取记录**；
  - 只改视觉评审三处，原子写回。
- `review-verdict` CLI：必填 `--review-record`；`--reviewer` / `--note` 已移除（出现即 exit 2）。
- 失败：缺参数 → exit 2；记录不可用/schema 不过/subject 不符/overall 不符 → exit 4，写 `run/vN/review-verdict-error.json`，qa-report 原样。
- 删除 `initialDeliveryWithReview` 不可达初始化分支与对应测试。

## 3. E2

| 测试 | 结果 |
|---|---|
| `packages/pipeline/tests/playtest.test.ts` | 10 tests（含缺 checksum / pack 不符 / harness/rules 旧版） |
| `packages/pipeline/tests/delivery.test.ts` | 17 tests（含缺 delivery 拒绝、原子写） |
| `packages/cli/tests/review-verdict.test.ts` | 10 tests（记录权威、缺记录、schema、subject、overall、无 delivery、跨 run） |
| 全量 `pnpm test` | **150 文件 / 2256 tests** 全绿 |
| `pnpm typecheck` | exit 0 |
| 历史证据验收（`--out` 本 effort） | exit 0（223 文件 / 13 records / 诊断 0） |

## 4. E3 · 负向：旧 harness/rules 报告必须被拒

脚本：`.scratch/p0-02-second-demo-v2/tools/reject-old-playtest.mjs`

```
node .scratch/p0-02-second-demo-v2/tools/reject-old-playtest.mjs \
  .scratch/p0-02-second-demo-v2/work/ticket10-reject-old
```

- 输入：独立副本上的冻结 `run/v1/playtest/v2/result.json`（harness v1 / rules v1）。
- 退出码 **0**（脚本判定「被拒」为成功）；耗时 <1s；日志 `runs/ticket10-reject-old.log`。
- 错误：`试玩报告的 harnessVersion=playtest-harness/v1 与当前 playtest-harness/v2 不一致`。
- 副本 `qa-report.json` sha256 仍为 `dc20e301…5ee6`（未写）。

## 5. E3 · 正向：HEAD CLI 真实 v2 写回

```
node packages/cli/dist/cli.mjs playtest \
  .scratch/p0-02-second-demo-v2/work/ticket10-writeback/wasteland-scavenger-recipe/run/v1 \
  --out .scratch/p0-02-second-demo-v2/work/ticket10-writeback
```

- 独立副本；退出码 **0**；耗时 **24s**；attempt **v3**；日志 `runs/ticket10-playtest.log`。
- 场景 `success-basic`：SUCCESS、断言 pass、终止达成。
- 新报告 identity：`harnessVersion=playtest-harness/v2`、`rulesVersion=playtest-rules/v2`、
  `packChecksum=sha256:a162942d…7feb3`、`configChecksum=sha256:455d9c7f…7dcd`。
- 写回后：`playable-smoke=pass (SUCCESS)`、`delivery.playtest.report=…/playtest/v3/result.json`、`delivery.verdict=pass`。
- qa-report sha256：`dc20e301…5ee6` → `ac7fda43…dcf`（仅预期写回）。
- 副本原 95 文件中**只有 qa-report 变化**；pack/site/config 未改；基线副本 qa-report 仍为 `dc20e301…5ee6`。

## 6. 历史与零付费

- 基线副本、旧 work、冻结快照未触碰；负向副本 qa-report 未变。
- playtest 只启动本地 Chrome；零模型/付费调用；未提交、未推送。
- 阶段 A 不做新人工视觉（Q9）；`review-verdict` 只有 E2，不声称新视觉审核。

## 7. 变更文件

- `packages/contracts/src/visual-review-record.ts`（新）+ `src/index.ts`
- `packages/pipeline/src/playtest.ts`
- `packages/pipeline/src/delivery.ts`
- `packages/pipeline/tests/playtest.test.ts`
- `packages/pipeline/tests/delivery.test.ts`
- `packages/cli/src/cli.ts`
- `packages/cli/tests/review-verdict.test.ts`
- `.scratch/p0-02-second-demo-v2/tools/reject-old-playtest.mjs`（effort-local）
