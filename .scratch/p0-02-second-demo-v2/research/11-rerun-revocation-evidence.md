# 票 11 · 失败重跑撤销实施证据

- 日期：2026-10-30
- 票：[失败重跑撤销实施](../issues/11-rerun-revocation-implementation.md)
- 上游裁定：[票 05](../issues/05-rerun-revocation-semantics.md) · `rulings-2026-10-29.md` 第 7 节
- 结论：**撤销 + 预失效落地；E2 全绿；E3 准备拒绝与成功恢复各一次通过**。零付费；未提交；基线副本 / 旧 work / 快照零改动。

## 1. 红：改动前的缺陷

[00-stage-a-facts.md](00-stage-a-facts.md) §2 记录（HEAD `f0411e6`）：

- 准备阶段拒绝只写 `playtest/rejections/*.json`，**不触碰旧 delivery** ⇒ 旧 `playable-smoke=pass` 保留。
- harness 崩溃、无可解析 `result.json` ⇒ 只写 `harness-error.json`，qa-report 不动。
- 写回被拒（身份/IO）⇒ 只写 `writeback-error.json`，旧 pass 保留。
- `verify-delivery` 的 `playable-smoke` 从 `delivery.playtest` 重算；保留旧摘要时，声明 `incomplete` 会与重算 `pass` 冲突。

本轮新增测试把上述行为逐条取反（撤销、无结果 blocked、各失败映射、成功恢复、声明↔重算一致）。

⚠️ 诚实说明：实现与测试在同一会话完成，未单独保留改前代码的失败运行日志；红状态由事实快照与测试断言固定。

## 2. 绿：实现内容

- 新 `packages/pipeline/src/playtest-invalidation.ts`：
  - `invalidatePlayableSmoke(runDir, reason)`：读取 qa-report + delivery；**移除 `delivery.playtest`**、移除旧 `playtest-*` 证据引用、`playable-smoke=blocked`（detail 说明旧结果已撤销 / attempt 进行中）、重算 verdict、原子写回；
  - 写 `run/vN/playtest/invalidations/<timestamp>.json`（原因、before/after、removedRefs）；重复撤销幂等，每次 attempt 留一条记录；
  - qa-report 不可读 / 无 delivery ⇒ `ok:false`（无法撤销的边界）。
- `packages/cli/src/playtest.ts`：
  - 在任何准备校验**之前**，只要 runDir 合法 + qa-report 可读且带 delivery，就调用撤销；
  - 准备拒绝时把撤销结果（record / before / after / 失败原因）写进 rejection 记录；
  - 之后有可解析报告 → 写回按 `mapPlaytest` 重算；无结果/准备拒绝/写回 IO 失败 → 保持 `blocked`；成功 → 恢复 `pass`。
- 不扩 `delivery` schema、不新增 attempt 字段。

## 3. E2

| 测试 | 结果 |
|---|---|
| `packages/pipeline/tests/playtest-invalidation.test.ts` | 4 tests（旧 pass→blocked、幂等、无 delivery、无报告） |
| `packages/pipeline/tests/playtest.test.ts` | 16 tests（撤销后成功恢复；GAMEPLAY_FAILURE→fail、ENVIRONMENT_FAILURE→blocked、TIMEOUT/UNKNOWN→incomplete；无结果→blocked） |
| `packages/cli/tests/playtest-invalidation.test.ts` | 1 test（准备拒绝前已撤销，CLI exit 4） |
| `packages/pipeline/tests/evidence-integrity.test.ts` | 22 tests（撤销后声明 blocked ↔ 重算 blocked） |
| 全量 `pnpm test` | **152 文件 / 2268 tests** 全绿 |
| `pnpm typecheck` | exit 0 |
| 历史证据验收（`--out` 本 effort） | exit 0（223 文件 / 13 records / 诊断 0） |

## 4. E3 · 准备拒绝：旧 pass 先撤销

独立副本：`work/ticket11-prepare-reject/`（删除 `site/v1/game-config.json` 制造准备拒绝）。

```
node packages/cli/dist/cli.mjs playtest \
  .scratch/p0-02-second-demo-v2/work/ticket11-prepare-reject/wasteland-scavenger-recipe/run/v1 \
  --out .scratch/p0-02-second-demo-v2/work/ticket11-prepare-reject
```

- 退出码 **4**；耗时 <1s；日志 `runs/ticket11-prepare-reject.log`。
- 错误：`站点配置不存在：wasteland-scavenger-recipe/site/v1/game-config.json`。
- 撤销：`playable-smoke pass → blocked`；`delivery.playtest` 移除；8 条旧 `playtest-*` 引用全部移除；`verdict pass → blocked`。
- invalidation 记录：`run/v1/playtest/invalidations/2026-10-30T02-08-43-798Z.json`（before/after/removedRefs）。
- rejection 记录包含 `invalidation` 的 before/after 与记录路径。
- qa-report sha256：`dc20e301…5ee6` → `2d5b3f5b…7aa6`（仅撤销写回；副本独立）。

## 5. E3 · 成功写回：撤销后恢复 pass

独立副本：`work/ticket11-success/`。

```
node packages/cli/dist/cli.mjs playtest \
  .scratch/p0-02-second-demo-v2/work/ticket11-success/wasteland-scavenger-recipe/run/v1 \
  --out .scratch/p0-02-second-demo-v2/work/ticket11-success
```

- 退出码 **0**；耗时 **19s**；attempt **v3**；日志 `runs/ticket11-success.log`。
- invalidation 记录：before `pass/pass` → after `blocked/blocked`；随后成功写回恢复 `playable-smoke=pass`、`verdict=pass`。
- 新报告 identity：harness/rules v2、pack/config checksums 正确。
- qa-report sha256：`dc20e301…5ee6` → `ac7fda43…dcf`（预期写回）。

## 6. 历史与零付费

- 基线副本 qa-report 仍为 `dc20e301…5ee6`；旧 work 95/95、冻结快照 66/66 未变。
- 真实运行只启动本地 Chrome；零模型/付费调用；未提交、未推送。
- 无结果 / 硬崩溃路径由单元测试覆盖（撤销后保持 blocked）；本轮 E3 覆盖准备拒绝与成功恢复，未声称硬崩溃的真实运行。

## 7. 变更文件

- `packages/pipeline/src/playtest-invalidation.ts`（新）+ `src/index.ts`
- `packages/cli/src/playtest.ts`
- `packages/pipeline/tests/playtest-invalidation.test.ts`（新）
- `packages/pipeline/tests/playtest.test.ts`
- `packages/pipeline/tests/evidence-integrity.test.ts`
- `packages/cli/tests/playtest-invalidation.test.ts`（新）
