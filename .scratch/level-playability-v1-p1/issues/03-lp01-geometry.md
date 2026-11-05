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

### 必须交付

- 实现：按 [plan.md](../level-playability-v1/plan.md) §1 的修改面（`packages/contracts/src/playability/…`），纯函数优先。
- 单测：AABB 相交 / 包含 / 边界接触；Solid 阻挡；Walk / Fall 可达与不可达；锚点与碰撞偏移；`body` 覆盖。
- 本票 `## Answer`：commit SHA、命令与退出码、测试清单、回退点。

### 边界

- 只建模型，不实现任何可玩性判据。
- 不引入未经 LP-00 确认的物理行为；无斜坡、非 AABB、逐帧 atlas。
- 不改 Runtime；不改历史语料；零付费。

### 通过标准

- AC-02：AABB、Solid、Walk / Fall 测试通过；与 LP-00 语义一致；不引入未确认物理行为。
