# 起草 A 的 Playtest 场景

Type: task
Status: open
Blocked by: 06

## Question

根据**最终 config**起草 `playtest-scenario/v1` 场景数据：

- pickup 数量、collected、gate/won 断言与 A 的 config 一致；
- 核心断言 `collect-pickup` + `reach-goal`；`open-chest` 可选；
- 不使用 wasteland 默认常量（4 pickup / 6 collected / site v1）；
- 不通过断言篡改制造通过；不修改生产代码。

产物：`.scratch/p0-02-second-demo/inputs/a-playtest-scenario/`（JSON）+ 起草说明。
