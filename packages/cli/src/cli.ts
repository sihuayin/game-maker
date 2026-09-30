#!/usr/bin/env node
// CLI 薄壳（票 30）。**它只做两件事**：解析参数、渲染 `CommandResult`。
// 所有逻辑在 core（`@game-maker/assets` 的 ops）—— 这里不许有业务判断。
import fs from "node:fs";
import path from "node:path";
import {
  CommandError, EXIT, compileGame, compileTdGame, deriveRecipe, exitCodeOfError, inspectPack, packAssets, resolveImageTransport, verifyPack,
  type CommandResult,
} from "@game-maker/assets";
import { CONFIG_FILE_NAME, HUD_LINE_HEIGHT, KNOWN_FORMATS, VIEWPORT, assembleFromConfig, detectFormat, defaultShellPath } from "@game-maker/demo";

const USAGE = `game-maker —— 图片驱动的游戏资源工具链

用法：
  game-maker derive --requirement <需求.md> --style <stylespec.json> [--out <目录>] [--json]
  game-maker pack   --recipe <清单.json> [--out <目录>] [--concurrency <n>] [--json]
  game-maker compile-game --requirement <需求.md> --pack <资源包目录> [--out <目录>] [--json]
  game-maker compile-td-game --requirement <需求.md> --pack <资源包目录> [--out <目录>] [--json]
  game-maker site   <资源包目录> --config <关卡配置> [--shell <shell.js>] [--out <目录>] [--json]
  game-maker verify <资源包目录> [--json]
  game-maker inspect <资源包目录> [--json]

通用选项：
  --out <目录>   产物根。默认 ./out。**所有回报的路径都相对于它**。
  --json         输出机器可解析的 JSON（与人类输出是**同一份数据**，与 MCP 同源）

退出码：
  0  成功
  1  失败   2  参数错   3  上游不可达   4  产物/清单不合法
  ⚠️ 3 在 2026-09-25 之前从 pack 里返回不出来（上游死活都被降级链兜住、照样出包）。

⚠️ 打开站点时 **HTTP server 的根必须是 <out>/<gameId>/**（pack/ 与 site/ 的父目录）——
   根指到 site 里面会 404，而 Phaser 的 loader **静默失败**。

环境变量：
  ANTHROPIC_BASE_URL · ANTHROPIC_AUTH_TOKEN   文本上游（生成与推导要用）
`;

type Parsed = { command: string; positionals: string[]; flags: Record<string, string | boolean> };

/** 读一份 JSON，读不到就 `undefined`（**不抛**）—— `site` 要靠它认出配置是哪种玩法。 */
function readJsonOrUndefined(p: string): unknown {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return undefined; }
}

export function parseArgs(argv: readonly string[]): Parsed {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const takesValue = new Set(["requirement", "style", "out", "recipe", "config", "shell", "game-id", "pack", "concurrency"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") { flags.help = true; continue; }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (takesValue.has(key)) { const v = argv[++i]; if (v === undefined) throw new CommandError("usage", `--${key} 后面要跟一个值`); flags[key] = v; }
      else flags[key] = true;
    } else positional.push(a);
  }
  return { command: positional[0] ?? "", positionals: positional.slice(1), flags };
}

/** 人类看的渲染。**与 JSON 是同一份数据**，不是另一套。 */
export function renderHuman(r: CommandResult): string {
  const out = [...r.summary];
  for (const a of r.artifacts) out.push(`→ ${a.path}`);
  return out.join("\n");
}

/** 出站通道。测试注入收集器就能完全离线地驱动它（否则测试会把 stdout 刷满）。 */
export type CliIo = { out: (s: string) => void; err: (s: string) => void };
const REAL_IO: CliIo = { out: (s) => void process.stdout.write(s), err: (s) => void process.stderr.write(s) };

export async function run(argv: readonly string[], io: CliIo = REAL_IO): Promise<number> {
  const { command, positionals, flags } = parseArgs(argv);
  const json = flags.json === true;
  const outRoot = path.resolve(typeof flags.out === "string" ? flags.out : "out");
  const env = process.env;
  const transport = { baseUrl: env.ANTHROPIC_BASE_URL ?? "", apiKey: env.ANTHROPIC_AUTH_TOKEN ?? "" };

  try {
    // ⚠️ 这两件事必须分开：**要了 --help = 成功**（用户得到了他想要的），
    //   而**不给任何子命令 = 用法错**。第一版把两者并成一个条件，于是 --help 退的是 2。
    if (flags.help || command === "help") { io.out(USAGE); return EXIT.ok; }
    if (command === "") { io.err(USAGE); return EXIT.usage; }

    let result: CommandResult;
    switch (command) {
      case "derive": {
        if (typeof flags.requirement !== "string" || typeof flags.style !== "string")
          throw new CommandError("usage", "derive 需要 --requirement 与 --style");
        result = await deriveRecipe({ requirementPath: path.resolve(flags.requirement), stylePath: path.resolve(flags.style), outRoot, transport });
        break;
      }
      case "pack": {
        if (typeof flags.recipe !== "string") throw new CommandError("usage", "pack 需要 --recipe");
        // 生图凭据：文件（已 gitignore）或环境变量，环境变量优先。没配也能跑 —— 只要清单里没有 image 资源。
        const img = resolveImageTransport({ env: process.env, cwd: process.cwd() });
        for (const w of img.warnings) io.err(`⚠️ ${w}\n`);
        // 并发上限（票 47）：**按上游分别定**是本来的形状，但一个数就够人用了 ——
        // 给了就两边都用它；要分开调就用 API。
        const n = typeof flags.concurrency === "string" ? Number(flags.concurrency) : undefined;
        if (n !== undefined && (!Number.isInteger(n) || n < 1))
          throw new CommandError("usage", `--concurrency 必须是 ≥1 的整数（给的是 "${flags.concurrency}"）`);
        result = await packAssets({
          recipePath: path.resolve(flags.recipe), outRoot, transport,
          ...(img.transport ? { imageTransport: img.transport } : {}),
          ...(n !== undefined ? { concurrency: { text: n, image: n } } : {}),
        });
        break;
      }
      case "compile-game": {
        if (typeof flags.requirement !== "string" || typeof flags.pack !== "string")
          throw new CommandError("usage", "compile-game 需要 --requirement 与 --pack");
        result = await compileGame({
          requirementPath: path.resolve(flags.requirement),
          packDir: path.resolve(flags.pack),
          outRoot, transport,
          // 视口与行高都传外壳**那一份**常量 —— 不让这两个数在仓里出现第二个值
          viewport: VIEWPORT,
          hudLineHeight: HUD_LINE_HEIGHT,
        });
        break;
      }
      case "compile-td-game": {
        // ⚠️ 与 `compile-game` **分开的子命令**，不合成一个按 format 分派的口子 ——
        //   那是本图的 Out of scope（两条链的提示词、校验族、产物路径都不一样）。
        if (typeof flags.requirement !== "string" || typeof flags.pack !== "string")
          throw new CommandError("usage", "compile-td-game 需要 --requirement 与 --pack");
        result = await compileTdGame({
          requirementPath: path.resolve(flags.requirement),
          packDir: path.resolve(flags.pack),
          outRoot, transport,
          // 视口与行高都传外壳**那一份**常量 —— 不让这两个数在仓里出现第二个值
          viewport: VIEWPORT,
          hudLineHeight: HUD_LINE_HEIGHT,
        });
        break;
      }
      case "site": {
        const dir = positionals[0]; if (!dir) throw new CommandError("usage", "site 需要一个资源包目录");
        if (typeof flags.config !== "string") throw new CommandError("usage", `site 需要 --config <关卡配置>（认得的格式：${KNOWN_FORMATS.join(" · ")}）`);
        const configPath = path.resolve(flags.config);
        // ⚠️ **按配置的 `format` 分派**（横版 / 塔防），不是按文件名 ——
        //   而 `--shell` 仍然可以显式覆盖外壳 bundle（独立安装时按仓库布局找不到它）。
        const shell = typeof flags.shell === "string"
          ? path.resolve(flags.shell)
          : defaultShellPath(detectFormat(readJsonOrUndefined(configPath)) ?? "", process.cwd());
        result = assembleFromConfig({
          packDir: path.resolve(dir),
          configPath,
          shellJsPath: shell,
          outRoot,
          ...(typeof flags["game-id"] === "string" ? { gameId: flags["game-id"] } : {}),
        });
        break;
      }
      case "verify": {
        const dir = positionals[0]; if (!dir) throw new CommandError("usage", "verify 需要一个资源包目录");
        result = verifyPack({ packDir: path.resolve(dir) });
        break;
      }
      case "inspect": {
        const dir = positionals[0]; if (!dir) throw new CommandError("usage", "inspect 需要一个资源包目录");
        result = inspectPack({ packDir: path.resolve(dir) });
        break;
      }
      default: throw new CommandError("usage", `不认识的操作 "${command}"`);
    }

    io.out((json ? JSON.stringify(result, null, 2) : renderHuman(result)) + "\n");
    return EXIT.ok;
  } catch (e) {
    const code = exitCodeOfError(e);
    const message = e instanceof Error ? e.message : String(e);
    // ⚠️ **失败时已经花掉的那几笔**（票 46）—— 包没产出来，它们没有别的家。
    const spent = e instanceof CommandError ? e.ledger : undefined;
    if (json) io.out(JSON.stringify({ command, error: message, exitCode: code, ...(spent?.length ? { ledger: spent } : {}) }, null, 2) + "\n");
    else {
      io.err(`✗ ${message}\n`);
      if (spent?.length)
        io.err(`\n已经花掉的（${spent.length} 次调用 · ${spent.reduce((n, c) => n + c.attempts, 0)} 次往返）：\n` +
          spent.map((c) => `  · ${c.step} ${c.target} · ${(c.ms / 1000).toFixed(1)}s · 往返 ${c.attempts}${c.model ? ` · ${c.model}` : ""}\n`).join(""));
    }
    return code;
  }
}

// 只有直接执行时才跑（被 import 时不跑，测试要用）
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  process.exit(await run(process.argv.slice(2)));
}
