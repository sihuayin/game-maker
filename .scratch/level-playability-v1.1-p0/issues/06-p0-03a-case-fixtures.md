# P0-03a 合成案例与 scratch 站点

Type: task
Status: open
Owner:
Blocked by: 01
Map: ../map.md

## Question

构造 A/B/C 三个受控合成案例，并用 `fixtures/packs/last-train` 生成可在真实 Runtime 中运行的 scratch 站点。本票只准备案例与运行器输入，不做判断，不写分析结论。

### 案例定义

| 案例 | 场景 | 预期 |
|---|---|---|
| A | 移动 Hazard 周期经过通道；玩家可以等待后通过 | 分析器识别安全窗口；真实 Runtime 中玩家等待后通过且未被命中 |
| B | 移动 Hazard 始终封锁唯一通道 | 只有当算法能**证明**不存在合法通过路径时才判不可玩；有限试玩失败不算证明 |
| C | 时间相位或碰撞边界无法可靠确定 | 分析器返回 `INSUFFICIENT_EVIDENCE` |

### 必须交付

- `cases/a/`、`cases/b/`、`cases/c/`：每个案例的 `game-config.json`、预期说明、以及与现有 `fixtures/packs/last-train` 的绑定方式。
- `evidence/03a-sites.md`：站点构造命令、退出码、站点 / 包路径、校验和；证明没有修改既有 fixture / 历史配置。
- 使用现有 playtest harness 的场景 JSON（必要时用 `setup.kind = "mutate-hazard"`）；**不新增站点观察字段**。
- C 案例只需分析器输入；不强制构造 Runtime 站点。

### E3 可复现交付（P0-01R 裁定）

P0-03a 建站时必须提供**可重复执行的只读扫描脚本**（落盘到本 effort 目录），并重新记录：

- hazard 总数与 moving 数量；
- frames 数量；
- `badSize`、`badAnchor`；
- 速度区间；
- 扫描范围、输入基线 SHA 和脚本版本。

新扫描结果与 [`../evidence/01-moving-hazard-semantics.md`](../evidence/01-moving-hazard-semantics.md) 的原数字不一致时，**必须解释差异**，不得静默覆盖旧报告。

### 边界

- 不改 `fixtures/**`、`run/**`、`pack/**`、`site/**`；所有新产物写入本 effort 目录。
- 不调用模型、不生图、零付费。
- 若 A/B 在现有 harness 下无法取得必要证据，停止并提交 P0-03R 裁定，不得静默扩展 harness。
