#!/usr/bin/env node
// MCP stdio server（票 30）。**R5：它不 shell out 到 CLI** —— 直接调 core，
// 否则会叠出两层进度协议。
//
// 长任务进度用 MCP **原生的** `notifications/progress`（请求里带 `progressToken` 时服务端边跑边发）。
// 不搞 job id 轮询：MCP server 是短命的 stdio 进程，维护一份作业表反而是真复杂度的来源。
// 客户端不支持通知也能跑，只是看不到进度。
import { createInterface } from "node:readline";
import {
  CommandError, deriveRecipe, exitCodeOfError, inspectPack, packAssets, verifyPack,
  type CommandResult,
} from "@game-maker/assets";

const PROTOCOL_VERSION = "2025-06-18";

/** 工具面。**description 内嵌「什么时候用 / 什么样的输入会失败」**（票 30 问题 6）。 */
const TOOLS = [
  {
    name: "derive_recipe",
    description:
      "从一段需求文本 + 一份 StyleSpec 推导出一份资源清单（asset-recipe/v1），落盘到 <out>/<id>/recipes/v<N>.json。\n" +
      "**两阶段的第一步** —— 推完先让人过目，再用 build_asset_pack 生成。清单绝不覆盖，每次写新的 v<N>。\n" +
      "何时用：用户给了新的需求文本，且还没有资源清单。已经有清单时不要用它，直接 build_asset_pack。\n" +
      "会失败的情况：上游不可达（清单是文件，这时人可以自己写一份）；推出来的 JSON 不过 schema。",
    inputSchema: {
      type: "object",
      properties: {
        requirementPath: { type: "string", description: "需求文本的路径（markdown 或纯文本）" },
        stylePath: { type: "string", description: "StyleSpec JSON 的路径" },
        outDir: { type: "string", description: "产物根目录，默认 ./out。回报的路径都相对于它" },
      },
      required: ["requirementPath", "stylePath"],
    },
  },
  {
    name: "build_asset_pack",
    description:
      "把一份资源清单变成一整个**资源包**（PNG 图集 + TexturePacker JSON + manifest + 创作态源文件）。\n" +
      "⚠️ **没有兜底**（2026-09-25 起）：文本上游不可达就直接失败，退出码 3。" +
      "此前有一条「换端点 → 程序化兜底」的降级链，会照样吐出一个颜色方块拼的包 —— 那条已经拆掉。\n" +
      "何时用：清单已经过目、定稿了。\n" +
      "会失败的情况：清单不过 schema；source.kind 是 import 而那个位图文件不存在；" +
      "source.kind 是 drawlist 而文本上游不可达。",
    inputSchema: {
      type: "object",
      properties: {
        recipePath: { type: "string", description: "资源清单 JSON 的路径" },
        outDir: { type: "string", description: "产物根目录，默认 ./out" },
      },
      required: ["recipePath"],
    },
  },
  {
    name: "verify_asset_pack",
    description:
      "校验一个已有的资源包：manifest schema + **逐文件 checksum** + files[] 覆盖完整性。\n" +
      "何时用：拿到一个来源不明的包、或者怀疑产物被外部改动过的时候。\n" +
      "**这是唯一能发现「包被人手改过」的手段** —— 而且它不会自动被别处调用，要主动跑。",
    inputSchema: { type: "object", properties: { packDir: { type: "string", description: "资源包目录（含 manifest.json 的那一层）" } }, required: ["packDir"] },
  },
  {
    name: "inspect_asset_pack",
    description:
      "列出一个资源包里有什么：每个资源的 kind / 尺寸 / 来源（generated | imported）/ 色板绑定 / 帧与动画。\n" +
      "何时用：**在写游戏配置之前** —— 你需要知道有哪些资源、它们的动画叫什么名字，才能写出能解析的引用。\n" +
      "它不校验 checksum（那是 verify_asset_pack 的事）。",
    inputSchema: { type: "object", properties: { packDir: { type: "string", description: "资源包目录" } }, required: ["packDir"] },
  },
] as const;

type Rpc = { jsonrpc: "2.0"; id?: number | string; method: string; params?: Record<string, unknown> };
const send = (msg: unknown): void => { process.stdout.write(JSON.stringify(msg) + "\n"); };
type RpcId = number | string | null;
type Emit = (m: unknown) => void;

/**
 * 处理一条 JSON-RPC 消息。**所有出站消息都走注入的 `emit`** ——
 * 默认写 stdout；测试注入一个收集器就能完全离线地驱动它。
 * （第一版只把进度走注入、回复写死 stdout，于是测试收不到任何回复、还把 stdout 刷满了。）
 */
export async function handle(msg: Rpc, emit: Emit = send): Promise<void> {
  const reply = (id: Rpc["id"], result: unknown): void => emit({ jsonrpc: "2.0", id, result });
  const fail = (id: RpcId | undefined, code: number, message: string): void => emit({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  const { id, method, params = {} } = msg;
  switch (method) {
    case "initialize":
      return reply(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: "game-maker", version: "0.1.0" } });
    case "notifications/initialized":
    case "notifications/cancelled":
      return;
    case "tools/list":
      return reply(id, { tools: TOOLS });
    case "tools/call": {
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      const meta = params._meta as { progressToken?: number | string } | undefined;
      const token = meta?.progressToken;
      const tick = (fraction: number, message: string): void => {
        if (token === undefined) return;
        emit({ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken: token, progress: fraction, total: 1, message } });
      };
      try {
        let result: CommandResult;
        switch (name) {
          case "derive_recipe":
            tick(0.05, "正在推导资源清单…");
            result = await deriveRecipe({
              requirementPath: String(args.requirementPath), stylePath: String(args.stylePath),
              outRoot: String(args.outDir ?? "out"),
              transport: { baseUrl: process.env.ANTHROPIC_BASE_URL ?? "", apiKey: process.env.ANTHROPIC_AUTH_TOKEN ?? "" },
            });
            break;
          case "build_asset_pack":
            result = await packAssets({
              recipePath: String(args.recipePath), outRoot: String(args.outDir ?? "out"),
              transport: { baseUrl: process.env.ANTHROPIC_BASE_URL ?? "", apiKey: process.env.ANTHROPIC_AUTH_TOKEN ?? "" },
              onProgress: (done, total, assetId) => tick(done / total, `正在生成 ${assetId}（${done + 1}/${total}）`),
            });
            break;
          case "verify_asset_pack":
            result = verifyPack({ packDir: String(args.packDir) });
            break;
          case "inspect_asset_pack":
            result = inspectPack({ packDir: String(args.packDir) });
            break;
          default:
            return fail(id, -32602, `不认识的工具 "${name}"`);
        }
        tick(1, "完成");
        return reply(id, {
          content: [{ type: "text", text: result.summary.join("\n") }],
          structuredContent: result,          // 机器可读的那一份与 CLI --json **同源**
          isError: false,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return reply(id, { content: [{ type: "text", text: `✗ ${message}` }], isError: true, _exitCode: exitCodeOfError(e) });
      }
    }
    default:
      return fail(id, -32601, `不认识的方法 "${method}"`);
  }
}

if (process.argv[1]?.endsWith("server.mjs") || process.argv[1]?.endsWith("server.js")) {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const t = line.trim();
    if (!t) return;
    let msg: Rpc;
    try { msg = JSON.parse(t) as Rpc; } catch { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "解析不了这一行 JSON" } }) + "\n"); return; }
    void handle(msg);
  });
}
