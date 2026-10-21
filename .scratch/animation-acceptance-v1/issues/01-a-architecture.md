# 01. A · 项目架构与依赖边界

Type: research
Status: resolved
Owner: research 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

核实 HEAD `f0dac01` 的仓库架构与依赖边界，回答任务书 §4.1 的 7 个问题：

1. 当前仓库采用什么 package / workspace 划分？
2. 资源生成、资源处理、资源验证分别位于哪里？
3. 资源格式由哪个模块定义？
4. 游戏运行时由哪个模块提供？
5. CLI 如何调用这些模块？
6. 是否存在可以直接复用的验证入口？
7. 新增验收能力会不会造成不合理的跨 package 依赖？

必读：根 `README.md` / `README_zh.md`、`pnpm-workspace.yaml`、各 `packages/*/package.json`、
`scripts/check-deps.mjs`、`tsconfig*.json`、`packages/cli/src/cli.ts`、`packages/mcp/src/server.ts`、
`packages/pipeline/src/*.ts`。

## 验收

- 模块职责表：模块 / 文件 · 当前职责 · 相关接口 · 已有测试 · 对 Phase 1 的建议（复用 / 修改 / 不涉及），
  每行有 `path:line` 证据。
- 明确 `scripts/check-deps.mjs` 实际允许 / 禁止的依赖方向（给规则与失败退出码）。
- 明确 CLI / MCP 两个入口的差异；W1 只作线索，必须在 HEAD 复验。
- 明确新增验收能力应落在哪个 package、为什么；不得猜路径。

## 边界

- 只读；不改业务代码 / 测试 / 契约 / 资源 / 配置 / 锁文件。
- 允许 `pnpm test` 的**定向用例**（不得跑全量；全量由 08 负责）、只读 `verify` / `inspect`；
  禁止 `pnpm check` / `pnpm build` / 任何写 `out/` 的命令；零付费。
- W1 只作线索：逐条对 `f0dac01` 复验；旧结论不自动继承 `implemented`。
- 不写 `map.md`；只写本票与 `research/a-architecture.md`；不提交。

## 产出

`research/a-architecture.md`：模块职责表 + 依赖规则 + 入口差异 + Phase 1 落点建议 + 证据弱点。
完成后在本票追加 `

## Answer

- 基线 `f0dac01` 复验：9 个 pnpm package（`pnpm-workspace.yaml:1-2`）；`assets` 负责生成/处理/打包，`contracts` 定义全部格式，`demo` 提供运行时与站点装配，`pipeline` 只串理解/构建且**够不着 demo**，`cli`/`mcp` 是仅有的、可同时依赖 `assets`+`demo` 的薄壳。
- 生成与处理都在 `packages/assets`：`planAssets`（`ops.ts:249`）、`packAssets`（`:1508`）、`buildAssetPack`（`pack.ts:307`）、drawlist/生图客户端（`generate.ts:100`、`image-gen.ts:159/394/576`）；导入/切帧/光栅化/量化/图集/PNG 也全部住这里（`import.ts:315`、`sheet.ts:175/192`、`raster.ts:120`、`quantize.ts:19`、`atlas.ts:55`、`png.ts:29/44`）。
- 资源格式的唯一家是 `packages/contracts`：`assetpack/v4`（`assetpack.ts:57`）、`asset-recipe/v1`、`asset-spec`、`game-config/v1`、`td-config/v1`；`Animation`/`FrameRef` 在 `assetpack.ts:150-162`，`superRefine` 在 `:194-251`，`resolvePackRef` 在 `:377-426`。
- 游戏运行时在 `packages/demo`：纯层 `buildWorld`（`world.ts:90`）+ Phaser 外壳（`shell/entry.ts:44-85`、`shell/scene.ts:33-35/130-142/179-197`）+ 站点装配（`site.ts:167`）；没有独立 runtime package。
- 资源验证是四层：`contracts` 的 schema/纯判据、`assets` 的 `verifyPack`（schema + 逐文件 checksum + files 覆盖，`ops.ts:1662`）与 `inspectPack`（只报观察，`:1900`）、`qa` 的 5/6 判据族（`qa/assemble.ts:73`）、`demo` 装配期硬失败（`site.ts:188-213`）。前三者可直接复用，但都不是“动画验收”。
- 依赖守卫 `scripts/check-deps.mjs:16-31`：`assets/demo/qa/vision/game-design → contracts`，`pipeline → contracts/assets/vision/game-design/qa`，`cli/mcp → contracts/assets/demo/pipeline`；违规 exit 1。实测 exit 0（9 包）。守卫只读 `package.json.dependencies`，不读 tsconfig/相对 import；`cli`/`mcp` 的 tsconfig references 已漏 `pipeline`（构建影响 unverified）。
- CLI 10 命令 vs MCP 7 工具：仅 CLI 有 `create` 检查点、`compile-td-game`、`review`；MCP `create_game` 等价 `create --yes`，`assemble_site` 直调横版装配器、不能装塔防；MCP 无 `asCommandError`（裸 Error → `_exitCode:1`），`compile_runtime` 不传 `hudLineHeight`，`stylePath` 不相对化。README 写“六个工具”而代码/测试是七个（`server.ts:70-194`、`server.test.ts:69`）。
- Phase 1 落点：确定性动画/图集结构检查 → `packages/assets`；运行时播放探针 → `packages/demo`（纯层 + Chrome/CDP probe）；报告/基线 schema → `packages/contracts`；编排 → `packages/cli`（必要时 `mcp`）。不要放 `qa`（白名单只有 contracts，`qa/src/visual.ts:29-36`）或 `pipeline`（无 demo 边）；新建 `packages/acceptance` 仅在跨壳复用时才值得，且须同步 `package.json` / tsconfig references / `check-deps.mjs`。
- 已执行：8 个定向测试文件（contracts assetpack、assets inspect/pack-selfcheck、demo world/site、qa assemble、mcp server、cli cli）exit 0，138 用例通过；`verify fixtures/packs/last-train/v2` exit 0（31 文件）；`verify`/`inspect` v7 包 exit 0（inspect 19 资源 / 4 图集；manifest 76 帧 / 61 动画帧）。未跑全量测试、`pnpm check`、`pnpm build`、`pnpm typecheck` 或任何写 `out/` 的命令；零付费。
- 主要证据弱点：`verify` 不解析图集 JSON、不核对 manifest 帧与图集帧/边界；`inspect` 对缺失图集帧静默 `continue`（`ops.ts:1771-1773`）；运行时忽略 manifest `fps/loop`（`shell/scene.ts:140,193` 写死）且 `FrameRef.index/durationMs` 无生产者/消费者；probe 脚本写 `out/` 或付费，Phase 1 不能原样复用；`cli/dist` 为 gitignored 构建产物，只读运行不等于 HEAD 干净构建。
- 完整模块职责表、依赖图、W1 逐条复验、入口差异表、Phase 1 落点与证据弱点见 `research/a-architecture.md`。
