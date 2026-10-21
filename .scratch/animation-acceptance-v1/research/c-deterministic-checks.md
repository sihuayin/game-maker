# C · 现有确定性检查覆盖矩阵

- **票**：[03-c-deterministic-checks](../issues/03-c-deterministic-checks.md)
- **基线**：`main` · `f0dac01`（工作树非干净；本报告只读，不改验证器 / 测试 / Schema）
- **范围**：任务书 [docs/v5/动画.md](../../../docs/v5/动画.md) §4.3 的 7 个问题 + 「特别检查」
- **证据等级**：E1 源码 · E2 测试 · E3 真实产物（只读 `verify` / `inspect`）· R 运行证据（命令 + 退出码）
- **边界**：零付费；未运行任何上游；未写 `out/`；未执行 `pnpm check` / `pnpm build`。
  定向测试与探针只写 `os.tmpdir()` / `/tmp`，仓库内只写本文件与本票。
- **行号**：均指 `f0dac01`。源码一改就会漂移。

---

## 0. 结论先行

1. **有资源包级验证器，但它不在创建 / 构建链上。** `verifyPack`（`packages/assets/src/ops.ts:1662-1727`）
   校验 schema + 逐文件存在 / 大小 / sha256 + `files[]` 穷举 + 可选 sidecar（账、母版比例）的
   schema 与包版本；它只由 CLI `verify`（`packages/cli/src/cli.ts:593-596`）与 MCP
   `verify_asset_pack`（`packages/mcp/src/server.ts:255-257`）手动调用。`runBuild`
   （`packages/pipeline/src/create-game.ts:417-560`）**不调用它**。
2. **`verifyPack` 不解码 PNG、不解析图集 JSON、不查帧矩形越界、不核对锚点。**
   它只证明「文件没被改过」，不证明「文件是合法的图 / 帧引用真的落在图集里」。
   这些只由 `inspectPack` 部分观察（解码 + 读图集 JSON），而 `inspect` 的失败会被
   `runBuild` 吞成 `unavailable`，**不阻断**（`create-game.ts:510-518`）。
3. **契约层（`parseAssetPack`）是当前最实的确定性检查**：帧名 / 动画名 / 层名 / 资源 id 唯一，
   动画帧引用必须在 `frames[]` 里，多帧必须归组，层与帧一一对应，资源 / 图集互指，
   `files[]` 覆盖图集与创作态引用。**但它只看 manifest，看不到图集 JSON。**
4. **存在「声明了检查、实际没读字段」的模块**：QA 判据 `constructive-constraint` 的注释与
   人话标签写着「尺寸 / **锚点** / **九宫格**」（`packages/contracts/src/qa.ts:114,385`），
   实际调用的 `auditAssetSpec`（`packages/contracts/src/audit.ts:45-84`）**完全不读 `anchor`
   与 `scale9Borders`**，也不读图集里的帧 bounds；锚点的 [0,1] 只是 `parseAssetPack` 先跑过
   带来的**间接结果**。探针证明：spec 锚点 `{0,0}`、产物锚点 `{0.9,0.9}`；spec 九宫格内缩
   `{4,4,4,4}`（中央 `{4,4,88,18}`）、产物 `scale9Borders` `{1,1,2,2}` 或 `{40,40,10,10}` ——
   `auditAssetSpec` 仍返回 `[]`。
5. **检查结果不是统一错误对象**：多套形状并存 —— `parseAssetPack` 的
   `{ok:false, errors:string[]}`（`assetpack.ts:344-346`）、`verifyPack` 的「抛
   `CommandError` / 成功 `data.ok+problems:[]`」、`auditAssetSpec` 的 `string[]`、
   QA 的结构化 `{target, severity, detail}`（`qa.ts:168-183`）与 `ConfigIssue
   {severity, where, message}`。
6. **定位能力分层**：`verify` 能定位到**文件**（相对路径），不能定位资源 / 帧；
   schema 能定位到 JSON 路径（资源用下标，消息里带 id / 帧名）；QA 能定位到
   **资源 id / "recipe" / "game-config"**，细节里有人话但无文件路径。**没有任何一层
   同时给出文件 + 资源 + 帧的结构化字段。**
7. **非法输入测试分布不均**：契约 / QA / 生成期负例充分；`verifyPack` 对**包内容**的负例只有一条
   「篡改 checksum ⇒ 退 4」（`packages/cli/tests/cli.test.ts:127-138`）和一条实际先撞
   checksum 的账本版本测试（`packages/assets/tests/ledger.test.ts:150-159`）。
   **没有**仓库测试覆盖：缺文件、大小不符、`files[]` 多出文件、图集帧越界、图集 PNG 尺寸
   与 `atlases[].size` 矛盾、manifest 是坏 JSON。本报告用 `/tmp` 探针补了行为证据（见 §7）。
8. **重复实现 / 死代码**：`AtlasEntry.checksum` 被写入但全仓**零读者**（真正的校验走
   `files[].checksum`）；`checkSize`（`audit.ts:24-33`）**零生产调用者**；`FrameRef.index` /
   `durationMs`（`assetpack.ts:153-154`）**零读者**；`Animation.fps` / `loop` 只被 `inspect`
   打印，运行时写死 `frameRate` 与 `repeat:-1`（`packages/demo/src/shell/scene.ts:191,140`、
   `packages/demo/src/shell/td/scene.ts:143`）。v7 基准包的 `jump` 声明 `fps=10, loop=false`，
   壳子实际以 `6fps` **循环**播放。

---

## 1. 覆盖矩阵

状态口径：`implemented` = 该检查在代码里真实读取并校验目标字段；`partial` = 有真实检查但
覆盖面不足或只在构建期 / 观察层成立；`missing` = 查过相关路径确认没有；`unverified` = 本票
拿不到运行条件。**「链上可响」另注**：该检查是否在 `create --yes` / `build` 默认链上会阻断。

| 检查项 | 实现位置 | 正常用例 | 异常用例 | 错误定位能力 | 状态 |
|---|---|---|---|---|---|
| **文件存在** | `ops.ts:1672-1679`（`files[]` 逐个 `existsSync`）；`ops.ts:1709-1711`（磁盘上多出的文件）；`site.ts:169-175`（包 / manifest / config / shell 目录） | `import-fixture.test.ts:14` 构建后 `verify` 通过；`cli.test.ts:123-125` 真 fixture 包 `verify`/`inspect` 退 0；v7 包 157 文件 `verify` 通过（E3） | `cli.test.ts:127-138` 篡改 PNG ⇒ `invalid(4)`（实际撞的是 checksum）；**仓库无缺文件 / 大小不符负例**；探针 B「删 `delivery/atlas.animations.png`」⇒ `缺文件：<相对路径>` | **文件**：相对路径。**无资源 / 帧**。`problems.slice(0,6)`，多于 6 处只报前 6（`ops.ts:1714`） | **implemented**（链上不跑） |
| **图片可解码** | `png.ts:44-60` `decodePNG`；调用点 `pack.ts:1025`（import）、`ops.ts:1767`（inspect 图集）、`ops.ts:1856`（inspect 源图）、`review.ts:33` | `raster.test.ts:225` 编解码往返；v7 `inspect` 解码 4 张图集 + 12 个源图（E3） | `raster.test.ts:232` 非 PNG ⇒ 抛 `/签名/`；`image-gen.test.ts:284` 声明 PNG 却给 JPEG；**`verify` 不解码**：探针 D 把图集 PNG 换成文本、重算 `files[]` ⇒ `verify` 通过、`inspect` 抛 | `decodePNG` 的错**不含路径**；`inspect` 失败在 runBuild 里被改成分类字符串、刻意剥掉路径（`create-game.ts:402-405`） | **partial** |
| **图集边界** | 构建期：`atlas.ts:37-47` `shelfPack`、`atlas.ts:55-91` `buildAtlas`、`atlas.ts:70` 超高即抛；写入 `pack.ts:1152-1165`。**读取期：无**（无图集 JSON schema，`verify` 不解析它） | `raster.test.ts:188` 「每帧都落在它声明的矩形上（逐像素核对）」；`raster.test.ts:219` 空输入被拒 | **仓库无交付包负例**；探针 E 把帧矩形改成 `x=y=9999`、重算 `files[]` ⇒ `verify` 通过；探针 atlas 单帧宽 5000 > 4096 ⇒ `buildAtlas` **不拒**（只限高，`atlas.ts:61-70`） | 构建期错误只写「图集超过 4096×4096」，**不带资源 id / 帧名**；读取期无错误 | **partial** |
| **动画帧引用** | manifest 内：`assetpack.ts:200-205`（动画帧必须存在）、`:247-250`（多帧必须归组）、`:217-221`（动画名唯一）；解析：`resolvePackRef` `assetpack.ts:377-426`；config 引用：`game-config.ts:296-333` | `assetpack.test.ts:77-93` 最小合法包；`:256-290` 单 anim / 有序帧 / 多 anim 必须指明；v7 13 条动画全部可解（`inspect` E3） | `assetpack.test.ts:150` ④ 动画引用不存在的帧；`:203` 动画名重复；`:210` 多帧不归组；`qa/tests/gameplay.test.ts:66` 动作指向不存在动画；`qa/tests/visual.test.ts:87` spec 要 3 帧产物 2 帧 | 消息带**资源 id / 动画名 / 帧名**（`resolvePackRef`）；schema 的 `path` 只到 `["animations"]`，**无帧下标**，但有帧名文本。**无文件** | **partial**（manifest 内 implemented；**从不与图集 JSON 对账**：探针 F 在 manifest 加一个图集里不存在的帧 + 动画引用 ⇒ `verify` 通过） |
| **动画播放配置** | Schema：`assetpack.ts:157-162`（`fps>0`、`loop` 布尔默认 true）、`asset-spec.ts:84-85`；写入：`pack.ts:1050-1056`；观察：`ops.ts:1950`。**运行时读 `frames[]` 顺序，但 `fps`/`loop` 零读者** | `pack-frames.test.ts:34` 两帧顺序 `["hero.idle1","hero.idle2"]`；v7 `inspect` 打出 `idle:4@fps=6`、`run:8@fps=12`、`jump:4@fps=10 loop=false`（E3） | 探针 H：`fps=0` ⇒ schema 拒；`fps=100000`、`FrameRef.index=99`、`durationMs=0.0001` ⇒ **全部通过**。仓库无 `fps`/`loop` 语义测试 | schema 路径 + 字段名；播放期无任何检查 / 警告 | **partial** |
| **锚点数据** | 范围：`assetpack.ts:73` `Anchor` 0..1（spec 复用 `asset-spec.ts:21`）；写入：manifest `pack.ts:1212`、图集逐帧 `pack.ts:1155`；运行时：manifest 锚点 `demo/src/draw.ts:123-126`，图集逐帧锚点归 Phaser（`shell/scene.ts:182-185`）。**`auditAssetSpec` 不读 anchor** | 真包锚点（`{0.5,0.5}` / `{0,0}`）可被 `inspect` / 运行时读到；`raster.test.ts:203` 锚点被原样写进图集 JSON | `assetpack.test.ts:228` 锚点越界（不在 0..1）被拒；**无 spec↔产物、manifest↔图集锚点一致性测试**；探针 audit：两端锚点 `{0,0}` vs `{0.9,0.9}` ⇒ `auditAssetSpec` 返回 `[]` | schema 报 `assets[i].anchor.x`；**无资源 id / 文件 / 帧**（schema 路径是下标；`audit` 根本不报） | **partial** |
| **资源版本关联** | manifest `id/version` `assetpack.ts:265-269`；包目录 `v<N>` `pack.ts:328-329`；run 身份 `create-game.ts:429-441`；`verify` 对账 ledger / 母版比例 `ops.ts:1689-1690,1704-1705`；`site` 对账 `coverage.json` `site.ts:200-201`；`site.json` 写 `pack:"vN"` `layout.ts:114-116`。**QA 报告无 id/version**（`qa.ts:266-274`） | `pack.test.ts:70-87` 同输入两次逐字节相同、版本绝不覆盖；`ledger.test.ts:71-89` 包内账进 `files[]` 且 `verify` 认；v7 `verify` 报 `packId/version`（E3） | `ledger.test.ts:150-159` 账版本不符（**注释承认会先撞 checksum**）；**无 `coverage.json` 版本不符测试**；探针 L 把 `v4` 包拷进 `v99/` ⇒ `verify` 通过（不核对目录名）；探针 K `atlases[].frames=999` ⇒ 通过 | 文本里有 `packId` / `version`；**无文件 / 资源 / 帧**；QA 报告只能靠 `run/v<N>/` 目录关联，且 `packVersion` 可与 `runVersion` 不同（`create-game.ts:439-441`） | **partial** |
| **资源名称冲突**（问题清单额外项） | 配方：`recipe.ts:253-255`（资源 id 重复）、`:262-266`（母版 id 重复 / 与资产撞）；交付：`assetpack.ts:196-199`（帧名）、`:217-221`（动画名）、`:229-233`（层名）、`:307-316`（资源 id / 图集互指） | 真包 / fixture 包全部通过；`assetpack.test.ts:77-93` | `assetpack.test.ts:195` 资源 id 重复、`:199` 帧名重复、`:203` 动画名重复、`:210` 多帧不归组、`:187` 图集声称包含不存在的资源；`pack-selfcheck.test.ts:66,165` 生产函数也拒（退 4） | 名字 + JSON 路径（`assets` / `animations` / `frames` / `layers`），**无文件** | **implemented** |
| **透明背景**（问题清单额外项） | 生成期：`pack.ts:812-818`（全透明图直接抛）、`:872-896`（单帧「抠掉 >50% + 最大块 ≥60%」）、`:900-930` + `sheet.ts:228-270`（按格：空 / 多主体 / 边框）；导入：`import.ts:416` 不给 `background` 就不抠；装配：`site.ts:52-77`（最远层必须满）、`:83-120`（非最远层不许满） | `pack-sheet-grid.test.ts:104` 正常 4+9 帧；`import.test.ts:224` 「不给 background 就不抠（假定人已经给了透明底）」 | `pack-sheet-grid.test.ts:126/131/136/141` 空格 / 两主体 / 黑框 / 1×1 也查；`pack.test.ts:1043,1069` 抠少 / 抠碎；**已知洞** `pack.test.ts:1117`「主体自己是众数且底连成一块 ⇒ 抠反了照样出包」；非最远层「太满」在 `pack.ts` 侧无判据（注释自白） | 资源 id + 动画名 + 第几格（行 / 列），**无文件**；装配期报 `scene.background[i]` + 帧名 | **partial** |
| **错误分类与定位**（问题清单额外项） | `CommandError` / `EXIT` `command.ts:46,67-88`；schema 文本化 `zod-issues.ts:25-39`；QA `qa.ts:168-183` | `cli.test.ts:117` 不存在的目录 ⇒ `usage(2)`；`:123` 真包 ⇒ 0；`:127` 篡改 ⇒ `invalid(4)`；`create-game.test.ts:640-670` QA 硬失败 ⇒ 4 且报告先落盘、路径进文案 | 探针 M/N：`manifest.json` 是坏 JSON ⇒ **裸 `SyntaxError`、退 1**（不是 4）；`verifyPack` 对 `JSON.parse` 无捕获（`ops.ts:1666`） | 见各行；**无统一错误对象**，**无文件+资源+帧三合一** | **partial** |

---

## 2. 验证器逐层行为

### 2.1 `verifyPack`（唯一的「包级」验证器，手动）

`ops.ts:1662-1727`：

1. 没有 `manifest.json` ⇒ `CommandError("usage")`（退 2，`ops.ts:1665`）。
2. `JSON.parse` **不捕获**；坏 JSON ⇒ 裸 `SyntaxError`（退 1）。
3. `parseAssetPack` 不过 ⇒ `CommandError("invalid")`（退 4，`ops.ts:1666-1667`）。
4. 对 `m.files[]` 逐条：存在、`bytes` 长度、sha256（`ops.ts:1672-1679`）。
5. 若包内有 `ledger.json`：过 `parseLedger`，并核对 `packId/packVersion`（`:1683-1692`）。
6. 若包内有 `master-ratios.json`：过 `parseMasterRatios`，并核对 `packId/packVersion`（`:1699-1707`）。
7. `walk(packDir)` 与 `files[]` 做**双向**集合对账（磁盘多的报「files[] 没记录」；缺的已在第 4 步）。
8. 任一问题 ⇒ `CommandError("invalid", "校验不过（N 处）：前 6 条")`（`:1714`）；
   成功 ⇒ `data: { packId, version, ok:true, problems:[], provenanceMode }`（`:1724`）。

**它不做的**（每条都有探针或源码证据）：

- 不解码任何 PNG（`verifyPack` 函数体内不调用 `decodePNG`）；
- 不解析 `delivery/atlas.*.json`，因此不查帧名是否在图集里、帧矩形是否在图内、矩形是否重叠；
- 不核对 `atlases[].size` 与真实 PNG 尺寸；
- 不核对 `atlases[].checksum`（该字段零读者）；
- 不核对包目录名 `v<N>` 与 `manifest.version`；
- 不解析 / 不核对 `coverage.json`（`site` 才做，`site.ts:195-203`）；
- 不检查锚点的语义（只由 schema 限 0..1）；
- 不检查 `Animation.fps/loop` 的合理性。

### 2.2 `parseAssetPack` / `superRefine`（契约层，所有消费者共用）

`assetpack.ts:265-333,344-346`：

- 包级：`palette.size == values.length`、无重复色（`:304-305`）；资源 id 唯一（`:310`）；
  资源 → 图集（`:312`）与图集 → 资源（`:314-316`）**各查一个方向**（不要求双向一致）；`provenance.mode == derivePackMode(origins)`
  （`:320-322`）；`files[]` 覆盖图集 meta/image 与全部 `authoring.ref`（`:324-332`）。
- 资源级（`AssetPackEntry.superRefine`，`:194-251`）：帧名唯一（`:196-199`）；
  动画帧 ⊆ `frames[]`（`:200-205`）；动画名唯一（`:217-221`）；层名唯一、层与帧一一对应、
  帧名必须是 `<id>.<层名>`（`:226-241`）；多帧且无 `layers` ⇒ 每帧必须归组（`:247-250`）。
  **注意：不检查 `assets[].atlasId` 所指图集的 `assets[]` 是否反向包含该资源**（探针 J）。
- 返回：`{ok:true,value}` / `{ok:false, errors:string[]}`；错误串由 `formatIssues` 生成
  `path: message`（`zod-issues.ts:25-39`），资源用下标、名字在消息里。

### 2.3 `inspectPack`（观察，不是判据）

`ops.ts:1900-1957`：

- 先 `parseAssetPack`（不过 ⇒ 抛，退 4）。
- `paletteUsage` 逐资源：读图集 JSON、`decodePNG` 图集 PNG、按 manifest 帧名取矩形扫像素
  （`:1751-1814`）。**图集里找不到的帧名静默 `continue`**（`:1773`）；不解码失败重试、不判越界。
- `sourceSizeObservations`：源图存在才解码，缺失静默跳过（`:1855`）；只算长宽比差，不设阈值。
- `backgroundCoverage`：只报每层不透明比例（包内 `coverage.json` 的同一 helper）。
- `data` 含 `packId/version`、资源、用色、源图尺寸、层覆盖（`:1946-1954`）。

`runBuild` 的接法（`create-game.ts:510-518`）：`inspect` 成功 ⇒ `Observation{source:"inspect",outcome:"ok",lines}`；
抛错 ⇒ `unavailable` + 分类原因，**build 继续**。失败原因刻意不带路径（`:402-405`）。
`qaVerdict` 不看 observations（`qa.ts:374-379`）；`assemble` 只原样装配（`assemble.ts:95-100`）。
E2：`assemble.test.ts:123-150`「观察换成任意内容，裁决一个字不变」；
`create-game.test.ts:795-806`「inspect 抛错 ⇒ unavailable + build 继续；reason 不带路径」；
`qa.test.ts:210-216` 变异检验。

### 2.4 QA 三族（链上真阻断的只有 `failures` 里的 `error`）

- 视觉族（`qa/src/visual.ts:84-99`）：`constructive-constraint` 逐资产 `auditAssetSpec`
  （spec ↔ manifest）；`palette-binding` 对账 `palette.coverage` 四数 vs 资产声明，
  并检查 `palette.ref` 在 `files[]` 里（`:157-174`）。
- 玩法族（`qa/src/gameplay.ts:71-86`）：`auditReferences`（`game-config.ts:271-347`，含
  `player.anims` 三个动作解析到互不相同的动画）与 `auditReachability`（纯静态 BFS）。
- 意图族（`qa/src/intent.ts`）：id 级集合差，不在本票范围。
- 失败 ⇒ `QAFinding{target,severity,detail}`；`buildQAReport` 投影加 `judgement`
  （`qa.ts:330-355`）；`assertQaPassed` 只筛 `severity:"error"`，把前 8 条 + 报告路径拼进
  `CommandError("invalid")`（`create-game.ts:215-226`）。E2：`create-game.test.ts:655-670`。
- **`checked` 恒 5/6，`qaVerdict` 恒 `incomplete`**（`layer-coverage` 无族，`assemble.ts:85-93`）；
  闸不看 verdict，只看 error。

### 2.5 `pack` 自校验与构建期检查（写入侧）

- 入口：`packAssets` `parseRecipe`（`ops.ts:1508-1511`）+ `readStyle`（空色板拒绝 `ops.ts:1504`）。
- 解码：import 源图 `decodePNG`（`pack.ts:1025`）；生图上游按 mime 分派 PNG/JPEG
  （`image-gen.ts:333-343`，基线以来唯一的代码增量）；参考图 / 母版也解码。
- 透明 / 构图：`pack.ts:812-818`、`:872-896`、`:900-930`；按格校验 `sheet.ts:228-270`。
- 确定性：`buildAtlas` shelf pack + 固定排序；同输入逐字节相同（`pack.test.ts:70-75`）。
- 产物自校验：把**刚写下的 manifest 字节**读回 `parseAssetPack`（`pack.ts:1284-1292`），
  **只过 schema**，不重读 checksum，不解码输出 PNG。
- `auditAssetSpec` 在 `pack.ts:1290-1296` 被调用，但**结果只放进返回值 `audit`，不失败**；
  `runBuild` 也不消费 `packed.audit`。

### 2.6 `site` / `compileRuntime`

- `compileRuntime`：`parseAssetPack` + `parseGameConfig` + `auditGameConfig` +
  `auditScreenSpace` + `auditLayerCoverage`，硬失败退 4（`ops.ts:1044-1058`）。
- `assembleSite`：包 / config / shell 存在性（usage），schema，`auditGameConfig`，
  `auditGeometry`（层几何 + 可选 `coverage.json` 像素门禁），HUD 屏幕空间，硬失败不产出站点
  （`site.ts:169-235`）。两条 coverage 门禁的「今天不会响 / 抓不到」自白见 `site.ts:52-120`。
- 两者都**不调用 `verifyPack`**，也不解码图集 PNG。

---

## 3. 「特别检查」：声称验证的字段真的被读了吗？

| 声称 | 位置 | 实际读取 | 结论 |
|---|---|---|---|
| QA `constructive-constraint` =「尺寸 / **锚点** / **九宫格**」 | `qa.ts:114`、`qa.ts:385`、`qa/src/visual.ts:102` | `auditAssetSpec` 读 `kind`、`size`、`animations[].name/frames`、`frames.length`、drawlist `viewBox`（`audit.ts:45-84`）；**不读 `anchor`，不读 `scale9Borders`，不读图集帧 bounds** | **只声明不读取**。锚点 [0,1] 只由 `parseAssetPack` 的 schema 间接保证（`visual.ts:87` 先跑）；「size 与帧 bounds 一致」只由 `pack` 把 `entry.size` 写成第一帧实际像素尺寸间接保证（`pack.ts:1211`），没有任何代码读图集 bounds |
| `AtlasEntry.checksum` | `assetpack.ts:262`；写入 `pack.ts:1165` | 全仓无读取；`verify` 只比 `files[].checksum`（`ops.ts:1678`） | **死字段**。同一文件的同一事实存了两份，只有一份被校验 |
| `Animation.fps` / `loop` | `assetpack.ts:160-161`；写入 `pack.ts:1054-1055` | `inspect` 打印（`ops.ts:1950`）；运行时**零读者**，写死 `frameRate` 与 `repeat:-1`（`scene.ts:191,140`；`td/scene.ts:143`） | **播放配置不生效**。v7 `jump` 声明 `fps=10, loop=false`，实际 6fps 循环（E3 + E1） |
| `FrameRef.index` / `durationMs` | `assetpack.ts:153-154` | 全仓零读者；`pack` 只写 `{name}`（`pack.ts:1219-1221`） | **死字段** |
| `AssetPackEntry.required` | `assetpack.ts:170`；写入 `pack.ts:1209` | 生产代码零读者 | **只写不读** |
| `checkSize`（尺寸越界） | `audit.ts:24-33` | 生产调用者 **0**（全仓 grep 只有定义与测试） | **死检查** |
| 绑定 `palette.size == values.length` | `assetpack.ts:304`；QA 刻意不重查（`visual.ts:151-153`） | schema 读；QA 不重写 | 正确分工，**不是**只声明 |

**探针证据**（`/tmp/probe-audit.test.ts`，E1+R）：构造 `spec.anchor={0,0}` /
`entry.anchor={0.9,0.9}`、`spec.ninePatch={4,4,4,4}` / `entry.scale9Borders={1,1,2,2}` 或
`{40,40,10,10}`，`auditAssetSpec` 均返回 `[]`；只把 `size` 从 `96×26` 改成 `97×26` 才返回 1 条。

---

## 4. 返回结构、错误对象与定位

| 层 | 成功 | 失败 | 结构化字段 | 定位 |
|---|---|---|---|---|
| `parseAssetPack`（`assetpack.ts:344-346`） | `{ok:true,value}` | `{ok:false,errors:string[]}` | 无（纯文本 `path: message`） | JSON 路径 + 消息里的 id / 帧名；无文件 |
| `verifyPack`（`ops.ts:1662-1727`） | `CommandResult.data.ok=true` + `problems:[]` | 抛 `CommandError("invalid")` | `CommandError{kind,message,ledger?,failureDir?}`（`command.ts:67-87`） | 相对文件路径；无资源 / 帧；最多 6 条 |
| `auditAssetSpec`（`audit.ts:45-84`） | `[]` | `string[]`（每条 `资源 "id"：…`） | 无 | 资源 id + 动画名 / 帧数；无文件 / 单个帧名 |
| `ConfigIssue`（`game-config.ts:271+`） | `[]` | `{severity,where,message}[]` | 有 3 字段 | `where` 是人话（`entity "x"` / `player.anims.idle`）；无文件 |
| QA `QAFinding` / `QAFailure`（`qa.ts:168-183`） | `findings:[]` | `{target,severity,detail}` + `judgement` | 有 | `target` 是资源 id / `recipe` / `game-config`；帧只在 `detail` 文本里；无文件 |
| `inspectPack`（`ops.ts:1900-1957`） | `CommandResult.data`（`InspectData`） | 抛（多为裸 `Error`） | 结构化观察 | 解码错误**不带路径**；runBuild 再剥路径 |

**错误分类问题**：`verify` 对坏 JSON 不捕获 ⇒ 裸 `SyntaxError` 退 1（探针 M/N）；`pack` 的
import 源图解码失败也是裸 `Error`（`pack.ts:1025`），退 1 —— 而「输入文件坏了」按退出码表更像
`invalid(4)`。仓库有先例把「我们的 bug」定为 1（`command.ts:28-35`），但「用户给的 manifest 坏了」
不是我们的 bug。未见测试钉住这一档。

---

## 5. 重复实现与死代码

**真正的重复 / 漂移风险**

1. **同一文件两份 checksum**：`files[].checksum`（被 `verify` 校验）与 `atlases[].checksum`
   （写入但不读）。探针 C：换 1×1 PNG、只重算 `files[]`，`atlases[].checksum` 保持旧值 ⇒ `verify` 通过。
2. **动画帧引用校验两处活实现**：`AssetPackEntry.superRefine`（`assetpack.ts:200-205`）与
   `resolvePackRef`（`assetpack.ts:385-388`）。两者都对同一事实「动画帧必须存在于 frames」发声，
   消息不同；前者拒绝整包，后者给引用点上下文。今天未漂移，但无共享 helper。
3. **文件存在性**：`verifyPack`（files[] ↔ 磁盘）、`assembleSite`（包 / config / shell）、
   各读取函数各查一次，语义不同；`qa/src/visual.ts:126-132` 与 `ops.ts:1855` 对缺失文件
   **静默跳过**并明确把责任推给 `verify`。这属于「分层」而非重复，但**没有任何一处覆盖
   `palette.ref` 的缺失**（只有 QA `palette-binding` 查它在不在 `files[]`，`visual.ts:168-171`）。
4. **帧数一致性**在四个层次各查一次：recipe 的 `sheet.columns×rows==frames`（`recipe.ts:222-226`）、
   pack 的「检测到 N 块 vs spec」（`pack.ts:925-960`）、manifest 的「多帧必须归组」
   （`assetpack.ts:247-250`）、`auditAssetSpec` 的「动画要 N 帧实际 M 帧」（`audit.ts:62-65`）。
   输入 / 输出不同层，**不是同一句话**；但读报告的人会看到四种措辞。
5. **层名唯一**在 recipe 与 assetpack 各一份（`recipe.ts:181-190` vs `assetpack.ts:229-233`），
   代码注释承认这是**有意镜像**（入口堵已知、交付兜全部）。
6. **`checkSize`**：与 `auditAssetSpec` 的尺寸对账、`raster.ts` 的 ink bounds 各有不同语义，
   但零生产调用者 ⇒ 死代码。

**做对了的单一实现**（不应算重复）：`derivePackMode`（写入 / 校验共用）、`resolvePackRef`
（QA / demo / build 共用）、`auditReferences`（QA / compile / site 共用）、
`backgroundCoverage`（pack / inspect / site 共用）、`auditLayerCoverage`（compile / site 共用）、
`paletteBindingOf`（pack 的值、不是第二判据）。

---

## 6. W4 复验（基线 `ea53240` → HEAD `f0dac01`）

`git diff ea53240..HEAD -- packages` 只有 JPEG 支持相关 5 个文件（`image-gen.ts`、`jpeg.ts`、
`image-gen.test.ts`、`index.ts`、`package.json`），**未触碰任何验证器 / 测试 / 契约**；
因此 W4 的验证相关结论在 HEAD 应原样成立。逐条复验：

| W4 结论 | HEAD 复验 | 证据 |
|---|---|---|
| `verifyPack` 存在但 `runBuild` 不调用 | **成立** | `pipeline` 全包无 `verifyPack`；`create-game.ts:19-27` 只 import `inspectPack`；`:499` 只 `parseAssetPack` |
| `inspect` 只观察、不阻断 | **成立** | `create-game.ts:510-518`；`assemble.ts:97-100`；`qaVerdict` 不看 observations（`qa.ts:374-379`）；E2 `create-game.test.ts:795-806`、`assemble.test.ts:123-150`、`qa.test.ts:210-216` |
| Asset QA 只对账 spec ↔ manifest 元数据 | **成立** | `audit.ts:45-84`；探针 audit 证明 anchor / 九宫格 / 帧 bounds 不在对账内 |
| `pack` 返回 `audit` 但 `runBuild` 不消费 | **成立** | `pack.ts:1290-1296`；`create-game.ts` 全文无 `audit` |
| `inspect` 是免费旁路、读真实像素但不打分不阻断 | **成立** | `ops.ts:1751-1814,1850-1897`；`inspect.test.ts:26,91` |
| `checkSize` 会产 warning 但无生产调用者 | **成立** | `audit.ts:24-33`；全仓无调用 |
| 阻断只对 `create --yes` / `build` 且只被 `error` 触发 | **成立** | `create-game.ts:215-226,544`；`cli.test.ts` / `create-game.test.ts:640-670` |

**行号漂移**：W4 的 `ops.ts:1662-1730`（现 1662-1727）、`audit.ts:45-83`（现 45-84）等仅小幅
漂移；结论不受影响。**唯一需要注意的新增**：JPEG 解码只影响生图上游输入，不改变包级校验。

---

## 7. 运行证据（命令 + 退出码）

### 7.1 仓库定向测试（E2，全部 exit 0）

| 命令 | 结果 |
|---|---|
| `pnpm exec vitest run packages/contracts/tests/assetpack.test.ts` | 1 file / **40 tests passed**，exit 0 |
| `pnpm exec vitest run packages/qa/tests/visual.test.ts packages/qa/tests/gameplay.test.ts` | 2 files / **26 passed**，exit 0 |
| `pnpm exec vitest run packages/assets/tests/pack-selfcheck.test.ts packages/assets/tests/inspect.test.ts packages/assets/tests/import-fixture.test.ts` | 3 files / **14 passed**，exit 0 |
| `pnpm exec vitest run packages/cli/tests/cli.test.ts` | 1 file / **20 passed**，exit 0 |
| `pnpm exec vitest run packages/qa/tests/assemble.test.ts packages/contracts/tests/qa.test.ts` | 2 files / **41 passed**，exit 0 |

未跑全量 `pnpm test`（票 08 已跑过：105 文件 / 1647 用例全绿）；未跑 `pnpm check` / `pnpm build`。

### 7.2 真实包只读 `verify` / `inspect`（E3）

v7 基准包
`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7`：

- `verifyPack`：`ok=true`，`157` 个文件 checksum 全对，`packId=ruin-scavenger-extraction-assets`，`version=7`，`mode=mixed`。
- `inspectPack`：`19` 个资源 / `4` 张图集 / `76` 帧；13 条动画；`12` 条源图→目标读数。
  `scavenger-actor`：`idle 4/fps=6`、`run 8/fps=12`、`jump 4/fps=10 loop=false`。
  **运行时不会使用这些 fps/loop**（见 §3）。
- 全程只读，未写包、未写 `out/`，零付费。

### 7.3 `/tmp` 行为探针（E1+R，非仓库测试，故意未入库）

为覆盖仓库测试的空洞，把 fixture 包 `fixtures/packs/counter-siege/v4` 复制到 `os.tmpdir()`
后篡改，再调用**源码**（`packages/assets/src/index.ts` / `packages/contracts/src/index.ts`，
避免 `dist/` 过期）。全部 exit 0：

| 探针 | 断言 | 证明了什么 |
|---|---|---|
| A | 原包 `verify`/`inspect` 通过 | 基线有效 |
| B | 删 `delivery/atlas.animations.png` ⇒ 抛 `缺文件：<相对路径>` | 文件存在检查真的读磁盘 |
| C | 图集 PNG 换 1×1（只重算 `files[]`，`atlases[].checksum` 保持旧值）⇒ `verify` 通过 | 不查尺寸；图集 checksum 是死的 |
| D | 图集 PNG 换文本（重算 `files[]`）⇒ `verify` 通过、`inspect` 抛 | verify 不解码 |
| E | 帧矩形 `x=y=9999`（重算 `files[]`）⇒ `verify` 通过 | 不查图集边界 |
| F | manifest 加一个图集里不存在的帧 + 动画引用 ⇒ `verify` 通过 | 帧引用只对 manifest 自洽 |
| G | 锚点 `x=1.5` ⇒ schema 拒 | 锚点范围是 schema 在管 |
| H | `fps=0` ⇒ 拒；`fps=100000` / `index=99` / `durationMs=0.0001` ⇒ 通过 | 播放参数只有类型 / 正数约束 |
| I | 包内多一个未记录文件 ⇒ 抛 `files[] 没记录的文件` | 反向集合对账有效 |
| J | 从图集 `assets[]` 删一个资源 id ⇒ schema 与 verify 都通过 | 资源↔图集不做反向互检 |
| K | `atlases[].frames=999` ⇒ verify 通过 | 图集帧数不与 JSON 对账 |
| L | `v4` 包放进 `v99/` ⇒ verify 通过 | 目录版本不核对 |
| M/N | `manifest.json` 坏 JSON ⇒ 裸 `SyntaxError`、退 1（verify 与 inspect 都是） | 错误分类不一致 |
| audit | 锚点 / 九宫格中央区两端大幅不同 ⇒ `auditAssetSpec` 返回 `[]` | QA 判据不读这些字段 |
| atlas | 单帧宽 5000 ⇒ `buildAtlas` 不拒；高 5000 ⇒ 拒 | 构建期只限高，不限宽 |

---

## 8. 证据弱点与未验证项

- **没有仓库内负例**覆盖 `verify` 的缺文件 / 大小不符 / 未记录文件 / 图集越界 / 非 PNG /
  坏 JSON；§7.3 的探针是**本票临时**的，不入库、不会被 CI / 下一个人重跑。
- **没有一条测试**验证「QA 判据读锚点 / 九宫格」——因为它今天不读；标签与注释仍是旧口径，
  下一个人容易把它当活判据。
- **图集 JSON 无 schema**：`inspect` / `review` 都用 `JSON.parse(...) as {…}` 的 cast
  （`ops.ts:1765-1766`、`review.ts:30-31`）。坏形状只会在使用处变成 `undefined` 或静默跳过。
- **`coverage.json` 的版本对账只在 `site` 做**，`verify` 不做；且没有一条测试钉「版本不符 ⇒ 拒」。
- **QA 报告与包版本无结构化关联**（`qa.ts:266-274` 只有 `format/checked/failures/observations`）；
  `run/v<N>` 里的报告可能描述 `pack/vM`（`packVersion != runVersion` 是合法分支，
  `create-game.ts:439-441`）。跨版本追溯只能靠目录命名与 `inspect` 文本首行。
- **运行时真实播放未在本票验证**：`fps/loop` 写死是 E1 静态读数；实际动画外观 / 帧顺序 /
  锚点是否对齐属于票 06 的 CDP 证据。本报告不把「能加载」当「播放正确」。
- **未运行 `create` / `build` / `pack`**（会写 `out/`、可能花钱）；所有包级结论来自只读
  `verify` / `inspect` 与测试内临时目录。
- **`packages/cli/dist` / `packages/assets/dist` 未入库且可能过期**，因此探针直接 import
  `src`，没有把 `dist` 当证据。

---

## 9. 与后续票的接口（只陈述事实，不给 Phase 1 方案）

- 若 Phase 1 要「资源包级别、自动、可阻断」的确定性验收，**最接近的落点是扩 `verifyPack`
  并把它接进链**；现有 `verify` 已具备文件 / checksum / sidecar 版本三块，缺图集 JSON 与解码。
- 若要在 QA 报告里定位到帧 / 文件，现有 `QAFinding{target,severity,detail}` 只有 `target`
  一个结构化定位字段；`detail` 是自由文本。
- 若要复用锚点 / 九宫格检查，**不能直接相信 `constructive-constraint` 的标签**：
  `auditAssetSpec` 不读这两项，需要新增读取或明确降格标签。

---

## 10. 主要证据文件

- `packages/assets/src/ops.ts`（`verifyPack` 1662-1727、`inspectPack` 1900-1957、`packAssets` 1508+）
- `packages/assets/src/pack.ts`（生成期校验 812-930、自校验 1284-1292、manifest 组装 1140-1270）
- `packages/assets/src/atlas.ts`（图集组装 55-91）
- `packages/assets/src/png.ts`（解码 44-60）、`import.ts`（416、473-525）、`sheet.ts`（228-270）
- `packages/contracts/src/assetpack.ts`（schema + superRefine 194-333、`resolvePackRef` 377-426）
- `packages/contracts/src/audit.ts`（`checkSize` 24-33、`auditAssetSpec` 45-84）
- `packages/contracts/src/qa.ts`（判据声明 100-149、finding 168-183、报告 266-379）
- `packages/qa/src/visual.ts`、`gameplay.ts`、`assemble.ts`
- `packages/pipeline/src/create-game.ts`（runBuild 417-560、`assertQaPassed` 215-226）
- `packages/demo/src/site.ts`（169-235、coverage 门禁 52-120）、`layout.ts`（114-116）
- `packages/demo/src/shell/scene.ts`（191、140）、`shell/td/scene.ts`（143）
- 测试：`packages/contracts/tests/assetpack.test.ts`、`asset-spec.test.ts`、`qa.test.ts`；
  `packages/qa/tests/{visual,gameplay,assemble}.test.ts`；
  `packages/assets/tests/{pack,pack-selfcheck,pack-sheet-grid,pack-frames,inspect,import-fixture,ledger,raster,import}.test.ts`；
  `packages/cli/tests/cli.test.ts`；`packages/demo/tests/site.test.ts`；
  `packages/pipeline/tests/create-game.test.ts`
- 既有线索（已复验）：`.scratch/p0-00-audit/research/w4-qa-capability.md`
