# 能力矩阵（P0-01C）

Type: research
Status: open
Blocked by: 01, 02, 03

## Question

按 PRD §3.1 的 10 个能力域建立能力矩阵：

1. 输入与游戏意图解析；
2. 风格与视觉世界描述；
3. 游戏设计与机制表达；
4. 资源规划、生成、打包及验证；
5. 关卡配置与运行时编译；
6. Demo 启动、玩家控制及目标达成；
7. Playtest 的执行、观测、结果分类与报告写回；
8. 人工视觉确认及其与最终判定的关系；
9. `verify-delivery` 与证据完整性验证；
10. 版本隔离、历史交付保护及相关测试约束。

按「能力 × 入口/场景」逐行，每行字段：`capability` / `implementation` / `contract` / `tests` / `real_evidence` / `status` / `limitations` / `next_action`。
状态按 Q5 规则：`IMPLEMENTED` / `TESTED` / `E2E_VERIFIED` / `UNKNOWN` / `BLOCKED`；`E2E_VERIFIED` 只对冻结交付身份与证据实际覆盖的场景成立；单样本注明限制。

产物：`.scratch/p0-01-audit/research/04-capability-matrix.md`。
