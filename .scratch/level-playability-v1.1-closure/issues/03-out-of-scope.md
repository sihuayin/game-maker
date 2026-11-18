# Out of scope 与不变量

Type: grilling
Status: resolved
Owner: claude (wayfinder session 2026-11-18)
Blocked by: —
Map: ../map.md
Class: V1.1-CLOSURE / DECISION

## Question

把 Q14 的排除项落成可执行的边界，防止它们在 I-04 / I-05 / PU-C5 / PU-ADMIT 的 brief 中悄悄回潮。

必须裁定：

1. 逐项确认并分类：`PUBLIC_NB` / `PUBLIC_PU` gate 状态变化（ADMITTED / OPEN）、P2–P7 执行、新算法 / Runtime / CLI / MCP / 产品代码、新 fixture、多移动 Hazard / moving platform / y 轴 / Danger strike、修改已签署文档、LP-06/07 转 vitest、付费上游、单元实际执行。
2. 每项写明「为什么出图」与「未来归属」（独立公开能力 effort / Phase-2 / fixture 授权票 / 测试基建票 / 不计划）。
3. 给出总授权包中的 Out-of-scope 小节文本与 STOP 规则：任一单元 brief 需要跨过这些边界 ⇒ STOP + HITL。
4. 明确「允许的只读 import / 只读使用」不等于修改：例如 I-04 可读 `packages/**` 测试，但不得改产品文件。

产出：Out-of-scope 与不变量章节，可直接并入 `docs/v7.8/移动-收口.md`。

## Answer

**Q1–Q7 = 用户裁定（2026-11-18，全 A / 采纳）。** 收口包 [`docs/v7.8/移动-收口.md`](../../../docs/v7.8/移动-收口.md) 已按裁定重写：§1（§1.1–§1.6）、§3、§10、§13；草案 @ `sha256:396618bdb2d0d01ef93bcde1854297ea43d200f78862196def502fa25d197628`（241 行），**UNSIGNED**。

| # | 冻结 |
| --- | --- |
| Q1 | 六类固定未来归属（独立公开能力 effort / Phase-2 单元 / fixture 授权票 / 测试基建票 / PRD 非目标 / 不计划）+ 四列排除项表（排除项 / 为什么出图 / 未来归属 / 回归条件 / 本包禁止动作） |
| Q2 | 包内只列六类高风险 PRD 非目标子集；§2.2 仍是唯一权威清单；写入不构成替代 / 缩减 / 修订的规范句 |
| Q3 | P2–P6 产物须「合并 + 签署 + Ledger」后才可引用，并记录 PR/merge SHA、签署记录、Ledger、证据 hash；不得运行 probe / 改 Phase-2 白名单 / 重开决策；P7 不归本包；补做回 Phase-2 |
| Q4 | fixture 新建不在本包授权；`10` 判定需要则另开 fixture 票并在 I-05 消费前完成；I-05 不得自建 fixture 或静态层冒充；覆盖不足 ⇒ I-05 不能 PASS |
| Q5 | 四档行为（读取 / 只读执行 / 证据写入 / 修改）；只读执行的意外写入同样越界；复核必须附 `git diff --stat` + 路径清单 + 白名单逐项比对 |
| Q6 | 增量授权记录新增「不触碰的 out-of-scope 项」；双门检查：开工前看授权、复核时看 diff |
| Q7 | §1 范围 / §10 触发条件 / §13 不变量单点存放、交叉引用；复活只走新 effort 或 PRD 改版 |

### §13 措辞核对（用户审查要求）

| 来源 | 原文 | §13 落点 |
| --- | --- | --- |
| I-02 §模型条件性 | 「`publicCapability` 恒为 `BLOCKED`；`publicResult` 恒为 `null`」 | 「I-02 的 `publicCapability` 恒为 `"BLOCKED"`、`publicResult` 恒为 `null`」 |
| I-02 类型定义 | `readonly publicCapability: "BLOCKED"` / `readonly publicResult: null` | 引号形式表示类型字面量，与类型定义一致 |
| I-03 §1.1 | 「保持原样；适配层只消费，不回写 / 篡改」 | 原样引用 |
| I-03 §7.2 / §9 | 「不新增公共 `publicCapability` 字段」 | 原样引用 |
| I-03 §1.2 / §1.3 | gate 三阶段 `BLOCKED` / `WIRED` / `ADMITTED` / `OPEN` | §13 首条明确 gate 状态与 `publicCapability` 字段是两个概念，不得混写 |

**下游**：本票未解锁新票；前沿 = `04-i04-brief` / `06-pu-c5-brief` / `10-i05-temporal-fixtures`。本票未执行任何单元、未签署、未改产品代码。
