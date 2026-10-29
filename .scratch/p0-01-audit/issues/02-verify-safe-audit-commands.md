# 核实安全审计命令（P0-01A / §7）

Type: task
Status: resolved
Blocked by: （无）

## Question

在运行任何命令前核实副作用，产出一张审计命令 allowlist。候选至少覆盖：

`git` 只读命令、`rg` / `find`、`pnpm test`、`pnpm typecheck`、`pnpm build`、`pnpm test:evidence`、`inspect`、`verify`、`verify-delivery`、`accept`、`test:playtest`、`test:acceptance`、`playtest`、`pack` / `site` / `create`。

逐条判断：是否写入历史目录或账本、是否触发模型/浏览器/网络、是否需要付费、输出能否重定向到 `out/` 或专用临时目录、退出码与证据位置。

分类：`SAFE` / `SAFE_WITH_TEMP_OUTPUT` / `FORBIDDEN`（按用户 Q7 与补充裁定 ②）。每条附判定依据（文件:行）。

产物：`.scratch/p0-01-audit/research/02-safe-commands.md`，含推荐调用方式与禁止清单。

## Answer

**已收口（2026-10-29）。** 逐条按实现核实副作用，未执行任何候选命令。

- **SAFE**：`git` 只读命令、`rg/find/sed/grep/cat/wc/shasum/node -e` 只读、`pnpm test`（测试只写 `mkdtemp` 临时目录、假 `fetch`）、`pnpm check:deps` / `check:links`、`verify`、`inspect`、纯 Vitest 子集。
- **SAFE_WITH_TEMP_OUTPUT**：`pnpm build` / `typecheck`（写 `.gitignore` 的 `dist/` 与 `*.tsbuildinfo`）、`accept --out <tmp>`、`verify-delivery --out <tmp>`、`test:evidence --out <tmp>`、`site --out <tmp>`；`test:mechanic` / `test:acceptance` 仅在后续票确实需要新浏览器观测时按条件使用（输出可重定向、不写历史、不是 Playtest）。
- **FORBIDDEN**：`create` / `build` / `plan` / `pack` / `compile-runtime` / `compile-td-game`（模型/付费/写版本）、`playtest`、整条 `test:playtest`（self-test 固定写 `.scratch/playtest-v1/runs/<date>-self-test`）、`review`（模型 + 写 ledger）、`review-verdict`（写 qa-report）、`playtest-baseline`（写 fixtures）、`pnpm install`。
- **保守默认**：`pnpm build` 的 `dist/` 写入按“被忽略的构建产物”接受（不碰受跟踪文件/历史）；浏览器机制探针默认不使用，需要时另行请求批准并记录输出目录。
- 本票只做静态核实与本票的只读 shell；零生产修改。

研究文件（完整命令矩阵与推荐调用）：[../research/02-safe-commands.md](../research/02-safe-commands.md)
