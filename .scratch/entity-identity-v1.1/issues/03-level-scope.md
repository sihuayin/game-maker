# 关卡作用域裁定：单关覆盖范围与全局完整性边界

Type: grilling
Status: resolved

## Question

已确认事实：`GameDesignSpec.levels[]`（`game-design.ts:176-188`）= `{ id, purpose, layout, entities: string[] }`，
gate ⑥ 已查悬空引用；`compileRuntime` 已选关（`ops.ts:1036`）；`auditEntityIdentity` 仍遍历四桶全部、无关卡过滤。

**B1 — 覆盖集合（采纳倾向）**：按当前关卡过滤。覆盖集合 = `design.levels.find(l => l.id === levelId).entities`
解析到四桶设计实体；`player.id` 是合法关卡引用但不参与 `config.entities` 覆盖计数（player 是顶层 `config.player`）。

**B2 — 全局完整性（采纳倾向）**：拆分独立检查。全局检查负责设计 ID 唯一性、关卡引用完整性等结构性问题；
当前关卡覆盖只查本关必需实体。两者不混为一个检查。

**B3 — 单关卡兼容（采纳倾向）**：单关卡既有合法输入/输出不变；不要求新增作用域参数或重复清单。

**B4 — 跨关卡引用规则（待裁）**：config 实体的 `sourceIntent` 指向**合法设计 ID 但不在当前关卡的
`entities[]`**（属于别的关卡、或不属于任何关卡）时，如何判定？

- **拒绝（倾向）**：`sourceIntent ∉ 当前关卡 entities[]` → 错误（wrong-scope）。与悬空检查并列成两道：
  ① `sourceIntent` 必须指向有效四桶 id（悬空）；② `sourceIntent` 必须在当前关卡 `entities[]` 内（越界）。
- 放行 + 警告：只约束覆盖（缺了要报），多余引用合法设计 id 容忍。

依赖：B4 需与 PRD §4.3「不能无条件通过，也不能未经定义就一律禁止」对齐，定出明确规则后再实现。

## Answer

裁定（用户 2026-10-25 收口）：

| 项目 | 裁定 |
|---|---|
| B1 覆盖范围 | 只覆盖当前关卡 `levels[].entities[]` 引用的四桶设计实体 |
| B2 全局完整性 | 独立检查设计 ID 唯一性、悬空关卡引用等全局结构问题 |
| B3 单关卡兼容 | 保持现有合法行为，不修改 schema |
| B4 反向越界 | 拒绝：`sourceIntent` 指向有效四桶 ID，但不属于当前关卡 → `wrong-scope` |

**B4 精确判据**（对每个带 `sourceIntent` 的 `config.entities[]` 实体，按序）：
1. 悬空：`sourceIntent` 不存在于设计四桶 → `error`。
2. 越界：`sourceIntent` 存在但不属于当前关卡 `levels[].entities[]` 解析出的四桶集合 → `error`（类别 `wrong-scope`）。
3. 兼容性：引用属于当前关卡，再按票 02 最终裁定的兼容矩阵检查。
4. 覆盖：当前关卡每个必需四桶设计实体 ≥1 个合法运行时实体映射到它。

无 `sourceIntent` 的结构性实体不参与悬空 / 越界 / 覆盖检查；但不豁免它自身其他既有的配置校验。

**实现注意**：越界检查不能只在覆盖循环里做（覆盖只能发现「缺失」，不能发现「配置多出了别的关卡的实体」）；必须单独遍历 `config.entities[]` 验证作用域。

**依赖**：第 3 步（兼容性）仍等票 02 的兼容矩阵裁定，不抢先定规则。
