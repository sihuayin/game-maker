# I02-00 Effort 初始化与输入冻结

Type: task
Status: resolved
Owner: claude · 2026-11-10
Blocked by: —
Map: ../map.md
Class: I-02 / EVIDENCE

## Question

冻结本 effort 的权威输入、基线与停止线，建立可复现的证据目录。此票不做任何设计裁定。

### 必须完成

1. `sha256sum docs/v7.8/移动-200.md`，记录到基线文件；同时记录 `docs/v7.8/移动-I00.md`、`docs/v7.8/移动.md` 与 `CONTEXT.md` 的 SHA。
2. 记录基线提交（`a3b8a54`，I-01 已合并）与工作分支 `wayfinder/level-playability-v1.1-i02`。
3. 建立 `.scratch/level-playability-v1.1-i02/{scripts,evidence,experiments,reports}`。
4. 写 `evidence/00-baseline.md`：
   - 权威输入清单与 SHA；
   - 用户 2026-11-10 的 Q1–Q4 裁定与执行边界；
   - 停止线：零付费、产品目录只读、不接生产；
   - 已知的 I-00 / I-01 / P0 证据入口。
5. 记录本机环境（node、pnpm、平台、CPU）与测试命令。

### 输出

`evidence/00-baseline.md`。

### 下游

全部票。

## Answer

基线记录：[`evidence/00-baseline.md`](../evidence/00-baseline.md)。**修改产品目录：否**。

- 基线提交 `a3b8a54`（I-01 合并 `f6a7de9`）；工作分支 `wayfinder/level-playability-v1.1-i02`。
- 冻结 SHA：
  - I-02 需求 `docs/v7.8/移动-200.md` = `14a3816d8d5975765e3a9301c5f06612ab03f6f14130ca4ca865550ec165b7d5`（**git 未跟踪；以 SHA 为准，不以提交为准**）；
  - I-00 冻结包 `docs/v7.8/移动-I00.md` = `d9fea112a519965e7903d6c7dc9125498927880b14ff0baba9896ecd446e69eb`；
  - 父 PRD `docs/v7.8/移动.md` = `3598cc19…`（与 I-00 权威输入一致）；
  - `CONTEXT.md` = `c623d018…`。
- 用户 2026-11-10 的 Q1–Q4 裁定、五单元目标授权状态、R1/R2 门槛、scratch 允许/禁止清单与停止线已写入基线文件 §2–§3。
- 环境：Node `v22.23.2`、pnpm `10.7.1`、Vitest `3.2.7`、Darwin 24.6.0 arm64 / Apple M4 / 16 GiB。
- 只读复跑：`pnpm test` exit 0（170 files / 2616 tests）；`playability-temporal-input` exit 0（65 tests）；7 个 playability 测试 exit 0（190 tests）；`git diff -- packages docs fixtures` 为空。原始日志在 `evidence/logs/`。
- 已知未决项已链接到 I02-D1、I02-02、I02-06 以及 I-00「需单独裁定」项；本票不做任何设计裁定。

### 下游

I02-02、I02-03、I02-04、I02-05、I02-06 均已解除 I02-01 的阻塞，进入前沿。
