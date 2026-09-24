# 07. 目录迁移：现有 demo/ 拆进 monorepo

Type: task
Status: resolved
Blocked by: 29
Map: ../map.md

> 📌 **迁移时要一并吃掉的一条**（2026-09-24，[票 03](03-phaser-vite-playwright-chain.md) 实测）：
> Phaser 会被打进一个 **1.2 MB 的 chunk**，必然触发 Vite 的 `>500 kB` 告警。
> 要么显式调高 `chunkSizeWarningLimit` 并说明理由，要么拆包 —— 别让它变成一个
> 「每次构建都刷屏但没人看」的噪音。
> 另：仓库本机 `.npmrc` 指向 `registry.npmmirror.com`，装 Vite 8 会拉所有平台的
> `@rolldown/binding-*` 并**卡死 >5 分钟**；加 `--registry=https://registry.npmjs.org` 后 42 秒装完。
> 这条影响票 29 的工具链选择，值得在 workspace 配置里一次性解决（比如仓库级 `.npmrc`）。

> 🔴 **正文写于旧终点，其中四条已作废**（2026-09-24 施工时确认）：
> ① 的 `demo/projects/<id>/{runs,checkpoints,report.html}` 目录结构、④ `FileArtifactStore`、
> ⑤ Checkpoint 写入、⑥ Store 取舍 —— **全部随闭环出局**，本票没有按字面执行。
> ③ 的 paths 模块精神保留但对象换成了「包与站点的输出路径」。逐条交代见 Answer §2。

> ⚠️ **范围已重画**（2026-09-24，R9）：从「设计项目工作区目录骨架」变成**一次具体的搬迁**。
> R9 已定包边界（`contracts` / `assets` / `demo` / `cli` / `mcp`），本票是执行：
> 把现有 `demo/` 那 892 行骨架按职责拆进对应包，并让测试继续跑通。
>
> **搬迁的难点在边界判定，不在复制文件**：现有 `demo/src/` 里的
> `contracts/` `runtime/` `qa/` `repair/` 是按**上一版终点**分的。
> `repair/` 与 `qa/` 的大部分（Gate、Evaluator、RepairEngine）随 R2 出局 ——
> **哪些文件跟着一起删、哪些只是「暂时没人用」**要逐文件判，不能整目录搬。
> 判据：契约（Zod schema）与生成路径上的确定性校验**留下**；评分、门禁、
> 修复计划、状态机、编排器**删除**。

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

## Answer

**结论：`packages/` 五包骨架已落地，四条验收全过；`demo/` 整体删除（19 个文件），
只有 `contracts/index.ts` 的一部分（240 → 112 行）与 `test.png` 活下来。**

### 0. 做了什么

| 动作 | 内容 |
|---|---|
| 新建仓库根 | `.npmrc`（钉官方源）· `pnpm-workspace.yaml`（`catalog:` + `onlyBuiltDependencies`）· `package.json` · `tsconfig.base.json` · `tsconfig.json`（solution-style）· `.gitignore` · `scripts/check-deps.mjs` |
| 新建五个包 | `contracts`（真实 schema）/ `assets` / `demo` / `cli` / `mcp`（后四个是空壳，**每个空壳的文件头写明它归哪张票**，避免变成无主代码） |
| 搬迁 | `demo/test.png` → `fixtures/reference/test.png`；`demo/PROTOTYPE-asset-representation.html` → `experiments/asset-representation/`（那是[票 05](05-asset-representation.md) 的原型，回到它的出处） |
| 删除 | `demo/` 全部 19 个文件、816 行 |

`demo/` 里的 `src/runtime/`（299 行）· `src/qa/`（79）· `src/repair/`（33）· `src/example.ts`（76）·
两个旧测试（35）· `src/contracts/policy.ts`（25）按 R2 **整块删除**，不是搬走。

### 1. contracts 里留下了什么

**32 个导出 → 9 个。240 行 → 112 行。**

- **留下**：`RequirementPriority` / `RequirementSchema` / `StyleSpecSchema` / `GameSpecSchema` /
  `AssetSpecSchema` / `AssetManifestSchema` / `ArtifactType` / `ArtifactRefSchema` / `CreationProjectSchema`
- **删除（23 个）**：`CreationStatus` · `CreationRunSchema` · `CreationCheckpointSchema` ·
  `BestStateSchema` · `RepairBudgetSchema` · `RepairPlanSchema` · `RepairActionSchema` ·
  `CreationEvaluationReportSchema` · `CreationGateResultSchema` · `GateCheckSchema` ·
  `QualityDimensionSchema` · `VisualReportSchema` / `VisualIssueSchema` · `GameplayReportSchema` ·
  `GameplayTestPlanSchema` / `GameplayTestCaseSchema` / `TestActionSchema` / `TestAssertionSchema` ·
  `RequirementCoverageSchema` · `AssetCompletenessReportSchema` · `RuntimeHealthReportSchema` ·
  `RuntimeObservationSchema` / `RuntimeEntitySchema`

留下的每一个都在文件里带了注释，写明它的归属与未决项（例如 `AssetSpecSchema` 的两个逃生舱归票 27、
`ArtifactRefSchema` 归票 18）。

### 2. ⚠️ 本票的正文写于旧终点，其中四条已作废

票面正文是上一个终点留下的，本次**没有按字面执行**。逐条交代：

| 正文条目 | 处置 |
|---|---|
| ① Q9-A 的目录结构（`demo/projects/<id>/{runs,checkpoints,report.html}`） | **整条作废** —— 没有 run 了。产物形态由[票 24](24-asset-pack-contract.md)（包）与[票 29](29-monorepo-layout.md)（`out/<gameId>/{pack,site}`）取代 |
| ② gitignore / `.gitkeep` | **部分作废**。`demo/projects/` 不存在了；产物统一进仓库根 `out/`，一条 `.gitignore` 覆盖 |
| ③ paths 模块（手写、纯函数） | **精神保留，对象换了** —— 现在需要的是「资源包与站点的输出路径」，落地归[票 30](30-cli-and-mcp-surface.md) / [票 33](33-runtime-assembly.md) |
| ④ FileArtifactStore | **作废**。它服务的 `ArtifactRef` 已被票 24 判定不用于包内；归属权改判给[票 18](18-artifact-ref-consistency.md) |
| ⑤ Checkpoint 写入（五个时机） | **作废** —— Resume/Recovery 已判出局（map 的 Out of scope） |
| ⑥ Store 的取舍（内存 vs JSON） | **作废** —— `InMemoryCreationStore` 已随编排器一起删除 |

### 3. 验收（四条，全过）

| # | 检查 | 结果 |
|---|---|---|
| ① | `pnpm check:deps` | ✅ 依赖图合法（5 个包） |
| ② | `pnpm build`（`tsc -b`，跨包 project references） | ✅ 五包各自产出 `dist/*.js` + `*.d.ts` + `.d.ts.map` |
| ③ | 在真实仓库里注入 R6 禁止的边 `assets → demo` | ✅ 守卫拒绝，退出码 1 |
| ④ | `packages/assets` import `@game-maker/contracts` 的类型 | ✅ 经 `exports` → `dist/index.d.ts` 解析成功 |

### 4. 施工中撞出的五件事

1. **G1 已按[票 29](29-monorepo-layout.md) 写进 `tsconfig.base.json`** —— base 只放绝对语义的选项，
   `outDir` / `rootDir` / `include` 在各包的 tsconfig 里。这次一次就过，没有重演那个坑。
2. **`pnpm install` 实测 6 分 49 秒**（走官方源；本机到 npmjs 的路不近）。
   esbuild 的 postinstall 正常执行 → `onlyBuiltDependencies` 白名单**有效**，
   没有它 esbuild 会静默缺二进制。
3. **`pnpm-lock.yaml` 入库** —— 它是可复现构建的凭据，不属于 Q9 说的「产物」。
4. **空测试套件会让 CI 从一开始就是红的**：`vitest run` 在无测试文件时退出码 **1**，
   而本票把所有测试都删了。改成 `vitest run --passWithNoTests`，
   [票 20](20-drawlist-contract.md) 落真实测试时再摘掉这个开关。
5. **四个空壳包必须一次建齐**：`check-deps.mjs` 会检查「允许图里的包在 `packages/` 下存在」，
   所以不能只建 `contracts`。这反过来是好事 —— 目标形态在仓库里是**可见的**，
   而不是只写在文档里。

### 5. 新发现一个无主缺口 → 建[票 37](37-assetpack-manifest-landing.md)

`AssetPackManifest`（[票 24](24-asset-pack-contract.md) 定的资源包自证 schema）
**没有任何票负责把它变成真实代码**：票 24 是 grilling（只定形状）、票 20 只管 drawlist、
票 28 只管 Recipe。而它是产物 A 与产物 B 之间**唯一的接口**。

→ 已建[票 37「把资源包 manifest 契约落进 packages/contracts」](37-assetpack-manifest-landing.md)，
阻塞于票 20（`paletteBinding` 的静态判定函数要用 drawlist 的 ops 类型），
并要求把票 24 那 9 条反例原样变成单元测试。

### 6. 解除阻塞

- **[票 20](20-drawlist-contract.md) / [票 21](21-drawlist-renderer.md)** —— `packages/` 已存在，
  两条 `07 → 20` / `07 → 21` 的边清空，产物 A 的整条代码路径可以开工。
- **[票 18](18-artifact-ref-consistency.md)** —— 两个阻塞（24 与 07）都清了。
