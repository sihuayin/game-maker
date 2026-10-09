#!/usr/bin/env node
// MCP stdio server（票 30）。**R5：它不 shell out 到 CLI** —— 直接调 core，
// 否则会叠出两层进度协议。
//
// 长任务进度用 MCP **原生的** `notifications/progress`（请求里带 `progressToken` 时服务端边跑边发）。
// 不搞 job id 轮询：MCP server 是短命的 stdio 进程，维护一份作业表反而是真复杂度的来源。
// 客户端不支持通知也能跑，只是看不到进度。
import { createInterface } from "node:readline";
import {
  CommandError, compileRuntime, exitCodeOfError, formatSpentCalls, inspectPack, packAssets, planAssets, resolveImageTransport, verifyPack,
  type CommandResult,
} from "@game-maker/assets";
import { assembleSite, defaultShellPath, VIEWPORT } from "@game-maker/demo";
import { QA_JUDGEMENTS, QA_JUDGEMENT_LABELS, qaVerdict, type QAReport } from "@game-maker/contracts";
import { runBuild, runUnderstanding } from "@game-maker/pipeline";
import path from "node:path";
import fs from "node:fs";

const PROTOCOL_VERSION = "2025-06-18";

/** `--intent` 的判别与 CLI **同一条规则**（票 16 的 Q3）：像路径就当路径，否则当裸文本。
 *  ⚠️ 两个壳各自接线（`demo` 与 `pipeline` 彼此看不见，没有一处能放共享的壳代码）——
 *   而这条规则只有一行，两边都写一遍比引一个包划算。**改的时候两处一起改。** */
function readIntent(v: string): string {
  const looksLikePath = /\.(md|txt)$/i.test(v) || v.includes("/") || v.includes("\\") || v.startsWith("./") || v.startsWith("../");
  if (!looksLikePath) return v;
  const p = path.resolve(process.cwd(), v);
  if (!fs.existsSync(p))
    throw new CommandError("usage", `intent 看起来是一个路径（"${v}"），而它不存在：${p}`);
  return fs.readFileSync(p, "utf8");
}

/**
 * **QA 那一份回报**（票 20 的 Q5）—— 与 CLI **同一份内容**（那一侧在 `cli.ts` 里，
 * 两处各写一遍：`demo` 与 `pipeline` 彼此看不见，没有一处能放共享的壳代码，
 * 与上面 `readIntent` 的注释同一条理由。**改的时候两处一起改。**）
 *
 * ⚠️ 裁决**不在这里判**：`qaVerdict()` 是契约里那**一处**（`ledger.ts` 尾注那条纪律）。
 * ⚠️ **`incomplete` 不是失败**，而它今天**恒真**（`checked` 恒 5/6）⇒ 把「跑了的那几条怎么样」
 *   与「哪几条没跑」**分开说**，否则那一行会被读成「有问题」。
 * ⚠️ **观察不打**：今天两条都是 `unavailable`（链上还没接采集），打出来只是噪声。
 * ⚠️ **判据失败那一路不在这里**：`runBuild` 在硬失败上**抛**，文案与报告路径都在那个异常里。
 */
function qaReportOf(qa: QAReport, qaReportPath: string, outDir: string): {
  summary: string[]; data: Record<string, unknown>; artifact: { path: string; kind: string };
} {
  const verdict = qaVerdict(qa);
  const missing = QA_JUDGEMENTS.filter((j) => !qa.checked.includes(j));
  const ran = `${qa.checked.length}/${QA_JUDGEMENTS.length} 条由 QA 跑过（裁决 ${verdict}）`
    + (missing.length === 0 ? "" : ` —— 没跑的：${missing.map((j) => QA_JUDGEMENT_LABELS[j]).join(" · ")}`);
  const p = path.relative(outDir, qaReportPath);
  return {
    summary: [
      qa.failures.length === 0
        ? `✅ QA：没有一条判据说不行 · ${ran}`
        : `✅ QA：没有一条 error，但有 ${qa.failures.length} 条警告 · ${ran}`,
      ...qa.failures.map((f) => `  ⚠️ [${f.judgement}] ${f.target}：${f.detail.replace(/\n/g, "\n    ")}`),
    ],
    data: { qaVerdict: verdict, qaReport: p },
    artifact: { path: p, kind: "qa-report" },
  };
}

/** 生图上游：**环境变量优先**，其次本地那份（已 gitignore 的）配置 —— 与 CLI 同源。 */
function imageTransportOf() {
  return resolveImageTransport({ env: process.env, cwd: process.cwd() }).transport;
}

/** 工具面。**description 内嵌「什么时候用 / 什么样的输入会失败」**（票 30 问题 6）。 */
const TOOLS = [
  {
    name: "plan_assets",
    description:
      "从一个游戏设计（game-design.json）+ 这个世界的视觉语法（visual-world.json）规划出一份资源清单（asset-recipe/v1），" +
      "落盘到 <out>/<id>/recipes/v<N>.json（风格文件与参考图拷在同一个目录）。\n" +
      "**两阶段的第一步** —— 规划完先让人过目，再用 build_asset_pack 生成。清单绝不覆盖，每次写新的 v<N>。\n" +
      "何时用：已经有了设计（compile-design 的产物），且还没有资源清单。已经有清单时不要用它，直接 build_asset_pack。\n" +
      "⚠️ 它取代了旧的 derive_recipe（后者吃「需求 + StyleSpec」）。\n" +
      "会失败的情况：上游不可达（清单是文件，这时人可以自己写一份）；规划出来的 JSON 不过 schema 或不过清单契约。",
    inputSchema: {
      type: "object",
      properties: {
        designPath: { type: "string", description: "game-design.json 的路径" },
        visualWorldPath: { type: "string", description: "visual-world.json 的路径" },
        outDir: { type: "string", description: "产物根目录，默认 ./out。回报的路径都相对于它" },
      },
      required: ["designPath", "visualWorldPath"],
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
    name: "create_game",
    description:
      "端到端：**一张风格参考图 + 一句需求（或一份需求 .md）→ 跑完整条链** —— " +
      "参考图 → 这个世界 → 意图 → 设计 → 角色基因 → 资源清单 → 生图 → 配置 → 站点，产物落 <out>/<gameId>/run|pack|site/v<N>/。\n" +
      "⚠️ **它不停**（R9 那个检查点只活在 CLI 上）：它等于 `game-maker create --yes`。" +
      "想在生图之前看一眼清单，就用 plan_assets + build_asset_pack 那一对。\n" +
      "⚠️ **这一步会花钱**：清单里有多少个 image 资源，就发多少次生图调用（而在它跑完之前你不会知道那个数）。\n" +
      "何时用：从零做一个游戏。已经有一份清单 / 包 / 配置时，用别的工具。\n" +
      "会失败的情况：上游不可达（退出码 3）；参考图或需求读不出来（参数错 2）；" +
      "模型三发都没给出过契约的文书（4）；清单里有**这一代外壳做不了**的东西（R12 的拒绝，4）。",
    inputSchema: {
      type: "object",
      properties: {
        stylePath: { type: "string", description: "风格参考图（第一阶段恰好一张）" },
        intent: { type: "string", description: "需求文本；以 .md/.txt 结尾或含路径分隔符时**当路径**读那个文件" },
        outDir: { type: "string", description: "产物根目录，默认 ./out。回报的路径都相对于它" },
        styleId: { type: "string", description: "风格身份的 slug，默认取参考图 basename" },
      },
      required: ["stylePath", "intent"],
    },
  },
  {
    name: "inspect_asset_pack",
    description:
      "列出一个资源包里有什么：每个资源的 kind / 尺寸 / 来源（generated | imported）/ 色板绑定 / 帧与动画。\n" +
      "何时用：**在写游戏配置之前** —— 你需要知道有哪些资源、它们的动画叫什么名字，才能写出能解析的引用。\n" +
      "它不校验 checksum（那是 verify_asset_pack 的事）。",
    inputSchema: { type: "object", properties: { packDir: { type: "string", description: "资源包目录" } }, required: ["packDir"] },
  },
  {
    name: "compile_runtime",
    description:
      "从一份设计（game-design.json）+ 一个资源包编译出一份 game-config（game-config/v1），" +
      "落盘到 <out>/<id>/game-configs/v<N>.json。\n" +
      "**链的倒数第二步** —— 编完再用 assemble_site 装配。绝不覆盖，每次写新的 v<N>。\n" +
      "何时用：已经有了设计（compile-design / plan-assets 之后），且已经有一个资源包" +
      "（配置必须只引用包里真实存在的资源与动画）。\n" +
      "⚠️ 它取代了旧的 compile_game（后者吃「需求 + 资源包」）。\n" +
      "⚠️ **业务校验不过时它就地失败、且不落盘** —— 那是**确定性的编译错误**（这份设计配这个包做不出合法的关卡），" +
      "不是模型没生成好，所以**不重采样**；要去改设计或清单。\n" +
      "会失败的情况：上游不可达；三次都吐不出过契约的配置；过契约但过不了校验。",
    inputSchema: {
      type: "object",
      properties: {
        designPath: { type: "string", description: "game-design.json 的路径" },
        packDir: { type: "string", description: "资源包目录 —— 它既是模型要看的资源清单，也是校验的依据" },
        levelId: { type: "string", description: "编哪一关；省略 = 设计层的第一关" },
        outDir: { type: "string", description: "产物根目录，默认 ./out。回报的路径都相对于它" },
      },
      required: ["designPath", "packDir"],
    },
  },
  {
    name: "assemble_site",
    description:
      "把一个资源包 + 一份 game-config 装配成一个**静态可托管的站点目录**（产物 B），落盘到 <out>/<gameId>/site/v<N>/。\n" +
      "站点 = 三份数据 + 一份共用 bundle（index.html / shell.js / site.json / game-config.json），绝不覆盖，每次写新的 v<N>。\n" +
      "何时用：已经有了一个校验通过的游戏配置，想把它跑起来。\n" +
      "**起服务时 HTTP server 的根必须是 <out>/<gameId>/**（pack/ 与 site/ 的父目录）—— 根指到 site 里面会 404，而 Phaser 静默失败。\n" +
      "会失败的情况：包或配置不过 schema、**装配期校验不过**（引用/自洽/可通关/几何/HUD 屏幕空间），这些都**硬失败**、不产出站点。",
    inputSchema: {
      type: "object",
      properties: {
        packDir: { type: "string", description: "资源包目录（含 manifest.json 的那种目录）" },
        configPath: { type: "string", description: "game-config JSON 的路径" },
        shellPath: { type: "string", description: "外壳 bundle 的路径，默认 packages/demo/dist/shell.js" },
        outDir: { type: "string", description: "产物根目录，默认 ./out。回报的路径都相对于它" },
        gameId: { type: "string", description: "站点目录名，默认取资源包自己的 id" },
      },
      required: ["packDir", "configPath"],
    },
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
          case "plan_assets":
            tick(0.05, "正在规划资源清单…");
            result = await planAssets({
              designPath: String(args.designPath), visualWorldPath: String(args.visualWorldPath),
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
          case "compile_runtime":
            tick(0.2, "正在编译游戏配置…");
            result = await compileRuntime({
              designPath: String(args.designPath), packDir: String(args.packDir),
              ...(args.levelId !== undefined ? { levelId: String(args.levelId) } : {}),
              outRoot: String(args.outDir ?? "out"),
              transport: { baseUrl: process.env.ANTHROPIC_BASE_URL ?? "", apiKey: process.env.ANTHROPIC_AUTH_TOKEN ?? "" },
              viewport: VIEWPORT,
            });
            break;
          case "create_game": {
            tick(0.05, "理解层：参考图 → 这个世界 → 意图 → 设计 → 角色基因…");
            const understanding = await runUnderstanding({
              outRoot: String(args.outDir ?? "out"),
              requirement: readIntent(String(args.intent)),
              styleReferences: [{ path: String(args.stylePath), role: "global" }],
              transport: { baseUrl: process.env.ANTHROPIC_BASE_URL ?? "", apiKey: process.env.ANTHROPIC_AUTH_TOKEN ?? "" },
              ...(args.styleId === undefined ? {} : { styleId: String(args.styleId) }),
              onProgress: (p) => tick(0.4, `${p.step}${p.detail === undefined ? "" : `：${p.detail}`}`),
            });
            tick(0.5, "构建层：生图 → 配置 → QA → 站点…");
            const built = await runBuild({
              outRoot: String(args.outDir ?? "out"), runDir: understanding.run.dir,
              transport: { baseUrl: process.env.ANTHROPIC_BASE_URL ?? "", apiKey: process.env.ANTHROPIC_AUTH_TOKEN ?? "" },
              ...(imageTransportOf() === undefined ? {} : { imageTransport: imageTransportOf()! }),
              viewport: VIEWPORT,
              onProgress: (p) => tick(0.7, `${p.step}${p.detail === undefined ? "" : `：${p.detail}`}`),
            });
            const site = assembleSite({
              packDir: built.paths.packDir, configPath: built.paths.config,
              shellJsPath: defaultShellPath("", process.cwd()),
              outRoot: String(args.outDir ?? "out"), gameId: built.gameId,
              // ⚠️ **同一个 N**（票 15 的 Q16/Q17：父指定、子不自算）
              siteVersion: built.packVersion,
            });
            const outDir = String(args.outDir ?? "out");
            const qa = built.qa === undefined || built.paths.qaReport === undefined
              ? undefined : qaReportOf(built.qa, built.paths.qaReport, outDir);
            result = {
              command: "create",
              summary: [
                `这次运行：${path.relative(outDir, understanding.run.dir)}` +
                  `（v${understanding.run.version} · ${understanding.run.gameId}）· 包 v${built.packVersion}`,
                ...understanding.intent.ambiguity.map((a) => `⚠️ **用户没说清的地方**：${a}`),
                ...(qa?.summary ?? []),
                ...site.summary,
              ],
              data: {
                status: "complete", gameId: built.gameId, runVersion: understanding.run.version,
                packVersion: built.packVersion, ...site.data, ...(qa?.data ?? {}),
              },
              artifacts: [
                ...site.artifacts,
                { path: path.relative(outDir, built.paths.packDir), kind: "asset-pack" },
                ...(qa === undefined ? [] : [qa.artifact]),
              ],
            };
            break;
          }
          case "assemble_site":
            result = assembleSite({
              packDir: String(args.packDir), configPath: String(args.configPath),
              shellJsPath: String(args.shellPath ?? "packages/demo/dist/shell.js"),
              outRoot: String(args.outDir ?? "out"),
              ...(args.gameId === undefined ? {} : { gameId: String(args.gameId) }),
            });
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
        // ⚠️ **失败时已经花掉的那几笔**（票 46）—— 与 CLI 渲染的是**同一份数据**（R5）。
        //   包没产出来，它们没有别的家；而花了钱是事实。
        const spent = e instanceof CommandError ? e.ledger : undefined;
        const tail = spent?.length
          ? `\n\n${formatSpentCalls(spent)}`
          : "";
        return reply(id, {
          content: [{ type: "text", text: `✗ ${message}${tail}` }],
          ...(spent?.length ? { structuredContent: { ledger: spent } } : {}),
          isError: true, _exitCode: exitCodeOfError(e),
        });
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
