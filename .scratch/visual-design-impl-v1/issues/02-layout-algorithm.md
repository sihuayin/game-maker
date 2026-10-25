# 02. 确定性纯结构布局算法（含桶→EntityKind 映射裁定）

Type: grilling
Status: resolved
Owner: claude (2026-10-24 · resolved)
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

## Answer

已裁定并落码（2026-10-24，HITL）：

- **Q1（命门）**：保留 11 值 role 枚举；`role` 定位成「**视觉分组默认**」，不是身份断言。identity 判据改「设计桶↔kind
  家族」——精确枚举表已写入 [票 07](07-qa-crosscheck.md)。铁证：wasteland 真夹具 `interactables` 一桶既有 chest 又有
  hazard，桶→EntityKind 不是 1:1，结构化字段无 kind 信号，确定性布局读不到。
- **Q2 摆放**：分栏 + 固定地面线（稳定序 player→enemies→npcs→interactables→resources，桶内原序）；容量检查
  （栏宽 < 实体最大宽即抛错）。player 24×40，非 player 16×16。
- **Q3 layer**：background=0 · 实体=10 起 +1 递进 · ui-panel=100 · ui-pip=110。
- **Q4 fill**：role→语义色板桶（background→background · player→primary · ui→highlight · 其余→secondary/accent）；
  空桶回退 `palette:0`（空色板抛错）。
- **Q5 合成**：恒出 background（全画布）+ ui-panel + ui-pip，无 sourceIntent（不进覆盖分母）。
- **实现**：`packages/visual-design/src/layout.ts` 导出 `layoutVds(design, vws, viewport)`。⚠️ 比票面多一个
  `viewport` 参数——「视口不是数据」，由票 06 compile 入口注入壳 VIEWPORT（480×270）。
- **包脚手架**（本票先建，票 06 只补根注册）：`packages/visual-design/{package.json, tsconfig.json, tsconfig.spec.json}`
  + `src/index.ts`。根 tsconfig references + check-deps ALLOWED 留票 06。
- **验证**：`pnpm install` + `tsc -b packages/contracts` 后 typecheck 绿；`layout.test.ts` **11/11**（确定性 · 覆盖 ·
  非重叠 · 增删不搅乱身份 · role 映射 · layer 有序 · 合成 · 容量 · 空桶回退 · 语义桶 ref · 过 schema + wasteland 真夹具
  过 schema、5 个设计实体）。
