# B · 资源包、图集与动画数据结构（票 02）

- **票**：[02-b-pack-atlas-animation](../issues/02-b-pack-atlas-animation.md)
- **任务书**：[docs/v5/动画.md](../../../docs/v5/动画.md) §4.2、§5、§7（本报告对应 §4.2 的 10 问）
- **基线**：`main` · `f0dac01`（2026-10-21）。工作树非干净；行号均为 HEAD 当前行号。
- **性质**：只读取证。未改资源 / Schema / 配置 / 锁文件；未重生成；未提交；未写 `out/`；零付费。
  未跑 `pnpm check` / `pnpm build`。运行过的命令只有定向 `vitest`、只读 `verify` / `inspect`、
  以及 `/tmp` 里自建的合成探针（不复制 v7 / fixtures）。
- **状态词**：只用 `implemented` / `partial` / `missing` / `unverified`。
- **同批研究**：[a-architecture](a-architecture.md) · [c-deterministic-checks](c-deterministic-checks.md) ·
  [f-runtime](f-runtime.md) · [g-report-traceability](g-report-traceability.md)。本报告对每条结论都重新读了
  HEAD 源码 / 测试 / 真实产物；同批报告只在明确的交叉引用处出现，不作为本报告的证据来源。

---

## 0. 结论先行

1. **正式格式是 `assetpack/v4`**：包根一份 `manifest.json`，四类资源按 kind 各一张
   `delivery/atlas.<kind>.json`（TexturePacker JSON Hash）+ `.png`，外加 `authoring/` 与
   `ledger.json` / `coverage.json` 两个 sidecar（`packages/contracts/src/assetpack.ts:57`；
   `packages/assets/src/pack.ts:1143-1165`；`CONTEXT.md:170-185`）。状态：`implemented`。
2. **帧的表示是「名字 + 显式有序列表」**：`FrameRef` 只有 `name` 是生产者真正写的；
   `index` 与 `durationMs` 是契约允许但**零生产者、零消费者**的死字段
   （`assetpack.ts:150-155`；`pack.ts:1221`；全仓 grep 见 §4）。状态：`partial`。
3. **`anchor` / `size` 各存两份**（manifest 资源级 + 图集逐帧），壳子拿 manifest 那份算盒子、
   Phaser 拿图集那份当逐帧 origin —— 两边**没有任何跨文件一致性检查**。状态：`partial`。
4. **`fps` / `loop` 只写进 manifest，运行时从不读**：玩家写死 `run ? 10 : 6`，实体写死 `8`，
   全部 `repeat: -1`（`packages/demo/src/shell/scene.ts:140,193`）。v7 的 `jump` 声明
   `fps:10, loop:false`，实际以 6fps 无限循环。状态：`missing`（播放参数消费）。
5. **五层合法性不齐**：manifest schema 很实（`parseAssetPack`，40 个契约用例）；
   **图集 JSON 没有任何 schema**；`verify` 只验 schema + 文件 + checksum，且不在创建链上；
   `inspect` 会解码，但对图集里缺失的帧**静默跳过**（`ops.ts:1772-1773`）。
   状态：L1 `implemented`（仅 manifest）· L2 `partial` · L3 `partial` · L4 `partial` · L5 `partial`。
6. **v7 `scavenger-actor` idle 4 帧全链路是通的**：源 PNG → manifest 动画 → 图集矩形 →
   `game-config` → `site/v3` → Phaser。HEAD 上已有运行时采样：玩家在 `idle1→idle2→idle3→idle4`
   间以 ~168ms（6fps）循环（§9）。状态：`implemented`（帧推进）；参数语义 `missing`；
   视觉正确性 `unverified`（归票 05）。
7. **报告关联只到「包」这一层**：manifest 的 `id + version + files[].checksum` 足以钉住包字节；
   但 `qa-report/v1` **没有 id / version / checksum / createdAt**，且 `run/v<N>` 与 `pack/v<M>`
   允许不同号（`create-game.ts:439-441`）。状态：`partial`。

### 0.1 状态矩阵

| 能力 | 状态 | 一句证据 |
|---|---|---|
| 包格式定义（`assetpack/v4`） | implemented | `assetpack.ts:57,265-333`；CONTEXT:170-185 |
| manifest schema + 包内引用校验 | implemented | `assetpack.ts:194-251,300-333`；`assetpack.test.ts` 40 用例通过 |
| 图集 JSON schema | missing | 全仓无 `AtlasJson` 的 zod schema；`atlas.ts:21-34` 只是 TS 类型 |
| 图集 / 动画元数据生成 | implemented | `atlas.ts:55-92`；`pack.ts:1143-1165,1050-1056` |
| 帧有序引用（manifest 内） | implemented | `Animation.frames`（`assetpack.ts:157-162`）；`resolvePackRef`（`:377-426`） |
| `FrameRef.index` / `durationMs` | partial（字段在、零使用） | `assetpack.ts:153-154`；`pack.ts:1221` |
| anchor 表达与运行时使用 | implemented | manifest→盒子；图集→Phaser `customPivot`（§5） |
| anchor / size 跨文件一致性检查 | missing | 无代码读图集 JSON 做对账；`verify` 不解析图集 |
| fps / loop 表达 | implemented | `assetpack.ts:160-161`；`pack.ts:1054-1055` |
| fps / loop 运行时生效 | missing | `scene.ts:140,193` 写死；`inspect` 是唯一读者（`ops.ts:1950`） |
| Game Config 逐引用覆盖播放参数 | missing | `game-config.ts:74-81,144-155` 无 fps/loop；CONTEXT:315 却声称可以 |
| 文件存在 + checksum | partial | `verifyPack`（`ops.ts:1662-1714`）手动；`runBuild` 不调用 |
| 文件可解码 | partial | 生成期解码输入；交付态只有 `inspect` 解码且不阻断 |
| manifest → 图集 JSON 引用完整性 | missing | `/tmp` 探针：缺帧 + 非 PNG 仍 `verify` 通过（§7.2） |
| config → pack 引用完整性 | implemented | `auditReferences`（`game-config.ts:271-337`）；`world.ts:133-166` |
| 动画帧序列真的在播放 | implemented（HEAD 运行证据） | `runs/2026-10-21-runtime/samples-idle.json`：4 帧、~168ms |
| 按声明参数正确播放 | missing | 同上采样里 `fps:6` 是硬编码值，不是 manifest 的通用值 |
| 报告 ↔ 包关联 | partial | 包侧字段够；`qa-report/v1`（`qa.ts:266-274`）无身份字段 |

---

## 1. 数据路径（真实调用链）

```
AssetRecipe（asset-recipe.json，人工可改）
  │  buildAssetPack / packAssets            packages/assets/src/pack.ts:307,1508
  ├─ framePlan(spec)                        packages/assets/src/prompt.ts:148-162
  │    帧名：<id>.<anim><n> / <id>.<layer> / <id>
  ├─ 创作态位图：drawlist 光栅化 / 生图 / 导入
  ├─ buildAtlas(frames) → atlas.<kind>.json + .png
  │                                        packages/assets/src/atlas.ts:55-92
  ├─ manifest.assets[].animations[]        packages/assets/src/pack.ts:1050-1056
  ├─ manifest.atlases[]                    packages/assets/src/pack.ts:1143-1165
  ├─ files[] = walk(packDir) 逐文件 sha256  packages/assets/src/pack.ts:1263-1271
  ├─ 自校验 parseAssetPack(onDisk)          packages/assets/src/pack.ts:1280-1288
  └─ rename .building-* → pack/v<N>         packages/assets/src/pack.ts:1298

game-config.json（compileRuntime 或人手写）
  │  引用形状 {asset, anim?} / player.anims{idle,run,jump}
  ├─ auditReferences / resolvePackRef       packages/contracts/src/game-config.ts:271-337
  └─ resolveDraw / buildWorld               packages/demo/src/draw.ts:143-164; world.ts:90-196

site/v<N>（site.json + shell.js + game-config.json）  packages/demo/src/layout.ts:75-119
  │  外壳：fetch site.json → ../../pack/<v>/manifest.json → fetch game-config.json
  │                                        packages/demo/src/shell/entry.ts:45-67
  ├─ buildWorld(manifest, config)           packages/demo/src/world.ts:90
  ├─ atlasList → Phaser load.atlas          packages/demo/src/draw.ts:173-177; shell/scene.ts:33-36
  └─ anims.create(frames 名字列表) → play   packages/demo/src/shell/scene.ts:137-141,190-195
```

关键点：**manifest 是运行时唯一入口**（`assetpack.ts:1-16`），图集 JSON 只被 Phaser 与
`inspect` / `review` 读；运行时纯层（`world.ts` / `draw.ts`）**不读图集 JSON**，只读 manifest。
因此 manifest 与图集之间的引用正确性**不可能**由运行时纯层发现。

---

## 2. 正式格式与各站点的产物

包目录（v7 真实样本）：

```
.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/
├── manifest.json                       # 唯一入口
├── delivery/
│   ├── atlas.animations.json / .png    # 61 帧，256×760
│   ├── atlas.backgrounds.json / .png   # 3 帧，640×1080
│   ├── atlas.sprites.json / .png       # 9 帧，96×488
│   └── atlas.ui.json / .png            # 3 帧，48×64
├── authoring/
│   ├── generated/  (逐帧原图 + prompt.txt)
│   ├── imported/   (人工导入原图)
│   ├── drawlist/   (drawlist 帧)
│   ├── masters/    (创作态母版)
│   ├── stylespec.json
│   └── visual-world.json
├── coverage.json                       # assetpack-coverage/v1（packId+packVersion）
└── ledger.json                         # assetpack-ledger/v1（packId+packVersion）
```

- 图集格式是 **TexturePacker JSON Hash**，按 kind 分四张（`sprite/animation/background/ui`）；
  文件名 `delivery/atlas.<name>.{json,png}`（`pack.ts:1144-1165`）。选它的理由是 Phaser 原生读、
  零转换器（`assetpack.ts:256`；`atlas.ts:3-5`）。
- 图集 JSON 的字段是 `frame/rotated/trimmed/spriteSourceSize/sourceSize`，可选
  `anchor` / `scale9Borders`（`atlas.ts:21-34,77-86`）。`meta` 被写但不被 Phaser 使用
  （`atlas.ts:5-6,89`）。
- **图集 JSON 没有 schema**：`atlas.ts` 只有 TS 类型；`inspect` / `review` 都直接
  `JSON.parse` 后按 `frames` 对象用（`ops.ts:1764-1765`；`review.ts:28-31`）。
- `manifest.json` 自身**不在 `files[]` 里**（自指；`assetpack.ts:298-299`；`pack.ts:1266`），
  所以包没有「清单自哈希」。

---

## 3. 数据结构表

### 3.1 `AssetPackManifest`（顶层）

| 字段 | 必填 | 生产者 | 消费者 | 校验入口 | 证据 |
|---|---|---|---|---|---|
| `format` | 是 | pack | parseAssetPack / 所有读者 | `literal("assetpack/v4")` | `assetpack.ts:57,266` |
| `id` | 是 | pack（=recipe.id） | verify / inspect / site / QA / 报告 | min(1) | `assetpack.ts:267`；`pack.ts:1174` |
| `version` | 是 | pack（父分配） | verify / inspect / site / ledger / coverage | int>0 | `assetpack.ts:269`；`pack.ts:1175` |
| `createdAt` | 是 | pack（SOURCE_DATE_EPOCH） | **零消费者** | ISO datetime | `assetpack.ts:270`；`pack.ts:1178` |
| `generator{name,version,run?}` | 是（run 可选） | pack（**run 零生产者**） | **零消费者** | strict | `assetpack.ts:271`；`pack.ts:1179`；`packAssets` 不传 generator（`ops.ts:1552-1572`） |
| `provenance.mode` | 是 | pack（derivePackMode） | verify / inspect 打印 | 与 assets[].origin 对账 | `assetpack.ts:272-287,318-322` |
| `palette{ref,size,values,coverage}` | 是 | pack | QA `palette-binding`；inspect | 长度/去重 | `assetpack.ts:288-295,303-305`；`qa/src/visual.ts:157-174` |
| `atlases[]` | 是（≥1） | pack | draw.ts / ops / review | `AtlasEntry` + 互指 | `assetpack.ts:253-263,296,307-316` |
| `assets[]` | 是（≥1） | pack | world / QA / ops / report | `AssetPackEntry` | `assetpack.ts:164-251,297` |
| `files[]` | 是（≥1） | pack（walk 穷举） | verify | path/bytes/checksum | `assetpack.ts:298-299,324-332`；`pack.ts:1263-1271` |

### 3.2 `AssetPackEntry`（资源）

| 字段 | 必填/可选 | 生产者 | 消费者 | 校验入口 | 证据 |
|---|---|---|---|---|---|
| `id` | 必填 | spec.id | 所有引用点 | 包内唯一 | `assetpack.ts:165,309-311` |
| `kind` | 必填 | spec.kind | `auditReferences` 种类核对；atlas 分组 | 四值枚举 | `assetpack.ts:105,166`；`game-config.ts:284-292` |
| `role` | 必填 | spec.role | **运行时零消费者**（人读 / 提示词） | string | `assetpack.ts:167` |
| `origin` | 必填 | pack（generated/imported） | `derivePackMode` | 两值枚举 | `assetpack.ts:120,168` |
| `paletteBinding` | 必填 | pack | QA `palette-binding` | 四值枚举 | `assetpack.ts:113,169` |
| `required` | 默认 `true` | spec.required | **全仓零读者** | boolean | `assetpack.ts:170`；`pack.ts:1209` |
| `size` | 必填 | pack（**取第一帧实际尺寸**） | world 盒子 / HUD / `assetSize` | w,h 正整数 | `assetpack.ts:174`；`pack.ts:1211`；`draw.ts:128-130,157` |
| `anchor` | 必填 | spec.anchor | world 盒子 / `anchorOf` | [0,1] | `assetpack.ts:73,175`；`draw.ts:123-126` |
| `scale9Borders` | 可选 | pack（scale9Of） | `auditPanelSize`；壳读图集那份 | NinePatch | `assetpack.ts:176`；`game-config.ts:373` |
| `layers` | 可选（仅 background） | pack（从 spec 剥 description） | `buildBackground` | 层/帧一一对应 + 帧名 | `assetpack.ts:181-182,226-241`；`draw.ts:200-235` |
| `atlasId` | 必填 | pack（按 kind 固定） | draw / atlas 查找 | 必须存在；**不查反向包含** | `assetpack.ts:184,312-316` |
| `frames[]` | 必填（≥1） | pack（`{name}`） | resolvePackRef / world / QA | 帧名唯一 | `assetpack.ts:185,195-199`；`pack.ts:1221` |
| `animations[]` | 可选 | pack（仅 kind=animation） | resolvePackRef / world | 帧存在、名字唯一、多帧必归组 | `assetpack.ts:186,200-221,247-250` |
| `authoring[]` | 必填 | pack | 追溯 / QA drawlist 对账 | ref 必须在 files[] | `assetpack.ts:187-193,330-332` |

### 3.3 `FrameRef` / `Animation`

| 字段 | 必填/可选 | 生产者 | 消费者 | 语义 / 证据 |
|---|---|---|---|---|
| `FrameRef.name` | 必填 | pack | manifest / atlas JSON / Phaser 的**唯一连接键** | `assetpack.ts:151-152`；`atlas.ts:86` |
| `FrameRef.index` | 可选 | **零生产者** | **零消费者** | `assetpack.ts:153`；`pack.ts:1221` 只写 name |
| `FrameRef.durationMs` | 可选 | **零生产者** | **零消费者** | `assetpack.ts:154`；全仓 grep 仅契约与 dist 类型 |
| `Animation.name` | 必填 | spec | config 引用 / resolvePackRef | 包内资源内唯一 | `assetpack.ts:158,217-221` |
| `Animation.frames[]` | 必填（≥1） | pack（按 state 过滤，保持帧数组顺序） | world → Phaser | **顺序就是播放顺序** | `assetpack.ts:159`；`pack.ts:1053` |
| `Animation.fps` | 可选 | spec.fps | **只有 `inspect` 打印** | 正数；运行时零读者 | `assetpack.ts:160`；`ops.ts:1950` |
| `Animation.loop` | 默认 `true` | spec.loop（pack 总是写出） | **只有 `inspect` 打印** | 运行时零读者 | `assetpack.ts:161`；`pack.ts:1055`；`ops.ts:1950` |

### 3.4 `AtlasEntry` 与图集 JSON

| 字段 | 必填 | 生产者 | 消费者 | 校验入口 | 证据 |
|---|---|---|---|---|---|
| `id` | 必填 | pack（kind 名） | 资源 `atlasId` | 资源→图集必须存在 | `assetpack.ts:254,312` |
| `kind` | 必填 | pack | **零消费者** | 四值枚举 | `assetpack.ts:255` |
| `meta` | 必填 | pack | draw.ts / inspect / review | PackPath + 必须在 files[] | `assetpack.ts:257,327`；`draw.ts:175` |
| `image` | 必填 | pack | draw.ts / shell load | PackPath + 必须在 files[] | `assetpack.ts:258,328`；`draw.ts:175` |
| `size` | 必填 | pack（实际图尺寸） | **零消费者**（不核对 PNG） | 正整数 | `assetpack.ts:259` |
| `frames` | 必填 | pack（求和） | **零消费者**（不核对 JSON 键数） | 正整数 | `assetpack.ts:260` |
| `assets` | 必填 | pack（排序） | 只剩 schema 的**单向**存在性检查 | 每项必须是已存在资源 | `assetpack.ts:261,314-316` |
| `checksum` | 必填 | pack（PNG sha256） | **零消费者** | 格式；**不与 PNG 对账** | `assetpack.ts:262`；`ops.ts:1672-1679` 只比 files[] |

图集 JSON（无 schema，事实字段）：

| 字段 | 必填（buildAtlas 总是写） | 消费者 | 语义 |
|---|---|---|---|
| `frames.<name>.frame{x,y,w,h}` | 是 | Phaser / inspect / review | 图集内的像素矩形；**没有越界检查** |
| `rotated` / `trimmed` | 是（恒 false） | Phaser | 本项目不做旋转 / trim（`atlas.ts:79-82`） |
| `spriteSourceSize{x,y,w,h}` | 是 | Phaser | 恒等于 frame 尺寸（未 trim） |
| `sourceSize{w,h}` | 是 | Phaser | 锚点的分母；恒等于 frame 尺寸 |
| `anchor{x,y}` | 可选 | Phaser `customPivot` | 逐帧 origin；pack 给每帧都写资源级锚点 |
| `scale9Borders{x,y,w,h}` | 可选 | Phaser `setScale9`；壳探测 | 九宫格中央矩形 |
| `meta{...}` | 是 | 本项目无人读 | TexturePacker 惯用块 |

### 3.5 sidecar / 其它

| 文件 | 关键字段 | 生产者 | 消费者 | 证据 |
|---|---|---|---|---|
| `ledger.json` | `format=assetpack-ledger/v1` · `packId` · `packVersion` · `calls[]` | pack | verify（schema + 身份对账） | `contracts/src/ledger.ts:156-160`；`ops.ts:1683-1692` |
| `coverage.json` | `format` · `packId` · `packVersion` · `layers[]` | pack | site（层覆盖） | `contracts/src/coverage.ts`；`ops.ts:1251-1262` |
| `master-ratios.json` | `packId` · `packVersion` · `masters[]` | pack（可选） | verify（schema + 身份） | `ops.ts:1699-1707` |
| `authoring/stylespec.json` | 色板等 | pack（从 style 写出） | QA palette-binding 的存在性 | `pack.ts:1169-1170`；`qa/src/visual.ts:168-172` |
| `authoring/visual-world.json` | VisualWorldSpec | pack（调用方给） | 人 / 追溯 | `pack.ts:104` 附近注释；v7 实际存在 |
| `authoring/generated/*.prompt.txt` | 逐帧提示词 | pack | 人 / 追溯 | v7 实际存在，进 files[] |

---

## 4. 帧：表示、排序、引用

- **表示**：交付态一帧 = 图集 JSON 里的一个 `frames[<name>]` 矩形；manifest 里对应一个
  `FrameRef{name}`。manifest **不写 x/y/w/h**（`assetpack.ts:9-14,173`）。
- **命名**：`framePlan` 给出约定 `<资源 id>.<动画名><序号>`（多帧时从 1 开始；单帧动画不带序号），
  分层背景是 `<资源 id>.<层名>`，单帧资源就是 `<资源 id>`（`prompt.ts:148-162`）。
  但**消费者不许解析名字**（`assetpack.ts:150-151` 注释）——名字只是连接键。
- **排序**：
  - manifest 内 `frames[]` 的顺序由 `framePlan` / `src.sheet.names` 决定（`pack.ts:1007-1010,1039-1048`）；
  - `animations[].frames[]` 用 `frames.filter(state===anim)` 生成，因此**继承 frames[] 的顺序**
    （`pack.ts:1050-1056`；`pack-frames.test.ts` 断言两帧顺序）；
  - 运行时按这个数组顺序建 Phaser 动画（`scene.ts:140,193`），所以**顺序就是播放顺序**；
  - 图集 JSON 的对象键顺序**不承载语义**（Phaser 按名字取帧）。
- **引用**：动画 → 帧 = `Animation.frames[]` 里的名字；config → 动画 = `{asset, anim}`；
  world → Phaser = `res.frames.map(f=>f.name)`。`resolvePackRef` 是唯一的构建期解析器
  （`assetpack.ts:377-426`）。
- **`index`**：契约有，生产者不写；运行时也不读。不要把它当作排序依据。
- **`durationMs`**：契约有，生产者不写，消费者不读。CONTEXT 甚至明确说「帧自己不带时长」
  （`CONTEXT.md:307-310`），与契约里的可选字段**互相矛盾**（§5.3）。
- **跨资源帧名碰撞**：schema 只查**同一资源内**帧名重复（`assetpack.ts:195-199`），
  `buildAtlas` 直接 `jsonFrames[f.name] = frame`（`atlas.ts:86`）——**后写的静默覆盖先写的**。
  对 drawlist/image 路线，帧名由唯一的资源 id 派生，风险低；对 `import` 路线，帧名是配方手写的
  （`pack.ts:1026`），而配方只查**同一 sheet 内**重复（`recipe.ts:349`），**不查跨资源**。
  两个 import 资源用同一批 `names` 时，图集会少帧、`AtlasEntry.frames` 会多报，
  且 `authoring/imported/<name>.png` 也会互相覆盖（`pack.ts:1041`）。目前**无任何检查**。

---

## 5. anchor / size / durationMs / fps / loop

### 5.1 落点与语义

| 项 | 落在哪 | 生产者 | 消费者 | 语义 / 状态 |
|---|---|---|---|---|
| `anchor` | manifest 资源级 + 图集**每一帧** | spec.anchor（`pack.ts:1213`；`atlas.ts:84`） | manifest 那份：`anchorOf` → 盒子（`draw.ts:123-126`）；图集那份：Phaser 逐帧 origin | 归一化 [0,1]；`at` 是锚点落点而非左上角（`game-config.ts:100-113`）；Phaser 3.90 的 JSONHash 解析器读 `src.anchor` 并置 `customPivot`（`node_modules/.pnpm/phaser@3.90.0/node_modules/phaser/src/textures/parsers/JSONHash.js:80-85`），动画切帧时 `setOrigin(pivotX,pivotY)`（`.../animations/AnimationState.js:1598-1605`）。状态：`implemented`。 |
| `size` | manifest 资源级 `size` + 图集 `frame` / `sourceSize` | manifest：**第一帧实际尺寸**（`pack.ts:1211`）；图集：每帧实际尺寸（`atlas.ts:77-83`） | manifest：盒子 / HUD / `assetSize`；图集：Phaser 帧尺寸 | 标称尺寸**不是**每帧保证；若后续帧尺寸不同，盒子仍按第一帧，Phaser 会逐帧改显示尺寸（`setSizeToFrame`）。无一致性检查。状态：`partial`。 |
| `durationMs` | `FrameRef.durationMs`（可选） | **无** | **无** | 死字段。若要逐帧时长，今天只能从 `fps` 反推；运行时也没把 per-frame duration 传给 Phaser。状态：`partial`（字段在）/ 实际 `missing`。 |
| `fps` | `Animation.fps`（可选，正数） | spec.fps → pack（`pack.ts:1054`） | **只有 `inspect` 打印**（`ops.ts:1950`） | 运行时写死帧率（玩家 idle/jump 6、run 10；实体 8）。状态：`partial`（写）/ 消费 `missing`。 |
| `loop` | `Animation.loop`（默认 true） | spec.loop → pack（`pack.ts:1055`） | **只有 `inspect` 打印** | 运行时一律 `repeat:-1`。v7 `jump` 的 `loop:false` 不生效。状态：`partial`（写）/ 消费 `missing`。 |
| 逐引用覆盖 | Game Config 的实体/玩家动画引用 | **无字段** | — | CONTEXT:315 声称「Game Config 可以逐引用覆盖」，但 `Entity` / `Player` 只有 `anim`/`anims` 名字（`game-config.ts:74-81,144-155`），没有 fps/loop。状态：`missing`（设计不一致，§5.3）。 |

### 5.2 运行时实际取值（HEAD）

- 玩家：`frameRate: action === "run" ? 10 : 6, repeat: -1`（`scene.ts:193`）。
- 多帧实体：`frameRate: 8, repeat: -1`（`scene.ts:140`）。
- 塔防敌人：`frameRate: 6, repeat: -1`（`td/scene.ts:143`）。
- 同一份 v7 的声明：idle 6 / run 12 / jump 10（jump loop=false）。HEAD 运行时采样里
  `player.fps=6, repeat=-1`、所有实体 `fps=8, repeat=-1`（`runs/2026-10-21-runtime/samples-idle.json`）；
  jump 采样里 `jump1→2→3→4→jump1`、`fps=6, repeat=-1`（`runs/2026-10-21-runtime/samples-jump.json`），
  与 manifest 的 `fps:10, loop:false` 相反。
  **idle 的 6 是巧合**（玩家分支对非 run 都给 6），不是读了 manifest。

### 5.3 设计不一致（§5.5 规则）

1. **CONTEXT 说 Game Config 可以逐引用覆盖播放参数**（`CONTEXT.md:313-316`），
   但 `game-config.ts` 的 `Entity` / `Player` 没有 fps/loop 字段，`compileRuntime` 的提示词
   也只要求动画名（`ops.ts:936-960`）。文档承诺 > 实现。
2. **CONTEXT 说帧不带时长**（`CONTEXT.md:307-310`），但 `FrameRef` 有 `durationMs`
   （`assetpack.ts:154`）。契约给了一个没有生产/消费的字段。
3. **QA 判据 `constructive-constraint` 的标签写「尺寸 / 锚点 / 九宫格」**
   （`qa.ts:114-119,385`），实际 `auditAssetSpec` 只比 kind/size/动画名与帧数/drawlist viewBox，
   **不读 anchor、不读 scale9Borders、不读图集帧 bounds**（`audit.ts:45-84`）。这是同一类
   「判据名字比实现宽」的设计不一致（同批 C 报告也独立测到）。
4. **`AtlasEntry.kind/size/frames/checksum` 是零读者**，但仍以必填字段出现，容易被读成
   「已校验的声明」（§3.4）。

---

## 6. 资源身份：路径、id、版本、checksum、稳定 ID

| 问题 | 结论 | 证据 |
|---|---|---|
| 路径怎么定 | 包内一律**相对包根 POSIX 路径**；绝对路径、`..`、空段、空格/反斜杠被 schema 拒 | `assetpack.ts:62-67` |
| 运行时怎么拼 | 唯一拼接点 `atlasList`：`packBase + a.meta` / `packBase + a.image`；`packBase` 来自 `site.json.pack` | `draw.ts:173-177`；`entry.ts:54` |
| 资源 id | `AssetPackEntry.id`，包内唯一；来自 recipe spec.id | `assetpack.ts:165,309-311` |
| 图集 id | 按 kind 固定（sprites/animations/backgrounds/ui），**不是内容寻址** | `pack.ts:1143-1144,1160` |
| 帧 id | 帧名（字符串），包内资源内唯一；图集内跨资源**不保证唯一** | §4；`assetpack.ts:195-199` |
| 版本 | 包级整数 `version`，绝不覆盖；格式版本 `assetpack/v4` | `assetpack.ts:57,268-269`；`pack.ts:250-256` |
| 内容哈希 | `files[]` 逐文件 sha256（覆盖除 manifest 外的全部文件）；`AtlasEntry.checksum` 是重复且**不被校验**的第二份 | `assetpack.ts:70,262,298-299`；`ops.ts:1672-1679` |
| manifest 自哈希 | **没有**（manifest 排除在 files[] 外） | `assetpack.ts:298-299` |
| 稳定全局 ID | **没有**。只有包内 id；两个包可以有同 id 不同内容；没有 UUID / 跨包注册表 | 类型定义即可见 |
| 生成者身份 | `generator.name/version` 恒为 `game-maker` / `0.0.0`；`generator.run` 零生产者 | `pack.ts:1179`；`ops.ts:1552-1572` 不传 generator |
| 时间 | `createdAt` 可复现（SOURCE_DATE_EPOCH），但零消费者；v7 为 `2026-10-20T00:00:00.000Z` | `pack.ts:1178`；v7 manifest |
| 来源 | `provenance.mode` 只区分 generated/imported/mixed；`provenance.style` 已删 | `assetpack.ts:272-287` |
| 与 run / recipe 的关联 | 包里**没有 recipe**，manifest 没有 `runVersion`/`recipe` 校验和；`generator.run` 未生产 | v7 `authoring/` 只有 stylespec/visual-world/generated/imported/drawlist/masters；`files[]` 无 recipe |

**结论**：包的「钉住」能力是 **文件级 checksum + id@version**，足以回答「这是不是同一份包字节」；
但**不是内容寻址**（没有 per-asset 哈希），也**不能从包反推是哪一次 run / 哪一份 recipe** 造的。
v7 的 `ledger.json` 甚至记着 `calls: []`（零付费重建），它只能说明「这一次构建没花钱」，
不能说明原图是哪一次付费 run 产出的。状态：资源身份 `partial`。

---

## 7. 引用完整性：检查点与漏网

### 7.1 检查点矩阵

| 边 | 检查器 | 时机 | 状态 | 漏什么 |
|---|---|---|---|---|
| 动画 → 帧（manifest 内） | `AssetPackEntry.superRefine`：动画引用的每个名字必须在 `frames[]` | 每次 `parseAssetPack` | `implemented` | 帧存在但图集里没有（完全看不到） |
| 多帧 → 必须归组 | 同一 superRefine：`frames.length>1 && !layers` 时每帧必须在某动画里 | 同上 | `implemented` | — |
| 帧名 / 动画名 / 层名 / 资源 id 唯一 | 同上 + manifest superRefine | 同上 | `implemented` | **跨资源**帧名不查（§4） |
| 资源 → 图集 | `asset.atlasId` 必须存在于 `atlases[]` | 同上 | `implemented` | 图集 `assets[]` 反向不查；kind 不查 |
| 图集 → 资源 | `atlas.assets[]` 每项必须是已存在资源 | 同上 | 单向 `implemented` | 图集漏列自己的资源也过 |
| 图集 meta/image → files[] | manifest superRefine 检查成员资格 | 同上 | `implemented` | 只查 manifest 里是否有这条记录，不查文件在不在 / 对不对 |
| 创作态 ref → files[] | 同上 | 同上 | `implemented` | 同上 |
| files[] → 磁盘 | `verifyPack`：存在、大小、sha256、无未声明文件 | **手动 CLI/MCP** | `implemented`（链上不跑） | manifest 自身不自哈希；坏 JSON 抛裸 `SyntaxError` |
| manifest → 图集 JSON 帧名 / 矩形 / 尺寸 / 锚点 | **无** | — | `missing` | 见 §7.2 |
| 图集 JSON rect → PNG 边界 | **无** | — | `missing` | 越界矩形在 inspect 里可能读到 undefined 或抛；Phaser 读越界像素 |
| 图集 PNG → 可解码 | 只有 `inspect` / `review` 解码；`verify` 不解 | 手动诊断 / 付费 review | `partial` | 交付态非 PNG 仍过 verify |
| `AtlasEntry.size/frames/checksum` → 实际 | **无** | — | `missing` | 三个字段可以整组说谎 |
| config → pack 资源 / 动画 / 种类 | `auditReferences` + `resolvePackRef` | compile / site / world | `implemented` | 不检查动画帧是否真的在图集里 |
| player 三动作互不相同 | `auditReferences` | compile / site | `implemented` | — |
| spec → manifest（kind/size/动画名/帧数/drawlist viewBox） | `auditAssetSpec` | pack 末尾 + QA `constructive-constraint` | `implemented` | 不读 anchor / scale9 / 图集 bounds；不比对 fps/loop |
| site → pack | `site.json.pack` + `laySite` 拷贝；`assembleSite` 先 parse 两方 | site 装配 | `implemented`（无 checksum 绑定） | 站点不记录 manifest 哈希；拷贝后是否同一份靠人 |
| run → pack → qa-report | 无显式外键 | — | `missing` | §10 |

### 7.2 合成探针（`verify` 的盲区）

在 `/tmp/packprobe.8W2p0h` 从零构造了一个最小 `assetpack/v4`（**没有复制 v7 / fixtures**）：

- 资源 `a` 声明两帧 `a.frame1` / `a.frame2`，动画 `idle` 引用两帧；
- `delivery/atlas.test.json` **只有 `a.frame1`**；
- `delivery/atlas.test.png` 的内容是 ASCII `not a png at all`；
- `Atlases[0].frames = 1`（与资源的两帧不一致）；
- 按改动后的字节重新计算 `files[]`。

结果：

```
node packages/cli/dist/cli.mjs verify /tmp/packprobe.8W2p0h
✅ packprobe.8W2p0h 通过：4 个文件的 checksum 全部对得上
exit 0

node packages/cli/dist/cli.mjs inspect /tmp/packprobe.8W2p0h
✗ 不是 PNG（签名不匹配）
exit 1
```

这证明：**checksum 通过 ≠ 图集引用有效 ≠ 图片可解码**。`verify` 的通过条件里没有一项读图集 JSON
或解码 PNG；`inspect` 会解码，但它是诊断命令、失败不结构化（裸退出 1），且 **`runBuild`
不调用 `verify`**（`pipeline` 只 import `inspectPack`，`create-game.ts:19-27,513`）。

### 7.3 明确拒绝 vs 可能漏过

| 会被明确拒绝 | 证据 | 可能漏过 | 证据 |
|---|---|---|---|
| 动画引用不存在的帧 | `assetpack.ts:200-205`；`assetpack.test.ts:150` | manifest 帧名不在图集 JSON 里 | 探针；`inspect` 静默跳过 `ops.ts:1772-1773` |
| 同名动画（同资源内） | `assetpack.ts:217-221`；`assetpack.test.ts:203` | 跨资源同名帧 → 图集静默覆盖 | `atlas.ts:86`；`recipe.ts:349` 只查同一 sheet |
| 多帧资源有帧不归组 | `assetpack.ts:247-250`；`assetpack.test.ts:210` | 图集帧矩形越界 | 无读取期检查 |
| 资源指向不存在的图集 | `assetpack.ts:312`；`assetpack.test.ts:146` | 图集 `size/frames/checksum` 撒谎 | 三字段零读者或只写不校验 |
| 图集声称包含不存在的资源 | `assetpack.ts:314-316`；`assetpack.test.ts:187` | 图集漏列自己的资源 | 只查正向 `atlas.assets → assets` |
| 绝对路径 / `..` | `assetpack.ts:62-67`；`assetpack.test.ts:179` | anchor / size 在 manifest 与图集间不一致 | 两份值无对账 |
| 锚点越界 | `assetpack.ts:73`；`assetpack.test.ts:228` | 每帧尺寸与标称尺寸不一致 | `pack.ts:1211` 只取第一帧 |
| checksum 不符 / 缺文件 / 多文件 | `ops.ts:1672-1679,1709-1711`；`ledger.test.ts:145-158` | 交付态 PNG 不可解码 | 探针；`verify` 不解码 |
| config 引用不存在的资源/动画/种类 | `game-config.ts:284-337`；`game-config.test.ts:135-155` | config 的动画帧在图集里缺失 | 无跨文件检查 |
| 玩家三动作同名 | `game-config.ts:319-331`；`game-config.test.ts:172-204` | `fps` / `loop` 与 spec 不一致 | `auditAssetSpec` 不比对 |
| spec ↔ manifest 的名/帧数/尺寸 | `audit.ts:45-84`；`qa/tests/visual.test.ts:81-123` | `required:false` 不被任何消费者执行 | `required` 零读者 |
| pack 自校验（写入前） | `pack.ts:1280-1288`；`pack-selfcheck.test.ts` | `FrameRef.index/durationMs` 随便写 | 无生产者/消费者 |
| 账 / 覆盖率 sidecar 身份不符 | `ops.ts:1683-1707`；`site.ts:200-201` | 宽帧 >4096 的图集 | `atlas.ts:59-70` 只限高 |

运行时的最后一道「静默」：即使 manifest 帧名不在图集里，Phaser 的 `Texture.get` 只会
`console.warn` 并回落到第一帧（`node_modules/.pnpm/phaser@3.90.0/node_modules/phaser/src/textures/Texture.js:246-253`），
所以「动画看起来在动」并不能证明每一帧都存在 —— 它可能只是第一帧在重复。

---

## 8. 五层合法性（任务书 §4.2 的关键区分）

| 层 | 总状态 | 已有检查 | v7 实测 | 明确不覆盖 |
|---|---|---|---|---|
| **1. Schema 合法** | `implemented`（仅 manifest） | `parseAssetPack`：strict + superRefine；40 个 `assetpack.test.ts` 用例 | `verify` 通过（schema 先跑）；v7 `format=assetpack/v4` | **图集 JSON 没有 schema**；`AtlasEntry` 的 size/frames/checksum 不被对账 |
| **2. 文件存在** | `partial` | `verifyPack` 的 `files[]` ↔ 磁盘；`assembleSite` 检查包/manifest/config/shell | `verify` 通过；磁盘 157 = 声明 157，无缺失/多余 | 不在 `runBuild` 链上；manifest 不自哈希；`verify` 的坏 JSON 不捕获 |
| **3. 文件可解码** | `partial` | 生成期 `decodePNG` 输入；`inspect` 解码 4 张图集 + 12 张源图；`review` 也解码 | `inspect` 退出 0；我另用 `decodePNG` 解出 `atlas.animations.png` = 256×760 | `verify` 不解码；`inspect` 失败不结构化；探针里非 PNG 过了 `verify` |
| **4. 元数据引用有效** | `partial` | manifest 内动画→帧；资源↔图集；files[] 成员；config→pack | 自写交叉核对：19 资源 / 76 帧 / 61 动画帧 **全部**能在图集 JSON 找到；size/anchor 全部一致；4 张图集矩形全部在界内 | **manifest→图集 JSON 不是任何门的判据**；跨资源帧名；AtlasEntry 字段 |
| **5. 动画可正确播放** | `partial` | 帧推进：HEAD 运行证据 4 帧循环；参数：无；视觉：无 | idle 4 帧以 ~168ms 循环（6fps，`samples-idle.json`） | fps/loop/duration 不生效；视觉正确性归票 05；没有仓库内自动播放回归 |

**结论**：不能因为 `verify` 通过就认定动画有效。v7 今天恰好五层都通（L5 的参数语义除外），
但其中 **L4 的 manifest↔图集一致性、L3 的解码、L2 的 checksum 都不是创建链上的门**，
而是「这份包恰好没被改过 + 我们额外人工核过」。

---

## 9. v7 `scavenger-actor` idle 4 帧：逐站

| 站 | 产物 / 事实 | 证据 |
|---|---|---|
| 0. 配方 | `scavenger-actor`：`kind=animation`、`anchor{0.5,1}`、`size 48×64`、`animations idle(4,fps6,loop true) / run(8,fps12) / jump(4,fps10,loop false)`、`source.kind="frames"`、`masterAsset="master-scavenger-actor"` | `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/asset-recipe.json` |
| 1. 源文件 | 4 张逐帧原图 `authoring/generated/scavenger-actor.idle1..4.png`，各 864×1184；解码后 RGBA 像素哈希不同（sha256 前 12 位 `a4768b10008a` / `ad7df109577d` / `a7664262cf23` / `e55150d81c44`） | v7 包 `authoring/generated/`；`sips` + `decodePNG` 只读核对 |
| 2. 创作态声明 | `authoring[]` 四条 `kind:"bitmap"`，ref 指向上面的 PNG，`original:"生图 · 16 次调用"` | v7 `manifest.json`（`scavenger-actor.authoring`） |
| 3. manifest 帧 | 16 帧：`idle1..4 / run1..8 / jump1..4`；`idle.frames` 恰为那 4 个名字，顺序 idle1→4；`atlasId:"animations"` | `manifest.json`；顺序与 `framePlan` 一致（`prompt.ts:148-154`） |
| 4. 图集矩形 | `delivery/atlas.animations.json`：idle1 `{x:64,y:192,w:48,h:64}`、idle2 `{112,192}`、idle3 `{160,192}`、idle4 `{208,192}`；每帧 `anchor{0.5,1}`、`sourceSize 48×64` | v7 `delivery/atlas.animations.json` |
| 5. 图集 PNG | `atlas.animations.png` 解出 256×760；61 帧全部在界内；idle 四块裁图的不透明像素 1496/1501/1501/1504，裁图像素 sha256 两两不同；`AtlasEntry.checksum` 与 PNG 实际 sha256 一致（但门不查） | `inspect` 退出 0；自写解码脚本（`packages/assets/dist/png.js` 的 `decodePNG`，`png.ts` 自 9-24 未改） |
| 6. game-config | `player.asset="scavenger-actor"`、`player.anims={idle:"idle",run:"run",jump:"jump"}`、`player.at{x:40,y:250}`；`auditReferences` 三格全解得到 | `.scratch/asset-integration-v1/runs/2026-10-20e-site/game-config.json`；`game-config.ts:271-337` |
| 7. 站点 | `site/v3/site.json={"shell":"2","pack":"v7","config":"game-config.json"}`；站点里的 `pack/v7/manifest.json` 与源包逐字节相同（sha256 `e620cd7e…38326`）；站点 config 与源 config 对象相等 | `.scratch/asset-integration-v1/runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v3/`；`layout.ts:114-116` |
| 8. 运行时读取 | `entry.ts` 读 `../../pack/v7/manifest.json`；`buildWorld` 把 `player.anims.idle` 解成 4 个帧名；`scene.ts` 建 Phaser 动画 `key="idle"`、`frameRate=6`、`repeat=-1` 并 `play("idle")` | `entry.ts:54-67`；`world.ts:149-166`；`scene.ts:190-195` |
| 9. 播放证据 | HEAD 运行（票 06 的 run，2026-10-21）：124 个采样 / 2.59s，玩家帧集合恰为 `idle1..idle4`，16 次切换，间隔 ~168ms；`draw-trace.json` 4501 次 `drawImage`；`analysis.json` `idle_distinct_crops=4` | `.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/samples-idle.json`（本报告直接解析，未依赖其文字结论）；`draw-trace.json`；`analysis.json` |

**v7 idle 的结论**：五层里 1–4 全通且可复算；第 5 层的**帧推进**已在 HEAD 上实测通过
（4 帧、6fps、循环），但 6fps 来自外壳写死的值，不是 `Animation.fps` 的通用实现；
`jump` 的 `fps:10 / loop:false` 在同一份运行时里**不生效**（`f-runtime.md` §3 的结论；
本报告另行直接解析了其公开产物 `samples-jump.json`：`fps=6, repeat=-1`, 第 4 帧后回到 jump1）。

---

## 10. 资源包格式是否足以支持验收报告关联？

**结论：`partial`。**

包侧（够用）：

- `manifest.id + version` 是包级主键；`files[].checksum` 覆盖除 manifest 外的全部字节；
  `ledger.json` / `coverage.json` / `master-ratios.json` 自带 `packId + packVersion`
  （`ledger.ts:156-160`；`coverage.ts:25-30`；`ops.ts:1683-1707`）。
  ⇒ 只要报告记录 `packId@version + manifest.json 的 sha256`，就能精确钉住一份包。
- `site.json` 记录了 `pack:"v7"` 与 `shell:"2"`（`layout.ts:114-116`），
  所以站点 → 包版本的关联是有的（但没有 manifest 哈希）。

报告侧（不够）：

- `qa-report/v1` 的 schema 只有 `format / checked / failures / observations`
  （`qa.ts:266-274`），**没有 `packId`、`packVersion`、`runVersion`、`createdAt`、checksum**。
  真实报告的键也只有这四个（`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/run/v1/qa-report.json`）。
- `run/v<N>` 与 `pack/v<M>` **可以不同号**：同一 run 的第二次构建会得到 `pack/v2`，run 仍是 v1
  （`create-game.ts:437-441`；`packages/pipeline/tests/create-game.test.ts:162-174`）。
  `run-ledger/v1` 只记 `gameId + runVersion`，没有 `packVersion`（`run-ledger.ts:19-34`）。
  ⇒ 目录约定**不是可靠外键**。
- 包**不含 recipe**，manifest 没有 `runVersion` / recipe 校验和；`generator.run` 字段零生产者
  （`pack.ts:1179`；`ops.ts:1552-1572`）。⇒ 从包不能反推是哪一份 recipe / 哪一次生成 run。
- `createdAt` 与 `generator` 在 manifest 里，但零消费者；v7 的 `createdAt` 是
  `SOURCE_DATE_EPOCH`（可复现），不能当 run 的唯一 ID。

**最小建议（Phase 1，不在本票实施）**：任何验收报告（或一个 `run-build-record` sidecar）至少记录
`{runVersion, packId, packVersion, manifestSha256, siteVersion?, qaReportSha256}`；
不要只靠 `run/v<N>` 推包版本。包格式本身**不需要改**（`assetpack/v4` 的 strict schema 不宜为报告加键），
报告侧新增字段/新 sidecar 即可。

---

## 11. 本轮运行记录

| 命令 | 结果 |
|---|---|
| `node packages/cli/dist/cli.mjs verify <v7>` | exit 0；157 文件 checksum 全对；来源 `mixed` |
| `verify fixtures/packs/last-train/v2` | exit 0；31 文件 |
| `verify fixtures/packs/counter-siege/v4` | exit 0；35 文件 |
| `inspect <v7>` | exit 0；19 资源 / 4 图集；解码 4 张图集 + 12 张源图；打出 idle(4)/run(8)/jump(4) |
| `inspect fixtures/packs/last-train/v2` | exit 0；9 资源 / 4 图集 |
| `pnpm exec vitest run packages/contracts/tests/assetpack.test.ts packages/contracts/tests/game-config.test.ts packages/demo/tests/world.test.ts` | 3 文件 / 101 用例通过 |
| `pnpm exec vitest run packages/assets/tests/inspect.test.ts packages/assets/tests/pack-selfcheck.test.ts packages/assets/tests/pack-frames.test.ts packages/qa/tests/visual.test.ts` | 4 文件 / 28 用例通过 |
| `/tmp/packprobe.8W2p0h` 合成探针 | `verify` exit 0；`inspect` exit 1「不是 PNG」 |
| 自写只读交叉核对（manifest ↔ 图集 JSON ↔ PNG） | v7 / last-train v2 / counter-siege v4：缺帧 0、尺寸不符 0、anchor 不符 0、图集帧数不符 0、矩形越界 0、解码失败 0；v7 四张图集 PNG 尺寸与 `Atlases[].size` 全部一致 |

未运行：`pnpm check`、`pnpm build`、任何写 `out/` 的生成命令、任何付费调用、`runner` / `site` / `pack`。
`vitest` 只写 `os.tmpdir()`；运行后仓库 `git status` 与开始一致（除本报告与本票）。

---

## 12. 证据弱点与未验证

1. **运行时证据来自票 06 的同基线 run，不是本票自己跑的**。我直接解析了
   `runs/2026-10-21-runtime/samples-idle.json` / `analysis.json` / `run-log.txt` 的原始内容，
   但它是 2026-10-21 17:41 的一次 CDP 运行，不是本票的产物。站点 `site/v3/shell.js` 是 2026-10-20
   的构建，但其 sha256 与 `packages/demo/dist/shell.js` 相同，且 `scene.ts` 自 `a3ac8d8`（10-17）未改；
   这支持「wiring 与 HEAD 一致」，不等于「本票重跑过 HEAD 运行时」。
2. **CLI bundle 的时点**：`packages/cli/dist/cli.mjs` 构建于 2026-10-21 09:29，HEAD 提交 15:52；
   比 bundle 新的源文件只有 `image-gen.ts` / `index.ts` / `jpeg.ts`，`verify` / `inspect` 用到的
   `ops.ts` / `pack.ts` / `png.ts` 都更早；我另外核对了 bundle 里的 `verifyPack` 与源码同义。
   定向 vitest 是在 HEAD 源码上跑的。
3. **自写交叉核对不是仓库判据**：它证明三份真实包「今天」内部一致，但不会在以后回归时报警；
   仓库里 `verify` 不会做这些检查。
4. **合成探针是 `/tmp` 从零构造的**，不是 v7 / fixtures 的副本；它证明 `verify` 的行为，
   不证明任何真实包坏了。
5. **视觉正确性未验证**：帧在推进、像素不同，但「idle 画得像不像、四帧是否该按这个顺序」
   属于票 05 的视觉审查；本报告不判定。
6. **v7 没有测试引用**：`packages/*/tests` 里没有 v7 / `2026-10-20f` 的路径（`cli-create.test.ts:475`
   的 `pack/v7` 是版本号，不是这个包）；基准包的回归保护为零。fixtures 两包有测试引用
   （`game-config.test.ts`、`inspect.test.ts`、`ledger.test.ts` 等）。
7. **`AtlasEntry.checksum` 未被门校验**：v7 的三份值我手工核过是对的，但这是巧合而非保证。
8. **图集越界矩形在 `inspect` 里的行为未实测**：静态看它会越界读 `img.data`（`ops.ts:1774-1775`），
   可能抛 `TypeError` 或产出 NaN 色；没有合成一份越界样例去跑（避免为一个已确定缺失的判据
   再造一个探针）。标记为 `unverified` 的具体失败形态，但「没有判据」本身是 `missing`。

---

## 13. 给综合票的一句话

**格式与生产链是成熟的（`assetpack/v4` + TexturePacker JSON Hash + 逐文件 sha256），
manifest 内的引用校验也很实；缺口集中在「manifest ↔ 图集 JSON ↔ PNG」这条运行时真正依赖、
但没有任何门去读的边上，以及 `fps/loop/duration` 这套写了不生效的播放参数。**
