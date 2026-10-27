# 10. smoke 退役与自测迁移（effort 末尾硬切）

Type: task
Status: open
Map: ../map.md
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
