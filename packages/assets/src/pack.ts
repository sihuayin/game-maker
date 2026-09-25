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
import { paletteBindingOf, type AssetPackManifest, type AssetSpec, type DrawList, type StyleSpec } from "@game-maker/contracts";
import { buildAtlas } from "./atlas.js";
import { emptyImage, inkBBox, type RasterImage } from "./image.js";
import { importBitmap, sliceGrid } from "./import.js";
import { encodePNG, decodePNG } from "./png.js";
import { rasterize } from "./raster.js";

/** drawlist 的生成端口。**由票 22 提供实现**；本模块只调用。 */
export type DrawListGenerator = (spec: AssetSpec, style: StyleSpec) => DrawList[] | Promise<DrawList[]>;

export type BuildPackOptions = {
  recipe: { id: string; styleRef: string; assets: readonly { spec: AssetSpec; source: AssetSourceLike }[] };
  style: StyleSpec;
  /** 产物根目录。**必填** —— 产物不属于任何单个包（票 29），由调用方定。
   *  实际写入 `outDir/<recipe.id>/pack/v<N>/`。 */
  outDir: string;
  generate: DrawListGenerator;
  /** 覆盖 `createdAt`（可复现构建）。不给则读 `SOURCE_DATE_EPOCH`，再不给用当前时间。 */
  sourceDateEpoch?: number;
  generator?: { name: string; version: string; run?: string };
  /**
   * provenance 里由**调用方**决定的两块（票 14）：
   * 降级记录与传输诊断。降级链在**整包**层面决定，组装只负责如实写下来。
   */
  provenance?: {
    degradations?: { stage: string; assetId?: string; reason: string; fellBackTo: string }[];
    transport?: { preferred: string; used: string; switches: { from: string; to: string; reason: string }[] };
  };
  /** 逐资源的进度回报（MCP 的 `notifications/progress` 用它，票 30）。 */
  onProgress?: (done: number, total: number, assetId: string) => void;
};

type AssetSourceLike =
  | { kind: "generate" }
  | {
      kind: "import"; ref: string;
      sheet?: { columns: number; rows: number; frameWidth: number; frameHeight: number; offsetX?: number; offsetY?: number; spacingX?: number; spacingY?: number; names: string[]; animations?: { name: string; frames: string[] }[] };
      background?: { tolerance: number };
      alphaThreshold?: number | null;
    };

export type BuildPackResult = {
  manifest: AssetPackManifest;
  packDir: string;
  /** spec ↔ 产物的对账结果（`auditAssetSpec`）。**有内容不等于失败** —— 交调用方决定。 */
  audit: string[];
};

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

/** 一个资源在清单里声明的帧名（生成路径：按 spec 的 animations 顺序分配）。 */
function framePlan(spec: AssetSpec): { name: string; anim: string | null }[] {
  if (spec.kind === "animation") {
    return spec.animations.flatMap((a) =>
      Array.from({ length: a.frames }, (_, i) => ({ name: `${spec.id}.${a.name}${a.frames > 1 ? i + 1 : ""}`, anim: a.name })));
  }
  return [{ name: spec.id, anim: null }];
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

  type Built = { spec: AssetSpec; origin: "generated" | "imported"; paletteBinding: "exact" | "composited" | "quantized"; frames: { name: string; state?: string; image: RasterImage }[]; animations?: { name: string; frames: string[]; fps?: number; loop: boolean }[]; authoring: { kind: "drawlist" | "bitmap"; ref: string; original?: string }[] };
  const built: Built[] = [];

  for (const [idx, entry] of recipe.assets.entries()) {
    const spec = entry.spec;
    opts.onProgress?.(idx, recipe.assets.length, spec.id);
    const plan = framePlan(spec);
    const frames: Built["frames"] = [];
    const authoring: Built["authoring"] = [];
    let origin: Built["origin"] = "generated";
    let binding: Built["paletteBinding"] = "exact";

    if (entry.source.kind === "generate") {
      const drawlists = await generate(spec, style);
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
    } else {
      // ⚠️ 先把 source 取出来再进闭包 —— 闭包里会丢掉判别式的收窄
      const src = entry.source;
      origin = "imported";
      binding = "quantized";   // 票 23 的裁决：导入位图默认量化到世界色板
      const srcPath = path.resolve(src.ref);
      const img = decodePNG(fs.readFileSync(srcPath));
      const names = src.sheet?.names ?? [spec.id];
      const crops = src.sheet ? sliceGrid(img, src.sheet) : [img];
      if (crops.length !== names.length) throw new Error(`资源 "${spec.id}"：网格切出 ${crops.length} 帧，清单给了 ${names.length} 个名字`);
      const animOf = new Map<string, string>();
      for (const a of src.sheet?.animations ?? []) for (const n of a.frames) animOf.set(n, a.name);
      names.forEach((name, i) => {
        const r = importBitmap(crops[i]!, {
          palette, targetWidth: spec.size.w, targetHeight: spec.size.h,
          ...(src.background !== undefined ? { background: src.background } : {}),
          ...(src.alphaThreshold !== undefined ? { alphaThreshold: src.alphaThreshold } : {}),
        });
        const dest = `authoring/imported/${name}${path.extname(srcPath)}`;
        fs.writeFileSync(path.join(packDir, dest), encodePNG(crops[i]!));
        // `original` 直接写清单里那个仓库相对路径 —— 用 process.cwd() 会让 manifest 随 cwd 变，
        // 而「同一输入两次生成逐字节相同」是 checksum 成立的前提。
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
    built.push({ spec, origin, paletteBinding: binding, frames, ...(animations ? { animations } : {}), authoring });
  }

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
    const { json, image } = buildAtlas(group.flatMap((b) => b.frames.map((f) => ({
      name: f.name, image: f.image, anchor: b.spec.anchor,
      ...(b.spec.kind === "ui" && b.spec.ninePatch
        ? { scale9Borders: { x: b.spec.ninePatch.left, y: b.spec.ninePatch.top,
            w: b.spec.size.w - b.spec.ninePatch.left - b.spec.ninePatch.right,
            h: b.spec.size.h - b.spec.ninePatch.top - b.spec.ninePatch.bottom } }
        : {}),
    }))));
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
  const origins = built.map((b) => b.origin);
  const allOf = (v: string) => origins.every((o) => o === v);
  const epoch = opts.sourceDateEpoch ?? Number(process.env.SOURCE_DATE_EPOCH ?? Math.floor(Date.now() / 1000));
  const manifest: AssetPackManifest = {
    format: "assetpack/v1",
    id: recipe.id,
    version,
    createdAt: new Date(epoch * 1000).toISOString(),
    generator: { name: opts.generator?.name ?? "game-maker", version: opts.generator?.version ?? "0.0.0", ...(opts.generator?.run ? { run: opts.generator.run } : {}) },
    provenance: {
      mode: allOf("fixture") ? "fixture" : allOf("generated") ? "generated" : "mixed",
      style: { origin: "human-in-session", ref: "authoring/stylespec.json", stylespecId: style.id, checksum: sha256(Buffer.from(styleDoc)) },
      degradations: opts.provenance?.degradations ?? [],
      ...(opts.provenance?.transport ? { transport: opts.provenance.transport } : {}),
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
    assets: built.map((b) => ({
      id: b.spec.id, kind: b.spec.kind, role: b.spec.role, origin: b.origin,
      paletteBinding: b.paletteBinding, required: b.spec.required,
      // ⚠️ 尺寸取**实际产出**的，不是 spec 声明的 —— 对账时两者不一致才有意义
      size: { w: b.frames[0]!.image.width, h: b.frames[0]!.image.height },
      anchor: b.spec.anchor,
      atlasId: atlasIdOf.get(b.spec.id)!,
      // 帧只有名字（票 26：`state` 已降格为单帧动画，不是帧的属性）
      frames: b.frames.map((f) => ({ name: f.name })),
      ...(b.animations ? { animations: b.animations } : {}),
      authoring: b.authoring,
    })),
    files: [],
  };
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
  return { manifest, packDir: finalDir, audit };
}
