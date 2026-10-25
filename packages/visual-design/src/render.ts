// PNG 渲染 —— VDS → 平涂矩形位图（visual-design-impl-v1 票 04）。
//
// ⚠️ **复用** `rasterize`（`assets/raster.ts`）与 `RasterImage`（`assets/image.ts`）——
//   光栅化是「一份实现」（票 21），visual-design 不另写一份，否则两处实现迟早漂移。
//   代价：visual-design 依赖 `@game-maker/assets`（唯一一个额外**内部**依赖；Q5 的
//   「零新依赖」指的是**第三方**，不指 workspace 内复用）。
import { rasterize, type RasterImage } from "@game-maker/assets";
import { DRAW_LIST_FORMAT, type DrawList, type VisualDesignSpec } from "@game-maker/contracts";
import { deriveRectInstructions } from "./instructions.js";

/** VDS → 一份只有 `rect` op 的 DrawList（给 `rasterize` 用）。与 `serializeVds` 同一条指令流。 */
export function toDrawList(vds: VisualDesignSpec, palette: readonly string[]): DrawList {
  const { w, h } = vds.viewport;
  const ops = deriveRectInstructions(vds, palette).map((r) => ({
    op: "rect" as const,
    x: r.x, y: r.y, w: r.width, h: r.height,
    fill: r.fillRef,
  }));
  return {
    format: DRAW_LIST_FORMAT,
    id: "scene",
    frame: "scene",
    viewBox: [0, 0, w, h],
    expectedSize: [w, h],
    ops,
  };
}

/** VDS → 平涂矩形位图（确定性：无 AA、scale=1、逐像素中心点覆盖）。 */
export function renderVds(vds: VisualDesignSpec, palette: readonly string[]): RasterImage {
  return rasterize(toDrawList(vds, palette), { palette, scale: 1 });
}
