# 冻结 P0-02 起始基线

Type: task
Status: resolved
Blocked by: （无）

## Question

记录 P0-02 起始的可复核基线：

- 仓库、分支、完整 commit SHA（P0-02 起始 HEAD）；
- `git status --porcelain` 与工作区状态；
- 与 P0-01 基线 `2c1a9d5` 的生产代码 diff（`packages/`、`scripts/`、`package.json`、lockfile、tsconfig）必须为空；
- 关键目录/包结构、P0-02 将读取的输入与证据路径；
- 无法读取或未核实的内容。

产物：`.scratch/p0-02-second-demo/research/02-baseline.md`（含命令与退出码）。

## Answer

**已收口（2026-10-29）。** P0-02 起始 HEAD **`4f3bc69`**（P0-01 收口）；生产代码与 P0-01 基线 `2c1a9d5` **零差异**（`2c1a9d5..4f3bc69` 仅 21 个 P0-01 文档/effort 文件、3078 insertions）。

- 工作区：仅未跟踪 `.scratch/p0-02-second-demo/` 与 `docs/v7.6/管线.md`；无 tracked 修改；无 merge/rebase。
- 结构：10 个包；6,886 个受跟踪文件；149 个测试文件。
- 关键输入已绑定 sha256：P0-01 主文档 `62536d3a…`、裁定 `ad195608…`、决策报告 `db6d3d08…`、冻结 ledger `42ed224e…`、证据清单 `ba7a485b…`。
- 排除：未读本地凭据内容；`out/` / `dist/` 不作为基线；未启动浏览器、未付费、未生成。
- 零生产修改。

研究文件（命令、SHA、来源与排除项）：[../research/02-baseline.md](../research/02-baseline.md)
