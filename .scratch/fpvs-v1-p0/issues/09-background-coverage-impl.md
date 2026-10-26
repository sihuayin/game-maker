# 09. 背景层覆盖闸 + 提示词注入视口高度

Type: task
Status: resolved
Owner: main session · 2026-10-26
Blocked by: 08
Map: ../map.md

## Question

按票 08 裁定实施：**提示词 + 清单闸（组合）**。修背景覆盖缺口 —— 背景资产标称高 180 < 视口高 270，
导致 config 那步 `auditLayerCoverage` 报 3 条确定性硬失败（Stage B 卡点，`stageb2.out.json`）。

实施范围：

1. **提示词注入视口**（`packages/assets/src/prompt.ts`）：
   - `assetPlanPrompt` 增加 `viewport: {w,h}` 参数，背景段注入「背景画布高 ≥ 视口高 ${h}；parallax 0 层宽 ≥ ${w}；
     正视差层 tileable.x」。
   - `recipeShapeSpec` 背景段（`prompt.ts:612-616`）现只有宽度规则（parallax↔tileable 配对），补高度规则。
2. **清单闸**（`packages/assets/src/ops.ts`）：
   - 新增 `backgroundCoverageGate(recipe, viewport)`，在 `playerAnimationGate`（`ops.ts:448`）后调用，
     与现有闸同一档（`schema`、重采样），三发用尽走现成 `CommandError("invalid")`。
   - 口径：每个 `kind:"background"` 的 `spec.size.h ≥ viewport.h`；parallax > 0 层必须 `tileable.x`；
     parallax == 0 层 `spec.size.w ≥ viewport.w`。
3. **视口事实源**：`planAssets` 增加 `viewport?`（默认 `DEFAULT_VIEWPORT`，`ops.ts` 里 `opts.viewport ?? DEFAULT_VIEWPORT`）。
   ⚠️ **改口径**：原定 `create-game.ts:380` 传 `input.viewport ?? DEFAULT_VIEWPORT`，但 `planAssets` 住在
   `runUnderstanding`（理解层第一阶段），其入参 `UnderstandingInput` **没有** `viewport`（那是 `BuildInput` 的字段，
   只进 `compileRuntime`）。理解层对 `compileVisualDesign` 本就硬码 `DEFAULT_VIEWPORT`（`create-game.ts:370`），
   故背景闸随同款口径：**create 链一律 `DEFAULT_VIEWPORT`**，`viewport?` 参数只作单测/未来覆盖口。`prompt.ts` 与闸共用这一个数。
4. **验证（免费离线，零付费）**：
   - `backgroundCoverageGate` 单测（320×180 拒 / 480×270 过 / parallax>0 无 tileable 拒 / parallax 0 宽<480 拒）。
   - `prompt.test.ts` 断言 `assetPlanPrompt` 输出含视口高度规则。
   - E3：把 probe-7 的 `asset-recipe.json`（背景 320×180）喂给新闸，确认抓得到（零付费）。
   - 全仓 test + typecheck 绿。

边界：零付费（不跑付费 Stage B，归票 05）；不动确定性后处理；不新增错误通路、不动 `CALL_FAILURES` 闭集；
不动 `image` / 生图路径。

## 收口（2026-10-26 · 代码已落，零付费验证已过）

**代码已落**：

- `prompt.ts`：`assetPlanPrompt` 加 `viewport` 参数，背景段注入「高 ≥ 视口高 / 正视差 tileable.x / parallax 0 层宽 ≥ 视口宽 / 不竖向平铺」。
- `ops.ts`：新增 `backgroundCoverageGate(recipe, viewport)`（export），在 `playerAnimationGate` 后、与三道闸同一档（`schema`、重采样）；
  `PlanAssetsOptions` 加 `viewport?`（默认 `DEFAULT_VIEWPORT`），`planAssets` 里 `opts.viewport ?? DEFAULT_VIEWPORT` 供提示词与闸共用。
- ⚠️ **一处实现时收紧的口径**：闸**跳过无层背景**（`layers ?? []` 为空 ⇒ 不判）—— `backgroundLayerEntries` 对无层背景返回 `[]`，
  即 config 那步**也不审**它；闸只做「config 会拒什么」的必要条件，不引入 config 没有的判据（否则 `shift-change-master.json` 等
  320×180 无层背景夹具会被误伤）。
- 测试夹具修正：`cli-create.test.ts` 的 `imageHeavyRecipe` 里 `bg-waste` 原 256×96、正视差层不平铺 —— 本就过不了 config 覆盖判据
  （被 canned config 掩盖），改成 480×270 + 正视差层 tileable.x。

**验证（零付费，E2 + E3）**：

- 单测：`plan-background-gate.test.ts`（+4，320×180 拒 / 480×270 过 / 正视差不 tileable 拒 / parallax 0 宽<480 拒）；
  `prompt.test.ts`（+3，`assetPlanPrompt` 输出含视口高/宽规则）。
- **E3**：把 probe-7 真实 `asset-recipe.json`（背景 320×180）喂给新闸，抓出「wasteland-station-bg 高 180 < 视口高 270」+
  「sky 宽 320 < 视口宽 480」（零付费，命令 + 输出留存本会话）。
- 全仓 1980/1980 · typecheck 绿 · check:deps 绿。（check:links 的 4 条断链是 `.scratch/asset-integration-v1`、`.scratch/text-upstream-v1`
  旧链，与本票无关。）

**结论**：背景覆盖缺口在清单层封死 —— 提示词让模型知道目标高/宽，闸门在花钱之前确定性拒绝、三发内可补。
下一个真实阻塞回到票 05（付费 E2E 最终验收，单独书面授权）。
