# 历史语料重判

Type: task
Status: resolved
Owner: amber (agent) · 2026-11-05
Blocked by: 03, 04, 05, 06
Map: ../map.md

## Question

把 03–05 的候选判据应用到 06 的历史语料清单，产出**零误伤基线**：新增 error 数量、逐条解释、覆盖缺口。不得修改语料。

### 必须交付

1. **执行方式**：在 `.scratch/level-playability-v1/` 下写一次性分析脚本（不进入 `packages/**`），或逐条人工复核；记录命令、退出码、路径。
2. **逐判据结果**：每条判据在语料上的命中数、`PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 分布。
3. **逐条解释**：每条新增 error 的路径、实体、原因、是否可解释；不得只报总数。
4. **覆盖缺口**：06 标记为不可用的条目，逐条说明为什么不可重判。
5. **误伤判定**：把新增 error 分为「真实缺陷 / 既有合法设计被误伤 / 判据不稳」；对「既有合法设计被误伤」给出反例与修正建议（不实施）。
6. **零误伤结论**：只有「无不可解释的新增误伤」才算通过；有误伤则回到 03–05 修正判据，不得进入 09。
7. **旧 schema 边界**：引用 06 的归一化 / 排除口径；parser 失败与缺 manifest 的条目不得计入新增 error，必须单列。

### 输出

- `../corpus/rejudgment.md` + `../corpus/rejudgment.json`（或等价）。
- 本票 `## Answer` 摘要；更新 map 的 Decisions so far。

### 边界

- 只读语料；不修改历史产物。
- 分析脚本不得进入生产包；不得新增依赖（除非另行审批）。
- 不把「新增 error 为 0」直接当作判据有效；必须结合 07 的合成负例。

## Answer

完成 2026-11-05。只读重判；未修改历史产物；零模型调用。

### 产物

- [corpus/rejudgment.md](../corpus/rejudgment.md)：逐判据结果、逐条解释、覆盖缺口、零误伤结论。
- [corpus/rejudgment.json](../corpus/rejudgment.json)：机器可读摘要。
- `corpus/08-rejudge.mjs`：汇总脚本；`corpus/08-mechanic-walk.mjs`：机制 A 的 walk 复核。
- `corpus/evidence/*.json`：03–05 语料探针与 walk 复核的原始输出，均退出 0。

### 语料口径

- 引用 06 冻结清单：`level-playability-corpus-inventory/v1`，`freeze=sha256:25e6c891cbb01e456433e104862bc9f03c8404f92fec10acdc93700aca00983d`（脚本已复算一致）。
- 去重后 **96 个唯一配对 / 20 份唯一 config**；重复副本不重复计数。
- 旧 schema（81 份 manifest；15 份可用 config 选用）只读归一化；parser 失败 / 缺 manifest 不计入新增 error。
- 07 的合成 fixtures 已从所有语料扫描排除；机制 probe 夹具单列。

### 逐判据

| 判据 | 结果 |
|---|---|
| 空间（03） | 20 份唯一 config；新增 **0**、修复 **0**；chest 0、embedded 0、noSeed 0。spawn 纯盒重叠 11 / 脚点 10，窄口径 **0**（浅锚点嵌入不报）。 |
| 机制 A（04） | 4 个命中：**3 个真实缺陷**（run-out-2026-10-13h / run-out-2026-10-18a / visual-design-impl），**0 个合法设计误伤**，0 个判据不稳；1 个 probe 夹具排除。加 03 walk 边后命中不变。 |
| 机制 B（04） | 0 命中；语料唯一 danger 是 probe 夹具且非全高墙 ⇒ `INSUFFICIENT_EVIDENCE`。 |
| 完成性（05） | 96 配对 / 20 唯一；有效 gate 的 no-walk **0**；8 个配对的 no-walk 全部 gate 缺失（2 份唯一），归既有引用族；chest 不可达 0。 |

### 逐条解释（机制 A）

3 个真实缺陷都在唯一地面路径上有静止 hazard；玩家宽 48、`jumpSpan` 66，hazard 盒宽 + 玩家宽 > 66 时平地无法跳过，且 mask 无可绕行路：

- `run-out-2026-10-13h`：`hazard-spikes-1/2` + `hazard-current-1` + `hazard-spikes-3` 簇 ⇒ `pickup-water-4`、`goal-1`。
- `run-out-2026-10-18a`：`spike-1` 64×20 ⇒ `scrap-4`、`scrap-5`、`scrap-6`、`gate-1`。
- `visual-design-impl`：`hazard-1` 32×32 ⇒ `pickup-3`、`chest-1`、`gate`。

`p0-02/09-probe-hazard/hazard-contact` 是机制 probe 夹具，不是关卡，排除。

### 覆盖缺口

- 06 不可用 2 份：`out/__probe/empty/site/v1/game-config.json`、`packages/demo/fixtures/empty-world.json`（均无覆盖 manifest）。
- 旧 schema 15 份可用 config 需只读归一化；结构未配对 6 份、结构配对缺引用 5 份，均在 06 清单中逐条记录。
- strict 聚合下，spawn profile / 巡逻 hazard / moving-platform / completion 的 03 前置修复仍使 coverage 为 partial ⇒ 整关 verdict 应为 `INSUFFICIENT_EVIDENCE`，不是 `NO_PROVEN_BLOCKER`。

### 零误伤结论

- 「既有合法设计被误伤」：**0**；未解释的新增 error：**0**。
- **零误伤基线成立**，但不是「新增 error = 0」：3 条真实缺陷是预期命中；A 启用后这 3 份历史产物会被新阻断，09/10 必须决定迁移或保留例外。
- A 仍须在 03 的 walk/clearance 修复之后才作为硬拒上线（04 的前置条件）；08 只对「已执行判据没有误伤」负责，不声称整关已被证明可玩。
