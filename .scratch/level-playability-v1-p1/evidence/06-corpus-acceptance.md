# LP-06 历史语料与负例验收

- **Date**：2026-11-06
- **Baseline**：`wayfinder/level-playability-v1`（LP-05 `ca096cf` 之后）
- **性质**：只读回归。未修改 `run/**` / `pack/**` / `site/**` / `fixtures/**` 或既有验收证据；零模型调用、零生图、零站点重建。
- **冻结输入**：`inventory.json` `sha256:25e6c891…`（脚本内复算通过）。
- **脚本**：
  - `acceptance-corpus.mjs`（exit 0）→ `evidence/06-corpus-regression.json`
  - `acceptance-matrix.mjs`（exit 0）→ `evidence/06-matrix-acceptance.json`

---

## 1. 冻结语料全量回归

### 1.1 口径

06 inventory 的 `usableForRejudgment` 条目（150 份 config），按 `(config contentHash, auditManifest 路径)` 去重为 **96 唯一配对**；按 config `contentHash` 去重为 **20 唯一 config**。同一 `(config contentHash, manifest contentHash)` 只跑一次（31 个唯一内容组合）。

**结果（配对级）**：`PROVEN_UNPLAYABLE 36` · `INSUFFICIENT_EVIDENCE 36` · `NO_PROVEN_BLOCKER 24`（96 配对）。

**结果（唯一 config，排除 6 个 probe 夹具后 14 份）**：

| 分类 | 数量 | 说明 |
|---|---|---|
| 机制 A 历史真实缺陷 | **3** | `pickup-water-4` / `goal-1`；`scrap-4/5/6` / `gate-1`；`pickup-3` / `chest-1` / `gate` |
| 既有审计 error（非 playability） | 5 | 2 份 `objective.gate` 缺失 + 3 份 chest 引用错误；已有引用 / 自洽族负责 |
| playability `INSUFFICIENT_EVIDENCE` | 11 | 6 份移动 hazard（`moving-hazard-phase`）+ 5 份同时带既有审计 error 的 config |
| playability `NO_PROVEN_BLOCKER` | 0 | 14 份 level config 中无 |
| **新增 playability 误报** | **0** | — |

- **3 条历史真实缺陷全部被机制 A 识别**；不重发布旧 run/pack。
- **6 个 probe 夹具排除**：`hazard-contact`、`avoid-danger`、`collect-pickup`、`open-chest`、`__probe` / `__probe-timeout` 的 last-train 副本。
- **6 份移动 hazard 的 config** 落 `INSUFFICIENT_EVIDENCE`（`moving-hazard-phase`），不是不可玩；不追求检测率而牺牲确定性。
- **5 份既有审计 error 的 config**（gate 缺失 / chest 引用）不是新 playability 阻断；最终硬拒归引用族 / 自洽族。
- **零新增不可解释的 playability 误报。**

### 1.2 与研究阶段的对照

- LP-03 的 20 唯一 config 口径：4 个机制命中（3 历史 + 1 probe）、14 证据不足、2 层内无阻断；本次 96 配对 / 20 唯一 config 与之一致（probe 排除后 3 历史命中）。
- LP-02 的「空间 0 新增 / 0 修复」、LP-04 的「有效 gate no-walk = 0」结论保持；本次未改历史语料、未重发布旧产物。

---

## 2. 39 例矩阵全量执行

### 2.1 层内结果

生产夹具覆盖 39 例（spatial 23 / mechanic 6 / completion 10）。逐例记录空间 / 机制 / 完成性 verdict、coverage、evidence、gaps、完成性抑制。

**按“层内发现”统计**（每例取所属层的预期）：

| 层 | PROVEN | NO_PROVEN | INSUFFICIENT |
|---|---|---|---|
| spatial（23） | 13 | 8 | 2 |
| mechanic（6） | 3 | 1 | 2 |
| completion（10） | 1 | 7 | 2 |

**整关最终归因**（含跨层提升）应为 **19 PROVEN / 16 NO_PROVEN / 4 INSUFFICIENT**：

- #32 `two-one-way-branches`：空间层 gate 不可达 → 整关 PROVEN（完成性抑制为 `INSUFFICIENT`）。
- #39 `chest-overlapping-hazard`：机制层 A 封死 gate → 整关 PROVEN（完成性抑制为 `INSUFFICIENT`）。
- #21 / #22 由既有 `auditGameConfig` 硬拒。
- #19 / #20 / #25 / #29 为 4 个 `INSUFFICIENT`。

### 2.2 实际组合结果与差异

实际三层组合（`auditPlayability`：任一层 PROVEN ⇒ PROVEN；否则任一层 INSUFF ⇒ INSUFF；否则 NO_PROVEN）：

| verdict | 数量 |
|---|---|
| PROVEN_UNPLAYABLE | **19** |
| NO_PROVEN_BLOCKER | **9** |
| INSUFFICIENT_EVIDENCE | **11** |

7 个原本属于**空间层合法边界**的用例被机制层的 `moving-hazard-phase` gap 拉成 `INSUFFICIENT`：

`baseline-last-train`、`gap-40`、`wall-40`、`pickup-50`、`chest-inside-luggage-range30`、`pickup-on-luggage`、`target-at-edge`。

原因：这些 config 都带 `last-train` 的合法宽巡逻 `carriage`（`motion.cycle`）。LP-03 复核 Q4 已批准「巡逻 hazard 一律 `INSUFFICIENT_EVIDENCE`」；机制层无法证明玩家能在巡逻相位下安全通过。空间层对这些案例仍是 `NO_PROVEN_BLOCKER`，但整关组合把该覆盖缺口记为证据不足。

### 2.3 逐条修正说明

- **#4 `wall-100`**：矩阵把 goal `signal` 记成 `PICKUP_UNREACHABLE`；按 framework §5.1 应为 `GATE_UNREACHABLE`；同一堵墙也封死 `suitcase-2/3`。
- **#12 `chest-range-rescues`**：原研究只检查 chest；gate 在 100px 沟对面，空间层 gate 不可达。
- **#19 `spawn-deep-terrain`**：LP-00 复核推翻 P4 ⇒ `SPAWN_IN_TERRAIN` 只观察，`INSUFFICIENT_EVIDENCE`。
- **#28 `pickup-in-static-hazard`**：被包住的 pickup 仍是 gap；同一 64×48 hazard 封死其后 suitcase-3 / gate ⇒ 整关 PROVEN 归机制层。
- **#39 `chest-overlapping-hazard`**：完成性只报「收齐后到不了 gate」；同一 64×48 hazard 封死 gate ⇒ 整关 PROVEN 归机制层，完成性抑制。
- **#32 `two-one-way-branches`**：整关 PROVEN 归空间层（gate 被 x=180..200 全高墙阻断）；完成性抑制。
- **有效 gate no-walk = 0**（研究 05）保持；与跨层归因不冲突。

### 2.4 合法边界

- 所有矩阵负例的合法配对未被硬拒（`spatial` / `mechanic` / `completion` 各自的 legal pair 均为 NO_PROVEN 或 INSUFF，不产生 PROVEN）。
- 7 个被机制 gap 降级的合法边界**没有**变成 PROVEN；它们只是从 `NO_PROVEN` 变成 `INSUFFICIENT`（覆盖缺口），符合「不确定即 INSUFF、不硬拒合法设计」。

---

## 3. 验收差异（需要裁定）

LP-06 票据写的「整关最终分布 19/16/4」是**矩阵案例级预期**（空间 / 机制 / 完成性各自的层内预期 + #32/#39 跨层提升）。实际 `auditPlayability` 的组合分布是 **19 / 9 / 11**，差异恰好是 7 个带合法巡逻 hazard 的空间边界用例。

这不是新增误报，也不是判据回退；它是 LP-03 已批准的「巡逻 hazard 一律证据不足」在整关聚合里的直接结果。两条可选口径：

- **(A) 接受 19 / 9 / 11 为实际组合分布**，把 19/16/4 明确为**层内/案例级预期**（LP-06 表格保留两列）。不改判据、不改夹具。
- **(B) 收紧 `moving-hazard-phase` 的适用范围**（例如只有巡逻 hazard 与 target / 必经路径相交才降级），重跑矩阵；这属于 LP-03 语义变更，需要重新复核。
- **(C) 把 7 个合法边界从矩阵的「NO_PROVEN」预期改为「INSUFFICIENT」**，39 例分布按实际 19/9/11 重新登记；同样需要用户裁定。

**当前不修改任何判据、夹具或历史语料**；等待用户裁定 A/B/C。
