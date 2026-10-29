# 核实安全审计命令（P0-01A / §7）

Type: task
Status: open
Blocked by: （无）

## Question

在运行任何命令前核实副作用，产出一张审计命令 allowlist。候选至少覆盖：

`git` 只读命令、`rg` / `find`、`pnpm test`、`pnpm typecheck`、`pnpm build`、`pnpm test:evidence`、`inspect`、`verify`、`verify-delivery`、`accept`、`test:playtest`、`test:acceptance`、`playtest`、`pack` / `site` / `create`。

逐条判断：是否写入历史目录或账本、是否触发模型/浏览器/网络、是否需要付费、输出能否重定向到 `out/` 或专用临时目录、退出码与证据位置。

分类：`SAFE` / `SAFE_WITH_TEMP_OUTPUT` / `FORBIDDEN`（按用户 Q7 与补充裁定 ②）。每条附判定依据（文件:行）。

产物：`.scratch/p0-01-audit/research/02-safe-commands.md`，含推荐调用方式与禁止清单。
