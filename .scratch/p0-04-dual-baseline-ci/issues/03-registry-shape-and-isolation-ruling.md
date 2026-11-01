# Registry 形状、双基线隔离与更新通道裁定

Type: grilling
Status: resolved
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

## Rulings（round 1，2026-11-01）

用户裁定：**Q1 (1) / Q2 (1) 并接受 bootstrap / Q3 (1) / Q4 (1) / Q5 (1)**。五项整体批准。

| 问题 | 裁定 | 核心决定 |
|---|---|---|
| Q1 Registry 形状与冻结覆盖 | (1) | 严格集中式 Registry，增加 `freezeHashes` 路径字段；B 验证 112 个冻结文件。 |
| Q2 普通 PR 信任配置策略 | (1) | A 保持原有失败面；B 严格比较 Manifest、Anchor、更新日志及冻结哈希文件；接受 bootstrap 语义。 |
| Q3 更新通道 | (1) | owner PR 提交候选，dispatch 只读验证，不自动写回 Base。 |
| Q4 汇总判定与 Artifact | (1) | A/B 独立验证、完整聚合判定、三份独立 Artifact。 |
| Q5 报告身份 | (1) | 不改 `verify-delivery`，由 `evidence-acceptance` 的 `summary.json` 增加可选 `baselineId`。 |

### 锁定的 Registry schema

- 顶层：`format`、`baselines`。
- 每项：`id`、`name`、`manifestFormat`、`manifest`、`anchor`、`updateLog`、`identity`。
- `freezeHashes`：可选路径字段，B 必填，A 不需要。
- 不存摘要、不存 counts。
- 严格拒绝未知字段。
- 路径为仓库根相对 POSIX 路径。
- 所有解析后的 realpath 必须处于仓库内。
- Manifest、Anchor、更新日志必须同目录；`freezeHashes` 是独立冻结快照文件的路径例外。
- A/B 的文件路径不得交叉。
- Workflow 必须显式断言基线集合恰好为 `fpvs-v1` 和 `p0-02-second-demo-v2`，不能只相信 Registry 自己声明了什么。
- B 的 112 文件快照必须逐条验证 PR Head 对应文件的 SHA-256；2 个不在 231 Manifest 中的 `chrome.log` 也必须纳入冻结快照验证。

### 锁定的 A/B 非对称策略

- A：保持 P0-03 现状，只比较 Manifest 字节一致性。
- B：Manifest、Anchor、更新日志、`freezeHashes` 文件都必须与 Base 字节一致。
- Registry：A/B 共用的 Registry 本身必须与 Base 字节一致。
- A 的 Anchor 和更新日志副本即使被 PR 修改，也不能影响 CI 实际使用的可信 Base 内容；08 必须如实记录这一差异，不能声称 A/B 的 head-side 信任元数据检查完全对称。
- Bootstrap 硬条件：05 引入 Registry 的 PR，必须由可信 Base 上的旧 workflow 执行 owner dispatch 验证候选；必须明确区分 Base workflow、候选 PR Head 和目标 SHA；验证通过后才能合并，不能让候选 Head 自己提供的 workflow 成为验证依据。

### 锁定的更新通道语义

- `baseline` 必填，无默认目标。
- dispatch 读取候选 PR，不直接修改 Base。
- 只允许目标基线的 Manifest、Anchor、更新日志，以及对应 Registry entry 发生变化。
- 非目标基线及非目标 Registry entry 必须字节相等。
- 失败时 Base 完全不变。
- Artifact 保存 `baseline-update-meta.json`，记录 operator、target、old/new、candidate SHA 和时间。
- 使用 `github.actor_id`、`triggering_actor` 等审计字段，不增加 actor allowlist。
- **`freezeHashes` 的独立边界**：B 的 `freeze-sha256.txt` 属于冻结快照的身份依据，不属于普通更新目标。B 的正常 Manifest/Anchor 更新不能顺便改写该文件；若未来需要重新冻结 112 文件快照，应另立裁定和新的冻结版本，不能借普通 dispatch 完成。**此条必须列为独立验收项。**

### 锁定的聚合判定

- A 验证 step 保持原样；B 验证 step `if: always()`；Aggregate step `if: always()`。
- 检查 A/B 真实 step outcome、各自 `summary.json` 的 `pass/status/exitCode`、`report.json` 的 `status`、输入 Manifest 路径和 SHA-256、`trust.result=matched`、必要文件和 Artifact 实际存在。
- 任一项缺失、skipped、失败或身份不匹配，整体 `evidence` 必须 FAIL。
- 不使用 job 级 `if`，不使用 paths 过滤。
- Artifact 分别为 A、B、aggregate 三份，`if-no-files-found: error`，保留 30 天。

### 锁定的报告身份

- 不修改 `verify-delivery`；不修改既有报告 schema。
- 由 `evidence-acceptance` 接收 CI 传入的 `baselineId`。
- A/B 使用独立 OUT 目录和 Artifact 名称。
- Aggregate 根据可信 Registry、预期 Manifest 路径与 SHA-256、Anchor 验证报告身份。
- `baselineId` 是 CI 验收摘要的可选字段，不得变成旧报告必须具备的新字段。

### 本轮未批准

- 修改 A 的历史失败面。
- 自动写回 Base。
- 修改 `verify-delivery` schema。
- 扩大冻结快照更新权限。

## Rulings（round 2，2026-11-01）

用户裁定：**Q6 (1) / Q7 (1) / Q8 (1) / Q9 (1) / Q10 (1) / Q11 (1)**。六项全部批准，按推荐方案执行。

| 问题 | 裁定 | 关键约束 |
|---|---|---|
| Q6 脚本扩展 | (1) | 现有 `check-manifest-updates.mjs` 零改动；新增 Registry 驱动的 wrapper。 |
| Q7 B Anchor 与日志格式 | (1) | 单行 SHA-256；Markdown 追加日志；兼容 A 旧字段。 |
| Q8 Sparse checkout | (1) | Workflow 硬编码 A/B union；B 验证全部 112 个冻结文件。 |
| Q9 Registry 引入顺序 | (1) | 05 引入 Registry；06 依赖 05。 |
| Q10 Registry 校验 | (1) | 05 增加单元测试，不纳入 `pnpm check`。 |
| Q11 负向样本路径 | (1) | 接受给出的四类样本路径，使用 A/B 独占 Required 文件。 |

### Q6：保持旧脚本行为不变

新增 `scripts/check-baseline-updates.mjs`：

- 从 Registry 读取 A/B 配置。
- 分别调用现有 `scripts/check-manifest-updates.mjs`。
- B 增加严格日志字段校验。
- A 继续使用兼容字段规则。
- 04/05 必须验证原脚本调用的输出、退出码和失败行为没有变化。
- 不能为了统一实现而重构旧脚本。

### Q7：B 锚点必须可复算

`sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab` 不能直接作为未经验证的初始值写入。04 必须留下：

- 完整 64 位摘要。
- 被计算文件的精确路径。
- 原始字节计算方式。
- 独立复算命令与结果。
- 冻结来源及对应提交 SHA。

B 日志初始 freeze 条目采用 A 兼容字段；新增字段可以追加，但不能要求 A 历史记录补字段。

### Q8：112 文件全部按 Required 验证

112 文件快照是**额外冻结完整性边界**，不是 231 文件 Manifest 的重复检查。

- 两个 `chrome.log` 即使不在正式 Manifest 中，也必须验证。
- `freeze-sha256.txt` 从可信 Base 读取。
- 对 PR Head 中的 112 个文件逐项复算。
- 任一文件缺失或摘要不符，B FAIL。
- Registry 所声明的路径或 Manifest root 未被 checkout，必须以 `registry.sparse-missing` FAIL，不能静默跳过。

### Q9：依赖关系正式调整

```
01 ─────┐
        ├──> 03 ──> 04 ──> 05 ──> 06 ──┐
02 ─────┘                              │
                                       v
                                      07 ──> 08
```

- 01、02：并行。
- 03：依赖 01、02。
- 04：依赖 03。
- 05：依赖 03、04。
- 06：依赖 03、04、05。
- 07：依赖 05、06。
- 08：依赖 07。
- 05 的 bootstrap 必须使用可信 Base 上的旧 workflow 验证候选，不能由候选 PR 自证。

### Q10：不提前污染全局检查

Registry 尚未合并时，不得让所有 PR 的 `pnpm check` 因 Registry 缺失而失败。05 的测试至少覆盖：

- 严格 schema 和未知字段拒绝。
- 重复 ID。
- 缺失必需基线。
- A/B 路径交叉绑定。
- 仓库外 realpath。
- 非 POSIX 路径。
- `freezeHashes` 的 B 必填、A 不需要。
- Registry 基线集合与 workflow 固定集合不一致。

### Q11：负向 PR 使用独占文件

接受四类路径，但 07 创建前仍需再次确认目标文件在最终冻结 Manifest 中的 Required 身份和 SHA-256。

尤其是 B 的 `setup.json`，必须确认它确实是 B-only Required，而非仅仅在目录上属于 B。

### 本轮未批准

- 改变 A 的既有脚本、冻结文件或失败面。
- 重写 B 的 112 文件冻结快照。

## Answer

**03 已收口（2026-11-01）。** 全部 OD-01–OD-18 已由两轮裁定覆盖；Registry 形状、双基线隔离、普通 PR 信任配置策略、更新通道、聚合判定、报告身份、脚本扩展、冻结覆盖、实施顺序、测试落点与负向样本均已锁定。

| 决策 | 裁定摘要 |
|---|---|
| Q1 Registry | 集中式 `.scratch/baselines/registry.json`；严格 schema；`freezeHashes` B 必填、A 不需要；不存摘要/counts；A/B 必需集合由 workflow 断言。 |
| Q2 head 信任配置 | Registry 字节相等；A 只比 Manifest（保持原失败面）；B 比 Manifest + Anchor + 更新日志 + `freezeHashes`；bootstrap 由 base 旧 workflow 的 owner dispatch 验证候选。 |
| Q3 更新通道 | owner PR + 只读 dispatch；`baseline` 必填；diff 白名单；非目标字节相等；不自动写回；`freezeHashes` 不是普通更新目标。 |
| Q4 聚合 | 单 job 双 step；A/B/aggregate 均完整判定；A/B/aggregate 三份 artifact；`if-no-files-found: error`；禁止 job 级 `if`/paths 过滤。 |
| Q5 报告身份 | 不改 `verify-delivery`；`evidence-acceptance` summary 增加可选 `baselineId`；独立 OUT/artifact；aggregate 按 registry/Anchor 校验。 |
| Q6 脚本 | 旧 `check-manifest-updates.mjs` 零改动；新增 `scripts/check-baseline-updates.mjs` wrapper；B 严格日志字段、A 兼容。 |
| Q7 B 锚点/日志 | 单行 SHA-256 Anchor；Markdown 追加日志；初始 freeze 条目 A 兼容字段；04 独立复算并记录来源。 |
| Q8 Sparse/112 | 硬编码 A/B union；覆盖断言；112 文件全部按 required 验证（含 2 个 `chrome.log`）；缺失/不符 B FAIL。 |
| Q9 顺序 | 04 → 05（Registry + Evidence CI）→ 06（更新通道）→ 07 → 08；06 依赖 05。 |
| Q10 校验落点 | 05 单元测试覆盖 Q10 列出的八类；不纳入 `pnpm check`。 |
| Q11 负向样本 | A 用 `fa05/regression/test.exit`；B 用 `v3/success-basic/setup.json`；B Manifest+Anchor 联合；workflow 规则篡改；07 创建前复核 Required 身份与 SHA。 |

详细规则见以上 `Rulings（round 1）` 与 `Rulings（round 2）`。未修改代码、workflow、A/B 冻结交付或 112 快照；下游 04–08 已按本答案细化。
