# 真实 GitHub PR 双基线红绿验收

Type: task
Status: resolved
Blocked by: 05, 06

## Question

用真实 GitHub PR 证明双基线 CI 的保护机制有效，而不是只依赖本地测试或模拟。

### 必须完成

至少 5 个 PR：

1. **正常 docs-only PR**：不修改冻结交付文件、信任锚、Manifest、registry 或验收规则；四项 required checks 全绿；**实际合并**。
2. **负向 A**：修改基线 A 的一个 required 交付文件；不修改 base 信任锚；预期 A 失败且整体 `evidence` 失败；证明 B PASS 不掩盖 A FAIL。
3. **负向 B**：修改基线 B 的一个 required 交付文件；不修改 base 信任锚；预期 B 失败且整体 `evidence` 失败；证明 A PASS 不掩盖 B FAIL。
4. **负向 C**：同时修改 B 的 Manifest 与 PR 中的 Anchor；不具备 owner 更新权限；预期仍使用 base Anchor，验收失败。
5. **负向 D**：修改 Evidence workflow 或相关校验脚本，尝试让 PR 使用自身规则；预期仍由 base 规则执行，不能绕过 required check。

### 纪律

- 负向 PR 的**创建、关闭或任何可能影响合并状态的操作，必须先取得用户确认**（Q4 b）。
- 负向 PR 只保留失败证据，**不得合并**；绿色 PR 必须实际合并。
- 每个 PR 保留：PR URL、Base SHA、Head SHA、Workflow Run URL、Required Checks 结果、关键日志/失败诊断、最终结论。
- 不得用本地模拟替代真实 PR；不得用一个负向 PR 替代另一个。

### 负向样本路径（03 Q11 已裁定）

A/B 两个 Manifest 有 **73 个绝对路径重叠**，其中 28 个双方 required（`fa04`），30 个 A required / B optional（`fpvs-v1-final/work`），15 个双方 optional；B 独占 109 个 required（`out`/freeze）。

| 负向 PR | 样本路径 | 身份 |
|---|---|---|
| A 篡改 | `.scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance/regression/test.exit` | A-only required（root `fa05`，2 B，内容 `0`） |
| B 篡改 | `.scratch/p0-02-second-demo-v2/freeze/wasteland-scavenger-recipe/run/v1/playtest/v3/success-basic/setup.json` | B-only required（root `out`，40 B） |
| B Manifest + Anchor 联合篡改 | `final-manifest.json` + 04 创建的 B Anchor | B Manifest/Anchor 自身 |
| 验收规则篡改 | `.github/workflows/evidence.yml`（可叠加 `scripts/evidence-acceptance.mjs`） | 可信 base 规则 |

- 创建 PR 前必须再次确认目标文件在最终冻结 Manifest 中的 Required 身份和 SHA-256；尤其是 B 的 `setup.json`，必须确认它是 B-only Required，而非仅仅目录属于 B。
- 报告里附选中路径、Manifest 记录、独占比对与排除的共享路径。
- 若误用共享路径（`fa04` / `fpvs-v1-final/work`），A/B 会同时失败，只能证明“整体 FAIL”，**不能**证明“A PASS 不掩盖 B FAIL”或反之，视为验收不合格。

### 产出

在 `.scratch/p0-04-dual-baseline-ci/runs/<UTC 时间戳>-pr-acceptance/` 写 `report.md` 与 `facts.json`，逐 PR 记录上述字段，并给出“是否被正确拦截 / 是否有掩盖”的结论。

## 验收标准

- 1 绿 + 4 红全部有真实 PR 与 run 证据；绿色 PR 合并成功，红色 PR 均 `mergeable_state=BLOCKED` 或等价且未合并。
- A/B 失败归属清晰，无相互掩盖；使用 03 Q11 指定路径，创建前复核 Required 身份与 SHA-256，未使用共享 `fa04` / `oldWork`。
- 报告如实写明 owner-only 限制：保护非管理员，owner 仍有 bypass；不得声称已证明非管理员无法绕过。

## Answer

**结论：PASS（2026-11-02）。** 1 绿 + 4 红均有真实 GitHub PR 证据；四个负向 PR 均 `OPEN` / `BLOCKED`、未合并。

- 报告：[report.md](../runs/2026-11-02T04-45-27Z-pr-acceptance/report.md) · [facts.json](../runs/2026-11-02T04-45-27Z-pr-acceptance/facts.json)

### 绿色 PR

- [#19 green docs-only](https://github.com/sihuayin/game-maker/pull/19)：base `f126406` · head `e8869c7` · merged `eedd15b`。
- evidence run：[41390243462](https://github.com/sihuayin/game-maker/actions/runs/41390243462)。
- `check` / `test` / `typecheck` / `evidence` 全 pass。

### 负向 PR（全部未合并）

| PR | 场景 | Base → Head | evidence | 关键诊断 | 状态 |
|---|---|---|---|---|---|
| [#20](https://github.com/sihuayin/game-maker/pull/20) | A 篡改 | `eedd15b` → `1d39563` | [41390763321](https://github.com/sihuayin/game-maker/actions/runs/41390763321) FAIL | A fail / B pass / freeze 112 → aggregate fail；`fa05:regression/test.exit` hash-mismatch | **BLOCKED / OPEN** |
| [#21](https://github.com/sihuayin/game-maker/pull/21) | B 篡改 | `eedd15b` → `934aedb` | [41390771481](https://github.com/sihuayin/game-maker/actions/runs/41390771481) FAIL | A pass / B fail / freeze 111/112 → aggregate fail；`setup.json` hash-mismatch | **BLOCKED / OPEN** |
| [#22](https://github.com/sihuayin/game-maker/pull/22) | B Manifest + Anchor 联合篡改 | `eedd15b` → `520ea4b` | [41390785603](https://github.com/sihuayin/game-maker/actions/runs/41390785603) FAIL | 可信配置 FAIL：`B Manifest differs from base Manifest`；A skipped / B fail / aggregate fail | **BLOCKED / OPEN** |
| [#23](https://github.com/sihuayin/game-maker/pull/23) | 验收规则篡改（D1：规则绕过 + A 篡改） | `eedd15b` → `66f8ced` | [41390792355](https://github.com/sihuayin/game-maker/actions/runs/41390792355) FAIL | base workflow 执行；head bypass 未执行；A fail / B pass / aggregate fail | **BLOCKED / OPEN** |

### 不相互掩盖

- 负向 A：B step success、freeze 112/112，A step failure、aggregate fail ⇒ **B PASS 不掩盖 A FAIL**。
- 负向 B：A step success，B step failure、freeze 111/112、aggregate fail ⇒ **A PASS 不掩盖 B FAIL**。
- 负向 C：trust-config 在 A/B 执行前拦截 B Manifest 篡改；A skipped、B fail、aggregate fail。
- 负向 D：run 的 steps 是 base workflow；head `evidence.yml` 的 bypass 未执行；A 篡改仍被 base 规则拦截。

### 样本复核

- A：`fa05:regression/test.exit`，A-only required，`sha256:9a271f2a…86aa`。
- B：`out:wasteland-scavenger-recipe/run/v1/playtest/v3/success-basic/setup.json`，B-only required，`sha256:7d94d491…5de2`。
- 未使用共享 `fa04` / `oldWork` 文件。

### 纪律与限制

- 绿色 PR 已实际合并；四个负向 PR 仅保留失败证据，未合并。
- owner-only：owner 仍有 bypass；本票不声称已证明非管理员无法绕过。
- 07 的报告与 facts 以及各负向 aggregate/freeze/summary 已存入 `runs/2026-11-02T04-45-27Z-pr-acceptance/`。
