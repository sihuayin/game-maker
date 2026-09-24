# 18. 交付物的版本化与校验和

Type: grilling
Status: open
Blocked by: 24, 07
Map: ../map.md

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

_（待填）_

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
