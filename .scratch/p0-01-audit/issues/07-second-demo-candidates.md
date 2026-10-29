# 第二个 Demo 候选比较（P0-01F 前半）

Type: research
Status: open
Blocked by: 04, 05, 06

## Question

依据能力矩阵、机制/可观测性与证据审计，提出 2–3 个候选（不得预先锁定俯视角解谜或其他玩法），逐项比较：

- 与原 Demo 的玩法差异；
- 所需机制及其真实支持证据；
- 所需资源与关卡要求；
- 当前管线的缺口；
- 预计需要的代码变更；
- 是否需要新增契约、CLI、MCP 或依赖；
- 免费验证的可行性；
- 主要失败风险。

每个结论须指向代码 / 测试 / 证据；无法判断的标 `UNKNOWN` / `BLOCKED`。不得以 `compile-td-game` 等入口存在就认定对应类型已支持端到端生成。

产物：`.scratch/p0-01-audit/research/07-second-demo-candidates.md`。
