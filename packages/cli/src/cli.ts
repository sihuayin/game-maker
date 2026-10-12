#!/usr/bin/env node
// CLI 薄壳（票 30）。**它只做两件事**：解析参数、渲染 `CommandResult`。
// 所有逻辑在 core（`@game-maker/assets` 的 ops）—— 这里不许有业务判断。
import fs from "node:fs";
import path from "node:path";
import {
  CommandError, EXIT, compileRuntime, compileTdGame, exitCodeOfError, failureDirOfError, failureSiteNote, formatSpentCalls, inspectPack, ledgerOfError, packAssets, planAssets, resolveImageTransport, verifyPack,
  type CommandResult,
} from "@game-maker/assets";
import { CONFIG_FILE_NAME, HUD_LINE_HEIGHT, KNOWN_FORMATS, VIEWPORT, assembleFromConfig, detectFormat, defaultShellPath } from "@game-maker/demo";
import { QA_JUDGEMENTS, QA_JUDGEMENT_LABELS, qaVerdict, type QAReport } from "@game-maker/contracts";
// ⚠️ **观察的渲染与 `pack` 那条命令共用同一个函数**（票 39）—— 两条路各写一份文案就是两份漂移。
import { masterRatioNotes } from "@game-maker/assets";
// ⚠️ **图单元的那把尺子**（票 40）：检查点报的数与 `pack` 真发出去的次数**共用它** ——
//   两处以前各切各的，检查点因此报小了 2.2 倍（11 个 image 源资产 vs 真发的 24 次）。
import { imageCallsOf, type AssetRecipe, type ImageCalls } from "@game-maker/contracts";
import { runBuild, runUnderstanding, type CreateStep } from "@game-maker/pipeline";

const USAGE = `game-maker —— 图片驱动的游戏资源工具链

用法：
  game-maker create --style <一张参考图> --intent <需求文本 | 需求.md> [--yes] [--style-id <slug>] [--out <目录>] [--concurrency <n>] [--concurrency-image <n>] [--json]
  game-maker build  <run 目录> [--out <目录>] [--concurrency <n>] [--concurrency-image <n>] [--json]
  game-maker plan   --design <game-design.json> --visual-world <visual-world.json> [--out <目录>] [--json]
  game-maker pack   --recipe <清单.json> [--visual-world <visual-world.json>] [--version <n>] [--out <目录>] [--concurrency <n>] [--concurrency-image <n>] [--json]
  game-maker compile-runtime --design <game-design.json> --pack <资源包目录> [--out <目录>] [--json]
  game-maker compile-td-game --requirement <需求.md> --pack <资源包目录> [--out <目录>] [--json]
  game-maker site   <资源包目录> --config <关卡配置> [--shell <shell.js>] [--out <目录>] [--json]
  game-maker verify <资源包目录> [--json]
  game-maker inspect <资源包目录> [--json]

\`create\` 是**两段**（R9：人工点只有一个，在清单处）：
  · 不带 \`--yes\` ⇒ 跑到清单为止就**停下**（退出码 0，\`data.status = "awaiting"\`），
    把「这一步要生几张图」与「用户没说清的地方」打给你看；人看完或改完清单，再跑
    \`game-maker build <那个 run 目录>\` 接着往下。
  · 带 \`--yes\` ⇒ 一路跑到底：生图 → 配置 → QA → 站点（**等于跳过那个检查点**）。
  ⚠️ 两条路的产物**逐字节等价** —— 只是分两次跑、还是连着跑。
  ⚠️ **QA 判据硬失败 ⇒ 退出码 4、且站点不产** —— 报告**已经落在** \`run/v<N>/qa-report.json\`
     （判据说的是**产物**的问题，重抽一次改不了它 ⇒ 要去的地方是设计 / 清单 / 包）。

通用选项：
  --out <目录>   产物根。默认 ./out。**所有回报的路径都相对于它**。
  --json         输出机器可解析的 JSON（与人类输出是**同一份数据**，与 MCP 同源）
  --concurrency <n>       并发上限，**文本与生图两边都设成 n**（默认：文本 4 · 生图 3）
  --concurrency-image <n> ⚠️ **只设生图**那一边（文本仍走 \`--concurrency\`、没给就是默认 4）
  ⚠️ 并发只影响**速度与上游压力**，不影响产物（是同一批调用的先后，不是不同的调用）；
     两个都给时 \`--concurrency-image\` 只覆盖生图那一半。
  ⚠️ 默认的那两个数是**实测挑的**（票 47：串行 50.1s → 并发 4 是 11.6s 的最优点；
     再往上没有收益、只有被上游限流的风险）—— 生图 3 比文本保守也是这个原因。

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
  const takesValue = new Set([
    "design", "visual-world", "out", "recipe", "config", "shell", "game-id", "pack", "concurrency", "concurrency-image", "level",
    // 票 16：`create` / `build` 的那几个
    "style", "intent", "style-id", "version",
  ]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") { flags.help = true; continue; }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      if (takesValue.has(key)) {
        const v = argv[++i];
        if (v === undefined) throw new CommandError("usage", `--${key} 后面要跟一个值`);
        // ⚠️ **同一个带值选项给两次 = 用法错**（票 16 的 Q4）：`flags` 是个 Record，第二次会**静默盖掉**
        //   第一次 —— 而「`--style a --style b` 只用了 b」是最难发现的那种错。
        if (flags[key] !== undefined)
          throw new CommandError("usage", `--${key} 给了两次（"${String(flags[key])}" 与 "${v}"）—— 一个选项只给一次。` +
            (key === "style" ? "今天 `--style` **恰好收一张**（多参考图见票 26）。" : ""));
        flags[key] = v;
      }
      else flags[key] = true;
    } else positional.push(a);
  }
  return { command: positional[0] ?? "", positionals: positional.slice(1), flags };
}

// ── 票 16 的几块（薄壳那一侧的全部业务：**判别输入**与**渲染检查点**，没有别的）──────

/** `--version` 的值：必须是正整数（`pack` 的显式版本口 —— 票 15 的 Q16/Q17）。 */
function parseVersion(v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new CommandError("usage", `--version 必须是 ≥1 的整数（给的是 "${v}"）`);
  return n;
}

/** `--concurrency` / `--concurrency-image` 的值：必须是 ≥1 的整数。⚠️ 报错要点**给的那个 flag 的名字**。 */
function concurrencyOf(v: string, flag = "--concurrency"): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new CommandError("usage", `${flag} 必须是 ≥1 的整数（给的是 "${v}"）`);
  return n;
}

/** 并发覆盖：**两半各自可选**（票 41）—— 没给的那一半由引擎取 `DEFAULT_CONCURRENCY`。 */
export type Concurrency = { text?: number; image?: number };

/**
 * 从 flags 算出**并发覆盖**（票 41 的 Q1 —— 第六跑 Q4 的裁定：「能独立控制 image concurrency」）。
 *
 * ⚠️⚠️ **没给的那一半不进返回值** —— 这正是本票要的那件事。`--concurrency-image 2` 给的是
 *   `{ image: 2 }`：**没有 `text` 键**，于是引擎自己取 `DEFAULT_CONCURRENCY.text`（4）。
 *   写成 `{ text: n, image: n }`（票 41 之前那四处代码的形状）就是「一个数两边都用」，
 *   而第四/五/六跑每一跑都在偏离那条裁定 —— 原因是 CLI 表达不出「image 2」。
 *
 * · `--concurrency <n>` —— **原义不变**：text 与 image **两边都设成 n**。
 * · `--concurrency-image <n>` —— **只设 image**；两者同时给时它**只覆盖 image**，text 仍走 `--concurrency`。
 * · 两个都没给 ⇒ `undefined`（**不给覆盖**，而不是给一个空对象）。
 *
 * ⚠️ `--concurrency-text` **有意不加**（票 41 的 Q1：严格限定在本票要求的那一个入口）。
 *
 * ⚠️ **导出只为测试**（票 41 的 Q5 腿①）—— 它是纯函数，`run()` 之外没有别的消费者。
 */
export function concurrencyFromFlags(flags: Record<string, string | boolean>): Concurrency | undefined {
  const both = typeof flags.concurrency === "string" ? concurrencyOf(flags.concurrency) : undefined;
  const image = typeof flags["concurrency-image"] === "string"
    ? concurrencyOf(flags["concurrency-image"], "--concurrency-image") : undefined;
  if (both === undefined && image === undefined) return undefined;
  // ⚠️ `image ?? both` —— 具体那个赢；而 `text` 只在 `--concurrency` 给了的时候出现。
  return { ...(both === undefined ? {} : { text: both }), image: image ?? both! };
}

/**
 * 那三个调用点**共用的那一行**（票 41 的 Q3/Q4）：把上面的结果摊成可展开的一小段。
 * ⚠️ 两个 flag 都没给时返回**空对象**（展开后不给 `concurrency` 键），而不是 `{ concurrency: undefined }`。
 */
const concurrencyArg = (flags: Record<string, string | boolean>): { concurrency?: Concurrency } => {
  const c = concurrencyFromFlags(flags);
  return c === undefined ? {} : { concurrency: c };
};

/**
 * `--intent` 收两种东西（票 09 定的方向、票 16 落地）：**像路径就当路径，否则当裸文本**。
 *
 * ⚠️ **判别写死成一条**：以 `.md`/`.txt` 结尾、或含路径分隔符、或以 `./` `../` 开头 ⇒ 路径。
 *   于是 `--intent "做一个横版游戏"` **永远不会**被当成一个文件名；而 `--intent intent.md`
 *   写错了名字会**当场**说清（`usage` 退出码 2），而不是把那个文件名当成一句需求喂给模型。
 * ⚠️ **读文件是逐字节的**（§13：`intent.md` 存原样字节）—— 提示词那侧的 `trim()` 是另一回事。
 */
function readRequirement(cwd: string, v: string): string {
  const looksLikePath = /\.(md|txt)$/i.test(v) || v.includes("/") || v.includes("\\") || v.startsWith("./") || v.startsWith("../");
  if (!looksLikePath) return v;
  const p = path.resolve(cwd, v);
  if (!fs.existsSync(p))
    throw new CommandError("usage",
      `--intent 看起来是一个路径（"${v}"），而它不存在：${p}\n` +
      "⚠️ 要么把那个文件放好，要么**把需求文本直接写在命令行上** —— " +
      "判别规则是「以 .md/.txt 结尾、或含路径分隔符 ⇒ 当路径」，所以一句普通的中文需求不会被误判。");
  return fs.readFileSync(p, "utf8");
}

/**
 * `--style` 变成一个**相对 `cwd` 的路径**（票 16 落地时撞上的那一条）。
 *
 * ⚠️ `visual-world.json` 里那一格**以它自身为基准**（`StyleReferencePath` 的规矩），
 *   所以调用方给的**绝对路径**会在 `analyzeReference` 那里被拒（「必须是相对路径」）。
 *   而下游（票 15 的 `stageUnderstanding`）会把它拷进 run、改写成 basename ——
 *   原始形状只需要「**相对 cwd、而且解析得到**」。
 */
const styleRefOf = (cwd: string, given: string): string =>
  path.relative(cwd, path.resolve(cwd, given)).split(path.sep).join("/") || ".";

const progressTo = (io: CliIo) => (p: { step: string; detail?: string }) =>
  io.err(`  · ${p.step}${p.detail === undefined ? "" : `：${p.detail}`}\n`);

const relPath = (outRoot: string, p: string): string => path.relative(outRoot, p).split(path.sep).join("/");

/**
 * 把**理解层那几个错误类**翻译成 `CommandError`（票 16 的 Q3(b)；票 14 的播下：
 * 「两类失败都退出码 4，但文案不同」）。
 *
 * ⚠️ **不翻译就会退成 1**：那几个类住在 `vision` / `game-design`（壳只依赖 `pipeline`），
 *   所以 `exitCodeOfError` 认不出它们 —— 而那正是**票 16 的 E2E 探针当场撞出来的**：
 *   真跑那一次「模型三发都没吐出一份过契约的 VisualWorldSpec」退的是 **1**，
 *   而退出码表写着这一类是 **4**（`plan` / `pack` 对同一档也是 4）。
 * ⚠️ 按**形状**认，不 import 那两个包（壳要薄）：带 `failure` 的（`CALL_FAILURES` 那七档）与
 *   带 `rejections` 的（R12 的拒绝）—— 两者的形状都由 `contracts` 定，不是这里现编的。
 */
function asCommandError(e: unknown): unknown {
  const o = e as { failure?: unknown; rejections?: unknown; ledger?: unknown; message?: unknown };
  if (Array.isArray(o?.rejections))
    return new CommandError("invalid", typeof o.message === "string" ? o.message : String(e),
      o.ledger === undefined ? {} : { ledger: o.ledger as never });
  if (typeof o?.failure !== "string") return e;
  // ⚠️ 传输层那两档是「上游不可达」（3）—— 与 `assets` 那条链同款；其余都是「文书不合法」（4）。
  const upstream = o.failure === "http" || o.failure === "timeout";
  return new CommandError(upstream ? "upstream" : "invalid",
    typeof o.message === "string" ? o.message : String(e),
    o.ledger === undefined ? {} : { ledger: o.ledger as never });
}

/**
 * 构建段：**`create --yes` 与 `build` 共用这一份** —— 「两条路的产物等价」靠的就是它。
 * ⚠️ 站点那一层**只有壳这一层够得着**（`pipeline` 的白名单里没有 `demo`）⇒ 在这里串第三步。
 */
async function buildAndSite(o: {
  outRoot: string; runDir: string; transport: { baseUrl: string; apiKey: string };
  env: NodeJS.ProcessEnv; cwd: string; io: CliIo; concurrency?: Concurrency; fetchImpl?: typeof fetch;
  /** 显式指定外壳 bundle（与 `site` 命令同款）—— 独立安装时按仓库布局找不到它。 */
  shellJsPath?: string;
}): Promise<{ built: Awaited<ReturnType<typeof runBuild>>; site: CommandResult }> {
  const img = resolveImageTransport({ env: o.env, cwd: o.cwd });
  for (const w of img.warnings) o.io.err(`⚠️ ${w}\n`);
  const built = await runBuild({
    outRoot: o.outRoot, runDir: o.runDir, transport: o.transport,
    ...(img.transport ? { imageTransport: img.transport } : {}),
    ...(o.fetchImpl === undefined ? {} : { fetchImpl: o.fetchImpl }),
    ...(o.concurrency === undefined ? {} : { concurrency: o.concurrency }),
    viewport: VIEWPORT, hudLineHeight: HUD_LINE_HEIGHT,
    onProgress: progressTo(o.io),
  });
  const raw = JSON.parse(fs.readFileSync(built.paths.config, "utf8")) as unknown;
  const site = assembleFromConfig({
    packDir: built.paths.packDir, configPath: built.paths.config,
    shellJsPath: o.shellJsPath ?? defaultShellPath(detectFormat(raw) ?? "", o.cwd),
    outRoot: o.outRoot, gameId: built.gameId,
    // ⚠️ **同一个 N**（票 15 的 Q16/Q17：父指定、子不自算）—— 这次运行的三样产物同一个版本号。
    siteVersion: built.packVersion,
  });
  return { built, site };
}

/** 清单摘要里那几行**共用的**（`create` 停与不停都要打）。 */
function recipeLines(u: { recipe: AssetRecipe }): {
  kinds: Record<string, number>; imageCalls: ImageCalls; lines: string[];
} {
  const kinds: Record<string, number> = {};
  for (const a of u.recipe.assets) kinds[a.spec.kind] = (kinds[a.spec.kind] ?? 0) + 1;
  // ⚠️ **这里报的是「生图调用次数」，不是「image 源资源数」**（票 40 改的这一行）。
  //   以前它是 `assets.filter(a => a.source.kind === "image").length` —— 而真发出去的次数
  //   由**展开**决定（动画按**动画**数、分层背景按**层**数、母版另算），两者不是一回事：
  //   第六跑那份清单报「11 个要走生图」，而实际是 **24 次**（20 个图单元 + 4 张母版）
  //   ⇒ **报小了 2.2 倍**，而它**正是人批准付费跑时看的那个数**。
  //   ⚠️ 现在两边**共用同一把尺子**（`imageUnitsOf`，住 contracts）—— 不许再有第二份展开。
  const calls = imageCallsOf(u.recipe);
  const byKind = Object.entries(kinds).map(([k, v]) => `${k}×${v}`).join(" · ");
  const b = calls.breakdown;
  return {
    kinds, imageCalls: calls,
    lines: calls.total === 0
      ? [`清单：${u.recipe.assets.length} 个资源（${byKind}）—— **没有生图调用**，下一步不花钱`]
      : [
        `清单：${u.recipe.assets.length} 个资源（${byKind}）—— ⚠️ **预计 ${calls.total} 次生图调用**` +
        `（动画 ${b.animation} 次 · 单帧 ${b.single} 次 · 背景层 ${b.background} 层 · 母版 ${b.master} 张）`,
        // ⚠️ **它是上限，不是预测**（票 40 的 Q4）：依赖失败 / 母版挂掉时，依赖者
        //   **一个字节都不往外发**（票 11 / 票 13）⇒ 实际调用会**比它少**。人批准的就是这个数，
        //   所以这句得挨着它、不能藏到别处。
        `↑ 这是**清单完整派发时的上限** —— 依赖或母版失败时那几笔不会发出去，实际会更少；\`game-maker build\` 那一步才花钱`,
      ],
  };
}

/** 停在检查点时的那份回报（票 16 的 Q2/Q8）。⚠️ `status` 是**机器可读**的（脚本靠它判断跑完没有）。 */
function awaitingCheckpoint(
  u: Awaited<ReturnType<typeof runUnderstanding>>, outRoot: string,
): CommandResult {
  const runDir = relPath(outRoot, u.run.dir);
  const recipePath = `${runDir}/asset-recipe.json`;
  const r = recipeLines(u);
  return {
    command: "create",
    summary: [
      `理解层跑完了 —— 这次运行：${runDir}（v${u.run.version} · ${u.run.gameId}）`,
      ...r.lines,
      ...u.intent.ambiguity.map((a) => `⚠️ **用户没说清的地方**：${a}`),
      `下一步：看一眼、或直接改那份清单（${recipePath}），然后跑：game-maker build ${runDir}`,
      "或者一开始就加 --yes —— 它会把生图、配置、站点一路做完（等于跳过这里）。",
    ],
    data: {
      status: "awaiting", gameId: u.run.gameId, runVersion: u.run.version, runDir,
      recipe: recipePath, assetCount: u.recipe.assets.length,
      // ⚠️ **`imageCalls` 是「预计生图调用次数」**（票 40）—— 换掉了旧的 `imageAssetCount`
      //   （那个数说的是 image 源**资源**数，与真正发出去的次数差着**展开**那一层，
      //   第六跑 11 vs 24）。⚠️ 明细那四项之和 === `imageCalls`（同一个事实一个来源）。
      imageCalls: r.imageCalls.total, imageCallBreakdown: r.imageCalls.breakdown,
      kinds: r.kinds, ambiguity: u.intent.ambiguity,
    },
    artifacts: [{ path: runDir, kind: "run" }, { path: recipePath, kind: "asset-recipe" }],
  };
}

/** `create --yes` 跑完时的那份回报。⚠️ **`ambiguity` 照样打**（票 03 押在这一票上的那两条之一）。 */
function createComplete(
  u: Awaited<ReturnType<typeof runUnderstanding>>,
  b: Awaited<ReturnType<typeof runBuild>>, site: CommandResult, outRoot: string,
): CommandResult {
  const r = recipeLines(u);
  const qa = b.qa === undefined || b.paths.qaReport === undefined ? undefined : qaReportOf(b.qa, b.paths.qaReport, outRoot);
  return {
    command: "create",
    summary: [
      `这次运行：${relPath(outRoot, u.run.dir)}（v${u.run.version} · ${u.run.gameId}）`,
      ...r.lines,
      ...(u.intent.ambiguity.length === 0 ? [] : u.intent.ambiguity.map((a) => `⚠️ **用户没说清的地方**：${a}`)),
      ...b.packVersion === u.run.version ? [] : [`⚠️ 这次构建用了包版本 v${b.packVersion}（run 是 v${u.run.version}）`],
      // ⚠️ **母版比例的观察**（票 39）：**观察不是错误** —— 它不改变退出码，只是报出来。
      ...masterRatioNotes(b.masterRatios ?? []),
      ...(qa?.summary ?? []),
      ...site.summary,
    ],
    data: {
      status: "complete", gameId: u.run.gameId, runVersion: u.run.version, packVersion: b.packVersion,
      runDir: relPath(outRoot, u.run.dir), packDir: relPath(outRoot, b.paths.packDir),
      config: relPath(outRoot, b.paths.config), siteDir: String(site.data["siteDir"] ?? ""),
      entry: String(site.data["entry"] ?? ""), serveRoot: String(site.data["serveRoot"] ?? ""),
      imageCalls: r.imageCalls.total, imageCallBreakdown: r.imageCalls.breakdown,
      ambiguity: u.intent.ambiguity,
      ...(qa?.data ?? {}),
    },
    artifacts: [
      { path: relPath(outRoot, u.run.dir), kind: "run" },
      { path: relPath(outRoot, b.paths.packDir), kind: "asset-pack" },
      ...(qa === undefined ? [] : [qa.artifact]),
      ...site.artifacts,
    ],
  };
}

/** `build` 跑完时的那份回报。⚠️ `ambiguity` 从磁盘上那份意图里读回来（人可能已经看过，但记一笔无害）。 */
function buildComplete(
  b: Awaited<ReturnType<typeof runBuild>>, site: CommandResult, outRoot: string,
): CommandResult {
  const intentPath = path.join(b.runDir, "game-intent.json");
  let ambiguity: string[] = [];
  try { ambiguity = (JSON.parse(fs.readFileSync(intentPath, "utf8")) as { ambiguity?: string[] }).ambiguity ?? []; } catch { /* 读不到就算了 */ }
  const qa = b.qa === undefined || b.paths.qaReport === undefined ? undefined : qaReportOf(b.qa, b.paths.qaReport, outRoot);
  return {
    command: "build",
    summary: [
      `这次运行：${relPath(outRoot, b.runDir)}（v${b.runVersion} · ${b.gameId}）· 包 v${b.packVersion}`,
      `包：${relPath(outRoot, b.paths.packDir)}（${b.manifest.assets.length} 个资源）`,
      ...(ambiguity.length === 0 ? [] : ambiguity.map((a) => `⚠️ **用户没说清的地方**：${a}`)),
      // ⚠️ **母版比例的观察**（票 39）：**观察不是错误** —— 它不改变退出码，只是报出来。
      ...masterRatioNotes(b.masterRatios ?? []),
      ...(qa?.summary ?? []),
      ...site.summary,
    ],
    data: {
      status: "complete", gameId: b.gameId, runVersion: b.runVersion, packVersion: b.packVersion,
      runDir: relPath(outRoot, b.runDir), packDir: relPath(outRoot, b.paths.packDir),
      config: relPath(outRoot, b.paths.config), siteDir: String(site.data["siteDir"] ?? ""),
      entry: String(site.data["entry"] ?? ""), serveRoot: String(site.data["serveRoot"] ?? ""),
      ambiguity,
      ...(qa?.data ?? {}),
    },
    artifacts: [
      { path: relPath(outRoot, b.runDir), kind: "run" },
      { path: relPath(outRoot, b.paths.packDir), kind: "asset-pack" },
      ...(qa === undefined ? [] : [qa.artifact]),
      ...site.artifacts,
    ],
  };
}

/** 人类看的渲染。**与 JSON 是同一份数据**，不是另一套。 */
export function renderHuman(r: CommandResult): string {
  const out = [...r.summary];
  for (const a of r.artifacts) out.push(`→ ${a.path}`);
  return out.join("\n");
}

/**
 * **QA 那一份回报**（票 20 的 Q5）—— `create --yes` 与 `build` 共用这一份。
 *
 * ⚠️ 裁决**不在这里判**：`qaVerdict()` 是契约里那**一处**（`ledger.ts` 尾注那条纪律）。
 * ⚠️ **`incomplete` 不是失败**，而它今天**恒真**（`checked` 恒 5/6 —— 第六条「层覆盖」由
 *   装配期的硬失败保证，不归任何族，见票 19）。⇒ 这里把「跑了的那几条怎么样」与
 *   「哪几条没跑」**分开说**，否则那一行会被读成「有问题」。
 * ⚠️ **观察不打**：今天两条都是 `unavailable`（链上还没接采集）—— 打出来只是噪声，
 *   而它要说话的时候，话在 `qa-report.json` 里。
 * ⚠️ **判据失败那一路不在这里**：`runBuild` 在硬失败上**抛**（报告先落盘、再抛），
 *   文案与报告路径都在那个异常里 —— 别在这里再判一次「过没过」。
 */
function qaReportOf(qa: QAReport, qaReportPath: string, outRoot: string): {
  summary: string[]; data: Record<string, unknown>; artifact: { path: string; kind: string };
} {
  const verdict = qaVerdict(qa);
  const missing = QA_JUDGEMENTS.filter((j) => !qa.checked.includes(j));
  const ran = `${qa.checked.length}/${QA_JUDGEMENTS.length} 条由 QA 跑过（裁决 ${verdict}）`
    + (missing.length === 0 ? "" : ` —— 没跑的：${missing.map((j) => QA_JUDGEMENT_LABELS[j]).join(" · ")}`);
  const path = relPath(outRoot, qaReportPath);
  return {
    summary: [
      qa.failures.length === 0
        ? `✅ QA：没有一条判据说不行 · ${ran}`
        : `✅ QA：没有一条 error，但有 ${qa.failures.length} 条警告 · ${ran}`,
      ...qa.failures.map((f) => `  ⚠️ [${f.judgement}] ${f.target}：${f.detail.replace(/\n/g, "\n    ")}`),
    ],
    data: { qaVerdict: verdict, qaReport: path },
    artifact: { path, kind: "qa-report" },
  };
}

/** 出站通道。测试注入收集器就能完全离线地驱动它（否则测试会把 stdout 刷满）。 */
export type CliIo = { out: (s: string) => void; err: (s: string) => void };
const REAL_IO: CliIo = { out: (s) => void process.stdout.write(s), err: (s) => void process.stderr.write(s) };

/**
 * 注入给壳的那三样（票 16）：**上游**（测试用，与 `ops` 那几处同名同义）、
 * **环境**与**工作目录**（默认分别是 `process.env` 与 `process.cwd()`）。
 *
 * ⚠️ 有了它，`create` 这条链才**离线可测** —— 否则只能测「参数错」那一档
 *   （而那正是「薄壳不许有业务判断」的另一面：判断在 core，shell 只负责把它接上）。
 */
export type CliDeps = {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
};

export async function run(argv: readonly string[], io: CliIo = REAL_IO, deps: CliDeps = {}): Promise<number> {
  // ⚠️ **`parseArgs` 必须在 `try` 里面**（票 16 落地时发现的一个先前就有的洞）：它在外面时，
  //   「`--recipe` 后面没跟值」这类**参数错会直接逃出 `run()`**（崩栈、退出码变成 1），
  //   而退出码表写着它是 2。既有测试只**直接**测过 `parseArgs`，所以这条从没被跑到。
  const json = argv.includes("--json");
  let command = "", positionals: string[] = [], flags: Record<string, string | boolean> = {};
  try { ({ command, positionals, flags } = parseArgs(argv)); } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (json) io.out(JSON.stringify({ command: "", error: message, exitCode: EXIT.usage }, null, 2) + "\n");
    else io.err(`✗ ${message}\n`);
    return EXIT.usage;
  }
  const outRoot = path.resolve(typeof flags.out === "string" ? flags.out : "out");
  const env = deps.env ?? process.env;
  const cwd = deps.cwd ?? process.cwd();
  const up = deps.fetchImpl === undefined ? {} : { fetchImpl: deps.fetchImpl };
  const transport = { baseUrl: env.ANTHROPIC_BASE_URL ?? "", apiKey: env.ANTHROPIC_AUTH_TOKEN ?? "" };

  try {
    // ⚠️ 这两件事必须分开：**要了 --help = 成功**（用户得到了他想要的），
    //   而**不给任何子命令 = 用法错**。第一版把两者并成一个条件，于是 --help 退的是 2。
    if (flags.help || command === "help") { io.out(USAGE); return EXIT.ok; }
    if (command === "") { io.err(USAGE); return EXIT.usage; }

    let result: CommandResult;
    switch (command) {
      case "create": {
        // ⚠️ **两段的第一段**（票 16 的 Q1/Q2/Q6/Q8）：跑到清单为止就停（除非 `--yes`）。
        if (typeof flags.style !== "string") throw new CommandError("usage", "create 需要 --style <一张参考图>");
        if (typeof flags.intent !== "string") throw new CommandError("usage", "create 需要 --intent <需求文本 | 需求.md>");
        const requirement = readRequirement(cwd, flags.intent);
        const understanding = await runUnderstanding({
          outRoot, requirement, transport, cwd, ...up,
          // ⚠️ 恰好一张（票 16 的 Q4）：契约是复数、而**实现推到第一阶段之后**（票 26）——
          //   多张会被 `parseArgs` 当「同一个选项给两次」拒掉。
          styleReferences: [{ path: styleRefOf(cwd, flags.style) }],
          ...(typeof flags["style-id"] === "string" ? { styleId: flags["style-id"] } : {}),
          onProgress: progressTo(io),
        });
        if (flags.yes !== true) {
          result = awaitingCheckpoint(understanding, outRoot);
          break;
        }
        const { built, site } = await buildAndSite({ outRoot, runDir: understanding.run.dir, transport, env, cwd, io, ...up,
          ...concurrencyArg(flags),
          ...(typeof flags.shell === "string" ? { shellJsPath: path.resolve(cwd, flags.shell) } : {}) });
        result = createComplete(understanding, built, site, outRoot);
        break;
      }
      case "build": {
        // ⚠️ **两段的第二段**（票 16 的 Q1）—— 它**只吃那个 run 目录**：清单、风格、参考图、
        //   基因一概从磁盘读回（票 15 的 invariant 3）。人改过的清单在这里生效。
        const dir = positionals[0];
        if (dir === undefined) throw new CommandError("usage", "build 需要一个 run 目录（create 打出来的那个：<out>/<gameId>/run/v<N>）");
        const runDir = path.resolve(dir);
        const { built, site } = await buildAndSite({ outRoot, runDir, transport, env, cwd, io, ...up,
          ...concurrencyArg(flags),
          ...(typeof flags.shell === "string" ? { shellJsPath: path.resolve(cwd, flags.shell) } : {}) });
        result = buildComplete(built, site, outRoot);
        break;
      }
      case "plan": {
        // ⚠️ **命令叫 `plan` 而不是 `derive`**（票 12 的 Q1）：它的输入与语义都变了
        //   —— 旧 `derive` 吃「需求 + StyleSpec」，这一道吃「设计 + 这个世界」。名字跟着变。
        if (typeof flags.design !== "string" || typeof flags["visual-world"] !== "string")
          throw new CommandError("usage", "plan 需要 --design 与 --visual-world");
        result = await planAssets({
          designPath: path.resolve(flags.design),
          visualWorldPath: path.resolve(flags["visual-world"]),
          outRoot, transport, ...up,
        });
        break;
      }
      case "pack": {
        if (typeof flags.recipe !== "string") throw new CommandError("usage", "pack 需要 --recipe");
        // 生图凭据：文件（已 gitignore）或环境变量，环境变量优先。没配也能跑 —— 只要清单里没有 image 资源。
        const img = resolveImageTransport({ env, cwd });
        for (const w of img.warnings) io.err(`⚠️ ${w}\n`);
        // 并发上限（票 41）：**与 `create --yes` / `build` 同一个解析** —— 以前这一支自作主张，
        // 连报错文案都是别处复制来的。⚠️ 那句被推翻的旧注释（票 47 的「一个数就够人用了 ·
        // 要分开调就用 API」）**删掉**：第六跑 Q4 的裁定要的正是「能独立控制 image concurrency」。
        result = await packAssets({
          recipePath: path.resolve(flags.recipe), outRoot, transport, ...up,
          ...(img.transport ? { imageTransport: img.transport } : {}),
          ...concurrencyArg(flags),
          // ⚠️ 票 15 播给本票的两个可选 flag：**单跑 `pack` 时**也想让包里带一份 VWS；
          //   而 `--version` 是「父指定、子不自算」那条规矩的手动口 —— ⚠️ **它不是覆盖**：
          //   那个位置已经摆着东西时，`pack` 会**拒**（「禁止覆盖」在子树同样成立）。
          ...(typeof flags["visual-world"] === "string" ? { visualWorldPath: flags["visual-world"] } : {}),
          ...(typeof flags.version === "string" ? { version: parseVersion(flags.version) } : {}),
        });
        break;
      }
      case "compile-runtime": {
        // ⚠️ **命令叫 `compile-runtime` 而不是 `compile-game`**（票 14 的 Q1）：它的输入变了
        //   —— 旧那道吃「需求 + 资源包」，这一道吃「设计 + 这一代外壳 + 资源包」。
        if (typeof flags.design !== "string" || typeof flags.pack !== "string")
          throw new CommandError("usage", "compile-runtime 需要 --design 与 --pack");
        result = await compileRuntime({
          designPath: path.resolve(flags.design),
          packDir: path.resolve(flags.pack),
          outRoot, transport, ...up,
          ...(typeof flags.level === "string" ? { levelId: flags.level } : {}),
          // 视口与行高都传外壳**那一份**常量 —— 不让这两个数在仓里出现第二个值
          viewport: VIEWPORT,
          hudLineHeight: HUD_LINE_HEIGHT,
        });
        break;
      }
      case "compile-td-game": {
        // ⚠️ 与横版那一道 **分开的子命令**，不合成一个按 format 分派的口子 ——
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
  } catch (raw) {
    // ⚠️ 先翻译（见 `asCommandError`）—— 那一步决定了退出码是不是 4。
    const e = asCommandError(raw);
    const code = exitCodeOfError(e);
    const message = e instanceof Error ? e.message : String(e);
    // ⚠️ **失败时已经花掉的那几笔**（票 46）—— 包没产出来，它们没有别的家。
    // ⚠️⚠️ **按能力读、不按类读**（2026-10-12 · 票 48 的 Q2 = A）：
    //   账与现场可以挂在**任何**异常上 —— 而 `pack` 段那些判断抛的**正是**普通 `Error`，
    //   它们**恰恰**是花钱之后抛的那一类。⇒ 写成 `e instanceof CommandError` 等于
    //   对**一整类**失败报「没花钱」，第三跑那 9 张已付费的图就是这么丢的。
    const spent = ledgerOfError(e);
    // ⚠️ **失败现场**（票 01）：生图那条路一次失败就是几笔已经付过钱的调用，
    //   而原图与逐字提示词在失败那一刻就在磁盘上 —— 现在**改名留下**，这里把它说给人。
    //   ⚠️ 它与账**是两项独立信息**：一项缺席**不许**连另一项一起吞（票 48 的执行约束 2）。
    const kept = failureDirOfError(e);
    if (json) io.out(JSON.stringify({ command, error: message, exitCode: code,
      ...(spent?.length ? { ledger: spent } : {}), ...(kept ? { failureDir: kept } : {}) }, null, 2) + "\n");
    else {
      io.err(`✗ ${message}\n`);
      // ⚠️ 渲染**共用** `failureSiteNote` / `formatSpentCalls` —— 两个壳的输出必须说同一件事
      //   （别在这里再写一份：2026-09-30 那两份拷贝就漂过一次）。
      if (kept) io.err(`\n${failureSiteNote(kept)}\n`);
      if (spent) io.err(`\n${formatSpentCalls(spent)}\n`);
    }
    return code;
  }
}

// 只有直接执行时才跑（被 import 时不跑，测试要用）
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  process.exit(await run(process.argv.slice(2)));
}
