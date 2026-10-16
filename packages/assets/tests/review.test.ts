import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { AssetSpec, StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, packContactSheet, reviewPack } from "../src/index.js";
import { encodePNG } from "../src/png.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
/** ⚠️ **原图**（票 78 的 Q5 = (乙) 要喂的那一张）—— 用仓里那份**永远在**的夹具，别指向 `.scratch`。 */
const REF = ROOT + "fixtures/e2e/wasteland-platformer/style.png";
const STYLE: StyleSpec = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "review-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const SPECK: AssetSpec = {
  kind: "sprite", id: "crate", role: "obstacle", description: "木箱", styleId: "s",
  anchor: { x: 0, y: 0 }, size: { w: 8, h: 8 }, required: true,
};
const stub = (): never => ([{
  format: "drawlist+curve/v1", id: "crate", frame: "crate",
  viewBox: [0, 0, 8, 8], expectedSize: [8, 8],
  ops: [{ op: "rect", x: 0, y: 0, w: 8, h: 8, fill: "palette:1" }],
}] as never);

const buildOne = () => buildAssetPack({
  recipe: { id: "t", styleRef: "authoring/stylespec.json", assets: [{ spec: SPECK, source: { kind: "drawlist" } }] },
  style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, sourceDateEpoch: 1790208000,
});

describe("packContactSheet", () => {
  it("⚠️ 真的把帧拷进去了 —— 曾经把 Buffer.copy 的参数写反、静默拷了个空", async () => {
    const { packDir } = await buildOne();
    const sheet = packContactSheet(packDir);
    let nonBg = 0;
    for (let i = 0; i < sheet.width * sheet.height; i++) {
      const p = i * 4;
      if (!(sheet.data[p] === 24 && sheet.data[p + 1] === 28 && sheet.data[p + 2] === 31 && sheet.data[p + 3] === 255)) nonBg++;
    }
    // 8×8 的帧至少放大 4 倍 ⇒ 至少 1024 个像素
    expect(nonBg).toBeGreaterThan(1000);
  });

  it("透明像素不覆盖底色（联系表是给人看的，不是给引擎加载的）", async () => {
    const { packDir } = await buildOne();
    const sheet = packContactSheet(packDir);
    for (let i = 0; i < sheet.width * sheet.height; i++) expect(sheet.data[i * 4 + 3]).toBe(255);
  });
});

describe("reviewPack —— 只观察、不判分、不阻断", () => {
  const fake = (body: unknown, status = 200): typeof fetch =>
    (async () => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response) as typeof fetch;

  it("把返回按行拆成观察清单", async () => {
    const { packDir } = await buildOne();
    const body = { content: [{ type: "text", text: "1. 材质不对劲\n- 橙色面积超标\n\n3) 描边偏黑" }] };
    const r = await reviewPack({ packDir, style: STYLE, referenceImagePath: REF, baseUrl: "http://x", apiKey: "k", fetchImpl: fake(body) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.observations).toEqual(["材质不对劲", "橙色面积超标", "描边偏黑"]);
  });

  it("⚠️ 上游挂了也**不抛** —— 抽查失败不该让一个已经做好的包变得不可用", async () => {
    const { packDir } = await buildOne();
    const r = await reviewPack({ packDir, style: STYLE, referenceImagePath: REF, baseUrl: "http://x", apiKey: "k", fetchImpl: fake({ error: "boom" }, 500) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/HTTP 500/);
  });

  it("网络异常也不抛", async () => {
    const { packDir } = await buildOne();
    const boom = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const r = await reviewPack({ packDir, style: STYLE, referenceImagePath: REF, baseUrl: "http://x", apiKey: "k", fetchImpl: boom });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/不阻断/);
  });

  it("prompt 里明确要求「只描述差异、不要打分」", async () => {
    const { packDir } = await buildOne();
    let sent = "";
    const spy = (async (_u: string, init: RequestInit) => { sent = init.body as string; return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "x" }] }) } as Response; }) as unknown as typeof fetch;
    await reviewPack({ packDir, style: STYLE, referenceImagePath: REF, baseUrl: "http://x", apiKey: "k", fetchImpl: spy });
    expect(sent).toMatch(/不要打分，不要排名，不要给「通过 \/ 不通过」的结论/);
    expect(JSON.parse(sent).messages[0].content[0].type).toBe("image");   // 图在文本之前
  });
});

// ── 票 78：接线之后新增的三件事 ────────────────────────────────────────────────
//
// ⚠️ 这一组盯的是**裁定**，不是函数的手感：
//   Q5 = (乙)「**两张都喂**」· Q2 = 乙「**事后必须记账**」（这一层只保证**把账带出来**，
//   写进哪份账由 `pipeline` 的 `recordRunSpend` 负责）· 以及「**一次都没上路就不记**」。
describe("票 78 —— 两张图都喂 · 且把账带出来", () => {
  const grab = () => {
    let sent = "";
    const spy = (async (_u: string, init: RequestInit) => {
      sent = init.body as string;
      return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "还行" }] }) } as Response;
    }) as unknown as typeof fetch;
    type Block = { type: string; text?: string; source?: { media_type?: string; data?: string } };
    return { spy, body: () => JSON.parse(sent) as { messages: { content: Block[] }[] } };
  };

  it("⭐ content 里是**两张图**，且**原图在前、联系表在后**（基准 → 被检查的对象）", async () => {
    const { packDir } = await buildOne();
    const g = grab();
    await reviewPack({ packDir, style: STYLE, referenceImagePath: REF, baseUrl: "http://x", apiKey: "k", fetchImpl: g.spy });
    const content = g.body().messages[0]!.content;
    expect(content.filter((c) => c.type === "image")).toHaveLength(2);
    const imgs = content.filter((c) => c.type === "image");
    // ⚠️ **逐字节比**，不比大小 —— 第一版拿「原图一定比联系表小」当判据，
    //   而那是个**假设不是量**：这一跑里那个包只有一个 8×8 的木箱，
    //   联系表比原图**小得多**，于是那条断言红在一个与它要证的事无关的地方。
    expect(imgs[0]!.source?.data, "第一张不是那份原图的字节").toBe(readFileSync(REF).toString("base64"));
    expect(imgs[1]!.source?.data, "第二张不是那张联系表的字节").toBe(encodePNG(packContactSheet(packDir)).toString("base64"));
    expect(imgs.every((i) => i.source?.media_type === "image/png")).toBe(true);
  });

  it("⭐ 返回值带一枚 `review` 的账 —— 接线那一头靠它记账", async () => {
    const { packDir } = await buildOne();
    const r = await reviewPack({ packDir, style: STYLE, referenceImagePath: REF, baseUrl: "http://x", apiKey: "k", fetchImpl: grab().spy });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.call.step).toBe("review");
      expect(r.call.target, "账要回答得出「抽查的是哪一个包」").toBe("t");
      expect(r.call.attempts).toBe(1);
      expect(typeof r.call.ms).toBe("number");
    }
  });

  it("⚠️ 上游回了 HTTP 500 ⇒ 失败**也带账**（发出去了就是花掉了）", async () => {
    const { packDir } = await buildOne();
    const fake500 = (async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => "" }) as Response) as unknown as typeof fetch;
    const r = await reviewPack({ packDir, style: STYLE, referenceImagePath: REF, baseUrl: "http://x", apiKey: "k", fetchImpl: fake500 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.call?.step).toBe("review");
  });

  it("⚠️⚠️ **原图读不出来 ⇒ 一次都没上路 ⇒ 不带账**（票 46：不许记没上路的往返）", async () => {
    const { packDir } = await buildOne();
    const r = await reviewPack({ packDir, style: STYLE, referenceImagePath: path.join(tmp(), "没有这张图.png"), baseUrl: "http://x", apiKey: "k", fetchImpl: grab().spy });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/原图读不出来/);
      expect(r.call, "一次都没上路却记了账").toBeUndefined();
    }
  });

  it("⚠️ 扩展名不在白名单 ⇒ 说得出是哪一份白名单（与 `analyze-reference` **同一份**）", async () => {
    const { packDir } = await buildOne();
    const r = await reviewPack({ packDir, style: STYLE, referenceImagePath: REF.replace(/\.png$/, ".tiff"), baseUrl: "http://x", apiKey: "k", fetchImpl: grab().spy });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/不在白名单里（\.png \/ \.jpg \/ \.jpeg \/ \.webp）/);
  });
});
