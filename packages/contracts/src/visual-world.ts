// `visual-world/v1` —— **这个世界长什么样、按什么规则长**（R6 / 票 02）。
//
// ⚠️ **本文件是 V2 契约 ⇒ 用 `zod/v4`**（票 28 定的边界：旧契约 `zod`、V2 新契约 `zod/v4`，
//   两边**不许互相嵌套** —— `toolInputSchema` 只吃 v4，v3 的 `ZodObject` 连 `_zod` 都没有）。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **一份文档里有两层，读者先看这一段，否则会把第二层当成 bug 修。**
//
//   `styleIdentity` / `camera` / `palette` / …  ← **新视图。下游的唯一入口。**
//   `style`                                     ← **兼容与提示词载体**（一份完整的 StyleSpec 形）
//
//   两者**不是**「同一件事的粗细两个版本」，是**各有各的消费者**：
//     新视图  → 给**代码**读（票 10 设计编译 / 票 12 资源规划 / 票 14 运行时编译）。
//               封闭枚举、`PaletteRef`、结构化字段 —— 都是机器判得动的东西。
//     `style` → 给**提示词**读（`packages/assets` 的 `styleBrief` / 生图模板），
//               以及**旧链**（`derive` / `pack`）与**磁盘上已存在的 stylespec.json**。
//               那里需要的是**原话**，而原话在封闭枚举里放不下
//               （真实 fixture 有 `"fixed 2D orthographic stage view"` / `"2D正交侧面视角"`）。
//
//   ⇒ **新视图是权威**，`style` **不是第二事实源** —— 它是载体。
//   ⇒ 两者不一致时**不设判据**：两份都由模型的**同一次调用**填出，不一致是措辞差异，
//     够不上 R3 的「错了一定不是设计」。这与 `styleIdentity` / `style.identity` 同一款。
//   ⇒ 第 16 条裁决（R3-Q2）删掉了 `camera.description` 这类「枚举的自由文本逃生口」——
//     原话**已经**住在 `style.camera` 里了，再造一个就是同一个意思的第三份。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **R7 的门只管「新字段」，不管「原样搬运的旧子树」**（第 13 条裁决，R2-Q4）。
//
//   R7 说「说不出「谁读它」的字段不进契约」。`style` 子树里有 6 个字段全仓库零读取
//   （`camera` · `composition` · `lighting` · `environment` · `characterStyle` · `confidence`），
//   其中 `camera` 还被 `prompt.ts:217` 明确写下「故意不读」。**但它们照旧保留**：
//   它们在**旧链里也是零读取**（不是 V2 引入的新负债），而砍掉会当场破坏
//   `03 §5` 的兼容要求、票 02 自己的判据，以及 `pack.ts:565` 的整对象 spread 与包内 checksum。
//   ⇒ **R6（原样保留）赢；用一条新规去追一笔旧账，代价与收益不成比例。**
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **三处 v4 镜像**（第 15 条裁决，R3-Q1）：`StyleSpecShape` · `PaletteShape` · `PaletteRefShape`
//   · `StyleReferencePath`。它们一一对应 v3 的原件（`index.ts` / `drawlist.ts` / `recipe.ts`），
//   **v3 那几份原件一个字都不改**，本文件只是它们的 v4 形态。
//
//   **为什么必须镜像**：`StyleSpecSchema.palette` 用的是 `PaletteSchema`（v3，住在 drawlist 契约里），
//   而「迁移 v3 契约到 v4」会连带把整个 drawlist 世界拖进来 —— 那正是票 28 刚划干净的边界。
//   ⇒ 代价是**两份定义会漂**，所以配 `tests/visual-world.test.ts` 的漂移测试盯着。
//   ⚠️ **漂移测试以 v3 那份为准**，且有一条**明示例外**要认：
//      v3 的 `StyleSpecSchema` 是 `z.object`（**不封口**，多余键被 strip），
//      v4 镜像用 `z.strictObject`（封口，多余键被**拒**）—— 因为 `io: "input"` 下
//      `z.object` **不产出** `additionalProperties: false`，而这份 schema 的用途是
//      **告诉模型要什么**，「同形」不封口则等于在最大的那块上让它自由发挥（见 `structured-call.ts`）。
import { z } from "zod/v4";

/** 判别式。⚠️ **用 `format` 而不是 doc 里的自由字符串 `schemaVersion`**（第 7 条裁决，R1-Q7）：
 *  自由字符串**判别式写不出来**，而 `assetpack.ts:25` 那条注释说得清楚 ——
 *  「`format` 这个字段存在的意义就是把契约变了这件事说出来」。仓里四处（drawlist / recipe /
 *  assetpack / game-config）全是这个形状。 */
export const VISUAL_WORLD_FORMAT = "visual-world/v1" as const;

// ── v4 镜像 A：色（对 `drawlist.ts` 的 `PaletteColor` / `PaletteSchema` / `PaletteRef`）────────
//
// ⚠️ 为什么不直接 `import { PaletteSchema } from "./drawlist.js"`：那是 **v3** 的 schema，
//   塞进 v4 的 `z.array` / `z.strictObject` 会当场炸。理由与代价见文件头。

/** 单个色值：**规范化的**小写 `#rrggbb`。镜像自 `drawlist.ts` 的 `PaletteColor`。 */
export const PaletteColorShape = z.string().regex(/^#[0-9a-f]{6}$/, "色值必须是规范化的小写 #rrggbb");

/** 色板：**有序**数组，且不得有重复色。镜像自 `drawlist.ts` 的 `PaletteSchema`。
 *  ⚠️ 顺序是**硬约束**（`index.ts:20-21`）：drawlist 用 `palette:<下标>` 引用它，
 *  换掉整个色板时创作态文本必须**一字不变** —— 那条性质全靠这个顺序稳定。 */
export const PaletteShape = z.array(PaletteColorShape).superRefine((values, ctx) => {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) ctx.addIssue({ code: "custom", message: `色板里有重复色 ${v} —— palette:N 会变得含糊` });
    seen.add(v);
  }
});

/** 颜色的引用形式。镜像自 `drawlist.ts` 的 `PaletteRef`。
 *  ⚠️ **VWS 的六桶用它，不自己发明「下标整数」**（第 11 条裁决，R2-Q2）——
 *  两个模块解析同一个概念用两种写法，正是票 39 拆过的那个坑。 */
export const PaletteRefShape = z
  .string()
  .regex(/^palette:\d+$/, "必须是 palette:<下标> 引用；硬编码色值无法通过 schema");

// ── v4 镜像 B：输入路径（对 `recipe.ts` 的 `InputPath`）─────────────────────────────────────
//
// ⚠️ 基准是**本文件自己所在的那份 JSON**（`run/v<N>/visual-world.json`），与 `recipe.json`
//   的规则同构：「一份自描述的 JSON，里面的相对路径相对它自己」。
//   ⇒ 报错文案里说的是 `visual-world.json`，**不是**镜像自的那句「相对于配方文件」。
// ⚠️ **不立第三套路径规则**（仓里已有 `PackPath`（包内，禁 `..`）与 `InputPath`（输入侧，必然有 `..`））——
//   三套没人记得住。这里是 InputPath 那一套的 v4 形态，不是新规矩。
export const StyleReferencePath = z.string().min(1).superRefine((p, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (p.startsWith("/")) issue("必须是相对路径（相对于 visual-world.json 自身）");
  else if (!/^[A-Za-z0-9._/-]+$/.test(p)) issue("只允许 POSIX 相对路径字符（不含空格与反斜杠）");
  else if (p.split("/").some((s) => s === "")) issue("不允许空路径段");
});

// ── v4 镜像 C：`StyleSpec` 本体（对 `index.ts` 的 `StyleSpecSchema`）──────────────────────────
//
// ⚠️ **12 个字段一个不少、一个不多、必填性一一对应** —— 漂移测试盯着这一条。
// ⚠️ 封口性是**明示例外**：v3 那份是 `z.object`（多余键被 strip），这里是 `z.strictObject`（被拒）。
//   这不影响兼容 —— 磁盘上的旧文件仍走 v3 那份解析（`packages/assets` 一个字节没动）。
export const StyleSpecShape = z.strictObject({
  id: z.string(),
  identity: z.array(z.string()),
  camera: z.record(z.string(), z.unknown()).default({}),
  composition: z.record(z.string(), z.unknown()).default({}),
  // ⚠️ 规范化色板：**有序**、小写 `#rrggbb`、不得重复色。
  palette: PaletteShape.default([]),
  lighting: z.record(z.string(), z.unknown()).default({}),
  shapeLanguage: z.array(z.string()).default([]),
  material: z.array(z.string()).default([]),
  environment: z.array(z.string()).default([]),
  characterStyle: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1)
});

// ── 新契约 ────────────────────────────────────────────────────────────────────────────────
//
// ⚠️ **一条顶层的 `superRefine`：所有 `palette:N` 的落点必须落在 `style.palette` 之内**（票 08 的 R1-Q6 / R2-Q4）。
//
//   **它管什么**：六桶**与** `materials.*.color` —— 一个世界只有一个颜色来源，
//     所以「引用越界」在这两处是**同一条**违规，一条 check 管完。
//   **为什么只提前管这一条**：判据是 **「就地 gate 只管「一次调用内部自相矛盾」」** ——
//     模型自己写下一份 9 个色的 `style.palette`、又引用 `palette:9`，那是**自己跟自己打架**。
//     票 08 的八发真探针实测：过 Zod 的 6 发里有 **1 发**正是这个（`highlight` + 三个 `materials.*.color`）。
//     ⚠️ 而「色板为空」那种**不是**自相矛盾、是**世界的一种性质** ⇒ 不在这里管，
//     它归票 17 的判据。**别把这条 check 当垃圾桶往里加。**
//
// ⚠️ **这条 check 模型看不见。** `toJSONSchema` 会把 `superRefine` **静默丢掉**（票 08 探针实测），
//   所以它**只在我们这边响**。这正是它**该有的样子**（它是 gate，不是提示），
//   但**模型不知道有这条规矩** ⇒ 由 `vision` 在工具 `description` 里补一句（票 08 的 R2-Q5）。
//
// ⚠️ **一个必须点名的连带后果：这条 check 同时也管从磁盘上读回来的 `visual-world.json`。**
//   它不只在 vision 那一次调用里响 —— 一份**人手写的**、引用越界的文档，解析时就会被拒。
//   我们认为这是对的（票 02 裁决 12 本来就把「palette 越界」定成**判据**，而 R3 说判据在构建期阻断），
//   但要**说清楚**：它让[[观察 / 判据|判据]]里那条「palette 越界」**在 VWS 这一侧**
//   **永远不再触发** —— config / drawlist 那一侧的那条还在，别以为它坏了。
//   照票 05 的先例（「那两条差集**恒为空是预期的**」，契约里自带这句自白），写在这里免得下一个人找。
//

/** 六桶的**名字**。⚠️ 这是 schema 的键集，不是取值域 —— 取值域永远是 `style.palette` 那份有序数组。 */
export const PALETTE_BUCKETS = ["primary", "secondary", "accent", "background", "shadow", "highlight"] as const;

/** 相机模式的**封闭枚举**。
 *  ⚠️ **`"other"` 刻意保留**（第 24 条裁决，R4-Q4）：删掉它，模型在五个值都不对时只能**硬选一个错的**；
 *  而下游（票 10 / 票 14）拿到 `"other"` 时**知道该回去读兼容载体** `style.camera`，拿到一个错的枚举则什么都不知道。 */
export const CAMERA_MODES = ["side", "top-down", "isometric", "first-person", "other"] as const;

/**
 * **这个世界长什么样、按什么规则长** —— V2 理解层的第一个契约产物（票 02 / R6）。
 *
 * 由 `packages/vision` 在**一发**强制工具调用里产出（第 10 条裁决，R2-Q1：模型一次吐全，
 * **不做代码投影** —— 投影是有损的，`style.composition.layout` 与 `style.lighting.ambience`
 * 在新视图里根本没有家，投影会把今天活着的消费者 `styleBrief` 静默降级）。
 */
export const VisualWorldSpecSchema = z.strictObject({
  format: z.literal(VISUAL_WORLD_FORMAT),

  // ── 新视图：下游唯一入口 ────────────────────────────────────────────────
  //
  // ⚠️ 叫 `styleIdentity` 而**不是** `identity`（第 3 条裁决，R1-Q3）：`style.identity` 是
  //   `string[]`，两者同名不同型。而 `prompt.ts:295/328/376` 今天就在把 `identity: ...`
  //   贴进生成提示词，`03 §15` 又要求提示词**同时**结合 VWS 与原图 ⇒
  //   一个提示词里两个 `identity:` 是纯噪声。**能动的是新的这个**（R6 把旧的钉死为原样保留）。
  styleIdentity: z.strictObject({
    styleName: z.string().optional(),
    keywords: z.array(z.string()),
    description: z.string()
  }),

  camera: z.strictObject({
    mode: z.enum(CAMERA_MODES),
    // ⚠️ 这四个保持 doc 的可选（第 24 条裁决）—— 它们是**补充**，不是模式的替代。
    projection: z.string().optional(),
    angle: z.number().optional(),
    elevation: z.number().optional(),
    perspective: z.string().optional()
  }),

  composition: z.strictObject({
    foreground: z.string().optional(),
    midground: z.string().optional(),
    background: z.string().optional(),
    objectScale: z.string().optional(),
    characterScale: z.string().optional(),
    density: z.string().optional()
  }),

  // ⚠️ **六桶装 `PaletteRef`，不是第二套色值**（第 2 条裁决，R1-Q2）。于是「同源的两个视图」是
  //   **结构事实**而不是愿望：世界里的颜色只有一个来源，就是 `style.palette` 那份有序数组。
  // ⚠️ **六个都必填、都允许 `[]`、且刻意不加 `.default([])`**（第 22 条裁决，R4-Q2）：
  //   票 28 实测 `io: "input"` 下带 `.default()` 的字段对模型是**可选**的，于是
  //   「省略」与「想过了、是空的」会混成同一个形状 —— 而**分组是这个视图唯一的职责**。
  //   `[]` 说得清，缺字段说不清。
  palette: z.strictObject({
    primary: z.array(PaletteRefShape),
    secondary: z.array(PaletteRefShape),
    accent: z.array(PaletteRefShape),
    background: z.array(PaletteRefShape),
    shadow: z.array(PaletteRefShape),
    highlight: z.array(PaletteRefShape)
  }),

  lighting: z.strictObject({
    direction: z.string().optional(),
    softness: z.string().optional(),
    contrast: z.string().optional(),
    mood: z.string().optional()
  }),

  // ⚠️ **键是开集**（材质名由世界自己起），**值封口**。
  //   `structured-call.ts` 拿这个字段当反例写过：「替契约作者表态，就会把 `materials` 那种
  //   开集 `Record` 也封上 —— 那会直接把合法输出判成非法」。
  // ⚠️ `color` 用 `PaletteRef[]` 而**不是** doc 字面的自由 hex（第 25 条裁决，R5-Q1）——
  //   否则这个世界就有了第二套颜色来源，而 `palette:N` 的一元性正是整票最硬的那条原则。
  materials: z.record(
    z.string(),
    z.strictObject({
      appearance: z.string(),
      texture: z.string().optional(),
      color: z.array(PaletteRefShape).optional()
    })
  ),

  character: z.strictObject({
    proportions: z.string().optional(),
    silhouette: z.string().optional(),
    poseLanguage: z.string().optional(),
    clothing: z.string().optional(),
    faceAbstraction: z.string().optional()
  }),

  environment: z.strictObject({
    architecture: z.string().optional(),
    terrain: z.string().optional(),
    props: z.string().optional(),
    textureDensity: z.string().optional()
  }),

  // ⚠️ 这两个**进**（第 5 条裁决，R1-Q5）而 `rendering` **不进**（第 20 条）—— 分界线是
  //   **今天就有消费者**：`prompt.ts:48-56` 的 `styleBrief` 与 `review.ts:80-83` 正在读它们，
  //   而 `rendering` 一个读者都没有（它拟人化的那部分由 `prompt.ts:299` 一句硬编码承担）。
  shapeLanguage: z.array(z.string()),
  constraints: z.array(z.string()),

  // ⚠️ **摊平成一项**（第 18 条裁决，R3-Q4）：`characterImages` / `materialImages` 已判不进，
  //   `references` 会是个只有一个孩子的容器，多一层不换任何东西。
  // ⚠️ **不设 `maxItems`**（第 23 条裁决，R4-Q3）：`maxItems === 1` 是**第一阶段**的限制，
  //   不是契约形状 —— 写进 schema 就是让过渡期永久化，而票 26 的存在正说明它会消失。
  //   ⇒ 由**调用方**执行（链里报错、CLI 退出码 2）。
  // ⚠️ `role` 保持 `z.string()`：R18 已把「是不是封闭枚举」推迟到票 26。
  styleReferences: z.array(z.strictObject({ path: StyleReferencePath, role: z.string() })),

  // ── 兼容载体：**不是**第二事实源 ─────────────────────────────────────────
  //
  // 见文件头。它存在有三个理由，缺一不可：
  //   ① 旧链（`packages/assets`）与磁盘上已有的 `stylespec.json` 读的是它；
  //   ② 提示词要**原话**，而新视图的封闭枚举放不下原话；
  //   ③ `manifest.provenance.style.stylespecId` 指向的正是 `style.id`。
  // ⚠️ `style.id` 由**调用方注入**（第 21 条裁决，R4-Q1）：提示词把 `<styleId>` 递给模型让它照抄
  //   （先例见 `ops.ts:86`），解析后由 pipeline **强制覆盖** —— `id` 是**身份不是观察**，
  //   让模型看一张图即兴编，同一张图两次会跑出两个 `stylespecId`，而那个字段的用途恰恰是指认。
  // ⚠️ `confidence` **从不做门禁**（票 08 的 R1-Q3）。它是**模型自报**的数、消费者为零，
  //   而 R3 说自报的数进不了判据。留着它是因为它与 `StyleSpecSchema` **一字不差**
  //   （漂移测试盯着这一条），而**不是**因为它有用 —— 别拿它当闸门。
  style: StyleSpecShape
}).superRefine((v, ctx) => {
  // ⚠️ **只此一处的「越界」定义**。上面文件头写着它管什么、为什么只提前管这一条。
  const n = v.style.palette.length;
  const sites: { where: string; path: (string | number)[]; ref: string }[] = [];
  for (const [bucket, refs] of Object.entries(v.palette))
    (refs ?? []).forEach((ref, i) => sites.push({ where: `palette.${bucket}[${i}]`, path: ["palette", bucket, i], ref }));
  for (const [name, mat] of Object.entries(v.materials))
    (mat?.color ?? []).forEach((ref, i) => sites.push({ where: `materials.${name}.color[${i}]`, path: ["materials", name, "color", i], ref }));
  for (const { where, path, ref } of sites) {
    // 形式已由 `PaletteRefShape` 的正则保证是 `palette:<数字>`，所以这里直接取数字。
    const idx = Number(ref.slice("palette:".length));
    if (idx >= n)
      ctx.addIssue({
        code: "custom", path,
        message: `${where} 指向 ${ref}，而这份文档的 style.palette 只有 ${n} 个色（合法下标 0..${n - 1}）` +
          "—— ⚠️ 悬空引用：色板与引用是同一次调用里写出来的，对不上就是**文书自己跟自己矛盾**",
      });
  }
});

export type VisualWorldSpec = z.infer<typeof VisualWorldSpecSchema>;
export type StyleSpecShape = z.infer<typeof StyleSpecShape>;
export type StyleReference = z.infer<typeof VisualWorldSpecSchema>["styleReferences"][number];
