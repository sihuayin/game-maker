// 兜底拆掉之后**新出现**的行为（2026-09-25）：上游不可达 → 抛 `upstream` ⇒ 退出码 3。
//
// ⚠️ 这条在拆降级链之前**测不出来** —— 那时上游死活都被兜底吸收，`pack` 永远返回 0，
// 只是产物是程序化画的色块。所以它是一条「新契约」的测试，不是回归测试。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CommandError, EXIT, packAssets } from "../src/index.js";

const STYLE = {
  id: "style-ref",
  identity: ["pixel-art"], camera: { mode: "2D", angle: "straight-on" },
  composition: { layout: "x", density: "low" }, palette: ["#112233", "#445566"],
  lighting: { direction: "top", contrast: "low", ambience: "dim" },
  shapeLanguage: ["rect"], material: ["flat"], environment: ["room"],
  characterStyle: ["6 heads"], constraints: ["no AA"], confidence: 0.9,
};
const RECIPE = {
  format: "asset-recipe/v1", id: "no-fallback", styleRef: "stylespec.json",
  assets: [{ spec: { kind: "sprite", id: "crate", role: "箱子", description: "一个木箱。", styleId: "style-ref",
    anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, dependencies: [], required: true },
    source: { kind: "drawlist" } }],
};
/** 一份足够过 `DrawListSchema` 的单帧回应 —— 生成器会自己补 id / viewBox / expectedSize。 */
const GOOD = { frames: [{ name: "crate", ops: [{ op: "rect", x: 0, y: 0, w: 16, h: 16, fill: "palette:0" }] }] };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gm-ops-"));
fs.writeFileSync(path.join(dir, "stylespec.json"), JSON.stringify(STYLE));
fs.writeFileSync(path.join(dir, "recipe.json"), JSON.stringify(RECIPE));
const OUT = path.join(dir, "out");
const dead = "http://127.0.0.1:9";
const base = { recipePath: path.join(dir, "recipe.json"), outRoot: OUT };

describe("⚠️ 没有兜底：上游不可达就是失败（2026-09-25 拆掉降级链）", () => {
  it("上游不可达 → CommandError(\"upstream\")，退出码 3 —— 不是 1，也不再是 0", async () => {
    const e = await packAssets({ ...base, transport: { baseUrl: dead, apiKey: "x" } }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("upstream");
    expect(EXIT[(e as CommandError).kind]).toBe(3);
  });

  it("失败的那次既不留包目录、也不吃版本号", () => {
    expect(fs.existsSync(path.join(OUT, "no-fallback", "pack", "v1"))).toBe(false);
  });

  it("上游正常 → 出包（stub fetch，不碰真网络）；失败一次后重试成功也不算降级", async () => {
    let n = 0;
    const flaky = (async () => {
      if (++n === 1) throw new Error("抖一下");
      // ⚠️ 回应体是 **Anthropic 的 messages 形状**（生成器读 `body.content[].text`），
      //    不是裸的 `{frames}` —— 写错了会表现成「模型吐坏 JSON」，往错的方向找。
      return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(GOOD) }] }),
        { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const r = await packAssets({ ...base, transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: flaky });
    expect(r.command).toBe("pack");
    expect(fs.existsSync(path.join(OUT, "no-fallback", "pack", "v1", "manifest.json"))).toBe(true);
    // 有界重试仍然在（票 14 §7：重试吸收抖动 ≠ 降级）—— 它不该被这次拆除波及
    expect(n).toBe(2);
    // 返回值里不再有降级/传输那几个字段
    expect(r).not.toHaveProperty("degradations");
    expect(r.data).not.toHaveProperty("degraded");
    expect(r.data).not.toHaveProperty("transportUsed");
  });
});
