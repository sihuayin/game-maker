import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { AssetSpec, StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, packContactSheet, reviewPack } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const STYLE: StyleSpec = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "review-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const SPECK: AssetSpec = {
  kind: "sprite", id: "crate", role: "obstacle", description: "木箱", styleId: "s",
  anchor: { x: 0, y: 0 }, size: { w: 8, h: 8 }, dependencies: [], required: true,
};
const stub = (): never => ([{
  format: "drawlist+curve/v1", id: "crate", frame: "crate",
  viewBox: [0, 0, 8, 8], expectedSize: [8, 8],
  ops: [{ op: "rect", x: 0, y: 0, w: 8, h: 8, fill: "palette:1" }],
}] as never);

const buildOne = () => buildAssetPack({
  recipe: { id: "t", styleRef: "authoring/stylespec.json", assets: [{ spec: SPECK, source: { kind: "generate" } }] },
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
    const r = await reviewPack({ packDir, style: STYLE, baseUrl: "http://x", apiKey: "k", fetchImpl: fake(body) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.observations).toEqual(["材质不对劲", "橙色面积超标", "描边偏黑"]);
  });

  it("⚠️ 上游挂了也**不抛** —— 抽查失败不该让一个已经做好的包变得不可用", async () => {
    const { packDir } = await buildOne();
    const r = await reviewPack({ packDir, style: STYLE, baseUrl: "http://x", apiKey: "k", fetchImpl: fake({ error: "boom" }, 500) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/HTTP 500/);
  });

  it("网络异常也不抛", async () => {
    const { packDir } = await buildOne();
    const boom = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const r = await reviewPack({ packDir, style: STYLE, baseUrl: "http://x", apiKey: "k", fetchImpl: boom });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/不阻断/);
  });

  it("prompt 里明确要求「只描述差异、不要打分」", async () => {
    const { packDir } = await buildOne();
    let sent = "";
    const spy = (async (_u: string, init: RequestInit) => { sent = init.body as string; return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "x" }] }) } as Response; }) as unknown as typeof fetch;
    await reviewPack({ packDir, style: STYLE, baseUrl: "http://x", apiKey: "k", fetchImpl: spy });
    expect(sent).toMatch(/不要打分，不要排名，不要给「通过 \/ 不通过」的结论/);
    expect(JSON.parse(sent).messages[0].content[0].type).toBe("image");   // 图在文本之前
  });
});
