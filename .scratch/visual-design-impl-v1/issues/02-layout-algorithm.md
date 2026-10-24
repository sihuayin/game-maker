# 02. 确定性纯结构布局算法（含桶→EntityKind 映射裁定）

Type: grilling
Status: open
Owner: —
Blocked by: 01
Map: ../map.md

## Question

钉死并实现「纯结构确定性布局」：`GameDesignSpec`（player + 4 桶，**零几何**）→ VDS `objects[]`（带 role/bounds/layer/
fill/sourceIntent）+ background/ui 合成。这是本图最硬的一块，也是唯一**不预先锁死**的映射所在。

**先裁、再写码（HITL）**：

1. **桶→EntityKind 映射**（本票的核心裁定，用户点名不锁死）：设计 4 桶 `enemies/npcs/interactables/resources`
   （`game-design.ts:169-172`）要映射到 7 值 `EntityKind` `solid/pickup/hazard/goal/chest/danger/decor`
   （`game-config.ts:50`）。`enemies`/`interactables` 较直观，但 **`npcs`、`resources` 未必有一一对应**。
   必须**先按真实 `EntityKind` 定义**确定映射；**无法可靠映射的要明确处理**（如：某桶不进 VDS？或归入一个
   显式声明的「装饰」类？），**不能为了过票 07 的 `role↔kind` 判据而随意选值**。裁定时对照
   `CONTEXT.md`「实体 vs 地形」「装饰」的既有分界，以及 `INTENT_ENTITY_TYPES` / `ENTITY_BUCKETS`
   （`vocabulary.ts:162` / `:172-177`）。
2. **摆放规则（纯结构）**：只读 player + 桶 + id + 桶内顺序 + 计数 + 静态规则；**不解读** `world.structure` /
   `levels[].layout` / 实体自由文本（Q6）。摆放必须**非退化**：默认坐标不全部重叠、增删一个实体不搅乱既有 id 的
   身份映射、逐字节确定。摆放不必「好看」，但必须有效、可验证、非退化（约束 #2）。
3. **layer 规则**：`background` < 实体（按桶的确定 z 序）< `ui-panel`/`ui-pip`。
4. **fill:palette:N**：按桶/role 固定 palette 下标（background 用 `style.palette` 里背景桶的色，`PALETTE_BUCKETS`
   `visual-world.ts:146`）。
5. **合成对象**：恒出 `background` 全画布 rect + `ui-panel`/`ui-pip`；**无 `sourceIntent` 的纯装饰不进实体覆盖分母**
   （票 04 的 `S=D` 集合只算带 `sourceIntent` 的）。

**实现**（票 01 schema 之上）：`packages/visual-design/src/layout.ts` 导出 `layoutVds(design, vws): VisualDesignSpec`
（纯函数，同输入逐字节同输出）。**测试**（TDD，约束 #2 的六条）：同输入重复生成逐字节一致；每设计实体 ≥1 object；
默认坐标不重叠；增删实体不搅乱 id 映射；特殊角色 vs 七值边界；background/实体/UI 的 layer 有序。

裁定落 `## Answer`；映射表 + 摆放规则 + 非退化保证一并写进去。
