# LP-03 机制可通行性判据

Type: task
Status: open
Owner: —
Blocked by: 05
Map: ../map.md

## Question

按 PRD §4.4 实现机制可通行性判据。本票 AFK。

### 判据

| 判据 id | 含义 |
|---|---|
| `PLAYABILITY_MECHANIC_PATH_BLOCKED` | 非移动 hazard 作为不可站立禁区，确定性封死必要路径；反事实：去掉 hazard 可达、加禁区不可达 |
| `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | 单个全高 danger 横切 spawn 与目标之间；`requiredMs = (d.box.w + player.w) / speed * 1000 > strike.periodMs + 1 帧` |

### LP-00 复核后的强制约束（已批准）

- 运行时忽略 `hazard.body`（`packages/demo/src/shell/scene.ts:151-174`）；机制判据必须使用运行时几何，不得把声明的 `body` 当作 hazard 实际占位。
- hazard 使用运行时图集帧几何；pack acceptance 无法确认时 `coverage.partial`；**不得**把配置 `hazard.body` 当作替代碰撞盒。

### 必须交付

- 在 LP-02 可达图上叠加机制约束；危险区域不得因「存在」即判定不可通行。
- 周期性危险不得因「存在周期」即判定无安全窗口；必须给出 `requiredMs` / `idleMs` 证据。
- 正例、反例、边界测试；39 例矩阵中机制类用例转为生产测试。
- 巡逻 hazard、moving-platform、被机制包住的收集物、多 danger 联合 —— 一律 `INSUFFICIENT_EVIDENCE`。
- 本票 `## Answer`：commit SHA、命令与退出码、测试清单、语料结果、回退点。

### 边界

- 只做机制层；不做完成性。
- 不改 Runtime 机制语义；不改历史语料；零付费。

### 通过标准

- AC-04：能识别危险区域确定性封锁唯一必要路径、以及不存在安全窗口的周期性危险。
- 合法危险机制不被错误阻断；所有阻断可解释、可复现。
