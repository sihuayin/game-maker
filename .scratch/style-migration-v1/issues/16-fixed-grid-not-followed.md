# 16. 2.5 不遵守固定网格：单行提示词 / 逐帧生成 / 换模型

Type: grilling
Status: resolved
Owner: claude (2026-10-19 认领 · 人裁 A · 已施工、已关)
Blocked by: —
Map: ../map.md
> 派生自票 10 第二次真跑的失败（2026-10-19）：
> [失败报告](../report-10-real-legacy-failure-2026-10-19.md)。
> ⚠️ 本票只裁路线，不批准任何付费跑、不批准施工。

## Question

2.5 legacy 已能稳定回 PNG（18 张全 200），但**不遵守固定网格**：
- `run` 请求 4×2 → 实际 4×3 + 11 个角色；
- `idle` 2×2 → 带 `1 / 62 / 63 / 64` 标签与格线；
- `patrol` 3×2 → 实际 4×2（8 个）；
- `standby` 3×1 → 3 个终端 + 1 个人；
- `lunge` 5×1 → 数量对，但带格线与 `48:51` 等标签。

要裁：

- **A**：单行提示词重写（去掉「固定网格」措辞，改「一行等距排开」，明令无线/框/编号）；
  零付费改源码 + 1 发 `scavenger run` 8×1 smoke（复用失败现场母版）。
- **B**：逐帧生成（≈78 次生图 ≈$3.04；需要管线施工）。
- **C**：换 3.1 / nano-banana + JPEG 解码，再发 sheet smoke。
- **D**：先用已生成静物 / 背景 + 免费玩家抢救，动画降级为后续票。
- **E**：换 provider（OpenAI 等）。

## 验收

- 一条明确裁定。
- 若选 A：提示词施工另立票；smoke 1 发也须逐字授权；过则再决定完整重跑预算。
- 若选 B：施工另立票；先零付费；完成后另出预算报告。
- 若选 D：范围收缩，须明确交付边界。

## 边界

- 不批准付费调用；不改 `game-maker.local.json`；不自动重跑 / 换模型 / 转码。
- 不放宽 sheet 的空格 / 边框 / 多主体判据（要放宽必须另裁）。

## Answer

**人裁（2026-10-19 逐字）**：「裁 A：单行提示词重写，先零付费改提示词 + 1 发 scavenger run smoke（1 张 / ≤4 发 / 15 分钟）。」

### 裁定

**A**：`rows=1` 的 sheet 提示词改成「一行等距排开」，不再用「固定网格 / 格子」措辞；
多行网格的旧文字不动。先发 1 发 `scavenger run` 8×1 smoke 验证。

### 施工记录（零付费）

- `packages/assets/src/prompt.ts`：新增 `oneRow` 分支（仅 `sheet.rows === 1`）：
  「横向等距排开的游戏角色动画分解图」「一行排开 N 个角色」；
  明令「没有任何分隔线、边框、编号、文字」；多行网格逐字不变。
- `packages/assets/tests/prompt.test.ts`：新增 `rows=1` 用例（`not.toContain("固定网格"/"格子")`）。
- 五闸：全量 **102 文件 / 1625 条** ✅ · `pnpm build` ✅ · `check:deps` ✅ · `check:links` ✅ ·
  `typecheck` 仅两条既有红（与票无关）。
- smoke：`runs/2026-10-19g-smoke-single-row/`（1 张 / ≤4 发 / 15 分钟）；报告
  [`../report-10-smoke-single-row-2026-10-19.md`](../report-10-smoke-single-row-2026-10-19.md)。
- 结果待 smoke 回报；若失败，回到票 16 的 B / C / D。
