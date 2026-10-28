# FA-01B gate 停点确认与判定修复

Type: task
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md
Blocked by: 01

## Question

FA-01A 静态推断：`reach_goal` / `move_to gate` 在 `x >= gate.x - 20`（本关约 1360）就停，
而 gate 盒左边界为 1380、玩家右边界为 `x+12`，可能还差约 8px 才触发 `tryWin()`。
本票用真实运行确认或否定，并在确认后按**确定性缺陷**修复，消除「`gateReached=true` / `won=false`」
被误归因为 `GAMEPLAY_FAILURE` 的风险。

1. 在 FA-01 冻结快照的工作区上，用最小动作（`move_to gate` 或 `reach_goal`）跑一次真实诊断；
   读 gate 静态体左边界、玩家右边界、`won`、`gateReached`、`win` 事件。
2. 判定：是停点阈值与 gate 盒不一致（harness 确定性缺陷），还是静态推断不成立。
3. 若成立：修复 `targetReached` / `gateReached` 的判定（按 gate 盒左边界或玩家右边界），
   补离线测试；不修改游戏、不修改 shell、不改场景协议。
4. 若否定：记录证据并关闭；不制造修复。
5. 产出 `runs/<date>-gate-stop/`（诊断报告 + 证据 + 修复 diff/测试如适用）。

边界：只修 harness 停点判定；不顺手改策略/动作语义（那是 FA-01C）；快照零写入。

**范围裁定（必须先答）**：本修复位于 `packages/demo/probe/playtest/policy.mjs`（harness 代码），
**不在「配置/管线」层**。按用户 2026-10-27 规则，先裁定它是否属于「只需修改配置或管线即可修复的
确定性缺陷」；若不属于且也不属于「重写 Runtime」，本票不得擅自修改，转 FA-01C 一并裁定。

## Answer（2026-10-27）

**确认并修复。**

- 真实运行（无 setup）120s 只到 x=813（24 次 reset），无法直接量停点；用 `mutate-hazard`
  把第二只巡逻怪移远做隔离诊断（明确标注：不是验收证据）。
- 修复前隔离诊断：collected=6、chestsOpened=2，停在 `x=1360.5 / right=1372.5`、`won=false`
  → **7.5px 缺口确认**。
- 修复：`policy.mjs:77` + `observe.mjs:131` 改为 `right >= gate.x && bottom >= gate.y`。
  只加水平条件会停在 gate 盒上方空中（`x=1369.5 / right=1381.5 / bottom=201.75`），
  所以垂直重叠是必要的。
- 修复后隔离诊断：`x=1374 / right=1386 / bottom=208.5`、`collected=6`、`won=true`、`win=1`、
  `terminationReached=true`、`move_to=completed`。
- 测试：新增 4 个离线用例；`pnpm test:playtest` 81 测试 + self-test 全绿；站点字节未改。
- 范围裁定：harness 确定性缺陷（停点阈值与 gate 盒不一致），不是重写 Playtest V1，
  不改游戏/shell/协议；按 doc §7.1 的确定性缺陷修复执行。
- 过程事故：`pnpm test:playtest` 的 self-test 默认覆盖了已跟踪的
  `.scratch/playtest-v1/runs/2026-10-27-self-test/`（10 个文件）；已 `git restore --source=HEAD` 恢复，
  当前工作树只剩 3 个预期代码文件改动。FA-06 需先隔离 self-test 输出。
- 限制：诊断把第二只巡逻怪移远，**不能证明真实危险物下可通关**；FA-02 必须在真实运行中取证。
- 报告：`runs/2026-10-27-gate-stop/README.md`。

→ 解除 FA-01C 阻塞；FA-02 仍需 FA-01C / FA-01D。
