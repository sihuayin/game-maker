# Codebase Facts — 实体身份稳定性 V1 (recon)

Read-only recon，2026-10-25。每条都带 `file:line` 引用，路径相对 `/Volumes/shy/some-projects/game-maker/`。
驱动 `.scratch/entity-identity-v1/map.md` 的规划；PRD = `docs/v7.1/稳定.md`。

---

## 1. 身份改写源头（已定位）

`compileRuntime` = `packages/assets/src/ops.ts:1004`。它**不是**确定性编译，是**LLM 编译**：
把 GameDesignSpec + 资源包清单喂给 `deepseek-v4-pro`（`ops.ts:1112`），模型填一份 `game-config/v1`
（`ConfigToolSchema`）。

- 提示词（`ops.ts:1046-1117`）**没有要求模型保留设计实体 id** —— 它只要求 `id` 不重复
  （铁律 7）、`kind` ∈ 封闭枚举（铁律 5）、`gate` 指向 goal（铁律 7），对「id 从哪来」**只字未提**。
- ⇒ 模型自造 `kind` 前缀序号 id（`pickup-1` / `hazard-1` / `enemy-1` / `chest-1` / `block-1`）。
- 设计实体 id 清单**已经**进了提示词：`designBrief(d)`（`packages/assets/src/prompt.ts:850`）
  把四桶每个实体的 `id` 逐条列出来（`enemy-wasteland` 等），只是没要求模型**沿用**。

## 2. GameDesignSpec 侧的实体 id（稳定、已沿意图层）

`packages/contracts/src/game-design.ts`：

- `Id = z.string().min(1)`（`game-design.ts:74`）—— 开放字符串，唯一身份类型。
- 四桶（`game-design.ts:169-172`）每实体 `{ id, … }`：
  `enemies{id,behavior,threat}` · `npcs{id,role,interaction}` · `interactables{id,type,behavior}` · `resources{id,purpose}`。
- 桶 `id` **沿用意图层而非改名**（`game-design.ts` 四桶上方的长注释，票 03 Q2(b)）：
  意图→设计已要求「沿用而非改名」，改名会被 `auditIntentCoverage` 抓「缺了 X」。
- superRefine 有 **id 唯一**检查（`game-design.ts:296-307`，player + 四桶跨桶查重）。
- **无几何**：所有实体字段是 id + 自由文本，无 x/y/w/h（几何只在下游 GameConfig）。

## 3. GameConfig 侧的实体 id（自由、只查唯一）

`packages/contracts/src/game-config.ts`：

- `Entity = { id: z.string().min(1), kind: EntityKind, at, asset, anim?, body?, motion?, range?, strike? }`
  （`game-config.ts:88-100`）—— **`id` 无命名约束**，只要求非空。
- superRefine 查 **id 唯一**（`game-config.ts:222`）、`danger` 必带 `strike`（`game-config.ts:226`）。
- `EntityKind` 7 值：`solid/pickup/hazard/goal/chest/danger/decor`（`game-config.ts:50`）。
- **无 `sourceIntent` / 回指设计 id 的字段**。`asset` 字段引资源包资产名（**常常**等于设计实体 id，
  但有歧义：见 §4）。

## 4. 真实 E2E 的设计→config 映射（非 1:1）

样本 = `.scratch/visual-design-impl-v1/runs/2026-10-25-e2e-v4pro-promptfix/wasteland-scavenger/run/v1/`。

| 设计桶实体 (id) | config 实体 (id · kind · asset) | 关系 |
|---|---|---|
| `enemy-wasteland` (enemies) | `enemy-1` · hazard · enemy-wasteland | 1:1 改名 |
| `chest` (interactables) | `chest-1` · chest · chest | 1:1 改名 |
| `danger-hazard` (interactables) | `hazard-1` · hazard · danger-hazard | 1:1 改名 |
| `resource-pickup` (resources) | `pickup-1/2/3` · pickup · resource-pickup | **1:N** |
| `scavenger` (player) | 顶层 `player`（非 entity） | 不进对账（票 07） |
| —（无设计对位） | `block-1/2` · solid · ground-tile | **孤儿** |
| —（无设计对位） | `gate` · goal · chest | **孤儿** |

- **1:1 改名**、**1:N**（resource → 3 个 pickup 实例）、**孤儿**（地面 solid、终点 goal）三种都有。
- `asset` 名**多数**等于设计实体 id，但**有歧义**：`chest-1` 与 `gate` 都用 `asset: "chest"`，
  而 `gate` 不是 `chest` 设计实体；`block-*` 的 `asset: "ground-tile"` 根本不是设计实体。
  ⇒ `asset` 名**不能**当身份信号（Q2 裁 (c)：只验真、不靠 asset 回填）。

## 5. VDS 侧（已干净）

`.scratch/…/run/v1/visual-design.json`：每个设计实体一个 object，`sourceIntent` = 设计 id
（`scavenger` / `enemy-wasteland` / `chest` / `danger-hazard` / `resource-pickup`）；`background` /
`ui-panel` / `ui-pip` 无 `sourceIntent`（纯装饰）。VDS 契约见 `packages/contracts/src/visual-design.ts`
（object `sourceIntent?`）。

## 6. QA 第 7 判据的当前 join（缺口现场）

`packages/qa/src/visual.ts:204` `visualConfigCoherence`：

```ts
const entityOf = new Map(config.entities.map((e) => [e.id, e]));  // visual.ts:219
const ent = entityOf.get(obj.sourceIntent);                        // visual.ts:229 —— 按 id 查
if (ent === undefined) → "VDS 里 X（桶）在 GameConfig 里不存在" error
```

join 键是 `config.entity.id === vds.sourceIntent`。而 config id 被改名（§1），⇒ E2E 报 4 条硬失败
（`enemy-wasteland` / `chest` / `danger-hazard` / `resource-pickup` 全部「不存在」）。

## 7. 修复面（Q1=(a) · Q2=(c) 已裁）

- config `Entity` 加 `sourceIntent?: z.string().min(1)` 回指设计 id（可选，孤儿不带；不唯一，1:N 共享）。
- `compileRuntime` 提示词要求模型逐实体声明 `sourceIntent`。
- 编译期确定性验真：每个设计实体（player 除外）→ ≥1 config `sourceIntent`；每个 config `sourceIntent`
  → 真实设计 id；孤儿合法。硬失败进重采样循环（仿 `auditGameConfig` modelHard，`ops.ts` 循环内）。
- QA `visualConfigCoherence` join 键 `id` → `sourceIntent`，`entityOf` 改 `Map<sourceIntent, entities[]>`。

## 8. 连带（不需改、但要验证不破坏）

- config 契约是 `z.strictObject`（`game-config.ts`）—— 加一个**声明过的可选键**不破坏严格解析；
  下游 `packages/demo` 读 `id/kind/at/asset`，不读 `sourceIntent`，不受影响。
- config `id` 唯一检查（`game-config.ts:222`）**只看 id 不看 sourceIntent**，无需改。
- `player` 是 config 顶层字段、非 entity，不进对账（票 07 已裁），本图沿用。
