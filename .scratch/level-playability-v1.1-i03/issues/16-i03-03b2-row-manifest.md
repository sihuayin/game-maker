# I03-03B2 逐行 fixture manifest

Type: task
Status: resolved
Owner: claude (I03-03B2 session 2026-11-14)
Blocked by: 14
Map: ../map.md
Class: I-03 / TASK

## Task

> **本票只冻结 manifest / 归一化计划 / 变异配方；不物化二进制副本、不实现 probe。**
>
> **B2a 已裁定（2026-11-14）**：`player.at` = 锚点；player box = `boxFromFoot(footOf(...))`，不取整；last-train 为 `(24,204.4,32,48)`；witness 修正 / `.95` 回归 / 零容差见 [I03-03B2a](17-i03-03b2a-player-coordinate.md)。本票已解除阻塞。

把 I03-03B 的夹具设计落成**逐行 fixture manifest**：每个 frame / body 的 expected 值、来源、hash 与负例变异配方。**不实现 probe，不修改产品 fixture。**

### 必须完成

1. 在 `.scratch/level-playability-v1.1-i03/evidence/geometry-probe/fixtures/last-train-v4/` 建立 v4 归一化副本；记录原始 v2 输入 hash、归一化变换（脚本 / 命令 / 逐字段）、产物 hash。
2. 逐行列出正例：
   - hazard：`sweep1` / `sweep2`（size / anchor / frame bounds）；
   - player：`idle1..2` / `run1..4` / `jump1..2` 八帧 + spawn body（size / offset / bounds / foot）；
   - graph：`terrain#0`、`luggage` solid、player box。
   每行记录 expected 值、来源（manifest / atlas / 代码规则）、fixture hash。
3. 建立 10 个负例副本（I03-03B §3），每个只改一个主变量；记录变异配方、输入 hash、产物 hash、预期失败码 / 分项状态 / summary。
4. 写机器可读 manifest（路径与字段与 I03-03A / I03-03B 对齐），例如 `fixtures/manifest.json`；不得直接手工编辑最终证据。
5. 验证：同一基底 + 同一变异可确定性重建；正例清单与 B 票完全一致；无遗漏帧 / body。
6. 写 `.scratch/level-playability-v1.1-i03/evidence/03b2-fixture-manifest.md`。
7. 不实现 probe；不改 `fixtures/packs/**` / Runtime / `profile.ts` / `graph.ts`。

### 禁止

- 实现 probe / 跑浏览器；
- 修改产品 fixture / 新增产品 JSON fixture；
- 根据 probe 结果删减失败对象；
- 开放公共能力 / 推送 / PR / 合并。

### 验收

逐行 manifest 完整；正例零遗漏；10 个负例单变量；输入 / 输出 hash 与重建命令齐全；产品目录零 diff。

## Answer

**完成。** 逐行 fixture manifest、v4 归一化计划、10 个负例配方与 hashes 已冻结；**未物化二进制副本、未实现 probe、未修改产品 fixture**。

| 项 | 结果 |
| --- | --- |
| 源 pack tree hash | `sha256:570535deff5c2f4e1626b2680a4b555f631e51d6d87721507a0a1f6e2feb7383` |
| 源 manifest hash | `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` |
| 归一化 manifest hash | `sha256:19f4da6fb9bf25b96b48b96e2e44bb1773ad0c1222dc865f72e77a56fc85cb98`（v4 parse ok） |
| 正例行 | **13**：hazard 2 / player 8 / graph 3；player canonical box `(24,204.4,32,48)`、foot `(40,252.4)` |
| 负例 | **10** 个单变量 recipe：7 个 geometry-mismatch（player/hazard/graph 按 affected）+ `atlas-missing` missing-evidence + body-size / body-offset / graph-solid override |
| Review-only | `environment-mismatch` / `nondeterministic`；`probe-not-run` 不造夹具 |
| 重建 | `python3 .scratch/.../geometry-probe/scripts/build-fixtures.py`；确定性写出 manifest |
| 未物化 | 不复制二进制 pack；未来实施单元按 base + normalization + recipe 物化 |
| 产品改动 | **无**；仅 `.scratch` 证据 |

证据：[`../evidence/03b2-fixture-manifest.md`](../evidence/03b2-fixture-manifest.md)。**下游**：I03-03C（独立复核标准）为下一 frontier；I03-06 可并行；probe 实现仍不授权。
