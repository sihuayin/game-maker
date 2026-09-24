// assetpack/v1 的 Zod 草案 —— 票 24 的产物。
//
// 落进 packages/contracts 要等票 29（monorepo 切分）resolved，这里先立形状。
// 与现有 AssetManifestSchema（demo/src/contracts/index.ts:69）**不是同一个东西**：
//   - AssetManifest  = 输入侧 + 旧闭环的过程统计（generated/missing/broken/unused）→ 归票 28 的资源清单
//   - AssetPackManifest = 交付物**自身**的自描述 → 本票
// 两者不共用类型，也不互相扩展。
import { z } from 'zod';

/** 色板引用：`palette:N`。**硬编码色值由 schema 直接拒绝** —— 这是构造恒真的落点。 */
export const PaletteRef = z.string().regex(/^palette:\d+$/, 'color must be a palette:<index> reference');

/** 包内路径：相对包根、POSIX 分隔符。绝不出现绝对路径（包要能整体搬走）。 */
const PackPath = z.string().regex(/^(?!\/)(?!.*\.\.\/)[A-Za-z0-9._/-]+$/, 'must be a pack-relative POSIX path');

const Checksum = z.string().regex(/^sha256:[0-9a-f]{64}$/);

const Anchor = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const NinePatch = z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative(), w: z.number().int().positive(), h: z.number().int().positive() });

export const AssetKind = z.enum(['sprite', 'animation', 'background', 'ui']);

const FrameRef = z.object({
  name: z.string().min(1),               // 图集里的帧名，也是 B 引用它的名字
  state: z.string().optional(),          // 静态外观；缺省 = 单状态资源
  index: z.number().int().nonnegative().optional(),
  durationMs: z.number().positive().optional(), // 逐帧时长；帧级，缺省走 animation.fps
});

const Animation = z.object({
  name: z.string().min(1),
  frames: z.array(z.string().min(1)).min(1),
  fps: z.number().positive().optional(),
  loop: z.boolean().default(true),
});

export const AssetPackEntry = z.object({
  id: z.string().min(1),
  kind: AssetKind,
  role: z.string(),
  /** 谁造的：generated = 本管线从规格产出；imported = 人工导入通道；fixture = 仓库内置的降级件 */
  origin: z.enum(['generated', 'imported', 'fixture']),
  /** 颜色与色板的关系。exact 是**可验证的**声明（光栅化后扫像素），不是承诺。 */
  paletteBinding: z.enum(['exact', 'quantized', 'unbound']),
  required: z.boolean().default(true),
  size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }).nullable(),
  anchor: Anchor,
  scale9Borders: NinePatch.optional(),
  atlasId: z.string().min(1),
  frames: z.array(FrameRef).min(1),
  animations: z.array(Animation).optional(),
  /** 创作态来源。这是「创作态 ↔ 交付态」的唯一联结处。 */
  authoring: z.array(z.object({ kind: z.enum(['drawlist', 'bitmap']), ref: PackPath, original: z.string().optional() })),
}).superRefine((a, ctx) => {
  // 状态与帧名的唯一性 —— 确定性校验，不是评分（R2 只砍了评分与修复）
  const names = new Set();
  for (const f of a.frames) {
    if (names.has(f.name)) ctx.addIssue({ code: 'custom', message: `duplicate frame name "${f.name}"`, path: ['frames'] });
    names.add(f.name);
  }
  for (const an of a.animations ?? [])
    for (const fn of an.frames)
      if (!names.has(fn)) ctx.addIssue({ code: 'custom', message: `animation "${an.name}" references unknown frame "${fn}"`, path: ['animations'] });
});

export const AtlasEntry = z.object({
  id: z.string().min(1), kind: AssetKind,
  meta: PackPath, image: PackPath,
  size: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  frames: z.number().int().positive(),
  assets: z.array(z.string()),
  checksum: Checksum,
});

export const AssetPackManifest = z.object({
  format: z.literal('assetpack/v1'),
  id: z.string().min(1),
  /** 包版本。**绝不覆盖**：v1 与 v2 是两个并存的目录，旧版本永久保留。 */
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  generator: z.object({ name: z.string(), version: z.string(), run: z.string().optional(), deterministic: z.string().optional() }),
  provenance: z.object({
    mode: z.enum(['generated', 'fixture', 'mixed']),  // 一个不知道自己是 fixture 的包是虚假的包
    style: z.object({ origin: z.enum(['human-in-session', 'fixture']), ref: PackPath, stylespecId: z.string(), checksum: Checksum }),
    degradations: z.array(z.object({ stage: z.string(), assetId: z.string().optional(), reason: z.string(), fellBackTo: z.string() })).default([]),
  }),
  palette: z.object({
    ref: z.string(), size: z.number().int().positive(), values: z.array(z.string().regex(/^#[0-9a-f]{6}$/)),
    coverage: z.object({ exact: z.number().int(), quantized: z.number().int(), unbound: z.number().int() }),
  }).superRefine((p, ctx) => {
    if (new Set(p.values).size !== p.values.length) ctx.addIssue({ code: 'custom', message: 'palette has duplicate colors — palette:N would be ambiguous' });
    if (p.values.length !== p.size) ctx.addIssue({ code: 'custom', message: 'palette.size ≠ values.length' });
  }),
  atlases: z.array(AtlasEntry).min(1),
  assets: z.array(AssetPackEntry).min(1),
  files: z.array(z.object({ path: PackPath, bytes: z.number().int().nonnegative(), checksum: Checksum })).min(1),
}).superRefine((m, ctx) => {
  const atlases = new Set(m.atlases.map((a) => a.id));
  const ids = new Set();
  for (const a of m.assets) {
    if (ids.has(a.id)) ctx.addIssue({ code: 'custom', message: `duplicate asset id "${a.id}"`, path: ['assets'] });
    ids.add(a.id);
    if (!atlases.has(a.atlasId)) ctx.addIssue({ code: 'custom', message: `asset "${a.id}" points at unknown atlas "${a.atlasId}"`, path: ['assets'] });
    // paletteBinding 与 origin 的一致性：fixture 可以是任何绑定，但 unbound 必须有降级记录
    if (a.paletteBinding === 'unbound' && !m.provenance.degradations.some((d) => d.assetId === a.id))
      ctx.addIssue({ code: 'custom', message: `asset "${a.id}" is paletteBinding:"unbound" but has no degradation record`, path: ['provenance'] });
  }
  for (const at of m.atlases)
    for (const id of at.assets) if (!ids.has(id)) ctx.addIssue({ code: 'custom', message: `atlas "${at.id}" claims unknown asset "${id}"`, path: ['atlases'] });
  // provenance.mode 由 per-asset origin 唯一派生 —— 「谎报自己是 generated」在 schema 层面就不可能。
  const o = m.assets.map((a) => a.origin);
  const all = (v) => o.every((x) => x === v);
  const expectedMode = all('fixture') ? 'fixture' : all('generated') ? 'generated' : 'mixed';
  if (m.provenance.mode !== expectedMode)
    ctx.addIssue({ code: 'custom', message: `provenance.mode "${m.provenance.mode}" contradicts asset origins (expected "${expectedMode}")`, path: ['provenance', 'mode'] });

  const fileSet = new Set(m.files.map((f) => f.path));
  for (const at of m.atlases) {
    if (!fileSet.has(at.meta)) ctx.addIssue({ code: 'custom', message: `atlas "${at.id}".meta not in files[]`, path: ['files'] });
    if (!fileSet.has(at.image)) ctx.addIssue({ code: 'custom', message: `atlas "${at.id}".image not in files[]`, path: ['files'] });
  }
  for (const a of m.assets)
    for (const src of a.authoring)
      if (!fileSet.has(src.ref)) ctx.addIssue({ code: 'custom', message: `asset "${a.id}" authoring ref "${src.ref}" not in files[]`, path: ['files'] });
});

/** B 侧对包内资源的引用。票 09（Game Config）必须给出**同一个答案**。 */
export const AssetPackRef = z.object({
  asset: z.string().min(1),
  state: z.string().optional(),
  anim: z.string().optional(),
});
