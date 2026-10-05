# 10. `compile-design.ts`：`GameIntentSpec` + `VisualWorldSpec` → `GameDesignSpec`

Type: grilling
Status: resolved
Owner: claude (2026-10-04)
Blocked by: 03, 07, 09, 28
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> `docs/v2/03-claude-code.md` §10。「不要让 `GameIntentSpec` 直接转换为 `GameConfig`。」

## Question

这是理解层的**最后一道** —— 它的产出（`GameDesignSpec`）是 Asset Planner 与 Runtime Compiler
**共同**的输入，所以它的字段**每一个都会被下游读到或读不到**（票 03 的门在这里兑现）。

### 1. 视觉与设计**交汇**在哪

输入同时有 `GameIntentSpec`（要什么）与 `VisualWorldSpec`（这个世界长什么样）。
今天最近的前例是 `compile-game`（`ops.ts` 的横版编译，输入是**需求 + 资源包**）。

要答：**`VisualWorldSpec` 到底影响 `GameDesignSpec` 的哪些字段**？
- 若只影响 `visualRequirements` 一类，那它在这道编译里几乎是**装饰**，值得问一句为什么在这里喂。
- 若影响实体/关卡（例如「这个世界是黄昏的铁路小站」⇒ 敌人是什么），要**指出具体字段**。
⚠️ 说不出来的话，就按 R7 的门：**别留那个字段**。

### 2. 与 `compile-game` / `compile-td-game` 的关系

今天有两个编译器，都是 `需求 + 资源包 → 关卡配置`，**没有** `RuntimeProfile` 输入。
§19 要 `GameDesignSpec + RuntimeProfile + AssetPack → GameConfig`（票 14）。

要答：`compile-design` 是**新的一道**（在资源之前），还是把旧的两道**劈开**？
⚠️ 塔防那条链**不许被弄坏**（R4）。若旧的两道要动，得说清塔防怎么办
（它没有 `GameIntentSpec` / `GameDesignSpec`，它的输入仍是「需求 + 资源包」）。

### 3. `unsupportedRequirements`（§11）

R12 明确**不采用**那条「运行时再说」的路。要答：`GameDesignSpec` 里若出现
`RuntimeProfile` 不支持的能力，**在哪一刻**被拒绝？
- 若在 `compile-design`：那时还没读 `RuntimeProfile`（它是票 14 的输入）⇒ 得**提前**。
- 若在 `compile-runtime`（票 14）：拒绝时已经花掉了 `AssetRecipe` 与**生图的钱**。

⚠️ **这就是 R12 带来的真实代价，要在这一票上说清**：拒绝得越晚，越贵。

> ⚠️ **2026-10-02（[票 03](03-contract-intent-and-design.md) 已关）：两条硬约束落到本票头上了。**
> ① **① 档字段的欠条**：`game-design.ts` 与 `game-intent.ts` 的文件头各列了一批
>    「靠提示词**具名插值**活着」的字段。本票写模板时**每一个都必须具名出现一次**
>    （`spec.world.atmosphere`，**不是** `JSON.stringify(spec)` 整份兜底 —— 整包 JSON 消费不算读）。
>    **没露脸的字段当场出局**：到那时回契约里删掉它，别留着。
> ② **id 延续**：设计层四个桶的 `id` **沿用**意图层 `entities[].id`；`mechanics[].id` 同理。
>    ⚠️ 改名的后果不是「难看」，是 Intent QA（票 19）**误报覆盖度**。
> ③ **§3 那个「拒绝在哪一刻」的问题，本票一填就撞上了**：`mechanics[].mechanic` 是**封闭枚举**
>    （`vocabulary.ts`）—— 想填 `double-jump` 会**填不出来**。那就是 R12 的拒绝，
>    而且是**免费**的（不用另写判据），比票 14 早得多也便宜得多（生图的钱还没花）。

> ⚠️ **2026-10-02（[票 05](05-contract-runtime-profile.md) 已关）：`game.camera` / `game.genre` 的取值从哪来。**
> 票 05 砍掉了 `RuntimeProfile.cameraModel` / `.genre`（它们是**可派生的副本**），
> 所以本票填这两个自由字符串时，**从 profile 的 `id` 与 `capabilities[]` 现取**
> （`capabilities.filter(c => c.startsWith("camera:"))` 就是那个取值域）——
> **别再往 profile 里补字段**，也别在提示词里让模型自由发挥这两个值。

## Answer

**结论：`compile-design` 落地**（`packages/game-design/` 三个源文件），**输入多了第三样 `RuntimeProfile`**，
**R12 的拒绝第一次真的响了**，并且它**不是失败**。20 条裁决 · **60 条新测试** · 套件 **861/861**（此前 801）·
`tsc -b --force` 干净 · 两个守卫绿（145 份文档 · 742 条链接）· **24 发变异全部验过会红**。

### 0. 裁决表（两轮）

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | 1-Q1 | **VWS 落在四处**：`world.structure` · `levels[].layout` · 实体做派 · 相机拒绝面 | `prompts.ts` · `build-design.ts` |
| 2 | 1-Q1 | **意图层那 6 个 ① 档字段**具名插值；**设计层那 12 个**由本票 prompt**逐条点名生产**，业务消费者在**下游** | `prompts.ts` · 契约头注释 |
| 3 | 1-Q2 | **不碰** `compile-game` / `compile-td-game`；存废归**票 14** | 无 |
| 4 | 1-Q3a | **`compile-design` 吃第三个输入：`RuntimeProfile`** | `compile-design.ts` |
| 5 | 1-Q3b | 拒三条：**意图→设计的覆盖** · **`vws.camera.mode` 对不上 profile** · **两条差集**（今天恒空） | `build-design.ts` |
| 6 | 1-Q3c | **R12 的拒绝不重采样、不进 `failures[]`**（那一发调用是**成功**的） | `compile-design.ts` |
| 7 | 1-Q3d | **与票 19 的分工**：id 那一半在这里拒，票 19 只剩**文本相等**那一半 | 播给票 19 |
| 8 | 1-Q4 | **设计层也立一条 gate**：结构性空值 + **id 跨桶唯一** + **`levels[].entities` 解得到** | `game-design.ts` |
| 9 | 1-Q4 | `levels` 只要 **≥1**，**不是**恰好 1 | `game-design.ts` |
| 10 | 1-Q5 | 落地形状全表（见 §4） | 三个源文件 |
| 11 | 1-Q6 | 真探针 n=4 | `experiments/design-first-shot/` |
| 12 | 2-R2-Q1 | ⚠️ **「意图覆盖 + 需求补全」，不是「意图镜像」**（裁定原文见 §3） | 契约头 + `prompts.ts` + `CONTEXT.md` |
| 13 | 2-R2-Q1 | `id` 分两种：意图已有的**原样沿用**（不许改/删/串桶）；这一层**可以补全**，但**依据必须是需求/意图的语义** | `DESIGN_TOOL_DESCRIPTION` · `build-design.ts` |
| 14 | 2-R2-Q1 | ⚠️ 「补出来的有没有依据」**不可机械判定** ⇒ **不是判据**，只活提示词纪律 | 契约头注释 |
| 15 | 1-Q3b | **`CAMERA_MODE_NEEDS` 是一张显式的表**（`side → camera:side-scroll`，其余 `null`）—— **不许**写成 `some(c => c.startsWith("camera:"))` | `build-design.ts` |
| 16 | 1-Q4 | gate 的「不进」名单：四个桶可空 · 胜负条件可空 · `difficulty` 可缺席 | `game-design.ts` |
| 17 | 1-Q5 | 三个照抄值**模型照抄、装配强制覆盖**（照票 08 让模型照抄 `style.id` 同款） | `build-design.ts` |
| 18 | 1-Q5 | **有装配步**（与票 09 相反）：`build-design.ts` 纯、可单测 | 文件划分 |
| 19 | 1-Q5 | 账：`LedgerStep += "compile-design"` · `target = "game-design"` · `max_tokens = 16_000` · 工具名 `emit_game_design` | `ledger.ts` · `compile-design.ts` |
| 20 | 1-Q5 | **不做 CLI 入口**（照 08/09） | 无 |

### 1. `VisualWorldSpec` 的四个落点（R7 的门要的「具名读者」）

| 落点 | 来源 | 谁读 |
|---|---|---|
| `world.structure` | `vws.composition`（前景/中景/背景/物尺度/密度） | 票 12 与票 14 的模板 |
| `levels[].layout` | `vws.environment.architecture` / `.terrain` + `composition.background` | 同上 |
| 实体的 `behavior` / `threat` / `interaction` | `vws.environment.props` + `vws.character.*` | 同上 |
| **相机拒绝面** | `vws.camera.mode` vs profile 的 `camera:*` | **R12 的拒绝**（不是提示词） |

⚠️ **明说不进**：`game.genre`（从 profile 的 `id` 取）· `world.theme` / `world.setting`（**意图层的话**才是源）·
资产层的一切（那是票 12 的活 —— 票 12 的输入里**也有** VWS）。
⇒ 不喂 VWS，「结构」与「关卡怎么排」就只能**瞎编** —— 那就是票 03 砍掉 `visualRequirements` 之后
VWS 在这道编译里**唯一**的落脚处（它不是装饰）。

### 2. R12 的拒绝：**它第一次真的响了**（票面第 3 问的答案）

**(a) 为什么必须加 `RuntimeProfile` 这个输入。** 三条理由，第三条是决定性的：
**票 14 的输入里既没有意图也没有 VWS** ⇒「用户要的东西做丢了」与「参考图的视角做不出来」
这两件事，**除了本步没人管得了**。R12 要「在生图之前、且免费」地拒 —— 本步就是那个点。

**(b) 拒三条，按「今天是否活着」排**：

1. ⚠️ **意图 → 设计的覆盖**（按 `id`）—— **今天唯一活着、且只有本步看得见**的那条。
   用户说「要二段跳」，意图层照实记（`mechanics[].name` 自由文本），设计层 `mechanic` 是**封闭枚举**
   ⇒ 填不出来。判据 `intent.mechanics[].id ⊆ design.mechanics[].id`（四桶同款，**按 `type` 落桶**），
   缺了就拒，而报错**点名用户自己的话**（「二段跳」）。
2. **`vws.camera.mode` 能不能被 profile 的 `camera:*` 承载** —— 参考图是俯视、外壳只有横版 ⇒ 拒。
   ⚠️ **票 06 删 `CAMERA_MISMATCH` 时把这条兑现押在了本票上**，已兑现。
3. **两条差集**：`design.mechanics[].mechanic − profile.mechanics` ·
   `design.runtimeRequirements − profile.capabilities`。⚠️ **今天恒空**（票 05 的自白）——
   写下来是**给第二个成员留的位**，今天不响是**预期的**，契约里自带这句自白。
   ⚠️ 分工：这两条差集的**形式**上归票 14（`01-contracts.md §8` 那么写的），**今天**则由本步顺带算一遍
   （反正 profile 就在手上）—— 票 14 那两条等第二个成员落地才会真的说话。

**(c) 「拒绝 ≠ 失败」。** 拒绝是**一条结论**，不是模型没干好。所以：**不重采样** ·
**不进 `failures[]`**（那一发上游调用**成功了**，账照记）· 退出码 **4** · 文案走 `rejections` 列表。
⇒ 与「模型吐错了 ⇒ 重采样」那条路**结构上分开**（两个错误类）。
⚠️ 一条已知噪声要写下来：模型若**不听话地挑个近似值**（`m-double-jump → jump`），
**id 覆盖查不出来**。反制只在工具说明里（「做不了就整条省掉」），残余噪声归票 19 的文本那一半。

### 3. ⚠️ 「意图覆盖 + 需求补全」，**不是**「意图镜像」（R2-Q1 的裁定原文）

> `GameDesignSpec` 可以新增 `GameIntentSpec` 未显式列出的实体，但新增实体**必须能够从原始需求语义中
> 得到依据**；`GameIntentSpec` 已存在的实体，其 `id` 必须**原样延续**，不得修改、删除或串桶。

⇒ 两条集合关系**方向不对称**：**意图 ⊆ 设计** 是**判据**；**设计多出意图 = 允许**（那叫**补全**）。
⚠️ 而「多出来的那个有没有依据」**不可机械判定** ⇒ **它不是判据**（R3：判据只收「精确可算 +
错了一定不是设计」），只活在提示词纪律与工具说明里。**谁也别把它写成一条永远绿的判据。**

这条裁定的来历是**探针当场证伪了我写的一句话**：我在工具说明里写了「`id` 不许新造」，
而第 4 发里模型**造了一个 `e-water`** —— 而它造的**是对的**：意图层的 `coreLoop` 明写着
「收集废料与**净水**」，`entities[]` 里却只有废料。模型是**发现缺口并补上**。
⇒ 问题不是模型不听话，是**那句话反了方向**（禁止补全 = 逼设计层丢掉需求）。

### 4. 落地形状

- 落点 **`packages/game-design/`**：`compile-design.ts`（I/O）+ **`build-design.ts`（纯：装配 + 拒绝）**
  + `prompts.ts`（设计面）。
- **有装配步**（与票 09 相反，且那里写清了为什么）：`GameDesignSpec` 里有**三个**「调用方才知道」的值
  —— `game.runtimeProfile`（这一代外壳的**身份**）· `game.genre`（`= profile.id`）·
  `game.camera`（`= vws.camera.mode` 的**字面**）。模型被要求**照抄**，装配时**强制覆盖**。
  ⚠️ `game.camera` **不许**填成 profile 那条能力名 —— 那样相机那条对照**恒真**、拒绝面当场死掉。
- 装配后**重过一次契约**（`superRefine` 在这里响）· 无 `.omit()`、无模型侧投影。
- 三个照抄值都是**可派生的副本**，契约里各写了「为什么留它、读者是谁」（同票 05 给两个数组写自白）。

### 5. 探针（`experiments/design-first-shot/`，n=4）

⚠️ **与 08 / 09 刻意不同**：那两发量的是「原始契约 + 最小说明」（纪律：不加提示词补丁）；
**本票量的是出货的那一套**（真提示词 + 真工具说明 + 真契约）—— 因为这一步最要紧的两个问题
（id 有没有被照抄、做不了的机制是省了还是被近似了）**只存在于提示词里**。
⇒ 代价：**「纯契约」的首发率本票没量**。为它单独再跑一发是个空位。

- 输入用的是**真跑出来过**的一份 VWS（08 探针 `raw/01`，过契约），不是手搓的。
- schema **16 键 / 3452 B**（意图那步 1735 B，翻了近一倍）· 提示词 **3790 字符** · 说明 956 字符。
- **首发过 Zod 4/4（100%）** —— 失败分布：无。输出 1405–1869 token，7.5–10.7s。
- **id 延续**：丢失 **0/4** · 串桶 **0/4** · 发明 **1/4**（就是那个 `e-water`）。
- **R12 响了**：hostile 臂（意图多一条「二段跳」）**2/2** `rejected:intent-mechanic-missing`；normal 臂 2/2 `ok`。
- **挑近似值 0/2** —— 两条 hostile 都**整条省掉**了 `m-double-jump`，与工具说明完全一致。
- 服务端自报 `servedModel=deepseek-flash`（请求的是 `deepseek-v4-pro`）—— 代理又在换模型。

### 6. 落地时量到的（两条，都进了判据）

1. ⚠️ **「变异是空的」第四种**：第 22 发瞄的是「**不许**挑个近似的」，而判据只锚了旁边那句
   「整条省掉」⇒ 源码改了、**被测的那句话一个字没动**，于是全绿。
   ⇒ 修法是**把测试补宽**（两句都锚），不是把变异改软。**每一发变异都要瞄准「有判据看着的那句话」。**
2. ⚠️ 两处**既有 fixture 被新 gate 判死**（`runtime-profile.test.ts` 那份全空壳的设计、
   `game-design.test.ts` 里一个缺 id 的桶）—— 后者更值得记：它原本用**全空**的壳测「缺 id 要拒」，
   而新 gate 生效后那种壳会因为**一堆别的理由**被拒 ⇒ **在「id 被改成可选」时照样绿**（假阳性）。
   已改成「一份**除了那个 id 之外完全合法**的设计」。**新加一条 gate 时，回头查旧的负判据有没有被它兜住。**

### 7. 播下

- **`14`（Runtime Compiler）**：① 两条差集的**形式**在你那儿（`01-contracts.md §8`），今天恒空、
  第二个成员落地才会说话；② `levels` 只保证 **≥1**（多关卡索引还在地图的雾里，别假装支持）；
  ③ `game.camera` 是 `vws.camera.mode` 的**字面**（`"side"`），**不是** profile 的能力名 ——
  你要用它就得说清你想拿它干嘛；`game.genre` 是 `profile.id` 的副本，同样。
- **`12`（Asset Planner）**：`world.structure` 与 `levels[].layout` 是 VWS 在本步的两个落点，
  你接着用；⚠️ **设计层可以「补全」**（R2-Q1）—— 它多出来的实体不是错，你照样要给它们排资产。
  而 `derive` 的存废归你判（票 09 已播过）。
- **`16`（CLI）**：退出码映射 —— 重采样用尽/装配不过 ⇒ `EXIT.invalid`(4)；`http`/`timeout` ⇒
  `EXIT.upstream`(3)；**R12 的拒绝**也是 4，但**文案走 `rejections` 列表**（不是 `failure`）。
- **`19`（Intent QA）**：⚠️ 覆盖度的 **id 那一半已经在票 10 拒过了**（R12），
  你只剩**文本相等**那一半（它本来就是噪声那一档）；而**反向差集**（设计里多出来的实体）
  **只能是观察**，不是判据 —— 依据那半不可机械判定（R2-Q1）。
- **`15`（pipeline）**：本步吃的是**已解析**的两份上游产物 + 一个 profile ref；
  `out/<gameId>/` 的 `gameId` 从哪来**仍然没人定**（`title` 可空 ⇒ 别指望它）。
- **`17`/`18`**：无涉。

### 8. 连带改动（都记账，不是重开 R 表）

`game-design.ts`（加顶层 gate + 「意图覆盖 + 需求补全」那段裁定 + `game.genre`/`game.camera` 两处自白）·
`vocabulary.ts`（**新增 `ENTITY_BUCKETS`** —— 那个映射此前散在 `vocabulary.test.ts` 里，收上来了）·
`ledger.ts`（`LedgerStep += "compile-design"`）· `structured-call.test.ts`（枚举值那条测试）·
`runtime-profile.test.ts` / `game-design.test.ts`（两处 fixture 被新 gate 判死，已改）·
`docs/v2/01-contracts.md`（§4 加 gate / 注入 / 方向规则三处）· `03-claude-code.md §10`（头部落地指引 + 第三个输入）·
`02-implementation-plan.md`（Phase 4 输入表 + §4.1 那句已被票 03 砍掉的清单）·
`00-overview.md §10`（对账表加一行，末句改「最后五行」）· `CONTEXT.md`（新增「意图覆盖 / 需求补全」）。
