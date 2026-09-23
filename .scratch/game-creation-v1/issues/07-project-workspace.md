# 07. 项目工作区目录骨架、gitignore 与落盘 paths 模块

Type: task
Status: open
Blocked by: —
Map: ../map.md

## Question

Q9 决定了合一目录结构，Q19 决定了 Checkpoint **写入**在范围内
（Resume/Recovery 不在）。这张票是纯执行：把目录结构和落盘能力建起来。

需要落地：

1. **目录结构**（Q9-A）：
   ```
   demo/projects/<projectId>/
     inputs/                        # 参考图（唯一入库的产物）
     fixtures/                      # 固化的 StyleSpec / GameSpec JSON（入库）
     source/                        # AI 生成的绘制函数 + game-config.json
     assets/<assetId>/v<N>/         # 版本化资源，绝不覆盖（文档第 21 节）
     build/                         # vite build 产物
     runs/<runId>/
       observations/
       screenshots/
       evaluations/
       repairs/
       checkpoints/
       report.html
   ```
   **确认这个结构能否同时满足文档第 23 节的 artifacts 布局要求**，
   如果有冲突，是改结构还是改文档？（文档第 23 节是
   `artifacts/project_001/run_001/...`，Q9 已经把它并进 `projects/` 了。）

2. **gitignore**：`demo/projects/` 下除 `inputs/` 和 `fixtures/` 外全部忽略。
   注意根目录已有 `.gitignore`、`demo/.gitignore` 也已存在 —— 放哪一层？
   要不要提交一个 `demo/projects/.gitkeep` 保证目录存在？

3. **paths 模块**：一个手写的、纯函数的路径解析器
   （`projectDir(projectId)` / `assetVersionDir(projectId, assetId, version)` /
   `runDir(projectId, runId)` / …）。
   **这是 Q15「手写固定」清单的一员**：路径规则绝不能让 AI 即兴生成，
   否则 ArtifactRef.path 会漂移。

4. **FileArtifactStore**：实现 `ArtifactRef` 的写入与读取 —— 
   文件落盘 + 计算 checksum + version 自增 + 返回 ArtifactRef。
   替换现有的 `artifact()` mock 工厂函数（`demo/src/example.ts` 第 9 行）。
   **注意**：`demo/src/contracts/index.ts` 里 `ArtifactRefSchema` 已经定义好了，
   照它实现，不要改契约。
   （version 递增与 checksum 的归属细节留给票 18。）

5. **Checkpoint 写入**：在文档第 49 节的五个时机
   （After Compile / After Asset Generation / After Build / After First Evaluation /
   After Repair）dump `CreationCheckpoint` JSON。
   `CreationCheckpointSchema` 已存在于契约里。
   **只写不读** —— Resume 是 Out of scope，不要顺手实现。

6. **Store 的取舍**：现在是 `InMemoryCreationStore`（`Map`）。
   Q19 把 SQLite 划出了范围，但产物已经落盘了 ——
   那么 run/project/evaluation 的**元数据**是继续留内存，
   还是也 dump 成 JSON 文件？如果留内存，进程一退就全丢，
   HTML 报告（票 06）就没法在跑完后重新生成。
   **建议：元数据也落 JSON**（不是 SQLite，只是一个 `run.json`），
   这样报告和 checkpoint 都能在事后重建。这个取舍要在本票里定下来。

产出：可运行的代码 + 一次 `pnpm dev` 后能在文件系统里看到完整目录结构的验证。

## Answer

_（待填）_
