// 票 29 的闸：`stylespec.json` 从「一句编译期的谎」（`as StyleSpec`）变成**真过一遍 schema**。
//
// ⚠️ 这些用例在本票之前**全都不存在**，而且**都不会红** —— 不是因为代码对，是因为那条路
//   **根本没有判据**：`pack.test.ts` 直接调 `buildAssetPack`，绕开了 `packAssets` 里那道
//   「读盘 → 校验」的入口。所以本文件测的是**入口**，不是打包器。
//
// 三条判据对应人类 2026-10-11 裁定的三处边界（逐字见票 29 的 `## Answer`）：
//   ① Q1「使用 `StyleSpecSchema.safeParse`，失败时按现有错误处理方式拒绝」
//      → 拒必须是 `CommandError("invalid")`（退出码 4），不是裸 `Error`（退出码 1）。
//   ② Q2「入口负责规范化，大写输入先转小写，再按现有规则去重，最后校验」
//      → 大写色板**必须被收下并规范化**，不许拒。
//   ③ Q1「不要把 schema 校验通过误认为业务数据必然可用」
//      → 色板缺席那条曾作为一条 **characterization** 测试钉在这里；**票 44 把它关了**
//        （人类 2026-10-12 裁定 Q1=(a)「空色板的产物不该存在，一律拒」，落点就是本文件的入口）。
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
  format: "asset-recipe/v1", id: "gate", styleRef: "stylespec.json",
  assets: [{ spec: { kind: "sprite", id: "crate", role: "箱子", description: "一个木箱。", styleId: "style-ref",
    anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true },
    source: { kind: "drawlist" } }],
};
const GOOD = { frames: [{ name: "crate", ops: [{ op: "rect", x: 0, y: 0, w: 16, h: 16, fill: "palette:0" }] }] };

/**
 * 跑一次 `packAssets`，**数上游被调了几次**。
 *
 * ⚠️ `calls` 是本文件的骨干：Q1 的边界是「失败时拒绝」，而在这个仓库里
 *   「拒绝」若不发生在**花钱之前**就毫无价值（R12）。所以每条拒绝用例都断言 `calls === 0`。
 */
async function attempt(styleText: string) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-gate-"));
  fs.writeFileSync(path.join(d, "stylespec.json"), styleText);
  fs.writeFileSync(path.join(d, "recipe.json"), JSON.stringify(RECIPE));
  const out = path.join(d, "out");
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(GOOD) }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const err = await packAssets({
    recipePath: path.join(d, "recipe.json"), outRoot: out,
    transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl,
  }).then(() => undefined, (e: unknown) => e);
  return { err, calls, out, dir: d };
}

const doc = (over: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>)) => {
  const base = STYLE as unknown as Record<string, unknown>;
  return JSON.stringify(typeof over === "function" ? over(base) : { ...base, ...over });
};

describe("票 29 · 闸在花钱之前：坏 stylespec 一律 CommandError(\"invalid\")、退出码 4、零次上游调用", () => {
  // ⚠️ 这四条在加闸之前**一路走到生图**（票面原话：`{"id":"x","identity":[],"confidence":2}` 今天能过）。
  //   ⚠️ 「缺席」那条只能用**函数形**：`{...base, ...over}` 是**删不掉**键的（摊开只会盖、不会抹），
  //     用对象形写它会得到一份**带着** `confidence` 的文档，然后这条判据就变成永远不红。
  const teeth: [string, Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>)][] = [
    ["confidence 越界（2）", { confidence: 2 }],
    ["confidence 缺席", (s) => { const { confidence, ...r } = s; return r; }],
    ["id 不是字符串（42）", { id: 42 }],
    ["identity 不是数组（\"x\"）", { identity: "x" }],
    ["camera 不是对象（[]）", { camera: [] }],
    ["色板里混进非字符串", { palette: ["#aabbcc", 7] }],
  ];

  for (const [name, over] of teeth) {
    it(`${name} → 拒，且一次都没花`, async () => {
      const { err, calls } = await attempt(doc(over));
      expect(err).toBeInstanceOf(CommandError);
      expect((err as CommandError).kind).toBe("invalid");
      expect(EXIT[(err as CommandError).kind]).toBe(4);
      expect(calls).toBe(0);
    });
  }

  it("报错**可定位**到字段（R2 之后这是唯一留下的质量控制）", async () => {
    // ⚠️ 只查字段路径、**不查文件路径** —— `readVisualWorld` / `readCharacterRef` 两条兄弟读法
    //   在 schema 失败时都**不带文件名**，本闸照抄它们。多加一个，就是同一种失败的第二套写法。
    const { err } = await attempt(doc({ confidence: 2 }));
    expect((err as Error).message).toMatch(/confidence/);
  });

  it("文件根本不是 JSON → 拒（而不是把 SyntaxError 抛给调用方）", async () => {
    const { err, calls } = await attempt("{ not json");
    expect(err).toBeInstanceOf(CommandError);
    expect((err as CommandError).kind).toBe("invalid");
    expect((err as Error).message).toMatch(/读不出来或不是 JSON/);
    expect(calls).toBe(0);
  });

  // ⚠️ 重复色那条**不是** `StyleSpecSchema` 报的，是入口调 `normalizePalette` 时它自己抛的。
  //   所以它单列一条：它是本闸里**唯一**一处「拒绝来自入口而非契约」，最容易在重构中
  //   悄悄退回成裸 `Error`（退出码 1）—— 那会让同一份坏文件按「重不重复」拿到两个退出码。
  it("色板有重复色 → 走**同一个**出口（invalid/4），不是裸 Error(/1)", async () => {
    const { err, calls } = await attempt(doc({ palette: ["#aabbcc", "#aabbcc"] }));
    expect(err).toBeInstanceOf(CommandError);
    expect((err as CommandError).kind).toBe("invalid");
    expect((err as Error).message).toMatch(/重复色/);
    expect(calls).toBe(0);
  });
});

describe("票 29 · 闸收下什么（Q2：区分规范形式与接受形式）", () => {
  it("⚠️ 大写色板**被收下并规范化**，不是被拒 —— 拒了就等于打掉仓库自己的基准 fixture", async () => {
    const { err, out } = await attempt(doc({ palette: ["#AABBCC", "#DDEEFF"] }));
    expect(err).toBeUndefined();
    const inPack = JSON.parse(fs.readFileSync(path.join(out, "gate", "pack", "v1", "authoring", "stylespec.json"), "utf8"));
    expect(inPack.palette).toEqual(["#aabbcc", "#ddeeff"]);
  });

  it("合法 stylespec → 照常出包（闸不是拦路虎）", async () => {
    const { err, calls } = await attempt(doc({}));
    expect(err).toBeUndefined();
    expect(calls).toBeGreaterThan(0);
  });
});

describe("票 44 · 色板**非空**是一条业务判据：空色板在入口就拒，零次上游调用", () => {
  // ⚠️ 本块的前身是票 29 的一条 **characterization** 测试 —— 它故意把「闸放行 → 下游才炸 → 钱花了」
  //   钉在**当时的**行为上（票 29 的边界原话：「不要把 schema 校验通过误认为业务数据必然可用」）。
  //   票 44 裁定那件事**不该存在** ⇒ 这条测试**翻了个向**：拒必须发生在**入口**、且在**花钱之前**。
  //
  //   人类 2026-10-12 的边界原话（逐字见票 44 的 `## Answer`）：
  //     · 「空色板不应因为清单暂时没有引用 `palette:N` 而被允许进入后续流程。」
  //     · 「不修改 `StyleSpecSchema`。保留 `.default([])`，遵守 R6；本票只在 `readStyle` 的
  //       业务校验层增加非空要求。」
  //     · 「不依赖清单是否引用色板。色板属于世界级风格数据。」
  it("缺 palette（整个键不在）→ 拒，且一次都没花", async () => {
    const { err, calls } = await attempt(doc((s) => { const { palette, ...r } = s; return r; }));
    expect(err).toBeInstanceOf(CommandError);
    expect((err as CommandError).kind).toBe("invalid");
    expect(EXIT[(err as CommandError).kind]).toBe(4);
    expect(calls).toBe(0);
  });

  // ⚠️ 显式空数组与「整个键缺席」**走同一条判据** —— 判在 `s.data.palette`（规范化过的值）上，
  //   而不是判「键在不在」。人类的边界正是这一条：色板的合法性**不由某一份清单的引用情况决定**。
  // ⚠️ 文案那条**必须**锚在本闸自己的话上（`至少要有一个色`），**不能只锚 `/palette/`** ——
  //   下游那条指错方向的报错里也有 `palette`（`颜色引用 "palette:0" 越界`），只锚它这条断言
  //   在闸被拿掉之后**照样绿**（实测：拿掉闸，这一条只靠上面那两个断言红）。
  it("palette 是**显式空数组** → 同一条判据拒掉，报错是**本闸自己**那句", async () => {
    const { err, calls } = await attempt(doc({ palette: [] }));
    expect(err).toBeInstanceOf(CommandError);
    expect((err as CommandError).kind).toBe("invalid");
    expect((err as Error).message).toMatch(/至少要有一个色/);
    expect(calls).toBe(0);
  });

  // ⚠️ 这一条钉的是**闸没有变宽**：非空色板照旧过闸（否则就是「修复变成破坏」，票 29 Q1 的顾虑）。
  it("非空色板照旧过闸（闸收紧的是空色板，不是色板本身）", async () => {
    const { err } = await attempt(doc({ palette: ["#112233"] }));
    expect(err).toBeUndefined();
  });
});
