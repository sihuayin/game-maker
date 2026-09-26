# 13. GameplayTestPlan 的规则推导模板集

Type: grilling
Status: resolved
Blocked by: —
Map: ../map.md

> ⛔ **已判出局**（2026-09-24，R2）。判出局的**不是问题本身，是本图的终点**：
> 它属于「QA 闭环」那一簇，回答的是「AI 能不能自己判断做得好不好并改进」，
> 而重画后的终点是「能不能产出两个可用的东西」。
> GameplayTestPlan 是 Gate 的输入。
>
> **文件保留、不删除** —— 里面的实测数据与分析对将来那张闭环地图仍然有效。
> 永不毕业：只有重画 Destination 才会回来，且那时是一张新地图。

## Question

Q16 决定了双轨：**规则推导生骨架（保证 critical path 结构性覆盖）+
LLM 补边界 case**。理由是 Critical Gameplay 是硬门禁
（文档第 38 节要求 100%），绝不能让 LLM 的采样运气决定它有没有被覆盖。

但「规则推导」这四个字底下什么都没有。`GameplayTestCaseSchema` 已经定义了
形状（category / preconditions / actions / assertions / critical），
文档第 16 节给了一个农场例子，**中间的映射规则一条都没写**。

阻塞在票 09：推导规则的输入是 Game Config，Config 的 schema 没定就没法写规则。

要 grill 出的问题：

1. **推导的输入到底是什么**？从 Game Config 的哪些字段推？
   - `requirements[]` → 每条 requirement 至少一个 test？
   - `entities[]` 里 `interactive: true` 的 → 每个至少一个 interaction test？
   - `交互规则`（票 09 第 3 条）→ 每条规则一个 mechanic test？
   - `winConditions` → win test；`loseConditions` → lose test？
   - `关卡/进度结构`（票 09 第 4 条）→ progression test？
2. **八个 category 各自的推导来源**：
   `boot` / `navigation` / `interaction` / `mechanic` / `progression` /
   `win` / `lose` / `ui`。逐个定：哪些是**无条件必生成**的
   （比如 `boot` 永远要有，不需要任何输入），哪些是从 Config 推的。
3. **Critical Path 怎么被识别**？文档第 33 节的那条链
   `Boot → Move → Reach Crop → Interact → Harvest → Inventory Increase → Objective Complete`
   —— 它是**一个** test case（一串 actions + 一串 assertions），
   还是**一串** test case（每步一个，靠 preconditions 串起来）？
   两种做法的失败诊断能力完全不同：
   前者只告诉你「critical path 挂了」，后者告诉你「挂在第 4 步」。
4. **critical 标记的归属**：`GameplayTestCase.critical` 和
   `GameplayTestPlan.criticalTests[]` 两处都记了 critical，会不会不一致？
   哪个是真相来源？（这是契约里的一个冗余，要不要消掉？）
5. **assertions 够不够用**？`TestAssertionSchema` 现在有六种：
   `entity_exists` / `entity_state` / `variable` / `scene` / `ui_visible` /
   `game_state`。文档第 33 节的 Critical Path 里有
   「Inventory Increase」—— 这要用 `variable` 断言，那 `variable` 的
   `target` 命名空间是什么（`inventory.tomato`？`player.inventory.tomato.count`？）？
   **这个命名空间必须和 Game Config、Bridge（票 10 第 1 条的
   `player: z.record(z.unknown())` 逃生舱）三方对齐**，否则断言无处可查。
6. **覆盖率的可追溯性**：`RequirementCoverage.missing[]` 要能说出
   「哪条 requirement 没有测试覆盖」。这要求推导过程记录
   requirement id → test id 的映射。这个映射存在哪？
   是不是该进 `GameplayTestPlan` 的 schema（现在没有这个字段）？
7. **LLM 补充部分的边界**：LLM 生成的 test case 要不要经过
   「不得标记为 critical」的限制？（如果 LLM 能自己标 critical，
   它就获得了让 Gate 失败的能力 —— 这是好事还是坏事？）
   LLM 产出校验失败时怎么办：丢弃、重试、还是整个 plan 降级到 fixture？
8. **推导规则本身怎么测**？这是纯函数，应该有单元测试。
   用什么 fixture 测（票 09 产出的 Cozy Farm Config）？

调用 `grilling` 与 `codebase-design` skill。
**产出是一份推导规则表（输入字段 → category → actions 模板 → assertions 模板 →
critical 与否）+ 用 Cozy Farm Config 实跑出来的 GameplayTestPlan 实例。**

## Answer

_（待填）_
