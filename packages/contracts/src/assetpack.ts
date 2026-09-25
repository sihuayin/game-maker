// `assetpack/v1` —— **一个资源包的自描述**（票 24 定的形状）。
//
// 它是包的唯一入口：产物 B 只读它，agent 只读它，人也只读它。
// ⚠️ **与 `AssetManifestSchema`（index.ts）不是同一个东西**：
//    AssetManifest     = **输入侧**的资产集合 + 旧闭环的过程统计（generated/missing/broken/unused）→ 归票 28
//    AssetPackManifest = **交付物自身**的自描述 → 本文件
// 两者不共用类型，也不互相扩展。
//
// 三条设计原则（都是为了「不漂移」）：
//   1. 不重复图集里已有的内容 —— 帧的 x/y/w/h 与 anchor/scale9Borders 都在 TexturePacker JSON 里，
//      这里只做索引（帧名 → 属于哪个 atlas）。
//   2. 不重复**可派生**的内容 —— 没有 `states[]` 字段，「有哪些状态」= `frames[].state` 的去重集合。
//   3. 所有路径都是**相对包根**的 POSIX 路径，绝对路径与 `..` 由 schema 直接拒 —— 包要能整体搬走。
import { z } from "zod";
import { formatIssues, PaletteColor, PaletteRef } from "./drawlist.js";

export const ASSET_PACK_FORMAT = "assetpack/v1" as const;

// PaletteRef 从 drawlist.ts 复用 —— 同一个概念不写两份。

/** 包内路径：相对包根、POSIX 分隔符。 */
export const PackPath = z.string().min(1).superRefine((p, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (p.startsWith("/")) issue("必须是包内**相对**路径 —— 绝对路径会让包无法整体搬走");
  else if (!/^[A-Za-z0-9._/-]+$/.test(p)) issue("只允许 POSIX 相对路径字符（不含空格与反斜杠）");
  else if (p.split("/").some((s) => s === ".." || s === "")) issue("不允许 `..` 或空路径段");
});

/** 逐文件的校验和。算法与粒度由票 24 定死：sha256、**逐文件**、覆盖包内全部文件。 */
export const Checksum = z.string().regex(/^sha256:[0-9a-f]{64}$/, "形如 sha256:<64 位小写十六进制>");

/** 归一化锚点。Phaser 会把它当 origin 用（`Frame.customPivot`），**逐帧生效**。 */
export const Anchor = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();

/** 九宫格中央区域的矩形。Phaser 的 `add.nineslice()` 零参数自动读它（仅 WebGL）。 */
export const NinePatch = z.object({
  x: z.number().int().nonnegative(), y: z.number().int().nonnegative(),
  w: z.number().int().positive(), h: z.number().int().positive(),
}).strict();

export const AssetKind = z.enum(["sprite", "animation", "background", "ui"]);

/** 交付态像素颜色与色板的关系（票 36 定四值）。
 *  ⚠️ 前两个对 drawlist 资源是**解析期静态可判**的（`paletteBindingOf()`）；
 *  后两个只可能来自人工导入通道 —— 那正是「颜色 ∈ 色板」不成立的地方，所以要显式记下来。 */
export const PaletteBinding = z.enum(["exact", "composited", "quantized", "unbound"]);

/** 谁造的。一个包里的资源可以来源不同，所以这一项是**逐资源**的。 */
export const AssetOrigin = z.enum(["generated", "imported", "fixture"]);

export const FrameRef = z.object({
  /** 图集里的帧名（`player.walk1`），也是产物 B 引用它的名字。**消费者不许解析它** —— 命名约定只给人眼看。 */
  name: z.string().min(1),
  index: z.number().int().nonnegative().optional(),
  durationMs: z.number().positive().optional(),
}).strict();

export const Animation = z.object({
  name: z.string().min(1),
  frames: z.array(z.string().min(1)).min(1),
  fps: z.number().positive().optional(),
  loop: z.boolean().default(true),
}).strict();

export const AssetPackEntry = z.object({
  id: z.string().min(1),
  kind: AssetKind,
  role: z.string(),
  origin: AssetOrigin,
  paletteBinding: PaletteBinding,
  required: z.boolean().default(true),
  /** 交付态的目标尺寸。**必填** —— 每个资源都有帧，每个帧都有尺寸，
   *  留成 nullable 只会让「没人能依赖它」（票 27 的对账抓到过这个洞）。
   *  各帧真实尺寸在 `delivery/atlas.*.json` 里，这里只是这个资源的标称尺寸。 */
  size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).strict(),
  anchor: Anchor,
  scale9Borders: NinePatch.optional(),
  atlasId: z.string().min(1),
  frames: z.array(FrameRef).min(1),
  animations: z.array(Animation).optional(),
  /** 创作态来源 —— 「创作态 ↔ 交付态」的**唯一联结处**。 */
  authoring: z.array(z.object({
    kind: z.enum(["drawlist", "bitmap"]),
    ref: PackPath,
    /** 导入位的原始出处（包外），仅供人追溯。 */
    original: z.string().optional(),
  }).strict()),
}).strict().superRefine((a, ctx) => {
  const names = new Set<string>();
  for (const f of a.frames) {
    if (names.has(f.name)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `帧名重复："${f.name}"`, path: ["frames"] });
    names.add(f.name);
  }
  const grouped = new Set<string>();
  for (const an of a.animations ?? [])
    for (const fn of an.frames) {
      if (!names.has(fn)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `动画 "${an.name}" 引用了不存在的帧 "${fn}"`, path: ["animations"] });
      grouped.add(fn);
    }
  // 票 26：动画是**一个 Asset 内部唯一的分组概念**。所以多于一帧时，
  // 每一帧都必须至少属于一个动画 —— 否则那一帧是不可达的（画不出来，也没人引用得到）。
  // 单帧资源不需要分组：它本身就是「一个单帧动画」。
  if (a.frames.length > 1)
    for (const f of a.frames)
      if (!grouped.has(f.name))
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `帧 "${f.name}" 不属于任何动画 —— 它不可达（多于一帧的资源必须把每帧都分组）`, path: ["frames"] });
});

export const AtlasEntry = z.object({
  id: z.string().min(1),
  kind: AssetKind,
  /** TexturePacker JSON Hash 的路径（票 25 查清的事实形状：Phaser 原生读，零转换器）。 */
  meta: PackPath,
  image: PackPath,
  size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).strict(),
  frames: z.number().int().positive(),
  assets: z.array(z.string()),
  checksum: Checksum,
}).strict();

const Degradation = z.object({
  stage: z.string(), assetId: z.string().optional(), reason: z.string(), fellBackTo: z.string(),
}).strict();

export const AssetPackManifest = z.object({
  format: z.literal(ASSET_PACK_FORMAT),
  id: z.string().min(1),
  /** 包版本。**绝不覆盖**：v1 与 v2 是两个并存的目录，旧版本永久保留。 */
  version: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
  generator: z.object({ name: z.string(), version: z.string(), run: z.string().optional(), deterministic: z.string().optional() }).strict(),
  provenance: z.object({
    /** 包级身份。**由 assets[].origin 唯一派生**，见下面的 superRefine ——
     *  「一个 fixture 包谎报自己是 generated」因此是解析不通过，而不是一条能被忽略的约定。 */
    mode: z.enum(["generated", "fixture", "mixed"]),
    style: z.object({ origin: z.enum(["human-in-session", "fixture"]), ref: PackPath, stylespecId: z.string(), checksum: Checksum }).strict(),
    degradations: z.array(Degradation).default([]),
    /**
     * 实际走的是什么传输 —— **诊断信息，不是降级**（票 14）。
     *
     * 端点故障转移（主协议被上游拒了、换另一个协议拿回**同样的东西**）不算降级：
     * 产物一模一样。但不记下来的话，没人知道那天换过端点，下次同一个坑要重新踩一遍。
     */
    transport: z.object({
      preferred: z.string(), used: z.string(),
      switches: z.array(z.object({ from: z.string(), to: z.string(), reason: z.string() }).strict()).default([]),
    }).strict().optional(),
  }).strict(),
  palette: z.object({
    ref: z.string(), size: z.number().int().positive(),
    values: z.array(PaletteColor),
    coverage: z.object({
      exact: z.number().int().nonnegative(), composited: z.number().int().nonnegative(),
      quantized: z.number().int().nonnegative(), unbound: z.number().int().nonnegative(),
    }).strict(),
  }).strict(),
  atlases: z.array(AtlasEntry).min(1),
  assets: z.array(AssetPackEntry).min(1),
  /** 包内每个文件的 checksum。manifest.json 自身除外（自指）。 */
  files: z.array(z.object({ path: PackPath, bytes: z.number().int().nonnegative(), checksum: Checksum }).strict()).min(1),
}).strict().superRefine((m, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

  // 色板：长度自洽 + 无重复色（重复会让 palette:N 含糊）
  if (m.palette.values.length !== m.palette.size) issue(["palette"], `palette.size=${m.palette.size} 与 values.length=${m.palette.values.length} 不一致`);
  if (new Set(m.palette.values).size !== m.palette.values.length) issue(["palette"], "色板里有重复色 —— palette:N 会变得含糊");

  const atlasIds = new Set(m.atlases.map((a) => a.id));
  const assetIds = new Set<string>();
  for (const a of m.assets) {
    if (assetIds.has(a.id)) issue(["assets"], `资源 id 重复："${a.id}"`);
    assetIds.add(a.id);
    if (!atlasIds.has(a.atlasId)) issue(["assets"], `资源 "${a.id}" 指向不存在的图集 "${a.atlasId}"`);
    // unbound 是「颜色 ∈ 色板」不成立的那一类，必须留下案底
    if (a.paletteBinding === "unbound" && !m.provenance.degradations.some((d) => d.assetId === a.id))
      issue(["provenance", "degradations"], `资源 "${a.id}" 的 paletteBinding 是 unbound，却没有对应的降级记录`);
  }
  for (const at of m.atlases)
    for (const id of at.assets)
      if (!assetIds.has(id)) issue(["atlases"], `图集 "${at.id}" 声称包含不存在的资源 "${id}"`);

  // provenance.mode 由 per-asset origin 唯一派生 —— 诚实是结构性的
  const origins = m.assets.map((a) => a.origin);
  const allOf = (v: string) => origins.every((o) => o === v);
  const expectedMode = allOf("fixture") ? "fixture" : allOf("generated") ? "generated" : "mixed";
  if (m.provenance.mode !== expectedMode)
    issue(["provenance", "mode"], `provenance.mode="${m.provenance.mode}" 与资源来源矛盾（应为 "${expectedMode}"）`);

  // files[] 必须覆盖每一个被引用的文件 —— checksum 才谈得上「覆盖完整」
  const fileSet = new Set(m.files.map((f) => f.path));
  for (const at of m.atlases) {
    if (!fileSet.has(at.meta)) issue(["files"], `图集 "${at.id}" 的 meta 不在 files[] 里`);
    if (!fileSet.has(at.image)) issue(["files"], `图集 "${at.id}" 的 image 不在 files[] 里`);
  }
  for (const a of m.assets)
    for (const src of a.authoring)
      if (!fileSet.has(src.ref)) issue(["files"], `资源 "${a.id}" 的创作态引用 "${src.ref}" 不在 files[] 里`);
});

export type AssetPackManifest = z.infer<typeof AssetPackManifest>;
export type AssetPackEntry = z.infer<typeof AssetPackEntry>;
export type AtlasEntry = z.infer<typeof AtlasEntry>;
export type FrameRef = z.infer<typeof FrameRef>;
export type Animation = z.infer<typeof Animation>;
export type AssetKind = z.infer<typeof AssetKind>;
export type PaletteBinding = z.infer<typeof PaletteBinding>;
export type AssetOrigin = z.infer<typeof AssetOrigin>;

export function parseAssetPack(input: unknown): { ok: true; value: AssetPackManifest } | { ok: false; errors: string[] } {
  const r = AssetPackManifest.safeParse(input);
  return r.success ? { ok: true, value: r.data } : { ok: false, errors: formatIssues(r.error) };
}

/**
 * 产物 B 对包内资源的引用。**全是名字不是索引。**
 *
 * ⚠️ 这条与[票 09](../../../.scratch/game-creation-v1/issues/09-game-config-contract.md)（Game Config）
 * 是**同一个接口的两侧** —— 票 24 在 A 侧先定，票 26 收掉了 `state`，票 09 请采纳这个形状。
 *
 * 规则：资源只有一个动画（或只有一帧）时只给 `asset` 就够；否则必须给 `anim`。
 * **没有 `state`** —— 票 26 把「状态」降格成了「单帧动画」，它就是一个 `anim`。
 */
export const AssetPackRef = z.object({
  asset: z.string().min(1),
  anim: z.string().optional(),
}).strict();

export type AssetPackRef = z.infer<typeof AssetPackRef>;

export type ResolveResult =
  | { ok: true; asset: AssetPackEntry; frames: FrameRef[]; animation: Animation | null }
  | { ok: false; error: string };

/**
 * **构建期静态解析**：把一个引用解到具体的帧列表上。解不到就失败，绝不留到运行时。
 *
 * 为什么必须在这个时机报错：产物 B 的运行时外壳是手写固定、不做校验的，
 * 而 Phaser 的 loader **整个建立在 XHR 上且静默失败** —— `file://` 下游戏能启动、
 * canvas 出来、一张图都不加载且不报错（[票 03](../../../.scratch/game-creation-v1/issues/03-phaser-vite-playwright-chain.md) 实测）。
 * 构建期是**唯一**还能报出「哪个资源被哪个引用点引用」的地方。
 */
export function resolvePackRef(ref: AssetPackRef, manifest: AssetPackManifest): ResolveResult {
  const asset = manifest.assets.find((a) => a.id === ref.asset);
  if (!asset) return { ok: false, error: `包里没有资源 "${ref.asset}"` };

  const animations = asset.animations ?? [];
  const byName = new Map(asset.frames.map((f) => [f.name, f]));
  const collect = (names: readonly string[], anim: Animation): ResolveResult => {
    const frames: FrameRef[] = [];
    for (const fn of names) {
      const f = byName.get(fn);
      if (!f) return { ok: false, error: `动画 "${anim.name}" 引用了不存在的帧 "${fn}"` };
      frames.push(f);
    }
    return { ok: true, asset, frames, animation: anim };
  };

  if (ref.anim !== undefined) {
    const anim = animations.find((a) => a.name === ref.anim);
    if (!anim) {
      const known = animations.map((a) => a.name).join(", ") || "（无）";
      return { ok: false, error: `资源 "${ref.asset}" 没有名为 "${ref.anim}" 的动画（可选：${known}）` };
    }
    return collect(anim.frames, anim);
  }

  // 没给 anim：只有在它确实只有一个「可画的东西」时才无歧义
  if (animations.length === 1) return collect(animations[0]!.frames, animations[0]!);
  if (animations.length === 0 && asset.frames.length === 1) return { ok: true, asset, frames: asset.frames, animation: null };
  return {
    ok: false,
    error: `资源 "${ref.asset}" 有多个可画的动画，引用必须指明 anim（可选：${animations.map((a) => a.name).join(", ")}）`,
  };
}
