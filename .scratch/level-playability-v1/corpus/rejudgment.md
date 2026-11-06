# Level Playability V1 — 历史语料重判

- **版本**：`level-playability-rejudgment/v1`
- **基线**：`main @ fa17c14`
- **语料清单**：`level-playability-corpus-inventory/v1` · `freeze=sha256:25e6c891cbb01e456433e104862bc9f03c8404f92fec10acdc93700aca00983d`（08 必须引用）
- **生成**：2026-11-05T04:03:12.137Z
- **脚本**：`corpus/08-rejudge.mjs`（退出 0）+ `corpus/evidence/*.json`
- **性质**：只读；未修改任何历史产物；零模型调用。

## 1. 口径

- 语料：06 的 `usableForRejudgment: true` 条目；按 `contentHash` 去重后 **96 个唯一配对 / 20 份唯一 config**。
- 旧 schema：`assetpack/v1–v3` 用只读归一化（`assets` 的 `id/kind/size/anchor`）；不把 parser 失败当不可玩。
- 合成 fixture：`.scratch/level-playability-v1/fixtures/07-matrix` 已从所有语料扫描中排除；机制 probe 夹具单列、不计入关卡基线。
- 不计入：缺 manifest / config 解析失败 / gate 缺失（归既有引用族）。

## 2. 逐判据结果

| 判据 | 语料结果 | 结论 |
|---|---|---|
| 空间（03） | 20 份唯一 config；新增 error **0**、修复 **0**；chest error 0；embedded 0 | `NO_PROVEN_BLOCKER` 基线保持 |
| spawn-in-terrain（窄口径） | 纯盒重叠 11 / 脚点 10；窄口径 **0** | 不误伤；浅锚点嵌入不报 |
| 机制 A（静止 hazard 禁区） | 4 个命中：真实缺陷 **3**、合法设计误伤 **0**、判据不稳 **0**、probe 排除 1；20 份中 9 份含静止 hazard | 见 §3；A 启用前需 03 walk 修复 |
| 机制 B（全高 danger 无安全窗口） | danger config 1 份；命中 **0** | 唯一 danger 是 probe 夹具且非全高；`INSUFFICIENT_EVIDENCE` |
| 完成性（05） | 96 配对 / 20 唯一；有效 gate 的 no-walk **0**；gate 缺失 2 唯一；chest 不可达 0 | 完成性不新增误伤；gate 缺失归引用族 |

### 三态分布（按 20 份唯一 config）

| 判据 | PROVEN_UNPLAYABLE | NO_PROVEN_BLOCKER | INSUFFICIENT_EVIDENCE | 不适用 / 排除 |
|---|---|---|---|---|
| 空间（03） | 0 | 20 | 0 | 0 |
| 机制 A（04） | 3 | 5（含静止 hazard、未命中） | 0 | 11 不含静止 hazard + 1 probe 排除 |
| 机制 B（04） | 0 | 0 | 1（唯一 danger 配置，probe/非全高） | 19 不含 danger |
| 完成性（05） | 0（有效 gate） | 18 可完成 | 0 | 2 gate 缺失（引用族） |

> ⚠️ **聚合口径**：以上是**逐判据**结果，不等于整关 `NO_PROVEN_BLOCKER`。按 framework §3.3，严格聚合会因 coverage 缺口落到 `INSUFFICIENT_EVIDENCE`：
> spawn-in-terrain 需 P4 profile；巡逻 hazard / moving-platform / 多 danger 未注册；completion 在 03 的 walk/clearance / moving-solid 修复前是 partial。
> 08 的结论只对「已执行判据没有误伤」负责，不声称整关已被证明可玩。

## 3. 机制 A 逐条解释

| 路径 | 关键静止 hazard | 实体 | 分类 | 原因 |
|---|---|---|---|---|
| `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/game-config.json` | hazard-spikes-1, hazard-spikes-2, hazard-current-1, hazard-spikes-3 | entity "pickup-water-4"<br>entity "goal-1" | true-defect | 静止 hazard 在唯一地面路径上；玩家宽 48 + hazard 宽 > jumpSpan 66，且 mask 无可绕行路 |
| `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/site/v1/game-config.json` | spike-1 | entity "scrap-4"<br>entity "scrap-5"<br>entity "scrap-6"<br>entity "gate-1" | true-defect | 静止 hazard 在唯一地面路径上；玩家宽 48 + hazard 宽 > jumpSpan 66，且 mask 无可绕行路 |
| `.scratch/p0-02-second-demo-v2/runs/09-probe-hazard/hazard-contact/config.json` | hazard-1 | entity "goal" | excluded-probe-fixture | 机制 probe 夹具，不是关卡；不计入历史语料基线 |
| `.scratch/visual-design-impl-v1/runs/2026-10-25-e2e-v4pro-promptfix/wasteland-scavenger/run/v1/game-config.json` | hazard-1 | entity "pickup-3"<br>entity "chest-1"<br>entity "gate" | true-defect | 静止 hazard 在唯一地面路径上；玩家宽 48 + hazard 宽 > jumpSpan 66，且 mask 无可绕行路 |

- **walk 复核**：08 把 04 的 hop-only 禁区模型加上 03 的 walk 边后，4 个命中的结果**不变**；这些命中不是 S6 低天花板误报。
- **真实缺陷判定**：玩家宽 48、`jumpSpan` 66；静止 hazard 的盒宽 + 玩家宽超过 66 时，平地无法跳过；mask 没有可绕行路 ⇒ 在 FixedRuntimeProfile 下是确定性阻断。
- **3 个真实缺陷会在 A 启用后新阻断 3 份历史产物**；这不是误伤，但 09/10 必须决定历史产物是否迁移或保留例外。
- **1 个 probe 夹具**（`09-probe-hazard/hazard-contact`）不是关卡，排除。

## 4. 覆盖缺口

- 06 标记不可用：2 份；`out/__probe/empty/site/v1/game-config.json`（structural-manifest-misses-refs, no-covering-manifest）；`packages/demo/fixtures/empty-world.json`（no-structural-manifest, no-covering-manifest）。
- 旧 schema：15 份可用 config 需要只读归一化；不计入 error。
- 结构未配对：6 份；结构配对缺引用：5 份；均已在 06 清单中记录。
- probe 夹具：`.scratch/p0-02-second-demo-v2/runs/09-probe-hazard/hazard-contact/config.json` 排除出关卡基线。

## 5. 零误伤结论

- 「既有合法设计被误伤」命中：**0**。
- 未解释的新增 error：**0**。
- 真实缺陷：**3**（mechanic A）；probe 夹具排除：1。
- ⇒ **零误伤基线成立**，但不是「新增 error = 0」：3 条真实缺陷是预期命中，09/10 必须为这 3 份历史产物决定迁移 / 例外；A 仍应在 03 的 walk/clearance 修复之后才作为硬拒上线（04 的前置条件）。

## 6. 与 07 的关系

合成矩阵证明判据会响、合法边界不误伤；本重判证明历史语料没有不可解释的误伤。两者都不能单独证明「真实关卡可玩性已验证」；09 的最小实施方案必须同时继承本基线与 07 的边界用例。
