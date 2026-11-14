# I03-03B2 逐行 fixture manifest — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-14 |
| 分支 | `wayfinder/level-playability-v1.1-i03` |
| base | `f341150`（I03-03B2a 完成） |
| 实现票 | [I03-03B2](../issues/16-i03-03b2-row-manifest.md) |
| 约束 | **只冻结 manifest / 归一化计划 / 变异配方**；不物化二进制副本、不实现 probe、不改产品 fixture |

## 交付物

| 文件 | 说明 |
| --- | --- |
| `.scratch/.../geometry-probe/fixtures/manifest.json` | 逐行 fixture manifest + 11 个负例配方 |
| `.scratch/.../geometry-probe/fixtures/last-train-v4/manifest.json` | v2 → v4 归一化 manifest（只读派生） |
| `.scratch/.../geometry-probe/fixtures/normalization.json` | 归一化变换记录 |
| `.scratch/.../geometry-probe/scripts/build-fixtures.py` | 确定性重建脚本（只写 manifest / 行 / recipe，不复制 pack） |

## 基底与归一化

| 项 | 值 |
| --- | --- |
| 源 pack | `fixtures/packs/last-train/v2` |
| 源 pack tree hash | `sha256:570535deff5c2f4e1626b2680a4b555f631e51d6d87721507a0a1f6e2feb7383` |
| 源 manifest hash | `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` |
| 归一化 | `format → assetpack/v4`；`provenance → {mode}`；delivery / authoring 文件保持冻结 v2 原样 |
| 归一化 manifest hash | `sha256:19f4da6fb9bf25b96b48b96e2e44bb1773ad0c1222dc865f72e77a56fc85cb98` |
| v4 parse | **ok**（`parseAssetPack` 现场验证） |
| 重跑 | `python3 .scratch/.../geometry-probe/scripts/build-fixtures.py` |
| 脚本 hash | `sha256:4253bbbb4c849d94654239f90c074e7d3161d07c97a8ed7beb3ba5a4c7a3ea66` |
| fixture manifest hash | `sha256:dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b` |
| normalization hash | `sha256:e88f5a350a8cb596884b46cd0ffe8620691ab22cf8004e8b6e41eed0ec70d227` |

## 正例行（14）

| 分项 | 行数 | 对象 |
| --- | ---: | --- |
| hazard | 2 | `hazard-sweeping-carriage.sweep1` / `.sweep2`；box `(768,202,64,48)`；frame/source/anchor |
| player | 9 | 8 帧（`idle1..2 / run1..4 / jump1..2`）+ **1 个独立 spawn body 行**；frame rows 记 size/anchor/frame bounds；body row 记 size/offset/bounds/foot；canonical box `(24,204.4,32,48)`、foot `(40,252.4)` |
| graph | 3 | `terrain#0` `(0,250,1440,20)`；`luggage` `(480,210,40,40)`；player box/foot |

- 每帧 / 每个 body 一行；无抽样。
- **行定义**：14 = hazard 2 + player 8 帧 + player body 1 + graph 3；`13` 不是必要检查项的上限；spawn body 是独立行，不附着于每个 frame row。
- B2a 约定已应用：`at` = 锚点；`playerBox = boxFromFoot(footOf(...))`，不取整。
- 未加入 goal / pickup frame（不属于本轮 geometry gate 必需分项）。

## 负例（11，单变量）

| code | class | affected | expected summary |
| --- | --- | --- | --- |
| `frame-missing` | geometry-mismatch | player | `untrusted` |
| `frame-size-mismatch` | geometry-mismatch | player | `untrusted` |
| `anchor-mismatch` | geometry-mismatch | player | `untrusted` |
| `trimmed` | geometry-mismatch | player | `untrusted` |
| `rotated` | geometry-mismatch | player | `untrusted` |
| `atlas-hash-mismatch` | geometry-mismatch | hazard, player | `untrusted` |
| `atlas-missing` | missing-evidence | hazard, player | `partial` |
| `body-size-mismatch` | geometry-mismatch | player, graph | `untrusted` |
| `body-offset-mismatch` | geometry-mismatch | player, graph | `untrusted` |
| `body-bounds-mismatch` | geometry-mismatch | player, graph | `untrusted` |
| `graph-solid-mismatch` | geometry-mismatch | graph | `untrusted` |

- 帧级负例在变异后同步更新 manifest `files[]` 中 atlas JSON checksum，避免 `atlas-hash-mismatch` 抢占失败码。
- `atlas-hash-mismatch` 只改 atlas `meta`，不更新 manifest checksum。
- `atlas-missing` 只删 atlas JSON；输出 hash 为 `null`。
- body-size / body-offset / body-bounds / graph-solid 是 **runtime / audit override recipe**，不复制 pack；recipe hash 已记录。
- `environment-mismatch` / `nondeterministic` = review-only；`probe-not-run` = 执行缺失，均不伪造几何夹具。

> **2026-11-14 I03-10 F2 修正**：负例由 10 增至 11，新增 `body-bounds-mismatch`（body bounds x +0.5 px，size / offset 不变）；脚本 / manifest hash 已重算。此前“7 个 geometry-mismatch”的组成描述更正为 10 个 geometry-mismatch + 1 个 missing-evidence。

## 未物化声明

本票**不复制**二进制 pack，也不实现 probe。manifest 记录 base + normalization + rows + recipes + hashes；未来实施单元按 manifest 从冻结 v2 基底 + 归一化 + recipe 确定性物化。这样既冻结了逐行契约，又没有越过“不授权 fixture / probe 实现”的边界。

## 命令与结果

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `python3 .../build-fixtures.py` | **0** | 14 rows / 11 negatives；manifest 写出 |
| `node --input-type=module` `parseAssetPack(last-train-v4/manifest.json)` | **0** | `parse true` |

## 边界

- 未修改 `fixtures/packs/**` / 产品 fixture / Runtime / `profile.ts` / `graph.ts`；未实现 probe。
- 未开放 `PUBLIC_NB` / `PUBLIC_PU`；未改变 publish rejection。
- 产物全部在 `.scratch/level-playability-v1.1-i03/evidence/geometry-probe/`。
