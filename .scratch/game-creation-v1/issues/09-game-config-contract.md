# 09. game-config 契约：AI 与手写 runtime 之间唯一的语义接口

Type: grilling
Status: open
Blocked by: 24, 31
Map: ../map.md

> ⚠️ **范围已重画**（2026-09-24，R4/R8）：**核心问题原封不动**，但周边全变了。
>
> **保留的**：game-config 是 AI 产出的**纯数据**，描述实体清单、场景布局、交互规则、
> 胜负条件；它是 AI 与手写游戏代码之间**唯一**的语义接口。R8 之后 AI 连纯函数都不写了，
> 所以这个接口的**完备性要求更高了** —— 凡是 runtime 需要知道的东西，
> 没有第二个地方可以承载。
>
> **新增的负担（R4）**：**map / 关卡归 game-config**。它是「引用其他资源的布局」，
> 不是可绘制产物 —— 所以地块、实体摆位、关卡结构、进度门都落在这里。
> 票 05 的结论（drawlist 没有「实例化另一个资源」的 op，场景组合归 Game Config）
> 从一条注脚变成了本票的主干。
>
> **删掉的**：所有与状态机、repair plan、conditional transition 相关的条目（R2 已出局）。
>
> **新增的子问题**：game-config 如何**引用资源包**？引用的粒度是
> `assetId` 还是 `assetId + state`？引用了一个包里不存在的 id 时，
> 谁来报错、什么时候报（构建期还是运行时）？—— 这条与[票 24](24-asset-pack-contract.md)
> 是同一个接口的两侧，两票要对齐。

## Question

Q15 划定了本项目最重要的边界：**AI 只产出「数据 + 纯函数」**，
其中「数据」就是 Game Config。Phaser 主 scene、游戏循环、bridge 插件、
输入处理、碰撞全部手写固定，它们**只认 Game Config 这一个接口**。

这意味着 Game Config 的 schema 决定了这个系统能表达什么游戏、
不能表达什么游戏。它必须一次设计对，因为之后每加一个能力
都要同时改 schema、改手写 scene、改 QA 推导规则。

`CONTEXT.md` 已经给它下了定义（实体清单、场景布局、交互规则、
关卡/进度结构、胜负条件），但**字段一个都没定**。

阻塞在票 05 是因为：Config 里引用资源的方式取决于 Asset 的表达形式
（如果 Asset 是 Canvas 指令 DSL，Config 引用的是 `assetId`；
如果是 SVG，可能引用文件路径）。

必须 grill 出的问题：

1. **与现有 `GameSpec` 的关系**：契约里已经有 `GameSpecSchema`
   （`demo/src/contracts/index.ts`），字段是
   `world/player/mechanics/entities/scenes/ui/rules/winConditions/loseConditions/requirements`
   —— 而且大量是 `z.record(z.unknown())`（**没有实际约束**）。
   Game Config 是**取代** GameSpec、**细化** GameSpec、还是 GameSpec 的
   `z.record(z.unknown())` 部分**就是** Game Config？
   **这是本票最关键的问题**：如果两者并存，就有两个真相来源。
2. **实体怎么描述**：id 命名规范（文档里用的是 `crop.tomato.01` 这种
   点分层级）、type、position、bounds、interactive、states、
   以及它引用哪个 Asset。
3. **交互规则怎么表达**：「玩家走到番茄旁边按 E 就能采摘，采摘后
   `crop.tomato.01` 的 state 变 `harvested`，背包 +1」——
   这条规则在 JSON 里长什么样？是声明式的
   `{trigger, condition, effects}` 三元组，还是别的？
   **表达力的天花板在哪**？哪些玩法规则注定表达不了？
4. **关卡 / 进度结构**：用户原话要求「游戏关卡等设定」。
   V1 是 single scene（文档第 67 节），所以「关卡」只能是
   **单场景内的进度结构**：地块解锁？目标序列？难度递增？
   怎么在 Config 里表达，且能被 GameplayTestPlan（票 13）推导出测试？
5. **胜负条件**：`GameSpec` 里是 `string[]`（自由文本）。
   但 Gate 要判定「Objective Complete」，自由文本没法执行。
   要不要结构化？结构化到什么程度？
6. **Requirement → Config 的可追溯性**：文档第 34 节的
   `RequirementCoverage` 要求能回答「哪条 requirement 实现了没、测了没、过了没」。
   这要求 Config 里的每个元素能**反向指回**它满足的 requirement id。
   这个映射存在哪？
7. **Zod schema 的严格度**：Q15 的全部价值在于「AI 的输出可被 Zod 校验」。
   那么 schema 要多严？`z.record(z.unknown())` 这种逃生舱要不要**全部消灭**？
   校验失败时怎么办 —— 让 LLM 重试（几次？）、还是降级到 fixture？
8. **谁来产出它**：`deepseek-v4-pro`（Q8）。那么 prompt 长什么样、
   要不要 few-shot、要不要 tool-use 强制 JSON（取决于票 01 的答案）。

调用 `grilling` 与 `domain-modeling` skill。
**产出是一份 Zod schema 草案 + 一份 Cozy Farm 的真实 Config 实例**，
两者都要落到 `demo/src/contracts/` 下（或链接到本票）。
新概念要同步进 `CONTEXT.md`。

## Answer

_（待填）_

---

## 来自票 01 的更新（2026-09-23）

票 01 实测推翻了一个隐含假设，**本票第 7 条的权重上调为最高优先级**：

- **`tool_choice` 强制 JSON 不可靠**：完整 12 字段 schema 下只有 **1/3** 通过，
  失败形态是 `tool_use.input` 只有部分字段就提前 `end_turn`。
- **纯文本 JSON（prompt 里描述结构）反而 6/6 通过**，且 **9 次调用零 markdown 围栏**。

含义：

1. **Zod 校验 + 重试从「可选优化」变成「必需机制」**。第 7 条必须回答：
   重试几次？重试时 prompt 要不要带上上一次的校验错误（自我修正）？
   重试仍失败是降级到 fixture 还是整个 run fail？
2. **新增子问题：prompt 里怎么描述 schema 才最稳**？
   票 01 用的是「TypeScript-ish 伪结构 + 中文说明」，6/6 成功。
   要不要固化成一份可复用的 schema-to-prompt 渲染函数？
   （它会被 `compileStyle`、`compileGame`、GameplayTestPlan 补充、
   Repair 诊断**四个调用点共用**。）
3. **新增子问题：`z.record(z.unknown())` 逃生舱的取舍要重估**。
   票 01 发现 tool-use 截断是**字段数/长度触发**的。
   schema 越宽（开放 object），模型越容易写长、越容易被截。
   **把逃生舱收紧成具体字段，可能同时提升可靠性** —— 这不只是类型洁癖。
4. **反直觉发现，需在本票复核**：`deepseek-v4-flash` 产出的 GameSpec
   比 `deepseek-v4-pro` **更丰富**（flash 产出了 `important`/`optional`
   级需求并给出 3-9 个实体；pro 只产出 `core` 级、2-4 个实体），
   而延迟只有 pro 的 1/5（6-8 s vs 27-38 s）。
   **compileGame 是否该用 flash 而不是 pro？** 这与 Q8 的分工相反。

---

## 来自票 05 的更新（2026-09-23）—— 新增一条职责边界

票 05 已定 Asset 格式为 `drawlist+curve/v1`（一个 `(asset, state)` 一份 JSON，
`ops` 是纯数值图元，颜色是 `palette:N` 引用）。

### 新增：**场景组合归 Game Config，不归 Asset**

票 05 暴露了一个真实空白：文档第 63 节说 `scene` 依赖 cow / barn / tree，
但 **drawlist 的 op 集合里没有「实例化另一个资源」这种 op** ——
所以「场景」**无法**用 drawlist 表达。

结论：**场景不是一种 Asset。** 场景是 Game Config 的职责（Q15 已把
「场景布局」划给 Game Config）。因此本票必须回答：

- Game Config 怎么表达「在坐标 (x,y) 放一个 `cow` 资源的 `idle` 状态」？
  这个「实例化」结构的 schema 是什么？
- 一个 Asset 实例需要哪些字段？至少：
  `{assetId, state, x, y, scale?, flipX?, z?}` —— 还有别的吗？
- `AssetSpec.dependencies`（文档第 63 节）因此**只用于生成顺序**
  （依赖图排序），**不用于组合**。这个语义收窄要写进契约注释。
- Game Config 引用 Asset 时，是引用 `assetId` 还是 `assetId + state`？
  如果是前者，运行时怎么知道该用哪个 state？
  （建议：Config 给**初始** state，运行时按游戏规则切换 ——
  但这要求 Config 里声明状态机的转移条件，与第 3 条「交互规则」重叠。）

### 另外：Asset 的 `expectedSize` 谁定？

drawlist 产物自带 `expectedSize`（票 05 子问题 3）。
但**期望尺寸本质上是设计决策**（ cow 该多大是游戏设计说的，不是画图的人说的）。
所以它应该**源自 Game Config**，再被写进 drawlist 产物。
本票要定：Game Config 里的实体定义要不要带 `size` 字段？
它与 drawlist 的 `expectedSize` 是同一个数的两份拷贝，还是单向派生？
**两份拷贝会漂移** —— 这是文档第 31 节 scale mismatch 的根源之一。
