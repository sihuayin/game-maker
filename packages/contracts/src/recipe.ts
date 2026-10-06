// `asset-recipe/v1` —— 一次资源生成要造哪些资源的**完整清单**。
//
// R7 定了**两条路都开**（人给 / 由需求推导），但清单**先落盘成文件**，之后两条路完全同构。
// 所以这个文件是产物 A 的**输入侧**，与 [AssetPackManifest](assetpack.ts)（输出侧）是两层：
//
//   AssetRecipe    说「**要做什么**」—— 纯意图 + 帧的来源
//   AssetPackManifest 说「**做出了什么**」—— 实际的文件、checksum、图集
//
// 两者的对账由 `auditAssetSpec()`（audit.ts）做。**一个文件既是输入又是输出会混淆**，
// 所以它们不共用类型、也不互相扩展。
//
// ⚠️ 绝不覆盖：再推导一次产出的是**新文件**，旧的留着（与资源包的 `v<N>` 同一条规矩）。
import { z } from "zod";
import { AssetSpecSchema } from "./asset-spec.js";


export const RECIPE_FORMAT = "asset-recipe/v1" as const;

/**
 * **输入路径** —— 配方引用的东西（StyleSpec、人工导入的位图）在配方**外面**。
 *
 * ⚠️ 它与 `PackPath`（包内路径）是**两个概念**，第一版把它们混成了一个：
 * 包内路径绝不允许 `..`（包要能整体搬走），而输入路径**必然**会有 `..`
 * （配方在 `out/<id>/recipes/` 下，而参考图风格与位图素材在仓库别处）。
 * 同样的规则套在两处，结果是一份完全正常的配方被拒。
 *
 * 统一约定：**相对于配方文件自身**解析。
 */
export const InputPath = z.string().min(1).superRefine((p, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (p.startsWith("/")) issue("必须是相对路径（相对于配方文件）");
  else if (!/^[A-Za-z0-9._/-]+$/.test(p)) issue("只允许 POSIX 相对路径字符（不含空格与反斜杠）");
  else if (p.split("/").some((s) => s === "")) issue("不允许空路径段");
});

/**
 * 让管线**画 drawlist**（创作态 = 指令表，可静态校验、可 diff）。
 * **不写任何路径** —— 路径是产物，由管线自己产、自己记进 manifest。
 *
 * ⚠️ **2026-09-25 由 `generate` 改名**：生图路线进来之后，「管线生成」不再有区分度 ——
 * 判别式要回答的是「**创作态是哪一种**」，答案现在是 drawlist / image / import。
 */
export const DrawlistSource = z.object({ kind: z.literal("drawlist") }).strict();

/**
 * 让管线**调生图模型**产原生位图（创作态 = 位图 + 那次调用的记录）。
 *
 * **多帧怎么拿一致性**（2026-09-26 实测，见 `experiments/master-to-animation/`）：
 * 一次调用画一张「一排 N 个角色」的横图，然后由管线**按墨迹间隙分块**（`segmentRowCells`）。
 * ⚠️ **不要指望等分切** —— 模型不按格子排版（实测要 6 帧给 5 个、间距还不均匀），
 * 等分切会让逐帧头宽极差到 144；按间隙切则降到 **4**。
 * ⚠️ **块数对不上就失败**，不静默取前 N 个 —— 与 drawlist 路线同一条规矩
 * （「清单说要有 N 帧，生成器给了 M 帧」）。
 */
export const ImageSource = z.object({
  kind: z.literal("image"),
  /** 覆盖派生的提示词。不给就由 `imagePrompt()` 从 spec + StyleSpec 渲染。 */
  prompt: z.string().min(1).optional(),
  /**
   * 参考图（**母版 → 动画**那条路）。相对**配方文件**解析，与 `import.ref` 同一条规则。
   *
   * ⚠️ 只有 Gemini 支持它：参考图是**内联**（base64）传的。DashScope 的 `image_edit`
   * 硬要公网 URL，本机文件传不进去 —— 实测那家这条路走不通。
   */
  reference: InputPath.optional(),
  /**
   * 抠背景。**默认不抠**。
   *
   * ⚠️ 实测这个上游**没有透明底**（返回的是纯 RGB），所以多半得抠。而抠背景是
   * `keyBackground`：**全局比色、不是连通域** —— 底色若同时是主体用色，会把主体抠穿。
   * 实测同类角色的一帧有 73% 的像素就是世界色板的最暗色，所以提示词里的底色
   * **绝不能在世界色板里**。见 `packages/assets/src/image-gen.ts` 的文件头。
   */
  background: z.object({ tolerance: z.number().nonnegative() }).strict().optional(),
  /** alpha 二值化阈值，默认 0.5。`null` = 保留半透明边缘（不推荐，会产出色板外颜色）。 */
  alphaThreshold: z.number().min(0).max(1).nullable().optional(),
}).strict();

/**
 * 人给的位图（[票 23](26-animation-representation.md) 定的两种形态）。
 *
 * ⚠️ 目标尺寸**不在这里** —— 它就是 `spec.size`。清单只说「从哪来」，
 * 「要多大」是规格的事，两者分开才不会出现两份互相矛盾的尺寸。
 */
export const ImportSource = z.object({
  kind: z.literal("import"),
  /** 源图路径。**相对于配方文件**（见 `InputPath`）。 */
  ref: InputPath,
  /** 给了就是「一张 sheet + 网格描述」；不给就是「单张独立 PNG」（1 帧）。 */
  sheet: z.object({
    columns: z.number().int().positive(), rows: z.number().int().positive(),
    frameWidth: z.number().int().positive(), frameHeight: z.number().int().positive(),
    offsetX: z.number().int().nonnegative().optional(), offsetY: z.number().int().nonnegative().optional(),
    spacingX: z.number().int().nonnegative().optional(), spacingY: z.number().int().nonnegative().optional(),
    /** **行优先**逐格命名，数量必须 = columns × rows。 */
    names: z.array(z.string().min(1)).min(1),
    /** 帧名 → 动画的分组。spec 声明了动画就必须给，且名字与帧数都要对得上。 */
    animations: z.array(z.object({
      name: z.string().min(1), frames: z.array(z.string().min(1)).min(1),
    }).strict()).optional(),
  }).strict().optional(),
  /** 抠背景（票 23：只能按容差，实测那类图的背景不是平色）。不给就假定人已经给了透明底。 */
  background: z.object({ tolerance: z.number().nonnegative() }).strict().optional(),
  /** alpha 二值化阈值，默认 0.5。`null` = 保留半透明边缘（不推荐，会产出色板外颜色）。 */
  alphaThreshold: z.number().min(0).max(1).nullable().optional(),
}).strict();

export const AssetSource = z.discriminatedUnion("kind", [DrawlistSource, ImageSource, ImportSource]);

/** **创作态母版** —— 参与生成、**不进交付包**（票 04 Q1/Q2）。
 *
 *  ⚠️ **它为什么是独立数组而不是 `AssetSpec` 上的判别式**（票 04 Q1(a)）：
 *    判别式要让**每一个**消费者（`pack` / `auditAssetSpec` / atlas / coverage / manifest）
 *    **记得过滤** —— 漏一个就是**静默交付一个不该交付的东西**。
 *    独立数组把它做成**结构性**的：`pack` 只迭代 `assets`，它**够不着** `authoring`。
 *    （同一条理由见 R11 把「禁止跨层」做成依赖图上一个结构性事实。）
 *
 *  ⚠️ **不复用 `AssetSpec`**（票 04 Q2）：那边必填的 `anchor` / `styleId` 是**交付语义**
 *    （落点、风格归属），母版不交付 ⇒ 键在、意不在。这里是**只留「生成它需要知道的」**。
 *  ⚠️ 尤其**不再收 `styleId`** —— 它今天在 `packages/` 里**源码零读取**（只有定义、
 *    让模型照抄的模板、和键清单三处），而风格已经由配方级的 `styleRef` 供给每一次生图。
 *    一个只被写、不被读的字段，会让下一个读代码的人以为它是活的（`CONTEXT.md:64-69` 那个病）。
 *
 *  ⚠️ **`size` 在这里是「画布」，不是「缩放目标」**（票 04 Q2/Q4）—— 同名不同义，
 *    有判例（票 03 的 Q2(a)：重名是故意的，层不同）。生成母版要有个画布高度，
 *    否则它的头身比是**随机的**，而动画的头身比由动画 spec 的 `size` 定
 *    ⇒ 同一个角色会有**两套比例**，那正是票 22 撞到的坑。
 *    ⇒ 判据：**母版的宽高比必须与引用它的资产的 `size` 宽高比一致**（构建期报错）。 */
export const AuthoringAsset = z.object({
  id: z.string().min(1),
  role: z.string(),
  description: z.string(),
  source: AssetSource,
  /** ⚠️ **必填**（与 `AssetSpec.characterId` 相反）：母版**总是**某个角色的
   *  —— 「母版是 DNA 的一张渲染图」（票 04 Q4）。 */
  characterId: z.string().min(1),
  /** **画布尺寸**（见上）。 */
  size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).strict(),
}).strict();

/** **依赖图里找一个环**（找不到返回 `null`）。⚠️ 图很小（一份清单至多几十个资产），DFS 足够。
 *
 *  ⚠️ **边走两类**：`dependsOn`（资产 → 资产）与 `masterAsset`（资产 → 母版）—— 票 11 的 Q4 裁定
 *    「完整图 = 两类边」。今天母版**没有出边**（`AuthoringAsset` 不收回指），所以环只可能出在
 *    资产之间；照两类边走是为了两件事：免得下一个人以为母版不在图上，以及母版哪天也能依赖时**这条判据不用改**。
 *
 *  ⚠️ 它在这里而不是在 `pack` 里，是因为**时机**：`packAssets` 第一行就 `parseRecipe`
 *    （`ops.ts:837`）⇒ 含环的配方在**任何生图、任何排版之前**被拒（退出码 4）。
 *    把环留到生成期才发现，就是「跑到一半死」。 */
function findCycle(r: {
  assets: readonly { spec: { id: string; dependsOn?: string[]; masterAsset?: string } }[];
}): string[] | null {
  const out = new Map<string, string[]>();
  for (const e of r.assets) {
    const { id, dependsOn, masterAsset } = e.spec;
    out.set(id, [...(dependsOn ?? []), ...(masterAsset === undefined ? [] : [masterAsset])]);
  }
  const state = new Map<string, 0 | 1 | 2>(); // 0 没见过 · 1 在栈上 · 2 走完了
  const stack: string[] = [];
  const walk = (n: string): string[] | null => {
    const st = state.get(n) ?? 0;
    if (st === 2) return null;
    if (st === 1) return [...stack.slice(stack.indexOf(n)), n]; // 顺着栈把环抄出来
    state.set(n, 1);
    stack.push(n);
    for (const m of out.get(n) ?? []) {
      const c = walk(m);
      if (c !== null) return c;
    }
    stack.pop();
    state.set(n, 2);
    return null;
  };
  for (const e of r.assets) {
    const c = walk(e.spec.id);
    if (c !== null) return c;
  }
  return null;
}

/** 清单的一项 = **纯意图的规格** + **帧从哪来**。两层在文件里就是分开的。 */
export const RecipeEntry = z.object({
  spec: AssetSpecSchema,
  source: AssetSource,
}).strict();

export const AssetRecipe = z.object({
  format: z.literal(RECIPE_FORMAT),
  id: z.string().min(1),
  /** StyleSpec 文件的位置，**相对于配方文件**（见 `InputPath`）。 */
  styleRef: InputPath,
  /**
   * 世界的**风格参考图**（通常就是当初提取 StyleSpec 的那张图）。相对**配方文件**解析。
   *
   * ⚠️ 它是**给生图模型看的**，而不是给人看的：`StyleSpec` 是**文字转述**的风格
   * （色板 hex + identity/material 这些词），而实测「文字转述的风格」会走样 ——
   * 曾经产出过一张带边框的场景插画而不是一件道具。
   * 有了它，生图请求里会**内联**这张图，让模型直接看着那个世界画。
   *
   * ⚠️ 只有 Gemini 支持内联（实测过）；DashScope 那条 `image_edit` 要公网 URL，收不到。
   * 给了它但上游不支持时，管线**不报错**（那是能力差异，不是清单错误），只是不起作用。
   */
  referenceImage: InputPath.optional(),
  /** 角色基因文件（`run/v<N>/character-dna.json`）的位置，**相对于配方文件**（见 `InputPath`）。
   *  ⚠️ 与 `styleRef` **同形**：配方级一条路径 + 资产级一个 id（`AssetSpec.characterId`）。
   *  ⚠️ 它与 `styleRef` 有一处**关键不同**：`styleId` 之所以是死的，是因为**一份配方只有一个风格**，
   *  那个 id 不携带信息；而 `characterId` 在**多角色**时是**真信息**。
   *  它今天安静（只有一个玩家角色），但它是信息，不是仪式 —— **别当 `styleId` 砍掉**。
   *  ⚠️ 可选：一份全是道具的配方没有角色。 */
  characterRef: InputPath.optional(),
  assets: z.array(RecipeEntry).min(1),
  /** **创作态母版**（票 04）。⚠️ **不交付** —— `pack` 只迭代 `assets`（见 `AuthoringAsset` 的注释）。 */
  authoring: z.array(AuthoringAsset).optional(),
}).strict().superRefine((r, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

  const ids = new Set<string>();
  for (const [i, e] of r.assets.entries()) {
    if (ids.has(e.spec.id)) issue(["assets", i, "spec", "id"], `资源 id 重复："${e.spec.id}"`);
    ids.add(e.spec.id);
  }

  // ── 创作态母版（票 04）──
  // ⚠️ 三条都是**同一份文件内**的引用族判据，所以住在契约里。
  //   （跨文件的 `characterId → character-dna.json` 归票 15 的 pipeline 统一校验 —— 这里看不见那个文件。）
  const authoringIds = new Set<string>();
  for (const [i, a] of (r.authoring ?? []).entries()) {
    if (authoringIds.has(a.id)) issue(["authoring", i, "id"], `母版 id 重复："${a.id}"`);
    if (ids.has(a.id)) issue(["authoring", i, "id"], `母版 id "${a.id}" 与某个资产 id 撞了 —— 两个 id 空间必须分开`);
    authoringIds.add(a.id);
  }
  r.assets.forEach((e, i) => {
    const m = e.spec.masterAsset;
    if (m === undefined) return;
    if (!authoringIds.has(m))
      issue(["assets", i, "spec", "masterAsset"],
        `资产 "${e.spec.id}" 指着母版 "${m}"，但 authoring[] 里没有它` +
        (authoringIds.size === 0 ? "（这份配方压根没有 authoring[]）" : ""));
  });

  // ── 依赖图（票 11 的 Q3/Q4）─────────────────────────────────────────────────
  // ⚠️ 三条判据都住在契约里、都只在**同一份文件内**判 —— 与上面 `masterAsset` 的存在性同一条理由
  //   （跨文件的引用族归票 15 的 pipeline 统一校验，这里看不见那些文件）。
  r.assets.forEach((e, i) => {
    for (const [j, dep] of (e.spec.dependsOn ?? []).entries()) {
      if (dep === e.spec.id)
        issue(["assets", i, "spec", "dependsOn", j], `资产 "${e.spec.id}" 依赖它自己`);
      else if (!ids.has(dep))
        issue(["assets", i, "spec", "dependsOn", j],
          `资产 "${e.spec.id}" 依赖 "${dep}"，而 assets[] 里没有这个 id` +
          (authoringIds.has(dep)
            ? " —— ⚠️ 那是个**母版**：引用母版要用 `masterAsset`，不是 `dependsOn`（两类边各管各的）"
            : ""));
    }
  });

  const cycle = findCycle(r);
  if (cycle !== null)
    issue(["assets"], `依赖图里有环：${cycle.join(" → ")} —— ⚠️ 造不出来的清单不是清单，**当场拒**（票 11 的 Q4）`);

  // ⚠️ 母版的**画布**尺寸 vs 引用它的资产的**缩放目标**尺寸（票 04 Q2/Q4：**同名不同义**）
  //   ⇒ 宽高比必须一致：母版的画布决定它的头身比，而动画的比例由这里的尺寸定。
  //   两套比例 = 同一个角色两种长相（票 22 撞过这个坑）。
  //   ⚠️ 这条判据在 `AuthoringAsset` 的注释里**自己写着却没人实现**（票 11 的 Q5 把它兑现了）——
  //      一条只写在注释里的判据，与一条永远绿的判据是同一种东西。
  r.assets.forEach((e, i) => {
    const m = e.spec.masterAsset;
    if (m === undefined) return;
    const master = (r.authoring ?? []).find((a) => a.id === m);
    if (master === undefined) return; // 「母版不存在」上面已经报过了，别报两遍
    const { w, h } = e.spec.size;
    const c = master.size;
    if (w * c.h !== c.w * h)
      issue(["assets", i, "spec", "size"],
        `资产 "${e.spec.id}" 的尺寸 ${w}×${h} 与母版 "${m}" 的画布 ${c.w}×${c.h} **宽高比不一致**` +
        " —— ⚠️ 母版的画布决定它的头身比，而动画的比例由这里的尺寸定；两套比例 = 同一个角色两种长相");
  });

  r.assets.forEach((e, i) => {
    const { spec, source } = e;
    const at = (m: string) => issue(["assets", i], m);

    if (source.kind === "import") {
      if (source.sheet) {
        const expect = source.sheet.columns * source.sheet.rows;
        if (source.sheet.names.length !== expect)
          at(`sheet 网格有 ${expect} 格，却给了 ${source.sheet.names.length} 个帧名`);
        if (new Set(source.sheet.names).size !== source.sheet.names.length) at("sheet 的帧名有重复");
        // 导入的动画分组必须与规格声明的一致（名字与帧数）
        if (spec.kind === "animation") {
          if (!source.sheet.animations) at("spec 声明了动画，sheet 却没给 animations 分组");
          else {
            const want = new Set(spec.animations.map((a) => a.name));
            const got = new Set(source.sheet.animations.map((a) => a.name));
            for (const n of want) if (!got.has(n)) at(`spec 声明了动画 "${n}"，sheet 的分组里没有`);
            for (const n of got) if (!want.has(n)) at(`sheet 分了动画 "${n}"，spec 里没有`);
            for (const a of spec.animations) {
              const b = source.sheet.animations.find((x) => x.name === a.name);
              if (b && b.frames.length !== a.frames) at(`动画 "${a.name}"：spec 要 ${a.frames} 帧，sheet 分组给了 ${b.frames.length} 帧`);
            }
          }
        } else if (source.sheet.animations) {
          at(`spec 是 ${spec.kind}（单帧），sheet 却给了动画分组`);
        }
      } else if (spec.kind === "animation") {
        at("animation 类的资源走导入时，必须给 sheet（单张独立 PNG 只有一帧）");
      }
    }
  });
});

export type AssetRecipe = z.infer<typeof AssetRecipe>;
export type RecipeEntry = z.infer<typeof RecipeEntry>;
export type AuthoringAsset = z.infer<typeof AuthoringAsset>;
export type AssetSource = z.infer<typeof AssetSource>;
export type ImportSource = z.infer<typeof ImportSource>;

export function parseRecipe(input: unknown): { ok: true; value: AssetRecipe } | { ok: false; errors: string[] } {
  const r = AssetRecipe.safeParse(input);
  return r.success ? { ok: true, value: r.data } : { ok: false, errors: format(r.error) };
}
import { formatIssues } from "./drawlist.js";
const format = formatIssues;
