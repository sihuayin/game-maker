// 生图客户端 —— **只实现实测过的那种协议**。
//
// 2026-09-25 实测的往返（DashScope 百炼的 `TextGenerateImage` MCP 端点）：
//
//   POST {baseUrl}                          Authorization: Bearer sk-…
//   {"jsonrpc":"2.0","id":N,"method":"initialize",…}   → BaiLianMcpServer 2024-11-05，**无状态**
//                                                         （不回 Mcp-Session-Id，不需要续会话）
//   {"jsonrpc":"2.0","id":N,"method":"tools/call",
//    "params":{"name":"bailian_image_gen","arguments":{"prompt":…,"size":"宽*高"}}}
//   → result.content[0].text 是个 **JSON 字符串**：{"request_id":…,"results":["<签名 OSS URL>"]}
//
// ⚠️ 三条实测事实决定了下面每一处写法：
//   ① **没有 alpha 通道**（返回的是 colorType 2 纯 RGB）—— 「透明底」这条路在这个上游不存在，
//      只能给纯色底再抠。而抠背景是**全局比色**，所以那个底色**绝不能在世界色板里**
//      （实测：同类角色的一帧有 73% 的像素就是色板最暗色，拿它当底会把角色抠穿）。
//   ② **没有 `model` 参数** —— 模型由服务端定。配置里的 `model` 在这个协议下无意义。
//   ③ 返回的是**带签名的临时 URL**（实测 `Expires` 约 7 天后）—— 必须**立刻下载**再落盘，
//      URL 本身不是产物，存下来等于埋一颗定时炸弹。
//
// 有界重试保留（票 14 §7：重试吸收抖动 ≠ 降级），但**只对网络错与 5xx 重试** ——
// 这一条每次调用都是钱，4xx 重试是白花。
import { ImageGenerationError, type ImageProtocol } from "./image-gen-error.js";
import { decodePNG, encodePNG } from "./png.js";
import type { RasterImage } from "./image.js";

export { ImageGenerationError };

/** 一次调用的记账 —— 进包的 provenance，不进任何可打印字符串里的凭据。 */
export type ImageGenCall = {
  protocol: ImageProtocol;
  /** 请求的尺寸，`宽*高` 这种字符串形式（上游要的就是这个形状）。 */
  requestedSize: string;
  /** 上游回的 request_id —— 出问题时拿它去对账。 */
  requestId?: string;
  /** 上游给图的那个临时 URL 的**主机名**（只记主机，不记带签名的完整 URL）。 */
  sourceHost?: string;
  ms: number;
  attempts: number;
};

/** 端口：**一个资源一次调用**，返回一张原图。与 `DrawListGenerator` 同款（函数类型，不是接口）。 */
export type ImageRequest = {
  prompt: string;
  size: { w: number; h: number };
  /** 反向提示词。上游提供且**必须用** —— 正向约束（"只要一个物体"）远不如明确的否定有效。 */
  negativePrompt?: string;
  /**
   * 参考图（母版 → 动画那条路）。**内联传**，不走 URL。
   * ⚠️ 只有 Gemini 支持它：DashScope 的 `image_edit` 要公网 URL，本机文件传不进去。
   */
  reference?: RasterImage;
};
export type ImageGenerator = (req: ImageRequest) => Promise<{ image: RasterImage; call: ImageGenCall }>;

export type DashScopeOptions = {
  /** 完整端点 URL（这个协议下 `baseUrl` 就是端点，不再拼路径）。 */
  baseUrl: string;
  apiKey: string;
  /** 客户端超时。实测出图 2.4~6.4s，排队时会更久。 */
  timeoutMs?: number;
  attempts?: number;
  fetchImpl?: typeof fetch;
};

/**
 * 按目标尺寸挑一个**保持长宽比**的请求尺寸。
 *
 * ⚠️ 长宽比不是可选的：`downscaleArea` 会把结果**两方向独立拉伸**到 `spec.size`，
 * 请求成 1:1 再塞进 4:1 的格子就是横向压扁 75%（实测同类问题最大 26% 就够毁了）。
 *
 * 取「长边 = 1024，短边按比例、不小于 256、四舍五入到 16 的倍数」——
 * 16 的倍数是这类上游的通行要求，1024 是实测通过的尺寸。
 */
export function requestSize(size: { w: number; h: number }): string {
  const ar = size.w / size.h;
  const long = 1024;
  const short = ar >= 1 ? long / ar : long * ar;
  const clamp = (v: number) => Math.max(256, Math.min(1024, Math.round(v / 16) * 16));
  const a = ar >= 1 ? long : clamp(short);
  const b = ar >= 1 ? clamp(short) : long;
  return `${a}*${b}`;
}

const hostOf = (u: string): string | undefined => {
  try { return new URL(u).host; } catch { return undefined; }
};

/** 一次 JSON-RPC 往返。**鉴权头只在这里出现**，绝不进返回值或错误消息。 */
async function rpc(opts: DashScopeOptions, body: unknown): Promise<unknown> {
  const doFetch = opts.fetchImpl ?? fetch;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 180_000);
  try {
    const res = await doFetch(opts.baseUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

/** 从 `tools/call` 的回应里把图 URL 抠出来。形状错就抛，绝不猜。 */
function urlFrom(result: unknown): { url: string; requestId?: string } {
  const r = result as { result?: { isError?: boolean; content?: { type?: string; text?: string }[] }; error?: unknown };
  if (r.error) throw new Error(`MCP 协议错：${JSON.stringify(r.error).slice(0, 200)}`);
  if (r.result?.isError) throw new Error(`上游报错：${(r.result.content ?? []).map((c) => c.text ?? "").join(" ").slice(0, 300)}`);
  const text = (r.result?.content ?? []).find((c) => c.type === "text")?.text;
  if (!text) throw new Error("回应里没有 text 内容块");
  let doc: { request_id?: string; results?: unknown };
  try { doc = JSON.parse(text); } catch { throw new Error(`content.text 不是 JSON：${text.slice(0, 200)}`); }
  const first = Array.isArray(doc.results) ? doc.results[0] : undefined;
  if (typeof first !== "string" || !first) throw new Error(`回应里没有图片 URL：${text.slice(0, 200)}`);
  return { url: first, ...(doc.request_id ? { requestId: doc.request_id } : {}) };
}

/**
 * 造一个生图端口。`initialize` 只做一次并缓存 —— 服务端无状态，但按协议先握一次手更稳妥。
 */
export function createDashScopeMcpGenerator(opts: DashScopeOptions): ImageGenerator {
  let initialized = false;
  let nextId = 1;
  const attempts = opts.attempts ?? 2;

  return async ({ prompt, size, negativePrompt }) => {
    const t0 = Date.now();
    const requestedSize = requestSize(size);
    let lastErr: unknown;
    for (let i = 1; i <= attempts; i++) {
      try {
        if (!initialized) {
          await rpc(opts, {
            jsonrpc: "2.0", id: nextId++, method: "initialize",
            params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "game-maker", version: "0.0.0" } },
          });
          initialized = true;
        }
        const res = await rpc(opts, {
          jsonrpc: "2.0", id: nextId++, method: "tools/call",
          params: {
            name: "bailian_image_gen",
            arguments: {
              prompt, size: requestedSize,
              // ⚠️ 这两个不是可选项：实测不加 negative_prompt 时，模型会忽略"单个物体、纯色背景"，
              // 直接画一张带边框的场景插画（风格块里的 "nested panel frames" 把它带跑了）。
              // prompt_extend 会让上游大模型改写提示词 —— 那会把我写死的那些硬约束改掉，必须关。
              ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
              prompt_extend: false,
            },
          },
        });
        const { url, requestId } = urlFrom(res);
        // ⚠️ **立刻下载**：那是带签名的临时 URL，实测约 7 天后失效。
        const doFetch = opts.fetchImpl ?? fetch;
        const img = await doFetch(url);
        if (!img.ok) throw new Error(`下载图片失败 HTTP ${img.status}`);
        const bytes = Buffer.from(await img.arrayBuffer());
        return {
          image: decodePNG(bytes),
          call: {
            protocol: "dashscope-mcp", requestedSize, ms: Date.now() - t0, attempts: i,
            ...(requestId ? { requestId } : {}), ...(hostOf(url) ? { sourceHost: hostOf(url)! } : {}),
          },
        };
      } catch (e) {
        lastErr = e;
        // 4xx / 协议错 / 形状错都是**确定性**的，重试只是白花钱
        const msg = (e as Error).message ?? "";
        const retriable = /HTTP 5\d\d|fetch failed|aborted|network|ECONN/i.test(msg);
        if (i >= attempts || !retriable) break;
      }
    }
    throw new ImageGenerationError(`生图失败（${attempts} 次内）：${(lastErr as Error)?.message ?? String(lastErr)}`);
  };
}

// ── Gemini ────────────────────────────────────────────────────────────────────
//
// 2026-09-26 实测的往返（`generativelanguage.googleapis.com/v1beta`）：
//
//   POST {baseUrl}/models/{model}:generateContent      x-goog-api-key: <key>
//   {"contents":[{"parts":[{"text":…},{"inline_data":{"mime_type":"image/png","data":<b64>}}]}],
//    "generationConfig":{"responseModalities":["IMAGE"],"imageConfig":{"aspectRatio":"16:9"}}}
//   → candidates[0].content.parts[].inlineData.{mimeType,data}
//
// ⚠️ 四条实测事实：
//   ① **长宽比只有参数说了算**：只在提示词里写 "wide" 会拿到 1024×1024；
//      给 `imageConfig.aspectRatio` 才会出 1344×768。**这是必需的** —— 不然 64×16 的
//      地面模块会拿到方图，进管线就是 4 倍拉伸。（不过真正定生死的是**物体**的包围盒，
//      管线会裁到它，所以画布长宽比对不上也能救。）
//   ② **没有 alpha**（返回 colorType 2），与 DashScope 一样。
//   ③ **可以内联参考图**，而且实测**角色真的被保持住了** —— 这是我们试过的上游里唯一做到的。
//      所以 `image_edit` 要公网 URL 那个坎在这里不存在，母版 → 动画这条路是通的。
//   ④ 背景实测是**平色场**（边框采样 99.8% 一致），抠图可靠 —— 不像 DashScope 的渐变洋红。

/**
 * 生图模型认的画布长宽比。
 *
 * ⚠️ **不含 `21:9`**：实测把它给 `gemini-2.5-flash-image` 时得不到稳定的结果
 * （一次 `finishReason: NO_IMAGE`、一次连接层直接失败），而 16:9 / 1:1 每次都正常。
 * 超宽比例多半是文本模型才支持的。少一个候选不影响正确性 ——
 * 管线会**裁到物体的包围盒**，画布长什么比例都救得回来，差的是成功率。
 */
const GEMINI_RATIOS: readonly [string, number][] = [
  ["1:1", 1], ["2:3", 2 / 3], ["3:2", 1.5], ["3:4", 0.75], ["4:3", 4 / 3],
  ["4:5", 0.8], ["5:4", 1.25], ["9:16", 9 / 16], ["16:9", 16 / 9],
];

/** 取最接近目标长宽比的那个受支持比例。对不上也没关系 —— 管线会裁到**物体**的包围盒。 */
export function geminiAspect(size: { w: number; h: number }): string {
  const want = size.w / size.h;
  let best = GEMINI_RATIOS[0]!;
  let bestErr = Infinity;
  for (const r of GEMINI_RATIOS) {
    const err = Math.abs(Math.log(r[1] / want));   // 用对数比，2:1 与 1:2 的偏差才对称
    if (err < bestErr) { bestErr = err; best = r; }
  }
  return best[0];
}

export type GeminiOptions = {
  baseUrl: string;
  apiKey: string;
  /** 实测默认 `gemini-2.5-flash-image`。 */
  model?: string;
  timeoutMs?: number;
  /**
   * 尝试次数。
   *
   * ⚠️ **默认 4，比别处的 2 高**，因为实测过（`.scratch/.../no-image-stats/`，36 次）：
   * Gemini 会以 **8%** 的概率回 `finishReason: NO_IMAGE`（直接不画），而这个概率
   * **在动画之间是均匀的**（idle/run/jump 各 92%、卡方 3.00 不显著）—— 没有规律可绕。
   * 好在被拒是**秒拒**：失败 3.3 秒、成功 14.9 秒，所以重试几乎不花钱。
   * 8% 下：2 次还剩 0.64% 的失败率，**4 次降到 0.004%** —— 一个 9 单元的包从约 6% 掉到万分之四。
   */
  attempts?: number;
  /** 走 HTTP 代理。Gemini 在境内要它（与 OpenAI 同理）。 */
  fetchImpl?: typeof fetch;
};

/** 从 `generateContent` 的回应里把第一张图抠出来。形状错就抛，绝不猜。 */
function imageFromGemini(res: unknown): RasterImage {
  const d = res as { error?: unknown; candidates?: { content?: { parts?: unknown[] } }[]; promptFeedback?: unknown };
  if (d.error) throw new Error(`Gemini 报错：${JSON.stringify(d.error).slice(0, 300)}`);
  for (const c of d.candidates ?? [])
    for (const p of (c.content?.parts ?? []) as { inlineData?: { data?: string }; text?: string }[])
      if (typeof p.inlineData?.data === "string") return decodePNG(Buffer.from(p.inlineData.data, "base64"));
  throw new Error(`回应里没有图（${JSON.stringify(d.promptFeedback ?? d.candidates ?? d).slice(0, 250)}）`);
}

export function createGeminiGenerator(opts: GeminiOptions): ImageGenerator {
  const attempts = opts.attempts ?? 4;   // 见 GeminiOptions.attempts 的注释：实测 8% 的秒拒率
  const model = opts.model ?? "gemini-2.5-flash-image";

  return async ({ prompt, size, negativePrompt, reference }) => {
    const t0 = Date.now();
    const doFetch = opts.fetchImpl ?? fetch;
    const url = `${opts.baseUrl.replace(/\/+$/, "")}/models/${model}:generateContent`;
    const parts: unknown[] = [{ text: negativePrompt ? `${prompt}\n\nAvoid: ${negativePrompt}` : prompt }];
    // ⚠️ 参考图**内联**，不走 URL（那正是 DashScope 那条路断掉的地方）。
    if (reference) parts.push({ inline_data: { mime_type: "image/png", data: encodePNG(reference).toString("base64") } });
    const body = {
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: geminiAspect(size) } },
    };

    let lastErr: unknown;
    for (let i = 1; i <= attempts; i++) {
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 240_000);
        let res: Response;
        try {
          res = await doFetch(url, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": opts.apiKey },
            body: JSON.stringify(body),
            signal: ac.signal,
          });
        } finally { clearTimeout(timer); }
        if (!res.ok) throw new Error(`上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`);
        const image = imageFromGemini(await res.json());
        return {
          image,
          call: {
            protocol: "gemini", requestedSize: `aspect ${geminiAspect(size)}`, ms: Date.now() - t0, attempts: i,
          },
        };
      } catch (e) {
        lastErr = e;
        const msg = (e as Error).message ?? "";
        // ⚠️ `NO_IMAGE` 也要重试：实测 Gemini 会**偶尔**拒一次（同一个提示词前后两次一成一败），
        // 那是抽样抖动而不是确定性拒绝 —— 不重试的话一次抖动就毁掉整包。
        if (i >= attempts || !/HTTP 5\d\d|fetch failed|aborted|network|ECONN|429|NO_IMAGE/i.test(msg)) break;
      }
    }
    throw new ImageGenerationError(`Gemini 生图失败（${attempts} 次内）：${(lastErr as Error)?.message ?? String(lastErr)}`);
  };
}
