# 10. 意图→机制「探索」过度抽取（mech-explore 无对家）

Type: grilling
Status: resolved
Owner: main session · 2026-10-26
Map: ../map.md

## Question

票 05 付费 E2E 重跑在 `compile-design` 挂了（退出码 4）：`intent-mechanic-missing` ——
意图里的机制「在废弃城市中探索」（`mech-explore`）在设计层没有对家。**不是背景覆盖**（票 09 已修，但这次挂在更早的 Stage A）。

根因（现场 `.scratch/fpvs-v1-p0/runs/2026-10-26-e2e/.failed-*`）：

- `analyze-intent` 把「在废弃城市中探索」抽成了一条**独立机制** `mech-explore`，
  与 `mech-horizontal-move` / `mech-jump` / `mech-collect-resource` / `mech-open-chest` / `mech-evade-danger` 并列。
- 但「探索」是**伞状活动** = 移动 + 寻找 + 抵达，不是设计层 MECHANICS 封闭枚举里的一条
  （`run` / `jump` / `collect-pickup` / `open-chest` / `reach-goal` / `avoid-danger` / …，没有 `explore`）。
- `compile-design` 三发都正确地把它「省掉」（找不到对家，见 `design-attempts.json` 的 3 条 `rejected`），
  但 R12 拒绝「悄悄做丢」→ 退 4。

裁定修在哪一层，至少覆盖：

1. **意图层**（`analyze-intent` 提示词）：教模型「探索 / 寻宝 / 冒险」这类伞状动词**分解**成
   move + find/collect + reach，不单独立条；它描述的是「用这些机制去做什么」，不是另一条机制。
2. **设计层**（`compile-design` / R12）：把「explore」这类复合机制**判成已被 run+collect+reach 覆盖**，
   不再 R12 拒绝（意图里的伞状动词不算「漏写的机制」）。
3. **词表层**（`vocabulary.ts`）：MECHANICS 加 `explore` —— 需要运行时实现，超 FPVS-V1-P0，倾向否。

HITL：用户逐字裁定，不替用户答。

## Answer（裁定 · 2026-10-26 用户逐字）

**Q 裁定：选择 (1) 意图层（分解伞状动词）。**

改 `analyze-intent` 的提示词（`packages/game-design/src/prompts.ts` 的「先分家」段 / `intentPrompt`）：
教模型「探索 / 寻宝 / 冒险」这类**概括整段玩法的伞状动词**不是一条机制，它 = 移动 + 寻找/收集 + 抵达的合称，
应**拆成**它实际包含的那几条（横版移动 / 收集 / 抵达终点），**不单独立一条 `explore`**。

**裁定边界**：

1. **只动意图层**：`analyze-intent` 提示词（含工具说明里的「先分家」段）。不动 `compile-design` / R12、
   不动 `vocabulary.ts` 的 MECHANICS 枚举（封闭枚举保持干净，不加 `explore`）。
2. **判断口令**：一条能不能**单独指向外壳的一条机制**？能才立条；不能（它概括了好几条）就拆成那几条。
3. **配套测试**：`prompts.test.ts`（game-design 包）加一条会红的测试，钉住「提示词里写着分解伞状动词」那句。

**为什么不选其他**：(2) 设计层判覆盖 —— 把「explore」做成复合机制会污染封闭枚举的语义（枚举是**primitive** 层，
   `explore` 是 composite，放进去是第二套语义）；(3) 词表层加 `explore` —— 需运行时实现，超 FPVS-V1-P0。

**补记（2026-10-26）**：实施落 [票 11](../issues/11-intent-umbrella-verb.md)。
