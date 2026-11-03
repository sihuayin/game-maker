# 上游审计：plan-assets/recipe 职责与上下游闭环

Type: research
Status: resolved
Owner: research subagent · 2026-11-02
Blocked by: —
Map: ../map.md

## Question

**只读**审计上游资源规划链路，回答：`plan-assets` / recipe 是否完整表达了设计对资源的要求？规划
结果能否被下游审计准确消费？上游缺失是否会被下游可靠捕获？重采样循环是否真正解决了可恢复的
资源规划错误？**若上下游已形成完整闭环，必须明确写出，不得为架构完整而虚构新闸门。**

### 必须交付（E1 源码 / E2 测试，逐条给 `file:line`）

1. **`plan-assets` 与 recipe 的职责边界**：输入（设计、`runtimeRequirements`、清单）、提示词、
   确定性闸门、schema、重采样/失败分档；标出设计需求到资源规划的实际映射关系。
2. **`hudUiGate` 的实际覆盖范围**：触发条件、要求产出的 ui 资源精确形态（面板/图标、九宫格、
   尺寸）、它与 `designCoverageGate` 的分工、哪些设计声明下**不会**触发。
3. **地形 prop 策略现状**：`solid → sprite` 正向线索与安全网（退 `terrain`）的落地位置；
   哪些情况下仍可能产不出合法地形资源。
4. **缺失资源 / 类型不匹配 / 重采样反馈闭环**：逐条链路追踪 —— 设计需要但清单没有、清单有但
   kind 不对、下游拒绝后是否回到可恢复的重采样、错误信息是否足以指向上游。给出每条链路的
   捕获点与最终失败形态。
5. **2026-10-23 历史失败的上游根因复核**：HUD ui 缺失与地形 prop 缺失是否已被完全关闭；若仍有
   残留形态，给出可复现条件（fixture / 设计形态），不要求付费。
6. **已有能力与仍然存在的规划缺口清单**：区分「已关闭」「部分关闭」「未覆盖」，每条附证据。
7. **闭环判定**：就 Q4 的五个问题逐条给结论（`plan-assets` 表达完整性 / 下游消费准确性 / 缺失捕获
   可靠性 / 错误信息明确度 / 重采样有效性），并明确回答「是否需要在 `plan-assets` 新增闸门」。

### 约束

- **只读**：不修改生产代码、提示词、测试、fixture、契约。
- 不跑付费调用、不生图、不调用模型；必要时只用既有 offline 测试与 fixture，记录命令与结果。
- 证据分级：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据。

### 产出

- 报告写入 `../research/02-upstream-audit.md`（相对本票）。
- 本票追加 `## Answer`（一页以内：上下游闭环判定 + 已关闭/部分关闭/未覆盖清单），`Status` 改 `resolved`。

## Answer

**结论：五条历史硬失败（E01-E05）的闭环已成立；整条链对“设计对资源的所有要求”没有完全闭环。不需要在 `plan-assets` 新增闸门。** 详细证据见 [`../research/02-upstream-audit.md`](../research/02-upstream-audit.md)。

### 闭环判定（Q4）

- **plan-assets 表达完整性：部分。** 对 Runtime 契约强制的槽位完整（player/HUD-条件/背景/四桶存在性）；对 layout 地形、未声明 HUD 能力、目标/出口、四桶 kind 不完整。
- **下游消费准确性：部分。** player/solid/hud/background 的 kind 与尺寸被准确消费；pickup/hazard/goal/chest/danger/decor 无 asset-kind 锁；manifest 的 `role` 未进 compile prompt。
- **缺失捕获可靠性：部分。** 已建模类别在花钱前被闸捕获；layout 地形按票 03 (c) 允许退化；未声明 HUD 能力的 HUD 缺失只在花钱后由下游捕获；人工改清单时 build 只重跑覆盖闸。
- **错误信息明确度：部分。** 规划期闸门明确；下游 kind 锁说明 actual/expected；但 `modelHard` 统一写“模型错”，掩盖上游根因；层覆盖那条明确指清单。
- **重采样有效性：部分。** 分档正确，但为盲重采样：三发同 prompt、无错误反馈；系统性错误靠 `clampToWorld` 而非重采样解决。
- **是否新增闸门：不需要。** 五错已由现有闸 + 下游 kind 锁覆盖；HUD 残余是现有 `hudUiGate` 条件过窄 / 设计层无结构化 HUD；地形正向产率是裁定的退化；其余属于下游 kind 锁、build 复验、重采样反馈、设计层表达。新增 plan 闸会重复判据或发明 Runtime 没有的规则。

### 已关闭

- 四桶覆盖（`ops.ts:266-286`；E2 `plan-coverage-gate.test.ts`）、玩家动画（`ops.ts:215-259`；E2 `plan-assets-player-gate.test.ts`）。
- 声明 HUD 时 ui 面板+图标（`ops.ts:300-314`；E2 `plan-hud-gate.test.ts`；E3 历史重放 3 发拒）。
- 背景覆盖（`ops.ts:336-358`；E2 `plan-background-gate.test.ts`）。
- `solid → sprite`（`game-config.ts:366-374`；E2 `game-config.test.ts:181-185`）、`hud.panel/pip → ui` + `auditPanelSize`（`:373-374`、`:404-420`）。
- 下游“模型错”族进重采样（`ops.ts:1189-1204`；E2 `compile-runtime.test.ts:203-231`）；层覆盖不重采样（`:1213-1234`）；`empty-input` 6 发（`structured-call.ts:37`）。
- 真实付费跑产出 HUD ui + 地形 sprite（E3 `wasteland-scavenger-assets/run/v1/asset-recipe.json:176-365`；`stage-b-retry6.log:1-15`）。

### 部分关闭

- HUD 闸只在 `runtimeRequirements` 含 `hud:screen-space` 时触发（`ops.ts:301`），而 `hud` 结构必填（`game-config.ts:223`）。E3：历史设计去掉该能力 + 无 ui 清单 → `planAssets` 1 发通过。
- 地形 prop 只有提示词线索（`prompt.ts:986-989`）；E3：layout 要碎石堆/斜坡、清单无地形 sprite → `planAssets` 通过，下游只能退 `terrain`。
- 四桶覆盖只看 id/characterId、不看 kind（`ops.ts:266-275`）；下游只锁 player/solid/hud/background。
- 人工改清单后 `runBuild` 只重跑覆盖闸（`create-game.ts:517-525`）。
- `modelHard` 把上游根因写成“模型错”（`ops.ts:1201-1202`）；重采样盲（`ops.ts:412-429`、`:1086-1167`）。
- 视口：`UnderstandingInput` 无 `viewport`，`planAssets` 只能用默认值（`create-game.ts:48-77`、`:390-400`），compile/site 用 `BuildInput.viewport`（`:598`、`:645`）；`role` 未进 `resourceBrief`（`ops.ts:941-953`）。

### 未覆盖

- layout 散文 → 地形/道具结构化需求（`game-design.ts:176-190`；前序 out of scope `recipe-config-gap-v1/map.md:92`）。
- 斜坡语义：GameConfig 无斜坡槽位（`game-config.ts:45-53`、`:220-221`），只能 AABB `solid` / `terrain`。
- 目标/出口资源：设计无 goal 桶，config 的 `objective.gate` 必须指向 goal 实体（`game-config.ts:209-213`、`:376-378`）。
- 设计无拾取物：设计允许 `resources: []`（`prompts.ts:273`），config 要求至少 1 个 pickup/chest（`game-config.ts:380-381`）。

### 验证（零付费 / 零模型 / 零生图）

`pnpm exec vitest run` 相关 7 文件 → exit 0，121 tests passed；`plan-assets.test.ts` + `recipes-sweep.test.ts` → exit 0，28 tests passed。历史产物重放：声明 HUD 的历史清单 → 3 发后缺 HUD ui 拒绝；去掉 HUD 能力 → 1 发通过（0 ui）；无地形 sprite → 1 发通过；三发请求体逐字相同。
