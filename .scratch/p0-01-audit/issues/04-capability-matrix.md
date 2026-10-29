# 能力矩阵（P0-01C）

Type: research
Status: resolved
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

## Answer

- 10 个能力域共 52 行：`E2E_VERIFIED` 31 · `TESTED` 17 · `UNKNOWN` 4 · `BLOCKED` 0。E2E 行只来自 7 组真实运行（`040b907` create、`5b8283f` playtest/视觉、`5f29592` v2 harness、`cf817c1` ticket-08 沙箱、`c619d84` accept、`d3e9137` TD fixture 渲染、`2c1a9d5` 证据完整性 + 本票 HEAD 重验）；横版主链证据全部落在同一个 Demo，另有 TD fixture 与旧包 accept，均不能外推为第二玩法或完整交付。
- 横版主链「输入→理解→设计→规划→pack→链内 verify→config→QA→site」有单一完整 E3；`delivery` 写回是新增代码，冻结 Demo 的 delivery 由 effort 脚本初始化，当前 `buildAndSite` 的壳级 delivery 写回无 E3。
- Playtest：v1 有 CLI 写回 E3；HEAD v2 CLI 组合无 E3；非 SUCCESS 只有 `AGENT_LIMITATION` 沙箱 E3；baseline 无入库基线。人工视觉只有 1 次 E3，机器只验完整性/身份、不重判；独立性与可重复性 `UNKNOWN`。
- `verify-delivery` 在 HEAD 独立重跑 pass（223 文件 / 151 required / 72 optional / 13 records / 六项 match / diagnostics 0），1,035 个受保护文件零变化；清单生成器不在 `packages/`。TD compile 无真实模型输出 E3，TD 站点/渲染是 fixture E3，TD 玩法 `UNKNOWN`；MCP 仅 `create_game` 全链且无真实 E3。
- 整仓 `pnpm test` 两次因超时非 0，超时用例隔离重跑全过；`typecheck` 与证据验收 exit 0。这是环境/超时约束，不是能力失败。详见 [research/04-capability-matrix.md](../research/04-capability-matrix.md)（§2 矩阵、§3 证据索引、§4 UNKNOWN 清单、§5 审计限制）。
