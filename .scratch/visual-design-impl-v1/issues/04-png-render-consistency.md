# 04. PNG 渲染 + 与 SVG 的一致性证明

Type: task
Status: resolved
Owner: claude (2026-10-25 · resolved)
Blocked by: 01, 03
Map: ../map.md

## Question

实现 `renderVds(vds, palette): RasterImage`（`packages/visual-design/src/render.ts`），并**证明**它与票 03 的 SVG
序列化器用**同一套**坐标/颜色/层级/矩形边界规则。零新依赖（Q5）。

- **PNG**：`renderVds` 把 VDS 的每个 object 当成一个矩形绘制指令，经 `raster.ts:120` 的 `rasterize`（rect op
  `raster.ts:79-81`，无 AA、逐像素中心覆盖）+ `png.ts:29` 的 `encodePNG`（hand-rolled、`node:zlib` deflate level 9，
  「同样输入永远得到同样字节」）产出 `preview/scene.png`。整数 scale=1（视口 480×270 1:1）。
- **一致性证明（Q5 的硬约束，不许因同源就省）**：PNG 与 SVG 不能只是「都从 VDS 派生」就算数。要**证明**二者用
  同一套坐标/颜色/layer/rect 边界。做法：引入一个**共享的矩形绘制指令中间表示**（每 object → 一条 `{x,y,w,h,color,layer}`），
  `serializeVds` 与 `renderVds` 都从它派生 —— 一致性 = 结构性同一（同一指令流），而非「事后比较两个实现」。
  这条中间表示同时供票 05 validator 做「SVG 与 VDS 边界一致」「预览尺寸=画布」的判据来源。

**测试**（TDD）：`renderVds` 的确定性（同 VDS 逐字节同 PNG）；尺寸 = 480×270；指令流与 `serializeVds` 用同一份
中间表示（结构性同一）；rect 覆盖边界与 `bounds` 逐像素一致（无 AA 的二进制覆盖语义）。

## Answer

已落码（2026-10-25）：

- **共享指令流 `instructions.ts`**：`deriveRectInstructions(vds, palette)` → 按 `layer` 升序的 `RectInstruction`
  （`{id, x, y, width, height, fillRef, color}`）。越界 fill 在此抛一次，SVG/PNG 两条路继承同一错误。
- **`serializeVds` 重构**（svg.ts）改为消费 `deriveRectInstructions`（行为不变，24 条旧测试仍全过）；
  **`render.ts`** 新增 `toDrawList` + `renderVds`，也消费同一份指令流。
- **一致性 = 结构性同一**：SVG（`serializeVds`）与 PNG（`toDrawList`→`rasterize`）**都**从
  `deriveRectInstructions` 派生 —— 不是「事后比较两个独立实现」，而是同一指令流。测试里用
  `parseWhitelistedSvg(serializeVds(...))` round-trip 与 `toDrawList(...).ops` 分别对账同一份指令。
- **依赖边（连带改）**：visual-design 加 `→ @game-maker/assets`（复用 `rasterize`/`encodePNG` 单一实现，
  不另写一份光栅化）。改了 `check-deps.mjs` ALLOWED + `package.json` + `tsconfig.json` references。⚠️
  票 06 接线时还要加 `pipeline → visual-design` 那条边（现在没加）。
- **验证**：`render.test.ts` **6/6**（确定性 · 尺寸 480×270 · 逐像素边界 = bounds · SVG/PNG 同指令流）；
  visual-design 全套 **41/41**；全仓 **1913/1913**；`check:deps` + `build` 绿。
