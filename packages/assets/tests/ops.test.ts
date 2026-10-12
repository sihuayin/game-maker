// 兜底拆掉之后**新出现**的行为（2026-09-25）：上游不可达 → 抛 `upstream` ⇒ 退出码 3。
//
// ⚠️ 这条在拆降级链之前**测不出来** —— 那时上游死活都被兜底吸收，`pack` 永远返回 0，
// 只是产物是程序化画的色块。所以它是一条「新契约」的测试，不是回归测试。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CommandError, EXIT, exitCodeOfError, failureDirOfError, ledgerOfError, packAssets } from "../src/index.js";
import { encodePNG } from "../src/png.js";

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

describe("⚠️ 失败时报的是**真实发出的笔数**，不是「回来的那些」（票 05）", () => {
  // ⚠️ 由来：2026-09-30 两次真跑里，GPT 那一次**一笔都没回来**，于是 CLI 连
  //   「已经花掉的（N 次调用 · M 次往返）」那一行都没印 —— 而钱**确实花了**。
  //   机制：生图那一路是**调用回来之后**才 push 的（`pack.ts`），并发在飞的那几笔既没落账也没落盘。
  const D3 = fs.mkdtempSync(path.join(os.tmpdir(), "gm-ops-ledger-"));
  fs.writeFileSync(path.join(D3, "stylespec.json"), JSON.stringify(STYLE));
  const IMG = { protocol: "openai" as const, baseUrl: "http://x/v1", apiKey: "k", model: "m" };
  /** 两份**生图**资源 —— 生图那一路才只有「回来的」才落账。 */
  const TWO_IMG = { ...RECIPE, id: "img-ledger", assets: ["aa", "bb"].map((id) => ({
    spec: { kind: "sprite", id, role: id, description: `${id} 的东西`, styleId: "style-ref",
      anchor: { x: 0.5, y: 0.5 }, size: { w: 16, h: 16 }, required: true },
    source: { kind: "image", background: { tolerance: 0 } },
  })) };
  const recipePath = path.join(D3, "recipe.json");
  fs.writeFileSync(recipePath, JSON.stringify(TWO_IMG));
  /**
   * 一张最小合法的 PNG（base64）—— 生图那条上游回的就是 b64。
   *
   * ⚠️ **底色必须是我们告诉模型的那个**（[票 35](../../../.scratch/game-maker-v2/issues/35-multiframe-needs-background.md)）：
   *   `pack` 现在**始终**按 `keyColorFor(style.palette)` 抠底（`STYLE.palette` 是 `#112233`/`#445566`
   *   ⇒ 派生出 `#ff00ff`），而一张**没有那个颜色**的图会当场撞上
   *   「底色一个像素都没抠到」那条哨兵 —— 那是**对的行为**，但它与这几个测试（量的是**账**）无关。
   *   ⇒ 照着提示词会画出来的样子造：**外圈是底色、中间 2×2 是主体**。
   */
  const PNG = (() => {
    const key = [0xff, 0x00, 0xff, 0xff];       // #ff00ff
    const subject = [0x11, 0x22, 0x33, 0xff];   // 色板里的第一个
    const data = Buffer.alloc(4 * 4 * 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
      data.set(x >= 1 && x <= 2 && y >= 1 && y <= 2 ? subject : key, (y * 4 + x) * 4);
    return encodePNG({ width: 4, height: 4, data }).toString("base64");
  })();

  /** 四份**生图**资源 —— 用它量「闸门拒掉的那几笔有没有混进账」。 */
  const FOUR_IMG = { ...TWO_IMG, id: "img-four", assets: ["a", "b", "c", "d"].map((id) => ({
    spec: { ...TWO_IMG.assets[0]!.spec, id }, source: TWO_IMG.assets[0]!.source })) };
  const fourPath = path.join(D3, "four.json");
  fs.writeFileSync(fourPath, JSON.stringify(FOUR_IMG));

  it("⚠️ 一笔**发了 2 趟**然后失败 ⇒ 账上那笔的 `attempts` 是 **2**（既不是上限 3，也不是发出时的 1）", async () => {
    // ⚠️ 由来：第三次真跑的账头写着「3 次往返」，而报错自己写着「（**3 次内**）」——
    //   那一笔在一个 unit 里重试了 3 趟，账上却记 1。机制：`call`（含 `attempts`）
    //   **只在成功那条路上构造** ⇒ 失败时什么也不报。
    //   而仓库的纪律是「重试烧掉的额度要能单独看见，**否则失败的归因是错的**」。
    // ⚠️ **第 2 趟抛一个不可重试的错** ⇒ 循环当场 break ⇒ `trips === 2`。
    //   而配置的上限是 3 —— **2 ≠ 3**，这条用例才分得清「真的发了几趟」与「配置的上限」。
    //   （第一版让每一趟都抛 5xx ⇒ `trips === attempts === 3`，把实现里的 `trips` 换成
    //    `attempts` 它**照样绿** —— 那正是这条判据要抓的那个多报。）
    let http = 0;
    const upstream = (async () => {
      http += 1;
      throw new Error(http === 1 ? "HTTP 503 抖一下" : "HTTP 400 形状不对");   // 第二个**不可重试**
    }) as typeof fetch;
    const e = await packAssets({
      recipePath, outRoot: path.join(D3, "out6"), transport: { baseUrl: "http://x", apiKey: "k" },
      imageTransport: IMG, fetchImpl: upstream, concurrency: { text: 1, image: 1 },
    }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    const calls = (e as CommandError).ledger ?? [];
    expect(calls, "账上该有那一笔").toHaveLength(1);
    // ⚠️ 上游侧真的发了 **2** 趟（第一趟 5xx 可重试、第二趟 400 当场放弃），
    //   而**账上要写得下这个 2** —— 不是配置的上限 3，也不是发出时的 1。
    expect(http, "上游侧发出去的是 2 趟").toBe(2);
    expect(calls[0]!.attempts, "账上没写对真发出去的趟数").toBe(2);
  });

  it("⚠️ 闸门**拒掉的**那几笔**没发出去** ⇒ 不许记进账（判据：报出来的 === 真实发出的）", async () => {
    // ⚠️ 这是 code-review 量出来的真缺陷：push 若放在**闸门外**，那几笔排队等着、
    //   还没发出去的调用也会进账 —— 实测 4 个资源、并发 1、第一个就挂 ⇒
    //   上游只收到 **1** 笔，账上却写了 **4** 笔。
    let http = 0;
    const upstream = (async () => { http += 1; throw new Error("抖一下"); }) as typeof fetch;
    const e = await packAssets({
      recipePath: fourPath, outRoot: path.join(D3, "out4"), transport: { baseUrl: "http://x", apiKey: "k" },
      imageTransport: IMG, fetchImpl: upstream, concurrency: { text: 1, image: 1 },
    }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    // 4 个资源，只有**第 1 个**被放行过 ⇒ 账上就该只有 1 笔
    expect((e as CommandError).ledger?.length, "把没发出去的那几笔也记了").toBe(1);
    // ⚠️ 而上游侧收到的是**那 1 笔的 3 次往返**（生成器自己重试）—— 与「几笔调用」是两个数
    expect(http, "上游侧只收到第 1 个资源的那几次重试").toBeGreaterThanOrEqual(1);
    expect(http, "后面三个资源一次都没发出去").toBeLessThan(4);
  });

  it("第 2 笔挂掉 ⇒ 账上**恰好 2 笔**（第 1 笔回来的 + 第 2 笔发出去的）", async () => {
    let sent = 0;
    const upstream = (async () => {
      if (++sent === 2) throw new Error("抖一下");
      return new Response(JSON.stringify({ data: [{ b64_json: PNG }] }),
        { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const e = await packAssets({
      recipePath, outRoot: path.join(D3, "out"), transport: { baseUrl: "http://x", apiKey: "k" },
      imageTransport: IMG, fetchImpl: upstream, concurrency: { text: 1, image: 1 },
    }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    const calls = (e as CommandError).ledger ?? [];
    // ⚠️ **发出几笔就该记几笔** —— 不是「回来几笔记几笔」
    expect(sent, "上游侧确实发出去两笔").toBe(2);
    expect(calls.length, "账上只记了回来的那一笔").toBe(2);
    // ⚠️ 票 06 之后，**失败的那一笔也带着事实**：它 settle 过（以失败的方式）——
    //   所以 `ms` 不再缺席，「还没回来」只留给**真的还没收尾**的那些。
    const failed = calls.find((c) => c.target === "bb");
    expect(failed?.ms, "失败的那笔该带着它烧掉的时间").toBeDefined();
    expect(failed?.attempts, "而它重试了几趟也要写得下").toBeGreaterThanOrEqual(1);
    expect(calls.filter((c) => c.ms === undefined), "没有哪一笔还悬着").toEqual([]);
  });
});

// ── 票 13 的 Q6：**参考图在某家协议上会静默丢掉** ──────────────────────────────
//
// ⚠️ 手法：上游配成**死的**（`http://127.0.0.1:9`）—— 于是
//   · 拦停**没响** ⇒ 一路撞到死上游上 ⇒ `CommandError("upstream")`（退出码 3）
//   · 拦停**响了** ⇒ 在花钱之前就停下 ⇒ `CommandError("usage")`（退出码 2）
//   两种结局分得开，所以不用真上游也能测这条判据。
describe("⚠️ 「带参考图」在某家协议上会**静默地不成立**（票 13 的 Q6）", () => {
  const IMG_SPEC = {
    kind: "sprite", id: "player-idle", role: "玩家", description: "待机一帧", styleId: "style-ref",
    anchor: { x: 0.5, y: 1 }, size: { w: 32, h: 48 }, required: true, masterAsset: "player-master",
  };
  const recipe = (over: Record<string, unknown> = {}) => ({
    format: "asset-recipe/v1", id: "q6", styleRef: "stylespec.json",
    assets: [{ spec: { ...IMG_SPEC }, source: { kind: "image" } }],
    authoring: [{ id: "player-master", role: "母版", description: "一张参考图", source: { kind: "import", ref: "x.png" }, characterId: "p", size: { w: 64, h: 96 } }],
    ...over,
  });
  const run = async (doc: unknown, protocol: "dashscope-mcp" | "gemini") => {
    fs.writeFileSync(path.join(dir, "q6.json"), JSON.stringify(doc));
    return packAssets({
      recipePath: path.join(dir, "q6.json"), outRoot: OUT,
      transport: { baseUrl: dead, apiKey: "x" },
      imageTransport: { protocol, baseUrl: dead, apiKey: "x" },
    }).catch((e: unknown) => e);
  };

  it("dashscope-mcp + 清单里**真有图要递**（母版）⇒ **开跑前**拒，且说得出是哪一张", async () => {
    const e = await run(recipe(), "dashscope-mcp");
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("usage");
    expect((e as Error).message).toContain("player-master");
    expect((e as Error).message).toContain("静默丢掉");
  });

  it("dashscope-mcp + 世界风格图（`referenceImage`）⇒ 同样拒（它也是要递出去的一张图）", async () => {
    const e = await run(recipe({ referenceImage: "../reference/test.png" }), "dashscope-mcp");
    expect((e as CommandError).kind).toBe("usage");
    expect((e as Error).message).toContain("referenceImage");
  });

  it("⚠️ **`styleRef` 不是图，永远不触发** —— 只有它的时候照跑（撞死在死上游上，不是 `usage`）", async () => {
    const e = await run(recipe({ assets: [{ spec: { ...IMG_SPEC, masterAsset: undefined }, source: { kind: "drawlist" } }], authoring: undefined }), "dashscope-mcp");
    expect((e as CommandError).kind).not.toBe("usage");
  });

  it("换一个支持参考图的协议（gemini）⇒ 不拒 —— 这条只针对那一家", async () => {
    const e = await run(recipe(), "gemini");
    expect((e as CommandError).kind).not.toBe("usage");
  });
});

// ── 票 48：**判断失败**那条路 —— 账与失败现场一起跟着异常走 ────────────────────
//
// ⚠️ 病（票 48 的票面）：`pack` 段那些**判断**抛的是普通 `Error`，而兜底原来是一句
//   `throw e` ⇒ **`carried` 组装好了又被整包扔掉** ⇒ 两个壳都报「没花钱」。
//   2026-10-09 那次真跑就是这么丢掉 9 张已付费的图的。
//
// ⚠️ **这一条是端到端**（票 48 第 2 轮 Q2 = B）：它走的是 `packAssets` 这条**真**路 ——
//   判定/渲染/现场改名全都真发生，而契约层那 8 条只钉了三个助手。⇒ 两者不互相顶替。
//
// ⚠️ **判据是四条一起看**（第 2 轮执行约束 2），缺一条这条测试就测不动它要测的东西：
//   ① **错误身份**：它仍是**裸 `Error`**（不重包 ⇒ 栈与错误的类都保住）；
//   ② **退出码**：**1**（不是 3 —— 3 是「上游死活」的意思，而这里上游好好的）；
//   ③ **账**：跟着异常走，而且那**一笔是真的**（有 `ms`、有 target——不是个空壳数组）；
//   ④ **失败现场指针**：**而且那个目录真的在磁盘上**（一句好话不算数）。
describe("⚠️ 判断失败也带账与失败现场（票 48）", () => {
  const D4 = fs.mkdtempSync(path.join(os.tmpdir(), "gm-ops-48-"));
  fs.writeFileSync(path.join(D4, "stylespec.json"), JSON.stringify(STYLE));
  const IMG = { protocol: "openai" as const, baseUrl: "http://x/v1", apiKey: "k", model: "m" };
  const RECIPE_IMG = { ...RECIPE, id: "judgement", assets: [{ spec: { ...RECIPE.assets[0]!.spec, source: undefined }, source: { kind: "image" } }] };
  const recipePath = path.join(D4, "recipe.json");
  fs.writeFileSync(recipePath, JSON.stringify(RECIPE_IMG));
  const outRoot = path.join(D4, "out");

  it("生出来一张**全透明**的图 ⇒ 撞上 `pack.ts` 那条判断：裸 `Error` + 退出码 1 + 账 + 现场", async () => {
    // 上游**好好的**：它 200 并且给了一张合法 PNG —— 只是那张图**一个不透明像素都没有**。
    // ⚠️ 所以这条路上的失败**不是**上游的锅，而退出码必须说得出这个区别。
    const b64 = encodePNG({ width: 16, height: 16, data: Buffer.alloc(16 * 16 * 4) }).toString("base64");
    const fetchImpl = (async () => new Response(JSON.stringify({ data: [{ b64_json: b64 }] }),
      { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

    const e = await packAssets({
      recipePath, outRoot, transport: { baseUrl: "http://x", apiKey: "k" }, imageTransport: IMG, fetchImpl,
    }).then(() => { throw new Error("本该失败，却出包了"); }, (x: unknown) => x);

    // ⚠️ 这是一句**护栏**、不是判据：它确认我们撞的是**那条判断**，而不是别的什么也恰好失败。
    //   （锚在行为上的四条判据在下面 —— 这一句只是免得测试**安静地**测了别的东西。）
    expect((e as Error).message, "撞的不是「判断」那条路").toMatch(/不透明像素/);

    // ① 错误身份：**不重包** —— 类、名字、栈都还是原样那一份（票 48 的 Q2 = A 的正面理由）
    expect(e, "被重包成 CommandError 了（票 46 §5 反对的正是这件事）").not.toBeInstanceOf(CommandError);
    expect((e as Error).name).toBe("Error");
    expect((e as Error).stack, "栈丢了").toMatch(/pack\.ts:\d+/);
    // ② 退出码：1 —— 不是 3。3 的含义是「上游死活」，而上游这一跑**好好的**。
    expect(exitCodeOfError(e), "把「判断失败」报成了「上游不可达」").toBe(EXIT.failure);
    expect(EXIT.failure).not.toBe(EXIT.upstream);
    // ③ 账：真花掉的那一笔（`ms` 在 = 它发出去了、也回来了）
    const spent = ledgerOfError(e);
    expect(spent, "钱花了、账没人报回来（票 48 要治的就是这个）").toBeDefined();
    expect(spent!.map((c) => c.target)).toEqual(["crate"]);
    expect(spent![0]!.ms, "这一笔连「花没花」都说不清").toBeDefined();
    // ④ 失败现场指针：**而且那个目录真的在磁盘上**（票 01 的现场 + 票 36 的账都在里面）
    const kept = failureDirOfError(e);
    expect(kept).toBeDefined();
    // ⚠️ `path.resolve(outRoot, kept)` 而不是 `join` —— 这枚指针今天给的是**绝对**路径
    //   （`pack.ts` 的 `keepFailureSite` 直接给 `path`）。resolve 两种都吃得下，
    //   所以这条断言问的是「**它指的那个目录真的在磁盘上吗**」，而不是「它的形状对不对」。
    expect(fs.existsSync(path.resolve(outRoot, kept!)), `现场不在：${kept}`).toBe(true);
  });
});
