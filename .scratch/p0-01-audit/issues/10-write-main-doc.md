# 写主文档并自检（PRD §6 / §8）

Type: task
Status: resolved
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

## Answer

**已收口（2026-10-29）。** 主文档：`docs/v7.6/p0-01-readonly-capability-audit.md`（287 行，PRD §6 十节 + 附录 A 验收清单）。

- 审计基线 `2c1a9d5`；两条生产链（横版完整链 / TD 旁路）；CLI 15 命令 / MCP 8 工具；MCP 仅 `create_game` 全链且无 E3。
- 能力矩阵：10 域 52 行，`E2E_VERIFIED` 31 · `TESTED` 17 · `UNKNOWN` 4 · `BLOCKED` 0；E2E 只来自 7 组真实运行，横版主链只有一个 Demo。
- 机制矩阵：10 条机制、9 条有实现、交付级 E3 3/10（严格闭集全链 2/10）；`avoid-danger` 假绿链、`moving-platform` 无运行时、`hazard-contact` 无正向断言。
- Playtest/视觉/证据：真跑 Chrome/CDP；v1 有写回 E3，HEAD v2 无 E3；人工视觉独立记录且匹配身份（11/11），机器不重判；`verify-delivery` HEAD 重跑 pass（223/151/72、13 records、六项 match、diagnostics 0）。
- 第二个 Demo：HITL 裁定 A（平台探索/收集）；可进入 P0-02，但付费需另行预算授权；P0-02 A 试跑是下一步唯一优先事项。
- PRD §8 清单 18/18 全绿；引用路径全部存在；`2c1a9d5..HEAD` 生产代码 diff 为空；未付费、未覆盖历史、未启动第二个 Demo；未提交/推送。
