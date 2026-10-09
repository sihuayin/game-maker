// **`createGame`：一条链串起来**（票 15 的落点；`docs/v2/03-claude-code.md §25` + R8）。
//
// ⚠️ 本包是**唯一**把新包串起来的地方（R11 的依赖图）—— 而它**够不着 `demo`**
//   （白名单里没有）：**站点装配不在这一层**，它归 CLI/MCP（票 16）。
//
// ⚠️ **两段，不是一段**（票 15 的 Q5）：检查点（R9）落在清单处，所以：
//   `runUnderstanding` 跑到 `asset-recipe.json` 为止并**定稿**（`run/v<N>/`）；
//   人在那一刻**改的就是磁盘上那一份**；`runBuild` 再把清单**从磁盘读回来**往下走。
//   ⚠️ 构建段**只吃 `runDir`** —— 这是 invariant 3「recipe 磁盘真相」的落点：
//     它**没有**内存里那份旧清单可以误用。
//
// ⚠️ **版本号由父（本层）显式分配、子步骤禁止自行计算**（票 15 的 Q16/Q17）：
//   首次 attempt 与 run 的 N 对齐，之后每次新 attempt 取下一个包版本 —— 而**算这个数的是这里**，
//   传给 `packAssets` 的 `version` 是**给它**的，它自己不许再算一遍。
import fs from "node:fs";
import path from "node:path";
import {
  CommandError, formatIssues, parseAssetPack, parseGameConfig, parseRecipe, QAReportSchema, qaVerdict,
  RUN_LEDGER_FORMAT, summarizeCalls,
  type AssetPackManifest, type AssetRecipe, type CharacterDNAFile, type GameConfig, type GameDesignSpec,
  type GameIntentSpec, type LedgerCall, type QAReport, type QaRunner, type RunLedger,
  type RuntimeProfileRef, type VisualWorldSpec,
} from "@game-maker/contracts";
import { analyzeReference } from "@game-maker/vision";
import { analyzeIntent, compileCharacterDna, compileDesign } from "@game-maker/game-design";
import { compileRuntime, nextPackVersion, packAssets, planAssets, type ImageTransport } from "@game-maker/assets";
// ⚠️ **合成器是这一层的默认值**（票 20 的 Q3）：`packages/qa` 的白名单只有 `contracts`，
//   而两个壳**不许**依赖它（`check-deps.mjs` 的 `ALLOWED`）⇒ 够得着它的**只有本包**，
//   而本包与 `qa` 那条边从票 07 起就画在图里了（今天它第一次被用上）。
import { qaRunner } from "@game-maker/qa";
import { RUN_ARTIFACT, flattenPlannerOutput, injectCharacterRef, jstr, readRunJson, writeIntentMd, writeJson, writeVisualWorld } from "./artifacts.js";
import { abandonRun, commitRun, openRun, parseRunVersion, type RunIdentity } from "./run.js";

/** 两个上下游的口子（与各步自己的形状一致：`{baseUrl, apiKey}`）。 */
export type Transport = { baseUrl: string; apiKey: string };

/** 进度的**步**（票 15 的 Q6：步级，不是逐调用）。⚠️ 两段各报自己那几步。 */
export const UNDERSTANDING_STEPS = ["visual-world", "intent", "design", "character-dna", "recipe"] as const;
export const BUILD_STEPS = ["pack", "config", "qa"] as const;
export type CreateStep = (typeof UNDERSTANDING_STEPS)[number] | (typeof BUILD_STEPS)[number];
export type Progress = { step: CreateStep; index: number; total: number; detail?: string };

export type UnderstandingInput = {
  outRoot: string;
  /** 原始需求文本（原样字节进 `intent.md`）。 */
  requirement: string;
  /** 风格参考图登记。第一阶段恰好 1 项（R18 的 `maxItems` 由**调用方**执行，不写进 schema）。 */
  styleReferences: readonly { path: string; role: string }[];
  /** 文本上游（理解层那五发都要它）。 */
  transport: Transport;
  /**
   * 风格身份的**覆盖口**（票 08 的 R2-Q2：「参考图 basename 的 slug，由 CLI 生成」，
   * 而票 08 的播下把「`--style-id` 是覆盖口」留给了票 16）。不给就由 basename 推。
   * ⚠️ 它进 VWS 时是**强制覆盖**（模型照抄、这里换掉）—— 与 `style.id` 那条同款。
   */
  styleId?: string;
  /** 哪一代外壳。省略 ⇒ 注册表里那一个。 */
  runtimeProfile?: RuntimeProfileRef;
  fetchImpl?: typeof fetch;
  onProgress?: (p: Progress) => void;
  /** 参考图路径相对谁解析（默认 `process.cwd()`）。 */
  cwd?: string;
};

/** 第一段写下的那几项（相对 `outRoot`）。 */
export type UnderstandingPaths = {
  runDir: string; intentMd: string; visualWorld: string; gameIntent: string;
  gameDesign: string; characterDna: string; recipe: string;
};

/** 第二段写下的那几项。⚠️ `qaReport` 缺席 = **QA 没跑**（不是「跑了没问题」）。 */
export type BuildPaths = {
  runDir: string; packDir: string; config: string; qaReport?: string; ledger: string;
};

/**
 * **QA 那一格**（票 15 的 Q7/Q12 立的口子，票 20 定的默认值）。
 *
 * ⚠️ **不给 = 跑默认的合成器**（`packages/qa` 的 `qaRunner`）—— 不是「缺席」。
 *   票 15 当年把「不给 ⇒ 缺席」写成扩展点，理由是「`packages/qa` 还是空骨架（票 17-20）」；
 *   **那个理由在票 20 关掉的那一刻消失了**：三个族都在，而终点要求
 *   `run/v<N>/qa-report.json` **必须**在产物里。
 * ⚠️ **关掉它要显式写 `null`**，不能靠省略 —— `??` 那条又短又顺的写法**恰好**会把 `null`
 *   也换成默认值，于是「我只想测构建段」的调用方**以为**自己关掉了，而实际上没有。
 */
export type QaOption = QaRunner | null;

export type UnderstandingResult = {
  run: RunIdentity;
  visualWorld: VisualWorldSpec;
  intent: GameIntentSpec;
  design: GameDesignSpec;
  characterDna: CharacterDNAFile;
  recipe: AssetRecipe;
  /** 这一步写下的那几项（**相对 `outRoot`** 的路径 —— 与 `CommandResult` 同一条规矩）。 */
  paths: UnderstandingPaths;
  ledger: LedgerCall[];
};

export type BuildInput = {
  outRoot: string;
  /** 那次运行的目录（绝对路径，或相对 `outRoot`）。 */
  runDir: string;
  /** 文本上游（drawlist 那一支要它）。 */
  transport: Transport;
  /** 生图上游。⚠️ 清单里有 `image` 资源而这里没给 ⇒ `packAssets` 会在开跑前拒（usage）。 */
  imageTransport?: ImageTransport;
  concurrency?: { text?: number; image?: number };
  /**
   * **QA 那一格**（票 20 的 Q3）：不给 ⇒ 跑 `@game-maker/qa` 的合成器；`null` ⇒ **关掉**。
   * ⚠️ 两个壳（CLI / MCP）**不许**依赖 `qa` ⇒ 它们**只能**走默认值这条路；
   *   显式传一个 runner 的口子是留给**测试**与将来的替换者的。
   */
  qa?: QaOption;
  fetchImpl?: typeof fetch;
  onProgress?: (p: Progress) => void;
  sourceDateEpoch?: number;
  /** 外壳视口 / HUD 行高（票 14：**外壳的常量**，由壳那一侧传）。省略用 `assets` 的默认值。 */
  viewport?: { w: number; h: number };
  hudLineHeight?: number;
};

export type BuildResult = {
  gameId: string;
  runDir: string;
  runVersion: number;
  packVersion: number;
  manifest: AssetPackManifest;
  config: GameConfig;
  /** ⚠️ **缺席 = 没跑**（调用方显式写了 `null`）—— 不是「跑了但没问题」。 */
  qa?: QAReport;
  paths: BuildPaths;
  ledger: LedgerCall[];
};

/** 检查点（R9）那一刻给调用方看的东西：定稿的 run 目录 + **磁盘上那份清单**。 */
export type CheckpointContext = { runDir: string; recipePath: string; recipe: AssetRecipe };

export type CreateInput = UnderstandingInput &
  Omit<BuildInput, "outRoot" | "runDir" | "transport"> & {
    /**
     * **检查点**（R9 / 票 15 的 Q5）：给了就在「清单已定稿、构建还没开始」那一刻调它一次。
     * CLI 在这里问人（`--yes` 就不传）；**MCP 无交互 ⇒ 不传** ⇒ 等于自动跳过。
     * ⚠️ 它拿到的 `recipePath` 是**磁盘上那一份** —— 人在那一刻改的就是它，
     *   而构建段**重新从磁盘读**（invariant 3）。
     */
    onRecipe?: (ctx: CheckpointContext) => void | Promise<void>;
  };
/** ⚠️ 两段各有 `paths` ⇒ 这里**并起来**（两边的键不同，撞不上）。 */
export type CreateResult = Omit<UnderstandingResult, "paths"> &
  Omit<BuildResult, "gameId" | "runDir" | "runVersion" | "paths"> & {
    paths: UnderstandingPaths & BuildPaths;
  };

const rel = (outRoot: string, p: string): string => path.relative(outRoot, p).split(path.sep).join("/");
const why = (e: unknown): string => (e instanceof Error ? e.message : String(e));
/** ⚠️ `CommandResult.data` 是 `Record<string, unknown>`（两个壳都要它可序列化）⇒ 这一处收窄由我们负责。
 *  形状由 `asLedger` 保证（`LedgerCall | null` ⇒ `LedgerCall[]`）。 */
const ledgerOf = (data: Record<string, unknown>): LedgerCall[] => {
  // ⚠️ 两个键都要认：`planAssets` / `compileRuntime` 给的是 `ledger: asLedger(...)`（一发一笔），
  //   而 `packAssets` 给的是 `ledgerCalls`（**整个数组** —— 生图那几发都在里面）。
  const v = data["ledgerCalls"] ?? data["ledger"];
  return Array.isArray(v) ? (v as LedgerCall[]) : [];
};

/**
 * 这一格到底跑不跑（票 20 的 Q3）。
 *
 * ⚠️ **「没给」与 `null` 要分得开**：`input.qa ?? qaRunner` 那一行又短又顺，而它**恰好**
 *   会把 `null` 也换成默认值 —— 读起来像「`null` 关掉了 QA」，实际没有。
 *   ⇒ 先认 `null`，再兜默认值。
 */
const qaRunnerOf = (q: QaOption | undefined): QaRunner | undefined =>
  q === null ? undefined : q ?? qaRunner;

/**
 * **判据失败 ⇒ 阻断**（R3 · 票 20 的 Q4）。
 *
 * ⚠️ 闸看的是 **`failures` 里的 `error`**，**不是 `qaVerdict`** —— 后者今天**恒为
 *   `incomplete`**（`checked` 恒 5/6：第六条「层覆盖」不属于任何族，它由装配期的硬失败保证，
 *   见契约 §四①）。拿 `verdict !== "pass"` 当闸，会让**每一次**运行都红，
 *   而那不是判据响了 —— 是「还有一条没查」被读成了失败。⚠️ 它**不是**失败：那是**说真话**。
 *
 * ⚠️ 文案里**不能**出现「再抽一次」：判据说的是**产物**的问题（设计 / 清单 / 包 / 配置），
 *   而重抽一次改不了那些事实（与 `compileRuntime` 的业务校验同一条纪律）。
 * ⚠️ **报告路径要带上**：走异常那一路也丢不掉它（票 20 的 Q5 的明确要求）。
 */
function assertQaPassed(report: QAReport, reportPath: string): void {
  const hard = report.failures.filter((f) => f.severity === "error");
  if (hard.length === 0) return;
  throw new CommandError(
    "invalid",
    `QA 判据没过（${hard.length} 条硬失败，${qaVerdict(report)}）：\n`
    + hard.slice(0, 8).map((f) => `  · [${f.judgement}] ${f.target}：${f.detail.replace(/\n/g, "\n      ")}`).join("\n")
    + `\n⚠️ 报告已经落盘：${reportPath} —— 那是这一次运行的**诊断**，不是「再抽一次」的理由：`
    + "判据说的是**产物**的问题，重抽改不了那些事实。\n"
    + "   要去的地方：设计层 / 资源清单 / 包（不是上游模型）。",
  );
}

/** 风格身份 = 参考图 basename 的 slug（票 08 的 R2-Q2：**由调用方生成**，模型照抄、这里强制覆盖）。 */
export function styleIdOf(referencePath: string): string {
  const base = path.basename(referencePath, path.extname(referencePath)).toLowerCase();
  const slug = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug === "" ? "style" : slug;
}

/**
 * **第一段：理解**（世界 → 意图 → 设计 → 基因 → 清单），到清单定稿为止。
 *
 * ⚠️ **它自己 `commitRun`** —— 因为检查点的落点就是「**已经定稿的 run**」：
 *   人要在那一刻看到 `run/v<N>/asset-recipe.json` 并可能改它。
 * ⚠️ 失败 ⇒ `abandonRun`（**改名留现场、不删**），现场里是**已经跑完那几步**的产物。
 */
export async function runUnderstanding(input: UnderstandingInput): Promise<UnderstandingResult> {
  const cwd = input.cwd ?? process.cwd();
  const t0 = Date.now();
  const run = openRun(input.outRoot);
  const ledger: LedgerCall[] = [];
  const total = UNDERSTANDING_STEPS.length;
  let gameId: string | undefined;
  const say = (step: CreateStep) =>
    input.onProgress?.({ step, index: UNDERSTANDING_STEPS.indexOf(step as never) + 1, total });

  try {
    // ⚠️ **输入先落地**（原样字节）：它是复现一次运行的前提，与任何上游调用无关。
    writeIntentMd(run.tmpDir, input.requirement);

    say("visual-world");
    const world = await analyzeReference({
      styleReferences: input.styleReferences as { path: string; role: string }[],
      requirementText: input.requirement,
      styleId: input.styleId ?? styleIdOf(input.styleReferences[0]!.path),
      // ⚠️ 那几条相对路径**相对谁**由调用方说 —— 而 `createGame` 的那个 `cwd` 与**进程**的
      //   可以不是同一个（测试里就不是）⇒ 一路传下去，别让 core 读全局状态。
      cwd,
      transport: input.transport,
      ...(input.fetchImpl !== undefined ? { fetchImpl: input.fetchImpl } : {}),
    });
    ledger.push(...(world.ledger ?? []));
    const vws = writeVisualWorld(run.tmpDir, world.spec, cwd);

    say("intent");
    const intent = await analyzeIntent({
      requirementText: input.requirement,
      transport: input.transport,
      ...(input.fetchImpl !== undefined ? { fetchImpl: input.fetchImpl } : {}),
    });
    ledger.push(...(intent.ledger ?? []));
    writeJson(path.join(run.tmpDir, RUN_ARTIFACT.gameIntent), intent.spec);

    say("design");
    // ⚠️ 这一步可能抛 `DesignRejectedError`（R12：**那份设计做不出来**）——
    //   那是**一条结论**，不是「模型没干好」；本层照原样放它过去（两个壳各自渲染它）。
    const design = await compileDesign({
      intent: intent.spec,
      vws: world.spec,
      ...(input.runtimeProfile !== undefined ? { runtimeProfile: input.runtimeProfile } : {}),
      transport: input.transport,
      ...(input.fetchImpl !== undefined ? { fetchImpl: input.fetchImpl } : {}),
    });
    ledger.push(...(design.ledger ?? []));
    writeJson(path.join(run.tmpDir, RUN_ARTIFACT.gameDesign), design.spec);

    say("character-dna");
    const dna = await compileCharacterDna({
      design: design.spec,
      vws: world.spec,
      transport: input.transport,
      ...(input.fetchImpl !== undefined ? { fetchImpl: input.fetchImpl } : {}),
    });
    ledger.push(...(dna.ledger ?? []));
    writeJson(path.join(run.tmpDir, RUN_ARTIFACT.characterDna), dna.file);

    say("recipe");
    // ⚠️ 规划那一步是**文件进出**的（它吃 `designPath` / `visualWorldPath`，写 `<id>/recipes/`）——
    //   所以这里把它指到 staging，而**不是**给它一个不存在的 run 目录（那时 id 还不知道）。
    const planned = await planAssets({
      designPath: path.join(run.tmpDir, RUN_ARTIFACT.gameDesign),
      visualWorldPath: path.join(run.tmpDir, RUN_ARTIFACT.visualWorld),
      outRoot: run.tmpDir,
      transport: input.transport,
      ...(input.fetchImpl !== undefined ? { fetchImpl: input.fetchImpl } : {}),
    });
    ledger.push(...ledgerOf(planned.data));

    // ── 清单：注入 `characterRef`（Q13）→ **重过契约** → 摊平并改名 ──────────
    const recipeFile = path.join(run.tmpDir, planned.artifacts[0]!.path);
    const injected = injectCharacterRef(readRunJson(run.tmpDir, path.relative(run.tmpDir, recipeFile)) as Record<string, unknown>);
    const checked = parseRecipe(injected);
    if (!checked.ok)
      throw new Error(
        `清单过不了契约（注入 \`characterRef\` 之后又验了一遍）：${checked.errors.slice(0, 4).join("；")}`,
      );
    gameId = checked.value.id;
    flattenPlannerOutput(run.tmpDir, gameId, recipeFile);
    writeJson(path.join(run.tmpDir, RUN_ARTIFACT.recipe), injected);

    const identity = commitRun(run, gameId);
    writeRunLedger(identity, ledger, Date.now() - t0);
    return {
      run: identity,
      visualWorld: vws,
      intent: intent.spec,
      design: design.spec,
      characterDna: dna.file,
      recipe: checked.value,
      paths: {
        runDir: rel(input.outRoot, identity.dir),
        intentMd: rel(input.outRoot, path.join(identity.dir, RUN_ARTIFACT.intentMd)),
        visualWorld: rel(input.outRoot, path.join(identity.dir, RUN_ARTIFACT.visualWorld)),
        gameIntent: rel(input.outRoot, path.join(identity.dir, RUN_ARTIFACT.gameIntent)),
        gameDesign: rel(input.outRoot, path.join(identity.dir, RUN_ARTIFACT.gameDesign)),
        characterDna: rel(input.outRoot, path.join(identity.dir, RUN_ARTIFACT.characterDna)),
        recipe: rel(input.outRoot, path.join(identity.dir, RUN_ARTIFACT.recipe)),
      },
      ledger,
    };
  } catch (e) {
    // ⚠️ **失败留现场**（image-route-v1 的 ①）：改名、不删；现场路径挂在异常上（与 `pack` 同款，
    //   两个壳各自渲染）—— 里面是**已经跑完那几步**的产物，看一眼就知道断在哪一步。
    const site = abandonRun(run, { why: why(e), ...(gameId !== undefined ? { gameId } : {}) });
    if (site !== undefined) (e as { failureDir?: string }).failureDir = site;
    throw e;
  }
}

/**
 * **第二段：构建**（清单 → 包 → 配置 → QA）。
 *
 * ⚠️ **只吃 `runDir`**：清单、风格、参考图、基因**一概从磁盘读回** —— R10「人可改」要的就是这个。
 * ⚠️ **两条判据**（票 15 的 Q11）：① 清单里的 `id` 与运行目录的 `gameId` **不一致 ⇒ 拒**；
 *   ② 照跑 `parseRecipe`（清单可能被人改过）。
 * ⚠️ **QA 默认跑**（票 20 的 Q3）：`input.qa` 省略 ⇒ 用 `@game-maker/qa` 的合成器；
 *   显式 `null` ⇒ 关掉。它的硬失败在**报告落盘之后**抛 `invalid`（见 `assertQaPassed`）。
 */
export async function runBuild(input: BuildInput): Promise<BuildResult> {
  const runDir = path.isAbsolute(input.runDir) ? input.runDir : path.join(input.outRoot, input.runDir);
  const runVersion = parseRunVersion(runDir);
  const gameId = path.basename(path.dirname(path.dirname(runDir)));

  const recipePath = path.join(runDir, RUN_ARTIFACT.recipe);
  const parsed = parseRecipe(readRunJson(runDir, RUN_ARTIFACT.recipe));
  if (!parsed.ok)
    throw new Error(
      `清单过不了契约（人改过的那一份也算）：${parsed.errors.slice(0, 4).join("；")}`,
    );
  // ⚠️ **invariant 1（Run 身份）**：目录名就是这次运行的身份，而 `pack`/`site` 都按清单的 `id`
  //   建自己的树 ⇒ 不一致会把**同一次运行的产物劈到两个 gameId 下**。
  if (parsed.value.id !== gameId)
    throw new Error(
      `清单里的 \`id\`（"${parsed.value.id}"）与这次运行的目录名（"${gameId}"）**不一致**。\n` +
      "⚠️ 目录名是这次运行的身份，而 `pack` / `site` 都按清单的 `id` 建自己的树 —— " +
      "不一致会把同一次运行的产物劈到两个 gameId 下。⇒ 要么把清单改回来，要么**重开一次运行**。",
    );

  // ⚠️ **首次 attempt 与 run 的 N 对齐**（Q16 β / Q17）：包目录还没被这一次运行占过，就用同一个 N；
  //   已经被占过（人改过清单再跑 / 上一次构建成功过）⇒ **由这里**分配下一个 N 并**显式传下去**。
  const packVersion = fs.existsSync(path.join(input.outRoot, gameId, "pack", `v${runVersion}`))
    ? nextPackVersion(input.outRoot, gameId)
    : runVersion;

  const t0 = Date.now();
  const ledger: LedgerCall[] = [];
  const runner = qaRunnerOf(input.qa);
  const total = BUILD_STEPS.length + (runner === undefined ? -1 : 0);
  const say = (step: CreateStep) =>
    input.onProgress?.({ step, index: BUILD_STEPS.indexOf(step as never) + 1, total });

  say("pack");
  const packed = await packAssets({
    recipePath,
    outRoot: input.outRoot,
    transport: input.transport,
    version: packVersion,
    // ⚠️ **包内那份 VWS**（Q15 α）：与清单同目录 ⇒ 这是一个常数相对路径。
    visualWorldPath: RUN_ARTIFACT.visualWorld,
    ...(input.imageTransport !== undefined ? { imageTransport: input.imageTransport } : {}),
    ...(input.concurrency !== undefined ? { concurrency: input.concurrency } : {}),
    ...(input.fetchImpl !== undefined ? { fetchImpl: input.fetchImpl } : {}),
    ...(input.onProgress !== undefined
      ? { onProgress: (done, all, assetId) => input.onProgress!({ step: "pack", index: 1, total, detail: `${assetId}（${done}/${all}）` }) }
      : {}),
  });
  ledger.push(...ledgerOf(packed.data));
  const packDir = path.join(input.outRoot, packed.artifacts[0]!.path);

  say("config");
  // ⚠️ 配置编译器也是**文件进出**的（它写 `<outRoot>/<id>/game-configs/`）—— 同样先落 staging，
  //   再把那一个文件搬进 run（§13 要的是 `run/v<N>/game-config.json`）。
  //   ⚠️ **它是「最新一次 attempt 的」那一份**：重跑构建会覆盖它（run 的目录名不再变），
  //   而历次 attempt 各自的配置本来就能从各自的包重编译出来（派生量，不丢信息）。
  const staging = fs.mkdtempSync(path.join(input.outRoot, ".config-"));
  let configPath: string;
  try {
    const compiled = await compileRuntime({
      designPath: path.join(runDir, RUN_ARTIFACT.gameDesign),
      packDir,
      outRoot: staging,
      transport: input.transport,
      ...(input.fetchImpl !== undefined ? { fetchImpl: input.fetchImpl } : {}),
      ...(input.viewport !== undefined ? { viewport: input.viewport } : {}),
      ...(input.hudLineHeight !== undefined ? { hudLineHeight: input.hudLineHeight } : {}),
    });
    ledger.push(...ledgerOf(compiled.data));
    const produced = path.join(staging, compiled.artifacts[0]!.path);
    configPath = path.join(runDir, RUN_ARTIFACT.config);
    fs.renameSync(produced, configPath);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }

  // ⚠️ 两份都**从磁盘读回来**（Q6 的「对象 + 路径都给」里那半个「对象」）：
  //   它们刚刚才被写下去，而读回来的那个形状才是**判据认过**的那一份。
  const manifest = parseAssetPack(readRunJson(packDir, "manifest.json"));
  if (!manifest.ok) throw new Error(`包里的 manifest 读不回来：${manifest.errors.slice(0, 3).join("；")}`);
  const config = parseGameConfig(readRunJson(runDir, RUN_ARTIFACT.config));
  if (!config.ok) throw new Error(`刚写下的 config 读不回来：${config.errors.slice(0, 3).join("；")}`);

  // ── QA：**默认跑**（票 20 的 Q3），而它的硬失败**阻断**（R3 · 票 20 的 Q4）──────────
  let qa: QAReport | undefined;
  if (runner !== undefined) {
    say("qa");
    // ⚠️ **四份产物的路径逐个传**（票 19 的 Q4/Q11）：QA 不自己拼文件名 ——
    //   那九个名字的家是本模块的 `RUN_ARTIFACT`，而 `packages/qa` 的白名单只有 `contracts`。
    const produced = await runner({
      runDir, packDir, gameId,
      configPath: path.join(runDir, RUN_ARTIFACT.config),
      intentPath: path.join(runDir, RUN_ARTIFACT.gameIntent),
      designPath: path.join(runDir, RUN_ARTIFACT.gameDesign),
      recipePath: path.join(runDir, RUN_ARTIFACT.recipe)
    });
    // ⚠️ **先过一遍它自己的契约**（票 20 的 Q4 的第 2 步）：落一份**过不了 schema** 的报告，
    //   等于让下游（修复循环）拿到它解析不了的东西 —— 而今天不炸，只因为没人 parse 它。
    //   ⚠️ 这一条**不是**给模型兜底的：报告是我们自己拼的 ⇒ 不过就是**我们的 bug**，
    //     所以文案里不说「再去抽一次」。
    const checkedReport = QAReportSchema.safeParse(produced);
    if (!checkedReport.success)
      throw new CommandError("invalid",
        "装配出来的 QA 报告过不了 `qa-report/v1` —— ⚠️ 这是本仓库自己的 bug，不是模型的："
        + `${formatIssues(checkedReport.error).slice(0, 4).join("；")}`);
    qa = checkedReport.data;
    // ⚠️ **落盘在阻断之前**（票 20 的 Q4 定死的顺序）：报告是判据的**产出**，也是这一次运行的
    //   **诊断** —— 判据说不行了，正是最该读它的时候。
    //   ⚠️ 与「配置过不了校验就**不落盘**」那条不冲突：坏配置是**输入**，报告是**诊断**。
    const qaReportPath = path.join(runDir, RUN_ARTIFACT.qaReport);
    writeJson(qaReportPath, qa);
    assertQaPassed(qa, rel(input.outRoot, qaReportPath));
  }

  // ⚠️ **链级并集**（Q14）：理解段那几发 ∪ 这一次构建的（包 + 配置）。
  //   包那份 `ledger.json` 照旧是**包的收据**（跟包走、被 verify 校验）—— 两者口径不同，见契约的文件头。
  const prior = readRunLedger(runDir);
  const union = [...prior, ...ledger];
  writeRunLedger({ gameId, version: runVersion, dir: runDir }, union, Date.now() - t0);

  return {
    gameId, runDir, runVersion, packVersion,
    manifest: manifest.value,
    config: config.value,
    ...(qa !== undefined ? { qa } : {}),
    paths: {
      runDir, packDir,
      config: path.join(runDir, RUN_ARTIFACT.config),
      ...(qa !== undefined ? { qaReport: path.join(runDir, RUN_ARTIFACT.qaReport) } : {}),
      ledger: path.join(runDir, RUN_ARTIFACT.ledger),
    },
    ledger: union,
  };
}

/**
 * **一次完整的创建**（§25）：两段串起来。
 *
 * ⚠️ **检查点是可选的糖**：给了 `onRecipe` 就在清单定稿之后停一下（CLI 在两段之间问人）；
 *   **MCP 无交互** ⇒ 不传它 ⇒ 直接串完（等于自动跳过检查点）。
 */
export async function createGame(input: CreateInput): Promise<CreateResult> {
  const understanding = await runUnderstanding(input);
  input.onRecipe?.({
    runDir: understanding.run.dir,
    recipePath: path.join(understanding.run.dir, RUN_ARTIFACT.recipe),
    recipe: understanding.recipe,
  });
  const built = await runBuild({
    outRoot: input.outRoot,
    runDir: understanding.run.dir,
    transport: input.transport,
    ...(input.imageTransport !== undefined ? { imageTransport: input.imageTransport } : {}),
    ...(input.concurrency !== undefined ? { concurrency: input.concurrency } : {}),
    ...(input.qa !== undefined ? { qa: input.qa } : {}),
    ...(input.fetchImpl !== undefined ? { fetchImpl: input.fetchImpl } : {}),
    ...(input.onProgress !== undefined ? { onProgress: input.onProgress } : {}),
    ...(input.sourceDateEpoch !== undefined ? { sourceDateEpoch: input.sourceDateEpoch } : {}),
    ...(input.viewport !== undefined ? { viewport: input.viewport } : {}),
    ...(input.hudLineHeight !== undefined ? { hudLineHeight: input.hudLineHeight } : {}),
  });
  return { ...understanding, ...built, paths: { ...understanding.paths, ...built.paths } };
}

// ── `run/v<N>/ledger.json`（链级那份，票 15 的 Q14）──────────────────────────
// ⚠️ 它**不是**包里那份的拷贝/缩略：两份**口径不同**（见 `run-ledger.ts` 的文件头）。
//   而它与包里那份**同一条纪律**：`byStep` 只记**发生过的**步。

function writeRunLedger(run: RunIdentity, calls: readonly LedgerCall[], wallClockMs: number): void {
  const doc: RunLedger = {
    format: RUN_LEDGER_FORMAT,
    gameId: run.gameId,
    runVersion: run.version,
    createdAt: new Date().toISOString(),
    run: { wallClockMs, byStep: summarizeCalls(calls) },
    calls: [...calls],
  };
  fs.writeFileSync(path.join(run.dir, RUN_ARTIFACT.ledger), jstr(doc));
}

/** 读回 run 里已有的那几笔（构建段要把它们与本次构建的并起来）。⚠️ 读不回来 ⇒ 当成空（第一次构建）。 */
function readRunLedger(runDir: string): LedgerCall[] {
  const p = path.join(runDir, RUN_ARTIFACT.ledger);
  if (!fs.existsSync(p)) return [];
  try {
    const doc = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<RunLedger>;
    return Array.isArray(doc.calls) ? doc.calls : [];
  } catch {
    return [];
  }
}
