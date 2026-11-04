# 历史语料清单、去重与覆盖缺口

Type: task
Status: open
Owner: —
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
