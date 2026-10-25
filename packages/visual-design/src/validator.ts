// VDC 自有确定性 validator —— 把 PRD §8.1 八条判据落成可机械判、定位到「阶段 + 对象」的失败清单
// （visual-design-impl-v1 票 05）。
//
// ⚠️ **VDC 自有**（visual-design-v1 票 06）：与 `auditGameConfig`/`auditScreenSpace`/`auditLayerCoverage`
//   并行不复用 —— 那批是「AI 产 GameConfig 的模型审计」，这个是「确定性布局产 VDS/SVG/PNG 的自校验」。
//   跨契约的（`sourceIntent` 覆盖、`role↔kind`）在票 04/07，不在本 validator。
//
// ⚠️ **顺序 + 前置门**：语法 → 安全白名单（前置门，失败**不继续处理**）→ 一致性四项（画布 / id /
//   fill 引用 / 边界 round-trip）→ PNG。**「文件清单」是文件系统检查，归票 06**（pipeline 写盘后查）。
//
// ⚠️ **确定性**：纯函数，同输入 ⇒ 同 issue 清单。判据失败由**调用方**（票 06 compile 入口）转成
//   `CommandError("invalid")` 硬失败；本函数只返回 issue 清单，便于测试逐条断言。
import { paletteColor, type VisualDesignSpec } from "@game-maker/contracts";
import type { RasterImage } from "@game-maker/assets";
import { deriveRectInstructions } from "./instructions.js";
import { parseWhitelistedSvg } from "./svg.js";

export interface VdcIssue {
  /** 判据阶段（svg / canvas / id / fill / bounds / png）。 */
  stage: string;
  /** 出问题的位置（对象 id / "scene.svg" / "preview/scene.png"）。 */
  target: string;
  message: string;
}

/** 校验 VDS + 派生 SVG + PNG 预览三者一致。返回 issue 清单；空 = 通过。 */
export function validateVds(
  vds: VisualDesignSpec,
  palette: readonly string[],
  svg: string,
  png: RasterImage,
): VdcIssue[] {
  const issues: VdcIssue[] = [];

  // ── 1. SVG 语法 + 安全白名单（前置门：失败不继续处理）──
  let parsed;
  try {
    parsed = parseWhitelistedSvg(svg);
  } catch (e) {
    issues.push({ stage: "svg", target: "scene.svg", message: (e as Error).message });
    return issues;
  }

  // ── 2. 画布尺寸 ──
  if (parsed.viewport.w !== vds.viewport.w || parsed.viewport.h !== vds.viewport.h) {
    issues.push({
      stage: "canvas", target: "scene.svg",
      message: `viewport ${parsed.viewport.w}×${parsed.viewport.h} ≠ VDS ${vds.viewport.w}×${vds.viewport.h}`,
    });
  }

  // ── 3. 对象 ID 唯一（SVG 侧；VDS 侧由 schema 的 superRefine 保证）──
  const seen = new Set<string>();
  for (const r of parsed.rects) {
    if (seen.has(r.id)) issues.push({ stage: "id", target: r.id, message: `重复的 object id "${r.id}"` });
    seen.add(r.id);
  }

  // ── 4. 对象引用：fill 界内 ──
  let fillOk = true;
  for (const o of vds.objects) {
    if (paletteColor(o.fill, palette) === undefined) {
      issues.push({ stage: "fill", target: o.id, message: `fill "${o.fill}" 越界（色板长度 ${palette.length}）` });
      fillOk = false;
    }
  }

  // ── 5. 对象边界 + 颜色与 VDS 一致（round-trip via 共享指令流；fill 全界内才做）──
  if (fillOk) {
    const instrs = deriveRectInstructions(vds, palette);
    if (parsed.rects.length !== instrs.length) {
      issues.push({
        stage: "bounds", target: "scene.svg",
        message: `SVG 有 ${parsed.rects.length} 个 rect，VDS 有 ${instrs.length} 个 object`,
      });
    } else {
      parsed.rects.forEach((r, i) => {
        const inst = instrs[i]!;
        if (r.id !== inst.id || r.x !== inst.x || r.y !== inst.y || r.width !== inst.width || r.height !== inst.height || r.fill !== inst.color) {
          issues.push({
            stage: "bounds", target: inst.id,
            message: `SVG rect (${r.x},${r.y} ${r.width}×${r.height} ${r.fill}) ≠ VDS object "${inst.id}"`,
          });
        }
      });
    }
  }

  // ── 6. 预览尺寸（「预览成功生成」的**可机判**半边；「文件存在」半边归票 06）──
  if (png.width !== vds.viewport.w || png.height !== vds.viewport.h) {
    issues.push({
      stage: "png", target: "preview/scene.png",
      message: `PNG ${png.width}×${png.height} ≠ viewport ${vds.viewport.w}×${vds.viewport.h}`,
    });
  }

  return issues;
}
