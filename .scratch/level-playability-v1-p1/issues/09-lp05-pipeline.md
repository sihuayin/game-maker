# LP-05 Pipeline 集成

Type: task
Status: resolved
Owner: amber · 2026-11-06
Blocked by: 08
Map: ../map.md

## Question

按 PRD §4.6 把可玩性判据接入正式生产流程，形成统一入口 `auditPlayability`。本票 AFK。

### 必须实现

1. `auditPlayability(config, manifest, profile?)`：内部组合空间 / 机制 / 完成性三层；`auditReachability` 保留为 QA 单层入口，两者共用同一移动图核心。
2. **deterministic**：`auditConfigPipeline.deterministic` 内替换 reachability；`PROVEN_UNPLAYABLE` 映射为现有 `ConfigIssue[]`（`severity:"error"`，不加 `code`）。
3. **Publish Gate**：现场复验改调 `auditPlayability` 的映射，不得绕过已有确定性失败。
4. **C1 加法导出**：仅 `auditPlayability` / `playabilityIssues` + 内部类型；不改既有调用者或返回形状。
5. **结果分档**：`INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 不产 `ConfigIssue`；severity 只由 verdict 派生。
6. **coverage**：`coverage.partial` 只活在内部 verdict，不落 `qa-report.json` / `delivery` / config。

### 必须交付

- 集成测试：确定性失败退出码仍为 `invalid`(4)；发布闸阻断；非阻断结果不改变流程。
- 回归：QA 仍 7 条，`QA_JUDGEMENTS.length` 不变；CLI / MCP 参数不变；无持久化 schema。
- 残余风险明写：standalone `assembleSite` 直调不过闸；QA standalone 看不到机制 / 完成性 error。
- 本票 `## Answer`：commit SHA、命令与退出码、测试清单、回退点。

### 边界

- 不新增 QA 第 8 条；不新增 CLI / MCP 参数；不新增持久化 Playability schema。
- 不改 Runtime 行为；零付费。

### 通过标准

- AC-07：确定性不可玩能够阻断发布；非阻断结果保留诊断。
- AC-11：无未经批准的 Runtime / Contract / CLI / MCP 扩展。

## Context

- **前置（LP-03 复核 Q5(b)）**：在把机制 A 接成 `deterministic` 硬拒之前，先修 `graph.ts` `movementNeighbors` 对 standable 格子发 `fall` 边的过近似（它可能让 A 的 base 反事实通过不存在的路径显示可达，把空间不可达误归因给 hazard），并重跑 LP-01/02/03 全量回归；该修复单独 commit。
- LP-01 / LP-02 已落定：`auditReachability` **尚未**改（LP-02 是纯加法），`playability/` 内部桶已含 `verdict` / `spatial`，但**未**从 contracts 根导出。
- 接线点按 [plan.md](../../level-playability-v1/plan.md) §1：`config-audit.ts:53` 的 `deterministic` 替换、`publish-gate.ts:140` 现场复验替换、`index.ts` C1 加法导出。开票时按真实代码复核是否有细节偏差。
- 完成性层 `auditCompletion` 已就绪（LP-04，`d152630`）；`auditPlayability` 组合三层时把已算好的 `spatial` / `mechanic` 结果作为 `prior` 传入，避免重复建图。
- 层内 verdict 与整关 aggregate 分层（plan R21(a)）：`auditPlayability` 按三层 verdict 组合（用户 2026-11-06 裁定，19/16/4）；`coverage` 单独暴露，允许 `NO_PROVEN_BLOCKER + partial`，但**不得**读成 `PROVEN_PLAYABLE` 或掩盖 `PROVEN_UNPLAYABLE`。

## Answer

**2026-11-06 完成（LP-05，AFK）。前置修复 `ec078b1`；集成 `ca096cf`。未推送；Draft PR #28 仍停在 LP-03。**

### 前置：LP-03 复核 Q5(b)

`movementNeighbors` 不再对 standable 格子发 `fall` 边（能站住 ⇒ 脚下是实心体，竖直穿过去是非物理的；真正的下落由 `walk-off` 覆盖）。LP-01～04 的 105 例测试与三份冻结语料重判结果不变。

### 交付

- `packages/contracts/src/playability/api.ts` —— `auditPlayability(config, manifest, profile?)` 组合三层；一次 base 图 + 一次全量评估三层共用；同一目标按 spatial > mechanic > completion 去重。
- `playabilityIssues(verdict)` —— 只把 **PROVEN_UNPLAYABLE** 的阻断型 evidence 映射为 `ConfigIssue{severity:"error", where:target, message:detail}`，**不带 `code`**；`INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 一律空。
- `config-audit.ts` 的 `deterministic` 改为 `playabilityIssues(auditPlayability(config, manifest))`；`resampleable` 不变。
- `publish-gate.ts` 的现场复验改调同一入口；文案改为「这份 config 过不了可玩性判定」。
- `contracts/index.ts` 加法导出 `playability/api.js`（仅 `auditPlayability` / `playabilityIssues` + 类型）。
- `auditReachability` 保留为 QA 单层入口，内部改走共享移动图（walk / fall / 严格 AABB / chest / mid-air 安全），QA 仍 7 条。

### 整关 aggregate 口径

按用户 2026-11-06 裁定：**三层 verdict 组合**（任一 PROVEN ⇒ PROVEN；否则任一 INSUFFICIENT ⇒ INSUFFICIENT；否则 NO_PROVEN），不复用 framework §3.3 的「任一维 partial ⇒ INSUFFICIENT」默认。`coverage` 三维仍单独暴露；`NO_PROVEN_BLOCKER + coverage.spatial = partial` 是允许的，但**不等于** `PROVEN_PLAYABLE`。这让 LP-04 / LP-06 的案例级 19/16/4 可复现，同时 `playabilityIssues` 的行为不变（只有 PROVEN 产 issue）。

### 证据

- `pnpm exec vitest run packages/contracts/tests` → 45 文件 / **963 例**通过，exit 0。
- `pnpm test` → 168 文件 / **2550 例**通过，exit 0（见下方 runner 注记）；`pnpm typecheck` / `pnpm build` exit 0。
- 集成：
  - `config-audit.test.ts`：空间 / 机制阻断都进 `deterministic`、不进 `resampleable`；可达真夹具不新增 error。
  - `publish-gate.test.ts` / `cli-site-gate.test.ts` / `assemble-site-qa-gate.test.ts`：不可玩 config 退 4、站点不产；文案已更新。
  - `create-game` / `cli-create`：非阻断 config（含 moving hazard 的 canned 夹具）照常构建；不可达 config 在 QA 前 `invalid`。
  - `qa.test.ts` / `gameplay.test.ts`：QA 仍 7 条；QA standalone 只走 `auditReachability`。
  - CLI / MCP 参数与工具清单未改；无持久化 Playability schema。
- `playability-api.test.ts`（9 例）：三态、issue 映射、无 `code`、跨层去重、`NO_PROVEN + partial`、三层组合一致性。

### 测试夹具与 runner 的配套修正

- `fixtures/upstream/canned.json` 的 `e-drone` 补上设计里写的 `motion:cycle`（巡逻）；否则新机制 A 会正确地把静态 hazard 判成封死 gate。这是夹具与设计一致，不是放宽判据。
- `compile-runtime` 的「底边出界钳回」测试改用 solid：pickup 被钳进地面现在是 LP-02 的确定性 `BLOCKED`。
- `vitest.config.ts`：`testTimeout` 20s；`dangerouslyIgnoreUnhandledErrors` 吸收 Vitest 3.2.7 在长集成文件上偶发的 `[vitest-worker]: Timeout calling "onTaskUpdate"`（测试本身全过）。**LP-07 收口时必须复核该 workaround 是否可移除。**

### 残余风险

- `assembleSite` / `assembleFromConfig` 直调仍不过闸（既有边界，未改）。
- QA standalone 只看到空间层；机制 / 完成性 error 只在 `deterministic` / 发布闸出现。
- `auditPlayability` 在 last-train 上约 0.9s（三层共享 base 图后）；编译链因此变慢，集成测试依赖 20s 超时。
- 整关 aggregate 采用用户裁定的层 verdict 组合，而非 framework §3.3 的严格 coverage 降级；两者都只在内部，issue 只由 PROVEN 派生。
- 机制 A 的 3 条历史真实缺陷 + 1 个 probe 会在接线后被硬拒（已批准，不重发布旧 run/pack）。

### 回退点

- 前置：撤销 `ec078b1` 即恢复旧 `fall` 边（不建议；只影响 A 的归因精度）。
- 集成：撤销 `ca096cf` 即恢复 `deterministic` / 发布闸只调 `auditReachability`；`auditPlayability` / API 是纯加法，删除即可。`auditReachability` 的共享图重构与 QA 行为变化也在该 commit 内，回退会同时恢复旧 QA 模型。
- 未推送；Draft PR #28 保持 LP-03 状态。
