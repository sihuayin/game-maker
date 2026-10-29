# 冻结审计基准（P0-01A）

Type: task
Status: open
Blocked by: （无）

## Question

冻结 P0-01 审计基线并留下可复核的基准记录：

- 仓库地址、分支、完整 commit SHA（生产代码 HEAD `2c1a9d5`）、审计时间；
- `git status --porcelain`（含未跟踪的 `docs/v7.6/管线.md`）与工作区状态；
- 关键目录与包结构（`packages/*`）、本次读取的文档 / 测试范围；
- 无法读取或无法核实的内容（明确标记，不推测补齐）；
- 断言审计期间未修改生产实现。

产物：`.scratch/p0-01-audit/research/01-baseline.md`（含命令与退出码）。
