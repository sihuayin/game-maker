# 合成负例与合法边界矩阵

Type: task
Status: resolved
Owner: amber (agent) · 2026-11-05
Blocked by: 03, 04, 05
Map: ../map.md

## Question

根据 03–05 的候选判据，设计**合成负例 + 合法边界**的最小测试矩阵，证明判据会响且不误伤。只做矩阵与 scratch fixture，不实现生产判据。

### 必须覆盖的负例（至少）

- 沟壑造成必经路线中断；
- 台阶/落脚点使跳跃无法完成；
- 巡逻 hazard 封死唯一通路；
- 危险区不存在可通过的安全窗口；
- 必需拾取物被地形或机制封死；
- 目标位置无法到达或不可站立；
- 出生点卡在实心体内；
- 实体/目标越界。

### 每个用例必须给出

1. 最小 fixture（scratch 下的 config + manifest；标注「非生产」）；
2. 预期判定：`PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER`；
3. 预期判据 id、失败定位字段；
4. 合法边界配对：同一判据下的「合法但接近阈值」用例，预期 `NO_PROVEN_BLOCKER`；
5. 与历史语料的区分：合成负例只证明判据会响，不替代 08 的零误伤基线。

### 输出

- `../test-matrix.md`（矩阵 + 预期结果 + 定位字段）。
- `../fixtures/**` 下的 scratch fixture（明确标注非生产）。
- 本票 `## Answer` 摘要；更新 map 的 Decisions so far。

### 边界

- 不写生产测试、不改 `packages/**`。
- 不把矩阵规模扩大到 03–05 未裁定的判据。
- 不声称合成负例通过就等于真实关卡可玩性已验证。

## Answer

完成 2026-11-05。矩阵与 fixture 均为 scratch 非生产产物；未修改 `packages/**`，未新增生产测试。

### 产物

- [test-matrix.md](../test-matrix.md)：39 个用例的矩阵、预期结果、失败定位、合法边界配对。
- [fixtures/07-matrix/](../fixtures/07-matrix/)：每例 `game-config.json` + `manifest.json` + `META.json`；`README`/矩阵头部明确标注**非生产**。
- `fixtures/07-matrix/matrix.json`：机器可读矩阵。
- `fixtures/07-matrix/evidence/{03,04,05,04-corpus,04-patrol}.json`：五份探针证据，均退出 0。
- `fixtures/07-matrix/07-build-matrix.mjs`：生成器；断言所有 fixture 可被 `parseGameConfig` 解析。

### 规模

| 维度 | 数量 |
|---|---|
| 用例总数 | 39 |
| `PROVEN_UNPLAYABLE` | 17 |
| `NO_PROVEN_BLOCKER` | 18 |
| `INSUFFICIENT_EVIDENCE` | 4 |
| spatial / completion / mechanic | 23 / 10 / 6 |

### 必须覆盖项

- 沟壑中断：`gap-200`（合法 `gap-40`）。
- 台阶 / 落脚点跳跃失败：`wall-100` / `pickup-120`（合法 `wall-40` / `pickup-50`）。
- 巡逻 hazard 封死：`wide-patrol` → **`INSUFFICIENT_EVIDENCE`**（04 裁定不可证；整段扫掠当实心会误伤，语料 1 个 config 新增 4 条误报）。
- danger 无安全窗口：`danger-full-wall`（合法 `danger-wide-idle`）。
- 必需收集物封死：`pickup-inside-luggage` / `chest-sealed-in-solid` / `pickup-in-static-hazard`；地形/实心体可证，hazard 包住只落 `INSUFFICIENT_EVIDENCE`。
- 目标不可到达 / 不可站立：`goal-inside-luggage`（`GATE_BLOCKED`）与 `gate-midair-jumpthrough`（合法；只要求 overlap）。
- 出生点卡实心体：`spawn-in-solid`（既有 `auditGameConfig`）；`spawn-deep-terrain`（新窄口径）；`spawn-no-foothold` → `INSUFFICIENT_EVIDENCE`。
- 实体 / 目标越界：`target-out-of-world`（既有 `auditGameConfig.inWorld`；合法 `target-at-edge`）。

### 矩阵里钉住的裁定

1. 巡逻 hazard、被 hazard/danger 包住的收集物、moving-platform 都不产确定性 error，预期 `INSUFFICIENT_EVIDENCE`。
2. 低天花板可走走廊、moving solid 扫掠区是合法边界；03 修复后必须 `NO_PROVEN_BLOCKER`；completion 在修复前不得硬拒。
3. 「目标站得住」不是判据；运行时只要求 overlap。
4. spawn 纯盒重叠会误伤 11/20，矩阵只用窄口径负例；`FixedRuntimeProfile` 未写入 spawn 分离语义时降为 `INSUFFICIENT_EVIDENCE`。
5. chest 几何归 03；`chest-sealed-in-solid` 报 `PLAYABILITY_SPATIAL_CHEST_BLOCKED`，completion 不重复报。

### 验证

- 39 个 fixture 全部通过 `parseGameConfig`；生成器无解析失败。
- 五份探针均退出 0；矩阵 `evidenceMisses` 为空。
- 04 语料探针（排除合成 fixture 后）：静态 hazard 禁区模型在 20 份唯一 config 上 **4 个命中**；巡逻扫掠朴素模型 **1 个 config 新增 4 条误报**——两者都交 08 逐案裁定。
- 已给 03–06 的语料扫描脚本加入 `.scratch/level-playability-v1/fixtures/07-matrix` 排除，合成 fixture 不会污染 08 的历史语料口径。

### 边界

- 合成负例只证明判据会响、合法边界不误伤；**不替代** 08 的历史语料零误伤基线。
- 不写生产测试、不改 `packages/**`、不扩大到 03–05 未裁定的判据。
