# 10. smoke 退役与自测迁移（effort 末尾硬切）

Type: task
Status: resolved
Map: ../map.md
Owner: main session · 2026-10-27
Blocked by: 06, 08, 09

## Question

按票 06 Q3 的硬切顺序，在新 harness 与真实产物验收完成后执行退役。**硬切的是实现，不是历史报告契约**。

1. 删除 `packages/demo/probe/playable-smoke.mjs`、`packages/contracts/src/playable-smoke.ts`、`packages/contracts/tests/playable-smoke.test.ts` 与 `PLAYABLE_SMOKE_*` 常量/导出。
2. 移除根 `test:playable`，新增 `test:playtest`（`pnpm build` + 离线五态/写回/自测；不含付费调用）。
3. 迁移 harness 自测，**不进五态交付场景集**：
   - `pickup` → 复用 `failure-missing-pickup`（`required:false`，setup 移除 pickup；断言落在初始态 pickup 缺失，票 04 Q4）；
   - `input` → harness 条件场景（注入按键阻断；断言走不动，不判游戏失败）；
   - `gate` → 装配期拒绝的单测（`assembleSite`/`assembleFromConfig` 对不存在的 gate 必须拒绝）；
   - `hazard-legacy` → 页面会话猴子补丁旧 `hitHazard`（只动本次页面，不改站点字节），验证 reset-floor 专项仍能抓住旧实现。
4. 落地 `CONTEXT.md` 词汇（按本图重定义，不继承闭环模型旧义）：`Runtime Observation` / `Runtime Event Log` / `Runtime Black Box` / `Semantic Test Action` / `GameplayTestPlan` / `Critical Path` / `Evidence`；与 `playtest` / `attempt` / `InsufficientEvidence` / `not-executed` 的关系写清楚。
5. 历史兼容：旧 `qa-report/v1` 的 `playable-smoke` 数据继续可读；旧 smoke 结果**不升级**为新 harness 证据或基线数据；`delivery.playtest` 继续可选。
6. 保留 `probe-harness.mjs` 并继续复用 CDP/Chrome 启动；不复制第三套浏览器基础设施。

## 验收（完成条件）

- 删除旧 smoke 后全仓测试绿 + typecheck 绿；`pnpm test:playtest` 覆盖五态 + 自测；
- 旧 `qa-report/v1`（含 `playable-smoke`、无 `delivery.playtest`）仍可解析，消费者正确标注「旧 smoke 结果」；
- `SHELL_VERSION` 不升、站点字节不动；无新增付费调用；
- 仓库里只剩一套试玩执行机制（新 harness）与一份交付消费者（`playable-smoke` 键 + `delivery.playtest` 摘要）。

## Answer（施工 · 2026-10-27）

硬切完成：旧 smoke 实现退役，自测迁到新 harness 的自测入口，词汇落地。**历史报告契约保留**：`playable-smoke` 交付键仍在，旧 `qa-report/v1` 的 `playable-smoke` 数据仍可读，旧结果不升级。

### 1. 删除 / 迁移

- 删除 `packages/demo/probe/playable-smoke.mjs`、`packages/contracts/src/playable-smoke.ts`、`packages/contracts/tests/playable-smoke.test.ts`、`PLAYABLE_SMOKE_*` 与 contracts 导出。
- 根 `package.json`：移除 `test:playable`，新增 `test:playtest`：

  ```bash
  pnpm test:playtest
  # = pnpm build && node packages/demo/probe/playtest/self-test.mjs
  #   && vitest run <五态/归因/基线/写回/observer/scenario 测试>
  ```

  旧 smoke 删除后，仓库里只剩新 harness 一套执行机制。
- `probe-harness.mjs` / `mechanic-probe.mjs` 的注释改为「历史来源：旧 smoke，已退役」；浏览器机器仍只有这一份。

### 2. 自测（`packages/demo/probe/playtest/self-test.mjs`）

- **gate**：用旧夹具 pack/config 把 gate 指向不存在的 id，`assembleSite` 按预期装配期拒绝（硬失败、不产站点）。
- **pickup**：复用 `failure-missing-pickup`（`required:false`），setup 移除一个 pickup；初始 `activePickups=2`、`missing-pickup` 断言 `fail`（断言值按 3 个 pickup 的旧夹具校准）。
- **input**：新增 harness 条件 `input-blocked`，注入按键阻断；`progress=0.0px`、未终止 ⇒ 自测证明「走不动」会被记录，不判游戏失败。
- **hazard-legacy**：页面会话猴子补丁旧 `hitHazard`（只动本次页面，不改站点字节），reset 后 30 帧 `body.bottom` 最大 371.75 > floorY+1、`onFloor` 未变真 ⇒ 旧实现按预期被 reset-floor 抓住。
- 全部复用 `probe-harness.mjs` 的 CDP/Chrome；没有第三套浏览器基础设施。证据：`.scratch/playtest-v1/runs/2026-10-27-self-test/summary.json`。

### 3. CONTEXT.md

新增「Playtest V1（2026-10-27 捡回并重定义）」：`Playtest` / `Playtest Attempt` / `Runtime Observation` /
`Runtime Event Log` / `Runtime Black Box` / `RuntimeEntity` / `Semantic Test Action` / `GameplayTestPlan` /
`Critical Path` / `Evidence` / `Playtest Outcome` / `InsufficientEvidence` / `not-executed`。
「已出局」一节移除这些已捡回词，并注明旧义不继承；`Runtime Bridge`、四类 QA、门禁/修复循环/Checkpoint 等仍出局。

### 4. 验证

- `pnpm test`：**143 files / 2129 tests** 全绿；`pnpm typecheck` 全绿。
- `pnpm test:playtest`：自测四项全绿 + **78 tests**（五态归因 13 · 基线 11 · 交付摘要/映射 30 · 晋升 6 · 写回 6 · observer 8 · scenario 4）全绿。
- 历史兼容：旧阶段C `qa-report.json` 仍可解析、无 `delivery.playtest`、未升级；`DeliveryReportSchema` 的 `playable-smoke` 键与旧 `detail` 形状不变。
- `SHELL_VERSION` 未升、站点字节未改；零付费调用。

### 5. 目的地

10 张票全部收口，地图无 open ticket。**Playtest V1 目的地已到**：新 harness + 五态归因 + 交付接入 +
可重放/基线 + 真实产物验收 + smoke 退役。后续若要做「失败定位与低成本重跑 / 自动修复」是 P2，不在本图。
