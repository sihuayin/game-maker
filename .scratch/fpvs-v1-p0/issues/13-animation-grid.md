# 13. 动画帧表网格排版（≥3 帧压 AR）

Type: task
Status: resolved
Owner: main session · 2026-10-26
Blocked by: 12
Map: ../map.md

## Question

按票 12 裁定实施：动画帧表改用**网格排版**压长宽比。修票 05 的 QA 卡点（`constructive-constraint`：
4 帧横条 AR 4.0 生图发不出 → 源 ~2.9 → 拉伸压扁）。

实施范围：

1. **pack 确定性推导网格**（`packages/assets/src/pack.ts`，`sheet` 缺席时）：
   - N ≤ 2 → 横条（现状，AR 2.0 已过）。
   - N ≥ 3 → 找「最接近正方形」的因子分解（columns ≥ rows、columns×rows == N），
     N=4 → 2×2、N=6 → 3×2、N=8 → 4×2 …；质数 N（3/5/7）退化回横条（记已知限制，超 FPVS-V1-P0）。
   - 推导出的网格喂给现有的 `sliceGridCells`（帧序 = 行主序，与 `sheet` 契约同）。
2. **提示词提示**（`packages/assets/src/prompt.ts` 的 `recipeShapeSpec` animation 段）：
   ≥3 帧建议写 `sheet`（2×2 / 3×2）—— 只作提示，pack 的确定性推导才是兜底。
3. **测试**：
   - pack 单测：4 帧无 sheet → 2×2；6 帧 → 3×2；2 帧 → 横条不变；质数 N → 横条。
   - prompt 测试：`recipeShapeSpec` 动画段含「≥3 帧写 sheet」的提示。
4. **验证（免费离线，零付费）**：
   - 全仓 test + typecheck 绿。
   - E3（零付费）：把 r2 现场 `asset-recipe.json`（run/patrol 各 4 帧、sheet=null）喂给改后的 pack 推导，
     确认推导出 2×2、帧表 AR 从 4.0 → 1.0。

边界：零付费；不动生图模型、不动 `constructive-constraint` 判据、不动帧内容、不动 `sheet` 契约
（`columns×rows == frames` 的对齐那条）；质数帧数退化回横条（记已知限制，不硬塞）。

## 收口（2026-10-26 · 代码已落，零付费验证已过）

- `packages/assets/src/sheet.ts`：新增 `deriveSheetGrid(frames)` —— `sheet` 缺席时把 N≥3 帧排成「最接近正方形」
  的因子分解（4→2×2、6→3×2、8→4×2、9→3×3）；N≤2 / 质数（3/5/7）返回 `undefined`（退化横条，已知限制）。
- `packages/assets/src/prompt.ts`：`animationSheetPrompt` 用 `anim.sheet ?? deriveSheetGrid(n)`，N≥3 帧走「固定网格」
  排版说法（与 pack 的切法同源）；`recipeShapeSpec` 动画段加「≥3 帧强烈建议写 sheet」提示。
- `packages/assets/src/pack.ts`：`gridOf` 用 `anim.sheet ?? deriveSheetGrid(u.frames)`，画布尺寸与 `sliceGridCells`
  都用这个推导网格（一处规则、两个调用者）。
- 测试：`sheet-grid.test.ts` +6（deriveSheetGrid 各 N）；`prompt.test.ts` +1（recipeShapeSpec 提示）+ 改写 2 条
  （N≥3 走网格 / N≤2 走横排）；`recipes-sweep.test.ts` 桩生图器改成读「N 列 × M 行」画网格（不是永远横排）；
  `pack-ground-band.test.ts` 底部横带救援改用质数 N=3（那条救援只在 segment 路径，N=4 现在走网格）。
- **E3（零付费）**：r2 真实清单喂给推导 —— run/patrol（4 帧）→ 2×2，帧表 AR 4.0 → 1.0；2 帧动画 AR 不变。
- ⚠️ **收口后补一枪（同票）**：`inspectPack` 的 `sourceSizeObservations`（`ops.ts`）此前把动画片「目标」硬码成
  `size.w × frames.length`（N 帧横条）—— 网格推导后它算错目标（run 被比成 +333%），QA 因此**假失败**。
  改成与 pack 的 `gridOf` 同用 `deriveSheetGrid`（目标 = `size.w × columns` × `size.h × rows`），一处规则、两个调用者。
  （已知限制：manifest 不记显式 `sheet`，对「显式写 `sheet:{N,1}`」会按推导网格算 —— 今天无此例。）
- 全仓 1989/1989 · typecheck 绿。

**结论**：动画帧表 AR 在 pack 层封死（N≥3 确定性推导网格 + 提示词同步「固定网格」排版）。下一个动作 = 回票 05 重跑付费 E2E（需重新授权，撞 Q4 付费闸）。
