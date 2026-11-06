# P0-00 Effort 初始化

Type: task
Status: claimed
Owner: agent（AFK）· 2026-11-06
Blocked by: —
Map: ../map.md

## Question

从本图 tip 切出执行分支、建立证据目录、钉死基线并声明零付费边界。本票**不解析任何 Runtime 语义**，也不触碰产品代码。

### 必须交付

1. `p1/level-playability-v1.1-p0` 从 `wayfinder/level-playability-v1.1` 的成图 commit 切出（记录起点 SHA）。
2. `.scratch/level-playability-v1.1-p0/{evidence,prototype,cases}/`。
3. `evidence/00-baseline.md`：
   - 执行分支起点 commit SHA；
   - PRD `docs/v7.8/可玩1.md` 的 `sha256:37bab0a85739b22069b22a6927df9d917d8fd78fa2c4d14fb4f6edac0628ad72`；
   - LP-00 报告与 `level-playability-v1-p1` 收口 commit 的引用；
   - `fixtures/packs/last-train` 的 manifest 校验和（站点构造输入）；
   - `git status --short` 证明除本 effort 目录外无改动。
4. 零付费声明：本票不调用模型、不生图、不重建付费站点。
5. 硬边界清单（Runtime 只读、不改生产、不接 Pipeline、不新增依赖、不推送 / 合并）。

### 边界

- 只做分支、目录、基线、声明；不跑测试、不做语义核验、不建案例、不写原型。
- 不修改 `packages/**`、`fixtures/**`、`run/**`、`pack/**`、`site/**`、`package.json`。

### 通过标准

- 执行分支存在，`evidence/00-baseline.md` 完整，`git status` 只显示本 effort 新增文件。
