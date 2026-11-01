# Registry 形状、双基线隔离与更新通道裁定

Type: grilling
Status: open
Blocked by: 01, 02

## Question

基于 02 的研究与 01 的审计结果，逐项裁定 registry 与更新通道的形状。**本票只做裁定，不实施。**

### 待裁定

1. **Registry schema**：字段（基线 id、Manifest 路径、Anchor 路径、更新日志路径、基线身份、可选说明）与严格校验规则；拒绝缺失字段、重复基线、非法路径、指向 A/B 交叉的条目。
2. **位置与所有权**：确认 `.scratch/baselines/registry.json` 为中立位置；如何声明它不归属于 A 或 B。
3. **A 的兼容**：A 现有三个文件零改动，registry 如何引用；是否需要 descriptor 文件；扩展 `check-manifest-updates` 的形状（参数化 / 循环 / registry 驱动）。
4. **普通 PR 修改 registry 的处置**：必须与 base 字节相等，还是允许 owner 通道变更；失败诊断如何表达“registry 来自 PR head，不可信”。
5. **更新通道语义**：owner PR 改目标 Manifest/Anchor/日志 + dispatch 验证候选，还是 workflow 自动写回；如何满足“仅更新目标基线”“失败无半更新”“记录操作者/目标/旧摘要/新摘要/提交 SHA/时间”。
6. **汇总判定**：单 job 双 step 下，A/B 任一失败、step 跳过、报告缺失、artifact 缺失如何判 FAIL；`if: always()` 与真实退出状态如何同时满足。
7. **报告身份**：`verify-delivery` 报告是否需要 `baselineId`；若需要，是否属于本图允许的 CLI 扩展。
8. **B 的初始锚点与更新日志**：04 票创建时的格式、初始 freeze 条目字段、独立复算要求。
9. **冻结快照覆盖（01 审计）**：registry 是否声明 `freeze-sha256.txt`（或等价 112 文件哈希清单）路径；Evidence CI 是否额外验证 112 快照（不修改 B Manifest），还是明确接受 231 清单 + git 历史作为覆盖边界。若选前者，sparse 与 B step 必须包含该清单；若选后者，08 必须把它写成已知限制。

### 研究输入（02）

研究 §11 列出 **OD-01–OD-18**；03 必须逐项裁定或明确合并，不得跳过。推荐处理顺序：OD-05/06（head registry / Anchor / 日志差异策略）→ OD-07/08/09（更新通道、更新记录、owner-only 强制）→ OD-10/11/12（汇总判定、artifact 布局、报告身份）→ OD-13/14/15（`check-manifest-updates` 扩展、B Anchor 格式、sparse 覆盖）→ OD-16（bootstrap 顺序）→ OD-17/18（是否进 `pnpm check`、07 负向样本路径）。研究建议仅供参考，最终裁定权在 HITL。

研究已核实的两个硬事实，裁定时必须纳入：

- A/B Manifest 有 **73 个绝对路径重叠**，其中 **28 个双方 required**（`fa04`）；B 独占 109 个 required。逻辑独立成立，但物理证据部分重叠，08 必须披露；07 的 A/B 负向样本必须选各自独占 required。
- `verify-delivery` 报告没有 `baselineId`，且 A/B `subject` 完全相同；区分只能靠 `input.manifest.path/sha256`、`trust.expectedSha256`、独立 OUT 目录/artifact。

### 审计输入（01，2026-11-01 PASS）

- A/B 身份与全部 454 个清单条目 verified；A `sha256:ba7a485b…36fd` = Anchor = 更新日志；B `sha256:07866e0e…b9ab` = final-verdict。
- B 冻结快照 **112** = 清单 `out` **110**（109 required + 1 optional）+ **2** 个旧 attempt 的 `chrome.log`；2 个日志由 spec 的 `.log` 排除规则排除，仅由 `freeze-sha256.txt`（112/112 哈希一致）固定；该清单未被 231 Manifest 或 Anchor 钉住（见待裁定 9）。
- A/B 实际重叠 **73** 个绝对路径：28 双方 required / 30 A-required-B-optional / 15 双方 optional；重叠文件哈希 0 不一致；07 负向样本必须用各自独占 required。
- 审计报告：[report.md](../runs/2026-11-01T12-28-50Z-baseline-audit/report.md)。

### 约束

- 不新增 required check、不改 ruleset（Q5 a）。
- Registry 不存摘要（Q6 b）。
- A 的 Manifest/Anchor/更新日志零改动（R2-Q6 补充 4）。
- 研究只提供事实，不替用户做决定（R2-Q2 a）。

### 产出

- 在票内追加 `## Answer`，逐项写裁定与理由；必要时更新 map 的 Decisions-so-far / fog。
- 不得在 03 内实施 04/05/06 的代码；不提交、不推送。
