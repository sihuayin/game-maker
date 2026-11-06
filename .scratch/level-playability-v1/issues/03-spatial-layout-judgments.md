# 空间布局候选判据

Type: research
Status: resolved
Owner: research subagent · 2026-11-05
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

## Answer

研究完成 2026-11-05。报告：[03-spatial-layout-judgments.md](../research/03-spatial-layout-judgments.md)；零付费探针 `03-spatial-probes.mjs`、`03-corpus-spatial.mjs`（均退出 0）。

### 新增确定性 error（仅三类）

| 判据 id | 口径 | 语料新增 |
|---|---|---|
| `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE` | chest 作为必需目标进可达图（含 `range` 交互盒）；与 pickup / gate 同一套图 | 0 |
| `PLAYABILITY_SPATIAL_{PICKUP,CHEST,GATE}_BLOCKED` | 目标完全埋进实心体、无任何自由玩家重叠位置；`BLOCKED` 与 `UNREACHABLE` 同一目标互斥，`BLOCKED` 优先 | 0 |
| `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` | **窄口径**：脚点 + 锚点 offset + 附近无 standable；纯盒重叠会误伤 11/20，不采用 | 0 |

### 模型原语修正（不新增 id，改变既有 `auditReachability` 质量）

- 真实盒重叠替换 `covers`（不再「一个身位内」算够到）；
- 补走路 / 净空边，修复低天花板误报（02 probe F 2→0）；
- `solid + motion` 按运行时静态原位，不再按整段行程当平台；
- pickup / goal 用运行时几何（忽略 `body`），`body` 被忽略记为观察。

### 不新增 / 不可写

- 出生点卡 `solid` 归 `auditGameConfig`；世界边界归既有 `inWorld`；台阶 / 沟宽 / 走廊宽维持既有 reachability + warning。
- `PLAYABILITY_SPATIAL_SPAWN_NO_FOOTHOLD` 落 `INSUFFICIENT_EVIDENCE`（缺 kill plane / 掉出世界语义）。
- 斜坡 / 非 AABB / moving platform / 逐帧 atlas 尺寸 / 设计↔config 空间关系：不可写或 `INSUFFICIENT_EVIDENCE`。

### 误报边界

- 出生点纯盒重叠在 20 份唯一 config 上误伤 11 份；窄口径 0。
- 不要求目标 standable（运行时只要求 overlap）；`BLOCKED` 必须是「无自由重合位置」，密封腔归 `UNREACHABLE`。
- chest 在 `range` 可覆盖的实心体内不报。

### 语料

20 份唯一配对 config：三类新 error **0**；0 embedded target；0 chest error；0 moving solid；0 pickup/goal `body` 覆盖。

### 升级 07 / 09

- 07：合法边界与负例清单见报告 §6（spawn 锚点嵌入、低天花板、40px 沟/墙、moving solid 静态、`body` 覆盖等）。
- 09：`FixedRuntimeProfile` 需新增「出生点与静态几何重叠时的分离行为」与「manifest 标称 size + 资源 anchor = 碰撞几何」；不写入则 spawn-in-terrain / 严格重叠 coverage 只能是 `partial`。
- 09 需冻结 `BLOCKED` / `UNREACHABLE` 的 id 拆分；05 不得重复报 chest / pickup / gate 的空间不可取得。

