# 18. 交付物的版本化与校验和

Type: grilling
Status: resolved
Blocked by: 24, 07
Map: ../map.md
> 📌 **票 38 交给你的一条事实**（2026-09-24）：版本递增已落地为 `nextPackVersion()`
> （`packages/assets/src/pack.ts`）—— **扫描目录取 max+1**，也就是你问题 1 里列的第二个候选。
> ⚠️ **没有加锁**：并发写同一个 `outDir` 会撞。要不要防、怎么防，归你定。
> 另外：包内的 checksum 粒度已经落地为**逐文件 sha256**（`files[]`，manifest 自身除外）。


> ⚠️ **范围已重画**（2026-09-24，R2/R6）：从「run 内 ArtifactRef 与文件系统的一致性」
> 变成「**交付出去的资源包 / demo 站点**怎么版本化」。
>
> **保留的灵魂**：绝不覆盖式生成、旧版本永久保留、checksum 可校验。
> 文档第 21/22 节的版本化思路仍然成立，只是对象换了。
>
> **必须回答**：
> 1. 版本号的粒度 —— 单个资源（`player/v1.png`）、整个资源包、还是两者都要？
> 2. **交付物是 zip 还是目录**（R9 说「zip / 目录」二选一未定）？若交付 zip，
>    checksum 记在 zip 上还是逐文件记？
> 3. 增量生成（fog 里那块）要成立的话，版本化必须支持「包 v2 = 包 v1 + 三个新资源」。
>    本票要不要现在就为它留形状，还是等 fog 毕业再说？
> 4. 校验和覆盖什么 —— PNG 字节？drawlist JSON？还是两者都覆盖（交付态 + 创作态）？

## Question

`ArtifactRefSchema` 已经定义好了（id / type / path / version / checksum / createdAt），
现在 `demo/src/example.ts` 用一个 mock 工厂函数糊弄：
`checksum: \`mock-${id}-${version}\``。票 07 会实现真实的 `FileArtifactStore`，
但**几个归属问题没定**，本票专门收口。

阻塞在票 07（要有真实的落盘实现才能谈一致性）。

要 grill 出的问题：

1. **version 谁负责递增**？三个候选：
   - 调用方（AssetGenerator）自己知道这是第几版 → 容易出错、容易覆盖
   - Store 扫描目录取 max+1 → 简单可靠，但有竞态
   - Store 维护一份索引文件（`assets/<id>/index.json`）→ 权威，但多一个真相来源
   文档第 21 节的要求是**绝对禁止覆盖**，所以这个决定直接关系到
   会不会出现「v2 覆盖 v1」的事故。
2. **并发写入**：文档第 63 节说 Asset 可以并发生成
   （虽然并发生成本身在 fog 里）。如果两个 worker 同时给 `cow` 写 v2，
   上面的方案哪个会坏？现在要不要就防住，还是等并发真的进范围再说？
3. **checksum 用什么算法、覆盖什么内容**？
   sha256 文件内容？如果 Artifact 是一个**目录**
   （比如 `build/` 是 vite 产物、`assets/cow/v1/` 可能含多个文件），
   checksum 怎么算？目录树哈希？还是只哈希主文件？
4. **checksum 用来干什么**？现在没人校验它。它的价值在于：
   - 检测产物被外部改动（有人在 run 之外手改了资源）
   - 去重（两次生成内容完全相同 → 不产生新 version？）
   - 缓存（内容没变就不重新生成）
   **如果只是存着不校验，它就没有价值** —— 要不要在读取时校验？
   校验失败怎么办（报错、还是当作 artifact 损坏触发 repair）？
   文档第 20 节的 `AssetManifest.broken` 字段和
   `AssetCompletenessReport.broken[]` 是不是就该由这个来填？
5. **id 的生成规则**：`ArtifactRef.id` 现在用 `randomUUID()`。
   但产物是按 `assets/cow/v1` 这种**语义路径**存的 —— 
   id 和 path 是什么关系？id 要不要可读（`asset:cow:v1`）？
   Evidence 通过 `artifactIds` 引用产物（文档第 59 节），
   可读 id 对诊断体验影响很大。
6. **path 是相对还是绝对**？Q9 决定了产物在
   `demo/projects/<projectId>/...`。ArtifactRef.path 存
   相对项目根、相对 project 目录、还是绝对路径？
   **绝对路径会让整个 project 目录无法搬走**（换机器、提交示例产物都会坏）。
7. **孤儿产物**：run 失败或被 cancel 后，写了一半的产物怎么办？
   留着（占空间、可能混淆后续 run）、还是清理（丢失诊断信息）？
8. **与 checkpoint 的关系**：`CreationCheckpoint.artifacts: ArtifactRef[]`
   是一份快照。如果产物文件后来被删了，checkpoint 就指向虚空 —— 
   要不要在写 checkpoint 时校验所有 ref 都还存在？

调用 `grilling` 与 `codebase-design` skill。
**产出是一份 ArtifactStore 的一致性规则（version 递增策略、checksum 算法与
校验时机、id 与 path 规范、孤儿处理），落到 `CONTEXT.md` 的
Artifact / ArtifactRef 词条里。**

## Answer

**结论：八条裁决 —— 六条是本票新定的，两条是把已经落定的决定收口。**

### 0. 先说票面：正文大部分已过期

本票正文写于旧终点，引用着**票 07 已删除**的 `demo/src/example.ts` 与 `ArtifactRef` 的 mock
工厂、以及票 16/17 的 Repair 粒度、checkpoint、`AssetManifest.broken` —— 后三者在 R2 下已出局。
票面「必须回答」的四问里，**问 1（版本粒度）与问 4（checksum 覆盖什么）已经落定**
（票 24 + 票 30），所以本票实际收口的是**另外的开口**，下面按裁决列。

### 1. 八条裁决

| # | 裁决 | 性质 |
|---|---|---|
| 1 | **交付形态 = 只出目录，永不 zip** | 🆕 本票定 |
| 2 | 版本粒度 = per-pack `v<N>` | 票 24 已定，本票确认 |
| 3 | **站点也版本化 `site/v<N>/`，`N` 是站点自己的计数器** | 🆕 本票定 |
| 4 | **站点不做逐文件 checksum**，只记录它消费的包版本 | 🆕 本票定 |
| 5 | checksum = 逐文件 sha256（manifest 除外），`verify` 消费，校验失败是失败不是降级 | 票 24 + 票 30 已定 |
| 6 | **不加并发锁**，把「`outDir` 写入者必须串行」写成契约 | 🆕 本票定 |
| 7 | **增量生成不留形状**，维持整包重建 | 🆕 本票定 |
| 8 | **删除 `ArtifactRefSchema` + `ArtifactRef` + `ArtifactType`** | 🆕 本票定 |

**为什么是「只出目录」**：全仓库**零 zip 代码、零 zip 依赖、零 CI**；而票 03 早已讨论过一次
单文件交付并**否决**了它（自包含单 HTML，「与 R6『B 吃一个资源包』冲突…不作为路线，
只作为『必须邮件发一个文件』场景的备案」），票 29 也定过同一条调子（「V1 不发布…
等站点要交给外人时再回来」）。逐文件校验和遇上 zip 会立刻产生「校验哪一个」的歧义
（zip 内的流 vs 解压后的文件）。**需要一个单文件时 `zip -r` 是一行命令，反向不是。**

**为什么站点用自己的版本号**：决定性理由是**外壳还没定稿**（票 32/33 都 open）。
runtime 一变就要出新站点，而**那时包版本没变** —— 若站点编号跟着包走，新站点无处安放，
只能覆盖，直接破掉「绝不覆盖」。站点**记录它消费的包版本并写死那条相对路径**
（`../pack/v<M>/`），因为那才是 R6 说的 A/B 之间唯一的依赖。

**为什么站点不逐文件校验**：分界线是**资源包是被策展的产物**（手画/生成的图 + 人过目的数据），
**站点是构建产物**。站点主体是 Vite/esbuild 的 bundle —— 逐文件记的其实是**工具链的版本**，
换一次 esbuild 就全变，checksum 沦为噪音。

**为什么删 `ArtifactRef`**：`ArtifactType` + `ArtifactRefSchema` + `ArtifactRef` 三个符号
**零消费者**（只有定义、无 import），且字段（`randomUUID` 的 id、`createdAt`、
`evaluation`/`repair-plan`/`benchmark` 三个随 R2 出局的类型）是为旧闭环设计的。
**删掉它同时把票面的问题 5 和 6 一起消解** —— 「id 生成规则」「path 相对还是绝对」
今天没有对象。票 07 已为同一理由删过 23 个 schema。

### 2. 落点

| 文件 | 改了什么 |
|---|---|
| `CONTEXT.md` | Artifact 词条补**交付形态是目录 + 两种产物各有自己的版本号**；ArtifactRef 词条从「已被取代」改成**已删除**；新增 **校验和** 词条；Demo Site 词条补**站点版本化 + 记录消费的包** |
| `packages/contracts/src/index.ts` | 删 `ArtifactType` / `ArtifactRefSchema` / `ArtifactRef`，留一段说明为什么删 |
| `packages/assets/src/pack.ts` | `nextPackVersion` 的注释里写下**契约**：`outDir` 写入者必须串行（无锁是**被记录的约束**，不是待修的 bug），以及 `renameSync` **要求同一文件系统**（跨设备 EXDEV）这条此前无人写下的隐含前提 |
| 票 32 / 票 33 | 各加一条来自版本化的约束 |

**219 条测试全绿**，`tsc -b` 干净，契约导出面里已无任何 `Artifact*`。

### 3. 对别张票的影响

- **[票 33](33-runtime-assembly.md)**：产出目录 = `site/v<N>/`、记录消费的包版本、
  写死 `../pack/v<M>/`。**它第 1 问里那条「zip 怎么办」消解了** —— 只出目录，
  Phaser 永远只从目录加载，不需要解压逻辑。
- **[票 32](32-runtime-shell.md)**：「外壳版本」这件事被**站点版本号隐式承载**了。
  若认为外壳本身需要一个显式版本标识（写进站点、可读出来），那是票 32 该定的 —— 现在没有。
- **[票 29](29-monorepo-layout.md)**：它记的 `out/<gameId>/{pack/v<N>, site}` 被本票取代，
  已在地图上标注。

### 4. 明确没做的

- **没做 zip 导出**，也没为它留命令 —— 「需要发给外人那天」再回来（与票 29 同一立场）。
- **没做去重**：内容完全相同的两次生成**照吃一个新版本号**。理由：去重会让生成
  不再是输入的纯函数（结果依赖于历史），而票 38 刚为确定性做过不少工作；
  `createdAt` 不同本身是有价值的诊断信息。
- **没给站点设计 manifest 的形状** —— 票 18 只定了「站点要记录消费的包版本」这条**约束**，
  具体承载它的字段归票 32/33。

---

## 来自票 05 的更新（2026-09-23）—— 新增一个必须定的粒度问题

票 05 已定 Asset 格式为 `drawlist+curve/v1`，且**一个 `(asset, state)` 一份 JSON 产物**
（例如 `tomato` 有 growing / ripe / harvested 三份独立产物）。
文件格式确定为 **`.json`**（不是 `.svg`、不是 `.ts`）。

### ⚠️ 新增：版本目录的粒度

Q9 定的结构是 `assets/<assetId>/v<N>/`。但现在一个 asset 有**多份**产物
（每个 state 一份），于是有两种可能：

- **① asset 级版本**：`assets/tomato/v1/{growing.json, ripe.json, harvested.json}`
  一次 repair 只改 `ripe`，也要**整套升 v2**（三份一起拷）。
  优点：一个版本号对应一个完整一致的 asset，回滚简单。
  缺点：浪费空间，且「哪个 state 变了」看不出来。
- **② state 级版本**：`assets/tomato/ripe/v1.json`、`assets/tomato/ripe/v2.json`
  优点：粒度精确，diff 清晰，只重生成被点名的 state（票 16 需要这个）。
  缺点：一个 asset 的不同 state 可能停在不同版本号上，
  「asset 的版本」这个概念就消失了 —— 而 `ArtifactRef.version` 是单值。

**这个选择直接决定票 16（Repair 粒度）和票 17（Best Artifact 回滚粒度）能不能做。**
票 05 倾向于 ②，但 ② 与现有 `ArtifactRefSchema`
（`{id, type, path, version, checksum, createdAt}`，version 是单个整数）
的配合方式需要本票设计清楚：一个 `ArtifactRef` 是指向**一个 state 的一个版本**，
还是指向**一个 asset 的一组版本**？

### 另外：checksum 现在有了明确对象

票 05 定了产物是单个 `.json` 文件（不是一组文件、不是目录）。
所以第 3 条的「目录怎么算 checksum」问题**对 Asset 不成立了** ——
Asset 就是单文件，直接 sha256。
但 `build/`（vite 产物）**仍然是目录**，那部分的问题依然有效。
→ 结论可能是「按 artifact type 分别定策略」，本票要给出这张表。

### 另外：diff 现在是可计算的

因为产物是数值 JSON，两个版本之间可以做**结构化 diff**
（`ops[3].cx: 16 → 18`），不是文本行 diff。
这对票 17 的 RepairProgress 归因、票 06 的 HTML 报告都有价值。
要不要在 ArtifactStore 层就提供 `diff(refA, refB)`？还是留给上层？
