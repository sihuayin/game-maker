# 两段式 create 与 checkpoint 审查

Type: task
Status: resolved
Blocked by: 25

## Question

在预算授权、基线冻结、输入批准之后，运行**不带 `--yes`** 的 `create`，停在 checkpoint，并：

- 记录命令、退出码、run 目录、时间、账本/调用；
- 核对 checkpoint 是否提供 design / asset recipe / plan 等预期审查材料；
- 向用户呈现材料，由用户决定是否进入付费 `build`；
- 若材料缺失或不可读：暂停并报告，不绕过闸门、不改代码、不手改 JSON；
- 检查是否超出预算上限；超限即停。

产物：run 目录 + `.scratch/p0-02-second-demo/research/05-checkpoint-review.md`（命令、退出码、材料清单、用户决定）。

## Answer

**已关闭（2026-10-29）：用户裁定暂停 P0-02 / 重画范围。** 本票未执行、未授权；零付费产物保留。恢复需按重画后的新范围另开图/新票。
