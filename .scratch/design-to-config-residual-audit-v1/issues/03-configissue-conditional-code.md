# ConfigIssue 条件式类型增量裁定

Type: grilling
Status: resolved
Owner: main session · 2026-11-02
Blocked by: 01
Map: ../map.md

## Question

PRD FR-06 要求错误诊断包含 `code / entityId / field / assetId / expected / actual`。当前 `ConfigIssue`
只有 `{severity, where, message}`，且被多个审计函数、QA 合成、CLI/MCP 输出与测试断言共用。

用户已裁定：**仅考虑增加可选稳定 `code`，不增加其余字段，且实施前单独确认契约变更。**
本票只做**独立评估与比较**，不修改契约、不修改代码。

### 必须回答

1. **爆炸半径量化**（依赖 01 的消费点清点）：`ConfigIssue` 的完整消费者清单；增加一个**可选**
   `code?: string` 会影响哪些类型、构造、序列化、测试断言与对外输出；逐项说明「编译期兼容」与
   「行为零变化」是否成立。
2. **方案 A —— 增加可选稳定 `code`**：错误码覆盖范围（仅本图涉及的语义错误族）、命名与稳定性
   约束、与现有 `where`/`message` 的关系、如何避免与 QA finding 的 code 体系冲突、测试如何断言。
3. **方案 B —— 保持 `{severity, where, message}`**：如何用确定性测试验证错误定位（AC-03）而不引入
   错误码；现有 `where` 人话是否足够定位实体/字段/资源；QA 侧是否已有可借用的结构化形态。
4. **比较**：维护成本、契约影响、测试价值、对 CLI/MCP 输出的影响、向后兼容风险各一项，给出结论性
   排序，并说明在「残余缺口可能为零」的前提下是否值得做。
5. **审批建议**：明确写成「本图不实施；若 P1 批准，最小变更面是什么」，并把未决问题交给 06 的
   P1 审批清单。

### 约束

- **不修改契约、不修改代码、不修改测试**；本票产出的是比较与建议。
- 不得因为选了 A 就默认授权改 Schema / QA / CLI / MCP。

### 产出

- 本票追加 `## Answer`（A/B 对比表 + 建议），`Status` 改 `resolved`。


## Answer

**裁定（用户 2026-11-02）：条件式 A + contracts 闭集 union + 不 retrofit 历史错误码。**
本票只完成技术方案比较与触发规则；**不批准实际契约修改**，最终是否触发由 04 的残余缺口 HITL 裁定。

### 1. 现有类型与构造点事实（E1 源码 + 计数）

- `ConfigIssue = {severity, where, message}`，**纯 TS 类型、非 zod schema、不落盘**（`contracts/src/game-config.ts:281-285`）。
- 生产者 **12 个**审计函数：contracts 7（`auditReferences` / `auditPanelSize` / `auditGameConfig` / `auditEntityIdentity` / `auditScreenSpace` / `auditLayerCoverage` / `auditReachability`）+ td 2（`auditTdConfig` / `auditTdWorldSize`）+ demo 3（`auditGeometry` / `auditTdGeometry` / `auditWinnable`）。
- 构造点 **47 处** `severity: error/warning` 字面量。
- 消费者 11 处：`assets/src/ops.ts`（4）· `demo/src/site.ts` · `demo/src/td/site.ts` · `demo/src/layout.ts` · `pipeline/src/create-game.ts` · `qa/src/gameplay.ts` · `qa/src/layers.ts`。
- 测试耦合：13 个测试文件约 160 处 `toMatch(/…/)`（部分与本类型无关）；消息文案事实上是测试契约。
- 先例：`AcceptanceFinding` 已有 `code: z.string().min(1)` 且闭集归生产者；`ASSET_PLAN_REASON_CODES` 是闭集枚举先例。

### 2. 方案 A/B 比较

| 维度 | A：可选稳定 `code` | B：保持现状 |
|---|---|---|
| 契约影响 | 类型增量，编译期兼容 | 零 |
| 测试价值 | 断言 `code` + `where`，文案可改 | 中文正则即契约，改字就红 |
| 机器可读性 | 可按 code 分类 | `where` 人话不可解析（`qa.ts:84`） |
| 维护成本 | 码表稳定性；新旧混用 | 零新增，但每个新错误焊死文案 |
| 误用风险 | 码表漂移、同事实两码 | 文案与语义漂移 |

**结论性事实**：可选 `code` 对 47 个构造点、11 个消费者、全部落盘产物与 CLI/MCP 输出都是**零行为变化**；这是 contracts 包内公开类型的增量，不是对外 Schema 变更。

### 3. 条件式触发规则（必须同时满足）

1. 04 裁定至少存在一条**值得修复**的残余语义缺口；
2. 该缺口需要**新增或加强**确定性负向测试；
3. 稳定错误码能提供实际测试或后续机器处理价值。

不满足时，P0-B 直接裁定：**无 `ConfigIssue` 契约变更**。不得为使用已设计好的方案而人为制造触发条件。

### 4. 闭集 union 的归属与维护

- 若触发：`ConfigIssue` 增加 `code?: ConfigIssueCode`。
- `ConfigIssueCode` 由 **contracts 统一维护**（闭集 union），新增码集中定义，不散落在生产者。
- 不强制现有构造点补码；不改变现有错误的 `severity` / `where` / `message` 语义。

### 5. 不 retrofit 的明确约束

禁止：批量改 47 个构造点；给 E01–E05 补码；为统一改写现有错误消息；扩展 `QAFinding`；改变 CLI/MCP 输出；改变任何落盘产物。
E04 若被 04 裁定为值得修复且确实新增/加强检测，可在**对应新增错误**上使用 code。

### 6. QA 合成与持久化边界

- `qa/src/gameplay.ts:96` 的 `merged()` 把一批 issue 拼成一条 finding 的 `detail`；**只加 `ConfigIssue.code` 不会进入 `qa-report`**。
- `QAFinding` 无 `code`；扩展它属于单独审批，本图不做。
- 无任何 ConfigIssue 持久化格式；所有下游只消费字符串。

### 7. 最终建议

**启用条件式 A；否则不做契约变更。** 技术方案已就绪，审批权保留给 04 裁定与 P1 门。

## Comments

**2026-11-02 · 04 裁定回填**：条件式 A 的触发条件已满足（Q1/Q3/Q4 需新增或加强确定性负向校验、Q5 需补齐复验路径、Q11 明确要求负向 fixture 与断言）。本票的 A 方案进入 P0-B 范围，但**本轮不实际修改类型**；实施约束按本票 `## Answer` 执行。详见 [04 的裁定表](04-residual-gap-ruling.md#裁定表)。
