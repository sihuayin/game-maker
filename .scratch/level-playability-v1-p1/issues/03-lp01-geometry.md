# LP-01 基础几何模型

Type: task
Status: open
Owner: —
Blocked by: 02
Map: ../map.md

## Question

按 PRD §4.2 实现与 Runtime 一致的统一空间几何模型，作为 LP-02～LP-04 的唯一碰撞语义入口。本票 AFK。

### 必须实现

1. **AABB 碰撞区域模型**：真实碰撞盒（`body` 覆盖规则依 LP-00 证据）、锚点与碰撞偏移；不使用图片外接尺寸冒充碰撞盒。
2. **真实几何重叠判定**：相交 / 包含 / 边界接触，替换 `covers` 式近似。
3. **Solid 静态几何模型**：明确哪些对象属于 Solid；solid `motion` 按静态原位处理。
4. **Walk / Fall 路径边**：玩家可行走边与下落边；净空、台阶高与锚点处理以 LP-00 语义为准。
5. **空间关系**：出生点、地形、实体之间的统一查询。
6. **统一碰撞语义入口**：LP-02～LP-04 不得各自实现一套互相矛盾的规则。

### LP-00 复核后的强制约束（已批准）

- 碰撞盒公式：`entityBox(at, body ?? manifest.size, manifest.anchor)`（`packages/contracts/src/game-config.ts:151-158`；`packages/demo/src/world.ts:176-187`）。
- `solid` / `chest` / `danger` / `player` 的碰撞几何由该盒决定；`pickup` / `hazard` / `goal` 的物理体由 Phaser 按图集帧 `sourceSize` + 帧 origin 创建（`packages/demo/src/shell/scene.ts:150-174`）。
- 两种几何的等价性由 pack acceptance 保证，**不在 manifest schema 里**，审计输入看不到图集 JSON ⇒ 无法确认时用 `coverage.partial`。
- 不得直接复用 `EntityDesc.box` 对 pickup / hazard / goal 的 `body` 覆盖；审计必须使用运行时几何。
- chest 交互盒 = 盒四边各外扩 `range`（`scene.ts:315-325`），不是单轴外扩；严格 AABB 相交，不要求玩家落地。
- **出生点重叠不得作为确定性阻断**；`SPAWN_IN_TERRAIN` 仅保留诊断，verdict 为 `INSUFFICIENT_EVIDENCE`。
- **`coverage.partial` 必须能向上游判据传播**；确定性几何与帧相关几何必须显式区分。
- **先查明 `EntityDesc.box` 的现有调用方**，再统一到 Runtime geometry profile；不得修改 Runtime 迁就审计。

### 必须交付

- 实现：按 [plan.md](../level-playability-v1/plan.md) §1 的修改面（`packages/contracts/src/playability/…`），纯函数优先。
- 统一 Runtime geometry profile：`collisionBox(entity)` 按 EntityKind 取 `body` 或图集帧几何；chest 交互盒四边外扩；profile 暴露几何来源与 coverage。
- `EntityDesc.box` 调用方清单（`file:line`）与迁移结论。
- 单测：AABB 相交 / 包含 / 边界接触；Solid 阻挡；Walk / Fall 可达与不可达；锚点与碰撞偏移；`body` 覆盖。
- 本票 `## Answer`：commit SHA、命令与退出码、测试清单、回退点。

### 边界

- 只建模型，不实现任何可玩性判据。
- 不引入未经 LP-00 确认的物理行为；无斜坡、非 AABB、逐帧 atlas。
- 不改 Runtime；不改历史语料；零付费。

### 通过标准

- AC-02：AABB、Solid、Walk / Fall 测试通过；与 LP-00 语义一致；不引入未确认物理行为。
