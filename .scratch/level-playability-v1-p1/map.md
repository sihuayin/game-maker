# Level Playability V1 P1：LP-00～LP-07 实施与验收

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1-p1
Baseline: `wayfinder/level-playability-v1` @ `915aa42` + 本图提交（含 `docs/v7.8/可玩.md`）；生产代码基线 `main` @ `fa17c14`
Status: open · 2026-11-05 开图
Predecessor: [Level Playability V1：只读审计与判据规格](../level-playability-v1/map.md)（已关闭）

> **2026-11-05 开图。** 授权来源：[`docs/v7.8/可玩.md`](../../docs/v7.8/可玩.md)（已批准 PRD）、
> 前图 [final-report.md](../level-playability-v1/final-report.md) §8.3 / §9、[plan.md](../level-playability-v1/plan.md)。
> 本图按 Notes「执行覆盖」**承载实施**，不采用 wayfinder 的「只做决策」默认。

## Destination

LP-00 ～ LP-07 在生产代码中按 PRD 串行实现并逐票验收（一票一 commit），三个强制复核点通过；
冻结语料（`sha256:25e6c891…`）与 39 例矩阵全部回归；`pnpm build` / `pnpm typecheck` / `pnpm test` 绿；
LP-02 复核通过后开 Draft PR，LP-07 后转正式 PR；不合并、不推 `main`、全程零付费。
终点是「判据上线且有证据」，不是「关卡可玩性已验证」。

## Notes

### 执行覆盖（本图承载实施）

- wayfinder 默认「只做决策、不做交付」；本图按用户 2026-11-05 裁定覆盖为**承载执行**，沿用 B/D P1 先例。
- 01、03、04、06、08、09、10 为 `task` / `research`（AFK）；02、05、07、11 为 `grilling`（HITL 复核 / 收口）。
- 票据不能扩大 PRD 与 final-report §8.3 的授权范围；任何越界即停止链条，回到失败票的裁定点。

### 权威与冻结输入

- **PRD（已批准）**：[`docs/v7.8/可玩.md`](../../docs/v7.8/可玩.md)；§9 是票流依据，§4 / §7 是验收依据。
- **规格与判据**：[framework.md](../level-playability-v1/framework.md)、[test-matrix.md](../level-playability-v1/test-matrix.md)、
  [research/03](../level-playability-v1/research/03-spatial-layout-judgments.md)、[04](../level-playability-v1/research/04-mechanic-composition-judgments.md)、[05](../level-playability-v1/research/05-level-completion-judgments.md)。
- **方案与交接**：[plan.md](../level-playability-v1/plan.md)、[final-report.md](../level-playability-v1/final-report.md) §8.3 / §9。
- **语料**：[corpus/inventory.json](../level-playability-v1/corpus/inventory.json)（冻结 `sha256:25e6c891cbb01e456433e104862bc9f03c8404f92fec10acdc93700aca00983d`）、
  [corpus/rejudgment.md](../level-playability-v1/corpus/rejudgment.md)、[fixtures/07-matrix](../level-playability-v1/fixtures/07-matrix/matrix.json)。
- **领域词汇**：`CONTEXT.md` 是唯一权威；本图不新增同义词。

### 开图裁定（用户，2026-11-05）

1. **执行图**：开执行承载图，不跳过地图、不拆成决策票。
2. **基线**：`p1/level-playability-v1` 从 wayfinder 分支 tip 切（审批文档已在内）；文档 PR 与实施 PR 分开处理。
3. **票据切法**：11 票 —— 8 张执行/研究票 + LP-00 / LP-02 / LP-03 三张独立复核票；LP-07 为收口 HITL。
4. **复核失败**：**硬停 + 用户裁定**；受影响判据按 PRD 降级为 `INSUFFICIENT_EVIDENCE`，由复核票记录。

### 分支、提交与推送

- 分支：`p1/level-playability-v1`，从包含本图、PRD 与票据的 wayfinder tip 创建。
- 一票一 commit：`LP-00: …` ～ `LP-07: …`；复核票不产生生产 commit，只产生裁定记录 commit。
- LP-02 复核通过后创建 Draft PR；LP-07 通过后转正式 PR。**不自动合并；不推 `main`。**
- 推送 GitHub 走 ClashX 代理 `127.0.0.1:7890`。
- 实施期间不改历史产物：`run/**`、`pack/**`、`site/**`、`fixtures/**`、既有验收证据。

### 证据与验收

- **E1**：源码 / 契约 `file:line`；**E2**：测试名 + 断言 + 退出码；**E3**：零付费语料 / 矩阵复跑（命令、路径、计数）。
- 逐票：该票测试批次绿 + `pnpm typecheck` 绿 + 零付费检查；票内 `## Answer` 记录命令、退出码、commit SHA 与回退点。
- LP-06：全量冻结语料 + 39 例矩阵；新增误报必须根因分析。
- LP-07：`pnpm build` / `pnpm typecheck` / `pnpm test` 全绿；产出最终报告与回退说明。

### 停止线与硬边界

- 三态：`NO_PROVEN_BLOCKER` **不等于**「可玩」；最终报告必须保留该区别。
- LP-00 不能证明的 Runtime 语义，对应判据只能 `INSUFFICIENT_EVIDENCE`；不得把未知假设写成确定性 error。
- 复核未通过 = 链条停止，不得跳票或静默完成。
- 3 条历史真实缺陷记录为已知缺陷，不设路径 / 环境 / run ID 例外；不重发布旧 run/pack。
- **零付费**：不调用模型、不生图、不重建站点、不产生新付费 Demo。
- 不新增 QA 第 8 条；QA 保持 7 条，统一移动模型。
- 不新增 CLI / MCP 参数；不新增持久化 Playability schema；不新增 `ConfigIssue.code`（C2–C6 不采用）。
- 不改 Runtime 行为；不新增 EntityKind / Motion / 机制 / 斜坡碰撞。
- **不合并 PR、不推送 `main`。**

### 票流

1. [LP-00 Runtime 语义核验](issues/01-lp00-runtime-semantics.md)（research，AFK）— **resolved**
2. [LP-00 复核：Runtime 语义证据是否充分](issues/02-lp00-review.md)（grilling，HITL，blocked by 01）— **resolved**
3. [LP-01 基础几何模型](issues/03-lp01-geometry.md)（task，AFK，blocked by 02）— **resolved**
4. [LP-02 空间可达性判据](issues/04-lp02-spatial.md)（task，AFK，blocked by 03）— **resolved**
5. [LP-02 复核：空间判据可靠性与误报](issues/05-lp02-review.md)（grilling，HITL，blocked by 04）— **resolved（有条件通过，条件已满足）**
6. [LP-03 机制可通行性判据](issues/06-lp03-mechanic.md)（task，AFK，blocked by 05）— **resolved**
7. [LP-03 复核：机制判据语义一致性](issues/07-lp03-review.md)（grilling，HITL，blocked by 06）— **resolved**
8. [LP-04 关卡完成性判据](issues/08-lp04-completion.md)（task，AFK，blocked by 07）— **resolved**
9. [LP-05 Pipeline 集成](issues/09-lp05-pipeline.md)（task，AFK，blocked by 08）— open
10. [LP-06 历史语料与负例验收](issues/10-lp06-corpus.md)（task，AFK，blocked by 09）— open
11. [LP-07 最终收口](issues/11-lp07-closeout.md)（grilling，HITL，blocked by 10）— open

## Decisions so far

- [LP-00 Runtime 语义核验](issues/01-lp00-runtime-semantics.md)：P1 带边界 `CONFIRMED`（solid/chest/danger/player 用 `body ?? size`；pickup/hazard/goal 物理体按图集帧，等价性由 pack acceptance 保证、schema 不强制）；P2 `CONFIRMED`（`body` 只对 solid/chest/danger 生效）；P3 `CONFIRMED`（chest 交互盒四边外扩 `range`）；P4 **`CONTRADICTED`**（Runtime 无 spawn 专用处理，深/静止重叠不分离）。证据见 [research/01-runtime-semantics.md](research/01-runtime-semantics.md)。
- [LP-00 复核](issues/02-lp00-review.md)：**PASS WITH BOUNDARIES**。P4 降级（`SPAWN_IN_TERRAIN` 仅观察）；P1 有条件接受（acceptance 不确认 ⇒ `coverage.partial`）；P2/P3 确认并写入统一 Runtime geometry profile；`EntityDesc.box` 以 Runtime 为准；`hazard.body` 忽略。LP-01 携带五项强制约束。
- [LP-01 基础几何模型](issues/03-lp01-geometry.md)：统一 Runtime geometry profile + 共享移动图落地（纯加法，未改既有审计/Runtime）；body 系 vs 帧系几何与 coverage 分离；walk / walk-off / fall / hop 边；19 例新测试、contracts 857 例全绿。`EntityDesc.box` 调用方已清点，审计不消费它。
- [LP-02 空间可达性判据](issues/04-lp02-spatial.md)：`auditSpatial` 落地（三态 + coverage；BLOCKED 优先、UNREACHABLE 其次；chest range 四边外扩；pickup/goal 忽略 body；出生点只诊断不硬拒）。23 例空间矩阵转生产夹具；冻结语料 20 唯一 config：0 阻断、2 例 gate-missing 证据不足、18 例层内无阻断，对既有 reachability 新增/修复 0。研究矩阵三处修正（#19 降级、#4 subject、#12 gate 实际不可达）见票据 Answer。
- [LP-02 复核](issues/05-lp02-review.md)：**有条件通过，条件已满足**。UNREACHABLE 必须以「搜索模型无遗漏」为前提；补 mid-air touch-only 保守降级（`cbc93a8`，`PLAYABILITY_SPATIAL_MIDAIR_TOUCH_UNPROVEN`，只降级、不写可达集）。矩阵口径当时定为 **17/17/5**，后被 LP-03 复核修正为 **18/17/4**；层内 verdict / coverage / 整关 aggregate 三者分离。空间 46 例、契约 904 例、全仓 2491 例、typecheck 0；20 唯一 config 回归 0 新增 / 0 修复。Draft PR [#28](https://github.com/sihuayin/game-maker/pull/28) 已创建。LP-04 完成性重判后，#39 由机制层阻断，39 例整关分布应为 **19/16/4**（待确认）。
- [LP-04 关卡完成性判据](issues/08-lp04-completion.md)：`auditCompletion` 落地 —— `R[mask]` mask DP（k≤12）、复位边保留计数、gate 只算收齐后命中、空间/机制根因抑制。10 例矩阵转生产夹具；23 例新测试；契约 953 例、全仓 2540 例、typecheck/build 全绿。20 唯一 config：0 完成性阻断、14 层内无阻断、6 证据不足（2 gate-missing + 4 跨层抑制），kMax 9。两处归因修正：#32 归空间层、#39 归机制层，39 例分布需确认为 **19/16/4**。
- [LP-03 复核](issues/07-lp03-review.md)：**通过**。A/B 语义接受；矩阵 #28 修正为 **18/17/4**；语料 4 命中（3 历史 + 1 probe）与 04 研究一致；Q5(b) fall 边过近似记为残余风险，LP-05 接成硬拒前修。复核通过后推送 LP-03 更新 Draft PR #28，进入 LP-04。
- [LP-03 机制可通行性判据](issues/06-lp03-mechanic.md)：`auditMechanic` 落地 —— A 静止 hazard 非支撑禁区 + 反事实；B 单全高 danger 的闭式安全窗口；巡逻 / moving-platform / 被包住目标 / 多 danger / 非全列 danger 一律 gap。共享 `reach.ts` / `targets.ts` 与 LP-02 同底座。25 例新测试；契约 930 例、全仓 2517 例、typecheck/build 全绿。20 唯一 config：4 个机制阻断（3 历史 + 1 probe）、14 证据不足、2 层内无阻断，与研究一致。矩阵 #28 `pickup-in-static-hazard` 生产层为 PROVEN（同一 hazard 封死其后目标），39 例分布由 LP-03 复核裁定为 **18/17/4**。

## Not yet specified

<!-- 暂无：LP-05 接线点已收敛到票据 09 的 Context。 -->

## Out of scope

- **编译提示词修改**（`packages/assets/src/ops.ts`）：final-report §8.3 明确未分配、未授权；需要时另立票据。
- **C2–C6**：`ConfigIssue.code`、持久化 verdict、QA 第 8 条、profile 生产入参、逐帧 atlas 几何。
- **Runtime 修改**：新 EntityKind、Motion、机制、斜坡 / 非 AABB 碰撞、外壳行为。
- **接口扩展**：CLI / MCP 新参数、持久化 Playability schema、对外 API 形状变更（C1 加法导出除外）。
- **付费验证**：模型调用、生图、站点重建、新付费 Demo。
- **历史改写**：修改 `run/**`、`pack/**`、`site/**`、`fixtures/**`、既有验收证据；重发布旧 run/pack。
- **塔防 `td-config/v1`**：本轮只覆盖横版 `game-config/v1`。
- **V1 明确不判定**：巡逻 hazard、moving-platform、被 hazard/danger 包住的收集物、多 danger 联合、同刻约束、`k>12`、负坐标目标、mid-air touch-only、spawn-no-foothold、逐帧 atlas 几何 —— 一律 `INSUFFICIENT_EVIDENCE`，不硬拒。
- **把 Agent 试玩结果当判据**：`AGENT_LIMITATION` / `TIMEOUT` / `ENVIRONMENT_FAILURE` 不得转成不可玩。
- **难度 / 节奏 / 路线优劣 / 体验评价**：保留为观察项。
- **把 P4 降级扩展成 Runtime 修复需求**：出生点分离行为不在本轮修改范围。
- **PR 合并、推送 `main`、自动合并。**
