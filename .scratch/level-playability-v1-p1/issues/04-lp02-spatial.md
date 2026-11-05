# LP-02 空间可达性判据

Type: task
Status: open
Owner: —
Blocked by: 03
Map: ../map.md

## Question

按 PRD §4.3 实现空间可达性判据。本票 AFK。

### 判据

| 判据 id | 检测内容 |
|---|---|
| `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` | 窄口径：脚点 + 锚点 offset + 附近无 standable；纯盒重叠不采用 |
| `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE` | chest 交互盒（`range` 外扩）无路径可达 |
| `PLAYABILITY_SPATIAL_{PICKUP,CHEST,GATE}_BLOCKED` | 目标完全埋进实心体、无任何自由玩家重叠位置；`BLOCKED` 与 `UNREACHABLE` 同目标互斥，`BLOCKED` 优先 |

### LP-00 复核后的强制约束（已批准）

- `SPAWN_IN_TERRAIN`：复核已裁定**不得作为确定性阻断**；只保留诊断，verdict 固定 `INSUFFICIENT_EVIDENCE` / 仅观察，不接入 deterministic 或 Publish Gate。
- `CHEST_UNREACHABLE`：交互盒按四边外扩 `range` 建模（`scene.ts:315-325`），并与玩家 AABB 严格相交。
- 依赖逐帧几何的严格重叠 / `*_BLOCKED`：无法确认 pack acceptance 时使用 `coverage.partial`，不得因此硬拒。

### 必须交付

- 以出生点为起点的玩家空间可达图，复用 LP-01 模型与真实碰撞尺寸 / 锚点。
- 正例、反例、边界测试；39 例矩阵中空间类用例转为生产测试。
- 无法可靠建模的情况输出 `INSUFFICIENT_EVIDENCE`，不得硬拒。
- 冻结语料空间类重判（至少 20 份唯一 config）。
- 本票 `## Answer`：commit SHA、命令与退出码、测试清单、语料结果、回退点。

### 边界

- 只做空间层；不做机制层与完成性。
- 不新增 CLI / MCP 参数；不新增持久化 schema；QA 仍 7 条。
- 不改历史语料；零付费。

### 通过标准

- AC-03：能识别确定性不可达的 Chest / Pickup / Gate 与出生点冲突。
- 合法复杂布局不被简单几何启发式误杀；空间判据不因算法简化误判合法关卡。
