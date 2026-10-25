# 05. 测试 + 真实 E2E 验收

Type: task
Status: resolved
Owner: claude (2026-10-25 · resolved)
Blocked by: 01, 02, 03, 04
Map: ../map.md

> ⚠️ **2026-10-25 · E2E 试跑失败（环境，非本图代码）**：`create --yes` 跑完所有**文本 stage**
> （visual-world → intent → design → character-dna → visual-design → recipe），停在 **pack 生图**：
> `Gemini 生图失败（4 次内）：connect ECONNREFUSED 127.0.0.1:9098` —— 本地生图代理
> （`game-maker.local.json` 的 `image.proxy = http://127.0.0.1:9098`）没起。退出码 1。成本：生图 0 次
> （ECONNREFUSED 未到端点）、文本几发（deepseek-v4-pro）。现场：
> `.scratch/entity-identity-v1/runs/2026-10-25-e2e/rust-city-remnant/`。
> **design→VDS 身份已验**（`visual-design.json` 的 sourceIntent 与四桶 id 一致）；**design→config 身份未验**
> （config 步在 pack 之后，没到）。等生图代理起来再重跑。

## Question

按 PRD §6 补全三层验证（依赖 01-04 全部落地）：

**单元（§6.1 矩阵）**：单个实体 id 传递不变 · 多不同 kind · 多相同 kind（1:N 不冲突不重写）·
改实体数组顺序 id 不变 · 重复编译同输入一致 · 重复 id 明确失败（设计层 superRefine 已有 gate，补断言）·
缺失/孤儿处理一致 · VDS↔config 精确匹配通过 · 不匹配失败 · 仅 role/kind 不一致不误判身份。

**集成（§6.2）**：一份含 `player / enemy-wasteland / chest-ruined-city / hazard-spike-rubble / scrap-resource`
的 fixture，验证：设计→config 编译、所有设计 id 通过 `sourceIntent` 一一关联、VDS `sourceIntent` 与 config
对账、QA 无身份错误、资源引用/玩法类型仍有效、原有构建/版本目录/产物规则不破坏。

**E2E（§6.3）**：真实 create 流程一次，目标是**消除身份关联错误**（不代表全游戏满足所有质量，其余非身份
QA 错误照实记录）。记录：输入需求+风格图 · 命令 · 退出码 · run 路径 · GameDesignSpec 实体 id 清单 ·
VDS `sourceIntent` 清单 · GameConfig 实体 id/`sourceIntent` 清单 · QA 结果 · 失败账本（若发生付费调用）。
⚠️ **付费 LLM 调用先书面预算 + 逐字授权才跑**（`visual-design-impl-v1` 同款纪律）。

执行：补测试（TDD）+ 跑全仓测试/typecheck/build + 一条真实 E2E。

## Answer

已收口（2026-10-25）。§6.1 / §6.2 落地，§6.3 身份目标**已验证**（真实 E2E 产物 + 修复代码重判）。

- **§6.2 集成**：`packages/qa/tests/entity-identity.test.ts`（3 条）—— PRD 五实体 fixture 走通
  `auditEntityIdentity`（零 error）+ `visualConfigCoherence`（无身份 error）+ 反例。全仓 **1941/1941** + typecheck 绿。
- **§6.3 E2E（4 发）**：
  1. r1 停在 pack 生图（`image.proxy` 指 9098 未起 → 改指 ClashX 7890，已修）。
  2. r2 **跑完整条链**，config 的 `sourceIntent` **全覆盖**（enemy-wasteland / chest / hazard-spikes / resource-item
     各有对应实体；resource-item 1:N→5 个 pickup）—— 证明**编译期修复（票 02/03）真实生效**。但 QA 报 4 条
     「不存在」—— 根因是 **CLI bundle 陈旧**（票 04 的 join 键没打进去）。`pnpm build` 重建后，用修复代码对 r2
     产物重判：`auditEntityIdentity = []`、`visualConfigCoherence` **无 error**。
  3. r3 / r4 停在 recipe（plan-assets `empty-input`，票 27 记录的**上游间歇性**、与本图无关）—— 没到 config。
- **结论**：实体 ID 关联错误已消除（r2 真实 config 的 `sourceIntent` 链 + 修复代码 QA 重判零 error）。一条
  「单跑全绿」没拿到，唯一阻点是 plan-assets 的上游 empty-input（预先存在、不属本图），不是身份契约。
- **连带观察**：r2 里 `gate`（goal）被模型标了 `sourceIntent: "chest"`（复用了 chest 资源），但 `goal` 在
  interactables 允许集内 ⇒ 不构成身份错误；属语义小瑕疵，不影响结论。
- **成本**：≈ $0.4（r2 的 11 张生图 + 文本；r1/r3/r4 生图 0 次、文本极少），远低于预算 $2.00。
