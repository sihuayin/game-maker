# 正式入口：`verify-delivery` CLI + `pnpm test:evidence`

Type: task
Status: resolved
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

## Answer

**已收口（2026-10-29）。**

### 正式入口

- `packages/cli/src/evidence.ts`：`runVerifyDeliveryCommand` —— 先 `evidenceRootPaths` + `assertOutOutsideRoots`
  （`--out` 在任一声明 root 内 ⇒ `usage(2)`，**任何写入之前**拒），再调 `verifyDeliveryEvidence`，
  最后 `writeVerificationReport` 落盘并渲染 `CommandResult`。
- `packages/cli/src/cli.ts`：新增 `case "verify-delivery"` 与 USAGE 行；`--manifest` 注册为带值选项；
  退出码直接取报告 `exitCode`（pass→0 / fail|blocked|incomplete→1；参数错→2；清单 invalid→4）。
- `packages/pipeline`：新增 `readEvidenceManifest` / `evidenceRootPaths` / `assertOutOutsideRoots` /
  `writeVerificationReport`。报告目录按 `<timestamp>-delivery-verification` 原子分配
  （先写临时目录、`renameSync` 到最终名；EEXIST/ENOTEMPTY 试下一个），中途失败清理临时目录、不留最终目录；
  `report.json` 与 `report.md` 来自同一次运行。
- 本版**不加 MCP 镜像**、不改 contracts。

### `pnpm test:evidence`

- `package.json` 新增 `"test:evidence": "pnpm build && node scripts/evidence-acceptance.mjs"`；
  不并入 `pnpm test` / `pnpm test:acceptance`。
- `scripts/evidence-acceptance.mjs`：build 后用固定清单跑正式 CLI → 校验退出码、报告存在/结构、
  `status=pass`、`declared=recomputed`、六项全 match → 在 `runs/<timestamp>-test-evidence/summary.json`
  记录命令、耗时、读取规模、报告 sha、诊断与问题；不覆盖历史。
- 实测（本机，2026-10-29）：
  - `exit 0` · **1,243 ms** · 清单 195 文件 / **19,990,756 bytes（约 19.1 MB）**；
  - 报告 `runs/2026-10-29T04-14-53-733Z-delivery-verification/report.json`
    （sha256 `23620c11…7194`，125,562 bytes）；summary
    `runs/2026-10-29T04-14-52-498Z-test-evidence/summary.json`；
  - `status=pass`、`declared=pass`、`recomputed=pass`、六项全 match、diagnostics=0。

### 测试与回归

- 新增 `packages/cli/tests/evidence.test.ts`（6 个用例）：缺 `--manifest`→2、清单无效→4、
  `--out` 在 root 内→2 且零写入、六项前置缺失→blocked 1 且报告落盘、篡改→fail 1 可定位、重复运行不覆盖。
- `pnpm test`：**149 files / 2222 tests passed**；`pnpm typecheck` 全 Done。

### 已知限制

- `test:evidence` 是**基线证据运行**，不是廉价单测（实测约 1.2s、19 MB；机器相关）。
- 本版无 MCP 镜像；`--json` 只走 CLI 的既有渲染。
- `pnpm test:playtest` / `pnpm test:acceptance` 的最终回归归票 08（本票不改这两条链）。
- 工作树未提交（CLI + 脚本 + 测试 + 本次运行记录）。
