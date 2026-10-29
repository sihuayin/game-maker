# 机制与可观测性矩阵（P0-01D）

Type: research
Status: open
Blocked by: 01, 02, 03

## Question

对当前代码能够支持和验证的每项机制，核实链路：

`机制声明 → 配置表达 → Runtime 实现 → 实际触发 → 状态或事件观测 → Playtest 判定`

记录：机制名称与设计要求、配置表达方式、实际运行时实现、触发条件、可观测状态或事件、Playtest 如何验证成功与失败、是否只有 fixture 测试、是否已有真实运行证据。

明确区分机制实现与机制验收；不把状态字段存在等同于机制真实发生；不把执行器无法完成动作误判为机制成功；未经真实验证的机制明确标注证据不足。

产物：`.scratch/p0-01-audit/research/05-mechanism-observability.md`。
