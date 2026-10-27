# 01. 只读审计（试玩现状 + 已出局词汇史）

Type: research
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md

## Question

盘点本 effort 要动的全部现状，产出 grounding 事实清单（供票 02–06 引用，避免各自重复读码）。**只读，不改代码。**

1. **现有试玩链路**：`packages/demo/probe/playable-smoke.mjs` 的场景 / 阶段全集、`result.json` 落盘形状
   （`ok/stage/reason/expected` + 轨迹字段）、负例（gate/pickup/input）、`summary-<mode>.json`；
   `probe-harness.mjs` 抽出了哪些可复用机器、与 `playable-smoke.mjs` 旧拷贝的「两套真相」欠账现状。
2. **状态观测面**：`READ_STATE` 探针当前读到的全部字段（player/pickups/hazards/chests/dangers/gate/solids/scrollX…），
   逐字段标「事件可推」还是「只能快照」。
3. **交付消费点**：`mapPlayableSmoke` / `playableSmokeEvidence` / `playableSmokeKnownLimitations` 的输入输出契约；
   `delivery` 六检查项里 `playable-smoke` 怎么被消费；`DeliveryCheckStatus` / `DeliveryVerdict` /
   `PlayableSmokeAttribution` 现状。
4. **已出局词汇史**：`CONTEXT.md`「已出局」区里 `Runtime Observation / RuntimeEntity / Runtime Event Log /
   Runtime Black Box / Runtime Bridge / Semantic Test Action / GameplayTestPlan / Critical Path / Evidence`
   的原始定义与出处（查 git 历史 / 旧 map），标出哪些本图捡回、哪些仍出局。
5. **证据分级现状**：现有 smoke 证据（console/exceptions/screenshot/trajectory）各属 E0–E3 哪一级，缺口在哪。

产出：`research/audit.md`（能力清单 / 现状快照 / 版本关联 / 缺口清单）。不碰 `fixtures/`、`game-maker.local.json`。

## Answer（审计 · 2026-10-27）

**只读审计完成**，产出 [research/audit.md](../research/audit.md)（206 行，五块 + 缺口清单）。核心事实：

- **试玩链路**：`playable-smoke.mjs` 场景全集 = 正例 `playable`（boot→spawn→won/floor/win/runtime/超时 move·pickup·navigate）
  + `hazard-reset` + `hazard-legacy`，负例 `gate/pickup/input`。`result.json` 成功路径 `trace` 在顶层、失败路径在
  `extra.trace`（`playable-smoke.mjs:639-642` vs `:1097-1104`）。「两套真相」欠账 = `playable-smoke.mjs` 未迁到
  `probe-harness.mjs`，字段漂移（harness 有 `chests/dangers`、smoke 没有；smoke 的 `hazards` 多 `t0`）。
- **状态观测面**：`READ_STATE`（`probe-harness.mjs:205-233`）里 `collected/won/pickups[].active/chests[].opened/
  dangers[].state/hits` 可推事件；`x/y/vx/vy/scrollX` 与静态几何只能快照；`onFloor/blockedRight/touchingRight` 可推边缘事件。
  同帧瞬时事件漏采 = 结构性不可判。
- **交付消费点**：`mapPlayableSmoke` 三档永不产 `AGENT_LIMITATION`（`playable-smoke.ts:8-9,28,44-52`）；
  `deriveDeliveryVerdict` 总序 fail>blocked>incomplete>pass（`delivery.ts:45-55`）；六检查项全必需（`delivery.ts:78-100`）。
  **关键发现**：真实 CLI/MCP 管线从不跑 smoke，只把 `playable-smoke` 写死 `blocked/incomplete`
  （`pipeline/src/delivery.ts:64,86,105,193`），`mapPlayableSmoke` 唯一消费者是手动脚本 `.scratch/fpvs-v1-p1/acceptance.mjs`。
  → 这是票 06 的直接输入。
- **已出局词汇史**：九个词原出处 `e2143cc`（`docs/文档.md` §17/24/25/26/27/28/59/74）与 `0ce36ed`（首版 `CONTEXT.md:86-111`，
  `Semantic Test Action` 只在后者）；出局收口 `1cc6b74`（2026-09-24 终点重画）。
- **证据分级**：E0–E3 定义在 `docs/v4/P0-00-task-brief.md:332-339`。现有 smoke 产出全属 E3（result.json 含 trace、
  console/exceptions、截图、chrome.log、assemble.json），但**回归基线与重放完全不存在**——`trace` 是状态快照不是输入流，
  跑完即弃、无 golden 比对、无回放入口。

**缺口清单（10 条）见 audit.md §6**：五态缺一等归因、无场景契约与版本绑定、观测无事件流、无重放、无回归基线、
smoke 未接真实交付管线、两套真相欠账；「不误判通过」现状已正确（UNKNOWN→incomplete、delivery 缺席≠通过）。

→ 解除 02 / 03 的阻塞。
