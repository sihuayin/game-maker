# P0-00 执行基线

Effort: `level-playability-v1.1-p0`
Execution branch: `p1/level-playability-v1.1-p0`
Created: 2026-11-06
Map: [../map.md](../map.md)

本文件只钉死分支起点、冻结输入与边界声明；**不解析任何 Runtime 语义，不触碰产品代码**。

## 1. 分支起点

| 项 | 值 |
|---|---|
| 执行分支 | `p1/level-playability-v1.1-p0` |
| 起点（图 tip，`a82165c`） | `a82165cb10ee93a71ed3bb88e0c419faa6dcd8dc` — `docs: chart level-playability-v1.1-p0 wayfinder map` |
| 生产代码基线（与 `main` 的 merge-base） | `34db62b20a8fdc5dbe9bd25a05b20cfa67296040` — `docs: sync LP-07 AC-10 test count` |
| `main` 当前 tip（参照） | `4619276` — `Merge pull request #28 from sihuayin/wayfinder/level-playability-v1` |
| `packages/**` / `fixtures/**` 相对 `main` | 无差异（`git diff --stat main -- packages fixtures` 为空） |

## 2. 冻结输入校验

| 输入 | 路径 | 校验 |
|---|---|---|
| PRD（只读冻结） | `docs/v7.8/可玩1.md` | `sha256:37bab0a85739b22069b22a6927df9d917d8fd78fa2c4d14fb4f6edac0628ad72`（与 `map.md` Baseline 一致） |
| LP-00 Runtime 语义报告 | `.scratch/level-playability-v1-p1/research/01-runtime-semantics.md` | 引入 commit `8b6efbb75a815707e08887dca08a981045651bb4` — `docs: resolve LP-00 runtime semantics evidence` |
| 前序图（level-playability-v1-p1） | `.scratch/level-playability-v1-p1/map.md` | 收口 commit `ae4fc75cf896434549a65829f0e8b11ec647684f` — `LP-07: final closeout report and map closure`；`Status: closed · 2026-11-06` |
| 站点构造输入 manifest | `fixtures/packs/last-train/v2/manifest.json` | `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689`（`format: assetpack/v4`，`id: last-train`，`version: 2`） |

工具链（本机，仅作复跑参照，不写入任何 lockfile）：Node `v22.23.2`、pnpm `10.7.1`。

## 3. Effort 目录

```
.scratch/level-playability-v1.1-p0/
├── map.md
├── issues/          # 票
├── evidence/        # 本文件及后续证据
├── prototype/       # P0-02 原型（.mjs + node:test）
└── cases/           # P0-03a 合成案例与 scratch 站点
```

`prototype/`、`cases/` 以 `.gitkeep` 占位，确保目录随分支保留。

## 4. 零付费声明

- 本票**不调用任何模型**、**不生成图片**、**不重建付费站点**、**不产生新付费 Demo**。
- 除本 effort 目录外，本票不新增任何文件，不修改任何既有文件。

## 5. 硬边界清单（本 effort 全程适用）

- **Runtime 只读**：不修改 `packages/demo/**` 行为；不新增 EntityKind / Motion / 机制 / 斜坡碰撞。
- **不接生产**：不修改 `packages/contracts` 生产判据，不接 Pipeline / Publish Gate，不改 CLI / MCP 参数，不新增持久化 schema。
- **不新增依赖**：不新增第三方依赖；原型只在 scratch 内以 `.mjs` + Node 22 `node:test` 运行，不进入 `pnpm test` / CI。
- **不碰历史**：`run/**`、`pack/**`、`site/**`、`fixtures/**` 与既有验收证据只读。
- **不推送、不合并、不绕过 PR 审查**：本执行分支不上推远端，不创建 PR；推送（若后续裁定需要）走 ClashX `127.0.0.1:7890`。
- **不放宽测试**：LP-02～LP-07 既有测试不得放宽；不改现有三态语义。
- **越界即停**：任何超出 `docs/v7.8/可玩1.md` P0-01～P0-03 授权范围的改动，立即停止并回到 failure ticket 的裁定点。

## 6. `git status --short` 证明

基线提交前的工作树状态（仅本 effort 目录内文件）：

```
 M .scratch/level-playability-v1.1-p0/issues/01-p0-00-effort-init.md
?? .scratch/level-playability-v1.1-p0/cases/
?? .scratch/level-playability-v1.1-p0/evidence/
?? .scratch/level-playability-v1.1-p0/prototype/
```

除 `.scratch/level-playability-v1.1-p0/` 外无任何改动。
