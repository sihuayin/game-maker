# 01. 补写 `docs/v2/00-overview.md` 与 `docs/v2/02-implementation-plan.md`

Type: task
Status: resolved
Owner: —
Blocked by: —
Map: ../map.md

## Question

两份文档**是空的**（0 字节，2026-10-01 10:05 创建），而 `docs/v2/03-claude-code.md` 开头的
「必须先阅读」恰恰列的就是它们 ⇒ V2 的施工说明**要求先读两份不存在的文档**。

R2 定了：**要补写**。这一票没有决定要做，只有一件事要做 —— **把这两份写出来**。

### 分工（Q6a 已定，照抄即可）

- **`00-overview.md` = 入口**。给「不看 `.scratch/` 的读者」（尤其是下一个 session）：
  这个东西**是什么** · **目标** · **明确不做** · **与 V1 的关系**（哪些 V1 结论仍然有效、
  哪些是本图要动的）。**不含决定。**
- **`02-implementation-plan.md` = 路线**。**阶段划分与顺序**（谁挡住谁），
  **每一行只写指向票的指针**，**不复述答案**。

### 素材在哪

- 终点与「不含」：`.scratch/game-maker-v2/map.md` 的 `## Destination`。
- 阶段与顺序：同文件里各张票的 `Blocked by:` 边（**这就是 `02` 的全部内容**）。
- 与 V1 的关系、明确不做：同文件的 `## Out of scope` + `R1–R16` 表。
- ⚠️ **V2 与 `docs/v2` 有 10 处出入**：`03-claude-code.md` 的字面**多处不采用**，
  以 map 的 R 表为准（`§11` · `§2/§8` · `§28` · `§33` · `§13/§14` · `§18` · `§24` · `§7/§18` · `§8`）。
  **`00-overview` 必须点出这件事**，否则下一个读 doc 03 的人会照着写错的实现。

### ⚠️ 唯一要小心的事

**不要写成第二份真相。** 决定只存一处（地图与各张票），这两份文档只放**指针**。
`pnpm check:links` 只查链接**通不通**，不查**对不对** —— 漂移了没人会知道，所以宁可少写。

## Answer

（待解）

---

## Answer

**⚠️ 2026-10-01 关票 —— 但不是我写的。**

两份文档**由人（本图的所有者）补写完成**，落盘时间同一天：
`00-overview.md` 6622 字节 · `02-implementation-plan.md` 8814 字节。
本票的**动作**（把两个空文件填上）已达成；⚠️ 但它们**不是从地图的 R 表推出来的**，
所以下面这份对账**才是这一票真正的产出**。

### ⚠️ 本票真正的产出：`docs/v2` 与地图 R 表的对账

#### A. 与已锁定的 R 正面冲突（5 处）

| # | doc 在哪说 | 与谁冲突 | 差在哪 |
|---|---|---|---|
| 1 | `02 Phase 0/7` 建 `packages/visual-memory/`（`world.ts`/`character.ts`/`material.ts`）· `00 §2.5` 列**七种 DNA** · `00 Principle 5` | **R11 / R14**（Q12 / Q16②） | 已明确**不建该包**；「Material DNA 等真有消费者再说」 |
| 2 | `02 Phase 19`：`out/<gameId>/` 是**扁平文件** + `assets/` + `asset-pack.json` + `playable/` | **R8**（Q9a） | 定的是 `run/v<N>/` + `pack/v<N>/` + `site/v<N>/`，**禁止覆盖** |
| 3 | `02 Phase 11/12` 把 profile 与 compiler 放进 **`packages/runtime/`** | **R12**（Q14a）+ 仓库实况 | 该包**不存在**（实际 `contracts/assets/demo/cli/mcp`）；且 R12 要求 profile **投影自外壳**、同源同算 |
| 4 | `02 Phase 13`：`qa/visual.ts` 检查 `style`/`palette`/`silhouette`/`composition`/`character`/`material`/`animation` | **R3**（Q13） | 那七项**全是观察**，不进判据 |
| 5 | `02 Phase 16`：修复含 **Config Regen** | **R13**（Q15a） | 第一阶段**只做资源级重生成** |

#### B. 地图上还没判、doc 先站了队（2 处）

| # | doc 在哪说 | 状态 |
|---|---|---|
| 6 | `02 §6.1`：碰撞体 → `procedural` | 这正是**票 11** 要判的那一对（[[地形]] 定义 vs §14）。doc 单方面先答了，票 11 照旧要判 |
| 7 | `00 §3` 架构图里有 **Runtime Planner**：`GameDesignSpec → Runtime Planner → RuntimeProfile` | ⚠️ 箭头是「**从设计派生 profile**」，与 R12 的「profile 是外壳的事实」**方向相反**。但 `02 Phase 4.2` 说「Game Design Compiler **必须选择** `platformer/v1`」—— 那个读法又**与 R12 兼容**。⇒ **doc 自己两处不一致，要一句澄清** |

#### C. doc 新加、地图完全没有（3 处）

| # | doc 在哪说 | 地图上的状态 |
|---|---|---|
| 8 | `02 §2.1` 输入 `{imagePaths: string[]}` · `00 §1`「Style Reference Image**(s)**」 | 地图把**多参考图**列在 `## Not yet specified`（「多图怎么合并**没有任何实测**」）⇒ doc 把它提到了 Phase 2 |
| 9 | `02 Phase 22`：「v1 → **migration** → v2」 | **R6 选的是「并存」，没选迁移** —— 这是第三条路 |
| 10 | `02 Phase 23` 的顺序列了第 18 项 **Benchmark** | **没有对应的 Phase**，而 Benchmark Suite 在 `game-creation-v1` 的 Out of scope 里 |

#### D. 笔误级（不冲突，但要修）

- `02 Phase 6/10` 说改 `packages/contracts/src/asset-recipe.ts` —— **该文件不存在**，是 `recipe.ts`。
- `00 §2.4` 的策略表有 **7** 个值（多了 `image-reference`），`01-contracts.md` §5 是 **6** 个。
- `02 Phase 1` 的版本串列了 5 条，**少了 `character-dna`**。
- `00 §8` 的期望资源里有 `background` / `midground` / `foreground` **三个**，而包里分层背景是**一个**
  `background` 资产的 `layers`（`CONTEXT.md:140-146`，一层一帧，帧名 `<资源 id>.<层名>`）。

#### E. ⚠️ 我自己的错（在图上，就地更正）

- **R11 的包数我算错了**：写的是「7 个（3 新 + 5 既有）」，按 Q12 的推荐图**实际是 9 个**
  （4 新：`vision` / `game-design` / `qa` / `pipeline`；5 既有：`contracts` / `assets` / `demo` / `cli` / `mcp`）。
  ⚠️ 而你答的「**7 包结构**」对不上这个数 —— 要确认是笔误还是另有所指。
  （`02 Phase 0/17` 自己则想要 **5 个新包**，含 `visual-memory`。）
  ⇒ **票 07 落地前必须先定这个数。**

### 待办

A、C 两组共 8 条**要人拍**（见地图 2026-10-01 的补记）。定完之后 A 组改 doc、C 组进图或出局，
D 组随手修，E 组改地图。
