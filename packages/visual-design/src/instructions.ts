// 共享矩形绘制指令流 —— SVG 与 PNG 的**同一份**派生源（visual-design-impl-v1 票 04）。
//
// ⚠️ Q5 的硬约束：PNG 与 SVG 不能只是「都从 VDS 派生」就算数，必须**证明**二者用同一套
//   坐标/颜色/层级/矩形边界。做法 = 这一份指令流：`serializeVds`（SVG）与 `renderVds`（PNG）
//   **都**从 `deriveRectInstructions` 派生 —— 一致性 = 结构性同一（同一指令流），
//   而非事后比较两个独立实现。
import { paletteColor, type VisualDesignSpec } from "@game-maker/contracts";

export interface RectInstruction {
  /** VDS object id（SVG 的 `<g id>` 用；PNG 侧是纯几何，不用 id）。 */
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 未解析的 `palette:N`（给 `rasterize` 的 rect op 用，它内部会再解析一次）。 */
  fillRef: string;
  /** 解析后的 `#rrggbb`（给 SVG 的 `fill` 属性用）。同一 ref + 同一色板 ⇒ 与 `fillRef` 恒一致。 */
  color: string;
}

/**
 * VDS → 按 `layer` 升序（稳定排序）的矩形指令流。`fill` 经 `paletteColor`（唯一解析处）→ hex。
 * 越界 fill 在这里抛一次，SVG 与 PNG 两条路都继承同一个错误。
 */
export function deriveRectInstructions(vds: VisualDesignSpec, palette: readonly string[]): RectInstruction[] {
  return [...vds.objects]
    .sort((a, b) => a.layer - b.layer)
    .map((o) => {
      const color = paletteColor(o.fill, palette);
      if (color === undefined) throw new Error(`fill "${o.fill}" 越界（色板长度 ${palette.length}）`);
      return {
        id: o.id,
        x: o.bounds.x, y: o.bounds.y, width: o.bounds.w, height: o.bounds.h,
        fillRef: o.fill, color,
      };
    });
}
