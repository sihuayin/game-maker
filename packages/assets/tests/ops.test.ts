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
    anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true },
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

  it("⚠️ 而**一笔都没成功**时也不留空现场（票 01）", () => {
    // 保住创作态与「不堆积」是同一件事的两面：**有东西才留**。
    // 这一条钉住空的那一半 —— 一次调用都没成，那里一个文件都没有，留着只是垃圾。
    expect(fs.existsSync(path.join(OUT, "no-fallback", "failed-"))).toBe(false);
    expect(fs.readdirSync(path.join(OUT, "no-fallback")).filter((x) => x.startsWith("failed-") || x.startsWith(".building-"))).toEqual([]);
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

describe("⚠️ 失败现场：一次失败就是几笔**已经付过钱**的调用（票 01）", () => {
  // ⚠️ 由来：`pack` 写进 `.building-<pid>-<版本>`、成功后改名过去，而产物是**一个一个落的**
  //   ⇒ 失败那一刻，已经付过钱的东西就躺在磁盘上 —— 原来那一次 `rmSync` 把它全删了。
  //   实测两次：GPT 6 笔 · 约 19 分钟、Gemini 4 笔 · 约 9.5 分钟，产物为零。
  const D2 = fs.mkdtempSync(path.join(os.tmpdir(), "gm-ops-keep-"));
  const OUT2 = path.join(D2, "out");
  /** 两份资源 ⇒ 第一份成功时它的产物就落进工作目录了，第二份挂掉。 */
  const TWO = { ...RECIPE, id: "keepsake", assets: [RECIPE.assets[0]!,
    { ...RECIPE.assets[0]!, spec: { ...RECIPE.assets[0]!.spec, id: "crate2" } }] };
  const recipePath = path.join(D2, "recipe.json");
  fs.writeFileSync(recipePath, JSON.stringify(TWO));
  // ⚠️ `styleRef` 相对**配方文件**解析 ⇒ 风格规格得跟着配方走
  fs.writeFileSync(path.join(D2, "stylespec.json"), JSON.stringify(STYLE));

  it("上游第二次挂掉 ⇒ `CommandError` 上带着**失败现场的路径**，里面躺着第一份的产物", async () => {
    let n = 0;
    const flaky = (async () => {
      if (++n === 1) return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(GOOD) }] }),
        { status: 200, headers: { "content-type": "application/json" } });
      throw new Error("抖一下");
    }) as typeof fetch;
    const e = await packAssets({
      recipePath, outRoot: OUT2, transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: flaky,
      concurrency: { text: 1, image: 1 },     // ⚠️ 串行 ⇒ 「第一个成功」才是确定的
    }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    const kept = (e as CommandError).failureDir;
    expect(kept, "失败现场没搬进 CommandError").toBeDefined();
    // ⚠️ 里面是**真的付过钱的那一份** —— 而**不是**清单上的全部
    expect(fs.existsSync(path.join(kept!, "authoring/drawlist/crate.json"))).toBe(true);
    expect(fs.existsSync(path.join(kept!, "authoring/drawlist/crate2.json"))).toBe(false);
    // ⚠️ 它是失败现场不是包：不占版本号、也不在 `pack/` 底下
    expect(fs.existsSync(path.join(OUT2, "keepsake", "pack", "v1"))).toBe(false);
    expect(path.dirname(kept!)).toBe(path.join(OUT2, "keepsake"));
  });
});
