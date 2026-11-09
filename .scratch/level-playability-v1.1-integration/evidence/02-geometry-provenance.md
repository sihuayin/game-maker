# I00-02 AssetPack 几何证据来源（证据）

| 项 | 值 |
| --- | --- |
| 票 | `issues/03-i00-02-asset-geometry-provenance.md` |
| 对应硬门槛 | G-01 Hitbox 来源可信（`docs/v7.8/移动.md:198-203`） |
| 日期 | 2026-11-09 |
| 分支 / HEAD | `wayfinder/level-playability-v1.1-integration` / `330d6dc3919d9f7fa9de05baff9668a4a1177133` |
| 权威输入 | `docs/v7.8/移动.md` · `sha256:3598cc19889b10a9fabf3a4f6f28ae7cee43a22355b639d8d61298e6d459cea9` |
| 样本包 | `fixtures/packs/last-train/v2` · `manifest.json` `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` |
| 图集 JSON | `delivery/atlas.animations.json` `sha256:6874ae923c2ee8287e4d4e534e8498b0ef5e108460364151e39d4dcfb766c86d`；`atlas.backgrounds.json` `sha256:cc8c7861ecff8e53652131ad8f93e26dedf0d06a25da7b4d34b18a08f015dc29` |
| 探针 | `../scripts/geometry-provenance-probe.mjs`（只读；退出码 0 = verify 通过且 acceptance 无 error） |
| 反例实验 | `../scripts/geometry-mutation-probe.sh`（只在 `mktemp -d` 副本上改写） |
| 工作区改动 | 仅本 effort 的 `evidence/`、`scripts/` 与本票文件；`git status --porcelain packages/ docs/ fixtures/` 为空 |

> 本文只取证与列边界，**不做裁定**。选项取舍、`accepted pack` 是否引入、`coverage.partial` 是否改语义，均归 I00-R1。

---

## 0. 摘要

1. **今天审计路径只能看到 manifest。** `auditPlayability(config, manifest)` 的入参没有包目录，也没有图集 JSON（`packages/contracts/src/playability/api.ts:64-68`）；`config-audit.ts:53` 与 `publish-gate.ts:140` 是仅有的生产调用点。manifest 按设计**不含逐帧几何**（`assetpack.ts:10-16,171-175`），逐帧 `sourceSize` / `anchor` 只在 TexturePacker JSON（`atlas-json.ts:35-48`）。
2. **逐帧等式只在 acceptance 里被比对。** `acceptance.ts:306-347,654-670` 是生产代码中唯一读取 atlas JSON 并做该比对的地方（契约 `AtlasJson` 的生产读者只有 `acceptance.ts:19,588-605`（写入侧的 `atlas.ts:31` 是另一个同名局部类型））。
3. **acceptance 的口径是「包内部自洽」，不是「艺术真值」。** 一份 atlas 与 manifest 一起被改写成另一种几何的包，仍可通过 `verifyPack` 与 acceptance（实验 `pack-c2`，见 §2.3）。这与 G-01 的字面等式（帧几何 == manifest 标称）不冲突：Runtime 读的也是同一份 atlas。但「真实 Asset Pack 帧」若指艺术/生产者真实性，当前没有任何签名或外部证据。
4. **传递性证据成立需要 6 个前提**（同字节、干净报告、身份复核、逐帧 anchor 在场、审核时未再被改写、工具版本可解释）；缺一即不能作为「已证明事实」，只能退化为 IE/partial（§2.2）。
5. **`accepted pack` 在生产代码中不存在。** 生产里只有 `accept` 命令与 `animation-acceptance/v1` 报告，没有类型、注册表、manifest 标记或任何消费者；P0 文档里的 `accepted pack` 实际指 `fixtures/packs/last-train/v2`（E3 扫描背书），该 fixture **没有** acceptance 报告（§4）。
6. **若集成需要「accepted pack」，最小代价是复用既有 acceptance 报告 + 身份复核，而不是新造概念**；但只要触及 contracts / pipeline / CLI / MCP / 新公开参数，就落 PRD §9.2 的独立授权，且先经 I00-R1 契约冻结与 I00-R2 白名单（§4.3）。

---

## 1. 现有信任链的完整形状

### 1.1 图

```text
[写入侧 pack.ts / atlas.ts]                       [读侧 / 校验侧]
  frames[i].image ──► atlas JSON: sourceSize=f.w/h  ──┐
  spec.anchor   ──► atlas JSON: anchor              ──┤
  frames[0].image ─► manifest.assets[].size         ──┤ (只取第 0 帧)
  spec.anchor   ──► manifest.assets[].anchor        ──┤
  walk(packDir) ──► manifest.files[].sha256 ◄────────┘
                          │
                          ▼
   verifyPack (ops.ts:1916-1980)          只证明：字节 == files[]
                          │
  acceptAnimationPack (acceptance.ts:566) 先 verify，再逐帧比对 atlas ↔ manifest
                          │
                          ▼
   animation-acceptance/v1 报告            只记身份 + findings；不记逐帧值 / 无 accepted 布尔
                          │
                          ▼
   （生产代码无读者）

   另一条独立链：
   QA 报告 subject.manifestChecksum (create-game.ts:690-696)
        └─► publish-gate 复核 (publish-gate.ts:114-123)
   delivery.pack.manifestChecksum (delivery.ts:29,41)
        └─► 视觉评审写入时复核 (delivery.ts:203-206)

   审计链：
   config + manifest ─► auditPlayability ─► verdict
        ▲
        └── 只有 manifest；没有 packDir / atlas（api.ts:64-68）
```

### 1.2 逐跳：证明什么、不能证明什么、失败时怎样

| # | 跳 | 代码 | 能证明 | 不能证明 | 失败时行为 |
| --- | --- | --- | --- | --- | --- |
| W | 写入侧同源构造 | `pack.ts:1159-1162,1216-1218`；`atlas.ts:77-85`；导入多帧共用框 `import.ts:551-574` | 对**本管线产出的包**，写入时 manifest `anchor` 与 atlas 逐帧 `anchor` 来自同一个 `spec.anchor`；atlas `sourceSize` 来自实际帧图；manifest `size` 取第 0 帧实际尺寸 | 不证明第三方包；不证明磁盘上的包没被改写；不证明第 1..n 帧尺寸与第 0 帧相同（`size` 只取 `frames[0]`） | 写入异常直接失败，不产包 |
| S | manifest schema | `assetpack.ts:265-300`；`size/anchor:171-175`；`atlases:253-263`；`files:298-299`；交叉引用 `300-331` | 结构合法；`size` / `anchor` 必填；atlas 的 `meta` / `image` 必须出现在 `files[]`；`asset.atlasId` 必须存在 | **不**把 `asset.size` 与 atlas 帧做任何比较；manifest 里根本没有逐帧几何（`:10-16`）；不证明 `files[]` 的 sha 被真的重算过 | `parseAssetPack` 返回 `ok:false`，调用方按 invalid 处理（`verifyPack` 退出码 4） |
| V | `verifyPack` | `ops.ts:1916-1980` | manifest schema；`files[]` 每一项存在、字节数、sha256 相符；反向穷举：磁盘上没有 `files[]` 之外的文件（`:1963-1965`）；ledger / master-ratios 若存在也过 schema | **不解析 atlas JSON**；不比较几何；不证明 manifest 自身可信（manifest 被自指排除，`assetpack.ts:298`）；不证明「验完之后没再被改」 | 任一问题即 `CommandError("invalid")`（退出码 4），不产降级产物（`:1967-1968`） |
| A | `acceptAnimationPack` | `acceptance.ts:566-575`；先 verify `:263-273,568`；atlas 解析 `:588-605`；图集 checksum / 尺寸 `:607-632`；帧数 `:634-640`；逐帧对账 `:297-356,645-672`；跨资源重名 `:687-699` | 对**运行时那一刻的包字节**：每个 manifest 帧在 atlas 里存在；`sourceSize == asset.size`（无条件，`:306`）；`spriteSourceSize` / `frame` / `trimmed` 自洽（`:314-339`）；atlas 帧矩形在 PNG 内（`:660-668`）；`anchor == asset.anchor` **仅当 atlas 声明了 anchor**（`:341`）；图集帧数一致；跨资源帧名不重复 | 不证明 anchor 在场；不证明「几何是艺术真值」；不证明包在生产链上；不证明报告被保存；不证明 human/runtime | `verifyPack` 失败 ⇒ **抛**（无 findings、无报告）；否则 error findings 进报告，`hasErrors=true`（`:537-545`），CLI 仍写报告但退出失败（`cli.ts:749-751`） |
| R | acceptance 报告 | 契约 `animation-acceptance.ts:16,193-206`；身份 `acceptance.ts:501-514`；写入 `:840-857` | 报告时刻的 `manifestChecksum`、每张图集 `imageChecksum` / `metaChecksum`；`findings[]`；`toolVersion`；`human` / `runtime` 状态 | 不记录逐帧几何值；**没有 `accepted` 布尔**；`toolVersion` 恒为字面量 `"0.0.0"`（`acceptance.ts:68`）；`human.verdict` 写入时恒为 `"pending"`（`:526-528`）；`runtime.status` 恒为 `"unverified"`（`:530`）；不记录包路径 | 报告先过自己的 schema，不过即抛（`:533-535,841-843`）；报告目录 `out/` 被 `.gitignore:10` 忽略 |
| P | QA / delivery 身份钉住 | QA：`create-game.ts:690-696`，复核 `publish-gate.ts:114-123`；delivery：`delivery.ts:29,41,203-206` | QA 报告 / delivery 属于**这一份 `manifest.json` 字节**（id / version / 声明 / files 列表） | 不钉 atlas 几何；不重算 `files[].checksum`；publish gate 明确不跑 `verifyPack`（`publish-gate.ts:15-17`） | 身份不符 ⇒ invalid（退出码 4）；缺报告 / 判据 error ⇒ invalid |
| C | 可玩性审计入口 | `config-audit.ts:28-55`；`publish-gate.ts:134-144`；`create-game.ts:631-636`；`ops.ts:1247-1250,1284-1287` | 使用**同一份 manifest 对象**计算 config 的可玩性；`partial` 会出现在 `coverage` 里 | 看不到 atlas JSON；无法确认 `asset.size/anchor` 与帧几何相等 | IE 不产 `ConfigIssue`（`api.ts:113-120`），因此不阻断；只有 `PROVEN_UNPLAYABLE` 硬拒 |
| B | 站点装配 | `demo/src/site.ts:169-226`；`assembleFromConfig` 调用点 `cli.ts:720-730`；pack 拷贝 `site.ts:220-226` | manifest schema 合法；装配期审计（引用 / 屏幕空间 / 世界几何）通过 | **不跑 `verifyPack`**，不跑 acceptance；拷贝的是当前磁盘上的包；atlas 可在此前被就地改写而不被本路径发现 | 装配期审计 error ⇒ 硬失败、不产站点（`site.ts:216-217`）；校验和问题不会被这条路径报出 |

补充事实（影响「失败时行为」的口径）：

- `site` 命令只过 `assertPublishableQa`（`cli.ts:717-720`），闸只读 manifest + QA 报告身份（`publish-gate.ts:167+`）；`assembleSite` 也只 `parseAssetPack`（`site.ts:178-183`）。
- `runBuild` / `create` 链在 `packAssets` 之后做一次 `verifyPack`（`create-game.ts:563-567`），**只做这一次**；之后 config / QA / site 不再重算。
- `playabilityIssues` 对 `INSUFFICIENT_EVIDENCE` 返回空数组（`api.ts:113-120`），而 `profile.ts:92-97` 把 frame 几何标 `partial`。`partial` 是否拉低整关 verdict，是 I00-01 的已登记缺口（`map.md` 已核实事实 1；`api.ts:87-92` 只看 layer verdict）。

### 1.3 整条链今天能 / 不能证明

**能证明（限 `create`/`build` 的单进程路径、且在 `verifyPack` 那一刻）：**

1. 包内字节与 `manifest.files[]` 一致（`ops.ts:1926-1932,1963-1965`）。
2. manifest 结构合法，且所有被引用文件都在 `files[]` 里（`assetpack.ts:300-331`）。
3. QA 报告 / delivery 属于这一份 manifest 声明（`publish-gate.ts:114-123`；`delivery.ts:203-206`）。
4. 可玩性判定使用的是 manifest 声明的 `size` / `anchor`（`profile.ts:92-97`；`mechanic.ts:122-132`）。

**不能证明：**

1. 帧几何 == manifest 标称——审计入参里没有帧几何，schema 也不强制（`profile.ts:18-25`）。
2. 审计/发布时磁盘上的包仍是 `verifyPack` 验过的那份字节——`site` 路径不重验（`site.ts:169-226`；`publish-gate.ts:15-17`）。
3. 逐帧 anchor 在场——acceptance 只在字段存在时比对（`acceptance.ts:341`）。
4. 包的生产者/艺术真实性——无签名、无外部锚点；manifest 与 atlas 一起自洽改写不可区分（§2.3 `pack-c2`）。
5. acceptance 报告被保留或可定位——报告默认写 `out/`（gitignored），仓库内**没有任何已提交的 acceptance 报告**；现存样本 `out/ruin-scavenger-extraction-assets/acceptance/v2/report.json` 的包目录已不存在（孤立报告，`toolVersion:"0.0.0"`，`human:"pending"`，0 findings）。

---

## 2. 传递性证据是否成立

### 2.1 命题

记：

- `M` = 被审计的 manifest；`A(f)` = atlas JSON 中帧 `f` 的条目。
- `ET(B)` := 对包字节 `B`，对 `M` 的每个 `asset.frames[]`，有 `A(f).sourceSize == asset.size`，且（若 `A(f).anchor` 存在）`A(f).anchor == asset.anchor`。
- `G_audit` = `(asset.size, asset.anchor)`（`profile.ts:92-97` 的 frame 源）。
- `G_run` = `(A(f).sourceSize, A(f).anchor ?? sprite 初始 origin = asset.anchor)`（`scene.ts:139,214-219,270-280`；`draw.ts:120-125`）。

要作为「已证明事实」使用的是：**`ET(B_audit)` 成立 ⇒ `G_audit(f) == G_run(f)` 对全部相关帧成立**。

`acceptAnimationPack` 的干净报告证明的是 `ET(B_accept)`，其中 `B_accept` 是 acceptance 当时读到的字节。因此传递性等于问：`B_accept` 与 `B_audit` / `B_run` 是否是同一份字节，以及 acceptance 的检查是否覆盖所需的每个字段。

### 2.2 前提（缺一即不能升级为「已证明事实」）

| # | 前提 | 代码 / 证据 | 缺失时的降级 |
| --- | --- | --- | --- |
| T1 | acceptance 与审计读的是**同一份包字节**（不只是同 id/version） | 报告记录 `manifestChecksum` + 每张图集 `imageChecksum/metaChecksum`（`acceptance.ts:505-514`）；消费方必须重算并比较 | 身份不符 ⇒ IE（或 invalid，见 §3 失败口径） |
| T2 | 报告是在**当前** acceptance 检查集下产出的，且有 0 条 error finding | `hasErrors` 不落盘，只能由 `findings[]` 推（`:537-545`）；`toolVersion` 是 `"0.0.0"`（`:68`） | 无报告 / 有 error / 版本不可解释 ⇒ IE |
| T3 | 消费方不是「看到报告文件存在」就采信 | 报告**没有** accepted 布尔；`human.verdict` 恒 pending（`:526-528`）；error 报告也会被写出（`cli.ts:749-751`） | 只看存在性 ⇒ 伪绿 |
| T4 | 审计与运行时消费的是同一对 `(manifest, atlas)`；审计使用的 manifest 就是被 acceptance 过的那份字节 | 审计目前从 `packDir` 重新读 manifest（`create-game.ts:570`；`publish-gate.ts:70-78`） | 两次读之间被改写 ⇒ IE |
| T5 | 每个被引用帧的 `anchor` 在 atlas 里**在场**，或集成明确声明「运行时回退到 manifest anchor」并被纳入模型 | acceptance 的 anchor 比对是条件式（`acceptance.ts:341`）；运行时 `setOrigin(manifest anchor)`（`scene.ts:139,217`），Phaser 逐帧 `customPivot` 只在帧声明 anchor 时覆盖（`:214-215`） | 字段缺失 ⇒ 「帧声明 anchor == manifest」未证明（运行时等式另行论证） |
| T6 | 从 acceptance 到审计/发布/装配之间包未被就地改写 | `site` 不重验（`site.ts:169-226`）；publish gate 不跑 verify（`publish-gate.ts:15-17`） | 无法排除 ⇒ IE |
| T7 | 审计时使用的 `size/anchor` 与运行时实际创建 `StaticBody` 的字段语义一致 | hazard 的 `StaticBody` 由 `displayWidth/Height` 决定，P0 已核（`.scratch/level-playability-v1.1-p0/evidence/01-moving-hazard-semantics.md:163,246`）；本 ticket 不重开 P0 | 语义不一致 ⇒ IE |

额外边界（不是前提，但会改变「已证明」的含义）：

- **T8 自洽改写不可区分。** manifest 与 atlas 一起改写、并刷新 `files[]` 后，`verifyPack` + acceptance 都会通过（`pack-c2`）。此时 `G_audit == G_run` 仍成立（两边读同一份声明），但「真实 Asset Pack 帧」作为**艺术/生产者事实**未被证明。G-01 若要求后者，需要签名/外部出处，现有链路没有。
- **T9 并发读三次。** `acceptAnimationPack` 先 `verifyPack`（读一次 manifest），再 `readManifest`（第二次），最后报告身份又读一次 manifest（`acceptance.ts:508`）。若包目录在 acceptance 期间被写，findings 与报告身份可能来自不同字节。静态包无影响；可变目录必须视为未验证。

### 2.3 反例实验（可复现）

命令：`bash .scratch/level-playability-v1.1-integration/scripts/geometry-mutation-probe.sh`
（每次运行在 `/tmp/gm-i00-02.XXXXXX` 创建副本；`fixtures/packs/last-train/v2` 只读。实测退出码见下。）

| 场景 | 改动 | `verifyPack` | acceptance | 说明 |
| --- | --- | --- | --- | --- |
| 原包 | 无 | PASS | CLEAN | 31 个文件 0 不符；hazard 两帧 `sourceSize=64×48`、`anchor={0.5,1}` 与 manifest 一致；`manifestChecksum=sha256:145cb28d…` |
| `pack-a` | 只改 atlas JSON 的 `sourceSize`，不动 `files[]` | **FAIL**（大小不符 + checksum 不符） | **THREW** | `verifyPack` 抓住了「atlas 就地改写但 manifest 未刷新」。`acceptance.ts:568` 直接抛，无 findings |
| `pack-b` | 改 atlas JSON + 刷新 `files[]` 中该条 | PASS | **ERRORS**：`atlas.frame.source-size-mismatch`、`atlas.frame.trim-out-of-bounds`、`atlas.frame.size-mismatch` | 证明「verify 通过」**不等于**几何一致；只有 acceptance 会比对 |
| `pack-c2` | atlas 与 `manifest.asset.size` 一起改成 32×24，并刷新 `files[]` | PASS | **CLEAN** | 完全自洽的另一种几何声明：acceptance 证明的是内部一致，不是外部真值。Runtime 也会按 32×24 建 body，所以审计与运行时仍一致；但艺术帧并未改变 |
| `pack-d` | 删掉 sweep1 的 atlas `anchor` + 刷新 `files[]` | PASS | **CLEAN** | acceptance 的 anchor 比对是条件式（`acceptance.ts:341`）。干净报告**不能**推出「逐帧 anchor 已核对」；只能推出「未声明、因此未比对」 |

原始输出摘要（2026-11-09，Node v22.23.2）：

```text
===== original (fixtures/packs/last-train/v2) =====
verify=PASS acceptance=CLEAN
  manifestChecksum=sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689
  files=31 mismatched=0
EXIT=0
===== pack-a (atlas only) =====
verify=FAIL acceptance=THREW
  verify: 校验不过（2 处）：大小不符：delivery/atlas.animations.json（记 5910，实际 2939）；checksum 不符：...
EXIT=1
===== pack-b (atlas + files[]) =====
verify=PASS acceptance=ERRORS
  acceptance errors: atlas.frame.source-size-mismatch, atlas.frame.trim-out-of-bounds, atlas.frame.size-mismatch
EXIT=1
===== pack-c2 (atlas + manifest.size + files[]) =====
verify=PASS acceptance=CLEAN
EXIT=0
===== pack-d (drop frame anchor + files[]) =====
verify=PASS acceptance=CLEAN
EXIT=0
```

现有验收单测（E2）：`pnpm vitest run packages/assets/tests/acceptance.test.ts` → **EXIT=0**，18/18 通过。其中「锚点 / 尺寸不一致 ⇒ 两条各定位到帧」直接覆盖 `atlas.frame.anchor-mismatch` 与 `atlas.frame.source-size-mismatch`（`packages/assets/tests/acceptance.test.ts:323-337`）；「缺帧」覆盖 `atlas.frame.missing`（`:298-305`）；「幽灵帧」确认只是 warning（`:307-315`）。

### 2.4 必须降级的情形（传递性口径）

1. **非 accepted pack**：没有报告，或报告不是对这份字节跑出来的 ⇒ 传递性不成立；只能改为分析时直接读 atlas 并复验（§3 a/d），否则 IE。
2. **报告存在但身份不符**：manifest 字节变了（`manifestChecksum` 不同）或任一图集 `meta`/`image` 变了 ⇒ IE。`pack-a`/`pack-b` 的 `manifestChecksum` 都与原包不同或文件不符。
3. **报告有 error finding**：包括 `atlas.frame.*`、`atlas.json.*`、`atlas.image.*`、`pack.atlas.file-missing` 等 ⇒ IE。warning（`atlas.frame.ghost`）不直接破坏几何，但需要逐条分类（§5）。
4. **anchor 缺失**：`pack-d` 证明干净报告不覆盖这一条；若集成承诺「帧几何 == manifest」的逐字段版本，必须 IE 或显式改用运行时回退语义（T5）。
5. **包在 acceptance 之后被就地改写**：尤其 `site`/外部包路径不重验（`site.ts:169-226`）⇒ IE。
6. **自洽改写**：`pack-c2` 说明它能骗过 verify+acceptance。若 G-01 的「真实 Asset Pack 帧」包含出处/真实性要求，这条没有证据 ⇒ IE；若只要求「审计与运行时同源」，它可以成立，但必须在契约里写清楚这是哪一种。
7. **acceptance 工具版本不可解释**：`toolVersion:"0.0.0"` 使「这份干净报告覆盖了哪些检查」不可判定 ⇒ IE（或要求消费方在分析时重跑 acceptance）。
8. **acceptance 期间目录可变 / 多读不一致**：T9 ⇒ IE。

### 2.5 `profile.ts:18-25` 判 `partial` 的理由是否仍成立

**成立，而且是对当前代码的准确描述：**

- `profile.ts:19-21` 说的「审计输入看不到图集 JSON」为真：`auditPlayability` 的签名只有 `(config, manifest, profile)`（`api.ts:64-68`），`mechanic.ts:122-127` 也只调用 `runtimeEntityGeometry(entity, manifest)`。
- 「帧尺寸 / 帧锚点 == manifest 标称值这条等式不在 schema 里」为真：`assetpack.ts:171-175` 只有资源级 `size/anchor`，逐帧几何只在 `atlas-json.ts:35-48`。
- 「只由 pack acceptance 保证」为真，但**没有任何通道把这份保证送进审计**：`acceptance.ts` 是唯一读者，`animation-acceptance/v1` 没有消费者。

若集成为审计新增一条「已校验的帧几何」通道，`partial` 的**理由**会改变，届时是否把 hazard/目标几何升为 `checked`、以及 `partial` 是否参与顶层聚合，属于 I00-01 与 I00-R1 的裁定，不在本文。

---

## 3. 审计取得帧几何的四个选项

> 共同约束：`packages/contracts` 的 `dependencies` 只有 `zod`（`packages/contracts/package.json`），playability 是纯函数；**contracts 不能读文件、不能依赖 `@game-maker/assets`**（方向是 assets → contracts）。因此任何「审计时读 atlas」的方案都必须由调用方读文件、把已解析几何传进 contracts，或把审计挪出 contracts（后者是架构级改动）。
>
> 另一个共同约束：当前 `partial` 不参与整关聚合（`api.ts:87-92`；`verdict.ts:104-115`），所以「几何未确认」在今天**不会**自动变成 IE。任何选项若只增加 `coverage` 而不改聚合/入口，G-01 的「无法确认时降级为 IE」仍不成立。

### 3.1 对比表

| 维度 | (a) 审计时读 atlas JSON | (b) 已验收包清单 / 证据文件 | (c) 扩展 manifest 承载逐帧几何 | (d) 调用方传入已校验目录并在分析时复验 |
| --- | --- | --- | --- | --- |
| 需要改动的模块 | 读文件的一侧（pipeline/assets）+ contracts 新增几何入参；`config-audit.ts`、`publish-gate.ts`、`create-game.ts`、`ops.ts` 调用点 | `acceptance.ts` 已有报告；新增定位/复核消费者：`publish-gate.ts`、CLI/MCP、可选 `create-game.ts`；若报告要影响 verdict，还需 contracts 通道 | `assetpack.ts`（`FrameRef` + 格式版本）、`pack.ts` 写入侧、`acceptance.ts` 比对、所有 v4 读者、fixtures 重产 | CLI/MCP/pipeline 在审计前 `verifyPack`（+ acceptance）；若要影响 verdict，contracts 需新增「已校验」信号 |
| 是否触及公共契约 | **是**（`auditPlayability` / `auditConfigPipeline` 的入参或新类型） | **视实现**：只复用 `animation-acceptance/v1` 则无新 schema；新增「清单/注册表」就是新契约；新增 pipeline 选项是公开参数 | **是，且需格式升版**（`.strict()` 加键 ⇒ v4→v5；旧包/旧读者互不兼容） | **是**（若新增 pipeline/CLI/MCP 选项或 `ConfigAuditContext` 字段）；若只做内部闸，可不动公共类型，但仍改行为 |
| 性能 | 低：4 张 atlas `readFile+JSON.parse` 实测 **0.051 ms/次**（1000 次平均，本机）；应在一次构建内缓存 | 低–中：只复核身份需 hash manifest + atlas（数 ms）；探针整体约 **90 ms**（含 Node 启动、verify、acceptance 与 PNG 解码；`verifyPack` 单项约 **5 ms**） | 低（manifest 变大），但仍需 acceptance 才能证明两处一致 | 中：`verifyPack` 约 5 ms/包；若加 acceptance，整体探针约 90 ms/包（含 Node 启动） |
| 对调用方影响 | 所有审计调用方必须提供几何或接受 IE；`ops.ts:1247,1284` 的重采样循环每 attempt 一次 | 现有包都没有报告（last-train fixture、仓库内包）⇒ 若强制则全部降级；需要报告定位（`out/` 不跟包走） | 最大：所有 manifest 读者、所有历史包/run/fixture；需要迁移与格式升版 | 外部包在 `site` 路径会被新验；现有库调用方若不给选项则行为不变 |
| 失败降级为 IE | 缺 atlas / 不可读 / schema 不过 / 缺帧 / 尺寸或 anchor 不符 ⇒ IE | 无报告 / 身份不符 / 有 error / 版本不可解释 ⇒ IE | 字段缺失（旧包）/ 与 atlas 不符 ⇒ IE；但两者都在包里，仍需决定谁是真值 | verify/acceptance 失败 ⇒ IE 或硬拒（口径需 R1 定；G-01 字面是 IE） |
| 主要优点 | 不引入新持久化概念；分析时直接可验；与「真实帧」最接近 | 复用既有 acceptance 语义与身份字段；不复制几何 | manifest 自描述、单文件可读；审计无需读第二个文件 | 不需要 acceptance 报告被保留；对任意包都能当场建立证据 |
| 主要风险 | contracts 需要新入参；审计从纯函数变成「依赖调用方喂数据」；调用方漏喂就静默退化 | 报告不在包内、默认 gitignored、孤立报告已出现；没有 accepted 布尔；`toolVersion` 无意义；只证明「当时干净」 | 违反 manifest 原则 1（不重复图集内容，`assetpack.ts:10-16`）；制造第二真相；格式升版波及全部包 | 仍要决定「谁读文件」；`site`/publish 路径要加闸；TOCTOU 与并发读问题仍在 |

### 3.2 逐项说明

**(a) 读 atlas JSON**

- 最小可行形态：调用方用 `AtlasJson`（`atlas-json.ts:59-62`）解析每张图集，按 `(assetId, frameName)` 生成 `{sourceSize, anchor?}`，作为新入参传给 `auditPlayability` / `auditConfigPipeline`；contracts 只做比较，不读文件。
- 也可在 `packages/assets` 新增一个 `frameGeometryOf(packDir)`（那里已有 fs），由 pipeline 调用后传入。`packages/assets` 已依赖 contracts，方向正确。
- 关键调用点：`ops.ts:1247-1250`（重采样循环，每 attempt 一次）、`ops.ts:1284-1287`（编译后确定性校验）、`create-game.ts:631-636`（汇合点）、`publish-gate.ts:140`（发布闸）。后两者在 `runBuild` 内会重复；需要缓存或只读一次。
- 失败口径：任何读取/解析/比对失败都只能产生「几何未知」，不能当作 `body` 兜底或静默使用 manifest；否则仍是 G-01 禁止的「只信任标称值」。

**(b) 已验收包清单 / 证据文件**

- 现有可复用物是 `animation-acceptance/v1` 报告（`animation-acceptance.ts:193-206`），不是新概念。它记录 `manifestChecksum` + 每图集 `imageChecksum/metaChecksum`，足以把报告钉到一组字节（T1）。
- 但报告**不是几何数据源**：它只有 findings，没有逐帧值。审计仍要从 manifest（或 atlas）取数；报告只回答「这份字节曾经被逐帧比对过且没错」。
- 定位问题：报告默认在 `out/<packId>/acceptance/v<N>/report.json`（`acceptance.ts:840-857`），`out/` 被 `.gitignore:10` 忽略；报告内不记录 `packDir`。实存样本 `out/ruin-scavenger-extraction-assets/acceptance/v2/report.json` 的包目录已不存在，说明「报告在、包不在」是现实状态。
- 若引入「已验收包清单」（一个把 pack 身份映射到报告的注册表），那是**新持久化概念**，需要新契约、生产者和消费者；若只是「调用方显式传报告路径」，则是既有报告的复用，但仍是新的公开参数。
- `toolVersion:"0.0.0"` 与 `human.pending` 意味着这份证据不能被当作「人工验收通过」；它只能作为机器结构验收的证据。

**(c) 扩展 manifest**

- 位置：`AssetPackEntry.frames[]` 目前是 `FrameRef {name,index?,durationMs?}`（`assetpack.ts:157-162`）。加 `sourceSize` / `anchor` 会直接违反文件头原则 1（`:10-16`）：「帧的 x/y/w/h 只在 TexturePacker JSON 里，这里只做索引」。`anchor` 被列为例外是因为壳子需要它且与图集同源；逐帧几何不是。
- 格式：`AssetPackEntry` 与 `AssetPackManifest` 都是 `.strict()`（`:163-251,300`），加键必须升 `ASSET_PACK_FORMAT`（`:57`）。旧包（v2/v3）已经因为 `.strict()` 解析不过；v5 若改变 literal，磁盘上的 v4（含 `fixtures/packs/last-train/v2`）也需要迁移或 union。
- 即便加了字段，仍需 acceptance 比较 manifest 字段与 atlas 字段；否则只是把第二真相写进包里。审计若读 manifest 字段，运行时读 atlas，两者不一致时谁赢仍未定义。
- 授权：contracts + 写入侧 + fixtures 重产 + 格式升版，明确落 PRD §9.2。

**(d) 调用方传入已校验目录并在分析时复验**

- 形态：`runBuild` / `site` / `assertPublishableQa` 在调用 `auditPlayability` 之前，对 `packDir` 跑 `verifyPack`（必要）和 acceptance 或轻量 atlas 几何校验（充分），然后只把已读入内存的 manifest 传给审计；若要 IE，还需要把「几何已确认/未确认」作为显式信号传进 contracts。
- 这条与 (b) 的区别：不依赖历史报告，任意包都能当场建立证据；代价是每次发布都付校验成本，且外部包/大包更明显。
- 优点：与 G-01 的「不得只信任调用方提供的 hitbox 声明」最兼容——调用方给的是**目录**，几何由工具自己从帧里读，不接受调用方的 size/body 断言。
- 仍需解决：`site` 的拷贝发生在审计之后（`site.ts:220-226`），拷贝前后要再校验或直接拷贝已验证字节；`publish-gate` 目前明确不跑 verify，需要改这条约定（`publish-gate.ts:15-17`）。

### 3.3 共同的语义缺口

无论选哪个选项，都必须同时回答（留给 I00-R1）：

1. 「几何未确认」如何变成 IE：`playabilityIssues` 对 IE 返回空数组（`api.ts:113-120`），`partial` 不参与聚合（`api.ts:87-92`）。若只新增 coverage 字段，G-01 的降级不会发生。
2. 失败是 IE 还是硬拒：包字节校验失败（verify）在现有语义里是 invalid（退出码 4），而 G-01 说「无法确认实际几何时降级为 IE」。两者是否是同一类失败，需要裁定。
3. `site` / 外部包路径要不要从「只读 manifest」升级为「必须可复核几何」；若升级，现有外部包调用方会受影响（PRD §9.2 的「既有调用方无需因本功能而被迫修改」是回归项，见 `docs/v7.8/移动.md:344`）。

---

## 4. 「accepted pack」概念

### 4.1 生产代码中的事实

- 全仓生产代码**没有** `acceptedPack` / `accepted pack` 标识符、类型、manifest 字段或注册表。`accept` 是 CLI/MCP 命令（`cli.ts:740-752`；`mcp/src/server.ts:129,334`），产物是 `animation-acceptance/v1` 报告。
- 报告**没有消费者**：除写报告与渲染摘要外，`grep` 不到读 `AnimationAcceptance` 的生产路径；publish gate / audit / site 都不读它。
- 报告不是「accepted」标记：`human.verdict` 恒为 pending（`acceptance.ts:526-528`），`runtime.status` 恒为 unverified（`:530`），没有总布尔；`hasErrors` 只在内存结果里（`:537-545`），落盘后只能由 `findings[]` 推。
- 报告不入库：默认 `out/`（`.gitignore:10`），且现存样本是孤立的（包目录不存在）。

### 4.2 P0 文档里的「accepted pack」是什么

- P0 的用法（`.scratch/level-playability-v1.1-p0/evidence/03-case-comparison.md:60-72`；`03a-sites.md:89`；`01r-ruling.md:35`）指 `fixtures/packs/last-train/v2`：已入库的 fixture，其 manifest 哈希被复制包复核，其帧几何被 `e3-rescan.mjs` 扫描（121 帧，`badSize=badAnchor=0`）。
- 这不是生产 `accept` 的产物：仓库里没有 last-train 的 acceptance 报告（`git ls-files | grep acceptance` 无报告；`out/` 下也没有 last-train 的报告）。它是 P0 的研究标签：「当前语料里被独立扫描过的那份包」。
- 因此，P0 的「accepted pack」= **trusted corpus pack**，不是**可机读的验收状态**。

### 4.3 若 V1.1 集成需要它：复用还是新概念

**复用路径（不新增概念）：**

- 把「accepted」操作性定义为：`verifyPack(packDir)` 通过 **且** 对同一字节的 acceptance 干净（或有身份匹配的现存报告）。
- 这完全由既有概念组合而成：`verifyPack` + `animation-acceptance/v1` + `manifestChecksumOf`。没有新类型、没有新持久化字段。
- 但仍需要新代码：谁在什么时机跑校验、报告如何定位、结果如何进入审计并映射为 IE。若只改调用方内部（pipeline 闸），不动公共签名，则影响面最小；若加 CLI/MCP 参数或 `ConfigAuditContext` 字段，就是公开接口变更。

**新概念路径（需要额外授权）：**

- 在 manifest 中加 `accepted` / `acceptance` 块，或在包外维护「accepted pack 注册表」。前者是契约变更 + 格式升版（同 §3 c）；后者是新持久化产物，需要生产者、消费者、失效规则（包被改写后如何作废）。
- 这条路径会把「验收状态」变成可被伪造的声明；若没有签名，它与当前「manifest 自述」没有本质区别，只是多了一层。除非另有信任根，否则收益有限。

**授权级别（按现有文档）：**

- PRD §9.2 明确：contracts / Pipeline / CLI / MCP / 新依赖 / 新的公开配置或接口 / 任何扩大支持模型的行为，都必须提交独立 effort 的文件白名单、修改方案、测试计划、成本估算并取得明确批准（`docs/v7.8/移动.md:437-449`）。
- 本图 `map.md`：I-00 只做规划；I00-R1 是输入输出契约冻结（HARD BLOCK），I00-R2 是文件白名单与授权边界（HARD BLOCK）；R2 通过也不等于白名单内的生产修改自动获批（`map.md` 依赖图与说明）。
- 因此：**复用既有 acceptance 报告/校验只要触及公开接口或生产路径，就至少需要 I00-R1 的契约结论 + I00-R2 的白名单 + 后续独立实施授权；新造 accepted 概念还要额外的契约/持久化授权。** 本文不裁定选哪条。

---

## 5. 必须落 `INSUFFICIENT_EVIDENCE` 的几何来源情形

分组列出。每条都给出「谁会发现」：V = `verifyPack`，A = acceptance，R = 报告身份复核，N = 现有代码不会发现（需要新通道）。

### 5.1 包 / 输入不可用

| # | 情形 | 依据 | 谁发现 | 结论 |
| --- | --- | --- | --- | --- |
| 1 | 没有 `manifest.json`、读不出、不是 JSON、不过 `assetpack/v4` schema | `ops.ts:1918-1921`；`assetpack.ts:265-331` | V / 解析 | IE（无可信 manifest） |
| 2 | `format` 不是 `assetpack/v4`（旧包 v2/v3） | `assetpack.ts:57,266` | 解析 | IE |
| 3 | 资源缺 `size` 或 `anchor` | `assetpack.ts:171-175` | 解析 | IE |
| 4 | `asset.atlasId` 不在 `manifest.atlases[]` | `assetpack.ts:307-312` | 解析 | IE |
| 5 | `files[]` 缺 atlas 的 `meta` / `image` 条目 | `assetpack.ts:320-324` | 解析 | IE |
| 6 | `manifest.files[]` 任一文件缺失 / 字节数或 sha256 不符 | `ops.ts:1926-1932` | V | IE（或 invalid；口径见 §3.3） |
| 7 | 磁盘上有 `files[]` 未记录的文件 | `ops.ts:1963-1965` | V | IE |

### 5.2 验收证据不可用 / 不可信

| # | 情形 | 依据 | 谁发现 | 结论 |
| --- | --- | --- | --- | --- |
| 8 | 没有 acceptance 报告，且分析时不读 atlas | 生产无消费者（§4.1） | N | IE |
| 9 | 报告的 `manifestChecksum` 与当前 manifest 不符（manifest 被改） | `acceptance.ts:505-514`；`publish-gate.ts:121-122` 同型 | R | IE |
| 10 | 报告记录的任一图集 `metaChecksum` / `imageChecksum` 与当前文件不符 | 同上 | R | IE |
| 11 | 报告有任意 `severity:"error"` finding（几何族或完整性族） | `acceptance.ts:537-545`；`cli.ts:751` | A | IE |
| 12 | 报告只有 `atlas.frame.ghost`（warning） | `acceptance.ts:674-685` | A | 不因 ghost 本身降级；若该帧被 manifest 引用则不可能为 ghost |
| 13 | `toolVersion` 不可解释（今天恒 `"0.0.0"`） | `acceptance.ts:68,504` | 人工 / 契约 | IE（无法证明检查集） |
| 14 | 把 `human.verdict:"pending"` / `runtime:"unverified"` 当成验收通过 | `acceptance.ts:526-530` | N | 不得采信；不是几何证据 |
| 15 | 包在 acceptance 之后被就地改写（尤其 `site` 不重验） | `site.ts:169-226`；`publish-gate.ts:15-17` | N | IE |
| 16 | acceptance 期间包目录可变（多次读不一致） | `acceptance.ts:568-569,508` | N | IE |

### 5.3 逐帧几何

| # | 情形 | 依据 | 谁发现 | 结论 |
| --- | --- | --- | --- | --- |
| 17 | atlas JSON 缺失 / 不可读 / 不过 `AtlasJson` schema | `acceptance.ts:588-605` | A | IE |
| 18 | `atlases[].frames` 与图集 JSON 实际帧数不符 | `acceptance.ts:634-640` | A | IE |
| 19 | manifest 引用的帧名不在 atlas JSON | `acceptance.ts:654-659` | A | IE |
| 20 | 帧 `sourceSize` 与 `asset.size` 不符 | `acceptance.ts:306-312` | A | IE |
| 21 | 帧声明了 `anchor` 且与 `asset.anchor` 不符 | `acceptance.ts:341-347` | A | IE |
| 22 | 帧**未**声明 `anchor` | `acceptance.ts:341`（条件式）；运行时回退 `scene.ts:139,217` | N（acceptance 跳过） | 「帧 anchor == manifest」未证明 ⇒ IE；除非集成显式采用「运行时回退到 manifest anchor」的语义并记录 |
| 23 | `trimmed=false` 但 `spriteSourceSize` 不是完整 `sourceSize` | `acceptance.ts:323-330` | A | IE |
| 24 | `frame.w/h` 与 `spriteSourceSize`（含 rotated 交换）不符 | `acceptance.ts:332-339` | A | IE |
| 25 | 帧矩形 `x+w` / `y+h` 超出图集 PNG | `acceptance.ts:660-668` | A | IE |
| 26 | 图集 PNG 的 checksum 与 `atlases[].checksum` 不符、或解不开、或尺寸与 `atlases[].size` 不符 | `acceptance.ts:607-632` | A | IE |
| 27 | 同一帧名被两个资源引用（跨资源重名） | `acceptance.ts:687-699` | A | IE |
| 28 | `rotated=true`，而分析模型按未旋转的 `sourceSize` 处理 | `atlas-json.ts:37`；acceptance 只查内部一致 | 模型侧 | IE（除非模型显式处理旋转） |
| 29 | 动画 hazard 的各帧 anchor 不同（即使每帧都等于 manifest 也需确认） | 运行时逐帧 `customPivot`（`scene.ts:214-215`） | A（若字段在场） | 若任一帧与 manifest 不符 ⇒ IE；若都相符则等式成立 |
| 30 | 单帧 hazard 的 `sourceSize` / anchor 与 manifest 不符 | `profile.ts:92-97`；`scene.ts:139` | A | IE |

### 5.4 调用方声明 / 配置

| # | 情形 | 依据 | 谁发现 | 结论 |
| --- | --- | --- | --- | --- |
| 31 | 调用方提供 `hazard.body` / 自定义 hitbox / size，并试图让审计采用 | G-01（`docs/v7.8/移动.md:202`）；`profile.ts:92-97` 对 frame 源忽略 `body` | 契约 / 代码审查 | 不得采信；若集成改为采信 ⇒ IE（且违反 G-01） |
| 32 | 调用方声称 `hitbox = known` 但没有包/帧来源 | P0 `02r-ruling.md:54-55` | 流程 | IE |
| 33 | config 引用不存在的资源 / 帧 | 引用族审计（`auditGameConfig` / `resolvePackRef`） | 现有审计 | 已由既有规则处理；不产几何证据 |

### 5.5 语义边界（不是「坏包」，但结论不能升高）

| # | 情形 | 依据 | 结论 |
| --- | --- | --- | --- |
| 34 | manifest 与 atlas 本自同源、但被一起自洽改写（`pack-c2`） | §2.3 | 内部等式成立；艺术/生产者真实性未证明。若 G-01 要求后者 ⇒ IE |
| 35 | 包是第三方产出，未经过本管线 `pack.ts` | §1.2 W 只对自产包成立 | 若未在分析时 acceptance/读 atlas ⇒ IE |
| 36 | 包几何在分析时确认，但运行时站点用的是另一份拷贝 | `site.ts:220-226` | 需绑定拷贝前后字节；否则 IE |

---

## 6. 复现

### 6.1 环境

```text
$ node --version
v22.23.2
$ git rev-parse HEAD
330d6dc3919d9f7fa9de05baff9668a4a1177133
$ shasum -a 256 docs/v7.8/移动.md fixtures/packs/last-train/v2/manifest.json \
    fixtures/packs/last-train/v2/delivery/atlas.animations.json \
    fixtures/packs/last-train/v2/delivery/atlas.backgrounds.json
3598cc19889b10a9fabf3a4f6f28ae7cee43a22355b639d8d61298e6d459cea9  docs/v7.8/移动.md
145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689  fixtures/packs/last-train/v2/manifest.json
6874ae923c2ee8287e4d4e534e8498b0ef5e108460364151e39d4dcfb766c86d  fixtures/packs/last-train/v2/delivery/atlas.animations.json
cc8c7861ecff8e53652131ad8f93e26dedf0d06a25da7b4d34b18a08f015dc29  fixtures/packs/last-train/v2/delivery/atlas.backgrounds.json
```

### 6.2 主探针

```text
$ node .scratch/level-playability-v1.1-integration/scripts/geometry-provenance-probe.mjs \
    fixtures/packs/last-train/v2
pack=/Volumes/shy/some-projects/game-maker/fixtures/packs/last-train/v2
verify=PASS acceptance=CLEAN
  manifestChecksum=sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689
  files=31 mismatched=0
EXIT=0
```

`--json` 会输出逐资产、逐帧的 `manifestSize` / `frameSourceSize` / `anchorPresent` / `anchorOk`，以及 report 会记录的三个身份指纹。

### 6.3 反例实验

```text
$ bash .scratch/level-playability-v1.1-integration/scripts/geometry-mutation-probe.sh
（输出见 §2.3；脚本 EXIT=0，单场景 EXIT 见表）
```

脚本只改 `mktemp -d /tmp/gm-i00-02.XXXXXX` 下的副本，结束时打印临时目录；不改 `fixtures/packs/**`。

### 6.4 现有测试

```text
$ pnpm vitest run packages/assets/tests/acceptance.test.ts --reporter=dot
 Test Files  1 passed (1)
      Tests  18 passed (18)
EXIT=0
```

### 6.5 只读声明

- 未修改 `packages/**`、`docs/**`、`fixtures/**`、其他票或 `map.md`。
- 未 commit、未 push、未安装依赖、未调用付费服务。
- 探针导入 `packages/assets/dist`（gitignored 的构建产物，工作区已有；本次未运行 `pnpm build`）。若在干净 clone 上复现，需先 `pnpm build` 生成 `dist`；该命令只写 gitignored 的构建产物。
- 临时副本在 `/tmp`，不属于仓库。

---

## 7. 限制与未决

1. **本文不裁定。** 四个选项的取舍、`accepted pack` 是否引入、失败口径（IE vs invalid）、`coverage.partial` 是否参与聚合，均归 I00-R1（并受 I00-R2 白名单约束）。
2. **`pack-c2` 的「自洽改写」不是漏洞报告。** 它说明「帧几何 == manifest」这条等式在语义上是**包内部一致**；若 G-01 的「真实 Asset Pack 帧」要求出处真实性，需要额外的信任根（签名 / 受控产出路径），现有链路没有。
3. **acceptance 的 anchor 检查是条件式**（`acceptance.ts:341`）。这是本文最重要的负向发现：干净报告不等于「逐帧 anchor 已核对」。但运行时在字段缺失时会用 `setOrigin(manifest anchor)`（`scene.ts:139,217`），所以「审计盒 == 运行时盒」在缺失时仍可能成立；这需要被写成显式语义，而不是默认为已证明。
4. **`site` / 外部包路径没有字节重验**（`site.ts:169-226`；`publish-gate.ts:15-17`）。任何依赖「build 时 verify 过」的传递性结论，在 `site` 独立调用时都不成立。
5. **报告工具版本恒 `0.0.0`**，且报告不入库、不定位包。若选 (b)，必须先解决这三点，否则「已验收」不可审计。
6. **性能数字**是本机单包样本（atlas 4 文件 0.051 ms；`verifyPack` ~5 ms；探针整体（verify + acceptance + PNG 解码 + Node 启动）~90 ms），不是生产预算；预算归 I00-06。
7. **P0 结论只引用不重开**：hazard 命中体 = 图集帧 `StaticBody`、忽略 `entity.body` 的运行时语义，以 P0 证据为准（`01-moving-hazard-semantics.md:163,246`；`04-final-report.md` U3/U6）。

