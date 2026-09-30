import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseLedger, summarizeCalls } from "@game-maker/contracts";
import { CommandError, encodePNG, packAssets, verifyPack, type RasterImage } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const STYLE = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/style-spec.halt-dusk.json"), "utf8"));

const RECIPE = {
  format: "asset-recipe/v1", id: "ledger-probe", styleRef: "stylespec.json",
  assets: [
    { spec: { kind: "sprite", id: "crate", role: "箱子", description: "一个木箱。", styleId: "flat-pixel-side-scroller",
        anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true },
      source: { kind: "drawlist" } },
    { spec: { kind: "background", id: "sky", role: "天空", description: "黄昏的天。", styleId: "flat-pixel-side-scroller",
        anchor: { x: 0, y: 0 }, size: { w: 480, h: 270 }, required: true,
        layers: [{ name: "sky", parallax: 0 }] },
      source: { kind: "image", background: { tolerance: 40 } } },
  ],
};

const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-ledger-"));
  fs.writeFileSync(path.join(d, "stylespec.json"), JSON.stringify(STYLE));
  fs.writeFileSync(path.join(d, "recipe.json"), JSON.stringify(RECIPE));
  return d;
};
/**
 * 一个**按 URL 分流**的上游桩：文本走 messages、生图走 images/generation（票 45 要两类都记）。
 * `withUsage` 决定上游**给不给** usage；`fails` 让文本那一路先失败几次，制造重试。
 */
const up = (withUsage: boolean, fails = 0): typeof fetch => {
  let textFails = 0;
  const PNG = encodePNG(img(48, 48));
  return (async (url: string) => {
    if (String(url).includes("/images/")) {
      return new Response(JSON.stringify({
        data: [{ b64_json: PNG.toString("base64") }],
        ...(withUsage ? { usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } } : {}),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (textFails < fails) { textFails += 1; return new Response("boom", { status: 500 }); }
    return new Response(JSON.stringify({
      // ⚠️ 与请求的 deepseek-v4-pro **不同** —— 票 01 实测过代理会换模型
      model: "deepseek-flash",
      content: [{ type: "text", text: JSON.stringify({ frames: [{ name: "x", ops: [{ op: "rect", x: 0, y: 0, w: 16, h: 16, fill: "palette:0" }] }] }) }],
      ...(withUsage ? { usage: { input_tokens: 1200, output_tokens: 900, completion_tokens_details: { reasoning_tokens: 0 } } } : {}),
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
};

/** 一张板正的纯色图 —— 生图那一路的回应。 */
function img(w: number, h: number): RasterImage {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = 58; data[i * 4 + 1] = 63; data[i * 4 + 2] = 92; data[i * 4 + 3] = 255; }
  return { width: w, height: h, data };
}

const build = async (d: string, opts: { usage: boolean; fails: number } = { usage: true, fails: 0 }) =>
  packAssets({
    recipePath: path.join(d, "recipe.json"), outRoot: path.join(d, "out"),
    transport: { baseUrl: "http://x", apiKey: "k" },
    imageTransport: { protocol: "openai", baseUrl: "http://x", apiKey: "k" },
    fetchImpl: up(opts.usage, opts.fails),
  });

describe("账：跟着包走的收据（票 45）", () => {
  it("`ledger.json` 落在包根，**自动进 files[]**，`verify` 认它 —— 契约零改动", async () => {
    const d = tmp();
    await build(d);
    const packDir = path.join(d, "out", "ledger-probe", "pack", "v1");
    const ledger = JSON.parse(fs.readFileSync(path.join(packDir, "ledger.json"), "utf8"));
    expect(parseLedger(ledger).ok, "账本身要过 schema").toBe(true);

    const m = parseAssetPack(JSON.parse(fs.readFileSync(path.join(packDir, "manifest.json"), "utf8")));
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    // ⚠️ **契约一个字没改**：还是 v2，provenance 里没有账
    expect(m.value.format).toBe("assetpack/v2");
    expect(Object.keys(m.value.provenance).sort()).toEqual(["mode", "style"]);
    // ⚠️ 而 sidecar 靠 `files[]` 是 `walk(packDir)` 穷举**白拿**了 checksum 覆盖
    expect(m.value.files.map((f) => f.path)).toContain("ledger.json");
    expect(verifyPack({ packDir }).data.ok).toBe(true);
  });

  it("三类调用各记各的；`attempts` 让**重试**看得见", async () => {
    const d = tmp();
    await build(d, { usage: true, fails: 1 });    // 第一次文本调用失败一次、第二次成功
    const ledger = JSON.parse(fs.readFileSync(path.join(d, "out", "ledger-probe", "pack", "v1", "ledger.json"), "utf8"));
    const calls = ledger.calls as { step: string; attempts: number; ms: number }[];
    // 这份清单两个资源：一个 drawlist、一个生图 —— 两类调用各记各的
    // ⚠️ **顺序不按清单走**：票 47 之后资源是**并发**生成的，`calls[]` 记的是**完成顺序**。
    //   这是真的（它们确实同时在跑），所以断言要按**内容**而不是按位置。
    expect([...calls.map((c) => c.step)].sort()).toEqual(["drawlist", "image"]);
    expect(calls.find((c) => c.step === "drawlist")!.attempts, "重试过的那个要 > 1").toBe(2);
    expect(calls.find((c) => c.step === "image")!.attempts).toBe(1);
    // ⚠️ **只记发生过的步** —— 这一趟没有 `derive`，所以键里就没有它。
    //   写一个 `derive: {calls: 0}` 会让「这个包跑过推导吗」的答案取决于**枚举里有没有那个值**，
    //   而不是取决于这一趟真发生了什么。加一个 `LedgerStep` 值时也不必再动格式版本。
    expect(summarizeCalls(calls as never)).toEqual({
      drawlist: { calls: 1, attempts: 2 },
      image: { calls: 1, attempts: 1 },
    });
  });

  it("⚠️ `usage` 上游没给就**整个键缺席** —— 不填 0 冒充「测到了 0」", async () => {
    const d = tmp();
    await build(d, { usage: false, fails: 0 });
    const ledger = JSON.parse(fs.readFileSync(path.join(d, "out", "ledger-probe", "pack", "v1", "ledger.json"), "utf8"));
    for (const c of ledger.calls) expect("usage" in c, "上游没给就缺席").toBe(false);
  });

  it("模型名记的是**上游自报的那个**，不是我们请求的那个", async () => {
    const d = tmp();
    await build(d);
    const ledger = JSON.parse(fs.readFileSync(path.join(d, "out", "ledger-probe", "pack", "v1", "ledger.json"), "utf8"));
    expect(ledger.calls[0].model, "票 01：代理请求一个、回的是另一个").toBe("deepseek-flash");
  });

  it("⚠️ **墙钟与调用耗时之和是两个不相加的量** —— 两个都记", async () => {
    const d = tmp();
    await build(d);
    const ledger = JSON.parse(fs.readFileSync(path.join(d, "out", "ledger-probe", "pack", "v1", "ledger.json"), "utf8"));
    expect(typeof ledger.run.wallClockMs).toBe("number");
    // 墙钟覆盖整条 run（含光栅化与落盘），必然 ≥ 任何单次调用 —— 但它们**不是一个数**
    // ⚠️ 桩是**秒回**的，所以各次调用的 ms 可能是 0 —— 这恰恰说明两个量**不是一回事**：
    //   「调用花了多久」是上游的事，「墙钟」是整条 run（含光栅化与落盘）的事。
    expect(ledger.run.wallClockMs).toBeGreaterThanOrEqual(
      Math.max(0, ...ledger.calls.map((c: { ms: number }) => c.ms)));
    expect(ledger.run.byStep.drawlist.calls + ledger.run.byStep.image.calls).toBe(ledger.calls.length);
  });

  it("⚠️ **没有 ledger.json 不是错** —— 票 45 之前产的包必须照常通过", () => {
    // 真产物：票 40 的包，它比这张票早
    const packDir = path.join(ROOT, "fixtures/packs/last-train/v2");
    expect(fs.existsSync(path.join(packDir, "ledger.json"))).toBe(false);
    const r = verifyPack({ packDir });
    expect(r.data.ok, "没账也要过").toBe(true);
    expect(r.summary.join("\n")).toMatch(/没有 ledger\.json（\*\*不是错\*\*/);
  });

  it("包与账对不上 → verify 报出来（账是**这个包**的收据）", async () => {
    const d = tmp();
    await build(d);
    const p = path.join(d, "out", "ledger-probe", "pack", "v1", "ledger.json");
    const l = JSON.parse(fs.readFileSync(p, "utf8"));
    l.packVersion = 99;
    fs.writeFileSync(p, JSON.stringify(l));
    // ⚠️ 改了文件 checksum 就不符了 —— 那条会先报；把两条都看成「包坏了」即可
    expect(() => verifyPack({ packDir: path.join(d, "out", "ledger-probe", "pack", "v1") })).toThrow(/checksum|对不上/);
  });
});

/**
 * 票 46：**失败也要报账**。
 *
 * ⚠️ 包没产出来 ⇒ 没有 `ledger.json` 可写，而**花了钱是事实**。
 *   所以账跟着**异常**走（不是塞回 `CommandResult` —— 那会换掉票 30 立的那条规矩）。
 */
describe("失败也要报账（票 46）", () => {
  /** 第 `failAt` 个资源开始失败 —— 而**前面那几个已经花掉了**。 */
  const upTo = (failAt: number): typeof fetch => {
    let n = 0;
    return (async () => {
      n += 1;
      if (n > failAt) return new Response("boom", { status: 500 });
      return new Response(JSON.stringify({
        model: "deepseek-flash",
        content: [{ type: "text", text: JSON.stringify({ frames: [{ name: "x", ops: [{ op: "rect", x: 0, y: 0, w: 16, h: 16, fill: "palette:0" }] }] }) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
  };
  /** 全是 drawlist 的清单：5 个资源，好让「前几个已经花掉」这件事有内容。 */
  const manyRecipe = () => ({
    format: "asset-recipe/v1", id: "will-fail", styleRef: "stylespec.json",
    assets: Array.from({ length: 5 }, (_, i) => ({
      spec: { kind: "sprite", id: `o${i}`, role: "物件", description: "一个方块。", styleId: "flat-pixel-side-scroller",
        anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true },
      source: { kind: "drawlist" },
    })),
  });
  const dir = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-fail-"));
    fs.writeFileSync(path.join(d, "stylespec.json"), JSON.stringify(STYLE));
    fs.writeFileSync(path.join(d, "recipe.json"), JSON.stringify(manyRecipe()));
    return d;
  };

  it("中途失败 ⇒ `CommandError` 带上**前面已经花掉的**（条数 · 目标 · 往返次数）", async () => {
    const d = dir();
    const e = await packAssets({
      recipePath: path.join(d, "recipe.json"), outRoot: path.join(d, "out"),
      transport: { baseUrl: "http://x", apiKey: "k" },
      fetchImpl: upTo(2),                       // 前两个成功，第三个开始 500
      concurrency: { text: 1 },                 // 串行 ⇒ 顺序确定，断言才钉得死
    }).catch((x: unknown) => x);

    expect(e).toBeInstanceOf(CommandError);
    const err = e as CommandError;
    expect(err.kind).toBe("upstream");
    expect(err.ledger, "花掉的账要跟着异常出来").toBeDefined();
    // 5 个资源：前两个成功、第三个也**记了**（失败的那次调用同样是既成事实），
    // 而票 47 的「失败即止」让后两个根本没发出去
    expect(err.ledger!.map((c) => c.target)).toEqual(["o0", "o1", "o2"]);
    expect(err.ledger!.every((c) => c.step === "drawlist")).toBe(true);
    expect(err.ledger!.reduce((n, c) => n + c.attempts, 0)).toBeGreaterThanOrEqual(3);
    expect(err.message).toMatch(/HTTP 500/);

    // ⚠️ **`model` 与 `requestedModel` 是两个事实**（真实跑抓到过这处的谎）：
    //   上游指向死端口时，账里曾写着 `deepseek-v4-pro` —— 而那几次**根本没到过任何上游**。
    // 前两个是**成功**的：上游答了，`model` 记的就是它自报的那个
    const ok = err.ledger![0]! as { model?: string; requestedModel?: string };
    expect(ok.requestedModel).toBe("deepseek-v4-pro");
    expect(ok.model, "上游自报的那个 —— 与请求的**不同**（票 01 实测过代理会换）").toBe("deepseek-flash");
    // 最后一个是**失败**的那一笔：上游根本没应答，所以没有 `model` 可言
    const failed = err.ledger!.at(-1)! as { model?: string; requestedModel?: string };
    expect(failed.requestedModel, "我们请求了什么，是知道的").toBe("deepseek-v4-pro");
    expect(failed.model, "上游没应答 ⇒ 不记「谁服务的」，不拿请求的那个顶替").toBeUndefined();
  });

  it("⚠️ 失败**不**塞回 `CommandResult` —— 它抛，账跟着异常走（票 30 的纪律照旧）", async () => {
    const d = dir();
    const e = await packAssets({
      recipePath: path.join(d, "recipe.json"), outRoot: path.join(d, "out"),
      transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: upTo(0), concurrency: { text: 1 },
    }).catch((x: unknown) => x);
    // 抛出来的**不是**一个「带错误的结果」——「成功」那个类型里仍然没有假货
    expect(e).toBeInstanceOf(CommandError);
    expect(e).not.toHaveProperty("command");
    expect(e).not.toHaveProperty("data");
    expect(e).not.toHaveProperty("outcome");
  });

  it("**一个都没发出去就挂了** ⇒ 账是空的，不假装有（也不编一个 0）", async () => {
    const d = dir();
    const e = await packAssets({
      recipePath: path.join(d, "recipe.json"), outRoot: path.join(d, "out"),
      transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: upTo(0), concurrency: { text: 1 },
    }).catch((x: unknown) => x);
    // 第一个调用就失败 ⇒ 它自己**记了**（那次确实是发出去的），所以是 1 条不是 0 条
    expect((e as CommandError).ledger!.map((c) => c.target)).toEqual(["o0"]);
  });
});
