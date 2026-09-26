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
  assets: z.array(RecipeEntry).min(1),
}).strict().superRefine((r, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

  const ids = new Set<string>();
  for (const [i, e] of r.assets.entries()) {
    if (ids.has(e.spec.id)) issue(["assets", i, "spec", "id"], `资源 id 重复："${e.spec.id}"`);
    ids.add(e.spec.id);
  }

  // dependencies **只用于生成顺序，不用于组合**（票 05）—— 所以它引用的必须是清单里真有资源，
  // 且不能自引用。跨出清单的依赖无处兑现。
  r.assets.forEach((e, i) => {
    for (const d of e.spec.dependencies) {
      if (d === e.spec.id) issue(["assets", i, "spec", "dependencies"], `资源 "${e.spec.id}" 依赖它自己`);
      else if (!ids.has(d)) issue(["assets", i, "spec", "dependencies"], `资源 "${e.spec.id}" 依赖了清单里没有的 "${d}"`);
    }
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
export type AssetSource = z.infer<typeof AssetSource>;
export type ImportSource = z.infer<typeof ImportSource>;

export function parseRecipe(input: unknown): { ok: true; value: AssetRecipe } | { ok: false; errors: string[] } {
  const r = AssetRecipe.safeParse(input);
  return r.success ? { ok: true, value: r.data } : { ok: false, errors: format(r.error) };
}
import { formatIssues } from "./drawlist.js";
const format = formatIssues;
