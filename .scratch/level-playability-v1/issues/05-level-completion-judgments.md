# 关卡完成性候选判据

Type: research
Status: open
Owner: —
Blocked by: 01, 02
Map: ../map.md

## Question

枚举并评估**关卡完成性**可精确判定的候选判据：在现有 `objective: collect-then-reach` 与实体规则下，必须完成的目标是否可完成。

### 候选方向（不限于）

- 必需 pickup/chest 是否全部可取得（可达性上界 + 实体状态）；
- gate 是否在「收集完成」后可达；
- `pickupCount` 与 HUD/目标计数是否一致（现有派生规则）；
- 拾取物/宝箱是否被地形或机制封死；
- 目标位置是否在世界内、是否可站立；
- 多目标之间的顺序约束是否不可满足；
- 与 `auditReachability` 的「只报够不到」上界的关系：完成性是否能在其上界内再收紧而不误伤。

### 02 已确认的事实

- `auditReachability` 的 targets 只有 pickup + gate；**chest 不是 target**，但 `pickupCount` 与 `tryWin` 把 chest 算作必需。
- BFS 只从出生点出发；probe B 已复现「从出生点到 pickup / gate 都可达，但拿到 pickup 后回不到 gate」的单向坑。
- 历史语料 53 个 chest 实例 / 5 份唯一 config，按目标探测 0 个不可达；chest 盲点必须靠合成负例证明。
- 设计层没有数量 / 可选性；config 的 pickup / chest 全部必需。

### 每条判据必须给出

1. 精确算法、输入、输出；
2. 失败定位；
3. 误报边界（尤其「设计上就是难以到达但合法」的反例）；
4. 分类；
5. 与现有 `objective` / `pickupCount` / gate 派生规则的冲突检查。

### 输出

- `../research/05-level-completion-judgments.md`。
- 本票 `## Answer` 摘要；更新 map 的 Decisions so far。

### 边界

- 不改 `objective` 契约、不改 gate 派生规则。
- 不把「路线不好」当完成性失败。
- 不新增 goal 桶（D-04 不在本图）。
