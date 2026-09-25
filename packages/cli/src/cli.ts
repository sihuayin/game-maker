#!/usr/bin/env node
// CLI 薄壳（票 30）。**它只做两件事**：解析参数、渲染 `CommandResult`。
// 所有逻辑在 core（`@game-maker/assets` 的 ops）—— 这里不许有业务判断。
import fs from "node:fs";
import path from "node:path";
import {
  CommandError, EXIT, deriveRecipe, exitCodeOf, exitCodeOfError, inspectPack, packAssets, verifyPack,
  type CommandResult, type Endpoint,
} from "@game-maker/assets";

const USAGE = `game-maker —— 图片驱动的游戏资源工具链

用法：
  game-maker derive --requirement <需求.md> --style <stylespec.json> [--out <目录>] [--json]
  game-maker pack   --recipe <清单.json> [--out <目录>] [--json] [--offline]
  game-maker verify <资源包目录> [--json]
  game-maker inspect <资源包目录> [--json]

通用选项：
  --out <目录>   产物根。默认 ./out。**所有回报的路径都相对于它**。
  --json         输出机器可解析的 JSON（与人类输出是**同一份数据**）

退出码：
  0  成功（**包括降级成功** —— 脚本要分支就看 JSON 里的 degraded）
  1  失败   2  参数错   3  上游不可达   4  产物/清单不合法

环境变量：
  ANTHROPIC_BASE_URL · ANTHROPIC_AUTH_TOKEN   文本上游（生成与推导要用）
`;

type Parsed = { command: string; positionals: string[]; flags: Record<string, string | boolean> };

export function parseArgs(argv: readonly string[]): Parsed {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const takesValue = new Set(["requirement", "style", "out", "recipe", "endpoints"]);
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
  if (r.transport && r.transport.used !== r.transport.preferred)
    out.push(`· 传输切换：${r.transport.preferred} → ${r.transport.used}`);
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
        const endpoints = typeof flags.endpoints === "string" ? (flags.endpoints.split(",") as Endpoint[]) : undefined;
        result = await packAssets({ recipePath: path.resolve(flags.recipe), outRoot, transport, ...(endpoints ? { endpoints } : {}), ...(flags.offline === true ? { offline: true } : {}) });
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
    return exitCodeOf(result);
  } catch (e) {
    const code = exitCodeOfError(e);
    const message = e instanceof Error ? e.message : String(e);
    if (json) io.out(JSON.stringify({ command, error: message, exitCode: code }, null, 2) + "\n");
    else io.err(`✗ ${message}\n`);
    return code;
  }
}

// 只有直接执行时才跑（被 import 时不跑，测试要用）
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  process.exit(await run(process.argv.slice(2)));
}
