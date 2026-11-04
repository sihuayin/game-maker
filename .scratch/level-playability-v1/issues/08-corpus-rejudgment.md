# 历史语料重判

Type: task
Status: open
Owner: —
Blocked by: 03, 04, 05, 06
Map: ../map.md

## Question

把 03–05 的候选判据应用到 06 的历史语料清单，产出**零误伤基线**：新增 error 数量、逐条解释、覆盖缺口。不得修改语料。

### 必须交付

1. **执行方式**：在 `.scratch/level-playability-v1/` 下写一次性分析脚本（不进入 `packages/**`），或逐条人工复核；记录命令、退出码、路径。
2. **逐判据结果**：每条判据在语料上的命中数、`PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 分布。
3. **逐条解释**：每条新增 error 的路径、实体、原因、是否可解释；不得只报总数。
4. **覆盖缺口**：06 标记为不可用的条目，逐条说明为什么不可重判。
5. **误伤判定**：把新增 error 分为「真实缺陷 / 既有合法设计被误伤 / 判据不稳」；对「既有合法设计被误伤」给出反例与修正建议（不实施）。
6. **零误伤结论**：只有「无不可解释的新增误伤」才算通过；有误伤则回到 03–05 修正判据，不得进入 09。
7. **旧 schema 边界**：引用 06 的归一化 / 排除口径；parser 失败与缺 manifest 的条目不得计入新增 error，必须单列。

### 输出

- `../corpus/rejudgment.md` + `../corpus/rejudgment.json`（或等价）。
- 本票 `## Answer` 摘要；更新 map 的 Decisions so far。

### 边界

- 只读语料；不修改历史产物。
- 分析脚本不得进入生产包；不得新增依赖（除非另行审批）。
- 不把「新增 error 为 0」直接当作判据有效；必须结合 07 的合成负例。
