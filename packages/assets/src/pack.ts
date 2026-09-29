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
  ASSET_PACK_FORMAT, COVERAGE_FORMAT, LEDGER_FORMAT, derivePackMode, paletteBindingOf, summarizeCalls,
  type AssetPackManifest, type AssetSpec, type DrawList, type Ledger, type LedgerCall, type StyleSpec,
} from "@game-maker/contracts";
import { buildAtlas } from "./atlas.js";
import { backgroundCoverage } from "./coverage.js";
import { emptyImage, inkBBox, type RasterImage } from "./image.js";
import { importFrames, keyBackground, sliceGrid, type Box } from "./import.js";
import { segmentRowCells } from "./sheet.js";
import { framePlan, imageNegativePrompt, imagePrompt, keyColorFor } from "./prompt.js";
import type { ImageGenCall, ImageRequest } from "./image-gen.js";
import { encodePNG, decodePNG } from "./png.js";
import { rasterize } from "./raster.js";

/** drawlist 的生成端口。**由票 22 提供实现**；本模块只调用。 */
export type DrawListGenerator = (spec: AssetSpec, style: StyleSpec) => DrawList[] | Promise<DrawList[]>;

/** 生图端口。**由调用方提供实现**（本模块只调）。一个资源一次调用、出一张原图。 */
export type GenerateImage = (req: ImageRequest) => Promise<{ image: RasterImage; call: ImageGenCall }>;

export type BuildPackOptions = {
  recipe: { id: string; styleRef: string; referenceImage?: string; assets: readonly { spec: AssetSpec; source: AssetSourceLike }[] };
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
  generateImage?: GenerateImage;
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
  | { kind: "image"; prompt?: string; reference?: string; background?: { tolerance: number }; alphaThreshold?: number | null }
  | {
      kind: "import"; ref: string;
      sheet?: { columns: number; rows: number; frameWidth: number; frameHeight: number; offsetX?: number; offsetY?: number; spacingX?: number; spacingY?: number; names: string[]; animations?: { name: string; frames: string[] }[] };
      background?: { tolerance: number };
      alphaThreshold?: number | null;
    };

export type BuildPackResult = {
  manifest: AssetPackManifest;
  packDir: string;
  /** 生图调用的事实记录（几个资源、几次调用、各自多久）—— 这是**钱**的账，交调用方报出来。 */
  imageCalls: ({ assetId: string } & ImageGenCall)[];
  /** spec ↔ 产物的对账结果（`auditAssetSpec`）。**有内容不等于失败** —— 交调用方决定。 */
  audit: string[];
  /** 写进包的那份账（票 45）。没传 `ledger` 进来就是 undefined。 */
  ledger?: Ledger;
};

/** `#rrggbb` → `[r,g,b]`。⚠️ 色板落盘前已规范化成小写，这里不做兼容性猜测。 */
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
 */
function normalizePalette(palette: readonly string[]): string[] {
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

export async function buildAssetPack(opts: BuildPackOptions): Promise<BuildPackResult> {
  try {
    return await buildInto(opts);
  } catch (e) {
    // ⚠️ 失败时把工作目录清掉：否则 `.building-*` 会在 out/ 里越积越多。
    //   （「失败不消耗版本号」是另一半 —— 见 buildInto 末尾那一步改名。）
    const scratch = path.join(opts.outDir, opts.recipe.id, `.building-${process.pid}-${nextPackVersion(opts.outDir, opts.recipe.id)}`);
    fs.rmSync(scratch, { recursive: true, force: true });
    throw e;
  }
}

async function buildInto(opts: BuildPackOptions): Promise<BuildPackResult> {
  // ⚠️ **墙钟**：人等了多久 —— 与各次调用的 ms 之和**是两个不相加的量**（票 19）。
  //   串行时恰好相等，并行（票 47）之后就不再相等，而**差正是并行的收益**。
  const runT0 = Date.now();

  const { recipe, style, outDir, generate } = opts;
  const palette = normalizePalette(style.palette);
  const version = nextPackVersion(outDir, recipe.id);
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

  type Built = { spec: AssetSpec; origin: "generated" | "imported"; paletteBinding: "exact" | "composited" | "quantized"; frames: { name: string; state?: string; image: RasterImage }[]; animations?: { name: string; frames: string[]; fps?: number; loop: boolean }[]; authoring: { kind: "drawlist" | "bitmap"; ref: string; original?: string }[] };
  /** 生图调用的账 —— 一次调用就是一笔钱，逐条记下来交调用方报出来。 */
  const imageCalls: ({ assetId: string } & ImageGenCall)[] = [];

  // ⚠️ **并发跑**（票 47）：资源之间**没有任何数据依赖** —— 每一次调用只吃自己的
  //   `spec` + StyleSpec，`dependencies` 那条线**从来没有过消费者**（本节末尾有交代）。
  //   串行纯属浪费：实测 9 个资源串行 43.7s，而墙钟本可以贴着最慢的那一个走。
  //
  // ⚠️ **两个闸门而不是一个**：限流是**上游**的属性。文本与生图是两个不同的上游
  //   （票 34：千问 RPS 5 / 并发 5；文本那侧查不到，取保守值），一个全局数会把
  //   「生图只能同时 3 个」错加到文本头上，或者反过来。
  // ⚠️ **失败即止**：串行时「第 5 个失败」只浪费掉前 4 个；并发之后若不管，
  //   `Promise.all` 虽然立刻拒绝，但**其余 8 个已经排进闸门了**，它们会照样发出去 ——
  //   钱在「已经知道失败了」之后继续烧。这个共享的失败信号就是那道闸。
  const stop: { error: unknown } = { error: null };
  const textGate = semaphore(opts.concurrency?.text ?? DEFAULT_CONCURRENCY.text, stop);
  const imageGate = semaphore(opts.concurrency?.image ?? DEFAULT_CONCURRENCY.image, stop);
  const built: Built[] = new Array<Built>(recipe.assets.length);

  await Promise.all(recipe.assets.map(async (entry, idx) => {
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
        // 世界的风格参考图（配方级）。给了就内联进每一次生图请求 —— 让模型**看着那个世界**画，
        // 而不是听一个文字转述（实测后者会走样成一张场景插画）。
        const styleReference = recipe.referenceImage
          ? decodePNG(fs.readFileSync(path.resolve(opts.recipeDir, recipe.referenceImage)))
          : undefined;
        const reference = src.reference
          ? decodePNG(fs.readFileSync(path.resolve(opts.recipeDir, src.reference)))
          : undefined;
        // ⚠️ **一个 unit 一次调用**。unit 的划分与 drawlist 路线的 `framePlan` **对称**（票 43）：
        //   · animation → 一个**动画**一个 unit（实测把 14 帧塞进一次调用，模型只给回来 1 个角色）
        //   · 分层背景 → **一层**一个 unit（票 40 撞到的那个洞：以前只出一张图，而 plan 有 N 项，
        //     `results[i]` 越界成 undefined，一路带到 buildAtlas 才炸成一个说不清哪里错的 TypeError）
        //   · 其余 → 一个资源一个 unit
        const bgLayers = spec.kind === "background" ? spec.layers : undefined;
        const units: { anim?: string; layer?: { name: string; index: number; total: number; tileX: boolean }; frames: number; raw: string }[] =
          spec.kind === "animation"
            ? spec.animations.map((a) => ({ anim: a.name, frames: a.frames, raw: `authoring/generated/${spec.id}.${a.name}.png` }))
            : bgLayers
              ? bgLayers.map((l, i) => ({
                  layer: { name: l.name, index: i, total: bgLayers.length, tileX: l.tileable?.x ?? false },
                  frames: 1,
                  raw: `authoring/generated/${spec.id}.${l.name}.png`,
                }))
              : [{ frames: 1, raw: `authoring/generated/${spec.id}.png` }];

        // ⚠️ **逐动画分批导入**：同一个动画内的帧必须共用裁框（那才是不抖的关键），
        // 而不同动画的补宽不一样，混一个数组交给 `importFrames` 会直接报尺寸不一致。
        const batches: RasterImage[][] = [];
        for (const u of units) {
          const prompt = src.prompt ?? imagePrompt(spec, style, {
            ...(u.anim === undefined ? {} : { anim: u.anim }),
            ...(u.layer === undefined ? {} : { layer: u.layer }),
          });
          // ⚠️ 过**生图**那道闸 —— 一次调用就是一笔钱，别把它和文本调用共用一个上限
          const { image, call } = await imageGate(() => opts.generateImage!({
            prompt, size: { w: spec.size.w * u.frames, h: spec.size.h },
            negativePrompt: imageNegativePrompt(),
            ...(styleReference ? { styleReference } : {}), ...(reference ? { reference } : {}),
          }));
          // 原图落盘：它既是创作态，也是「那次调用到底给了什么」的唯一证据。
          fs.writeFileSync(path.join(packDir, u.raw), encodePNG(image));
          fs.writeFileSync(path.join(packDir, u.raw.replace(/\.png$/, ".prompt.txt")), prompt + "\n");
          const cells: RasterImage[] = [];
          batches.push(cells);
          if (u.frames === 1) { cells.push(image); }
          else {
            // ⚠️ **按墨迹间隙分块**，不等分 —— 实测模型不按格子排版（见 sheet.ts 的文件头）。
            // ⚠️ 分块看的是 alpha，所以要先**抠一份**出来当探针；原图（纯 RGB）每一列都有"墨"。
            if (!src.background)
              throw new Error(
                `资源 "${spec.id}" 的动画 "${u.anim}" 是多帧，但 source 没给 \`background\` —— ` +
                "分块靠的是抠掉背景之后的 alpha，不抠就切不开（实测会把一整排 4 个角色判成 1 块）。",
              );
            const probe = keyBackground(image, src.background).image;
            const seg = segmentRowCells(image, probe);
            if (seg.cells.length !== u.frames)
              throw new Error(
                `资源 "${spec.id}" 的动画 "${u.anim}"：spec 声明 ${u.frames} 帧，但在生成的图上**检测到 ${seg.cells.length} 块**。` +
                "生图模型的帧数不可信（实测要 6 给 5）。要么重出这张图，要么把 spec 的帧数改成它真能画出来的数量 —— " +
                "**不静默取前 N 个**，那会让 manifest 的帧名与动画分组对不上。",
              );
            cells.push(...seg.cells);
          }
          imageCalls.push({ assetId: spec.id, ...call });
          opts.ledger?.push({
            step: "image", target: spec.id, upstream: call.protocol, ms: call.ms, attempts: call.attempts,
            requestedSize: call.requestedSize,
            ...(call.requestedModel !== undefined ? { requestedModel: call.requestedModel } : {}),
            ...(call.requestId !== undefined ? { requestId: call.requestId } : {}),
            ...(call.sourceHost !== undefined ? { sourceHost: call.sourceHost } : {}),
            ...(call.usage !== undefined ? { usage: call.usage } : {}),
          });
        }
        // ⚠️ **背景走两条与「一件道具」不同的规矩**（票 43），都要在这里定，不能留给默认：
        //   ① **按我们告诉模型的颜色抠底**，不四角取样 —— 背景层的角上就是内容本身
        //      （地面填满下半、墙填满中间那带），四角取样会把内容色当成底色，**整层抠光**。
        //   ② **不裁框** —— 导入通道默认「裁到内容再拉到 spec.size」，对一件道具是对的
        //      （裁紧、归一化），对一层背景是**毁掉构成**：层里只画了上半，裁完拉满，
        //      层与层之间的空间关系就没了。
        const isBg = spec.kind === "background";
        const bgOpt = isBg
          ? { tolerance: src.background?.tolerance ?? 30, colors: [hexToRgb(keyColorFor(palette))] }
          : src.background;
        const results = batches.flatMap((cells) =>
          importFrames(cells, {
            palette, targetWidth: spec.size.w, targetHeight: spec.size.h,
            ...(bgOpt !== undefined ? { background: bgOpt } : {}),
            ...(isBg ? { trim: false } : {}),
            ...(src.alphaThreshold !== undefined ? { alphaThreshold: src.alphaThreshold } : {}),
          }),
        );
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
      // 按下标落位 —— `Promise.all` 的完成顺序是乱的，而 manifest 里的资源顺序必须稳定。
      built[idx] = { spec, origin, paletteBinding: binding, frames, ...(animations ? { animations } : {}), authoring };
  }));

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
      ...(b.spec.kind === "background" && b.spec.layers ? { layers: b.spec.layers } : {}),
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
  return { manifest, packDir: finalDir, audit, imageCalls, ...(ledgerDoc ? { ledger: ledgerDoc } : {}) };
}
