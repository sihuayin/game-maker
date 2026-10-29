# 正式入口：`verify-delivery` CLI + `pnpm test:evidence`

Type: task
Status: open
Blocked by: 04

## Question

把核心能力接成正式入口（Q4 / Q11）：

1. **CLI 子命令** `game-maker verify-delivery --manifest <file> [--out <dir>] [--json]`：
   - 只认 `--manifest`，不猜、不扫描、不假定 `out/<gameId>/run/vN` 里有继承证据；
   - `--out` 落在任何声明 root 内 ⇒ `usage(2)`，且不开始写入；
   - 报告目录原子分配（`mkdirSync` EEXIST 试下一个 N），绝不覆盖历史；
   - `report.json` 与 `report.md` 描述同一次运行；中途失败不留看似完整的结果；
   - 退出码：重算 `pass→0`；`fail|blocked|incomplete→1`；用法错→`2`；清单/交付读不出或不过 schema→`4`；
   - 更新 `USAGE` 文案与 CLI 测试（含参数错、out 越界、exit code 映射）。
2. **`pnpm test:evidence`**（package.json 脚本）：build → 用固定清单对冻结 FPVS-V1 跑正式 CLI → 校验退出码、
   报告存在且结构合法、重算结论与预期基线一致 → 保留本次报告、不覆盖历史。
   - 不并入 `pnpm test` / `pnpm test:acceptance`；
   - 在票面记录**真实耗时与读取规模**（约 200MB 证据），避免日后被误当廉价单测。

完成判据：CLI 手跑一次成功 + 各类失败路径的退出码测试；`pnpm test` / `pnpm typecheck` 全绿。
