# 关卡完成性候选判据

Type: research
Status: resolved
Owner: research subagent · 2026-11-05
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

## Answer

研究完成 2026-11-05。报告：[05-level-completion-judgments.md](../research/05-level-completion-judgments.md)；零付费探针 `05-completion-probe.mjs`（退出 0）。

### 唯一新注册的 completion id

`PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT`

- **问题**：是否存在一条单次游玩走法，收齐全部必需 pickup / chest（`pickupCount` 同一口径）后到达 gate。
- **算法**：带标签图 + mask DP；必需集合最多 12 个；hazard / danger 接触加复位边（回 seeds、mask 不变、计数保留）；gate 谓词复用 03，不另造更严格 overlap。
- **抑制**：同一目标已被 03 的空间判据或 04 的机制判据报过 ⇒ completion 不重复报；coverage 落 `partial`，aggregate verdict 取更基础的 error。
- **降级**：`k > 12`、负坐标、移动图 partial、mid-air touch-only 未验证 ⇒ `INSUFFICIENT_EVIDENCE`，不硬拒。

### 不注册 / 拒绝

- chest / pickup / gate 的几何不可取得 → 03；
- 静止 hazard / 全高 danger 封路 → 04；
- `pickupCount` 与 HUD 计数不一致 → 派生规则，构造上不可能，不是判据；
- chest 顺序、gate 激活 → 并入唯一 completion 判据，不单列；
- 目标「站得住」→ 误报陷阱（运行时只要求 overlap），拒绝；
- 设计层数量 / 可选性 / win 文本 → 结构性不可判，`INSUFFICIENT_EVIDENCE`；
- gate 缺失 / 指向不存在 id → 既有引用族。

### 合法边界（不会被判）

合法 A→B→gate 顺序；单向坑但 gate 在同层；坑底 hazard 复位后计数保留；一次跳跃收多个 pickup；chest 隔墙 + `range`；悬空 / 跳跃穿过 gate；chest 与 hazard 重叠；难但公平的跳跃。低天花板与 moving solid 扫掠区在 03 修复前必须 `INSUFFICIENT_EVIDENCE`。

### 语料

96 配对 / 20 份唯一：88 可完成；8 份 no-walk 全部是 `config-gate-missing` 负例、归引用族；有效 gate 的 completion error **0**；53 个 chest 实例全部可取得。

### 升级 07 / 09

- 07：合法边界与负例矩阵见报告 §10；既有「goal 埋在行李堆」边界按 03 统一改判，completion 不单独决定。
- 09：先落 03 的移动图修复与 chest / gate 判据，再启用 completion（`CHEST_BLOCKED` 可先行）；补复位边、去重优先级、`k` 上限；明写 QA standalone 仍只跑 `auditReachability` 的残余风险。

