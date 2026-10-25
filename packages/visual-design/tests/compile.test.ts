// compile 编排的测试（visual-design-impl-v1 票 06）。
//
// ⚠️ 只测**纯计算编排**（layout → serialize → render → validate）：产出 VDS/SVG/PNG 三者一致。
//   写盘 + 接线（create-game 落 staging）由 pipeline 测（全仓 suite 覆盖），真跑归票 08 E2E。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GameDesignSpecSchema, VisualDesignSpecSchema, VisualWorldSpecSchema } from "@game-maker/contracts";
import { compileVisualDesign, parseWhitelistedSvg } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const VIEWPORT = { w: 480, h: 270 };

describe("compileVisualDesign", () => {
  it("wasteland 真夹具：编排产出 VDS + SVG + PNG，三者一致", () => {
    const gd = GameDesignSpecSchema.safeParse(JSON.parse(readFileSync(ROOT + "fixtures/e2e/wasteland-platformer/game-design.json", "utf8")));
    const vw = VisualWorldSpecSchema.safeParse(JSON.parse(readFileSync(ROOT + "fixtures/e2e/wasteland-platformer/visual-world.json", "utf8")));
    expect(gd.success).toBe(true);
    expect(vw.success).toBe(true);
    if (!gd.success || !vw.success) return;

    const out = compileVisualDesign({ design: gd.data, vws: vw.data, viewport: VIEWPORT });

    // VDS 过 schema
    expect(VisualDesignSpecSchema.safeParse(out.vds).success).toBe(true);
    // SVG round-trip：可解析、viewport 一致、rect 数 = VDS object 数
    const parsed = parseWhitelistedSvg(out.svg);
    expect(parsed.viewport).toEqual(VIEWPORT);
    expect(parsed.rects).toHaveLength(out.vds.objects.length);
    // PNG 尺寸
    expect(out.png.width).toBe(VIEWPORT.w);
    expect(out.png.height).toBe(VIEWPORT.h);
  });
});
