# 16. Repair 动作集：在「数据 + 纯函数」范式下，修什么、谁来修？

Type: grilling
Status: open
Blocked by: 05, 09, 12
Map: ../map.md

## Question

这是「让 AI 自行检查、自我迭代优化」的**心脏**，也是整个项目最容易失败的地方。
现状：`demo/src/repair/repair-engine.ts` 的 `plan()` 是**字符串匹配**
（`blocker.toLowerCase().includes("asset")` → `ASSET_REGENERATION`），
`execute()` 是**空函数**。

Q15 把修复对象限定成了「数据 + 纯函数」，这**大幅收窄**了 repair 的可能性空间
（好消息：改 JSON 字段和改绘制参数是精确、可回滚、可 diff 的），
但**具体动作集一条都没定**。

阻塞在票 05（Asset 长什么样才知道能改什么）、票 09（Config 长什么样）、
票 12（Visual QA 报出什么 issue 才知道要修什么）。

文档第 42 节给了六条诊断→动作的映射，第 44 节给了七个策略名
（`STYLE_REGENERATION` / `PROMPT_CORRECTION` / `ASSET_REPLACEMENT` /
`SCENE_LAYOUT` / `UI_REDESIGN` / `CODE_FIX` / `RUNTIME_FIX`）。
逐个落地：

1. **每个策略具体改什么**？在 Q15 范式下：
   - `STYLE_REGENERATION` → 重新生成哪些 Asset？全部还是只重生成被点名的？
     改的是绘制参数还是重新问 LLM？
   - `PROMPT_CORRECTION` → 修正**哪个** prompt？下一次调用的 prompt
     怎么根据这次的失败改写？这需要把失败原因塞回 prompt，
     那 prompt 就变成有状态的了 —— 怎么管理？
   - `ASSET_REPLACEMENT` → 与 `STYLE_REGENERATION` 的区别是什么？
     （契约里 `RepairAction.type` 只有 asset/code/scene/ui/runtime 五种，
     但策略名有七个 —— **这个映射关系没定**）
   - `SCENE_LAYOUT` → 改 Game Config 的场景布局字段
   - `UI_REDESIGN` → 改 Game Config 的 ui 字段
   - `CODE_FIX` → **改什么代码？** Q15 说 Phaser 主循环是手写固定的，
     AI 不生成代码 —— 那 `CODE_FIX` 在这个范式下**还有意义吗**？
     如果没有，要不要从策略集里删掉？
     如果有（比如修 AI 生成的绘制函数），那它和 `STYLE_REGENERATION` 怎么区分？
   - `RUNTIME_FIX` → 同上问题：手写代码坏了，AI 能修吗？该修吗？
     **这大概应该直接让 run fail 并报告「框架代码有 bug」，
     而不是让 AI 去改手写代码** —— 后者会破坏 Q15 的整个边界。
2. **谁来决策**：修复方案由 `deepseek-v4-flash`（Q8）生成，
   还是由规则从 issue 类型直接映射？
   现在的字符串匹配实现显然是占位。
   **如果交给 LLM，它可能提出一个越界的 action**
   （比如要求改手写代码）—— 谁来拦？怎么拦？
3. **Evidence 怎么进 prompt**：文档第 59 节说 Repair Agent 读
   `Issue + Evidence + Spec`。截图是 Evidence 的一种 —— 
   `flash` 支持图像输入（票 01 已确认），所以**要把截图真的喂给修复模型吗**？
   还是只喂结构化的 issue 文本？前者更强也更贵更慢。
4. **一次修几个**：`RepairPlan.actions[]` 是数组。
   一轮里修全部 blocker，还是只修最严重的一个（更容易归因）？
   **修多个会让 RepairProgress 无法归因** —— 分数涨了，是谁的功劳？
   这与票 17 的 Stalled 检测直接冲突。
5. **版本化怎么落地**：文档第 21 节要求 `cow/v1`、`cow/v2` 并存。
   一次 asset repair 产生一个新 version，那
   `AssetManifest.assets[]` 指向哪个 version？
   Game Config 引用的是 assetId 还是 assetId+version？
   **这决定了回滚（票 17）能不能做**。
6. **budget 的消耗计量**：`RepairBudget` 有
   `maxAssetRegenerations` / `maxCodeRepairs`，
   但现在的 `orchestrator.ts` **完全没有检查它们** —— 
   只检查了 `maxIterations`。这是个真实缺陷，本票要不要一并修？
7. **修不动的情况**：如果 blocker 是「requirement 根本没实现」
   （Game Config 里缺了这个实体），repair 能做什么？
   回去改 Game Config 意味着**重跑 compile** —— 
   但状态机（票 08 之后）只支持 `repairing → generating/building`，
   **回不到 compiling**。这是不是又一个状态机缺陷？

调用 `grilling` 与 `codebase-design` skill。
**产出是一份策略表：每个策略的 {触发条件, 修改对象, 决策者(LLM/规则),
产出新 version 的方式, budget 计量}，外加对 `CODE_FIX`/`RUNTIME_FIX`
在 Q15 范式下存废的明确结论。**

## Answer

_（待填）_
