// 文本上游的凭据：**baseUrl 与 key 可配，且永不入库**。镜像 `image-config.ts`，但读 `text` 段。
//
// 来源两条（**环境变量优先**，与 `image-config` 同一条纪律）：
//   ① 环境变量   ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN（旧路径，anthropic / cc-switch）。
//   ② 本地文件   `<cwd>/game-maker.local.json` 的 `text` 段（gemini 等；只有**没设** ANTHROPIC_* 时才会走到）。
//
// ⚠️ 要切到文件里的 gemini，就得**不设** ANTHROPIC_*（`unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN`）——
//   否则 env 优先，文件会被盖掉。
import fs from "node:fs";
import path from "node:path";
import { type TextProtocol, type TextTransport } from "@game-maker/contracts";

export const TEXT_CONFIG_FILE = "game-maker.local.json";

export const TEXT_PROTOCOLS: readonly TextProtocol[] = ["anthropic", "gemini"] as const;

export type TextConfigResult = {
  /** 没配就是 undefined —— 调用方自己决定「没有该不该失败」（与 `resolveImageTransport` 同款）。 */
  transport?: TextTransport;
  source: "env" | "file" | null;
  filePath: string;
  warnings: string[];
};

const isHttp = (u: string) => /^https?:\/\//.test(u);

function readFile(filePath: string, warnings: string[]): TextTransport | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  let doc: unknown;
  try {
    doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    warnings.push(`${TEXT_CONFIG_FILE} 不是合法 JSON（${(e as Error).message}）—— 已忽略`);
    return undefined;
  }
  const t = (doc as { text?: Record<string, unknown> } | null)?.text;
  if (!t || typeof t !== "object") return undefined;   // 没有 text 段 → 不是错误，回落 env
  const { protocol, baseUrl, apiKey, model, proxy } = t as { protocol?: unknown; baseUrl?: unknown; apiKey?: unknown; model?: unknown; proxy?: unknown };
  if (typeof baseUrl !== "string" || typeof apiKey !== "string" || !baseUrl || !apiKey) {
    warnings.push(`${TEXT_CONFIG_FILE} 的 text 段需要 baseUrl 与 apiKey 两个非空字符串 —— 已忽略`);
    return undefined;
  }
  if (!isHttp(baseUrl)) {
    warnings.push(`${TEXT_CONFIG_FILE} 的 text 段 baseUrl 必须是 http(s) 地址 —— 已忽略`);
    return undefined;
  }
  if (protocol !== undefined && (typeof protocol !== "string" || !TEXT_PROTOCOLS.includes(protocol as TextProtocol))) {
    warnings.push(`${TEXT_CONFIG_FILE} 的 text 段 protocol 只认 ${TEXT_PROTOCOLS.join(" / ")} —— 已忽略`);
    return undefined;
  }
  return {
    protocol: (protocol as TextProtocol | undefined) ?? "anthropic",
    baseUrl, apiKey,
    ...(typeof model === "string" && model ? { model } : {}),
    ...(typeof proxy === "string" && proxy.trim() ? { proxy: proxy.trim() } : {}),
  };
}

/** 解析文本上游。**没有就是没有** —— `ANTHROPIC_*` env 优先，文件 `text` 段回落。 */
export function resolveTextTransport(opts: {
  env: Record<string, string | undefined>;
  cwd: string;
  fileName?: string;
}): TextConfigResult {
  const filePath = path.join(opts.cwd, opts.fileName ?? TEXT_CONFIG_FILE);
  const warnings: string[] = [];

  const eb = opts.env.ANTHROPIC_BASE_URL?.trim();
  const ek = opts.env.ANTHROPIC_AUTH_TOKEN?.trim();
  if (eb && ek) {
    if (!isHttp(eb)) warnings.push("ANTHROPIC_BASE_URL 必须是 http(s) 地址");
    if (readFile(filePath, warnings)) warnings.push(`环境变量 ANTHROPIC_* 与 ${TEXT_CONFIG_FILE} 的 text 段同时存在 —— 以环境变量为准`);
    return { transport: { protocol: "anthropic", baseUrl: eb, apiKey: ek }, source: "env", filePath, warnings };
  }
  if (eb || ek) {
    warnings.push(`只设了 ${eb ? "ANTHROPIC_BASE_URL" : "ANTHROPIC_AUTH_TOKEN"} 而没设 ${eb ? "ANTHROPIC_AUTH_TOKEN" : "ANTHROPIC_BASE_URL"} —— 环境变量这条路不完整`);
  }

  const fromFile = readFile(filePath, warnings);
  if (fromFile) return { transport: fromFile, source: "file", filePath, warnings };
  return { source: null, filePath, warnings };
}
