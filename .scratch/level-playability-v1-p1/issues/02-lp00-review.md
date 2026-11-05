# LP-00 复核：Runtime 语义证据是否充分

Type: grilling
Status: resolved
Owner: amber · 2026-11-05
Blocked by: 01
Map: ../map.md

## Question

HITL 复核 [LP-00 Runtime 语义核验](01-lp00-runtime-semantics.md) 的证据档案，裁定是否可进入几何实现（PRD §4.1 / §6.3 第一次强制复核）。本票由用户裁定，agent 只呈现证据与影响分析。

### 必须裁定

1. P1–P4 每项证据是否充分、是否可复现？是否存在用推测补齐语义的情况？
2. 标为 `CONTRADICTED` / `INSUFFICIENT_EVIDENCE` 的项，相关判据是降级为 `INSUFFICIENT_EVIDENCE`，还是缩小本轮范围？
3. LP-01 可使用的几何语义边界是否明确？P1 的逐帧 atlas 误差边界是否已写清（本轮不解决，只记录）？
4. 是否通过复核。**不通过则硬停**：裁定修复、缩小范围或放弃，不得进入 LP-01。

### LP-00 已暴露的裁定点

P4 为 `CONTRADICTED`、P1 带边界、P2/P3 为 `CONFIRMED`。复核必须逐项裁定：

1. **P4**：Runtime 无 spawn 专用处理，深垂直重叠 / 静止水平重叠不分离。`PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` 是降级为 `INSUFFICIENT_EVIDENCE` / 仅观察，还是按原 PRD 保留？理由与影响面必须记录。
2. **P1 边界**：审计输入看不到图集 JSON；接受「依赖逐帧几何的严格判定在无法确认 pack acceptance 时用 `coverage.partial`」吗？
3. **P2 / P3**：确认可作为确定性判据的基础；chest 交互盒四边外扩 `range` 是否写入 profile。
4. **`EntityDesc.box` 分歧**：运行时对 pickup / hazard / goal 忽略 `body`，而 `EntityDesc.box` 对全部 kind 都算 `body`；确认审计必须以运行时几何为准。
5. **hazard body**：源码证明 hazard body 被忽略；[plan.md](../level-playability-v1/plan.md) 的保守降级是策略选择而非语义缺口，是否保留该策略。

### 输出

- 本票 `## Answer`：逐项裁定 + 受影响判据 + 对 LP-01～LP-04 的约束。
- 更新 `../map.md` 的 Decisions so far；必要时新增 / 调整票据，清理已清晰的 fog。

### 通过标准

- P1–P4 每项有明确处置（证据充分 / 降级 / 阻断）。
- 通过时能一句话回答：「哪些几何假设现在可以作为确定性判据的基础」。

## Answer

**2026-11-05 · 用户裁定 · PASS WITH BOUNDARIES。**

P4 假设被源码推翻不代表 LP-00 失败；处理方式是修正判据，不是沿用错误假设。复核通过，但必须遵守以下语义边界。

### 五项裁定

1. **P4 出生点 —— 批准降级。** `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` 不得作为确定性阻断判据，降为 `INSUFFICIENT_EVIDENCE` / 仅观察。保留出生点与地形重叠的诊断信息；不得仅凭几何重叠判定出生点不可玩；不得接入确定性阻断。后续若有可靠的 Runtime 行为证据，可单独重新评估。
2. **P1 尺寸与锚点 —— 有条件接受。** 静态实体使用已确认的 Runtime `entityBox` 语义；帧相关实体必须考虑实际图集帧几何。pack acceptance 已确认时，允许使用对应的几何保证；acceptance 无法确认时使用 `coverage.partial`；缺失图集信息时不得自行用 manifest 尺寸推断为精确碰撞几何。资源尺寸正确，不代表动画每一帧的碰撞几何都正确。
3. **P2 / P3 —— 确认。** 作为确定性判据的基础，并把 Chest 交互范围四边外扩 `range` 写入统一 Runtime geometry profile：

```text
collisionBox(entity) = entityBox(entity.at, entity.body ?? entity.size, manifest.anchor)

solid:  body
chest:  body
danger: body
pickup: atlas-frame geometry
hazard: atlas-frame geometry
goal:   atlas-frame geometry
decor:  no collision

chestInteractionBox = expand(chestBox, range)
chestInteractable   = strictAabbOverlap(playerBox, chestInteractionBox)
```

   Chest 交互判定必须遵循严格 AABB 相交，不额外要求玩家落地。
4. **`EntityDesc.box` 分歧 —— 以 Runtime 为准。** 必须查明 `EntityDesc.box` 的现有调用方；审计逻辑使用统一 Runtime geometry profile；pickup / hazard / goal 不再通过 `body` 产生错误的碰撞盒；不得通过修改 Runtime 行为来迁就审计辅助函数。
5. **hazard body —— 以源码语义为准。** 审计忽略 `hazard.body`，使用 Runtime 实际采用的图集帧几何；pack acceptance 无法确认时标记 `coverage.partial`；不得将配置中的 `hazard.body` 当作替代碰撞盒。证据不足时保守降级，但不退回错误假设。

### 对 LP-01 的强制实现约束

1. 先统一 Runtime geometry profile，各判据不得自行解释碰撞语义。
2. 几何模型必须区分确定性几何与帧相关几何。
3. `coverage.partial` 必须能够向上游判据传播。
4. 出生点重叠不得作为确定性阻断。
5. 不得使用与 Runtime 不一致的 `EntityDesc.box` 语义。

### 对 LP-02 的约束

Chest / Pickup / Gate 可达性判定继承上述约束，不得为了得到更多检测结果而扩大确定性判据范围。

### 不重开

不重新讨论 P1–P4；不把 P4 降级扩展成 Runtime 修复需求。
