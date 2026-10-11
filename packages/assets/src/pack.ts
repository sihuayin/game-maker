// 资源包的**组装**：清单 + StyleSpec → 一个完整的包目录（票 38）。
//
// 这是产物 A 的出口。它把三块拼起来：
//   编译器后端（票 21：光栅化 / 量化 / 图集 / PNG）
//   人工导入通道（票 23）
//   清单与包的契约（票 24 / 27 / 28 / 37）
//
// ⚠️ **本模块不自己去调 LLM。** `source.kind === "generate"` 的资源走**注入的**生成器端口 ——
// 这样组装逻辑可以完全离线测试，而[票 22](../…/issues/22-asset-generator.md) 的实现有一个明确的插口。
// 把网络调用埋在组装里，会让「包为什么长这样」这件事无法被测试。
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  ASSET_PACK_FORMAT, COVERAGE_FORMAT, LEDGER_FORMAT, MASTER_RATIOS_FILE, MASTER_RATIOS_FORMAT,
  derivePackMode, imageUnitsOf, paletteBindingOf, summarizeCalls,
  type AssetPackManifest, type AssetSpec, type AuthoringAsset, type CharacterDNA, type CharacterDNAFile,
  type DrawList, type ImageUnit, type Ledger, type LedgerCall, type MasterRatio, type StyleSpec, type VisualWorldSpec,
} from "@game-maker/contracts";
import { buildAtlas } from "./atlas.js";
import { backgroundCoverage } from "./coverage.js";
import { emptyImage, inkBBox, type RasterImage } from "./image.js";
import { dominantOpaqueColor, foregroundBlocks, importFrames, keyBackground, l1Distance, sliceGrid, type Box } from "./import.js";
import { segmentRowCells } from "./sheet.js";
import { framePlan, imageNegativePrompt, imagePrompt, keyColorFor } from "./prompt.js";
import { MASTER_SOURCES, masterNegativePrompt, masterPrompt, masterRatioLine, masterRatioReading } from "./master.js";
import type { ImageGenCall, ImageGenerator } from "./image-gen.js";
import { encodePNG, decodePNG } from "./png.js";
import { rasterize } from "./raster.js";

/** drawlist 的生成端口。**由票 22 提供实现**；本模块只调用。 */
export type DrawListGenerator = (spec: AssetSpec, style: StyleSpec) => DrawList[] | Promise<DrawList[]>;

/** 生图端口。**由调用方提供实现**（本模块只调）。一个资源一次调用、出一张原图。 */
// ⚠️ 生图端口**只有一份定义**，在 `image-gen.ts`（它才是那个客户端的家）——
//   这里只是**用**它。曾经这里抄过一份同形的（`GenerateImage`），而两份同形的类型会漂，
//   漂的那一天就是「这里多一个参数、那里没跟上」（2026-09-30 票 06 差一点就是）。

export type BuildPackOptions = {
  // ⚠️ **这是一份结构子集**（不是 `AssetRecipe` 本身）—— 它只列「组装真正要读的」那些格。
  //   ⚠️ 因此它是一处**手抄的镜像**：配方那侧加一个组装要读的字段，这里也得加
  //   （票 11 记下过这个坑：`AssetSourceLike` 与契约的 `AssetSource` 是两份）。
  recipe: {
    id: string;
    styleRef: string;
    referenceImage?: string;
    /** ⚠️ **创作态母版**（票 13 才开始真的被读）—— 在它之前这个字段**够不着** `pack`。
     *  它**不进交付包**：下面只迭代 `assets`，母版只活在 `authoring/` 那一侧（票 04 的结构性保证）。 */
    authoring?: readonly AuthoringAsset[];
    assets: readonly { spec: AssetSpec; source: AssetSourceLike }[];
  };
  style: StyleSpec;
  /** 产物根目录。**必填** —— 产物不属于任何单个包（票 29），由调用方定。
   *  实际写入 `outDir/<recipe.id>/pack/v<N>/`。 */
  outDir: string;
  /**
   * 配方文件所在的目录。**必填**，理由与 `outDir` 同款：不给它，`source.ref`
   * 就只能按 `process.cwd()` 解析 —— 那是一份**隐式的全局状态**，
   * 于是「同一个包在哪个目录里跑」会决定它读得到哪张图。
   *
   * ⚠️ 契约（`recipe.ts` 的 `InputPath`）写的是「**相对于配方文件**解析」。
   * 此前只有 `styleRef` 遵守了这条，`source.ref` 是按 cwd 解析的 ——
   * 同一个文件里两条路径两种规则，而错的那条只有真跑导入资源时才会暴露
   * （仓库里此前的包要么全是 `generate`，要么导入资源的 ref 恰好写成了
   * cwd 相对才碰巧能跑）。
   */
  recipeDir: string;
  generate: DrawListGenerator;
  /** 清单里有 `kind: "image"` 的资源时必填，否则**开跑前**就失败（不静默跳过）。 */
  generateImage?: ImageGenerator;
  /**
   * **调用方显式指定的包版本号**（票 15 的 Q16/Q17 那条正式规则）。
   * 给了就**绝不自算** —— 「子树版本号一律由父运行显式给定，**子步骤禁止自行计算**」。
   * 不给（单跑 `pack`）才落到 `nextPackVersion`。
   * ⚠️ 它与「失败不消耗版本号」是一对：`.building-<pid>-<version>` 只有在 `renameSync` 那一刻
   *   才变成 `pack/v<version>`，中途挂掉 ⇒ 现场改名 `failed-<ts>`，那个 N **没被用掉**。
   */
  version?: number;
  /**
   * 这个世界的 `VisualWorldSpec`（票 15 的 Q15 α）：给了就**拷一份进包**
   * （`authoring/visual-world.json`），让包自描述到**类型化视图**那一层
   * （`StyleSpec` 只是文字转述，拿不回 `camera.mode` 这类封闭枚举）。
   *
   * ⚠️ **不动 `provenance`**：它是 `.strict()`，加一格就是升版（`assetpack/v2 → v3`），
   *   而升版会**判死磁盘上那份入库的 v2 包**（`fixtures/packs/…`）—— 纯**增加一个文件**
   *   不需要动契约：`files[]` 是 `walk(packDir)` 穷举 ⇒ 它自动进 checksum 覆盖。
   */
  visualWorld?: VisualWorldSpec;
  /**
   * 角色的**基因**（票 13）。**给了才用** —— 不给就整条回落（提示词照旧用 `spec.description`），
   * 所以磁盘上那 8 份 fixture 与「人给一张参考图」那条老路**一字不改**。
   *
   * ⚠️ 读文件、拼路径是**调用方**的活（与 `recipe` / `style` 同款）—— 本模块不读清单之外的东西。
   * ⚠️ 两条边界：**没给文件** ⇒ 回落（不是错）；**给了文件却查不到那个 `characterId`** ⇒ 抛
   *   （文书自相矛盾 —— 静默回落就是「画了一个别的角色」）。
   */
  characterDna?: CharacterDNAFile;
  /** 覆盖 `createdAt`（可复现构建）。不给则读 `SOURCE_DATE_EPOCH`，再不给用当前时间。 */
  sourceDateEpoch?: number;
  /**
   * 并发上限（票 47）。**按上游分别定** —— 不给就用 `DEFAULT_CONCURRENCY`。
   * ⚠️ 设成 1 就是旧的串行行为（对照实验用得上）。
   */
  concurrency?: { text?: number; image?: number };
  /**
   * 一次运行的账（票 45）。给了就往包根写一份 `ledger.json`。
   * ⚠️ 传进来的是一个**调用方也持有的数组** —— 文本那一路的调用由**生成器**直接记进来
   *   （`createDrawListGenerator({onCall})`），生图那一路由本函数追加。
   *   两边写同一个数组，就不会有「两份账」。
   */
  ledger?: LedgerCall[];
  generator?: { name: string; version: string; run?: string };
  /** 逐资源的进度回报（MCP 的 `notifications/progress` 用它，票 30）。 */
  onProgress?: (done: number, total: number, assetId: string) => void;
};

type AssetSourceLike =
  | { kind: "drawlist" }
  // ⚠️ **没有 `prompt`**（票 35 的 Q1）：提示词**始终**由 `imagePrompt()` 派生，覆盖那个口子
  //   已从契约里删掉（`recipe.ts`）—— 这份手抄镜像跟着一起删，否则模型不给、这里却仍写着可选，
  //   下一个人会以为它活着。
  | { kind: "image"; reference?: string; background?: { tolerance: number }; alphaThreshold?: number | null }
  | {
      kind: "import"; ref: string;
      sheet?: { columns: number; rows: number; frameWidth: number; frameHeight: number; offsetX?: number; offsetY?: number; spacingX?: number; spacingY?: number; names: string[]; animations?: { name: string; frames: string[] }[] };
      background?: { tolerance: number };
      alphaThreshold?: number | null;
    };

export type BuildPackResult = {
  manifest: AssetPackManifest;
  packDir: string;
  /** 生图调用的事实记录（几个资源、几次调用、各自多久）—— 这是**钱**的账，交调用方报出来。
   *  ⚠️ 票 13 之后这里**也含创作态母版**那几发（`master: true`，`assetId` 是**母版 id**）。 */
  imageCalls: ({ assetId: string; master?: true } & ImageGenCall)[];
  /** spec ↔ 产物的对账结果（`auditAssetSpec`）。**有内容不等于失败** —— 交调用方决定。 */
  audit: string[];
  /**
   * **母版那几发的比例读数**（票 39）。⚠️ 它是**观察**那一侧的东西：不阻断、不打分。
   * ⚠️ **含匹配的那些**（`match: true`）—— 只报不匹配的话，人分不清「这次全对」与「这次压根没量」。
   * 顺序按 `authoring[]`。⚠️ **`import` 的母版不在里面**：它不调上游，而它对不上是**硬错**
   * （根本走不到这里）。这里只记「上游回图」这一类。
   */
  masterRatios?: MasterRatio[];
  /** 写进包的那份账（票 45）。没传 `ledger` 进来就是 undefined。 */
  ledger?: Ledger;
};

/** `#rrggbb` → `[r,g,b]`。⚠️ 色板落盘前已规范化成小写，这里不做兼容性猜测。 */
/** 配方那侧的一层 → 交付清单那侧的一层。⚠️ **`description` 剥在这里**（票 02）。 */
const toPackLayer = (l: { name: string; parallax: number; tileable?: { x: boolean; y: boolean } }) => ({
  name: l.name, parallax: l.parallax, ...(l.tileable ? { tileable: l.tileable } : {}),
});

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];

/**
 * 并发上限的**默认值**（票 47）。⚠️ **按上游分别定** —— 限流是**上游**的属性，不是一个全局数。
 *
 * · **文本**（DeepSeek via 代理想）：上游的限额**查不到**，所以取一个保守值，
 *   并且它只是**客户端**的并发数（真正的限额在代理那一侧，超了就是 HTTP 429/500）。
 * · **生图**：票 34 实测千问那条是 **RPS 5 / 并发 5**；OpenAI 那一支没查到，
 *   但一次调用就是一笔钱，取更保守的值。
 *
 * ⚠️ 两个都可以用 `BuildPackOptions.concurrency` 覆盖 —— 数字是**实测挑出来的**，
 *   不是定律（见票 47 的 Answer 里那张串行/并行对照表）。
 */
export const DEFAULT_CONCURRENCY = { text: 4, image: 3 } as const;

/**
 * 一个最简单的**信号量**：最多放 `limit` 个进去，其余的排队。
 * ⚠️ 排队是 FIFO —— 不这样做的话，晚提交的任务可能先跑，而**顺序在调上游时是有意义的**
 *   （同一批调用打在同一个上游上，先来先服务才是上游期待的样子）。
 */
function semaphore(limit: number, stop: { error: unknown }) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function gate<T>(fn: () => Promise<T>): Promise<T> {
    if (stop.error) throw stop.error;
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      // ⚠️ **排到队之后再查一次** —— 排队期间可能已经有一次调用失败了。
      //   这一句就是「失败之后不再花钱」的落点：在途的那几笔拦不住（钱已经出去了），
      //   但**还没发出去的**必须拦住。票 19 Q2 的另一半是「已经花掉的要报出来」（票 46）。
      if (stop.error) throw stop.error;
      return await fn();
    } catch (e) {
      // ⚠️ **必须记在 `catch` 里，不能记在外层**：`finally` 会**先唤醒下一个排队者**，
      //   而那时外层的 catch 还没跑 —— 于是一个「还没失败」的世界把它又放了一笔出去。
      //   实测差的正好是一笔（上限 2、8 个资源，发出去了 3 笔）。
      stop.error ??= e;
      throw e;
    } finally { active -= 1; waiting.shift()?.(); }
  };
}

const sha256 = (b: Buffer) => "sha256:" + createHash("sha256").update(b).digest("hex");
const jstr = (o: unknown) => JSON.stringify(o, null, 2) + "\n";

/**
 * 色板规范化：小写 `#rrggbb`、不得重复（票 24 Q3）。
 * 重复色会让 `palette:N` 与 `palette:M` 等价 —— 那不是「风格问题」，是契约问题，直接失败。
 *
 * ⚠️ **2026-10-11（票 29）导出**：它**从 `packAssets` 起也被人调**，用来把磁盘上那份
 *   `stylespec.json` **规范化在前、过 schema 在后**（票 29 的 Q2 裁定 (c)：契约管**规范形式**、
 *   入口管**接受形式**）。⇒ **本函数是色板规范化的唯一一份**，别再写第二份 ——
 *   票 29 之前它已经是「`PaletteSchema` 那一半的第二份实现」，两把尺子只在大写上分歧。
 */
export function normalizePalette(palette: readonly string[]): string[] {
  const out = palette.map((c) => c.toLowerCase());
  for (const c of out) if (!/^#[0-9a-f]{6}$/.test(c)) throw new Error(`色板里有非规范色值 "${c}"（要求小写 #rrggbb）`);
  const seen = new Set<string>();
  for (const c of out) { if (seen.has(c)) throw new Error(`色板里有重复色 ${c} —— palette:N 会变得含糊`); seen.add(c); }
  return out;
}

/**
 * **绝不覆盖**：扫出已有的最高版本，用它的下一个。
 *
 * ⚠️ **契约束（票 18）：调用方必须保证同一个 `outDir` 的写入者串行。**
 * 这个函数读－改－写之间**没有锁**：两个进程同时进来会算出同一个版本号。
 * 这不是待修的 bug，是一个**被记录的约束** —— 今天没有并发路径（CLI 单次调用、
 * MCP 是 stdio 短进程、生成是串行的），加锁是为不存在的并发付分布式锁的复杂度，
 * 而写错的锁比没有锁更糟（会静默地不互斥）。并发真的进范围时，从这里开始改。
 *
 * ⚠️ 另一条隐含前提：`buildInto` 的「先建 `.building-*` 工作目录、成功后再 `renameSync`」
 * **要求工作目录与最终目录在同一个文件系统**（跨设备 rename 会 EXDEV 失败）。
 * 今天靠「两者都在 `outDir` 下」隐式成立。
 */
export function nextPackVersion(outDir: string, packId: string): number {
  const dir = path.join(outDir, packId, "pack");
  if (!fs.existsSync(dir)) return 1;
  const versions = fs.readdirSync(dir).map((d) => /^v(\d+)$/.exec(d)).filter((m): m is RegExpExecArray => m !== null).map((m) => Number(m[1]));
  return versions.length === 0 ? 1 : Math.max(...versions) + 1;
}

/** `UiSpec.ninePatch`（四边内缩）→ TexturePacker 的 `scale9Borders`（中央矩形）。**只此一处**。 */
function scale9Of(spec: AssetSpec): { x: number; y: number; w: number; h: number } | null {
  if (spec.kind !== "ui" || !spec.ninePatch) return null;
  const { left, right, top, bottom } = spec.ninePatch;
  return { x: left, y: top, w: spec.size.w - left - right, h: spec.size.h - top - bottom };
}

/** 失败时把现场留在哪 —— 挂在那条异常上，`packAssets` 会把它搬进 `CommandError`。 */
export type FailureSite = { failureDir?: string };

/**
 * **失败现场**：把工作目录**改名**留下，而不是删掉（2026-09-30 · 票 01）。
 *
 * ⚠️ 原图与逐字提示词是**一张一落**的（见下面 `u.raw` 那两行）—— 失败那一刻，
 *   **已经付过钱的创作态就躺在工作目录里**。原来这里是 `rmSync`（为了不堆积），
 *   于是「一次网络抖动」把几笔真金白银的调用变成零：实测两次，
 *   GPT 6 笔 · 约 19 分钟、Gemini 4 笔 · 约 9.5 分钟，**产物为零**。
 *
 * ⚠️ **为什么改名、不留 `.building-*`**：那个名字带 pid、又是**点开头的隐藏目录**
 *   （`ls` 里直接消失）—— 正是这个仓库最防的那种「错得安静」。`failed-<时间戳>` 认得出是哪一次。
 *   ⚠️ 它**是失败现场不是包** ⇒ 不占「绝不覆盖」的版本号（「失败不消耗版本号」照旧成立），
 *   也不会被 `verify` / `inspect` 误认成包（那两个命令要显式传目录）。
 *
 * ⚠️ **同一份配方只留最近一次**：它的语义是「给你**上一份**失败现场」，不是「给你一部失败史」。
 *   （原来那条 `rmSync` 就是怕堆积 —— 那条担心仍然成立，只是答案从「全删」换成「只留一份」。）
 */
/** 这棵目录树里有**任何一个文件**吗（全是空目录也算空）。 */
function hasAnyFile(dir: string): boolean {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }))
    if (e.isDirectory() ? hasAnyFile(path.join(dir, e.name)) : true) return true;
  return false;
}

function keepFailureSite(opts: BuildPackOptions): string | undefined {
  const gameDir = path.join(opts.outDir, opts.recipe.id);
  if (!fs.existsSync(gameDir)) return undefined;
  // 按**前缀**找那份工作目录（不重算版本号 —— 那是 `buildInto` 开头算的，重算多一个可能对不上的数）
  const prefix = `.building-${process.pid}-`;
  const scratch = fs.readdirSync(gameDir).find((d) => d.startsWith(prefix));
  if (scratch === undefined) return undefined;
  const scratchDir = path.join(gameDir, scratch);
  // ⚠️ **空的现场没什么可保的**：一笔调用都还没成功就挂掉时，那棵树里一个文件都没有
  //   —— 留下来只是垃圾（原来那条 `rmSync` 怕的正是这个）。这一条把「不堆积」
  //   与「保住创作态」同时做到：**有东西才留，而且只留最近一份**。
  if (!hasAnyFile(scratchDir)) { fs.rmSync(scratchDir, { recursive: true, force: true }); return undefined; }
  for (const d of fs.readdirSync(gameDir))
    if (d.startsWith("failed-")) fs.rmSync(path.join(gameDir, d), { recursive: true, force: true });
  const dest = path.join(gameDir, `failed-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.renameSync(scratchDir, dest);
  return dest;
}

export async function buildAssetPack(opts: BuildPackOptions): Promise<BuildPackResult> {
  try {
    return await buildInto(opts);
  } catch (e) {
    // ⚠️ **失败不删**（票 01）—— 留下的那份里是已经付过钱的原图与逐字提示词。
    //   （「失败不消耗版本号」是另一半 —— 见 buildInto 末尾那一步改名。）
    const failureDir = keepFailureSite(opts);
    if (failureDir !== undefined) (e as FailureSite).failureDir = failureDir;
    throw e;
  }
}

async function buildInto(opts: BuildPackOptions): Promise<BuildPackResult> {
  // ⚠️ **墙钟**：人等了多久 —— 与各次调用的 ms 之和**是两个不相加的量**（票 19）。
  //   串行时恰好相等，并行（票 47）之后就不再相等，而**差正是并行的收益**。
  const runT0 = Date.now();

  const { recipe, style, outDir, generate } = opts;
  const palette = normalizePalette(style.palette);
  // ⚠️ **显式优先**（票 15 的 Q16/Q17）：调用方给了就**一个字节都不自算**。
  const version = opts.version ?? nextPackVersion(outDir, recipe.id);
  const finalDir = path.join(outDir, recipe.id, "pack", `v${version}`);
  // ⚠️ **先建在工作目录里，成功之后再改名过去。**
  //   否则一次失败的构建会留下一个半成品 `v<N>`，还白吃掉一个版本号 ——
  //   实测撞到过：连跑四次失败的构建，留下了 v1..v4 四个空目录。
  const packDir = path.join(outDir, recipe.id, `.building-${process.pid}-${version}`);
  fs.rmSync(packDir, { recursive: true, force: true });
  const rel = (p: string) => p.split(/[\\/]/).join("/");   // 包内路径一律 POSIX 正斜杠

  fs.mkdirSync(path.join(packDir, "delivery"), { recursive: true });
  fs.mkdirSync(path.join(packDir, "authoring", "drawlist"), { recursive: true });
  fs.mkdirSync(path.join(packDir, "authoring", "imported"), { recursive: true });
  // 生图产物的原图与提示词落在这里（这两个目录是**创作态**，与 imported/ 并列）
  fs.mkdirSync(path.join(packDir, "authoring", "generated"), { recursive: true });

  // ⚠️ **包内那份 `VisualWorldSpec`**（票 15 的 Q15 α）：写在**任何资产之前** ——
  //   `files[]` 是最后那一次 `walk(packDir)` 穷举，所以写在这里它自动进 checksum 覆盖，
  //   而 manifest 的 `provenance` **一个字都不动**（见那个字段的注释）。
  if (opts.visualWorld !== undefined)
    fs.writeFileSync(path.join(packDir, "authoring", "visual-world.json"), jstr(opts.visualWorld));

  type Built = { spec: AssetSpec; origin: "generated" | "imported"; paletteBinding: "exact" | "composited" | "quantized"; frames: { name: string; state?: string; image: RasterImage }[]; animations?: { name: string; frames: string[]; fps?: number; loop: boolean }[]; authoring: { kind: "drawlist" | "bitmap"; ref: string; original?: string }[] };
  /** 生图调用的账 —— 一次调用就是一笔钱，逐条记下来交调用方报出来。 */
  const imageCalls: ({ assetId: string; master?: true } & ImageGenCall)[] = [];

  // ⚠️ **并发跑**（票 47）：每一次调用只吃自己的 `spec` + StyleSpec。
  //   串行纯属浪费：实测 9 个资源串行 43.7s，而墙钟本可以贴着最慢的那一个走。
  //   ⚠️ **2026-10-05（票 11）：资源之间**开始**可能有序了** —— `spec.dependsOn` 是一条真的边。
  //     今天 8 份 fixture 里**一条都没有**，所以下面那条链在今天的输入上**恒等于全并发**；
  //     有依赖时才退化成「等前置」，而闸门与 `--concurrency` 的语义**一个字不变**。
  //
  // ⚠️ **两个闸门而不是一个**：限流是**上游**的属性。文本与生图是两个不同的上游
  //   （票 34：千问 RPS 5 / 并发 5；文本那侧查不到，取保守值），一个全局数会把
  //   「生图只能同时 3 个」错加到文本头上，或者反过来。
  // ⚠️ **失败即止**：串行时「第 5 个失败」只浪费掉前 4 个；并发之后若不管，
  //   `allSettled` 会等它们跑完，但**它们早就排进闸门了**，它们会照样发出去 ——
  //   钱在「已经知道失败了」之后继续烧。这个共享的失败信号就是那道闸。
  const stop: { error: unknown } = { error: null };
  const textGate = semaphore(opts.concurrency?.text ?? DEFAULT_CONCURRENCY.text, stop);
  const imageGate = semaphore(opts.concurrency?.image ?? DEFAULT_CONCURRENCY.image, stop);
  const built: Built[] = new Array<Built>(recipe.assets.length);

  // ── 母版前段（票 13 的 Q5）──────────────────────────────────────────────────
  //
  // ⚠️ **它是资产之前的一段独立前段，不进下面那张 DAG**：母版之间**没有依赖**（`AuthoringAsset`
  //   不收回指），而资产要的只是**它那张图** ⇒ 塞进 DAG 会让整包在第一个母版上串行，
  //   而它们本来可以并发跑（同一道生图闸门）。
  //
  // ⚠️ **失败语义照 `dependsOn` 抄、但只阻断该阻断的**（Q5 的原话：「只阻断引用失败 master 的 assets」）：
  //   · 母版失败**不**去踢那道共享的 `stop` 闸 —— 别的资产照造；
  //   · **引用它的**资产一个字节都不往外发（参考图不成立时发出去的那一笔是白花的钱）；
  //   · 而整包**仍然失败**（末尾把那条母版的病因抛出来）—— 失败了却不报，就是「错得安静」。
  const masterImages = new Map<string, RasterImage>();
  const masterFailure = new Map<string, string>();
  const authoringEntries = recipe.authoring ?? [];

  // ⚠️ **免费拦停**：三件「调用方/清单的错」，全部在**第一笔钱之前**（与 `dependsOn` 那条同一条规矩）。
  for (const a of authoringEntries) {
    if ((MASTER_SOURCES as readonly string[]).includes(a.source.kind)) continue;
    throw new Error(
      `母版 "${a.id}" 的 \`source.kind="${a.source.kind}"\` **没有实现**（票 13 的 Q1：只实现了 ` +
      `\`image\` 与 \`import\` 两条）。⚠️ \`drawlist\` 在契约里也合法，但母版**不是** \`AssetSpec\`，` +
      `画它的那条路要改生成器签名 —— 今天没人要，所以**没实现就喊**，不静默退回另一种画法。`);
  }
  if (authoringEntries.some((a) => a.source.kind === "image") && opts.generateImage === undefined)
    throw new Error('authoring[] 里有 source.kind="image" 的母版，但调用方没给 generateImage —— 这是**调用方的 bug**，不静默跳过');

  /** 这条 `characterId` 的基因。⚠️ **给了 DNA 文件却查不到 ⇒ 抛**（不是回落）：静默回落就是换了个角色。 */
  const dnaOrThrow = (characterId: string, who: string): CharacterDNA => {
    const hit = opts.characterDna?.characters.find((c) => c.id === characterId);
    if (hit !== undefined) return hit;
    throw new Error(
      opts.characterDna === undefined
        ? `${who} 的 characterId="${characterId}"，而调用方**没给 character-dna** ⇒ 这一张画不出来：` +
          "母版是**基因的一张渲染图**（票 04），没有基因就只剩一句人写的描述可照。"
        : `${who} 的 characterId="${characterId}" 在这份 character-dna.json 里**没有对家** —— ` +
          "⚠️ 文件给了、id 却查不到，是**文书自相矛盾**（不是「这个角色没有基因」那种回落）。");
  };

  // ⚠️ **资产的基因在开跑前一次算完**（免费）：`buildOne` 里那次查找若放在第一笔调用之后，
  //   一个写错的 id 就要等到钱花出去才被发现。
  const assetDna: (CharacterDNA | undefined)[] = recipe.assets.map((e) =>
    // ⚠️ **没给 DNA 文件 ⇒ 回落**（不是错）：8 份 fixture 与「人给一张参考图」那条老路照旧。
    opts.characterDna === undefined || e.spec.characterId === undefined
      ? undefined
      : dnaOrThrow(e.spec.characterId, `资产 "${e.spec.id}"`)
  );

  // ⚠️ **母版的基因同样在开跑前一次算完**（免费）：`image` 的母版是「基因的一张渲染图」，
  //   没有基因就画不出来 —— 而那该在**第一笔钱之前**知道（不是等别的资产都跑完了才报）。
  const masterDna = new Map<string, CharacterDNA>();
  for (const a of authoringEntries)
    if (a.source.kind === "image") masterDna.set(a.id, dnaOrThrow(a.characterId, `母版 "${a.id}"`));

  // ⚠️ **母版那几发的比例读数**（票 39）：`Map` 而不是数组 —— 并发下**回来的先后是随机的**，
  //   而落盘与汇总都要**按 `authoring[]` 的顺序**（与 `built[idx]` 同一条规矩）。
  const masterRatios = new Map<string, MasterRatio>();

  if (authoringEntries.length > 0) {
    fs.mkdirSync(path.join(packDir, "authoring", "masters"), { recursive: true });
    // 母版也看世界的风格图（它是这个世界的角色）—— 与资产那一发同一条路。
    const masterStyleRef = recipe.referenceImage
      ? decodePNG(fs.readFileSync(path.resolve(opts.recipeDir, recipe.referenceImage)))
      : undefined;
    await Promise.all(
      authoringEntries.map(async (a) => {
        try {
          const ref = `authoring/masters/${a.id}.png`;
          if (a.source.kind === "import") {
            // 人作（或上一次跑出来的）母版：一条路径。⚠️ 与资产的 `import` 同一条规则：**相对配方文件**解析。
            const img = decodePNG(fs.readFileSync(path.resolve(opts.recipeDir, a.source.ref)));
            // ⚠️ **这一条仍然是判据、仍然阻断**（票 39 的 Q4）—— 别把它跟着下面那条一起降掉：
            //   它比的两边**都不来自上游**（清单说这张图 32×24，而磁盘上那个文件不是）。
            //   ⇒ 免费、确定、错了**必是输入错** ⇒ R3 的准入条件它**合格**。
            const r = masterRatioReading(a.size, img);
            if (!r.match) throw new Error(masterRatioLine({ master: a.id, ...r }));
            fs.writeFileSync(path.join(packDir, ref), encodePNG(img));
            masterImages.set(a.id, img);
            return;
          }
          // `image`：DNA 的八个字段 + 世界风格 → 一张位图。⭐ 这就是「DNA → 母版」那条箭头。
          const dna = masterDna.get(a.id)!;   // ⚠️ 开跑前算好的（上面那次「免费拦停」）
          const prompt = masterPrompt({ master: a, dna, style, canvas: a.size });
          // ⚠️ **失败必须吞在闸门**里面**（Q5：只阻断**引用它的**资产）。
          //   那道 `imageGate` 是「失败即止」的共享信号（`semaphore` 的 `catch` 会
          //   `stop.error ??= e`）—— 从它里面抛出去 = **全包即止**，而 Q5 裁的是「只阻断引用它的那些」。
          await imageGate(async () => {
            try {
              // ⚠️ **发出即记**（与资产那一发同款）：这一笔已经花出去了 —— 它回不回来是另一回事。
              const rec: LedgerCall = { step: "master", target: a.id, attempts: 1 };
              opts.ledger?.push(rec);
              const { image, call } = await opts.generateImage!(
                {
                  prompt,
                  // ⚠️ **canonical 画布**（票 13 的 Q2：「size 是 canonical target；provider 尺寸是派生值」）
                  //   —— 上游那张尺寸表（`requestSize` / `geminiAspect` / `openaiSize`）由协议**自己**换算。
                  size: { w: a.size.w, h: a.size.h },
                  negativePrompt: masterNegativePrompt(),
                  ...(masterStyleRef ? { styleReference: masterStyleRef } : {}),
                },
                { onFailure: (f) => Object.assign(rec, f) }
              );
              Object.assign(rec, {
                upstream: call.protocol, ms: call.ms, attempts: call.attempts,
                ...(call.requestedSize !== undefined ? { requestedSize: call.requestedSize } : {}),
                ...(call.requestedModel !== undefined ? { requestedModel: call.requestedModel } : {}),
                ...(call.requestId !== undefined ? { requestId: call.requestId } : {}),
                ...(call.sourceHost !== undefined ? { sourceHost: call.sourceHost } : {}),
                ...(call.usage !== undefined ? { usage: call.usage } : {}),
              } satisfies Omit<LedgerCall, "step" | "target">);
              imageCalls.push({ assetId: a.id, master: true, ...call });
              // ⚠️ **比例降为观察**（票 39 的 Q1/Q4）：回来的图与 canonical 画布对不上**不再抛**。
              //   它量的是**上游的手气**（同一个 `2:3` 回来过三种画布），不是设计 ⇒ 按 R3 不够格当判据。
              //   ⚠️ **量法一个字没改**（`masterRatioReading` 仍是零容差整数判定），降的只是它的**后果**。
              //   ⚠️ 也**别**顺手把上面 `import` 支那条一起降了 —— 那一条不量上游。
              const ratio = { master: a.id, ...masterRatioReading(a.size, image) };
              masterRatios.set(a.id, ratio);
              fs.writeFileSync(path.join(packDir, ref), encodePNG(image));
              fs.writeFileSync(path.join(packDir, ref.replace(/\.png$/, ".prompt.txt")), prompt + "\n");
              // ⚠️ **量到就写**（票 39 的 Q1 选的是「逐张母版量到就写」）：包根那份汇总要等母版段
              //   全部跑完，而**这一份是扛得住失败的那一份** —— 后面任何一步抛了，`failed-<ts>/`
              //   现场里活下来的正是这种「随步落盘」的东西。⚠️ 第六跑现场实测：那一跑死在母版上，
              //   失败目录里**只有** `authoring/`（drawlist/generated/imported/**masters**）与一个空的
              //   `delivery/` —— `manifest.json` / `ledger.json` / `coverage.json` **一个都没有**
              //   （那三个都在 `pack` 末尾才写）。⇒ 想让「偏差仍可追溯」在失败里也成立，就得写在这儿。
              //   ⚠️ 它**自己就是一份完整的 `MasterRatios` 文档**（一条记录）⇒ 单看一个文件也读得懂、
              //     也被同一个 `parseMasterRatios` 认（与包根那份同形）。
              fs.writeFileSync(path.join(packDir, ref.replace(/\.png$/, ".ratio.json")), jstr({
                format: MASTER_RATIOS_FORMAT, packId: recipe.id, packVersion: version, masters: [ratio],
              }));
              masterImages.set(a.id, image);
            } catch (e) {
              // ⚠️ **吞在闸门里面**、只记在这一格 —— 不踢那道共享闸（见上）。
              masterFailure.set(a.id, e instanceof Error ? e.message : String(e));
            }
          });
        } catch (e) {
          // ⚠️ 闸门外那一层接的是**非调用**的错（读文件、写文件…）—— 同样只记、不往外抛。
          masterFailure.set(a.id, e instanceof Error ? e.message : String(e));
        }
      })
    );
  }

  // ── 母版比例的**汇总**（票 39 的 Q1 ②）────────────────────────────────────
  // ⚠️ **写在母版段之后、资产段之前** —— 再晚一点它就会跟包根那三个 sidecar 一样
  //   **只在整包成功时才存在**（第六跑现场：失败目录里一个 sidecar 都没有）。写在这儿，
  //   它是「母版段一跑完就有了」的那一份；而逐张那几份（`masters/<id>.ratio.json`）更早。
  // ⚠️ **顺序按 `authoring[]`**，不按回来的先后（并发下回来是随机的）。
  const masterRatioList = authoringEntries.flatMap((a) => {
    const r = masterRatios.get(a.id);
    return r === undefined ? [] : [r];
  });
  if (masterRatioList.length > 0)
    fs.writeFileSync(path.join(packDir, MASTER_RATIOS_FILE), jstr({
      format: MASTER_RATIOS_FORMAT, packId: recipe.id, packVersion: version, masters: masterRatioList,
    }));

  // ⚠️ **失败不立刻抛**（2026-09-30 · 票 05）：并发在飞的**已经付过钱** —— 等它们收尾，
  //   多救几张原图进失败现场，账也更准（发出即记那一条让「花了几笔」成为事实）。
  //   ⚠️ 不等还有第二个后果：失败那条 `renameSync` 先生效，还在飞的那笔随后往**旧路径**写
  //   ⇒ 报错，而它的产物永远进不了现场；工作目录那时若是空的，**连现场都不留**（整笔白花）。
  //   ⚠️ 等的上界是**现成的调用超时**（240–300s），不新拍一个数。
  // ⚠️ **依赖边（票 11 的 Q4）**：两道闸门只管「同时在飞几笔」，**不管顺序**；顺序在这里 ——
  //   每个资产挂一个**自己的 promise**，依赖它的那些先进来 `await` 它。
  //   ⚠️ **环不会到这儿**：`parseRecipe` 已经拒过（`recipe.ts` 的 superRefine）⇒ 这张图一定是 DAG，
  //     所以「互等的 promise 链」这种东西不存在。**契约判环 + pack 排序**是配套的两半。
  //   ⚠️ **依赖没造出来 ⇒ 这个资产一个字节都不往外发** —— 那正是这条边省下来的钱。
  const done = new Map<string, { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void }>();
  for (const e of recipe.assets) {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    // ⚠️ 没人 `await` 的那条失败**不许变成 unhandledRejection** —— 失败已经有 `allSettled` 收着。
    promise.catch(() => {});
    done.set(e.spec.id, { promise, resolve, reject });
  }
  const depFailure = new Map<string, string>();

  /** 造**一个**资产。⚠️ 抽成函数只是为了让外面能套一层「先等依赖」—— 里面的逻辑一个字没动。 */
  const buildOne = async (
    entry: { spec: AssetSpec; source: AssetSourceLike }, idx: number,
    /** 这个资产的角色的基因（票 13）。⚠️ **开跑前算好的**（`assetDna`）—— 这里不再查、不会抛。 */
    dna?: CharacterDNA
  ) => {
      const spec = entry.spec;
      opts.onProgress?.(idx, recipe.assets.length, spec.id);
      const plan = framePlan(spec);
      const frames: Built["frames"] = [];
      const authoring: Built["authoring"] = [];
      let origin: Built["origin"] = "generated";
      let binding: Built["paletteBinding"] = "exact";

      if (entry.source.kind === "drawlist") {
        // ⚠️ `async () =>` 不是多余的：`DrawListGenerator` 的返回是 `DrawList[] | Promise<DrawList[]>`，
      //   直接包一层会让闸门的泛型吃进那个**联合**（于是 await 完还剩一个 Promise）。
      const drawlists = await textGate(async () => generate(spec, style));
        if (drawlists.length !== plan.length)
          throw new Error(`资源 "${spec.id}"：清单说要有 ${plan.length} 帧，生成器给了 ${drawlists.length} 帧`);
        plan.forEach((p, i) => {
          const dl = drawlists[i]!;
          const dest = `authoring/drawlist/${p.name}.json`;
          // 落盘时**以清单给的名字为准**：生成器可能没写 `frame`，或写得跟清单不一致
          fs.writeFileSync(path.join(packDir, dest), jstr({ ...dl, id: spec.id, frame: p.name.split(".").slice(1).join(".") || p.name }));
          authoring.push({ kind: "drawlist", ref: dest });
          frames.push({ name: p.name, state: p.anim ?? undefined, image: rasterize(dl, { palette }) });
        });
        // 票 36：对 drawlist 资源，绑定关系是**解析期静态**的 —— 不需要渲染后再扫
        binding = drawlists.some((d) => paletteBindingOf(d.ops) === "composited") ? "composited" : "exact";
      } else if (entry.source.kind === "image") {
        const src = entry.source;
        if (!opts.generateImage)
          throw new Error(`资源 "${spec.id}" 是 source.kind="image"，但调用方没给 generateImage —— 这是**调用方的 bug**，不静默跳过`);
        origin = "generated";
        // 生图产物**同样过那条重建管线**（抠背景 → 裁框 → 降采样 → 二值化 → 量化），
        // 所以它与导入通道在结构上是同一种东西：都是「原生位图」这一创作态。
        binding = "quantized";
        // ⚠️ **底色是运行时确定性规则，不问清单要**（[票 35](35-multiframe-needs-background.md) ·
        //   2026-10-09）。删掉 `source.prompt` 之后，三份生图模板**每一次都会跑**，而它们**每一份**
        //   都从 `keyColorFor(palette)` 取底色、逐字告诉模型「背景必须是纯色 ${bg}」
        //   ⇒ **模型被告知的那个颜色是一个确定值**，于是 `pack` **自己就能算出同一个值**。
        //   让清单再声明一遍，就是把**同一个事实**放进第二个来源 —— 而实测那个声明**必被填错**
        //   （真跑 20 条 `image` 里模型自挑的底色落在 `(85,90,95)`，而色板里坐着
        //   `#5a5f6b = (90,95,107)` ⇒ 按容差抠会把角色**抠穿**）。
        //   ⚠️ **先例就是背景层**：它早就不问清单要颜色（直接注入 `colors: [hexToRgb(keyColorFor(palette))]`）。
        //   ⇒ `source.background` 今天**只装一个可选的 `tolerance`**（默认 30，与背景层同值）。
        //   ⚠️ **单帧也走这一条**（此前是四角取样，`import.ts:58-63`）：`singleObjectPrompt`
        //      逐字告诉过模型那个颜色，按它抠才是**兑现承诺**；四角取样是那句承诺之前的老办法。
        //   ⚠️ **`import` 那条路不走这里**（见下面 `else` 分支）：人给的 PNG **可能真的自带透明底**，
        //      `recipe.ts` 那句「不给就假定人已经给了透明底」是它自己的语义。这条不对称是**故意的**。
        const keyColor = hexToRgb(keyColorFor(palette));
        const bgOpt = { tolerance: src.background?.tolerance ?? 30, colors: [keyColor] };
        const declaredColors = bgOpt.colors;
        const isBg = spec.kind === "background";
        // ⚠️⚠️ **2026-10-10 · 票 37 就地更正上面那段「兑现承诺」**（带日期的注，不改原文）：
        //   那段推论的**前提被真跑实测证伪了** —— 模型**从不交付**那个声明色。
        //   第三次真跑 9/9 张图在容差 30 下抠到 **0 像素**，画面里离声明色最近的那个像素
        //   也差 L1 **118~334**（提示词里那句话说两到四遍，一次没听）。
        //   ⇒ **单帧 / 多帧改按「这张图上量出来的众数色」抠**（`dominantOpaqueColor`）；
        //     声明色**仍然要写进提示词**（它是在要求模型「把背景画成一块与角色无关的平涂」，
        //     这个作用实测是有效的），但它**不再是可依赖的交付物**。
        //   ⇒ 而**背景层保持原样**（仍按声明色抠）——那是票 35 决定表里的**另一行**，
        //     改不改"众数色"另开票（票 37 的 Q3）。
        // 世界的风格参考图（配方级）。给了就内联进每一次生图请求 —— 让模型**看着那个世界**画，
        // 而不是听一个文字转述（实测后者会走样成一张场景插画）。
        const styleReference = recipe.referenceImage
          ? decodePNG(fs.readFileSync(path.resolve(opts.recipeDir, recipe.referenceImage)))
          : undefined;
        // ⚠️ **参考图的两条路**（票 13）：`spec.masterAsset`（这个角色的母版，一个 **id**）
        //   或 `src.reference`（一张**路径**）。契约**不许两个都写**（票 13 的 Q4 那条免费拒），
        //   所以这里最多命中一条 —— 而「谁赢」这种问题因此根本不用答。
        const master = spec.masterAsset === undefined ? undefined : masterImages.get(spec.masterAsset);
        if (spec.masterAsset !== undefined && master === undefined)
          // ⚠️ **一个字节都不往外发**：照着一张不存在的参考图画是白花钱（与 `dependsOn` 那条同款）。
          throw new Error(
            `资产 "${spec.id}" 的母版 "${spec.masterAsset}" **没造出来**（${masterFailure.get(spec.masterAsset) ?? "原因未知"}）` +
            " —— ⚠️ 参考图不成立时发出去的那一笔是白花的钱（票 13 的 Q5）。");
        const reference = master ?? (src.reference
          ? decodePNG(fs.readFileSync(path.resolve(opts.recipeDir, src.reference)))
          : undefined);
        // ⚠️ **一个 unit 一次调用**，而「**怎么切**」**不在这里** —— 那是 `imageUnitsOf` 那把尺子
        //   （`@game-maker/contracts` · **票 40**）。⚠️ 抽它出来的理由：检查点报的那个数与这里
        //   真发出去的次数以前**各切各的**（检查点数 image 源**资产**数 = 11，这里真发 20 次），
        //   而检查点那个数**正是人批准付费跑时看的那个数**。
        //   ⚠️ 本文件**只补 `raw`** —— 落盘文件名是「包长什么样」，不是契约事实（票 40 的 Q2=A）。
        //   ⚠️ 而那把尺子的切法与 drawlist 路线的 `framePlan` **对称但粒度不同**
        //   （`game-creation-v1` 那张图的票 43：那边**一帧一份**，这边**一个动画一份**）：
        //   · animation → 一个**动画**一个 unit（实测把 14 帧塞进一次调用，模型只给回来 1 个角色）
        //   · 分层背景 → **一层**一个 unit（`game-creation-v1` 的票 40 撞到的那个洞：以前只出一张图，
        //     而 plan 有 N 项，`results[i]` 越界成 undefined，一路带到 buildAtlas 才炸成说不清哪里错的 TypeError）
        //   · 其余 → 一个资源一个 unit
        const rawName = (u: ImageUnit): string =>
          u.anim !== undefined ? `authoring/generated/${spec.id}.${u.anim}.png`
            : u.layer !== undefined ? `authoring/generated/${spec.id}.${u.layer.name}.png`
              : `authoring/generated/${spec.id}.png`;
        const units = imageUnitsOf(spec).map((u) => ({ ...u, raw: rawName(u) }));

        // ⚠️ **逐动画分批导入**：同一个动画内的帧必须共用裁框（那才是不抖的关键），
        // 而不同动画的补宽不一样，混一个数组交给 `importFrames` 会直接报尺寸不一致。
        // ⚠️ **抠底用的那个颜色跟着批次走**（票 37）：单帧/多帧是**逐张图量出来的**，
        //   同一个资源的两个动画（两张图）各有各的众数色 ⇒ 它不能像 `bgOpt` 那样写在资产一级。
        //   ⚠️ **`key === null` = 这一批不抠底**（票 38 的 Q1：最远层）—— 见下面 `flatMap`。
        const batches: { cells: RasterImage[]; key: [number, number, number] | null }[] = [];
        for (const u of units) {
          // ⚠️ **始终派生**（[票 35](35-multiframe-needs-background.md) 的 Q1）：此前是
          //   `src.prompt ?? imagePrompt(…)`，而真跑里 planner **每一条都填了** `src.prompt`
          //   ⇒ `imagePrompt()` 一次都没跑过，把「背景必须是纯色 ${bg}」「画布是 N 倍宽」
          //   「一排 N 个」那些话**整段丢掉**了。那个字段已经**从契约里删掉**
          //   （`recipe.ts` / `recipe-tool.ts`），所以这里没有 `??` 可写了 —— 形状上就不可能再覆盖。
          const prompt = imagePrompt(spec, style, {
            ...(u.anim === undefined ? {} : { anim: u.anim }),
            ...(u.layer === undefined ? {} : { layer: u.layer }),
            // ⚠️ **有 DNA 就把身份那一句换成基因的八个字段**（票 13 的 Q3，人类裁定「替换，不是叠加」）；
            //   没有 DNA（不是角色 / 调用方没给文件）就照旧用 `spec.description`。
            ...(dna === undefined ? {} : { dna }),
          });
          // ⚠️ 过**生图**那道闸 —— 一次调用就是一笔钱，别把它和文本调用共用一个上限
          // ⚠️ **发出即记**（2026-09-30 · 票 05）：这一笔**已经花出去了** —— 它回不回来是另一回事。
          //   先记一笔「已发出」（`ms` 缺席）。之后有**两条**收尾的路，都会把它补成事实：
          //     · **回来了**（成功）—— `ms` / `attempts` / `usage` 一并补上；
          //     · **失败了**（生成器内部重试完仍失败）—— 补上「烧了几轮、多久」（票 06）。
          //   ⚠️ 只有**两条都没走到**时才留着缺席（进程被杀），而那时**不许写 0 冒充「测到了 0」**（票 19 Q4）。
          //   ⚠️ `upstream` 也**先不写** —— 与 `ms` 同一条纪律：拿不到就缺席（协议要到调用方
          //   构造生成器时才知道，`buildAssetPack` 手里没有）。回来时一起补上。
          //
          //   ⚠️⚠️ **记在闸门「里面」，不是外面**：那道闸会**拒掉还没发出去的**排队调用
          //   （票 47「失败即止」），而**那几笔一分钱没花** —— 记在外面就会**多报**。
          //   （实测：4 个资源、并发 1、第一个就挂 ⇒ 上游只收到 **1** 笔，账上却写了 **4** 笔。
          //   那直接违反票 05 的判据：报出来的笔数 **===** 真实发出的笔数。）
          let rec: LedgerCall | undefined;
          const { image, call } = await imageGate(() => {
            rec = { step: "image", target: spec.id, attempts: 1 };
            opts.ledger?.push(rec);
            return opts.generateImage!({
              prompt, size: { w: spec.size.w * u.frames, h: spec.size.h },
              negativePrompt: imageNegativePrompt(),
              ...(styleReference ? { styleReference } : {}), ...(reference ? { reference } : {}),
            }, {
              // ⚠️ **失败也要交账**（2026-09-30 · 票 06）：这一笔**烧掉了几趟往返**是事实，
              //   而失败那条路上，生成器内部的重试此前**没有任何人记** —— 账上只剩一个「发出时的 1」。
              //   仓库的纪律：「重试烧掉的额度要能单独看见，**否则失败的归因是错的**」。
              //   ⚠️ 只补 `ms` / `attempts`：`model` / `usage` / `requestId` 拿不到就**缺席**，不编。
              onFailure: (f) => { if (rec) Object.assign(rec, f); },
            });
          });
          // 回来了：把这一笔**补成事实**（同一个对象 —— 账里仍是**一笔**，不是两笔）
          // ⚠️ **紧跟着 await 做**，别挪到后面去：落盘与「分块」那两段都会抛，
          //   一笔**已经回来了**的调用若卡在它们后面，就会一直停在 `ms` 缺席 ——
          //   而两个壳会把它印成「**还没回来**」，那是**假话**（账里那句定义：缺席 = 发出去了、还没回来）。
          // ⚠️ 走到这里 = 闸门**放行过**它 ⇒ `rec` 必然已经写上（闸门只做两件事：放行、或拒）
          // ⚠️ `satisfies` 不是装饰：`Object.assign` 会**丢掉对象字面量的多余属性检查**
          //   （把键名写错不再报错）。这一句把它找回来。
          if (rec) Object.assign(rec, {
            upstream: call.protocol, ms: call.ms, attempts: call.attempts,
            ...(call.requestedSize !== undefined ? { requestedSize: call.requestedSize } : {}),
            ...(call.requestedModel !== undefined ? { requestedModel: call.requestedModel } : {}),
            ...(call.requestId !== undefined ? { requestId: call.requestId } : {}),
            ...(call.sourceHost !== undefined ? { sourceHost: call.sourceHost } : {}),
            ...(call.usage !== undefined ? { usage: call.usage } : {}),
          } satisfies Omit<LedgerCall, "step" | "target">);
          // 原图落盘：它既是创作态，也是「那次调用到底给了什么」的唯一证据。
          fs.writeFileSync(path.join(packDir, u.raw), encodePNG(image));
          fs.writeFileSync(path.join(packDir, u.raw.replace(/\.png$/, ".prompt.txt")), prompt + "\n");
          // ⚠️ **底色必须真的被抠掉**（2026-09-30 · 票 03 立 · **票 35 的 Q9 补齐到单帧与多帧**）——
          //   抠不掉的后果不只是「该透明的地方留着底色」：这个 unit 的**不透明率会恒为 1**。
          //   · 对背景层：它**把后面那几层整个挡住**，而「最远层必须画满」那条门禁**反而通过**
          //     （抠不掉的东西全是不透明的 ⇒ 每一层看起来都是满的）。那是「错得安静」的正品。
          //   · 对多帧：整排角色**连成 1 块** —— 而分块靠的就是抠完之后的空隙。
          //
          //   ⚠️⚠️ **所以它必须判在分块之前**（2026-10-09 由测试抓出来的一处顺序错）：
          //   原来这段住在下面 `flatMap` 里（= 分块**之后**），于是底色不对时先响的是
          //   「检测到 1 块」—— **一句指错方向的错**，真因（「那个颜色根本不在这张图里」）
          //   一个字都没说到。判据的位置本身就是判据的一部分。
          //
          //   ⚠️ **票 38（2026-10-10）之后，这一段的样子变了** —— 那张票把「0 像素」这条哨兵
          //   换成了**两条结构判据**，而在**按众数色抠**的层上「0 像素」本来就**不可达**
          //   （众数色是图上出现最多的那个颜色 ⇒ 按它抠至少能抠到它自己那些像素）：
          //   · **单帧**：抠掉的是不是多数（`> 0.5`）+ 剩下的墨有没有被抠碎（最大块 `≥ 0.6`）。
          //   · **多帧**：帧数核对（`segmentRowCells` 切出几块）—— 它本来就是那条路上唯一的判据。
          //   · **最远背景层**：**不判** —— 它**有意不抠**（票 38 的 Q1），本来就该铺满。
          //   · **非最远背景层**：pack 侧**没有自己的判据**（票 38 的 Q3）——
          //     ⚠️ 于是「非最远层把整张场景画满」这一种错，今天**只有 `site.ts` 那条反向门禁**
          //     在守，而众数色抠底之后它**守不住**（众数色 = 天空 ⇒ 交付覆盖率 ≈ 0.6，
          //     落在 `ratio < FILLED` 的射程之外）。**这一条已知，记在地图的 `Not yet specified` 里**
          //     —— 别在这里随手补一条阈值：今天**画不出来**（正确的一侧只有 2 个真样本
          //     `0.481` / `0.478`，错的一侧一个真样本都没有）。
          //
          // ⚠️ **抠底用的那个颜色**（**票 37 的 Q1** · **票 38 的 Q1/Q3**）：
          //   · **单帧 / 多帧 / 非最远背景层 → 这张图上量出来的众数色**（一次算、整张图共用、
          //     不逐格估色；实测逐格各取众数与整图众数的 ΔL1 ≤ 3 ⇒ 「一张图一个底色」成立）。
          //   · **最远背景层 → 不抠**（下面 `farthest`）。
          const measured = dominantOpaqueColor(image);
          const unitKey: [number, number, number] = measured.color;
          // ⚠️ **一个不透明像素都没有**是另一回事，得单独说：那时众数色是"空集里的众数"（`[0,0,0]`），
          //   按它抠会把一张全透明的图抠得更空，后面每条判据都会**报出一个假的原因**。
          //   ⚠️ **这一条不再排除背景层**（票 38 的 Q3 去掉 `!isBg`）：最远层虽然不抠，它
          //   **必须铺满**（`site.ts` 那条 `FILLED` 门禁）—— 一张全透明的天空层是上游出事，
          //   不该被报成「抠底失败」（那是**指错方向**的错）。
          if (measured.opaquePixels === 0)
            throw new Error(
              `资源 "${spec.id}"${u.anim === undefined ? "" : ` 的动画 "${u.anim}"`} 生出来的图` +
              `**一个不透明像素都没有**（${image.width}×${image.height} 全透明）—— 没有底色可量。` +
              `⚠️ 这不是重试能解决的问题：要么上游挂了，要么它把「背景透明」理解成了「整张透明」。`);

          // ⚠️⚠️ **最远层有意不抠**（票 38 的 Q1）。`index` 由上面 `bgLayers.map((l, i) => …)`
          //   按**数组下标**发下去 ⇒ `index === 0` 就是**最远**那一层。
          //   · **为什么**：最远层本来就该铺满（天空 / 地平线）。实测三张真图 ——
          //     按众数色抠掉 26.3% / 31.4% / 38.7%，按四角取样抠掉 43.5% / 58.0% / 60.1%，
          //     而众数色在最远层上**就是它的内容本身** ⇒ 按它抠 = 把这一层自己抠掉。
          //     ⚠️ 今天「按声明色抠」没出事**只是因为模型不交付那个色**（5/5 在 T30 下 0 像素）——
          //     **碰巧对不算对**（票 37 判过的那种错）。
          //   · **怎么表达「不抠」**：递到 `importFrames` 那边**不传 `background`**，走它现成的
          //     `!opts.background` 原样返回那条路（`import.ts:345`）；降采样 / 二值化 / 量化
          //     **照常执行** —— 不抠只让这一层的 alpha 恒 255。
          //   · ⚠️ **本地的抠底读数也不该存在**：按众数色抠最远层会抠掉三成 —— 留一个
          //     `keyedPixels` 在那里，下一个人会以为这一层真被抠了那么多。那正是票 37 治的那个病
          //     （「我们声明了什么」被当成「模型交付了什么」的同款：把**没做的事**记成**做了**）。
          const farthest = isBg && u.layer !== undefined && u.layer.index === 0;
          const keyedProbe = farthest ? null : keyBackground(image, { tolerance: bgOpt.tolerance, colors: [unitKey] });
          /** 这张图的像素总数（判据的分母）。 */
          const pixels = image.width * image.height;

          /**
           * 「我们声明的」与「这张图上量到的」摆在一起（票 37 的 Q6：报错要报**实测**）。
           *
           * ⚠️ 覆盖率报的是**按实测众数色抠掉了多少**，不是那个颜色逐像素占多少：模型的底是
           *   一个**围绕众数色的云**（同族像素落在容差里）。实测 `treasure-chest` 众数色本身
           *   只占 2.7%，而按它抠掉了 **80.9%** —— 报前者会让人以为抠底失败了。
           * ⚠️ 声明色那一侧是**现算的**（只在抛错的路上跑一次，不花钱也不占常路）：实测 9/9 都是 0，
           *   但不写成写死的一句话 —— 那句话在「模型这次真交付了」的场合就是假的。
           */
          const colourReport = (m: typeof measured, keyedPixels: number, pixels: number) => {
            const declaredKeyed = keyBackground(image, { tolerance: bgOpt.tolerance, colors: declaredColors }).keyedPixels;
            return `我们告诉模型的是 [${declaredColors[0]!.join(", ")}]（容差 ${bgOpt.tolerance}，按它只抠到 ${declaredKeyed} 像素），` +
              `而这张图上**实测的众数色**是 [${m.color.join(", ")}]` +
              `（按它抠掉 ${((keyedPixels / pixels) * 100).toFixed(1)}% 的像素，与声明色差 L1 = ${l1Distance(m.color, declaredColors[0]!) }）`;
          };
          /** ⚠️ **不许给一个必然失败的建议**（票 37 的 Q6 删掉的那句「⇒ 重出这一张」正是反例）。 */
          const NOT_A_RETRY =
            "⚠️ **这不是重试能解决的问题** —— 第三次真跑 9/9 张都如此，而那个声明色在提示词里" +
            "写了两到四遍（含开头那句「最重要的一条，请先读它」）。重发一次，模型照样不交付它。";

          // ⚠️ **那条「背景层非最远层 0 像素即抛」的哨兵已经删掉**（票 38 的 Q3，2026-10-10）。
          //   它判的是「按**声明色**一个像素都没抠到」，而票 38 之后背景层不再按声明色抠 ——
          //   按**众数色**抠，那个条件是**不可达**的（众数色至少能抠到它自己那些像素，
          //   与单帧 / 多帧同款）。留一条不可达的哨兵，就是留一条**永远不会响的判据**，
          //   而下一个人会把它当成活的。⚠️ **票 17 的先例**：同一个事实不立两处 ——
          //   「非最远层太满」这件事住在 `site.ts` 那条反向门禁里，pack 侧不立第二份。
          //   ⚠️ **代价认下来了**：「非最远层把整张场景画满」这一种错今天**没有机械判据**
          //   （见上面那段）。它是**画面错**而不是结构错 ⇒ 属「只有人眼」那一类（R3）。

          // ⚠️⬇️⬇️ **单帧的两条结构判据**（票 37 的 Q1：「抠掉的是多数 + 剩下的连成一块」）——
          //   为什么要判「抠完之后过得去」，而不是只判「众数色量到了」：
          //   **众数色本身不是成功判据** —— 主体占多数时众数**就是主体**，按它抠 = 把主体当底抠掉。
          //   实测那 9 张的主体只占 10~20%（这个风格「大片留白」的巧合，**不是通用保证**）。
          if (!isBg && u.frames === 1) {
            // ⚠️ 这一支必然抠过底（`!isBg` ⇒ 不是最远层 ⇒ `keyedProbe` 非空）。
            const keyed = keyedProbe!;
            const keyedRatio = keyed.keyedPixels / pixels;
            // ① 抠掉的是不是**多数**（= 那个众数色确实在扮演"背景"）。
            if (keyedRatio <= 0.5)
              throw new Error(
                `资源 "${spec.id}" 的底色判据没过：按**实测众数色**抠，只抠掉 **${(keyedRatio * 100).toFixed(1)}%**` +
                ` 的像素（要求**超过一半**）。${colourReport(measured, keyed.keyedPixels, pixels)}。\n` +
                `⚠️ 一种可能是**主体自己就占了多数** —— 那时"众数色"就是主体，按它抠是把主体当底抠掉；\n` +
                `⚠️ 另一种可能是模型画的底**根本不是平涂**（渐变色带 / 噪点），单色众数只覆盖它的一部分。\n` +
                NOT_A_RETRY);
            // ② 剩下的墨有没有被抠碎 —— 主体应当还是**一块**。
            //    ⚠️ 那条线取 0.6 是**量出来的**，不是拍的：真图 `treasure-chest` 抠完剩**两块**
            //    （主体 156660px + 模型自己画的一圈洋红描边 40289px）⇒ 最大那块占 **79.6%**。
            //    照字面写「块数 === 1」会把这张**真图判成不合格** —— 下一跑当场白花钱。
            //    （边界见票 37 §8：**判据要挡得住真的错，不许把真图判死**。）
            const blocks = foregroundBlocks(keyed.image);
            if (blocks.largestShare < 0.6)
              throw new Error(
                `资源 "${spec.id}" 的底色判据没过：按**实测众数色**抠完，剩下的墨**碎成了 ${blocks.areas.length} 块**，` +
                `最大的一块只占 ${(blocks.largestShare * 100).toFixed(1)}%（要求 ≥ 60%）—— 主体多半被抠穿了。\n` +
                `${colourReport(measured, keyed.keyedPixels, pixels)}。\n` + NOT_A_RETRY);
          }
          const cells: RasterImage[] = [];
          // ⚠️ `key === null` = **这一批不抠底**（票 38 的 Q1：最远层）。递到 `importFrames`
          //   那边就是**不传 `background`**，走它现成的「原样返回」那条路（见下面 `flatMap`）。
          batches.push({ cells, key: farthest ? null : unitKey });
          if (u.frames === 1) { cells.push(image); }
          else {
            // ⚠️ 多帧必然抠过底（背景层恒为 1 帧 ⇒ 走到这里的不是背景层）。
            const keyed = keyedProbe!;
            // ⚠️ **按墨迹间隙分块**，不等分 —— 实测模型不按格子排版（见 sheet.ts 的文件头）。
            // ⚠️ 分块看的是 alpha，所以探针必须是**抠过背景**的那一份；原图（纯 RGB）每一列都有"墨"。
            // ⚠️ **探针与最终交付用的是同一个颜色**（`unitKey`）—— 票 35 时这里是「我们告诉模型的
            //   那个底色」，票 37 之后单帧/多帧改成了**这张图上量出来的众数色**。
            //   ⚠️ 两处一旦分家，就会出现「探针按 A 抠、交付按 B 抠」：分块数得对，出来的帧却是花的。
            const seg = segmentRowCells(image, keyed.image);
            if (seg.cells.length !== u.frames)
              throw new Error(
                `资源 "${spec.id}" 的动画 "${u.anim}"：spec 声明 ${u.frames} 帧，但在生成的图上**检测到 ${seg.cells.length} 块**。` +
                "生图模型的帧数不可信（实测要 6 给 5）。要么重出这张图，要么把 spec 的帧数改成它真能画出来的数量 —— " +
                "**不静默取前 N 个**，那会让 manifest 的帧名与动画分组对不上。\n" +
                // ⚠️ **把抠底那份读数一并附上**（票 35 §6 的老纪律：判据的位置本身就是判据的一部分，
                //   而**指错方向的错**比不报还贵）：块数不对也可能是**抠底本身出了事**
                //   —— 众数色若是主体，整排角色会被一起抠掉，那时先响的就是这条「检测到 1 块」。
                `⚠️ 抠底用的是**实测众数色** —— ${colourReport(measured, keyed.keyedPixels, pixels)}；` +
                `抠掉了 ${((keyed.keyedPixels / pixels) * 100).toFixed(1)}% 的像素。` +
                `若那个众数色其实是**主体**，整排角色会被一起抠掉，块数就会先错在这里。`,
              );
            cells.push(...seg.cells);
          }
          imageCalls.push({ assetId: spec.id, ...call });
        }
        // ⚠️ **背景走两条与「一件道具」不同的规矩**（票 43 · **票 38 改写了第①条**），
        //   都要在这里定，不能留给默认：
        //   ① **不四角取样** —— 背景层的角上就是内容本身（地面填满下半、墙填满中间那带），
        //      四角取样会把内容色当成底色，**整层抠光**。
        //      ⚠️ 票 37 之前这一条写的是「**按我们告诉模型的颜色抠**」—— **那个前提被真跑证伪了**
        //      （模型从不交付那个色）。今天它分两半：**非最远层**按**这张图上量出来的众数色**抠
        //      （那个颜色跟着批次走 —— `key`），**最远层压根不抠**（`key === null`，票 38 的 Q1）。
        //   ② **不裁框** —— 导入通道默认「裁到内容再拉到 spec.size」，对一件道具是对的
        //      （裁紧、归一化），对一层背景是**毁掉构成**：层里只画了上半，裁完拉满，
        //      层与层之间的空间关系就没了。
        //   ⚠️（票 35 之前这里还住着那条「底色一个像素都没抠到」的哨兵。它住错了地方 ——
        //     分块**在它前面**跑，于是底色不对时先响的是帧数核对。票 35 把它搬到分块之前，
        //     **票 38 把它整个删掉**：采众数色之后那个条件不可达。）
        //   ⚠️⚠️ **`background` 必须是那个 unit 自己的颜色**：`importFrames` 会**再抠一遍**
        //     （`prepareFrame` → `keyBackground`），而**这一遍才是最终交付的 alpha** ——
        //     传错颜色的话，上面那些判据全绿而交付出来的帧是花的。
        const results = batches.flatMap(({ cells, key }) => importFrames(cells, {
          palette, targetWidth: spec.size.w, targetHeight: spec.size.h,
          // ⚠️ **`key === null` 时整个 `background` 键都不出现**（票 38 的 Q1）—— 走
          //   `prepareFrame` 的 `!opts.background` 原样返回那条路。
          //   ⚠️ **不能传一个空 `colors: []`**：那会掉进 `keyBackground` 的四角取样兜底，
          //   把最远层抠掉 43~60%（实测三张真图）。
          ...(key === null ? {} : { background: { tolerance: bgOpt.tolerance, colors: [key] } }),
          ...(isBg ? { trim: false } : {}),
          ...(src.alphaThreshold !== undefined ? { alphaThreshold: src.alphaThreshold } : {}),
        }));
        const stateOf = new Map<string, string>();
        if (spec.kind === "animation") {
          let k = 0;
          for (const a of spec.animations) for (let i = 0; i < a.frames; i++) stateOf.set(plan[k++]!.name, a.name);
        }
        // ⚠️ **每一个 unit 的原图都要声明成创作态**，不是一个资源只声明第一张。
        //   票 43：分层背景**一层一张原图**，只记 `units[0]` 会让 manifest 说
        //   「这个背景的创作态是 `station.sky.png`」—— 而另外两层同样是它的创作态。
        //   （文件本来就在包里、也在 `files[]` 里，漏的只是这句**声明**。）
        for (const u of units)
          authoring.push({ kind: "bitmap", ref: u.raw, original: units.length > 1 ? `生图 · ${units.length} 次调用` : "生图" });
        plan.forEach((p, i) => {
          frames.push({ name: p.name, state: stateOf.get(p.name), image: results[i]! });
        });
      } else {
        // ⚠️ 先把 source 取出来再进闭包 —— 闭包里会丢掉判别式的收窄
        const src = entry.source;
        origin = "imported";
        binding = "quantized";   // 票 23 的裁决：导入位图默认量化到世界色板
        // ⚠️ 相对**配方文件**解析（`BuildPackOptions.recipeDir`），不是相对 cwd —— 见那个字段的注释
        const srcPath = path.resolve(opts.recipeDir, src.ref);
        const img = decodePNG(fs.readFileSync(srcPath));
        const names = src.sheet?.names ?? [spec.id];
        const crops = src.sheet ? sliceGrid(img, src.sheet) : [img];
        if (crops.length !== names.length) throw new Error(`资源 "${spec.id}"：网格切出 ${crops.length} 帧，清单给了 ${names.length} 个名字`);
        const animOf = new Map<string, string>();
        for (const a of src.sheet?.animations ?? []) for (const n of a.frames) animOf.set(n, a.name);
        // ⚠️ 全部帧**一次过** `importFrames`：它让各帧共用同一个裁框。
        // 逐帧各裁各的会让同一角色在帧间改变位置**与缩放**（`tw/th` 是从裁完的图推的），
        // 而且会让逐资源声明的 `spec.anchor` 每帧落在角色身上不同的位置。
        const imported = importFrames(crops, {
          palette, targetWidth: spec.size.w, targetHeight: spec.size.h,
          ...(src.background !== undefined ? { background: src.background } : {}),
          ...(src.alphaThreshold !== undefined ? { alphaThreshold: src.alphaThreshold } : {}),
        });
        names.forEach((name, i) => {
          const r = imported[i]!;
          const dest = `authoring/imported/${name}${path.extname(srcPath)}`;
          fs.writeFileSync(path.join(packDir, dest), encodePNG(crops[i]!));
          // `original` 写**清单里的原样字符串**（即相对配方文件的那个 ref），不写解析后的绝对路径：
          // 绝对路径会让 manifest 随机器与目录变，而「同一输入两次生成逐字节相同」是 checksum 的前提。
          authoring.push({ kind: "bitmap", ref: dest, original: rel(src.ref) });
          frames.push({ name, state: animOf.get(name), image: r });
        });
      }

      const animations = spec.kind === "animation"
        ? spec.animations.map((a) => ({
            name: a.name,
            frames: frames.filter((f) => f.state === a.name).map((f) => f.name),
            ...(a.fps !== undefined ? { fps: a.fps } : {}),
            loop: a.loop,
          }))
        : undefined;
      // 按下标落位 —— 并发下**完成顺序是乱的**，而 manifest 里的资源顺序必须稳定。
      built[idx] = { spec, origin, paletteBinding: binding, frames, ...(animations ? { animations } : {}), authoring };
  };

  const settled = await Promise.allSettled(
    recipe.assets.map(async (entry, idx) => {
      const spec = entry.spec;
      const mine = done.get(spec.id);
      try {
        for (const d of spec.dependsOn ?? []) {
          const up = done.get(d);
          if (up === undefined) continue; // 解不到的 id 由契约拒（这里不该发生）
          await up.promise.catch(() => {}); // 前置的失败由下一句报出来，别在这里炸
          const why = depFailure.get(d);
          if (why !== undefined)
            throw new Error(
              `前置资产 "${d}" 没造出来（${why}）—— "${spec.id}" **不再往下走**：` +
                "⚠️ 依赖不成立时发出去的那一笔是白花的钱（票 11 的 Q4）"
            );
        }
        const out = await buildOne(entry, idx, assetDna[idx]);
        mine?.resolve();
        return out;
      } catch (e) {
        depFailure.set(spec.id, e instanceof Error ? e.message : String(e));
        mine?.reject(e);
        throw e;
      }
    })
  );
  // ⚠️ 逐条看过再抛**第一条**失败 —— 取**清单顺序**，与「谁先挂」无关（并发下那个不可复现）
  const firstFailure = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (firstFailure) throw firstFailure.reason;
  // ⚠️ **母版失败也要说出来**（票 13 的 Q5）：它不踢那道共享闸、也只阻断引用它的资产 ——
  //   但**没人引用它**时若就这么过去，包会「成功」而清单里那张母版**根本没造出来**（错得安静）。
  const masterBad = [...masterFailure.entries()][0];
  if (masterBad !== undefined)
    throw new Error(
      `创作态母版 "${masterBad[0]}" 没造出来：${masterBad[1]}\n` +
      "⚠️ 引用它的资产已经**没有上路**（那几笔钱省下来了），而这一份包**不交付** —— " +
      "母版是创作态，但它缺失说明清单与这次构建对不上（票 13 的 Q5）。");

  // ── 按 kind 各打一份图集（票 24：四类的最优打包参数不同）──────────────────
  const ATLAS_NAME: Record<string, string> = { sprite: "sprites", animation: "animations", background: "backgrounds", ui: "ui" };
  const kinds = [...new Set(built.map((b) => b.spec.kind))].sort();
  const atlases: AssetPackManifest["atlases"] = [];
  const atlasIdOf = new Map<string, string>();
  for (const kind of kinds) {
    const group = built.filter((b) => b.spec.kind === kind);
    // ⚠️ 文件名带 `atlas.` 前缀 —— 票 24 定的 `delivery/atlas.<name>.json`。
    //    （曾经写成 `delivery/sprites.json`，与契约和草案实验都不一致。）
    const base = `atlas.${ATLAS_NAME[kind]!}`;
    const { json, image } = buildAtlas(group.flatMap((b) => {
      const s9 = scale9Of(b.spec);
      return b.frames.map((f) => ({ name: f.name, image: f.image, anchor: b.spec.anchor, ...(s9 ? { scale9Borders: s9 } : {}) }));
    }));
    json.meta.image = `${base}.png`;
    const png = encodePNG(image);
    fs.writeFileSync(path.join(packDir, "delivery", `${base}.json`), jstr(json));
    fs.writeFileSync(path.join(packDir, "delivery", `${base}.png`), png);
    const atlasId = ATLAS_NAME[kind]!;
    for (const b of group) atlasIdOf.set(b.spec.id, atlasId);
    atlases.push({ id: atlasId, kind, meta: `delivery/${base}.json`, image: `delivery/${base}.png`,
      size: { w: image.width, h: image.height }, frames: group.reduce((s, b) => s + b.frames.length, 0),
      assets: group.map((b) => b.spec.id).sort(), checksum: sha256(png) });
  }

  // ── 创作态入包 ────────────────────────────────────────────────────────────
  const styleDoc = jstr({ ...style, palette });
  fs.writeFileSync(path.join(packDir, "authoring", "stylespec.json"), styleDoc);

  // ── manifest ─────────────────────────────────────────────────────────────
  const epoch = opts.sourceDateEpoch ?? Number(process.env.SOURCE_DATE_EPOCH ?? Math.floor(Date.now() / 1000));
  const manifest: AssetPackManifest = {
    format: ASSET_PACK_FORMAT,
    id: recipe.id,
    version,
    createdAt: new Date(epoch * 1000).toISOString(),
    generator: { name: opts.generator?.name ?? "game-maker", version: opts.generator?.version ?? "0.0.0", ...(opts.generator?.run ? { run: opts.generator.run } : {}) },
    provenance: {
      // ⚠️ 派生规则只有一处（contracts 的 `derivePackMode`）—— 这里不许再写一份，
      //   否则写入侧与校验侧一漂移，合法的包会被判成「矛盾」。
      mode: derivePackMode(built.map((b) => b.origin)),
      style: { origin: "human-in-session", ref: "authoring/stylespec.json", stylespecId: style.id, checksum: sha256(Buffer.from(styleDoc)) },
    },
    palette: {
      ref: "authoring/stylespec.json#/palette", size: palette.length, values: palette,
      coverage: {
        exact: built.filter((b) => b.paletteBinding === "exact").length,
        composited: built.filter((b) => b.paletteBinding === "composited").length,
        quantized: built.filter((b) => b.paletteBinding === "quantized").length,
        // **恒为 0**：这条管线只有两条路 —— drawlist（exact / composited）与导入（quantized）。
        // `unbound` 是契约留给**别的**生产者的逃生舱（票 24），本管线不用它。
        unbound: 0,
      },
    },
    atlases,
    assets: built.map((b) => {
      const s9 = scale9Of(b.spec);
      return {
      id: b.spec.id, kind: b.spec.kind, role: b.spec.role, origin: b.origin,
      paletteBinding: b.paletteBinding, required: b.spec.required,
      // ⚠️ 尺寸取**实际产出**的，不是 spec 声明的 —— 对账时两者不一致才有意义
      size: { w: b.frames[0]!.image.width, h: b.frames[0]!.image.height },
      anchor: b.spec.anchor,
      // 分层背景的层表 —— 它是「资源固有性质」里**唯一**读不到于图集 JSON 的那一条
      // （TexturePacker 没有视差这个概念），壳子只读 manifest，所以必须落在这里。
      // ⚠️ **`description` 就剥在这一步**（票 02）：那是**作者**写的东西（「这一层画什么」），
      //   壳子从不读它，而它已经住在 `authoring/` 里了 ⇒ 不进交付清单。
      //   与 `role` 进、`description` 不进 是**同一个分工**。
      ...(b.spec.kind === "background" && b.spec.layers ? { layers: b.spec.layers.map(toPackLayer) } : {}),
      atlasId: atlasIdOf.get(b.spec.id)!,
      // 帧只有名字（票 26：`state` 已降格为单帧动画，不是帧的属性）
      frames: b.frames.map((f) => ({ name: f.name })),
      ...(b.animations ? { animations: b.animations } : {}),
      // ⚠️ 与图集里那份**同源同算**（`scale9Of`）—— 声明了却不写，会让 `add.nineslice()`
      //    的读者以为 manifest 有这个信息而图集没有；写了却算得不一样，是更坏的一种漂移。
      ...(s9 ? { scale9Borders: s9 } : {}),
      authoring: b.authoring,
      };
    }),
    files: [],
  };
  // ── 账：包根的 sidecar `ledger.json`（票 19 / 票 45）───────────────────────
  //
  // ⚠️ **写在这里是全部的关键**：`files[]` 是 `walk(packDir)` **穷举**，所以 sidecar 会
  //   **自动进 files[]**、自动被 `verify` 校验 checksum —— **契约一个字不用改、不用升版**。
  //   写在 walk 之后的话它就漏在 checksum 覆盖之外了。
  //
  // ⚠️ 而且它写在**临时包目录**里（`finalDir` 搬迁之前），所以它跟着包一起搬走。
  // ⚠️ **包内这份账与「异常上那份」是同一份数组，但读的时刻不同**（票 05）——
  //   包内这份**只在成功时才写**，而失败时根本走不到这里 ⇒ 它天然只含**回来的**调用。
  //   ⚠️ 而这一点从 2026-09-30 起是**构造保证**、不再是碰巧：每一条「已发出」都**记在闸门里面**
  //   （没被放行的一分钱没花、也就不记），而每一条记下的都会在同一个 unit 里被 `Object.assign` 补成事实。
  //   ⇒ 能走到这一行，就说明**每一条都被补过**。
  const ledgerDoc: Ledger | undefined = opts.ledger
    ? {
        format: LEDGER_FORMAT, packId: recipe.id, packVersion: version,
        createdAt: new Date((opts.sourceDateEpoch ?? Number(process.env.SOURCE_DATE_EPOCH ?? Math.floor(Date.now() / 1000))) * 1000).toISOString(),
        run: { wallClockMs: Date.now() - runT0, byStep: summarizeCalls(opts.ledger) },
        calls: opts.ledger,
      }
    : undefined;
  if (ledgerDoc) fs.writeFileSync(path.join(packDir, "ledger.json"), jstr(ledgerDoc));

  // ── 覆盖率：包根的 sidecar `coverage.json`（票 50）─────────────────────────
  //
  // ⚠️ **由 `pack` 算，不由装配期算** —— `@game-maker/demo` 里没有 PNG 解码器
  //   （它的依赖只有 contracts 与 phaser，而依赖图写死 demo 只能依赖 contracts）。
  //   像素是在这里诞生的，**算在产它的地方**。
  // ⚠️ 与账本同一个形状：**不放 manifest**（票 24 原则 2：不重复**可派生**的内容 ——
  //   覆盖率可以从图集像素算出来），而包根的 sidecar 靠 `files[]` 的穷举**白拿** checksum 覆盖。
  fs.writeFileSync(path.join(packDir, "coverage.json"), jstr({
    format: COVERAGE_FORMAT, packId: recipe.id, packVersion: version,
    layers: backgroundCoverage(packDir, manifest),
  }));

  // ── files[]：逐文件 checksum（manifest.json 自身除外，自指）──────────────
  const walk = (dir: string, base = ""): string[] => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]));
  manifest.files = walk(packDir).filter((p) => p !== "manifest.json").sort().map((p) => {
    const b = fs.readFileSync(path.join(packDir, p));
    return { path: p, bytes: b.length, checksum: sha256(b) };
  });
  fs.writeFileSync(path.join(packDir, "manifest.json"), jstr(manifest));

  // ── 对账（票 27）：spec 说要做成什么样 vs 包里实际是什么 ─────────────────
  const { auditAssetSpec } = await import("@game-maker/contracts");
  const audit = built.flatMap((b) => {
    const entry = manifest.assets.find((a) => a.id === b.spec.id)!;
    return auditAssetSpec(b.spec, entry);
  });

  // 全部成功才搬过去 —— 这一步之后才对「绝不覆盖」的版本号负责
  fs.mkdirSync(path.dirname(finalDir), { recursive: true });
  fs.renameSync(packDir, finalDir);
  return {
    manifest, packDir: finalDir, audit, imageCalls,
    ...(masterRatioList.length > 0 ? { masterRatios: masterRatioList } : {}),
    ...(ledgerDoc ? { ledger: ledgerDoc } : {}),
  };
}

