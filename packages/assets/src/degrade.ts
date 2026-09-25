// 生成侧降级链（票 14）。**前提是它现在是常态，不是兜底。**
//
// 实测（2026-09-24 一天之内三次翻转）：文本走 `/v1/chat/completions` 会 403
// （代理故障转移到一个余额为零的 provider），而 `/v1/messages` 同一时刻仍然可用；
// 视觉路径也时通时断。所以这条链不是「异常分支」，是**正常运行模式之一**。
//
// 三层，越往下产物越差，但**结构永远完整**：
//   ① 首选端点 —— 真生成
//   ② 备用端点 —— **拿回同样的东西**，不算降级，但要记一笔（`provenance.transport`）
//   ③ 程序化兜底 —— 不用 LLM 也出结构完整的包（**算降级**，记进 `provenance.degradations`）
//
// ⚠️ **整包降级，绝不混着来**：一旦退了一层，整个包都留在那一层。
//   一个「一半真一半假」的包，在风格上看得出来是两批东西 —— 而风格一致性恰恰是
//   Destination 验收第 2 条看的东西。混出来的包比全兜底的包**更危险**，因为它看起来更像真的。
import fs from "node:fs";
import { createDrawListGenerator, type GenerateOptions } from "./generate.js";
import { buildAssetPack, type BuildPackResult, type DrawListGenerator } from "./pack.js";
import { proceduralGenerator } from "./procedural.js";

export type Endpoint = "messages" | "chat-completions";

export type ProbeResult = { endpoint: Endpoint; ok: boolean; detail: string };

/**
 * 探测一个端点能不能**真的干活**。
 *
 * ⚠️ 票 01 实测：代理**完全不校验鉴权**（错误 key、甚至不带鉴权头都返回 200）。
 * 所以探测**不能**靠鉴权失败来判断死活 —— 必须发一次真实的推理请求。
 * 代价是它真的花掉一点点 token，所以 `max_tokens` 压到 8。
 */
export async function probeEndpoint(opts: {
  baseUrl: string; apiKey: string; endpoint: Endpoint;
  fetchImpl?: typeof fetch; timeoutMs?: number;
}): Promise<ProbeResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 8_000);
  const isMessages = opts.endpoint === "messages";
  try {
    const res = await doFetch(`${opts.baseUrl}${isMessages ? "/v1/messages" : "/v1/chat/completions"}`, {
      method: "POST", signal: ctl.signal,
      headers: isMessages
        ? { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" }
        : { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({ model: "deepseek-v4-pro", max_tokens: 8, thinking: { type: "disabled" }, messages: [{ role: "user", content: "ok" }] }),
    });
    if (res.ok) return { endpoint: opts.endpoint, ok: true, detail: "HTTP 200" };
    return { endpoint: opts.endpoint, ok: false, detail: `HTTP ${res.status}：${(await res.text()).slice(0, 160)}` };
  } catch (e) {
    return { endpoint: opts.endpoint, ok: false, detail: (e as Error).message };
  } finally { clearTimeout(timer); }
}

export type ResilientOptions = {
  recipe: Parameters<typeof buildAssetPack>[0]["recipe"];
  style: Parameters<typeof buildAssetPack>[0]["style"];
  outDir: string;
  /** 配方文件所在的目录 —— `source.ref` 相对**它**解析（与 `styleRef` 同一条规则）。 */
  recipeDir: string;
  transport: { baseUrl: string; apiKey: string };
  /** 依次尝试的端点。默认 `["messages", "chat-completions"]`（今天实测前者通、后者 403）。 */
  endpoints?: Endpoint[];
  probeTimeoutMs?: number;
  generatorOptions?: Omit<GenerateOptions, "baseUrl" | "apiKey" | "endpoint">;
  fetchImpl?: typeof fetch;
  /** 跳过网络、直接用程序化兜底（离线构建 / 测试用）。 */
  offline?: boolean;
  /** 逐资源的进度回报（MCP 的进度通知用它）。 */
  onProgress?: (done: number, total: number, assetId: string) => void;
};

export type ResilientResult = BuildPackResult & {
  /**
   * 实际走的那一层。
   * `"none"` = **没有任何资源要用生成器**（清单里全是 `import`）——
   * 这时上游一次都没被碰过，所以既没有降级也没有传输事实可记。
   */
  used: Endpoint | "procedural" | "none";
  probes: ProbeResult[];
};

/**
 * 带降级链地构建一个包。
 *
 * **整包重试**：某一层跑到一半失败，就整个包重来一次、退到下一层 ——
 * 不保留已产出的部分（那正是「半真半假」的来源）。「绝不覆盖」保证了上一版还在，
 * 而失败的那次既不留工作目录也不吃版本号。
 */
export async function buildPackResilient(opts: ResilientOptions): Promise<ResilientResult> {
  // ── 清单里全是导入资源时：不探测、不降级、不记账 ────────────────────────
  //
  // ⚠️ **此前这里会整条链走一遍。** 后果有三个，都是实测出来的：
  //   ① 白探测上游两次（`probeEndpoint` 发的是**真实推理请求**，票 01：鉴权不校验，
  //      所以只能靠真请求判死活）—— 一个根本不需要上游的包，烧掉两次调用；
  //   ② 无论探测结果如何，`--offline` 分支都会写一条
  //      `{stage:"drawlist", reason:"以离线模式构建", fellBackTo:"procedural"}`，
  //      而这个包里**一个资源都没走生成器** —— 没有任何东西退到 procedural；
  //   ③ 那条假降级让 `outcome` 变成 `degraded`，按它分支的脚本会被骗。
  //
  // 判据是**清单本身**，不是运行时的任何状态：有没有 `source.kind === "generate"` 的资源。
  if (!opts.recipe.assets.some((e) => e.source.kind === "generate")) {
    const res = await buildAssetPack({
      recipe: opts.recipe, style: opts.style, outDir: opts.outDir, recipeDir: opts.recipeDir,
      // 生成器**故意给一个会抛的**：这份清单里没有 generate 型资源，它被调用
      // 即说明上面那个判断错了。让它在现场炸，而不是静默产出一堆色块。
      generate: () => { throw new Error("清单里没有任何 generate 型资源，生成器不该被调用（这是一个 bug）"); },
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
      // 不传 `provenance`：没有上游参与，就没有降级、也没有传输事实可记。
      // （传 `transport: {preferred:"offline", used:"procedural"}` 就是那条假账的写法。）
    });
    return { ...res, used: "none", probes: [] };
  }

  const endpoints = opts.endpoints ?? (["messages", "chat-completions"] as Endpoint[]);
  const preferred = endpoints[0]!;
  const switches: { from: string; to: string; reason: string }[] = [];
  const probes: ProbeResult[] = [];

  let chosen: Endpoint | "procedural" = "procedural";
  let probeFailures: string[] = [];

  if (!opts.offline) {
    for (const endpoint of endpoints) {
      const p = await probeEndpoint({ baseUrl: opts.transport.baseUrl, apiKey: opts.transport.apiKey, endpoint, fetchImpl: opts.fetchImpl, timeoutMs: opts.probeTimeoutMs });
      probes.push(p);
      if (p.ok) { chosen = endpoint; break; }
      probeFailures.push(`${endpoint}: ${p.detail}`);
      // ⚠️ 探测**失败**不是切换 —— 切换是「真的改用了另一个端点」，由下面那句记。
      //   （第一版在这里也记了一条，于是上游全死时报出了「messages → chat-completions」这种没发生过的切换。）
    }
  }
  if (chosen !== "procedural" && chosen !== preferred)
    switches.push({ from: preferred, to: chosen, reason: probes.find((p) => p.endpoint === preferred)?.detail ?? "首选端点不可用" });

  const makeGenerator = (endpoint: Endpoint | "procedural"): DrawListGenerator =>
    endpoint === "procedural"
      ? proceduralGenerator
      : createDrawListGenerator({ baseUrl: opts.transport.baseUrl, apiKey: opts.transport.apiKey, endpoint, fetchImpl: opts.fetchImpl, ...opts.generatorOptions });

  // 从头开始依次试；每一层都是**整包**重来
  for (const layer of [...(chosen === "procedural" ? [] : [chosen]), "procedural"] as (Endpoint | "procedural")[]) {
    try {
      const res = await buildAssetPack({
        recipe: opts.recipe, style: opts.style, outDir: opts.outDir, recipeDir: opts.recipeDir,
        generate: makeGenerator(layer),
        ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
        provenance: {
          ...(layer === "procedural" && !opts.offline
            ? { degradations: [{ stage: "drawlist", reason: `上游全部不可达（${probeFailures.join("；")}）`, fellBackTo: "procedural" }] }
            : opts.offline ? { degradations: [{ stage: "drawlist", reason: "以离线模式构建", fellBackTo: "procedural" }] } : {}),
          transport: { preferred: opts.offline ? "offline" : preferred, used: layer, switches },
        },
      });
      return { ...res, used: layer, probes };
    } catch (e) {
      if (layer === "procedural") throw e;
      // 这一层跑到一半挂了 → 退下一层，并记下为什么
      switches.push({ from: layer, to: "procedural", reason: `跑到一半失败：${(e as Error).message.slice(0, 160)}` });
    }
  }
  throw new Error("降级链走到了尽头，却没产出任何包 —— 这不该发生");
}

/** 把包里的降级事实读出来，供 CLI / MCP 展示（票 30 的义务）。 */
export function explainDegradation(packDir: string): string[] {
  const m = JSON.parse(fs.readFileSync(`${packDir}/manifest.json`, "utf8")) as {
    provenance?: { degradations?: { stage: string; reason: string; fellBackTo: string }[]; transport?: { preferred: string; used: string; switches: { from: string; to: string; reason: string }[] } };
  };
  const out: string[] = [];
  for (const d of m.provenance?.degradations ?? []) out.push(`⚠️ 降级（${d.stage}）：${d.reason} → ${d.fellBackTo}`);
  for (const s of m.provenance?.transport?.switches ?? []) out.push(`· 传输切换：${s.from} → ${s.to}（${s.reason.slice(0, 80)}）`);
  return out;
}
