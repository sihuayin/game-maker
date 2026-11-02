# ADR 0002：双基线可信验收的信任边界与更新通道

- 状态：accepted
- 日期：2026-11-02
- 决策来源：P0-04 Q1–Q11（`.scratch/p0-04-dual-baseline-ci/rulings-2026-11-01.md` 与票 03）

## Context

P0-03 已为 FPVS-V1（基线 A）建立 base-only trusted evidence：workflow、CLI、验收脚本、Manifest 与 SHA-256 锚点都来自受保护 base，PR head 只作为数据。
P0-02 冻结了第二套交付基线 B（231 文件 / 137 required / 94 optional / 6 records，另有一个 112 文件的冻结快照）。

P0-04 需要让 A/B 各自拥有独立的 Manifest 与 Anchor，并同时受同一套普通 PR 无法伪造的 CI 保护；同时不能改变 A 原有验收口径、不能修改冻结交付、不能自动写回基线。

## Threat model

防御对象与 ADR 0001 一致：**普通 PR 作者**可以提交任意 head 内容，但不能修改受保护分支、保护设置或可信 CI 的执行逻辑。

明确不防御：仓库管理员/owner 的 bypass、GitHub 管理权限被攻陷、CI 执行环境被攻陷，以及可信 base 与保护规则同时被有权人员篡改。

## Decision

### 1. Registry 是索引，不是信任根

`.scratch/baselines/registry.json` 只声明基线身份与路径：

- 字段：`id`、`name`、`manifestFormat`、`manifest`、`anchor`、`updateLog`、`identity`；B 另有 `freezeHashes`。
- 不存 Manifest 摘要、文件哈希或 counts；摘要只来自各基线自己的 Anchor。
- 严格拒绝未知字段；路径为仓库根相对 POSIX，realpath 必须在仓库内；Manifest/Anchor/更新日志必须同目录；A/B 路径不得交叉。
- workflow 显式断言基线集合恰为 `fpvs-v1` 与 `p0-02-second-demo-v2`，不只相信 Registry 自己声明。

### 2. Base-only 输入

普通 PR 的 evidence job 从受保护 base 读取：workflow、CLI、验收脚本、Registry、Manifest、Anchor、更新日志与 `freezeHashes`。
PR head 只作为数据读取；不执行 head 的 workflow、脚本、CLI 或构建产物。

### 3. 普通 PR 的信任配置比较（非对称）

- Registry：head 与 base 字节相等，不同即 FAIL。
- 基线 A：只比较 head Manifest 与 base Manifest 字节相等，保持 P0-03 的失败面不变。
- 基线 B：比较 Manifest、Anchor、更新日志与 `freezeHashes`，全部与 base 字节相等。
- A 的 head Anchor/更新日志被单独修改时不会显式失败，但 base 验收不读取 head 副本；这是有意的非对称策略，不在报告中表述为“A/B head-side 完全对称”。

### 4. 112 冻结快照

B 的 `freeze-sha256.txt` 是 112 文件冻结快照的身份依据：

- 112 个文件全部按 required 验证，包括不在 231 Manifest 中的 `run/v1/playtest/v1|v2/chrome.log`。
- `freezeHashes` 从可信 base 读取；B step 对 PR head 的 112 个文件逐条复算；缺失、哈希不符或多出文件均 FAIL。
- `freezeHashes` 不是普通基线更新目标。正常 B 更新不能改写它；未来重新冻结必须另立裁定与新的冻结版本。

### 5. 更新通道

- 只走 owner PR + 只读 `workflow_dispatch` 验证候选；不自动写回 base。
- `baseline` 必填，无默认目标；候选 diff 只允许目标 Manifest/Anchor/更新日志 + Registry 目标 entry；非目标基线与非目标 Registry entry 与 base 字节相等。
- dispatch 记录 `github.actor`、`github.actor_id`、`github.triggering_actor`、目标、old/new、candidate SHA、run ID 与结果；不增加 actor allowlist。
- 失败时 base 完全不变；更新记录由 dispatch artifact 与 PR/commit 承载。

### 6. 汇总与报告身份

- 单 job、双 A/B step；B 与 aggregate 使用 `if: always()`；aggregate 检查真实 outcome、summary、report、trust、Manifest 路径/摘要与 freeze 结果；任何 miss/skipped/fail 均整体 FAIL。
- A/B/aggregate 三份 artifact，`if-no-files-found: error`，保留 30 天。
- 不修改 `verify-delivery` schema；`evidence-acceptance` summary 增加可选 `baselineId`；aggregate 按 Registry/Anchor 校验报告身份。

## Rejected alternatives

- **信任 head Registry/Anchor**：普通 PR 可以用自己改过的配置验证自身。
- **自动写回 base**：扩大写权限面，且撤销只能 revert；与本图 Out of scope 冲突。
- **合并两套 Manifest**：破坏独立 Anchors 与独立更新。
- **执行 head 的 workflow/脚本**：PR 自验。
- **把 A 也改为全量 head-side 比较**：会改变 A 的历史失败面，违背“A 零回退”。
- **把 Registry 纳入 `pnpm check`**：Registry 尚未合并时会让所有 PR 的 `check` 失败；P0-04 只加单元测试。

## Consequences

- A/B 逻辑独立，但物理证据有 **73 个绝对路径重叠**（28 双方 required / 30 A required-B optional / 15 双方 optional）；负向样本必须使用各自独占 required。
- Optional 94 的精确构成：`oldWork` 93 + `v3/chrome.log` 1；Optional 缺失只报告，不把 required 检查拉红。
- owner 仍是信任边界的一部分；owner 保留 PR bypass；没有证明非管理员无法绕过。
- `freezeHashes` 已纳入 Registry 与 evidence 字节比较，因此 CI 会钉住该哈希清单；它不是普通更新目标。
- 证据完整性通过不等于游戏功能、机制覆盖或人工视觉审核完成；也不等于“第二个独立 Demo 已完成端到端生成验收”。
