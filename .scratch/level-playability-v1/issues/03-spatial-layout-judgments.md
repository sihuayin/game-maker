# 空间布局候选判据

Type: research
Status: open
Owner: —
Blocked by: 01, 02
Map: ../map.md

## Question

枚举并评估**横版 GameConfig 空间布局**可精确判定的候选判据。输入限定为 `(GameConfig, AssetPackManifest)`，不读设计散文。

### 候选方向（不限于）

- 出生点、实体、目标、拾取物 / chest 与 `terrain` / `solid` 的重叠或越界；
- 沟壑宽度 vs `jumpSpan`；台阶高度 vs `maxJumpHeight`；走廊宽度 vs 玩家宽度；
- 悬空/顶棚造成的不可通过几何；实体锚点/脚点导致的「看起来可达、实际卡住」；
- 低天花板 / 走路走廊：02 已复现现有 `auditReachability` 只建跳跃弧、不建走路边，导致可走走廊被报「够不到」；候选判据必须先决定 walk / clearance 边。
- 带 `motion` 的 solid 扫过整段行程后的几何；
- 目标/拾取物被实心体完全包围；
- 世界边界、地面线缺失、出生点无落脚点；
- 与 `auditGameConfig` 既有台阶高/行程越界警告的关系。

### 每条判据必须给出

1. 精确算法（BFS/区间/几何判定），输入字段，输出形状；
2. 失败定位（entityId / field / expected / actual / 判据 id）；
3. 误报边界：哪些合法设计会被误判；为什么不会；
4. 语料影响：当前语料预计新增 error 数量（可引用 02 的语料事实，不必全量重判）；
5. 分类：`deterministic error` / `observation` / `INSUFFICIENT_EVIDENCE`；
6. 是否依赖现有未实现语义（如斜坡、非 AABB 碰撞）——若是，标记为不可写或超出 Q5 边界。

### 输出

- `../research/03-spatial-layout-judgments.md`。
- 本票 `## Answer` 摘要；更新 map 的 Decisions so far。

### 边界

- 不实现判据；不修改生产代码。
- 不引入结构化 layout 契约；不重开 B-04。
- 不把难度/路线优劣纳入判据。
