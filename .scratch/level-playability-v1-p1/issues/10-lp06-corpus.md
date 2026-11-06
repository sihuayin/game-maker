# LP-06 历史语料与负例验收

Type: task
Status: open
Owner: —
Blocked by: 09
Map: ../map.md

## Question

按 PRD §4.7 用冻结历史语料与研究阶段的 39 例合成矩阵做回归验收，证明新判据有实际价值且控制误报。本票 AFK。

### 必须交付

1. **冻结语料全量回归**：`sha256:25e6c891…` 的 96 唯一配对 / 20 唯一 config；逐判据新增结果。
2. **39 例矩阵全部执行**：**18 `PROVEN_UNPLAYABLE` / 17 `NO_PROVEN_BLOCKER` / 4 `INSUFFICIENT_EVIDENCE`**。逐条解释 #4（SUBJECT 修正）、#12（遗漏同关 gate）、#19（LP-00 复核覆盖 P4）、#28（只检查被包住的 pickup，同一 hazard 仍封死其后目标）；层内 verdict 与 `coverage` 必须同时断言。
3. **真实缺陷识别**：机制 A 的 3 条历史真实缺陷必须被对应判据识别；不重发布旧 run/pack。
4. **误报控制**：新增误报逐条根因分析；合法设计不得出现不可解释的误阻断。
5. **证据不足案例**：不得被强行归类为不可玩。
6. 报告：`../evidence/06-corpus-acceptance.md`；本票 `## Answer` 记录命令、退出码、计数、commit SHA。

### 边界

- 只读历史语料，不修改 `run/**` / `pack/**` / `site/**` / `fixtures/**` 或既有验收证据。
- 不追求检测率而牺牲确定性；不确定即 `INSUFFICIENT_EVIDENCE`。
- 零付费。

### 通过标准

- AC-08：冻结语料与 39 例矩阵完成验收。
- AC-09：不存在未解释的新增误阻断。
- 最终措辞只能是「零不可解释误伤」，不是「新增 error = 0」；`NO_PROVEN_BLOCKER` 不写成「可玩」。
