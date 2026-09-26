# 09. game-config 契约：AI 与手写 runtime 之间唯一的语义接口

Type: grilling
Status: resolved
Blocked by: 24, 31
Map: ../map.md

> 🔴 **2026-09-26（[票 31](31-first-demo-game.md)）—— 第一个 demo 定了，本票多一笔具体的账。**
> 那个 demo 是**横版跳跃**，而它要求 game-config **能表达会运动的实体**（一个周期性扫过站台的车厢）。
> **若本票判定 game-config 不表达运动**，票 31 的裁决 5 就**退回纯静态地形** ——
> 那不是失败，是票 31 自己写好的退路。
> 另有一条悬着：**三层视差的因子住在 `AssetSpec.layers` 还是 game-config**，两处都放得下，由本票定。

> 🔴 **票 26 已 resolved —— 引用语法已经收掉了 `state`**（2026-09-24）：
> 资源包那边的 `AssetPackRef` 现在是 **`{asset, anim?}`**（票 24 定三段式、票 26 收掉中间那段）。
> 本票**必须采纳这个形状**，不要再另起一套 —— 它是同一个接口的两侧。
> 规则：资源只有一个动画（或只有一帧）时只给 `asset`；否则必须给 `anim`。
> 解不到时的失败语义见 `packages/contracts` 的 `resolvePackRef()`。

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

**结论：game-config 是一份「菜谱」，不是一门语言** —— 外壳实现一组**写死的行为原语**，
config 只说「哪里有、参数是多少」。`format: "game-config/v1"`，**一个文件 = 一个关卡**。

### 0. 票面八问的处置

票面写于旧终点，八问里**四问已经消解、一问的前提被推翻**，真正的主干只剩「表达力」。

| 票面问 | 处置 |
|---|---|
| 1. 与 `GameSpecSchema` 的关系 | ✅ **主干之一** —— 见 §1。前提被推翻：`GameSpec` 已是个**零消费者的死代码** |
| 2. 实体怎么描述 | ✅ **主干** —— 见 §2 的 `entities` |
| 3. 交互规则怎么表达 | ✅ **主干**（本票最核心的一问）—— 见 §3 裁决 1 |
| 4. 关卡 / 进度结构 | ⚠️ **消解**。「被 GameplayTestPlan 推导出测试」那条随 R2 出局；剩下的是「单关怎么表达」，见裁决 13 |
| 5. 胜负条件要不要结构化 | ⚠️ **消解** —— 票 31 已把第一个 demo 的胜负定死，本票只需给它一个封闭形态（裁决 6） |
| 6. `Requirement` 的可追溯性 | ⚠️ **消解** —— `RequirementCoverage` 随 R2 出局；今天需求就是一段 `.md`（`derive` 的输入），结构化类型零消费者 |
| 7. Zod 严格度 / 逃生舱 | ⚠️ **大半已答** —— 票 27 已为同一理由删掉 `visual`/`geometry` 两个逃生舱；票 01 已答「纯文本 JSON 比 tool_use 稳」；「校验失败怎么办」随 R10 修正变成**失败**（无降级链）。本票只补「校验清单」，见裁决 14 |
| 8. 谁来产出它 | ⚠️ **消解** —— 票 22 / 28 已定：端点是参数、`/v1/messages`、`thinking: disabled`。本票只定**产出流程**，见裁决 2 |

### 1. 三个零消费者 schema：全删

`packages/contracts/src/index.ts` 里 `GameSpecSchema` / `RequirementSchema` / `CreationProjectSchema`
**全仓库零 import**（票 07 那轮「32 个导出砍到 9 个」漏掉了它们）。三条各有独立的删除理由：

- **`GameSpec`** 描述的是「游戏**设计文档**」（`coreLoop`/`mechanics`/`rules` 全是自由文本，
  另外 8 个字段是 `z.record(z.unknown())` 逃生舱），而 game-config 描述的是
  「**外壳要执行的数据**」—— **两件事，不是一件事的粗细两个版本**。
- **`Requirement`** 今天就是一段 `.md`，是 `derive` 的输入文本；R2 之后没有任何消费者要结构化的它。
- **`CreationProject`** 的字段为已出局的闭环模型设计；地图说它的粒度「归票 24 / 28」，
  而那两票都已 resolved 且**没有给它留位置**。

与票 07（删 23 个）、票 18（删 `ArtifactRef` 三件套）同一条惯例：
**零消费者 + 字段为已出局的模型设计 ⇒ 删掉，别留空壳等人以为它活着。**

### 2. 形状

```
format     "game-config/v1"
world      { size: {w,h} }            交付态像素，1:1，**整数**
scene      { background: {asset} }    引用包里的 background —— **层与视差在包里，不在这**
player     { asset, anims:{idle,run,jump}, at, move?:{speed,jumpVelocity,gravity} }
terrain    [ {x,y,w,h} ]              **只有看不见的碰撞**（地面线、关卡边界、隐形墙）
entities   [ {id, kind, at, asset?, anim?, body?, motion?} ]
hud        { panel:{asset,at,size}, slot:{asset,anims:{empty,filled}}, at }
objective  { kind:"collect-then-reach", gate:"<goal 实体 id>" }
```

`kind ∈ {solid, pickup, hazard, goal, decor}` —— `solid` 是**看得见的静态碰撞体**
（行李堆、雨棚台阶），它与 `terrain` 的分工是：**看不见的进 `terrain`，看得见的进 `entities`**，
所以一摞行李**只写一次**。

**`objective` 不带数量** —— 它由 `kind:"pickup"` 的实体数**派生**，HUD 的槽位数是**同一个数**。
重复声明会让「改了实体忘了改数字」成为一类静默错误。

### 3. 十五条裁决

| # | 裁决 | 关键理由 |
|---|---|---|
| 1 | **固定行为原语的参数化**，不是通用规则语言 | 通用规则要让外壳变成解释器 —— 与 R8 打架，且失败发生在**运行时**（Phaser 静默失败）。封闭枚举把「这个游戏做不出来」变成**构建期的 schema 拒绝** |
| 2 | **与 `derive` 同构**：一次 LLM 调用编译、**先落盘成文件**、人过目、再装配 | R7 已为资源清单定过这个形状；产物是文件 ⇒「人给」那条路**自动存在**，不必显式开 |
| 3 | 顺带定下产物 B 的对外面：`compile-game → site`（与 `derive → pack` 对称） | 票 30 刻意没给 `site` 占位，正是等这里 |
| 4 | 三个零消费者 schema **全删** | 见 §1 |
| 5 | **资源自身的性质归包；「这一次怎么用它」归 config** | `size`/`anchor` 只住包里（同一个货箱在两个关卡里一样大）· **禁 `scale`**（`1.7` 会**静默**糊掉像素网格，而 R2 之后没有别的东西拦得住） |
| 6 | 视差因子**归包**、但**补进 manifest** | 它跟 `anchor` 同类：天空在墙后面是**画出来的东西的一部分**。放 config 就得重复包内的层结构 —— 又是两份拷贝 |
| 7 | 九宫格**归包**、但**补进交付态图集** | 票 25 已定它的家是每帧 `scale9Borders`（Phaser `add.nineslice()` 零参数读），而 `atlas.ts` **至今没写这个字段** |
| 8 | `objective` 是**封闭枚举**，V1 一个变体：捡齐 N 件 → 激活终点 → 到达即胜 | **这个形态正好解释了票 31 的「信号灯由红转绿」** —— 红/绿就是「是否已捡齐」的**显示**，规则与视觉是同一个决定的两种表达 |
| 9 | **`motion` 是任意实体可选的一块**，`kind` 说**碰到会怎样**、`motion` 说**它怎么动** | 两件事正交。(c) 外壳写死会让「车厢会动」变成**没有任何契约写着**的隐含知识，而 R8 之后 AI 只产数据 |
| 10 | 动作名**显式映射**（`player.anims`），不是名字约定 | 与 A 侧 `resolvePackRef` 完全同源：构建期是唯一还能报出「引用点引用了不存在的动画」的地方 |
| 11 | **手感参数进 config**（外壳给默认值） | 关卡几何与「玩家能跳多高」是**同一件事的两半**；(b) 让构建期能算出「越不过这台阶」——见裁决 14 |
| 12 | 碰到危险物**退回位置，计数保留** | 30 秒的关卡里，归零是纯粹的挫败、不是难度 |
| 13 | **世界坐标 = 交付态像素，1:1、整数**；关卡单屏高、只横向滚动 | 两套单位并存必然漂移。**整数**这条尤其重要：`x: 10.5` 会静默糊掉精灵 |
| 14 | **一个 game-config = 一个关卡** | `levels: [x]` 是一个只有一项的数组 —— 为想象中的未来付结构税。多关卡 = 多份文件 + 一份索引（索引的形状等真有第二关时再定） |
| 15 | **`body` 省略 = 资源的 `size`**；**九宫格面板的尺寸是 config 的**，这是唯一的例外 | 前者是 Q5 的确认不是例外。后者**正是九宫格的定义** —— 它存在的全部理由就是「四边不拉伸、中央拉伸」，因此拉伸不会破坏像素网格；Q5 禁的 `scale` 防的是非整数倍缩放，而九宫格是为了**绕开**这件事被发明出来的。⚠️ 顺带否掉一个诱人的默认：「默认给一个更小的中心盒」（平台游戏常见的好手感做法）—— 那是**没人写下来的魔法**，与 R8 正相反 |

### 4. 构建期校验（裁决 14 的落点）

跑在**装配站点那一步** —— 那是唯一同时看得到包与 config 的地方，而 `resolvePackRef` 正需要这两样输入。

| 族 | 检查 | 语义 |
|---|---|---|
| **引用** | 每个实体的 `asset`/`anim` 解得到 · `objective.gate` 指向存在的 `goal` · `hud.slot` 的两个动画名解得到 | **硬失败** |
| **自洽** | 数量由实体数派生（不重复声明）· 实体 id 唯一 · 出生点不卡在 solid 里 · 坐标是整数且落在 `world.size` 内 | **硬失败** |
| **可通关** | **跳跃能力越不越得过最高的那块台阶**（抛物线顶点**精确可算**）· 危险物的行程不越出世界 | **警告** |

「越不过某块台阶」精确可算，但**不构成判决** —— 越不过去可能正是设计（玩家该走另一条路）。
这与票 27 立的规矩一致：**精确的硬失败、上界的报警告**。
而硬失败必须是**失败**、不是降级：票 30 抓到过「校验不过时退出码是 0」—— 篡改过的包因此骗过了校验脚本。

### 5. 交给别的票的输入

1. → [固定 runtime 外壳](32-runtime-shell.md)：外壳要读 `player.move` 的默认值、要给九宫格面板设尺寸。
2. → [资源包 → 运行时的装配](33-runtime-assembly.md)：上面那三族校验器跑在它这一步；`compile-game` 与 `site` 是它要落的对外操作。
3. → [产出 last-train 的 fixture 资源包](40-last-train-fixture-pack.md)：**本票裁决 6 与 7 正是它要撞上的两个缺口**的答案。

### 6. 毕业的票

- **41. 把 game-config 契约落进 `packages/contracts`** —— schema + 三族校验器 + 测试。与票 37 同构。阻塞票 33。
- **42. 补齐两条卡在半路的属性** —— manifest 加 `layers`/`parallax`，`atlas.ts` 从 `UiSpec.ninePatch` 写出 `scale9Borders`。阻塞票 40。

⚠️ 票面的「产出要求」要的 **Zod schema 草案 + 真实 Config 实例** 落到 `demo/src/contracts/`
—— **那个目录已随票 07 删除**。代码归票 41，真实实例归票 33（它产 last-train 的 fixture game-config）。

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

### 7. 票面「产出要求」的交代

票面要求调用 `grilling` 与 `domain-modeling` —— **两个都调了**。
`domain-modeling` 的落点是 `CONTEXT.md`：新增 **行为原语 / 实体 / 地形 / 目标** 四个词条，
更新 **Game Config**（补七块顶层与坐标单位），并按同一条纪律**对齐了三条被本票推翻的旧词条**
（`Creation Project` / `GameSpec` / `Requirement` 标为已删除或已降格）
以及两处事实性过时（`assetpack/v1` → `v2`；`Palette Binding` 三值 → 四值）。

⚠️ **不建 ADR**：本仓库的决策只有一个落点 —— **票的 Answer**，地图的 Decisions so far 只是索引。
另开一个 `docs/adr/` 会制造第二个真相来源，与本 effort 反复立的规矩冲突。
