# 真实 GitHub PR 双基线红绿验收

Type: task
Status: open
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
