// **一个入口，两种玩法**。
//
// ⚠️ 它存在的理由是「配置是文件，而文件名不该决定怎么解释它」：
//   外壳（`shell/entry.ts`）与两个壳（CLI / MCP）都要按 `format` 分派到同一个装配器，
//   而**分派本身只此一份**。三处各写一份的话，先漂移的那一处会表现为
//   「CLI 能装、MCP 报了一个看不懂的 schema 错」。
//
// ⚠️ **两份都读同一个 `format` 串** —— 与磁盘上已有的东西一致：
//   `game-config/v1` 是横版（它**没有** `genre` 字段，也不需要加），`td-config/v1` 是塔防。
import fs from "node:fs";
import path from "node:path";
import { CommandError, GAME_CONFIG_FORMAT, TD_CONFIG_FORMAT, type CommandResult } from "@game-maker/contracts";
import { assembleSite, type SiteOptions } from "./site.js";
import { assembleTdSite, type TdSiteOptions } from "./td/site.js";

/** 认得的格式 —— **一个格式一行**。加一种玩法就是加一行 + 一个装配器。 */
export const KNOWN_FORMATS = [GAME_CONFIG_FORMAT, TD_CONFIG_FORMAT] as const;

/** 站点目录里那份配置叫什么。⚠️ 外壳按 `site.json` 的 `config` 字段读它，不靠猜。 */
export const CONFIG_FILE_NAME: Record<string, string> = {
  [GAME_CONFIG_FORMAT]: "game-config.json",
  [TD_CONFIG_FORMAT]: "td-config.json",
};

/** 每种玩法默认用哪个 bundle。⚠️ 今天**两者是同一份**（见 `draw.ts` 的 SHELL_VERSION 注释）。 */
export function defaultShellPath(_format: string, cwd: string): string {
  return path.resolve(cwd, "packages/demo/dist/shell.js");
}

/** 从一份**没解析过的**配置里读出 `format`。读不到就是 `undefined`，不抛。 */
export function detectFormat(raw: unknown): string | undefined {
  const f = (raw as { format?: unknown } | null)?.format;
  return typeof f === "string" ? f : undefined;
}

export type AssembleOptions = {
  packDir: string;
  configPath: string;
  shellJsPath: string;
  outRoot: string;
  gameId?: string;
};

/**
 * 按配置的 `format` 分派。
 *
 * ⚠️ 退出码语义要**原样穿过**：找不到配置文件是 `usage`(2)，而 schema 不过、
 *   校验不过都是 `invalid`(4)。分派这一层不许把任何一类揉成另一类
 *   （票 30 抓到过「校验不过时退出码是 0」，同一个坑不踩第二次）。
 */
export function assembleFromConfig(opts: AssembleOptions): CommandResult {
  if (!fs.existsSync(opts.configPath)) throw new CommandError("usage", `找不到配置：${opts.configPath}`);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(opts.configPath, "utf8"));
  } catch (e) {
    throw new CommandError("invalid", `配置不是合法 JSON：${e instanceof Error ? e.message : String(e)}`);
  }
  const format = detectFormat(raw);
  if (format === undefined)
    throw new CommandError("usage", `这份配置没有 \`format\` 字段 —— 认不出它是哪一种玩法的关卡（认得的：${KNOWN_FORMATS.join(" · ")}）`);
  if (format === GAME_CONFIG_FORMAT) return assembleSite(opts as SiteOptions);
  if (format === TD_CONFIG_FORMAT) return assembleTdSite(opts as TdSiteOptions);
  throw new CommandError("usage", `不认识的配置格式 "${format}"（认得的：${KNOWN_FORMATS.join(" · ")}）`);
}
