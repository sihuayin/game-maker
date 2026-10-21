# 01. W1 真实入口与主调用链

Type: research
Status: resolved
Owner: claude（2026-10-20 认领 · research 子代理）
Blocked by: —
Map: ../map.md

## Question

在 HEAD（`v2-foundation` · `ea53240`）上，用户从 CLI / MCP 进入后**实际运行了哪些模块**，
每个阶段写出了什么产物？按任务书 W1 输出三张表：

1. **主链调用图**：CLI 命令 → 核心函数 → 阶段 → 产物。
2. **阶段 / 产物表**：输入类型、输出类型、文件落盘位置（run / pack / site 版本目录）。
3. **入口差异表**：CLI 与 MCP 的复用关系；RuntimeProfile 的分派位置与旧链兼容边界。

必须记录：

- CLI 命令与参数入口（`create` / `build` / `plan` / `pack` / `compile-runtime` / `compile-td-game` /
  `site` / `verify` / `inspect` / `review`）。
- MCP 工具入口（`plan_assets` / `build_asset_pack` / `verify_asset_pack` / `create_game` /
  `inspect_asset_pack` / `compile_runtime` / `assemble_site`）与 CLI / 核心函数的复用关系。
- RuntimeProfile 的分派位置及旧链兼容边界。
- 失败时的退出码（`EXIT` 表）、错误包装、失败目录 / 清理策略。

## 验收

另一位开发者仅根据产出即可找到真实入口、跟踪一次构建、定位各阶段产物。

## 边界

- 只读；零付费；不改任何源码 / Schema / 文档（本票只写 `research/w1-call-graph.md`）。
- 不运行会调用上游的命令（`create` / `build` / `plan` / `pack` / `compile-runtime` 带真实配置等）。
- 证据须带路径与符号名；核验后附行号。

## 产出

`research/w1-call-graph.md`，并在 `## Answer` 给出 3–8 条关键结论与证据强度（E0–E3）。

## Answer

研究文件（完整调用图、阶段/产物表、入口差异表、失败语义）：[../research/w1-call-graph.md](../research/w1-call-graph.md)

关键结论（基线 `v2-foundation` / `ea53240`，只读、零付费）：

1. **主链是两段**：`runUnderstanding` 把参考图 → VisualWorldSpec → GameIntentSpec → GameDesignSpec → CharacterDNA → AssetRecipe 跑到清单并**定稿** `run/v<N>`；`runBuild` **只吃 runDir**，再做 pack → game-config → QA。检查点只在 CLI `create`（不带 `--yes`），MCP `create_game` 恒跑完。证据：`create-game.ts:250,417,439-551`；E2 `create-game.test.ts:46-151,217-254`；E3 `run-2026-10-17b/d.json`。
2. **站点装配不在 pipeline**（依赖图够不着 `demo`），由壳层串：CLI `create --yes`/`build` 走 `assembleFromConfig`（按 config `format` 分派横版/塔防），MCP `create_game`/`assemble_site` 直接调 `assembleSite`。因此**塔防站点只能从 CLI 走**。证据：`pipeline/src/index.ts:3-4`、`cli.ts:224-248`、`server.ts:287,319`、`assemble.ts:53-66`；E1/E2 `td-site.test.ts:226-270`。
3. **RuntimeProfile 的分派在两处**：写设计时 `compileDesign → pickProfile`（默认 `platformer/v1`，未知代直接拒）；编配置时 `compileRuntime` 从设计读 `game.runtimeProfile` 并查 `CONFIG_SHAPES`（只有 platformer）。塔防是并列旁路链（`compile-td-game` → `td-config/v1`），不读 RuntimeProfile、不在 `create` 链。证据：`compile-design.ts:156-164,238`、`ops.ts:826-828,896-906`、`runtime-profile.ts:114-129`；E1/E2。
4. **版本号由父分配且首次对齐**：`create/build` 的 `run/vN`、`pack/vN`、`site/vN` 首次同 N；重跑构建取 `nextPackVersion`；单独 `pack`/`compile-*`/`site` 各自扫目录取 max+1；显式 site 版本撞名即拒。证据：`run.ts:37-93`、`create-game.ts:439-441`、`layout.ts:60-96`；E2 `create-game.test.ts:106,162-186`、`cli-create.test.ts:284-309`；E3 目录树见研究文件 §6。
5. **失败语义**：退出码 0–4（`command.ts:46,88`）；理解段失败把 staging **改名**成 `failed-*`（不删、不消耗版本号）；pack 失败把 `.building-*` 改名成 `<id>/failed-<ts>` 并只留最近一份；配置 staging 在 `finally` 删除；QA 硬失败**先落 `qa-report.json` 再抛**（站点不产）。证据：`run.ts:108-117`、`pack.ts:288-318`、`create-game.ts:477-495,536-545,215-233`；E2/E3（`run-2026-10-17c.json` 的 `exitCode:1` + ledger + failureDir）。
6. **两个壳的错误语义不一致**：CLI 用 `asCommandError` 把 `{rejections}` → 4、`{failure:http|timeout}` → 3；MCP **没有这层**，这些裸 Error 的 `_exitCode` 都是 1，与工具说明写的 3/4 不符。证据：`cli.ts:207-221`、`server.ts:340-360`、`command.ts:88`；E1 + 本地执行复核（无测试）。
7. **入口漂移（未测试）**：MCP `create_game` 不把 `stylePath` 转相对路径（契约 `StyleReferencePath` 拒绝对路径）；MCP 无 `compile_td_game` / `review` / 并发参数；`compile_runtime` 不传 `hudLineHeight`。证据：`server.ts:230-329`、`cli.ts:188,560,603`、`visual-world.ts:90-93`；E1。

产物与验收：另一位开发者可按研究文件 §1 的调用图从 `cli.ts:445` / `server.ts:206` 跟踪一次构建，按 §3 定位 `run/v<N>` / `pack/v<N>` / `site/v<N>`，按 §4 查退出码与失败现场。MCP 能力面与 CLI 的差异集中在 §5 表。
