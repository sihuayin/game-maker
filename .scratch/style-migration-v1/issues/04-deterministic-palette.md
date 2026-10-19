# 04. 确定性色板提取：不再让模型在 15/17/31 之间摆

Type: task
Status: resolved
Owner: claude (2026-10-18 施工 · 2026-10-19 关票 · 人裁「施工 04」→「提交 关票」)
Blocked by: —
Map: ../map.md
> 派生自 B/C：`analyze-reference` 四次提取的色板长度是 15 / 31 / 17 / 16；
> 提示词要求 ≥32 从未稳定遵守。9 色的旧色板已被证明是硬天花板。
> ⚠️ **立票 ≠ 批准施工**。

## 1 · 证据

- 旧 StyleSpec：9 色；玩家帧恰好 9 个不透明色。
- 本地量化：9 色毁明暗，24 色可用，48 色近无损。
- B/C 新提取：15 / 31 / 17 / 16 色；16 色交付预览可用但偏薄。
- 参考图中位切分可稳定得到 29 个有效色（`assets/palette-candidate-29.json`）。

## 2 · 要做什么

- 从参考图**确定性**提取 24–32 色（中位切分 / k-means，固定参数）。
- 与模型给出的 `style.palette` 合并或校验：
  - 保证唯一、顺序稳定、每个色真实出现在参考图；
  - 保证 DNA 的 `palette:N` 与 VWS 六桶仍可解析。
- 目标：同一张参考图多次运行得到同一份色板。

## 3 · 验收

1. 同一参考图跑 3 次，色板长度与色值完全一致。
2. 24 色与 32 色两档都过量化预览（明暗/肤色不丢）。
3. `palette:N` 越界 gate 仍绿。
4. 先红后绿。

## 4 · 边界

- 不改 `VisualWorldSpec` 的色板形状（仍是有序数组）。
- 不跑付费上游（除非另出报告）。
- 不把色板硬编码进某个游戏；参考图变则色板变。

## 5 · 施工记录（2026-10-18 ~ 19）

- **新文件 `packages/vision/src/palette.ts`**（纯函数、不读文件 —— `vision` 只许依赖 `contracts`）：
  - `extractPalette(pixels, { size })`：5 bit/通道粗直方图 → 每格取出现最多的**真实色** →
    中位切分（选 `range × log1p(weight)` 最大的盒、按最宽通道加权中位切）→
    **预留 20% 暖色/肤色 + 10% 高饱和槽位** → 不足按最远点补齐 → 按亮度升序、再按 packed 排序。
  - `applyDeterministicPalette(spec, palette)`：替换 `style.palette`；六桶与 `materials.*.color`
    的 `palette:N` 按「旧色最近的新色」改写（同距取小下标）。
  - `PALETTE_SIZE = 32`；`size` 参数支持 24（下限）与 32，48 不用。
- **接线**：`analyzeReference` 新增可选 `referencePixels`，模型成功后、成品过契约之前替换并**重新过契约**；
  `runUnderstanding` 用 `assets.decodePNG` 解码参考图并传入。
  ⚠️ **顺序有意**：先让模型那份过 `palette:N` gate（自相矛盾的输出不被救活），再做替换。
- **格式边界**：确定性提取只支持 **PNG**；jpg/webp 在**第一笔上游之前**以 usage 拒绝
  （像素解码没有实现，猜色板会让可复现性失效）。
- **验收读数**（`fixtures/reference/test.png`，122k 色）：
  - 同一参考图跑 3 次（模型三次给不同色板）⇒ 落盘 `style.palette` **逐项相同**、长度 32、`palette:N` 全在范围；
  - 24 色：暖色 7 · 亮度 37–216 · 改色率 97.1% · MSE **158.9**；
  - 32 色：暖色 8 · 亮度 37–216 · 改色率 97.0% · MSE **122.3**（≤ 24 色）；
  - 每个色都真实出现在参考图里；两档都覆盖 ≥3 个亮度带；
  - B 跑参考图 `style-ref-clean.png` 免费重放：24 色含 7 暖色、32 色含 9 暖色。
- **先红后绿**：实现前新用例全红（`extractPalette` 不存在 + 链上仍落模型色板）；现在 12 条全绿。
- **夹具修正**：pipeline / CLI / MCP 三处 `tinyPng` 从纯洋红改成四象限四色 ——
  纯色图只能提出 1 色，会与 canned DNA 的 `palette:1` 撞越界；不是放宽断言。
- **五闸**：全量 **102 文件 / 1613 条全绿**（+12）· `tsc -b --force` 干净 · `pnpm build` ✅ ·
  `check:deps` 9 包 ✅ · `check:links` 384 份文档 / 2097 条链接 ✅。
- **边界**：零付费上游 · `game-maker.local.json` 一字未动 · 未改 `VisualWorldSpec` 色板形状 ·
  没有把色板硬编码进任何游戏（参考图变则色板变）· 未动探针期尚未入库的源码改动。
- **已知限制**：暗色参考图会产出偏暗色板（image-43 裁切上 24 色仍有 7 个暖色）；
  近黑/近灰仍可能占多个槽位；非 PNG 参考图不可用。
