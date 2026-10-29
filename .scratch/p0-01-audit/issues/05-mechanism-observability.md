# 机制与可观测性矩阵（P0-01D）

Type: research
Status: resolved
Blocked by: 01, 02, 03

## Question

对当前代码能够支持和验证的每项机制，核实链路：

`机制声明 → 配置表达 → Runtime 实现 → 实际触发 → 状态或事件观测 → Playtest 判定`

记录：机制名称与设计要求、配置表达方式、实际运行时实现、触发条件、可观测状态或事件、Playtest 如何验证成功与失败、是否只有 fixture 测试、是否已有真实运行证据。

明确区分机制实现与机制验收；不把状态字段存在等同于机制真实发生；不把执行器无法完成动作误判为机制成功；未经真实验证的机制明确标注证据不足。

产物：`.scratch/p0-01-audit/research/05-mechanism-observability.md`。

## Answer

**已收口（2026-10-29，只读；零生产修改）。** 完整链路、每机制证据与限制见 [research/05-mechanism-observability.md](../research/05-mechanism-observability.md)。

- 横版机制词表 10 条，9 条有运行时实现；`moving-platform` 仍是 `experimental`（外壳只在 hazard 分支读 `motion`）。
- 交付级 E3 3 条（`collect-pickup` / `open-chest` / `reach-goal`；冻结 wasteland 交付，pack `a162942d…` / config `455d9c7f…` / site v1 / shell 2；来源 `5b8283f`/`5f29592`，另有 `8e92c69` v2 重跑）；**严格从闭集声明起点的全链只有前 2 条**，`reach-goal` 只在 `winConditions` 自由文本里。
- `run` / `jump` / `gravity` / `collide-terrain` 只有真实运行间接观测（9 jump/land、到 gate），无机制级断言；`gravity` / `collide-terrain` 未被设计声明。
- `hazard-contact` 在失败样本里真实 `reset=10`，但无正向断言；`avoid-danger` 只有 fixture pack + 合成 config 的 Chrome probe，冻结设计声明了它而 config 无 danger，机制覆盖仍判 `satisfied`；`moving-platform` 无运行时，手写 `solid+motion` 可静默绕过。
- 三处系统性断点：config 编译器不读 `design.mechanics` 且 kind 铁律漏 chest/danger；覆盖门禁只读 design、probe 默认全过、不落盘；Playtest 默认场景是 wasteland 专用常量（4 pickup/6 collected/site v1）且不判 hazard/danger/moving。
- 计数：交付级 E3 3/10（严格全链 2/10）；真实运行间接 4/10；仅 probe 1/10；真实发生无判定 1/10；无运行时 1/10；交付级 E3 失败路径 0/10。塔防 9 类构念只有纯层仿真，无设计/QA/delivery/Playtest。
