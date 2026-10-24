# 意图→机制契约：从 R12 阻塞到可玩闭环

Labels: wayfinder:map
Tracker: local-markdown
Effort: intent-to-mechanics-v1

> **本图 2026-10-23 开。** 输入：`docs/v6/意图.md`（Intent-to-Mechanics Contract v1.0）。
> 前置：P0-FINAL Stage A 重跑在 R12 卡 `intent-mechanic-missing`（`open-chest` / `avoid-danger`
> 超出外壳封闭机制集，8 条机制无对家），见 [`../p0-final-v1/map.md`](../p0-final-v1/map.md)。
> **第一轮裁定**（2026-10-23 用户逐字，全文见 [rulings-2026-10-23.md](rulings-2026-10-23.md)）：
> 承载执行 / 免费证明优先 + 付费独立授权 / avoid-danger 独立机制 / moving-platform 如实标记不实现。
> **代码地形**已由三支并行探针摸清，见 [findings-codebase.md](findings-codebase.md)。
> **全图零付费默认**；任何付费动作单独立票 + 书面预算 + 逐字授权。不提交 / 推送除非单独授权。

## Destination

建立 Intent-to-Mechanics Contract 的**最小完整闭环**：一套可追踪、可验证的机制契约
（意图需求 → 机制契约 → 设计表达 → GameConfig → Runtime 行为 → QA 断言 → 覆盖报告），
以 `open-chest` 与 `avoid-danger` 为两个真实切入机制端到端落地，收口在**免费验收闭环**
（playable smoke 通过 + 机制覆盖报告全绿）。付费 P0-FINAL 重跑是本图最后一票、**单独授权**，不在免费验收内。

## Notes

- **输入文档**：`docs/v6/意图.md`；但**术语以 CONTEXT.md 为准**——文档里的「Gameplay QA / Runtime / Pipeline Gate」
  等旧词要映射到现行词汇（QA 族「视觉/玩法/意图」/ 行为原语 + RuntimeProfile / `publish-gate` + R 检查）。
- **机制单一来源**：`packages/contracts/src/vocabulary.ts` `MECHANICS`（8 条）。加机制 = 扩 `MECHANICS`，
  自动流入 `RuntimeProfile platformer/v1`（`[...MECHANICS]`）。**不要另建平行 schema**（文档 §FR-04 自带的纪律）。
- **R12**：`packages/game-design/src/build-design.ts`；错误 `{ reason, detail }`，`reason` 是 `REJECT_REASONS`
  封闭枚举（含 `intent-mechanic-missing`）。文档 §FR-03 的 `{code, stage, mechanicId, requirementId}` 是**语义示例**，
  不照搬。
- **config**：`EntityKind = solid/pickup/hazard/goal/decor`（票 13/14 加了 `chest` + `danger`）；shell 只绑移动 + 跳跃，无「交互」输入。
- **QA**：6 判据（`qa.ts` `QA_JUDGEMENTS`），玩法 QA 纯静态；`packages/demo/probe/playable-smoke.mjs` 已有 headless
  Chrome 运行时状态探针（写死 v7 fixture）。行为级 probe 从这里长出来，而非另起炉灶。
- **免费验收工具**：`vitest`（单元 + witness）+ `playable-smoke`（机制 probe）+ fixture 包；不碰生图/文本上游。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。
- **工作树纪律**：不改 `fixtures/`、`game-maker.local.json`；付费单独授权；测试产物只写 `out/` 或本 effort 目录。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [01 机制能力注册表](issues/01-mechanic-registry-status.md)：最小账本（`MECHANICS` 纯 id + per-mechanic `status`）；
  `supported` 由「四样齐全」见证**推导 + 阻断**，非 `supported` 机制被 R12 **硬拒绝**（新理由 `mechanic-experimental`）。
- [12 registry 实现切片](issues/12-registry-witness-impl.md)：落地 01 —— `deriveMechanicStatus()`（status 由运行时实现见证推导）、
  R12 `mechanic-experimental` 硬约束、`shell-mechanic-witness.test.ts`（机制侧见证）；`moving-platform` 自动推导成 `experimental`。1827 测试绿。
- [02 意图机制提取](issues/02-intent-source-type.md)：`sourceType` / `priority` **不入 P0**（推迟）；默认语义 = 每条意图机制一律当必需（现有 `auditIntentCoverage` 等权处理，不改）。
- [03 R12 拒绝契约](issues/03-r12-rejection-shape.md)：维持 `{ reason, detail }`，**不结构化** `mechanicId`/`requirementId`（零代码改动）；per-mechanic 关联由 `auditIntentCoverage` 承载、[票 07](issues/07-coverage-report.md) 直接读。
- [04 open-chest 端到端语义](issues/04-open-chest-semantics.md)：触发 = **近距自动**（不新增 interact/capability）；奖励 = **复用 collect-then-reach**（开箱 `collected+1`，`pickupCount` 统计 pickup+chest）。实现切片 → [票 13](issues/13-open-chest-impl.md)。
- [05 avoid-danger 端到端语义](issues/05-avoid-danger-semantics.md)：新 `EntityKind = "danger"` + 定时打击 `strike{periodMs, activeMs}`；命中**复用复位**（回出生点、计数保留）；「规避」= 掐在 idle 安全窗口穿过。实现切片 → [票 14](issues/14-avoid-danger-impl.md)。
- [06 行为级 QA Probe](issues/06-behavioral-qa-probe.md)：**扩展 playable-smoke**（机制化 CDP 状态探针）；probe 是覆盖报告的**独立 QA 层**，不进 `supported` 状态推导。实现切片 → [票 15](issues/15-probe-harness.md)。
- [13 open-chest 实现切片](issues/13-open-chest-impl.md)：落地 04 —— `EntityKind="chest"` + 可选 `range`、`pickupCount` 数 pickup+chest、`advanceChests` 近距自动触发 + 一次性。全绿。
- [14 avoid-danger 实现切片](issues/14-avoid-danger-impl.md)：落地 05 —— `EntityKind="danger"` + `strike{periodMs,activeMs}`（danger 缺 strike 在 superRefine 拦）、纯函数 `dangerState`、`advanceDangers` 定时打击复用复位。全绿。
- [15 QA probe harness](issues/15-probe-harness.md)：落地 06 —— `probe-harness.mjs`（抽自 playable-smoke）+ `mechanic-probe.mjs`（每机制一条 probe）；三条 probe（collect-pickup / open-chest / avoid-danger）真 Chrome 全绿。欠账：playable-smoke 未迁移到 harness。
- [07 覆盖报告](issues/07-coverage-report.md)：新契约 `mechanic-coverage/v1`（三层矩阵）；`design`=`deriveMechanicStatus` / `runtime`=`RUNTIME_IMPLEMENTED` / `qa`=`QA_PROBED`；门禁语义 = missing/unsupported/failed 阻断、not-tested 不阻断。
- [08 Pipeline Gate](issues/08-gate-placement.md)：门禁接 `create-game.ts` `assertQaPassed` 之后 —— `buildMechanicCoverage(design)` → `mechanicCoverageProblem` 非空即 `invalid`。
- [10 免费验收闭环](issues/10-free-acceptance.md)：`pnpm test:acceptance` 全绿 —— vitest 1846 + 三条 probe + 覆盖报告 open-chest/avoid-danger 三层全 satisfied。
- [11 P0-FINAL 付费重跑](issues/11-p0-final-paid-rerun.md)：**失败** —— Stage A 全过（R12 不卡）+ 生图 12 次 0 重试，但 compile-runtime 的 GameConfig 过不了业务校验（5 条硬失败：玩家角色当地形、HUD 绑玩法 sprite）；缺口在设计→config 层，另立 effort。

## Out of scope

<!-- 已裁定超出目的地的工作：关闭，永不毕业 -->

- **补实现 moving-platform**：如实标记为 non-supported 已由 [票 12](issues/12-registry-witness-impl.md) 完成（自动推导 `experimental` + R12 拒引用）；**补实现**（渲染器真移动 solid）另立票，不在本图（[票 09](issues/09-moving-platform-marking.md) 的负向见证未做）。
- **意图机制提取的 sourceType / priority**（文档 FR-02）：P0 不做（[票 02](issues/02-intent-source-type.md) 裁定），
  默认语义 = 每条意图机制一律当必需；「推导/可选机制可不通过」的放松另立 effort。
- **跨项目机制复用 / 设计知识迁移 / 通用编辑器 / 新增完整游戏类型**（文档 §2.2 非目标）。
- **大规模重构现有 8 条机制**：本图只注册，不改其行为（文档 §3.4）。
- **设计→config（compile-runtime）缺口**（付费单跑暴露）：层级组合把玩家角色塞进地形槽、HUD 把玩法 sprite 当 ui 资源 —— 本图只注册机制、不改机制行为，此缺陷超出目的地，**另立 effort**（现场见 [票 11](issues/11-p0-final-paid-rerun.md)）。
