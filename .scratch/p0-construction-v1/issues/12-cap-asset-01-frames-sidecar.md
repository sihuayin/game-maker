# 12. CAP-ASSET-01 · frames 失败时是否记录模型真实候选（§3/§5 冲突）

Type: grilling
Status: open
Owner: —
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
