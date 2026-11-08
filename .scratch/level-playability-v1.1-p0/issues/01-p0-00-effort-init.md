# P0-00 Effort 初始化

Type: task
Status: resolved
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

## Answer

**2026-11-06 完成（agent，AFK）。** 只做分支、目录、基线、声明；未解析 Runtime 语义，未触碰产品代码，零付费。

| 交付 | 结果 |
|---|---|
| 执行分支 | `p1/level-playability-v1.1-p0`，自图 tip `a82165cb10ee93a71ed3bb88e0c419faa6dcd8dc` 切出 |
| 基线文档 | [`../evidence/00-baseline.md`](../evidence/00-baseline.md) |
| 目录 | `evidence/`、`prototype/`、`cases/` 已建立；后两者以 `.gitkeep` 保留 |
| PRD 校验 | `sha256:37bab0a85739b22069b22a6927df9d917d8fd78fa2c4d14fb4f6edac0628ad72`（与图 Baseline 一致） |
| LP-00 基线 | `.scratch/level-playability-v1-p1/research/01-runtime-semantics.md` @ `8b6efbb` |
| 前序图收口 | `.scratch/level-playability-v1-p1/map.md` @ `ae4fc75`（`Status: closed · 2026-11-06`） |
| 站点输入校验 | `fixtures/packs/last-train/v2/manifest.json` `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` |
| `git status --short` | 仅本 effort 目录内文件（见基线文档 §6） |

- 本票工作提交：`e79aaf1fcb0049ec61da23bc2169dc64556a17e5` — `P0-00: effort init — execution branch, baseline, boundaries`
- 回退点：`git reset --hard a82165c`（丢弃本票）或删除分支 `p1/level-playability-v1.1-p0`。
- 零付费：未调用模型、未生图、未重建站点。
- 下一票：[P0-01 移动 Hazard Runtime 增量语义核验](02-p0-01-moving-hazard-semantics.md)（blocked by 01）已解锁。
