# 写主文档并自检（PRD §6 / §8）

Type: task
Status: open
Blocked by: 09

## Question

写 `docs/v7.6/p0-01-readonly-capability-audit.md`，包含 PRD §6 要求的十节：

1. 审计基准与范围；
2. 真实生成管线图；
3. 能力矩阵；
4. 机制与可观测性矩阵；
5. Playtest、人工视觉及证据完整性审计；
6. 第二个 Demo 候选评估；
7. 已确认缺口与未知事项；
8. 下一步开发建议；
9. 证据引用索引；
10. 审计限制与未完成事项。

可选 Mermaid 流程图，但必须与真实代码调用关系一致。逐项核对 PRD §8 可合并验收清单；确保所有引用可定位、`UNKNOWN` / `BLOCKED` 明确、历史证据没有被误当当前版本的直接证明。

不修改生产代码/契约/CLI/MCP/依赖；不提交、不推送（Q9）。
