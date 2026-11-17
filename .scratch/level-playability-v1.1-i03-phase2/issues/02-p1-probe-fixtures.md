# P1 · Probe 契约冻结与夹具物化 brief

Type: grilling
Status: resolved
Owner: claude (P1 session 2026-11-17)
Blocked by: 01
Map: ../map.md
Class: I-03-Phase2 / P1

## Question

为 P1 产出一份可交接的执行 brief：如何在 audit 分支 `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/` 物化 I03-03A/B2/B2a 已冻结的 probe 契约与夹具，录入 F2 修正后的 **11 个负例**（10 `geometry-mismatch` 含 `body-bounds-mismatch` + 1 `missing-evidence`）、固定 manifest / 文件 hash，并定义 P2 可消费的输入与 STOP 条件？

必须覆盖：`geometry-probe/{contract,fixtures,scripts,evidence/p1}` 结构；F2 manifest hash `dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b`；14 正例行（hazard 2 / player 8 帧 + body 1 / graph 3）；原始 fixture 只读与受控副本关系；audit 分支 `wayfinder/i03-phase2-probe-evidence` 的提交与 hash 记录；P1 独立复核与用户签署；回滚；**本 brief 不写实现**。

约束：见 `reports/00-execution-protocol.md` §4 与 annex §4；产品 `packages/**` / `fixtures/**` 零改动。

## Comments

- 2026-11-17：Phase-2 annex 已由 amber 签署（签署前 `0a3ee4a3…`；签署后 hash 见 `reports/00-annex-signature.md`）。P1 仍为 BLOCKED：需 P1 独立增量授权记录 + 用户签署后才能开工。

## Answer

**Q37–Q42 = 用户全部采纳（2026-11-17）。** 本 brief 冻结 P1 的执行边界；**不构成 P1 实施授权**。

### 1. 目标与输入

P1 只做一件事：把 I03-03A/B2/B2a 已冻结的 probe 契约与夹具，在 Phase-2 scratch 中**物化并冻结 hash**，供 P2 消费。

冻结输入：

| 输入 | 值 |
| --- | --- |
| I03-03A 契约 | `.scratch/level-playability-v1.1-i03/issues/13-i03-03a-probe-format.md` |
| I03-03B2 manifest | `sha256:dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b` |
| build script（旧） | `sha256:4253bbbb4c849d94654239f90c074e7d3161d07c97a8ed7beb3ba5a4c7a3ea66` |
| 源 pack tree | `sha256:570535deff5c2f4e1626b2680a4b555f631e51d6d87721507a0a1f6e2feb7383` |
| 源 manifest | `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` |
| 归一化 manifest | `sha256:19f4da6fb9bf25b96b48b96e2e44bb1773ad0c1222dc865f72e77a56fc85cb98` |

正例 **14**：hazard 2 / player 9（8 帧 + body 1）/ graph 3。负例 **11**：10 `geometry-mismatch`（含 `body-bounds-mismatch`）+ 1 `missing-evidence`。不得回退到旧 10 负例口径。

### 2. 产出布局

```
.scratch/level-playability-v1.1-i03-phase2/geometry-probe/
├── contract/                 # I03-03A 契约冻结副本 + hash
├── fixtures/
│   ├── source/last-train-v2/ # 产品 pack 的只读完整副本
│   ├── last-train-v4/        # v4 归一化 manifest + 所需 delivery 文件副本
│   ├── manifest.json         # 冻结 probe manifest（hash dd880628…）
│   ├── normalization.json
│   └── recipes/              # 11 个负例变异配方
├── scripts/build-fixtures.py # phase-2 自有副本（docstring 修正）
└── evidence/p1/
```

### 3. 执行步骤

1. 复制 `fixtures/packs/last-train/v2/**` 到 `fixtures/source/last-train-v2/`，记录 tree hash 与逐文件 SHA-256；产品 fixture 只读。
2. 复制 `build-fixtures.py` 到 Phase-2 `scripts/`；只修正 docstring「10 negative」旧口径，行为不变；输出 manifest 必须与 `dd880628…` 逐字节一致。
3. 运行重建两次，两次输出字节一致；记录命令、退出码、hash。
4. 生成 `fixtures/manifest.json`、`normalization.json`、`recipes/`；写入 `evidence/p1/`。
5. 用 `git add -f` 只提交 `geometry-probe/**` 到 audit 分支 `wayfinder/i03-phase2-probe-evidence`。

### 4. 证据 / 复核 / 签署

- `evidence/p1/`：`commands.log`、两次 rebuild 输出、manifest / tree / 文件 SHA-256、`SHA256SUMS`。
- 独立复核：`reports/P1-review.md`（fresh reviewer）；逐项检查 manifest hash、14/11 计数、`body-bounds-mismatch`、两次重建字节一致、source / v4 tree hash、产品零改动。
- P1 review PASS + 用户签署后才算完成；P2 才能启动。
- `main` 只收 P1 授权 / 复核 / 治理报告；audit 分支记录 commit SHA。

### 5. 白名单

仅 `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/**` 与 `reports/P1-*`。产品 `packages/**` / `fixtures/**` 零改动；任何产品文件改动 ⇒ STOP。

### 6. STOP

- manifest hash ≠ `dd880628…` 或负例回退到旧 10 个口径。
- 缺 `body-bounds-mismatch`、正例 ≠ 14、负例 ≠ 11。
- 两次重建字节不一致。
- 修改原始产品 fixture / 把副本放进产品 package。
- `git add -f` 夹带白名单外文件。
- 任何需要扩大白名单或修改契约语义 ⇒ STOP + HITL。

### 7. 授权顺序

本 brief 只是规划。执行前必须：

1. 用户签署 P1 增量授权记录（引用 annex §4 与本 brief）；
2. docs-only PR 合入 `main`；
3. 从更新后的 `main` 创建 audit 分支；
4. 执行 P1、独立复核、用户签署、Ledger。

本会话未创建 audit 分支、未物化夹具、未运行 rebuild。

