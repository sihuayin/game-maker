// 生图客户端 —— **只实现实测过的那种协议**。
//
// 2026-09-25 实测的往返（DashScope 百炼的 `TextImageGenerator` MCP 端点）：
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
import type { LedgerCall, LedgerUsage } from "@game-maker/contracts";
import { ImageGenerationError, type ImageProtocol } from "./image-gen-error.js";
import { PNG_SIGNATURE, decodePNG, encodePNG } from "./png.js";
import { decodeJPEG, isJPEG } from "./jpeg.js";
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
  /**
   * 我们**请求**的模型名（上游那几家都不在回应里报模型，所以这里只可能是请求的那个）。
   * ⚠️ **拿不到就缺席，不许编一个** —— `dashscope-mcp` 协议**根本没有 `model` 参数**
   *   （票 34：模型由服务端定），这时记一个我们猜测的名字就是把不知道的事说成知道的。
   */
  requestedModel?: string;
  /** 上游自报的用量。⚠️ 没给就缺席 —— **不填 0 冒充「测到了 0」**（票 19 Q4）。 */
  usage?: LedgerUsage;
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
  /**
   * 世界的**风格参考图**（整张场景图）。与 `reference` 是两个东西：
   * `reference` 是「照这个角色画」，`styleReference` 是「照这个世界的**色彩与质感**画，
   * 但**不要画它里面的任何东西**」。
   *
   * ⚠️ 顺序有语义：两个都给时，**先风格图、后母版**，提示词里按这个顺序点名。
   */
  styleReference?: RasterImage;
};
/**
 * 一次调用**失败**时的交账（2026-09-30 · 票 06）。
 *
 * ⚠️ **上游没应答** ⇒ 这里只有「**烧了几趟、等了多久**」两件事实。`model` / `usage` / `requestId`
 *   一律**缺席** —— 拿不到就缺席、不编（那条「记一个我们没听到的模型名」的谎，`generate.ts` 那边记过一次）。
 *
 * ⚠️ **为什么要有这个口子**：生成器**自己**会重试（下面那 `attempts` 趟），而成功那条路
 *   只把 `attempts` 放进返回值 ⇒ **失败时烧掉的往返没人记**，账上只剩一个「发出时的 1」。
 *   而仓库的纪律是「重试烧掉的额度要能单独看见，**否则失败的归因是错的**」。
 *   ⚠️ 文本那条一直报（`generate.ts` 在抛出前补记一笔）—— 这个口子让两条路一致。
 */
export type ImageCallFailure = Pick<LedgerCall, "ms" | "attempts" | "upstream" | "requestedModel">;
/** 调用的**收尾**口子。成功那条把事实放在返回值里，所以这里只有失败的。 */
export type ImageCallReporter = { onFailure?: (f: ImageCallFailure) => void };

export type ImageGenerator = (req: ImageRequest, report?: ImageCallReporter) => Promise<{ image: RasterImage; call: ImageGenCall }>;

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

  return async ({ prompt, size, negativePrompt }, { onFailure } = {}) => {
    const t0 = Date.now();
    const requestedSize = requestSize(size);
    let lastErr: unknown;
    let trips = 0;                       // ⚠️ **发起过几轮**（一轮里有几趟 HTTP，看协议）—— 与文本那条同名同义（票 06）
    for (let i = 1; i <= attempts; i++) {
      trips += 1;
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
    // ⚠️ `upstream` 与 `requestedModel` 也报 —— 它们是**知道的事**（与成功那条账一字不差）。
    //   ⚠️ 而 `model`（上游自报的那个）**不报** —— 它根本没应答，记了就是**谎**。
    //   ⚠️ dashscope 这条**没有** `requestedModel`：那个协议根本没有 `model` 参数（票 34）。
    onFailure?.({ upstream: "dashscope-mcp", ms: Date.now() - t0, attempts: trips });
    throw new ImageGenerationError(`生图失败（${attempts} 次内）：${(lastErr as Error)?.message ?? String(lastErr)}`);
  };
}

// ── Gemini（Interactions API）─────────────────────────────────────────────────
//
// 2026-10-19（票 13 / 票 12 的 A2）：改用 **Interactions API**。
// 2026-10-20（票 05 / 07）：输出格式定为 **JPEG** —— Interactions 的 MIME 枚举只有 JPEG
//   （v1 / v1alpha / v1beta discovery rev 20261019），两次真实 400 只允许 image/jpeg。
//   参考图仍以 PNG 内联；**输出**请求 JPEG，并由 `decodeUpstreamImage` 分派到 JPEG 解码器。
//   legacy `generateContent` 路径继续只认 PNG。
//
//   POST {baseUrl}/interactions                         x-goog-api-key: <key>
//   {"model":…,
//    "input":[{"type":"text","text":…},
//             {"type":"image","mime_type":"image/png","data":<b64>}],
//    "response_format":{"type":"image","mime_type":"image/jpeg",
//                       "aspect_ratio":"16:9","image_size":"1K"}}
//   → steps[].type === "model_output" → content[].type === "image" → data (base64)
//
// ⚠️ 为什么不用 legacy `generateContent`（票 10 的真跑证据）：
//   `gemini-3.1-flash-lite-image` 在 `generateContent` 下回的是**非 PNG** 的 inline data，
//   而 legacy `ImageConfig`（v1beta discovery）**没有输出 MIME 入口** ⇒ 无法要求 PNG。
//   Interactions API 的 `response_format.mime_type` 才有这个入口。
//
// ⚠️ 下面四条是 2.5 时代在 `generateContent` 上实测的，Interactions 路径**尚未付费验证**：
//   ① **长宽比只有参数说了算**：只在提示词里写 "wide" 会拿到 1024×1024；
//      给 `aspect_ratio` 才会出目标比例。**这是必需的** —— 不然 64×16 的
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
  /**
   * 走哪套 API。
   * - `"auto"`（默认）：`gemini-2.5-*` 走 legacy `generateContent`（已知回 PNG）；
   *   其余（3.x / nano-banana）走 Interactions。
   * - `"generateContent"`：强制 legacy（2.5 的 PNG 路径）。
   * - `"interactions"`：强制新 API（3.x；⚠️ 实测只回 JPEG）。
   */
  api?: "auto" | "generateContent" | "interactions";
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

/** Interactions 回应里的图片块。⚠️ 同时兼容 REST 的 snake_case 与 SDK 的 camelCase。 */
type GeminiImageBlock = {
  type?: string;
  data?: string;
  mime_type?: string;
  mimeType?: string;
  inline_data?: { data?: string; mime_type?: string };
  inlineData?: { data?: string; mimeType?: string };
};

type GeminiImageFormat = "image/png" | "image/jpeg";

/** 按字节签名嗅探；只认本仓库真正支持的两种格式。 */
function sniffImageFormat(bytes: Buffer): GeminiImageFormat | undefined {
  if (bytes.length >= PNG_SIGNATURE.length && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return "image/png";
  if (isJPEG(bytes)) return "image/jpeg";
  return undefined;
}

/**
 * 上游 base64 → RasterImage。
 *
 * ⚠️ **声明了 mime 就以声明为准**：声明 JPEG 却给 PNG 字节，会在解码器那里响，
 *   而不是靠签名「猜对了」继续跑。只有完全没声明时才嗅探。
 * ⚠️ `allowed` 是每条路径自己的白名单：legacy 只认 PNG；Interactions 认 JPEG + PNG
 *   （PNG 仅作旧桩 / 旧上游的兼容路径）。
 */
function decodeUpstreamImage(data: string, mime: string | undefined, allowed: readonly GeminiImageFormat[]): RasterImage {
  const bytes = Buffer.from(data, "base64");
  const declared = mime ?? sniffImageFormat(bytes);
  const allowedText = allowed.join(" / ");
  if (declared === undefined)
    throw new Error(`上游没给 mime_type，且字节不是 JPEG / PNG —— 本路径只接受 ${allowedText}，不静默解码别的格式`);
  if (declared !== "image/png" && declared !== "image/jpeg")
    throw new Error(`上游回了 ${declared}，而本路径只接受 ${allowedText} —— 不静默解码别的格式`);
  if (!allowed.includes(declared))
    throw new Error(`上游回了 ${declared}，而本路径只接受 ${allowedText} —— 不静默解码别的格式`);
  return declared === "image/png" ? decodePNG(bytes) : decodeJPEG(bytes);
}

/** 从 legacy `generateContent` 的回应里把第一张图抠出来。形状错就抛，绝不猜。 */
function imageFromGenerateContent(res: unknown): RasterImage {
  const d = res as {
    error?: unknown;
    candidates?: { content?: { parts?: unknown[] } }[];
    promptFeedback?: unknown;
  };
  if (d.error) throw new Error(`Gemini 报错：${JSON.stringify(d.error).slice(0, 300)}`);
  for (const c of d.candidates ?? [])
    for (const p of (c.content?.parts ?? []) as { inlineData?: { data?: string; mimeType?: string } }[]) {
      if (typeof p.inlineData?.data !== "string") continue;
      // legacy 2.5 实测回 PNG；本路径只认 PNG —— JPEG / WebP 都明确失败，不静默解码。
      return decodeUpstreamImage(p.inlineData.data, p.inlineData.mimeType, ["image/png"]);
    }
  throw new Error(`回应里没有图（${JSON.stringify(d.promptFeedback ?? d.candidates ?? d).slice(0, 250)}）`);
}

/** 从 Interactions 回应里把第一张图抠出来。形状错就抛，绝不猜。 */
function imageFromInteraction(res: unknown): RasterImage {
  const d = res as {
    error?: unknown;
    output_image?: GeminiImageBlock;
    outputImage?: GeminiImageBlock;
    steps?: { type?: string; content?: GeminiImageBlock[]; parts?: GeminiImageBlock[] }[];
  };
  if (d.error) throw new Error(`Gemini 报错：${JSON.stringify(d.error).slice(0, 300)}`);

  const blocks: GeminiImageBlock[] = [];
  for (const img of [d.output_image, d.outputImage]) if (img) blocks.push(img);
  for (const step of d.steps ?? []) {
    if (step.type !== "model_output") continue;
    blocks.push(...(step.content ?? []), ...(step.parts ?? []));
  }

  for (const block of blocks) {
    const inline = (block.inline_data ?? block.inlineData) as { data?: string; mime_type?: string; mimeType?: string } | undefined;
    const data = block.data ?? inline?.data;
    if (typeof data !== "string" || data.length === 0) continue;
    const mime = block.mime_type ?? block.mimeType ?? inline?.mime_type ?? inline?.mimeType;
    // Interactions 请求 image/jpeg；PNG 保留兼容（旧桩 / 旧上游）。
    return decodeUpstreamImage(data, mime, ["image/jpeg", "image/png"]);
  }

  const shape = (d.steps ?? []).map((s) =>
    `${s.type ?? "?"}[${[...(s.content ?? []), ...(s.parts ?? [])].map((c) => c.type ?? "?").join(",")}]`).join(" ");
  throw new Error(`回应里没有图（steps: ${shape || "无"}）`);
}

export function createGeminiGenerator(opts: GeminiOptions): ImageGenerator {
  const attempts = opts.attempts ?? 4;   // 见 GeminiOptions.attempts 的注释：实测 8% 的秒拒率
  const model = opts.model ?? "gemini-2.5-flash-image";

  const api = opts.api ?? "auto";
  const useLegacy = api === "generateContent" || (api === "auto" && /^gemini-2\.5(?:-|$)/.test(model));

  return async ({ prompt, size, negativePrompt, reference, styleReference }, { onFailure } = {}) => {
    const t0 = Date.now();
    const doFetch = opts.fetchImpl ?? fetch;
    const aspect = geminiAspect(size);
    const url = useLegacy
      ? `${opts.baseUrl.replace(/\/+$/, "")}/models/${model}:generateContent`
      : `${opts.baseUrl.replace(/\/+$/, "")}/interactions`;
    // ⚠️ 图与提示词的**顺序必须对上**：正文里按「先风格图、后母版」点名，这里就按这个顺序塞。
    const notes: string[] = [];
    if (styleReference) notes.push("附件第 1 张是这个游戏世界的**风格参考图** —— **只借它的色彩、材质与渲染质感**，" +
      "绝对不要画它里面的任何东西（不要画房间、柜台、货架、海报、文字）。它只是调色与质感的依据。");
    if (reference) notes.push(`附件第 ${styleReference ? 2 : 1} 张是要照画的**角色本身** —— 保持它的形象与配色。`);
    const head = [prompt, ...notes].join("\n\n");
    const text = negativePrompt ? `${head}\n\nAvoid: ${negativePrompt}` : head;
    // 两条路的参考图都**内联**，不走 URL（那正是 DashScope 那条路断掉的地方）。
    const images = [styleReference, reference].filter((x): x is NonNullable<typeof x> => x !== undefined);
    const body = useLegacy
      ? {
          contents: [{
            parts: [
              { text },
              ...images.map((img) => ({ inline_data: { mime_type: "image/png", data: encodePNG(img).toString("base64") } })),
            ],
          }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
        }
      : {
          model,
          input: [
            { type: "text", text },
            ...images.map((img) => ({ type: "image", mime_type: "image/png", data: encodePNG(img).toString("base64") })),
          ],
          // ⚠️ `image_size:"1K"`：3.1 Flash Lite 只支持 1K；其余新模型默认也是 1K。
          response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: aspect, image_size: "1K" },
        };

    let lastErr: unknown;
    let trips = 0;                       // ⚠️ **发起过几轮**（一轮里有几趟 HTTP，看协议）—— 与文本那条同名同义（票 06）
    for (let i = 1; i <= attempts; i++) {
      trips += 1;
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
        const json = await res.json();
        const image = useLegacy ? imageFromGenerateContent(json) : imageFromInteraction(json);
        return {
          image,
          call: {
            protocol: "gemini", requestedSize: `aspect ${aspect}`, ms: Date.now() - t0, attempts: i,
            requestedModel: model,
          },
        };
      } catch (e) {
        lastErr = e;
        const msg = (e as Error).message ?? "";
        // ⚠️ 「没有图」也要重试：实测 Gemini 会**偶尔**拒一次（同一个提示词前后两次一成一败），
        // 那是抽样抖动而不是确定性拒绝 —— 不重试的话一次抖动就毁掉整包。
        if (i >= attempts || !/HTTP 5\d\d|fetch failed|aborted|network|ECONN|429|NO_IMAGE|no image|没有图/i.test(msg)) break;
      }
    }
    onFailure?.({ upstream: "gemini", ms: Date.now() - t0, attempts: trips, requestedModel: model });
    throw new ImageGenerationError(`Gemini 生图失败（${attempts} 次内）：${(lastErr as Error)?.message ?? String(lastErr)}`);
  };
}

// ── OpenAI 形态 ───────────────────────────────────────────────────────────────
//
// 2026-09-26 实测的往返（**中转** `api.krill-code.net/v1`，模型 `gpt-image-2.5`）：
//
//   POST {baseUrl}/images/generations          Authorization: Bearer <key>
//   {"model":"gpt-image-2.5","prompt":…,"n":1,"size":"1024x1024"}
//   → {"created":…, "output_format":"png", "size":"1024x1024", "data":[{"b64_json":"…"}]}
//
//   POST {baseUrl}/images/edits                 multipart，**要输入图时走这条**
//   fields: model / prompt / n / size + `image[]`（可多张，字段名带方括号）
//   → 形状与上面完全一样，也是 `data[0].b64_json`
//
// ⚠️ 六条实测事实（`.scratch/.../openai-trial/`）：
//   ① **`background:"transparent"` 被原样回显、但不兑现** —— 返回的 PNG 是 `colorType 2`（无 alpha）。
//      这一条与 DashScope / Gemini 同病。**但这个上游的背景是纯白平场**
//      （四角 `#fefefe/#fffeff/#fffeff/#ffffff`，离中位色 `p50=0 p95=3`），
//      比 DashScope 那张渐变洋红好抠得多 —— 容差 20 就能把底抹干净。
//   ② **慢**：实测 28~48 秒一张（Gemini 是 11~18 秒）。超时必须给够，不然全在排队上失败。
//   ③ **不认连接不通的兜底 200**：乱写路径是 520 —— 跟真路由分得开，所以形状错会**响**。
//   ④ **尺寸是离散枚举**：`1024x1024` / `1536x1024` / `1024x1536` 三个**都实测通了**
//      （回显与实际尺寸一致），没有 `auto` 之外的余地 —— 挑最近的，剩下的交给管线裁框。
//   ⑤ **输入图只在 `/images/edits` 上有去处**。把图塞进 `generations` 的 body **不会报错** ——
//      未知字段被静默忽略，回一张和输入毫无关系的图。那是最坏的一种失败：
//      HTTP 200、有图、东西是错的。所以两条路由是**分开**的，不是「同一条多个字段」。
//   ⑥ `/images/edits` 的 multipart **必须自带 content-length**（见 `multipartBody` 的注释）：
//      缺了它 Node 走 chunked，中转的多部件解析器会回 `incomplete multipart stream`（400）——
//      **那是形态错、不是端点不存在**，别被这个 400 骗过去。

/**
 * 这个形态认的画布尺寸。
 *
 * ⚠️ 与 Gemini 的 `aspectRatio` 不同，这里是**离散枚举**，只能挑最近的 ——
 * 挑错的代价由管线的**裁到物体包围盒**兜住（真正定生死的是物体的包围盒，不是画布）。
 */
const OPENAI_SIZES: readonly { size: string; ar: number }[] = [
  { size: "1024x1024", ar: 1 },
  { size: "1536x1024", ar: 1.5 },
  { size: "1024x1536", ar: 1 / 1.5 },
];

/** 取最接近目标长宽比的那个尺寸。对数比，2:1 与 1:2 的偏差才对称。 */
export function openaiSize(size: { w: number; h: number }): string {
  const want = size.w / size.h;
  let best = OPENAI_SIZES[0]!;
  let bestErr = Infinity;
  for (const s of OPENAI_SIZES) {
    const err = Math.abs(Math.log(s.ar / want));
    if (err < bestErr) { bestErr = err; best = s; }
  }
  return best.size;
}

export type OpenAIOptions = {
  baseUrl: string;
  apiKey: string;
  /** 实测这条中转上是 `gpt-image-2.5`。不给则交给上游的默认模型。 */
  model?: string;
  /** ⚠️ 默认比别处宽：实测一张 28~48 秒。 */
  timeoutMs?: number;
  attempts?: number;
  /** 走 HTTP 代理。**openai 协议下这在境内几乎是必需的**（见 http.ts）。 */
  fetchImpl?: typeof fetch;
};

/** 从 `images/generations` / `images/edits` 的回应里把第一张图抠出来（两者形状相同）。形状错就抛，绝不猜。 */
function imageFromOpenAI(res: unknown): RasterImage {
  const d = res as { error?: unknown; data?: { b64_json?: string; url?: string }[] };
  if (d.error) throw new Error(`上游报错：${JSON.stringify(d.error).slice(0, 300)}`);
  const first = d.data?.[0];
  // ⚠️ 只认 b64 —— 实测这条中转回的就是 b64。若哪天回了 url，**不猜**：
  // 那是另一种形态（要另一次下载、要处理临时链接），静默当成失败比猜错好。
  if (typeof first?.b64_json !== "string" || !first.b64_json)
    throw new Error(`回应里没有 b64_json：${JSON.stringify(d).slice(0, 250)}`);
  return decodePNG(Buffer.from(first.b64_json, "base64"));
}

/**
 * 手搓一个 multipart 正文。
 *
 * ⚠️ **两条都是实测踩出来的**：
 *   ① 字段名是 **`image[]`**（带方括号），不是 `image` —— 这是 OpenAI edits 收多图的那个名字。
 *   ② **必须自己带 `content-length`**。`createProxyFetch` 给的是 Buffer，Node 在缺 content-length 时
 *      会走 chunked，而这条中转的多部件解析器**不吃 chunked** —— 实测报
 *      `invalid multipart form: incomplete multipart stream`（HTTP 400），
 *      补上 content-length 就 200 了。**那是形态错，不是端点不存在**，别被 400 骗过去。
 */
function multipartBody(fields: Record<string, string>, files: RasterImage[]): { body: Buffer; contentType: string } {
  const B = "----game-maker-" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields))
    parts.push(Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  files.forEach((img, i) => {
    parts.push(Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="image[]"; filename="input-${i}.png"\r\nContent-Type: image/png\r\n\r\n`));
    parts.push(encodePNG(img));
    parts.push(Buffer.from("\r\n"));
  });
  parts.push(Buffer.from(`--${B}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${B}` };
}

export function createOpenAIGenerator(opts: OpenAIOptions): ImageGenerator {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseUrl.replace(/\/+$/, "");

  return async ({ prompt, size, negativePrompt, reference, styleReference }, { onFailure } = {}) => {
    const t0 = Date.now();
    const doFetch = opts.fetchImpl ?? fetch;
    const requestedSize = openaiSize(size);
    // 这个形态没有 `negative_prompt` 字段，只能把否定写进正文 —— 与 Gemini 同款处理。
    const text = negativePrompt ? `${prompt}\n\nAvoid: ${negativePrompt}` : prompt;
    // ⚠️ 有输入图就走 **`/images/edits`**：`/images/generations` 是纯文本端点，收不下图
    // （实测把图塞进 generations 的 body 只会被当成未知字段**静默忽略**，回一张和输入毫无关系的图 ——
    //  那正是最坏的一种失败：HTTP 200、有图、东西是错的）。
    const inputs = [styleReference, reference].filter((x): x is RasterImage => !!x);
    // ⚠️ 顺序有语义：**先风格图、后母版**，与 `ImageRequest` 的注释、与 Gemini 客户端一致。
    const endpoint = inputs.length > 0 ? `${base}/images/edits` : `${base}/images/generations`;
    const payload: { body: Buffer | string; headers: Record<string, string> } = inputs.length > 0
      ? (() => {
          const m = multipartBody({ ...(opts.model ? { model: opts.model } : {}), prompt: text, n: "1", size: requestedSize }, inputs);
          return { body: m.body, headers: { "content-type": m.contentType, "content-length": String(m.body.length) } };
        })()
      : {
          body: JSON.stringify({ ...(opts.model ? { model: opts.model } : {}), prompt: text, n: 1, size: requestedSize }),
          headers: { "content-type": "application/json" },
        };

    let lastErr: unknown;
    let trips = 0;                       // ⚠️ **发起过几轮**（一轮里有几趟 HTTP，看协议）—— 与文本那条同名同义（票 06）
    for (let i = 1; i <= attempts; i++) {
      trips += 1;
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 300_000);
        let res: Response;
        try {
          res = await doFetch(endpoint, {
            method: "POST",
            headers: { ...payload.headers, authorization: `Bearer ${opts.apiKey}` },
            body: payload.body,
            signal: ac.signal,
          });
        } finally { clearTimeout(timer); }
        if (!res.ok) throw new Error(`上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`);
        const body = (await res.json()) as { usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } };
        const image = imageFromOpenAI(body);
        return {
          image,
          call: {
            protocol: "openai", ms: Date.now() - t0, attempts: i,
            requestedSize: inputs.length > 0 ? `${requestedSize} · edits ${inputs.length} 图` : requestedSize,
            // `gpt-image` 系会把用量带回来 —— 那是**上游给的事实**，不是我们的折算，该记（票 19 Q7 的例外）
            ...(opts.model ? { requestedModel: opts.model } : {}),
            ...(body.usage
              ? { usage: {
                  ...(body.usage.input_tokens !== undefined ? { inputTokens: body.usage.input_tokens } : {}),
                  ...(body.usage.output_tokens !== undefined ? { outputTokens: body.usage.output_tokens } : {}),
                  ...(body.usage.total_tokens !== undefined ? { totalTokens: body.usage.total_tokens } : {}),
                } }
              : {}),
          },
        };
      } catch (e) {
        lastErr = e;
        const msg = (e as Error).message ?? "";
        if (i >= attempts || !/HTTP 5\d\d|fetch failed|aborted|network|ECONN|429/i.test(msg)) break;
      }
    }
    onFailure?.({ upstream: "openai", ms: Date.now() - t0, attempts: trips,
      ...(opts.model ? { requestedModel: opts.model } : {}) });
    throw new ImageGenerationError(`OpenAI 形态生图失败（${attempts} 次内）：${(lastErr as Error)?.message ?? String(lastErr)}`);
  };
}
