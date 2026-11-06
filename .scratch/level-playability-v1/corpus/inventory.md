# Level Playability 历史语料清单

- **版本**：`level-playability-corpus-inventory/v1`
- **生成**：2026-11-05T03:07:53.694Z
- **基线**：`main @ fa17c14`
- **脚本**：`.scratch/level-playability-v1/corpus/06-inventory.mjs`（只读；exit 0）
- **冻结 hash**：`sha256:25e6c891cbb01e456433e104862bc9f03c8404f92fec10acdc93700aca00983d`（对 `inventory.json` 中不含 `freeze` 字段的 payload 计算）
- **机器可读**：`inventory.json`（08 必须引用本文件与上述 hash）

## 1. 口径

- **范围**：`out`、`fixtures`、`.scratch`、`packages/demo/fixtures`；跳过 `node_modules` / `.git` / `dist` 等。
- **横版 config**：`format === "game-config/v1"`；`td-config/*` 单独计数、不纳入。
- **结构配对**：先找 config 目录向上最近的 manifest（ancestor）；找不到时取共享路径前缀 ≥ 3 段的近邻 manifest（proximity）；同层优先 `manifest.id` 出现在 config 路径中，其次版本高、路径字典序。对应前序 134 对口径。
- **审计可用配对**：结构配对且 manifest 覆盖 config 的全部 asset 引用；否则全仓找覆盖且共享路径前缀最长的 manifest。
- **旧 schema**：`assetpack/v1–v3` 允许**只读归一化**（`assets` 的 `id/kind/size`），但标记 `requiresNormalization`；不把 parser 失败当不可玩。机器可读列表保留每条的 schema 与归一化标记。
- **design**：`format === "game-design/v1"`；`levels.length` 即关数；design↔config 仅记录共同路径前缀 ≥ 4 的候选，不做强制一对一。
- **去重**：按 JSON 内容 hash 分组；保留优先级 `out > fixtures > packages/demo/fixtures > .scratch`，同优先级按路径字典序。重复副本记 `duplicateOf`。

## 2. 计数

| 指标 | 值 |
|---|---|
| scannedJsonFiles | 5244 |
| parsedJsonObjects | 5243 |
| objectJson | 4930 |
| unreadableJson | 1 |
| horizontalConfigFiles | 152 |
| tdConfigFiles | 37 |
| uniqueHorizontalConfigs | 21 |
| manifestFiles | 171 |
| uniqueManifests | 107 |
| manifestsParsedCurrent | 90 |
| manifestsOldSchema | 81 |
| designFiles | 49 |
| designLevels | 77 |
| ancestorPairs | 114 |
| proximityPairs | 32 |
| structuralPairs | 146 |
| structuralUnpaired | 6 |
| coverageFallbackPairs | 37 |
| auditUsableConfigs | 150 |
| auditUsableUniquePairs | 96 |
| auditUnusableConfigs | 2 |
| duplicateConfigFiles | 131 |
| duplicateManifestFiles | 64 |
| duplicateDesignFiles | 22 |

### manifest schema 分布

| format | 数量 |
|---|---|
| assetpack/v2 | 66 |
| assetpack/v4 | 90 |
| assetpack/v1 | 13 |
| assetpack/v3 | 2 |

### 来源分布

| 来源 | configs | manifests | designs |
|---|---|---|---|
| out | 28 | 76 | 0 |
| fixtures | 1 | 2 | 1 |
| packages/demo/fixtures | 1 | 0 | 0 |
| scratch | 122 | 93 | 48 |

### 覆盖缺口原因分布（按 config 文件计，可多重）

| 原因 | 数量 |
|---|---|
| no-structural-manifest | 6 |
| structural-manifest-misses-refs | 5 |
| no-covering-manifest | 2 |
| manifest-old-schema | 15 |

> 说明：`manifest-old-schema` 不等于不可用；它表示该 config 的审计 manifest 需要只读归一化（全仓 81 份 manifest 是旧 schema，其中 15 份被当前可用 config 选用）。`structural-manifest-misses-refs` 表示结构配对存在但当前审计引用解析不上，是 08 必须逐条解释的覆盖缺口。

## 3. 与前序事实的对照

| 前序口径 | 本清单 | 差异解释 |
|---|---|---|
| 151 份 `game-config/v1`（B 类审计） | 152 | 两次审计之间多 1 份；本清单按当前工作树扫描，未逐文件归因这 1 份，不影响可用配对。 |
| 134 对 config+manifest | 结构配对 146 对（ancestor 114 + proximity 32） | 覆盖前序 134 对；proximity 口径更宽，且涵盖新增的 probe / negative 产物。审计可用 150 份 / 唯一 96 对与 02 一致。 |
| 117 份配对 config（D 类审计） | 审计可用 150 份（唯一 96 对） | D 类只统计更窄的配对子集；本清单同时保留结构配对与审计可用两层口径。 |
| 49 份设计 / 77 关 | 49 份 / 77 关 | 一致。 |
| 171 份 manifest；81 份非 v4 | 171 份；非 v4 81 | 与 02 基线一致（v1 13 · v2 66 · v3 2）。 |

## 4. 使用规则（08 必须遵守）

1. 重判只引用 `inventory.json` 中 `usableForRejudgment: true` 的 config。
2. 旧 schema manifest 只能用只读归一化读取；若 08 决定不接受归一化，必须把对应 config 记入覆盖缺口，不得静默排除。
3. 同一 `contentHash` 的重复 config 只重判保留副本一次；重复副本可用于交叉校验，不重复计数。
4. 任何新增 error 必须按 config `path` + `sha256` 定位；不得只报总数。
5. 本清单生成后只读；更新清单必须重新生成并记录新 `freeze.value`。

## 5. 已知边界

- 不覆盖塔防 `td-config/v1`（37 份，单独计数）。
- 不做设计语义 / 布局对账；design 仅作为来源与关数统计。
- 不判断 config 是否可玩；只提供语料事实。
- 扫描是只读的：未修改、移动、重命名任何历史产物。
