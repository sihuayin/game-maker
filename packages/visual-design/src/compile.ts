// Visual Design Compiler 编排（visual-design-impl-v1 票 06）。
//
// ⚠️ **纯计算，不写盘**：`layoutVds → serializeVds → renderVds → validateVds` 四步编排，返回
//   内存里的 VDS + SVG + PNG。写盘（`jstr`/`writeJson`）是**序列化唯一一处**（`pipeline/artifacts.ts`），
//   本包不另写一份 —— 由 pipeline（`create-game.ts`）拿到 `VisualDesignOutput` 后落盘。
//
// ⚠️ **旁轨不闸**：validator 判据失败抛 `CommandError("invalid")`，但那是**本步骤**的硬失败；
//   本步骤不把「视觉设计失败」升级成闸住 recipe/config 主链的 gate（Q7 裁定）。
import { CommandError, type GameDesignSpec, type VisualDesignSpec, type VisualWorldSpec } from "@game-maker/contracts";
import type { RasterImage } from "@game-maker/assets";
import { layoutVds } from "./layout.js";
import { serializeVds } from "./svg.js";
import { renderVds } from "./render.js";
import { validateVds } from "./validator.js";

export interface VisualDesignInput {
  design: GameDesignSpec;
  vws: VisualWorldSpec;
  /** 视口（「视口不是数据」，由调用方注入壳 VIEWPORT 480×270）。 */
  viewport: { w: number; h: number };
}

export interface VisualDesignOutput {
  vds: VisualDesignSpec;
  svg: string;
  png: RasterImage;
}

/** 编排四步；validator 判据不过就抛 `CommandError("invalid")`（定位到阶段+对象）。 */
export function compileVisualDesign(input: VisualDesignInput): VisualDesignOutput {
  const palette = input.vws.style.palette;
  const vds = layoutVds(input.design, input.vws, input.viewport);
  const svg = serializeVds(vds, palette);
  const png = renderVds(vds, palette);
  const issues = validateVds(vds, palette, svg, png);
  if (issues.length > 0) {
    throw new CommandError(
      "invalid",
      `Visual Design 校验失败：${issues.map((i) => `[${i.stage}] ${i.target}: ${i.message}`).join("；")}`,
    );
  }
  return { vds, svg, png };
}
