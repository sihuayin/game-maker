// **站点目录的落盘** —— 两个玩法共用这一份。
//
// ⚠️ 它只做「摆目录」这一件事，**不含任何玩法判断**：校验、场景描述、几何检查
//   全部留在各自的装配器里（`site.ts` / `td/site.ts`），在这里之前就已经跑完了。
//
// ⚠️ **一份而不是两份**：这段里有两个字符串是**错了就静默失败**的 ——
//   `index.html` 里的 `<script src="./shell.js">`，与 `site.json` 里「我消费了哪个包」。
//   两边各写一份，就意味着两处 404 的机会，而 **Phaser 的 loader 是静默的**（票 03）。
import fs from "node:fs";
import path from "node:path";
import { CommandError, type ConfigIssue } from "@game-maker/contracts";
import { SHELL_VERSION } from "./draw.js";

export type LayoutOptions = {
  /** 资源包目录（**已解开的目录** —— 票 18 Q1：交付形态只出目录，zip 是导出动作）。 */
  packDir: string;
  outRoot: string;
  /** 站点目录名。两个玩法都缺省用包自己的 id。 */
  gameId: string;
  /** 消费的包版本，`v<N>`。 */
  packVersion: string;
  /** 外壳 bundle。**所有站点共用同一份字节**（R8 的字面意义）。 */
  shellJsPath: string;
  /** 已经过完校验、要原样拷进站点的那份配置。 */
  configPath: string;
  /** 它在站点目录里叫什么（`game-config.json` / `td-config.json`）。 */
  configFileName: string;
};

export type LaidSite = {
  gameDir: string;
  siteDir: string;
  siteVersion: number;
  packDest: string;
  packCopied: boolean;
};

const jstr = (o: unknown) => JSON.stringify(o, null, 2) + "\n";

/** 把一族 issue 拼成一条能读的 error —— 硬失败**一次报全**，别让人跑五遍。两个玩法共用。 */
export const failWith = (title: string, issues: readonly ConfigIssue[]): never => {
  const lines = issues.map((i) => `  · ${i.where}: ${i.message}`);
  throw new CommandError("invalid", `${title}（${issues.length} 条）：\n${lines.join("\n")}`);
};

/** 下一个站点版本号 —— **绝不覆盖**（票 18 与票 24 同一条规矩）。 */
export function nextSiteVersion(siteDir: string): number {
  if (!fs.existsSync(siteDir)) return 1;
  const ns = fs.readdirSync(siteDir)
    .map((d) => /^v(\d+)$/.exec(d))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  return ns.length === 0 ? 1 : Math.max(...ns) + 1;
}

/**
 * 摆出一个站点目录。
 *
 * ⚠️ **包已存在就不动它** —— 「绝不覆盖」还有一个更实在的好处：换包重建站点时，
 *   上一次的产物不会被踩掉（R6 说的「换包不重建」正是靠这个成立）。
 */
export function laySite(opts: LayoutOptions): LaidSite {
  const gameDir = path.join(path.resolve(opts.outRoot), opts.gameId);

  const packDest = path.join(gameDir, "pack", opts.packVersion);
  const packCopied = !fs.existsSync(packDest);
  if (packCopied) {
    fs.mkdirSync(path.dirname(packDest), { recursive: true });
    fs.cpSync(opts.packDir, packDest, { recursive: true });
  }

  const siteRoot = path.join(gameDir, "site");
  fs.mkdirSync(siteRoot, { recursive: true });
  const siteVersion = nextSiteVersion(siteRoot);
  const siteDir = path.join(siteRoot, `v${siteVersion}`);
  fs.mkdirSync(siteDir, { recursive: true });

  fs.copyFileSync(opts.shellJsPath, path.join(siteDir, "shell.js"));
  fs.copyFileSync(opts.configPath, path.join(siteDir, opts.configFileName));

  // ⚠️ **经典 script**（不是 module）：票 03 实测 module script 撞 CORS —— 少一个失败模式
  fs.writeFileSync(path.join(siteDir, "index.html"), `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>${opts.gameId}</title>
<style>html,body{margin:0;height:100%;background:#101014;display:grid;place-items:center}</style>
</head><body><div id="game"></div>
<script src="./shell.js"></script>
</body></html>
`);

  // 站点**自己说明自己是怎么来的**（票 18 / 票 32 裁决 6）：外壳版本 + 消费的包版本 + 哪份配置。
  // ⚠️ `config` 是 2026-09-29 加的（塔防进来之后，一个外壳带两种配置）——
  //   外壳**读不到它就得靠猜文件名**，而那正是「站点与外壳对不上」这条探测要防的东西。
  fs.writeFileSync(path.join(siteDir, "site.json"), jstr({
    shell: SHELL_VERSION, pack: opts.packVersion, config: opts.configFileName,
  }));

  return { gameDir, siteDir, siteVersion, packDest, packCopied };
}
