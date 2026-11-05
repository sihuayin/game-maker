# 历史语料清单、去重与覆盖缺口

Type: task
Status: resolved
Owner: amber (agent) · 2026-11-05
Blocked by: —
Map: ../map.md

## Question

建立 Level Playability 历史语料的**可复核清单**，为「零误伤基线」提供口径。不得修改语料。

### 必须交付

1. **候选范围**：`out/**`、`fixtures/**`、`.scratch/**` 中与横版 `game-config/v1` 相关的 config / manifest / design 对；至少覆盖前序事实中的 134 对 config、77 关设计。
2. **配对规则与旧 schema 口径**：config 与其 manifest 的配对方式；缺 manifest、缺 config、格式不匹配、历史失败 run 的处理；171 份 manifest 中 81 份不是 `assetpack/v4`（v1 13 · v2 66 · v3 2），必须明确旧 schema 的归一化 / 迁移 / 排除方式，不能把 parser 失败当成不可玩；逐项记录为覆盖缺口，不静默丢弃。
3. **去重**：按内容 hash 去重（config / manifest / 组合），列出重复副本与保留规则。
4. **清单**：每条记录路径、sha256、format、配对状态、来源（fixtures / out / scratch）、是否可用于重判。
5. **计数**：总数、可用数、不可用数、覆盖缺口原因分布。
6. **冻结**：清单生成后只读；08 重判必须引用本清单的版本/hash。

### 输出

- `../corpus/inventory.md` + `../corpus/inventory.json`（或等价机器可读文件）。
- 本票 `## Answer` 摘要；更新 map 的 Decisions so far。

### 边界

- 只读；不修改、不移动、不重命名历史产物。
- 不裁定判据；只提供语料事实。
- 不含塔防语料（Q3 已限定横版）。

## Answer

完成 2026-11-05。只读、零付费；未修改、移动或重命名任何历史产物。

### 产物

- [corpus/inventory.json](../corpus/inventory.json)：机器可读清单（冻结）
- [corpus/inventory.md](../corpus/inventory.md)：口径与计数摘要
- [corpus/06-inventory.mjs](../corpus/06-inventory.mjs)：生成脚本（`node .scratch/level-playability-v1/corpus/06-inventory.mjs`，退出 0）

### 冻结

- 版本：`level-playability-corpus-inventory/v1`
- `freeze.value`：`sha256:25e6c891cbb01e456433e104862bc9f03c8404f92fec10acdc93700aca00983d`
  （对 `inventory.json` 中不含 `freeze` 字段的 payload 计算，已复算一致）
- `inventory.json` 文件 hash：`sha256:ba1d051a401ac70f45be5a705e2c478961ffc3fc0a6c9feb4cde09365df5f74f`
- **08 必须引用上述版本 + `freeze.value`**；任何新增 error 必须按 config `path` + `sha256` 定位。

### 计数

| 指标 | 值 |
|---|---|
| 扫描 JSON / 成功解析 / 不可解析 | 5244 / 5243 / 1 |
| 横版 `game-config/v1` 文件 / 唯一内容 | 152 / 21 |
| `td-config/*`（单独计数、不纳入） | 37 |
| manifest / 唯一内容 | 171 / 107 |
| `assetpack/v4`（当前 parser 可解析） | 90 |
| 旧 schema（v1 13 · v2 66 · v3 2） | 81 |
| 设计 / 唯一内容 / 关数 | 49 / 27 / 77 |
| 结构配对（ancestor 114 + proximity 32） | 146 |
| 结构未配对 | 6 |
| 审计可用 config / 唯一配对 | 150 / 96 |
| 审计不可用 | 2 |
| 重复 config / manifest / design 文件 | 131 / 64 / 22 |

### 配对规则

- **结构配对**：先找 config 目录向上最近的 manifest（ancestor）；找不到时取共享路径前缀 ≥ 3 段的近邻 manifest（proximity）。同层优先 `manifest.id` 出现在 config 路径中，其次版本高、路径字典序。146 对覆盖前序 134 对口径。
- **审计可用配对**：ancestor 覆盖 config 全部 asset 引用；否则全仓找覆盖且共享路径前缀最长的 manifest（coverage fallback）。150 份 / 96 唯一对与 02 一致。
- **design**：共同路径前缀 ≥ 4 层的 config 记为候选，不做强制一对一。

### 旧 schema 与覆盖缺口

- 81 份旧 manifest 用只读归一化（`assets` 的 `id/kind/size`）读取；其中 15 份被当前可用 config 选用，标记 `requiresNormalization: true`，**不把 parser 失败当不可玩**。
- 6 份无结构配对：2 份 negative-gate 夹具、2 份 probe-timeout、`fixtures/game-configs/last-train.json`、`packages/demo/fixtures/empty-world.json`。
- 覆盖率缺口分布（按 config 文件计，可多重）：`no-structural-manifest` 6 · `structural-manifest-misses-refs` 5 · `no-covering-manifest` 2 · `manifest-old-schema` 15。
- 2 份审计不可用：`out/__probe/empty/site/v1/game-config.json`（无覆盖 manifest）、`packages/demo/fixtures/empty-world.json`（同上），与 02 一致。

### 去重

按 JSON 内容 hash 分组；保留优先级 `out > fixtures > packages/demo/fixtures > .scratch`，同优先级按路径字典序；重复副本在 JSON 中记 `duplicateOf`。08 对同一 `contentHash` 只重判保留副本一次。

### 边界

- 不含塔防语料；不做设计语义 / 布局对账；不判断 config 是否可玩。
- 清单生成后只读；更新必须重新生成并记录新 `freeze.value`。
