# 12. CAP-ASSET-01 · frames 失败时是否记录模型真实候选（§3/§5 冲突）

Type: grilling
Status: resolved
Owner: main session · 2026-10-22
Blocked by: —
Map: ../map.md

## Question

票 11 的最终验证发现 `CAP-ASSET-01` 的完成判据与 P0-00 的施工测试项**自相矛盾**：

- **§3 P0-06「建议范围」第 1 条**：`frames` 候选明确 `invalid`，
  **并让 sidecar 记录模型真实候选**。
- **同一节「测试」第 1 条**：`frames` 明确失败（推荐）**且不落 sidecar**。
- **§5 完成判据 / 能力差距表**：`frames` 不再静默折叠；**sidecar 记录真实候选**。

票 02 按「测试」第 1 条实现：`planAssets` 在路线决策前 `invalid`/4，一发就收、
不重采样、不落 recipe / sidecar；`plan-frames-candidate.test.ts` 明确断言
「清单与 sidecar 一个都不落」。

于是：**静默折叠已修**，但 §5 的「sidecar 记录真实候选」**未达成**。
最终验证只能把它记为「部分达成」（票 11 `summary.md` §4）。

请裁定（HITL）：

**A. 以 §3「测试」为准** —— 修正 §3 建议范围与 §5 / 能力差距表的措辞，明确 P0 的失败路
不落 sidecar（错误消息已点名 id 与 `frames`，包内账记了花费）。只改文档，可能补一条见证测试。

**B. 以 §5 为准** —— 在 `frames` 明确失败前落一份**失败侧记录**（如 `plan-attempts.json`
或失败版 sidecar），记录模型原始候选；不重采样、不产 recipe；补测试。

**C. 其他**。

## 边界

- 只做「口径裁定 + 最小补充」；不重开 `frames` 路线、不参数化保留 `frames`、不触碰其他 P2。
- 不改 v7 / `fixtures/`；不付费；不提交 / 不推送。

## Answer

**已收口（grilling · Q1 A + Q2 A；Q3–Q5 A）。** 2026-10-22 用户逐字裁定：

| 问题 | 裁定 | 依据与边界 |
|---|---|---|
| Q1 P0 验收口径 | **A** | 以 §3「明确失败、不落 sidecar」为准，修订 §3 建议范围、§5 和能力差距表的措辞，统一文档口径；不改契约。 |
| Q2 模型可见的 `frames` 漂移 | **A** | 本票不修改 `AssetRecipeTool` 契约或提示词，将模型可见的 `frames` 入口记录为 P1 observation。 |
| Q3 文档修订 | **A** | 按所列四处原位最小修订；保留 `ea53240` 审计证据列原样；追加带日期的裁定注记，不倒写历史。 |
| Q4 错误消息扩展 | **A** | 不改代码；采用现有 `plan-frames-candidate.test.ts` 作为见证，不为重复覆盖新增测试；不扩展为一次列出全部 `frames` 资源。 |
| Q5 票 11 历史状态 | **A** | 保留原文，追加日期补记；更新 `CAP-ASSET-01` 的当前判定为「通过（票 12 修订口径）」，并将非 E2E 判据结论更新为 12/12；保留原始收口记录。 |

### 结论

P0 口径统一为：**`frames` 候选 ⇒ `planAssets` 明确 `invalid`（退出码 4）；错误消息点名资源 id 与
真实候选 `frames`；不落 recipe / sidecar；这一发的花费照记。**
原 §5「sidecar 记录真实候选」不再作为 P0 判据。

### 为什么不采用 B（失败侧记录）

- `asset-plan/v1` 的 `candidate` 枚举只有 `image | drawlist | import`
  （`packages/contracts/src/asset-plan.ts:13,47`），`frames` 不是 route；sidecar 的不变量是
  「规划成功才有」，由路线决策之后的 `decisions` 生成（`packages/assets/src/ops.ts:494-513`）。
  字面满足 §5 需要新产物 / 契约，不是改一句话。
- 失败侧记录属于诊断；按 P0-00 §0.1 的 Q1 裁定，诊断类默认 P1/P2。
- 「模型原选择丢失」已由错误消息承担；票 02 的实现与既有测试已经见证。

### 事实更正

票面原文「包内账记了花费」不准确：单独 `plan` 没有包，账挂在异常上由 CLI/MCP 当场打印
（`packages/contracts/src/command.ts:167-172`）；`create` 链的 `run/v<N>/ledger.json` 只在成功路径写
（`packages/pipeline/src/create-game.ts:391,628`）。准确表述：**花费随异常回报；失败不改变
「钱已花」这一事实。**

### 已执行的修订

1. `docs/v4/P0-00-p0-scope.md` §3 P0-06 建议范围第 1 条、测试第 1 条、§5 `CAP-ASSET-01` 判据与日期注记。
2. `docs/v4/P0-00-capability-gap-audit.md` `CAP-ASSET-01` 验收条件 + P0 表后日期注记；审计证据列原样保留。
3. `issues/11-final-validation.md` 顶部日期补记与判据表 `CAP-ASSET-01` 行；
   `runs/2026-10-22-final/summary.md` §8 补记。原文保留。
4. 地图追加本票索引；票 11 的索引行补指向本票；头部标记收口。

### 证据

- [`runs/2026-10-22-ticket-12/ruling.md`](../runs/2026-10-22-ticket-12/ruling.md)：裁定原文 + 事实核验。
- [`runs/2026-10-22-ticket-12/doc-diff.txt`](../runs/2026-10-22-ticket-12/doc-diff.txt)：全部文档改动。
- [`runs/2026-10-22-ticket-12/check-links.txt`](../runs/2026-10-22-ticket-12/check-links.txt)：
  `pnpm check:links` exit 1；仅 2 条既有 `.scratch` 断链，本次修订无新增。
- 见证测试：`packages/assets/tests/plan-frames-candidate.test.ts`（既有；断言 `invalid`/4、
  消息含资源 id 与 `frames`、一发、账、零产物）。

### 边界

- 不改代码 / 契约 / CLI / MCP / 依赖；不改 `AssetRecipeTool` 或提示词。
- 不重开 `frames` 路线；不参数化保留；不碰 v7 / `fixtures/`；零付费；不提交 / 不推送。

### P1 observation

- 模型可见面漂移：`PLAN_TOOL_DESCRIPTION` 说「策略只有三个值」，但 `AssetRecipeTool` 的线形状仍允许
  `frames`（`packages/contracts/src/recipe-tool.ts:128-129`）。本票不改；留给将来统一处理模型可见面时一并裁。
