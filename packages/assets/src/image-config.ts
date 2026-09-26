// 生图上游的凭据：**baseUrl 与 key 可配，且永不入库**。
//
// 两条来源，**环境变量优先**：
//   ① 环境变量   GAME_MAKER_IMAGE_BASE_URL / _API_KEY / _MODEL
//   ② 本地文件   `<cwd>/game-maker.local.json`（**已 gitignore**，见仓库根的 .gitignore）
//
// 为什么要有文件这一条：环境变量要写进 shell profile 才持久，而这类 key 通常只属于
// 某一个项目。文件能跟着项目走、又**不入库**（.gitignore 里一条），是更合适的落点。
//
// ⚠️ **core 不读 `process.env`** —— 它被**交给**一份 env 与一个 cwd（R5 / 票 30：
//    环境由壳读、core 只收结构体）。所以下面两个函数都是纯的，可离线测。
// ⚠️ **key 绝不进任何可打印的东西**：返回值里没有它之外的字段能泄露它，
//    `describeImageTransport()` 只回显 baseUrl 与「key 配没配、多少字符」。
import fs from "node:fs";
import path from "node:path";
import type { ImageProtocol } from "./image-gen-error.js";

export const IMAGE_CONFIG_FILE = "game-maker.local.json";

export const IMAGE_ENV = {
  protocol: "GAME_MAKER_IMAGE_PROTOCOL",
  baseUrl: "GAME_MAKER_IMAGE_BASE_URL",
  apiKey: "GAME_MAKER_IMAGE_API_KEY",
  model: "GAME_MAKER_IMAGE_MODEL",
} as const;

/**
 * 上游说的是哪种话。**不是可有可无的分类** —— 2026-09-25 实测：krill 那样"长得像 OpenAI
 * 但什么都不实现"的中转真实存在，而 DashScope 的 `TextGenerateImage` 是个 **MCP 端点**
 * （要 `initialize` → `tools/list` → `tools/call`），与 REST 完全两回事。
 * 所以它必须显式声明，不能靠 `baseUrl` 猜。 */
export const IMAGE_PROTOCOLS = ["openai", "minimax", "dashscope-mcp", "gemini"] as const;
export const DEFAULT_IMAGE_PROTOCOL: ImageProtocol = "openai";

export type ImageTransport = {
  protocol: ImageProtocol;
  baseUrl: string;
  apiKey: string;
  /**
   * HTTP 代理，如 `http://127.0.0.1:9098`。
   *
   * ⚠️ **不是可有可无的选项**：`api.openai.com` 在境内直连不通（实测 DNS 被污染成
   * Facebook 的 IP 段、TCP 443 超时），而 **Node 原生 `fetch` 不认 `HTTPS_PROXY`**
   * （实测设了也没用）。所以要么在这里写明，要么这个上游根本没戏。
   */
  proxy?: string;
  /** 生图模型名。不给则由客户端按上游填默认值（`dashscope-mcp` 下由 `tools/list` 问出来）。 */
  model?: string;
};

export type ImageConfigResult = {
  /** 没配就是 undefined —— **不是错误**：一份没有生图资源的清单不该需要它。 */
  transport?: ImageTransport;
  source: "env" | "file" | null;
  /** 实际去看过的文件路径（供报错时说清楚「我找的是哪」）。 */
  filePath: string;
  /** 配了但不对劲的地方。空数组 = 没问题。 */
  warnings: string[];
};

const isHttp = (u: string) => /^https?:\/\//.test(u);

/** 把 `{ image: {...} }` 读出来。文件不存在/不是 JSON/字段缺失都只记 warning，不抛。 */
function readFile(filePath: string, warnings: string[]): ImageTransport | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  let doc: unknown;
  try {
    doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    warnings.push(`${IMAGE_CONFIG_FILE} 不是合法 JSON（${(e as Error).message}）—— 已忽略`);
    return undefined;
  }
  const img = (doc as { image?: Record<string, unknown> } | null)?.image;
  if (!img || typeof img !== "object") {
    warnings.push(`${IMAGE_CONFIG_FILE} 里没有 "image" 对象 —— 已忽略`);
    return undefined;
  }
  const { protocol, baseUrl, apiKey, model, proxy } = img as { protocol?: unknown; baseUrl?: unknown; apiKey?: unknown; model?: unknown; proxy?: unknown };
  if (typeof baseUrl !== "string" || typeof apiKey !== "string" || !baseUrl || !apiKey) {
    warnings.push(`${IMAGE_CONFIG_FILE} 的 image 段需要 baseUrl 与 apiKey 两个非空字符串 —— 已忽略`);
    return undefined;
  }
  if (!isHttp(baseUrl)) {
    warnings.push(`${IMAGE_CONFIG_FILE} 的 baseUrl 必须是 http(s) 地址 —— 已忽略`);
    return undefined;
  }
  if (protocol !== undefined && !IMAGE_PROTOCOLS.includes(protocol as ImageProtocol)) {
    warnings.push(`${IMAGE_CONFIG_FILE} 的 protocol 只认 ${IMAGE_PROTOCOLS.join(" / ")}（收到 ${JSON.stringify(protocol)}）—— 已忽略`);
    return undefined;
  }
  if (proxy !== undefined && (typeof proxy !== "string" || !proxy.trim())) {
    warnings.push(`${IMAGE_CONFIG_FILE} 的 proxy 要是非空字符串 —— 已忽略`);
  }
  return {
    protocol: (protocol as ImageProtocol | undefined) ?? DEFAULT_IMAGE_PROTOCOL,
    baseUrl, apiKey,
    ...(typeof model === "string" && model ? { model } : {}),
    ...(typeof proxy === "string" && proxy.trim() ? { proxy: proxy.trim() } : {}),
  };
}

/** 解析生图上游。**没有就是没有** —— 调用方自己决定「没有该不该失败」。 */
export function resolveImageTransport(opts: {
  env: Record<string, string | undefined>;
  cwd: string;
  fileName?: string;
}): ImageConfigResult {
  const filePath = path.join(opts.cwd, opts.fileName ?? IMAGE_CONFIG_FILE);
  const warnings: string[] = [];

  const env = opts.env;
  const eb = env[IMAGE_ENV.baseUrl]?.trim();
  const ek = env[IMAGE_ENV.apiKey]?.trim();
  const em = env[IMAGE_ENV.model]?.trim();
  const ep = env[IMAGE_ENV.protocol]?.trim() as ImageProtocol | undefined;
  if (ep && !IMAGE_PROTOCOLS.includes(ep)) warnings.push(`${IMAGE_ENV.protocol} 只认 ${IMAGE_PROTOCOLS.join(" / ")} —— 已忽略`);
  const protocol = ep && IMAGE_PROTOCOLS.includes(ep) ? ep : undefined;
  // 两个都给了才算「用环境变量配好了」。只给一半 → 明确说出来，别静默回落到文件
  // （那种回落会让人以为环境变量生效了，而实际用的是另一把 key）。
  if (eb && ek) {
    if (!isHttp(eb)) warnings.push(`${IMAGE_ENV.baseUrl} 必须是 http(s) 地址`);
    const fromFile = readFile(filePath, warnings);
    if (fromFile) warnings.push(`环境变量与 ${IMAGE_CONFIG_FILE} 同时存在 —— **以环境变量为准**`);
    return {
      transport: { protocol: protocol ?? DEFAULT_IMAGE_PROTOCOL, baseUrl: eb, apiKey: ek, ...(em ? { model: em } : {}) },
      source: "env", filePath, warnings,
    };
  }
  if (eb || ek) {
    const missing = eb ? IMAGE_ENV.apiKey : IMAGE_ENV.baseUrl;
    warnings.push(`只设了 ${eb ? IMAGE_ENV.baseUrl : IMAGE_ENV.apiKey} 而没设 ${missing} —— 环境变量这条路不完整，改从文件找`);
  }

  const t = readFile(filePath, warnings);
  return t ? { transport: t, source: "file", filePath, warnings } : { source: null, filePath, warnings };
}

/**
 * 给人看的一句话。**只**说 baseUrl 与 key 配没配、多少字符 —— 不回显 key 本身。
 * 任何要打印「用的是哪个上游」的地方都必须走这里，而不是自己拼字符串。
 */
export function describeImageTransport(t?: ImageTransport): string {
  if (!t) return "生图上游：**未配置**";
  const model = t.model ? ` · 模型 ${t.model}` : "";
  const via = t.proxy ? ` · 经代理 ${t.proxy}` : "";
  return `生图上游：${t.protocol} · ${t.baseUrl}${model}（key 已配置，${t.apiKey.length} 字符）${via}`;
}

/**
 * 拿一份配置去**建**上游 —— 把 key 收在一个闭包里，绝不当字段挂出去。
 * `baseUrl` 去掉末尾斜杠，免得拼出 `//v1`。
 */
export function imageEndpointOf(t: ImageTransport, p: string): { url: string; headers: Record<string, string> } {
  return {
    url: `${t.baseUrl.replace(/\/+$/, "")}${p}`,
    headers: { "content-type": "application/json", authorization: `Bearer ${t.apiKey}` },
  };
}
