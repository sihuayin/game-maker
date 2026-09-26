# 17. RepairProgress / Stalled / Best Artifact 的判定与回滚机制

Type: grilling
Status: resolved
Blocked by: —
Map: ../map.md

> ⛔ **已判出局**（2026-09-24，R2）。判出局的**不是问题本身，是本图的终点**：
> 它属于「QA 闭环」那一簇，回答的是「AI 能不能自己判断做得好不好并改进」，
> 而重画后的终点是「能不能产出两个可用的东西」。
> Stalled / Best Artifact 是 Repair 循环的判定。
>
> **文件保留、不删除** —— 里面的实测数据与分析对将来那张闭环地图仍然有效。
> 永不毕业：只有重画 Destination 才会回来，且那时是一张新地图。

## Question

Q6 决定了自我迭代的验收是**单调改进**：必须实现文档第 46 节的
`RepairProgress` + Stalled 检测，和第 47 节的 Best Artifact 回滚，
**保证不会越修越差**。

契约里已经有 `BestStateSchema`（artifacts / qualityScore / gateStatus / iteration），
`orchestrator.ts` 的 `finalize()` 里也在写 `run.best` —— 
但它写的是**最后一轮**的结果，不是**最好的一轮**。
`RepairProgress` 和 `RepairExperiment` 在契约里**根本不存在**
（文档第 46、48 节有定义，`demo/src/contracts/index.ts` 里没有）。
这是一处**文档与代码的实质性缺口**。

阻塞在票 16：得先知道一轮 repair 改了什么、改了几个，才能定义进展和归因。

要 grill 出的问题：

1. **比较用哪个分数**？三个候选，语义完全不同：
   - `gate.quality.score`（加权质量分，连续）—— 适合比较「谁更好」
   - `gate.hardGate.passed`（布尔）—— 适合判定「能不能交付」
   - `gate.status`（pass/fail/warning）
   **一个 run 可能 quality 涨了但 hard gate 仍然 fail**
   （比如 visual 从 0.7 涨到 0.9，但 core requirement 还是没实现）。
   Best 该按哪个选？建议：**hard gate passed 优先，其次 quality score**
   （一个能交付的 0.86 版比不能交付的 0.95 版更有价值）—— 但这个要确认。
2. **Stalled 怎么判定**？文档第 46 节的例子是
   `72→74`、`74→73`、`73→73` 判定为 Stalled。规则是什么？
   - 连续 N 轮 improvement ≤ 阈值？N 和阈值各是多少？
   - **分数下降算不算 stalled**？（文档例子里 74→73 是下降，被算进去了）
   - Q17 把 budget 收到 **3 轮** —— 那 stalled 检测在 3 轮内还有意义吗？
     （连续 2 轮无改进就 stalled，第 3 轮切策略 —— 刚好够，但很紧。）
     **这个 tension 要解决**：要么放宽 budget，要么承认 stalled 检测
     在 demo 阶段基本不会触发。
3. **Stalled 之后「切换策略」具体怎么做**？文档第 46 节只说
   `Switch Strategy`。切到哪个？怎么知道还没试过哪些？
   需要一份「已尝试策略」的记录 —— 那就是文档第 48 节的
   `RepairExperiment`。**Q6 把 RepairExperiment 划到了 fog 之外吗？**
   （charting 时的结论是「C 属于 fog」—— 但如果没有 experiment 记录，
   stalled 后的策略切换就是瞎猜。**这个矛盾要在本票解决**：
   要么把 RepairExperiment 的最小版本拉回范围，要么承认策略切换是随机的。）
4. **回滚的物理机制**：Best 是 v2，当前跑到了更差的 v3，
   怎么回到 v2？
   - 文件级：`assets/cow/v2` 还在（票 16 第 5 条保证了版本化），
     只需把 Game Config / Manifest 的引用指回 v2
   - run 级：整个 run 状态回滚（需要 checkpoint，票 07 只写不读）
   **回滚之后还继续修吗**，还是直接 finalize 交付 Best？
   状态机支持吗？（`repairing → generating` 可以重新生成，
   但「用旧版本重建」这个语义状态机里没有。）
5. **`finalize()` 的 bug**：现在它无条件把**当前**产物写进 `run.best`。
   如果最后一轮比中间某轮差，Best 就被污染了 —— 
   这正是文档第 47 节明令禁止的「不能让 v3 覆盖 v2」。
   本票必须修掉它。**什么时候更新 Best**？每轮 evaluate 之后立刻比较更新？
6. **契约缺口**：`RepairProgress` / `RepairExperiment` 要不要加进
   `demo/src/contracts/index.ts`？加了之后 `CreationRunSchema` 要不要
   挂一个 `progress: RepairProgress[]`？（**改契约要慎重**，
   但这里是文档已定义、代码缺失，属于补全而非变更。）
7. **HTML 报告的联动**：票 06 的报告要展示「至少一轮让分数上升的修复」
   （Q14 验收标准）。这条数据从哪来 —— `RepairProgress[]`？
   本票的产出直接决定票 06 能不能兑现验收标准。**如果票 06 已经做完，
   本票要回头补它的数据源。**

调用 `grilling` 与 `codebase-design` skill。
**产出是：Best 的比较函数定义 + Stalled 判定规则（含具体数字）+
回滚机制 + `finalize()` 的修正方案 + 契约补全清单。**
第 3 条那个矛盾必须给出明确结论，不许含糊。

## Answer

_（待填）_
