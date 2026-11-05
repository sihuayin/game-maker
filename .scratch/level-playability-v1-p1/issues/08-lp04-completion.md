# LP-04 关卡完成性判据

Type: task
Status: open
Owner: —
Blocked by: 07
Map: ../map.md

## Question

按 PRD §4.5 实现关卡完成性判据：验证收集全部必要物品后是否仍能到达终点。本票 AFK。

### 判据

| 判据 id | 算法摘要 |
|---|---|
| `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT` | 带标签图 + mask DP（`k ≤ 12`）；收齐全部必需 pickup / chest 后到 gate；hazard / danger 复位边保留计数；复用 LP-02 的 gate 谓词；LP-02 / LP-03 已报根因抑制 |

### 必须交付

- 在空间可达图上增加收集状态；搜索从出生点到终点、满足必要物品收集要求的合法路径。
- 使用 Mask DP 或等价状态搜索；必要收集物数量硬限制 `k ≤ 12`，超出返回 `INSUFFICIENT_EVIDENCE`。
- 正例、反例、边界测试（含「全部物品可达但无法通关」）；39 例矩阵中完成性类用例转为生产测试。
- 不允许通过忽略收集状态宣称关卡可完成。
- 本票 `## Answer`：commit SHA、命令与退出码、测试清单、语料结果、回退点。

### 边界

- 不重复 LP-02 / LP-03 的根因报告。
- 不改 Runtime；不改历史语料；零付费。

### 通过标准

- AC-05：能识别所有必要物品可达但最终无法通关；完整收集后存在通关路径时能给出证据。
- 搜索状态与边界条件正确；超出可靠计算范围返回 `INSUFFICIENT_EVIDENCE`。
