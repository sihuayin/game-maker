# 02. 意图机制提取：sourceType / priority 是否入 P0

Type: grilling
Status: resolved
Owner: main session · 2026-10-23
Blocked by: —
Map: ../map.md

## Question

是否在 P0 内给 `GameIntentMechanic` 加 `sourceType`（`explicit` 明确要求 / `inferred` 推导）与 `priority`
（`required` 必需 / `optional` 可选）（文档 FR-02、§5.1），还是**推迟**？

## 现状（E1）

- 意图层 `mechanics[] = { id, name(自由文本) }`（`game-intent.ts:79-82`），**无 sourceType / priority**；
  意图覆盖把每条意图机制**等权**处理（`intent-coverage.ts:127-129`）。
- 文档 §6 P0 范围（P0-1 注册表 / P0-2 open-chest / P0-3 avoid-danger / P0-4 覆盖报告 / P0-5 E2E）**未列 FR-02**。

## 建议

**推迟（P0 不做）**。P0 目标是最小闭环，且第一轮裁定「最小但完整」不支持顺手扩意图 schema；sourceType/priority
是文档更远愿景，若要，另立后续票。若裁定「入 P0」，则承载实现：`game-intent.ts` 加字段 + prompt 纪律 + 覆盖按
priority 区分必需/可选。

## Answer

**裁定（2026-10-23 · 用户逐字）**：`sourceType` 与 `priority` **都不入 P0，推迟**。

- 本票**不修改** `GameIntentSpec` schema、意图提取 prompt、覆盖逻辑。
- 默认语义：**每条意图机制一律视为必需（`required`）** —— 这正是现有 `auditIntentCoverage` 的行为
  （按 id 等权处理），是**更严**的读法，不会漏。
- 结果：FR-02 记为本图 **Out of scope**；将来若要「推导/可选机制可不通过」的放松，另立 effort 时再议。
