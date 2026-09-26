// 生图客户端 —— 全部离线可测：往返形状、尺寸算术、错误分类、重试边界、key 不外泄。
// 唯一没被这里覆盖的是「真上游收不收这种形状」，那需要真 key，见 experiments 里的实跑记录。
import { describe, expect, it } from "vitest";
import {
  ImageGenerationError, createDashScopeMcpGenerator, createGeminiGenerator, createOpenAIGenerator,
  encodePNG, emptyImage, geminiAspect, openaiSize, requestSize,
} from "../src/index.js";

const SECRET = "sk-THIS-MUST-NEVER-BE-PRINTED-0123456789";
/** 一张 8×8 的真 PNG，当下载回来的图用。 */
const PNG = encodePNG(emptyImage(8, 8));
const okImage = () => new Response(PNG, { status: 200 });

/** 一个假的上游：按请求体分派 initialize / tools/call / 下载。 */
const fakeUpstream = (opts: {
  callResult?: unknown; callHttp?: number; downloadStatus?: number; failTimes?: number;
}) => {
  const seen: { method: string; auth?: string; body?: unknown }[] = [];
  let calls = 0;
  const impl = (async (url: string, init?: RequestInit) => {
    const auth = (init?.headers as Record<string, string> | undefined)?.authorization;
    if (typeof url === "string" && url.startsWith("https://img.example/")) return new Response(PNG, { status: opts.downloadStatus ?? 200 });
    const body = JSON.parse(String(init?.body)) as { method: string; id: number };
    seen.push({ method: body.method, auth, body });
    if (opts.failTimes && ++calls <= opts.failTimes) throw new Error("fetch failed");
    if (body.method === "initialize") return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2024-11-05", serverInfo: { name: "BaiLianMcpServer", version: "1.0.0" } } }), { status: 200 });
    if (opts.callHttp && opts.callHttp !== 200) return new Response("boom", { status: opts.callHttp });
    const result = opts.callResult ?? { content: [{ type: "text", text: JSON.stringify({ request_id: "req-1", results: ["https://img.example/a.png?Expires=1&Signature=x"] }) }] };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, seen, get calls() { return calls; } };
};

const gen = (f: typeof fetch) => createDashScopeMcpGenerator({ baseUrl: "https://mcp.example/mcp", apiKey: SECRET, fetchImpl: f });

describe("requestSize —— 长宽比不是可选的", () => {
  it("保持长宽比（管线会把结果两方向独立拉伸到 spec.size）", () => {
    for (const [w, h] of [[16, 16], [32, 48], [64, 16], [96, 24], [14, 22], [320, 180], [48, 48]]) {
      const [a, b] = requestSize({ w, h }).split("*").map(Number) as [number, number];
      const skew = (a / b) / (w / h);
      expect(a % 16, `${w}x${h} 的长边不是 16 的倍数`).toBe(0);
      expect(b % 16, `${w}x${h} 的短边不是 16 的倍数`).toBe(0);
      expect(Math.abs(skew - 1), `${w}x${h} 拉伸了 ${((Math.max(skew, 1 / skew) - 1) * 100).toFixed(0)}%`).toBeLessThan(0.05);
    }
    expect(requestSize({ w: 16, h: 16 })).toBe("1024*1024");
  });
});

describe("往返 —— initialize 一次，然后 tools/call 再下载", () => {
  it("走完整条路，并如实记账", async () => {
    const up = fakeUpstream({});
    const r = await gen(up.impl)({ prompt: "a red square", size: { w: 32, h: 48 } });
    expect(r.image.width).toBe(8);
    expect(up.seen.filter((s) => s.method === "initialize").length).toBe(1);
    expect(up.seen.filter((s) => s.method === "tools/call").length).toBe(1);
    expect(r.call).toMatchObject({ protocol: "dashscope-mcp", requestedSize: "688*1024", attempts: 1, requestId: "req-1" });
    // ⚠️ URL 上带签名，**只许记主机**，不许整条存下来
    expect(r.call.sourceHost).toBe("img.example");
    expect(JSON.stringify(r.call)).not.toMatch(/Signature|Expires/);
  });

  it("同一个生成器第二次调用不再 initialize", async () => {
    const up = fakeUpstream({});
    const g = gen(up.impl);
    await g({ prompt: "a", size: { w: 16, h: 16 } });
    await g({ prompt: "b", size: { w: 16, h: 16 } });
    expect(up.seen.filter((s) => s.method === "initialize").length).toBe(1);
    expect(up.seen.filter((s) => s.method === "tools/call").length).toBe(2);
  });

  it("送出去的是 bailian_image_gen + 宽*高 形状的 size", async () => {
    const up = fakeUpstream({});
    await gen(up.impl)({ prompt: "hello", size: { w: 64, h: 16 } });
    const call = up.seen.find((s) => s.method === "tools/call")!.body as { params: { name: string; arguments: { prompt: string; size: string } } };
    expect(call.params.name).toBe("bailian_image_gen");
    // ⚠️ `prompt_extend: false` 是**必发**的：上游默认会用大模型改写提示词，那会把我写死的
    // 硬约束（长宽比、背景色）改掉。实测不改写时才是「我让它画什么它就画什么」。
    expect(call.params.arguments).toEqual({ prompt: "hello", size: "1024*256", prompt_extend: false });
  });

  it("negative_prompt 传下去了 —— 正向约束压不住的东西要靠它", async () => {
    const up = fakeUpstream({});
    await gen(up.impl)({ prompt: "a crate", size: { w: 16, h: 16 }, negativePrompt: "scene, border, text" });
    const call = up.seen.find((s) => s.method === "tools/call")!.body as { params: { arguments: Record<string, unknown> } };
    expect(call.params.arguments.negative_prompt).toBe("scene, border, text");
    // 不传就**不要**出现这个键（别发一个空的 negative_prompt 上去）
    const up2 = fakeUpstream({});
    await gen(up2.impl)({ prompt: "x", size: { w: 16, h: 16 } });
    const c2 = up2.seen.find((s) => s.method === "tools/call")!.body as { params: { arguments: Record<string, unknown> } };
    expect("negative_prompt" in c2.params.arguments).toBe(false);
  });

  it("⚠️ key 绝不进返回值 —— 记账里没有它，错误消息里也没有", async () => {
    const up = fakeUpstream({ callHttp: 500 });
    const r = await gen(up.impl)({ prompt: "x", size: { w: 16, h: 16 } }).catch((e: Error) => e);
    expect(JSON.stringify(r instanceof Error ? { m: r.message } : r)).not.toContain(SECRET);
    expect(up.seen[1]!.auth).toBe(`Bearer ${SECRET}`);   // 它只出现在请求头上
  });
});

describe("错误分类与重试边界 —— 这一条每次调用都是钱", () => {
  it("网络抖动重试（票 14 §7：重试吸收抖动 ≠ 降级）", async () => {
    const up = fakeUpstream({ failTimes: 1 });
    const r = await gen(up.impl)({ prompt: "x", size: { w: 16, h: 16 } });
    expect(r.call.attempts).toBe(2);
  });

  it("⚠️ 4xx **不**重试 —— 确定性错误重试只是白花钱", async () => {
    const up = fakeUpstream({ callHttp: 400 });
    await expect(gen(up.impl)({ prompt: "x", size: { w: 16, h: 16 } })).rejects.toThrow(ImageGenerationError);
    expect(up.seen.filter((s) => s.method === "tools/call").length).toBe(1);
  });

  it("上游报错 / 形状不对 → 抛，且带上原文，绝不猜", async () => {
    const cases: [string, unknown][] = [
      ["isError", { isError: true, content: [{ type: "text", text: "quota exceeded" }] }],
      ["content.text 不是 JSON", { content: [{ type: "text", text: "not json" }] }],
      ["没有 results", { content: [{ type: "text", text: JSON.stringify({ request_id: "r" }) }] }],
      ["没有 text 块", { content: [] }],
    ];
    for (const [name, result] of cases) {
      const up = fakeUpstream({ callResult: result });
      const e = await gen(up.impl)({ prompt: "x", size: { w: 16, h: 16 } }).catch((x: Error) => x);
      expect(e, name).toBeInstanceOf(ImageGenerationError);
      expect((e as Error).message, name).toMatch(/quota exceeded|不是 JSON|没有图片 URL|没有 text/);
    }
  });

  it("图下载不到也算失败", async () => {
    const up = fakeUpstream({ downloadStatus: 403 });
    await expect(gen(up.impl)({ prompt: "x", size: { w: 16, h: 16 } })).rejects.toThrow(/下载图片失败 HTTP 403/);
  });
});

describe("Gemini 客户端", () => {
  const png64 = PNG.toString("base64");
  const okGemini = (parts: unknown[]) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts } }] }), { status: 200 });
  const fakeGemini = (res: () => Response) => {
    const seen: { url: string; key?: string; body: Record<string, unknown> }[] = [];
    const impl = (async (url: string, init?: RequestInit) => {
      const h = init?.headers as Record<string, string> | undefined;
      seen.push({ url, ...(h?.["x-goog-api-key"] ? { key: h["x-goog-api-key"] } : {}), body: JSON.parse(String(init?.body)) });
      return res();
    }) as unknown as typeof fetch;
    return { impl, seen };
  };
  const g = (f: typeof fetch) => createGeminiGenerator({ baseUrl: "https://g.example/v1beta", apiKey: SECRET, fetchImpl: f });

  it("长宽比只有参数说了算（实测：只写提示词会拿到 1024×1024）", () => {
    expect(geminiAspect({ w: 16, h: 16 })).toBe("1:1");
    expect(geminiAspect({ w: 32, h: 48 })).toBe("2:3");
    expect(geminiAspect({ w: 96, h: 48 })).toBe("16:9");   // 2:1 → 16:9(1.78) 按对数比更近
    expect(geminiAspect({ w: 64, h: 16 })).toBe("16:9");   // 4:1 没有精确对应 —— 靠管线裁到物体包围盒救
    expect(geminiAspect({ w: 48, h: 48 })).toBe("1:1");
  });

  it("走对端点、带对头、把长宽比放进 generationConfig", async () => {
    const up = fakeGemini(() => okGemini([{ inlineData: { mimeType: "image/png", data: png64 } }]));
    const r = await g(up.impl)({ prompt: "a crate", size: { w: 32, h: 48 } });
    expect(r.image.width).toBe(8);
    expect(up.seen[0]!.url).toBe("https://g.example/v1beta/models/gemini-2.5-flash-image:generateContent");
    expect(up.seen[0]!.key).toBe(SECRET);
    const gc = (up.seen[0]!.body as { generationConfig: { imageConfig: { aspectRatio: string } } }).generationConfig;
    expect(gc.imageConfig.aspectRatio).toBe("2:3");
    expect(r.call.protocol).toBe("gemini");
  });

  it("⚠️ 参考图**内联**传（DashScope 那条路就断在这儿）", async () => {
    const up = fakeGemini(() => okGemini([{ inlineData: { mimeType: "image/png", data: png64 } }]));
    const ref = emptyImage(4, 4);
    await g(up.impl)({ prompt: "walk", size: { w: 16, h: 16 }, reference: ref });
    const parts = (up.seen[0]!.body as { contents: { parts: Record<string, unknown>[] }[] }).contents[0]!.parts;
    expect(parts.length).toBe(2);
    expect(parts[1]).toHaveProperty("inline_data");
    const inline = parts[1]!.inline_data as { mime_type: string; data: string };
    expect(inline.mime_type).toBe("image/png");
    expect(inline.data.length).toBeGreaterThan(0);
  });

  it("negativePrompt 拼进正文（Gemini 没有这个字段）", async () => {
    const up = fakeGemini(() => okGemini([{ inlineData: { mimeType: "image/png", data: png64 } }]));
    await g(up.impl)({ prompt: "a crate", size: { w: 16, h: 16 }, negativePrompt: "scene, border" });
    const text = ((up.seen[0]!.body as { contents: { parts: { text: string }[] }[] }).contents[0]!.parts[0]!).text;
    expect(text).toContain("a crate");
    expect(text).toContain("Avoid: scene, border");
  });

  it("形状不对就抛，且带上原文", async () => {
    for (const [name, body] of [
      ["没有 candidates", {}],
      ["parts 里没有图", { candidates: [{ content: { parts: [{ text: "I cannot." }] } }] }],
    ] as [string, unknown][]) {
      const up = fakeGemini(() => new Response(JSON.stringify(body), { status: 200 }));
      const e = await g(up.impl)({ prompt: "x", size: { w: 16, h: 16 } }).catch((x: Error) => x);
      expect(e, name).toBeInstanceOf(ImageGenerationError);
      expect((e as Error).message, name).toMatch(/回应里没有图/);
    }
  });
});

describe("OpenAI 形态客户端", () => {
  const png64 = PNG.toString("base64");
  const fakeOpenAI = (res: () => Response) => {
    // ⚠️ body 可能是 JSON（generations）也可能是 Buffer（edits 的 multipart）—— 两种都要认，
    // 不然这个假上游自己就成了「只测了一条路」的那种测试。
    const seen: { url: string; auth?: string; json: Record<string, unknown>; raw: Buffer | null; contentType?: string; contentLength?: string }[] = [];
    const impl = (async (url: string, init?: RequestInit) => {
      const h = init?.headers as Record<string, string> | undefined;
      const isBuf = init?.body instanceof Buffer;
      seen.push({
        url,
        ...(h?.authorization ? { auth: h.authorization } : {}),
        ...(h?.["content-type"] ? { contentType: h["content-type"] } : {}),
        ...(h?.["content-length"] ? { contentLength: h["content-length"] } : {}),
        raw: isBuf ? (init!.body as Buffer) : null,
        json: isBuf ? {} : JSON.parse(String(init?.body)),
      });
      return res();
    }) as unknown as typeof fetch;
    return { impl, seen };
  };
  const g = (f: typeof fetch) => createOpenAIGenerator({ baseUrl: "https://api.example/v1/", apiKey: SECRET, model: "gpt-image-2.5", fetchImpl: f });
  const ok = () => new Response(JSON.stringify({ created: 1, data: [{ b64_json: png64 }] }), { status: 200 });

  it("尺寸是**离散枚举**，挑最接近的那个（不是按比例算一个出来）", () => {
    // ⚠️ 与 DashScope 的 `宽*高` / Gemini 的 aspectRatio 都不同：这个形态只认三个固定值。
    expect(openaiSize({ w: 16, h: 16 })).toBe("1024x1024");
    expect(openaiSize({ w: 48, h: 48 })).toBe("1024x1024");
    expect(openaiSize({ w: 32, h: 48 })).toBe("1024x1536");   // 0.667 → 竖版
    expect(openaiSize({ w: 96, h: 48 })).toBe("1536x1024");   // 2:1 → 横版
    expect(openaiSize({ w: 192, h: 48 })).toBe("1536x1024");  // 4:1 没有精确对应 —— 靠管线裁到物体包围盒救
  });

  it("走对端点（baseUrl 末尾的斜杠要吃掉）、带 Bearer、尺寸进 body", async () => {
    const up = fakeOpenAI(ok);
    const r = await g(up.impl)({ prompt: "a crate", size: { w: 32, h: 48 } });
    expect(r.image.width).toBe(8);
    expect(up.seen[0]!.url).toBe("https://api.example/v1/images/generations");
    expect(up.seen[0]!.auth).toBe(`Bearer ${SECRET}`);
    expect(up.seen[0]!.json).toMatchObject({ model: "gpt-image-2.5", n: 1, size: "1024x1536" });
    expect(r.call).toMatchObject({ protocol: "openai", requestedSize: "1024x1536", attempts: 1 });
    // ⚠️ key 绝不进记账
    expect(JSON.stringify(r.call)).not.toContain(SECRET);
  });

  it("negativePrompt 拼进正文（这个形态也没有 negative_prompt 字段）", async () => {
    const up = fakeOpenAI(ok);
    await g(up.impl)({ prompt: "a crate", size: { w: 16, h: 16 }, negativePrompt: "scene, border" });
    expect(String(up.seen[0]!.json.prompt)).toContain("Avoid: scene, border");
    // 不传就**不要**出现那一段
    const up2 = fakeOpenAI(ok);
    await g(up2.impl)({ prompt: "a crate", size: { w: 16, h: 16 } });
    expect(String(up2.seen[0]!.json.prompt)).toBe("a crate");
  });

  it("⚠️ 带参考图 → 走 **/images/edits**，multipart，且**自带 content-length**", async () => {
    // 实测：/images/generations 收不下图（未知字段被静默忽略，回一张与输入无关的图）；
    // 输入图只在 /images/edits 上有去处。
    const up = fakeOpenAI(ok);
    await g(up.impl)({ prompt: "walk", size: { w: 16, h: 16 }, reference: emptyImage(4, 4) });
    expect(up.seen[0]!.url).toBe("https://api.example/v1/images/edits");
    expect(up.seen[0]!.contentType).toMatch(/^multipart\/form-data; boundary=/);
    // ⚠️ 缺了 content-length，Node 走 chunked，中转的多部件解析器直接 400
    expect(Number(up.seen[0]!.contentLength)).toBe(up.seen[0]!.raw!.length);
    const body = up.seen[0]!.raw!.toString("latin1");
    expect(body).toContain('name="image[]"');       // 字段名带方括号，实测踩过
    expect(body).toContain("filename=\"input-0.png\"");
    expect(body).toContain("Content-Type: image/png");
  });

  it("两张输入图按「先风格图、后母版」的顺序排 —— 与提示词里的点名对得上", async () => {
    const up = fakeOpenAI(ok);
    await g(up.impl)({
      prompt: "walk", size: { w: 16, h: 16 },
      styleReference: emptyImage(4, 4), reference: emptyImage(6, 6),
    });
    const body = up.seen[0]!.raw!.toString("latin1");
    expect(body.indexOf("input-0.png")).toBeLessThan(body.indexOf("input-1.png"));
    expect((body.match(/name="image\[\]"/g) ?? []).length).toBe(2);
  });

  it("记账里写明这次走的是哪条路 —— 「带没带输入图」是两种很不一样的成功", async () => {
    const withRef = await g(fakeOpenAI(ok).impl)({ prompt: "x", size: { w: 16, h: 16 }, reference: emptyImage(4, 4) });
    const without = await g(fakeOpenAI(ok).impl)({ prompt: "x", size: { w: 16, h: 16 } });
    expect(withRef.call.requestedSize).toContain("edits");
    expect(without.call.requestedSize).not.toContain("edits");
  });

  it("没带参考图时**不要**走 edits（纯文本端点更省事，少一次多部件编码）", async () => {
    const up = fakeOpenAI(ok);
    await g(up.impl)({ prompt: "x", size: { w: 16, h: 16 } });
    expect(up.seen[0]!.url).toBe("https://api.example/v1/images/generations");
    expect(up.seen[0]!.raw).toBeNull();
  });

  it("形状不对就抛，且带上原文，绝不猜", async () => {
    for (const [name, body] of [
      ["只有 url 没有 b64_json", { created: 1, data: [{ url: "https://img.example/a.png" }] }],
      ["data 是空的", { created: 1, data: [] }],
      ["上游报错", { error: { message: "insufficient balance" } }],
    ] as [string, unknown][]) {
      const up = fakeOpenAI(() => new Response(JSON.stringify(body), { status: 200 }));
      const e = await g(up.impl)({ prompt: "x", size: { w: 16, h: 16 } }).catch((x: Error) => x);
      expect(e, name).toBeInstanceOf(ImageGenerationError);
      expect((e as Error).message, name).toMatch(/没有 b64_json|上游报错/);
    }
  });

  it("网络抖动重试、5xx 重试，4xx 不重试", async () => {
    let n = 0;
    const flaky = (async () => { if (++n === 1) throw new Error("fetch failed"); return ok(); }) as unknown as typeof fetch;
    expect((await g(flaky)({ prompt: "x", size: { w: 16, h: 16 } })).call.attempts).toBe(2);

    const up500 = fakeOpenAI(() => new Response("boom", { status: 500 }));
    await expect(g(up500.impl)({ prompt: "x", size: { w: 16, h: 16 } })).rejects.toThrow(ImageGenerationError);
    expect(up500.seen.length).toBe(3);   // attempts 默认 3

    const up400 = fakeOpenAI(() => new Response("bad", { status: 400 }));
    await expect(g(up400.impl)({ prompt: "x", size: { w: 16, h: 16 } })).rejects.toThrow(ImageGenerationError);
    expect(up400.seen.length).toBe(1);
  });
});
