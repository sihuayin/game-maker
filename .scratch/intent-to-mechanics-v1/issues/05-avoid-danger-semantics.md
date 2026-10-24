# 05. avoid-danger 端到端语义：可观察的规避成功/失败判定

Type: prototype
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 01
Map: ../map.md

## Question

`avoid-danger`（文档 FR-05）**可观察的「规避成功/失败」信号**是什么：危险触发条件、玩家受影响、规避方式、
结束/恢复条件的 config + runtime 语义，以及 QA 怎么从运行时状态区分「规避成功」与「未规避」。

## 现状（E1）

- 无 `avoid-danger`；现有 `hazard-contact` 是「接触 → `hitHazard` 复位到出生点、保留计数」（`scene.ts:275-282`），
  **无成败判定**。设计层 hazard = 意图 `type:"enemy"` → `enemies[]`（自由文本）。
- 第一轮裁定（Q3）：**独立机制**，必须有可观察的规避成功/失败判定，不得是 jump + hazard-contact 的别名。

## 建议

以 **prototype** 定信号。候选语义：危险在时间/空间窗口内激活，玩家在该窗口内**未进入危险区** = 规避成功、
**进入** = 失败；QA probe 读运行时状态（player 位置 × hazard 激活区 × 时间窗口）区分两者。config 最小：hazard 加
`{ 激活窗口/条件, 影响, 规避方式, 恢复条件 }`，外加一条可读的「规避结果」运行时状态。承载实现：`game-config.ts` +
`world.ts`/`scene.ts` + probe（见 [票 06](06-behavioral-qa-probe.md)）。

## Answer

**裁定（2026-10-23 · 用户逐字）**：

- **Q1 危险实体 = (a) 新 `EntityKind = "danger"`**：`hazard` 继续对应 `hazard-contact`，`danger` 对应独立机制
  `avoid-danger`；`ENTITY_KIND_FATE` 映射保持干净，不让一个实体类型扛两套机制语义。
- **Q2 命中影响 = (a) 复用复位**：规避失败回到出生点、`collected` 计数保留；P0 不新增扣血/生命值/失败惩罚系统。

**落定语义**：

1. 新 `EntityKind = "danger"` + `strike = { periodMs, activeMs }`；打击区 = 实体盒子（`body` / asset size）。
2. 状态机：`idle`（安全）→（periodMs）→ `active`（喷发）→（activeMs）→ `idle`；`active` 时玩家在区内 → hit（复位 = 失败），区外 → 安全（规避成功）。
3. 与 `hazard-contact` 的区别：**离散打击 + 安全窗口**（「规避」= 掐在 idle 窗口穿过），不是持续接触。
4. QA（[票 06](06-behavioral-qa-probe.md)）读运行时状态 `danger.state ∈ {idle, active}` + 每危险 `hits` 区分成败。

实现切片 → 毕业成 [票 14](14-avoid-danger-impl.md)。
