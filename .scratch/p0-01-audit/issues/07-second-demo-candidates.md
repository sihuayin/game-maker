# 第二个 Demo 候选比较（P0-01F 前半）

Type: research
Status: resolved
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

## Answer

- 依据现有运行时（只有 `platformer/v1`；世界单屏高、`collect-then-reach`）提出三个候选：A 平台探索/收集（现有机制域，无新机制）、B 危险时序（`hazard-contact` + `avoid-danger` 为核心）、C 塔防（另一运行时，旁路）。
- 证据强弱 A > B > C：A 的 `collect-pickup`/`open-chest`/`reach-goal` 有交付级 E3；B 的 hazard 无正向断言、avoid-danger 只有 fixture probe 且配置链有假 satisfied；C 无设计/QA/delivery/Playtest，compile 无真实 E3。
- 风险/成本 A < B < C：A 主路径无生产代码变更；B 需改提示词、覆盖门禁、probe 与 Playtest；C 是平台级接入，不是一份 Demo 的改动。
- 玩法差异 C（类型级）> B（机制重心级）> A（关卡/视觉级）；若“实质差异”要求类型级，当前运行时给不出低成本候选，需先决定是否扩展运行时或接入 TD 链。
- 俯视角探索解谜被列为 `BLOCKED` 非候选：缺 top-down 相机、四向移动、交互/目标机制与配置形状；不是一份新 `game-config`。
- 免费验证只能证明运行时行为与测试事实，不能证明生成/交付；完整交付需付费 `create/build` + 浏览器 `playtest`。
- 不做最终裁定；唯一候选由票 08 HITL 决定。详见 [research/07-second-demo-candidates.md](../research/07-second-demo-candidates.md)。
