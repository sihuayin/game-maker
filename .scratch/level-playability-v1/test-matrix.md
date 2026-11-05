# Level Playability V1 — 合成负例与合法边界矩阵

> ⚠️ **非生产**：本目录下所有 fixture 都是 scratch 矩阵夹具，不是产品测试、不是历史语料、不得被 build / QA / 发布闸消费。
> 来源：03–05 的候选判据探针。合成矩阵只证明「判据会响 / 合法边界不误伤」，**不替代** 08 的历史语料零误伤基线。

- **版本**：`level-playability-test-matrix/v1`
- **生成**：2026-11-05T03:50:15.582Z
- **基线**：`main @ fa17c14`
- **机器可读**：`fixtures/07-matrix/matrix.json`
- **证据**：`fixtures/07-matrix/evidence/{03,04,05,04-corpus,04-patrol}.json`（五份探针均退出 0）
- **fixture 根**：`fixtures/07-matrix/<case>/`（每例含 `game-config.json` + `manifest.json` + `META.json`）

## 1. 矩阵

| # | 层 | case | 预期 verdict | 判据 id / owner | 失败定位 | 合法边界配对 | 证据 |
|---|---|---|---|---|---|---|---|
| 1 | spatial | `baseline-last-train` | `NO_PROVEN_BLOCKER` | — | — | — | 03:baseline-last-train |
| 2 | spatial | `gap-200` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE` | `entity "suitcase-2"` | `gap-40` | 03:gap-200 |
| 3 | spatial | `gap-40` | `NO_PROVEN_BLOCKER` | — | — | `gap-200` | 03:gap-40 |
| 4 | spatial | `wall-100` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE` | `entity "signal"` | `wall-40` | 03:wall-100 |
| 5 | spatial | `wall-40` | `NO_PROVEN_BLOCKER` | — | — | `wall-100` | 03:wall-40 |
| 6 | spatial | `pickup-120` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE` | `entity "suitcase-2"` | `pickup-50` | 03:pickup-120 |
| 7 | spatial | `pickup-50` | `NO_PROVEN_BLOCKER` | — | — | `pickup-120` | 03:pickup-50 |
| 8 | spatial | `goal-inside-luggage` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_GATE_BLOCKED` | `entity "signal"` | `gate-midair-jumpthrough` | 03:goal-inside-luggage |
| 9 | completion | `gate-midair-jumpthrough` | `NO_PROVEN_BLOCKER` | — | — | `goal-inside-luggage` | 05:gate-midair-jumpthrough |
| 10 | spatial | `low-ceiling-walkable` | `NO_PROVEN_BLOCKER` | — | — | — | 03:low-ceiling |
| 11 | spatial | `chest-in-pit` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE` | `entity "chest"` | `chest-range-rescues` | 03:chest-in-pit |
| 12 | spatial | `chest-range-rescues` | `NO_PROVEN_BLOCKER` | — | — | `chest-in-pit` | 03:chest-range-rescues |
| 13 | spatial | `chest-inside-luggage-range0` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_CHEST_BLOCKED` | `entity "chest-in"` | `chest-inside-luggage-range30` | 03:chest-inside-luggage-range0 |
| 14 | spatial | `chest-inside-luggage-range30` | `NO_PROVEN_BLOCKER` | — | — | `chest-inside-luggage-range0` | 03:chest-inside-luggage-range30 |
| 15 | spatial | `pickup-inside-luggage` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_PICKUP_BLOCKED` | `entity "p-inside"` | `pickup-on-luggage` | 03:pickup-inside-luggage |
| 16 | spatial | `pickup-on-luggage` | `NO_PROVEN_BLOCKER` | — | — | `pickup-inside-luggage` | 03:pickup-on-luggage |
| 17 | spatial | `pickup-body-override-inside` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_PICKUP_BLOCKED` | `entity "p-body"` | `baseline-last-train` | 03:pickup-body-override-inside |
| 18 | spatial | `moving-solid-sweep` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE` | `entity "high-pickup"` | `baseline-last-train` | 03:moving-solid-sweep |
| 19 | spatial | `spawn-deep-terrain` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` | `player.at` | `baseline-last-train` | 03:spawnDx |
| 20 | spatial | `spawn-no-foothold` | `INSUFFICIENT_EVIDENCE` | — | `coverage.spatial` | `baseline-last-train` | 03:spawn-no-foothold |
| 21 | spatial | `spawn-in-solid` | `PROVEN_UNPLAYABLE` | `auditGameConfig.spawn-in-solid (existing)` | `player.at` | `baseline-last-train` | existing:auditGameConfig |
| 22 | spatial | `target-out-of-world` | `PROVEN_UNPLAYABLE` | `auditGameConfig.inWorld (existing)` | `entity "signal"` | `target-at-edge` | existing:auditGameConfig |
| 23 | spatial | `target-at-edge` | `NO_PROVEN_BLOCKER` | — | — | `target-out-of-world` | existing:auditGameConfig |
| 24 | mechanic | `static-hazard-seals-path` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_MECHANIC_PATH_BLOCKED` | `entity "suitcase-3"` | `wide-patrol` | 04-corpus:maskAddsError |
| 25 | mechanic | `wide-patrol` | `INSUFFICIENT_EVIDENCE` | — | `coverage.mechanic` | `static-hazard-seals-path` | 04-patrol:naivePatrolSweepAddsError |
| 26 | mechanic | `danger-full-wall` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | `entity "suitcase-3"` | `danger-wide-idle` | 04:dangerFull_crossingMs |
| 27 | mechanic | `danger-wide-idle` | `NO_PROVEN_BLOCKER` | — | — | `danger-full-wall` | 04:dangerWide_baseReach |
| 28 | mechanic | `pickup-in-static-hazard` | `INSUFFICIENT_EVIDENCE` | — | `coverage.mechanic` | `baseline-last-train` | 04:pickupInStaticHazard_baseReach |
| 29 | mechanic | `moving-platform` | `INSUFFICIENT_EVIDENCE` | — | `coverage.mechanic` | `baseline-last-train` | 04:movingSolid_staticOriginalReach |
| 30 | completion | `one-way-pit-pickup` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT` | `entity "gate"` | `one-way-pit-gate-on-pit-floor` | 05:one-way-pit-pickup |
| 31 | completion | `one-way-pit-gate-on-pit-floor` | `NO_PROVEN_BLOCKER` | — | — | `one-way-pit-pickup` | 05:one-way-pit-gate-on-pit-floor |
| 32 | completion | `two-one-way-branches` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT` | `entity "gate"` | `order-required-high-then-low` | 05:two-one-way-branches |
| 33 | completion | `order-required-high-then-low` | `NO_PROVEN_BLOCKER` | — | — | `two-one-way-branches` | 05:order-required-high-then-low |
| 34 | completion | `two-pickups-one-arc` | `NO_PROVEN_BLOCKER` | — | — | — | 05:two-pickups-one-arc |
| 35 | spatial | `chest-sealed-in-solid` | `PROVEN_UNPLAYABLE` | `PLAYABILITY_SPATIAL_CHEST_BLOCKED` | `entity "sealed-chest"` | `chest-behind-wall-with-range` | 05:chest-sealed-in-solid |
| 36 | completion | `chest-behind-wall-with-range` | `NO_PROVEN_BLOCKER` | — | — | `chest-sealed-in-solid` | 05:chest-behind-wall-with-range |
| 37 | completion | `chest-midair-jumpthrough` | `NO_PROVEN_BLOCKER` | — | — | — | 05:chest-midair-jumpthrough |
| 38 | completion | `pit-chest-with-reset-hazard` | `NO_PROVEN_BLOCKER` | — | — | — | 05:pit-chest-with-reset-hazard |
| 39 | completion | `chest-overlapping-hazard` | `NO_PROVEN_BLOCKER` | — | — | — | 05:chest-overlapping-hazard |

## 2. 必须覆盖项对照（票 07）

| 必须覆盖的负例 | 对应用例 | 说明 |
|---|---|---|
| 沟壑造成必经路线中断 | `gap-200` | 合法边界 `gap-40` |
| 台阶 / 落脚点使跳跃无法完成 | `wall-100` / `pickup-120` | 合法边界 `wall-40` / `pickup-50` |
| 巡逻 hazard 封死唯一通路 | `wide-patrol` | **04 裁定不可证**：预期 `INSUFFICIENT_EVIDENCE`，不是 error |
| 危险区不存在可通过的安全窗口 | `danger-full-wall` | 合法边界 `danger-wide-idle` |
| 必需拾取物被地形或机制封死 | `pickup-inside-luggage` / `chest-sealed-in-solid` / `pickup-in-static-hazard` | 地形/实心体可证；hazard 包住只落 `INSUFFICIENT_EVIDENCE` |
| 目标位置无法到达或不可站立 | `goal-inside-luggage` / `gate-midair-jumpthrough` | 「站不住」不是错误；只要求 overlap |
| 出生点卡在实心体内 | `spawn-in-solid` / `spawn-deep-terrain` | 前者归既有 `auditGameConfig`；后者是新窄口径 |
| 实体 / 目标越界 | `target-out-of-world` | 归既有 `auditGameConfig.inWorld`；合法边界 `target-at-edge` |

## 3. 关键裁定在矩阵里的体现

1. **巡逻 hazard 不是确定性 error**：整段扫掠当实心会误伤宽巡逻（04 语料 4 条误报）。矩阵预期 `INSUFFICIENT_EVIDENCE`。
2. **被 hazard / danger 包住的收集物不判错**：复位保留收集计数、同帧回调顺序不可证；矩阵预期 `INSUFFICIENT_EVIDENCE`。
3. **moving-platform 归 `mechanic-coverage`**：不产 playability error；矩阵预期 `INSUFFICIENT_EVIDENCE`。
4. **低天花板 / moving solid 扫掠是合法边界**：03 修复前是已知误报，修复后必须 `NO_PROVEN_BLOCKER`；completion 在 03 修复前不得硬拒。
5. **「目标站得住」不是判据**：运行时只要求 overlap；`gate-midair-jumpthrough` / `chest-midair-jumpthrough` 必须不报。
6. **出生点口径**：纯盒重叠会误伤 11/20；矩阵只用窄口径 `spawn-deep-terrain` 作负例，`baseline-last-train` 作合法边界；`spawn-no-foothold` 落 `INSUFFICIENT_EVIDENCE`。
7. **chest 几何归 03**：`chest-sealed-in-solid` 报 `PLAYABILITY_SPATIAL_CHEST_BLOCKED`；completion 不重复报。

## 4. 运行与验证

```bash
node .scratch/level-playability-v1/fixtures/07-matrix/07-build-matrix.mjs
# 退出 0；重新生成 fixtures 与 matrix.json
```

- 每个 fixture 已用 `parseGameConfig` 校验；解析失败会在生成时打印并退出非零（本次无失败）。
- 五份探针证据：`03-spatial-probes.mjs`、`04-synthetic-probe.mjs`、`05-completion-probe.mjs synthetic`、`04-hazard-mask-corpus.mjs`、`04-patrol-probe.mjs`，均退出 0。
- 这份矩阵不是生产测试；09 实施时应把对应用例转成生产测试（本图不做）。

## 5. 边界

- 不写生产测试、不改 `packages/**`。
- 不扩大到 03–05 未裁定的判据。
- 合成负例通过 ≠ 真实关卡可玩性已验证；零误伤基线由 08 负责。
