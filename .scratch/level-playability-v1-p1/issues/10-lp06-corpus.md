# LP-06 历史语料与负例验收

Type: task
Status: resolved
Owner: amber · 2026-11-06
Blocked by: 09
Map: ../map.md

## Question

按 PRD §4.7 用冻结历史语料与研究阶段的 39 例合成矩阵做回归验收，证明新判据有实际价值且控制误报。本票 AFK。

### 必须交付

1. **冻结语料全量回归**：`sha256:25e6c891…` 的 96 唯一配对 / 20 唯一 config；逐判据新增结果。
2. **39 例矩阵全部执行**：整关最终分布 **19 `PROVEN_UNPLAYABLE` / 16 `NO_PROVEN_BLOCKER` / 4 `INSUFFICIENT_EVIDENCE`**（用户 2026-11-06 裁定，批准 LP-04 的 19/16/4，不修改 #39）。逐条解释 #4（SUBJECT 修正）、#12（遗漏同关 gate）、#19（LP-00 复核覆盖 P4）、#28（只检查被包住的 pickup，同一 hazard 仍封死其后目标）、#39（机制层 A 阻断 gate，完成性抑制）。层内 verdict 与 `coverage` 必须同时断言。
   - 保留 #39 原始合成夹具（64×48 hazard），不因统计口径修改夹具。
   - 分别记录空间层、机制层、完成性层的 verdict；记录完成性抑制重复归因的原因。
   - `auditPlayability` 的整关 aggregate 按用户裁定的**三层 verdict 组合**（LP-05），`coverage` 单独断言；`NO_PROVEN_BLOCKER + partial` 不得写成 `PROVEN_PLAYABLE`。
   - 明确区分「层内发现」与「整关最终归因」：`two-one-way-branches` 整关 PROVEN 归空间层；`chest-overlapping-hazard` 整关 PROVEN 归机制层。
   - 保留研究 05 的「有效 gate no-walk = 0」结论；它与跨层归因不冲突。
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

## Interim（2026-11-06，等待裁定）

- 冻结语料：96 唯一配对 / 20 唯一 config（31 唯一内容组合）；**3 条历史真实缺陷全部被机制 A 识别**，0 playability 误报，6 个 probe 夹具排除；6 份移动 hazard 的 level config 落 `INSUFFICIENT_EVIDENCE`。
- 39 例矩阵：**案例级预期 19/16/4**；**实际 `auditPlayability` 组合 19/9/11**。7 个带合法宽巡逻 hazard 的空间边界（baseline / gap-40 / wall-40 / pickup-50 / chest-range30 / pickup-on-luggage / target-at-edge）被 LP-03 已批准的 `moving-hazard-phase` gap 拉成 `INSUFFICIENT`，不是新增误报、不是硬拒。
- 证据：[06-corpus-acceptance.md](../evidence/06-corpus-acceptance.md)、`06-corpus-regression.json`、`06-matrix-acceptance.json`。
- **待用户裁定 A/B/C**：接受实际 19/9/11 / 收紧巡逻 gap / 改矩阵预期为 19/9/11。未改判据、夹具或历史语料。

## Answer

**2026-11-06 完成（LP-06，AFK）。证据 commit `203ad8a`；实现基线 `ca096cf`。用户裁定采用 (A)。**

### 冻结语料

- inventory `sha256:25e6c891…` 复算通过；**96 唯一配对 / 20 唯一 config / 31 唯一内容组合**。
- 配对级：`PROVEN 36` / `INSUFFICIENT 36` / `NO_PROVEN 24`。
- 唯一 config（排除 6 个 probe 夹具后 14 份）：
  - **3 条历史真实缺陷**全部被机制 A 识别：`pickup-water-4`/`goal-1`、`scrap-4/5/6`/`gate-1`、`pickup-3`/`chest-1`/`gate`。
  - **0 playability 误报**；6 个 probe 夹具排除。
  - 6 份移动 hazard 的 level config 落 `INSUFFICIENT_EVIDENCE`（`moving-hazard-phase`），未硬拒。
  - 5 份既有审计 error（2 gate 缺失 + 3 chest 引用）归引用族 / 自洽族，不计为 playability 新阻断。
- 不重发布旧 run/pack；未修改任何历史语料。

### 39 例矩阵

- **层内 / 案例级预期：19 PROVEN / 16 NO_PROVEN / 4 INSUFFICIENT**。
- **实际 `auditPlayability` 组合：19 PROVEN / 9 NO_PROVEN / 11 INSUFFICIENT**。
- 差异：7 个带合法宽巡逻 `carriage` 的空间边界（baseline / gap-40 / wall-40 / pickup-50 / chest-range30 / pickup-on-luggage / target-at-edge）被 LP-03 已批准的 `moving-hazard-phase` gap 从 NO_PROVEN 拉成 INSUFF；不是新增误报、不是硬拒。
- #32 整关 PROVEN 归空间层、#39 归机制层；完成性对两者正确抑制。
- 逐条解释 #4 / #12 / #19 / #28 / #39 见报告 §2.3。
- 有效 gate no-walk = 0（研究 05）保持。
- 全部合法配对未被硬拒（无 PROVEN）。

### 用户裁定（2026-11-06）

采用 **(A)**：接受 **19 / 9 / 11** 为实际组合分布；**19 / 16 / 4** 保留为层内 / 案例级预期。不改判据、不改夹具、不改历史语料。

### 命令与证据

- `node .scratch/level-playability-v1-p1/acceptance-corpus.mjs` → exit 0；`evidence/06-corpus-regression.json`。
- `node .scratch/level-playability-v1-p1/acceptance-matrix.mjs` → exit 0；`evidence/06-matrix-acceptance.json`。
- 报告：`evidence/06-corpus-acceptance.md`。
- `pnpm test` → 168 文件 / 2550 例，exit 0；`pnpm typecheck` / `pnpm build` exit 0（LP-05 基线）。

### 残余

- 6 份移动 hazard 的 level config 保持 `INSUFFICIENT_EVIDENCE`；16 份含巡逻 hazard 的语料口径不变（LP-03）。
- 7 个合法空间边界在整关组合里是 INSUFF（覆盖缺口），不是不可玩；LP-07 报告必须两列并陈。
- 测试 runner 的 20s / RPC workaround 仍在 `vitest.config.ts`，LP-07 复核。

### 回退点

证据 / 脚本 / 报告是纯只读新增；撤销 `203ad8a` 即可。判据与夹具未改。
