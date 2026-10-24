# 代码地形调查（Intent-to-Mechanics 前置）

> 2026-10-23 三支并行探针结果汇总。所有 `file:line` 针对当前工作树
> `/Volumes/shy/some-projects/game-maker`。证据强度 **E1**（源码）。供本图各票引用，避免重复探测。

## A. Contracts / 机制表面

- **机制单一来源** `packages/contracts/src/vocabulary.ts:34-51`：`MECHANICS` 常量数组（8 条：run / jump /
  gravity / collide-terrain / collect-pickup / moving-platform / hazard-contact / reach-goal）；zod 枚举由它派生
  （`:53`）。`CAPABILITIES` 同模式（`:66-83`）。文件头明示「它单独一层、谁也不拥有」。
- **RuntimeProfile** `packages/contracts/src/runtime-profile.ts:114-119`：`PLATFORMER_V1 = { id:"platformer",
  version:"1", mechanics:[...MECHANICS], capabilities:[...CAPABILITIES] }`。仅 4 字段（`RuntimeProfileSchema
  :84-94`）；**无** entities / triggers / stateChanges / configSchema / qaProbes。消费点：`game-design.ts:146`、
  `game-design/src/build-design.ts:121-145`、`compile-design.ts:20,156-164`。
- **R12** `packages/game-design/src/build-design.ts:153-178`（`buildDesign` 汇总三个子检查）：① `cameraSupported`
  （`:121-131`）② `profileDifferences`（`:134-145`，mechanic-unsupported / capability-unsupported，今天恒空）
  ③ `intentCoverage`（`:93-118`）。错误契约 = `{ reason, detail }`（`build-design.ts:48`），`reason ∈ REJECT_REASONS`
  （`:39-45`：intent-entity-missing / intent-mechanic-missing / camera-unsupported / mechanic-unsupported /
  capability-unsupported）。**无** mechanicId / requirementId / stage / code 字段。
- **设计层机制** `game-design.ts:79-82`：`GameDesignMechanicSchema = { id, mechanic: MechanicSchema(封闭枚举) }`；
  `mechanics` 数组可为空（`:112-113`，票 74 移出 gate，空数组靠 R12 覆盖兜底）。四桶 `:169-172`：
  enemies `{id, behavior, threat}` / npcs `{id, role, interaction}` / interactables `{id, type, behavior}` /
  resources `{id, purpose}`（全自由文本）。**无 hazard 桶** —— hazard = 意图 `type:"enemy"` → 设计 `enemies[]`。
- **意图层机制** `game-intent.ts:79-82`：`GameIntentMechanicSchema = { id, name(自由文本) }`（刻意不枚举，让 R12
  有东西可拒）。**无** sourceType / priority。`ambiguity: z.array(z.string())`（`:183`）。
- **意图覆盖** `intent-coverage.ts:110-132`：`auditIntentCoverage(intent, design) → MissingIntentItem[]`，只返回
  **缺失项**（空数组 = 覆盖成立）；机制只按 id 判（`:127-129`）。分派到 R12 拒绝 + QA 意图族。

## B. Runtime shell / GameConfig

- **Shell** `packages/demo/src/shell/`：`entry.ts`（读 `config.format` 分派）、`scene.ts`（横版 Phaser 渲染）、
  `td/scene.ts`。纯层**不在** shell/ 下：`packages/demo/src/world.ts`（`buildWorld :126`）、`td/world.ts`、`draw.ts`、
  `hazard.ts`。中心纯函数 `(manifest, game-config) → WorldDescription`（零 Phaser，`world.ts:1-14`）。
- **8 机制实现状态**：run / jump / gravity / collide-terrain / collect-pickup / hazard-contact / reach-goal 已实现；
  **moving-platform 未实现**（数据模型 `Motion` 有、`world.ts:100-110 floorYOf` 排除动 solid、可达性 `:67-72` 建模
  全扫掠，但渲染器只在 `case "hazard"` 读 `motion`（`scene.ts:154`），带 motion 的 solid 是静态体、永不移动）。
- **GameConfig** `packages/contracts/src/game-config.ts`：`EntityKind = ["solid","pickup","hazard","goal","decor"]`
  （`:50`）；`Entity = { id, kind, at, asset, anim?, body?, motion? }`（`:74-83`）；`Motion = {kind:"cycle", axis,
  distance, periodMs}`（`:59-65`）；`Objective = {kind:"collect-then-reach", gate}`（`:184-188`）。**无** interactable /
  enemy / npc / resource 运行时 kind。
  - pickup：无 payload / 奖励 / 道具类型，仅隐藏 + 计数 + 点亮第 i 个 pip（`scene.ts:254-264`）。
  - hazard：接触 → `hitHazard` 复位到出生点、保留计数（`scene.ts:275-282`）。无 HP / 伤害 / 成败。
  - goal：`objective.gate = id`，`tryWin` 要求 `collected >= pickupCount`（`scene.ts:284-289`）。
- **gap**：open-chest 与 avoid-danger 在 shell / config **零表示**（shell 只绑移动 + 跳跃 `scene.ts:73-87`，无
  「交互」输入；无 interactable EntityKind）。设计层会因封闭 `MechanicSchema` 在 compile-design（R12）拒绝。
- **扩展成本（platformer/v1 内加机制）**：改 `EntityKind`/`MECHANICS` 词表、v3+v4 schema（含 `config-tool.ts:31-39,
  68-77` 镜像）、`world.ts` EntityDesc + 映射、`scene.ts` addEntity switch + update 循环、`auditReferences`/
  `auditGameConfig`（`game-config.ts:271-477`）校验、`witness.test.ts`。≠「新玩法模式」（那是 +场景 +纯层 +一行分派
  +`SHELL_VERSION`，见 CONTEXT.md 塔防）。

## C. QA / Pipeline

- **6 判据** `packages/contracts/src/qa.ts:110-152` `QA_JUDGEMENTS`：palette-binding / constructive-constraint /
  layer-coverage / reference-resolution / reachability / intent-coverage。三族：视觉（constructive-constraint +
  palette-binding）、玩法（reference-resolution + reachability）、意图（intent-coverage）；layer-coverage 无族、
  由合成器跑（`qa/src/assemble.ts:89-97`）。`qaVerdict` incomplete 当 `checked.length < 6`（`qa.ts:393-397`）。
- **玩法 QA 纯静态**：`qa/src/gameplay.ts:77-81` = `auditReferences`（静态引用解析）+ `auditReachability`
  （`reachability.ts:44` 纯几何 BFS「不跑游戏」）。**不观察运行时行为**（正是文档风险三要禁的）。
- **无 per-mechanic probe**。最接近的：`packages/demo/probe/playable-smoke.mjs` —— headless Chrome CDP，注入运行时
  状态探针（player x/y/body/onFloor、collected、won、pickups[]、hazards[]、gate、solids、scrollX），截图 + console
  错误 + trace；但**写死** v7 ruin-scavenger fixture（`DEFAULT_PACK`/`DEFAULT_CONFIG`），非机制驱动。
- **Pipeline** `packages/pipeline/src/create-game.ts`：`UNDERSTANDING_STEPS = [visual-world,intent,design,
  character-dna,recipe]`（`:40`）、`BUILD_STEPS = [pack,config,qa]`（`:41`）。R12 在 `compileDesign`（`:345-351`）。
  **无正式 gate 抽象**，检查内联；唯一命名门禁 `publish-gate.ts:145 assertPublishableQa`（`verdictProblem :127-137`
  =「无 error 且 6/6」）。QA 块 `create-game.ts:560-622`（`assertQaPassed :621`）。
- **覆盖报告现状**：`intent-coverage.ts` 只返回缺失项；无 per-mechanic satisfied/missing 矩阵。
- **gate 接缝**：`create-game.ts:621`（assertQaPassed 后）、`publish-gate.ts:127-137`（verdictProblem）、
  `QaRunner`/`QaContext` 注入（`qa.ts:455-499`）。加第 7 判据需改 `QA_JUDGEMENTS`；`pixel.ts:56` 明确「不加第 7 判据」
  的既有政策 ⇒ 机制覆盖报告宜做**独立报告/门禁**而非第 7 判据。
