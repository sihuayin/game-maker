# 18. ArtifactRef 与文件系统的一致性：version 递增与 checksum 归谁管？

Type: grilling
Status: open
Blocked by: 07
Map: ../map.md

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
