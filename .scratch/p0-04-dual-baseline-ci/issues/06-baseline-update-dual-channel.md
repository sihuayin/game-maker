# Baseline Update 双基线通道

Type: task
Status: claimed
Blocked by: 03, 04

## Question

扩展现有 owner 专用 `baseline-update` 通道，使 A/B 可以分别、受控地更新，同时保证普通 PR 无法获得 trust root 修改能力。

### 必须完成

1. **显式目标**：`workflow_dispatch` 新增必填 `baseline` 输入（A/B 或 registry 中的基线 ID）；未指定目标时拒绝执行；不允许默认同时更新两套基线。
2. **base-only**：workflow、registry、校验脚本、当前 Manifest/Anchor/日志全部来自 `main`（受保护 base）；候选 commit 只作为数据读取，不执行候选代码。
3. **更新前检查**：
   - 目标基线身份与 registry 一致；
   - 当前 base Manifest 与当前 Anchor 一致；
   - 候选的目标 Manifest/Anchor/更新日志三者一致；
   - Anchor A 不得指向 Manifest B，反之亦然；
   - 路径必须落在目标基线预期范围内。
4. **更新语义（03 Q3 已裁定：owner PR + 只读 dispatch）**：
   - dispatch 只读验证候选并产出更新记录/候选 artifact；实际写入由 owner 通过 PR 完成，不自动写回 base。
   - `baseline` 必填、无默认目标；候选 diff 仅允许目标基线 Manifest/Anchor/更新日志 + Registry 目标 entry；非目标基线与非目标 Registry entry 必须与 base 字节相等。
   - 失败时 base 完全不变；候选不得执行自身 workflow/脚本。
5. **更新记录**：`baseline-update-meta.json` 记录操作者（`github.actor` / `github.actor_id` / `github.triggering_actor`）、目标基线、旧摘要、新摘要、candidate SHA、时间、运行 ID、结果；A/B 各自可追溯。不增加 actor allowlist。目标更新日志按 A 兼容字段追加，B 可追加 `baselineId`/`operator`/`commitSha`/`recordedAt` 可选字段；A 旧条目不改。
6. **隔离**：更新 A 不改变 B 的 Manifest/Anchor/日志，更新 B 不改变 A；用 E2 测试或 E3 前后哈希证明。
7. **权限**：无写权限用户不能 dispatch；普通 PR 不能通过修改 workflow 参数或脚本绕过；PR head 的 workflow/registry 不被执行。
8. **E3（03 Q3 已裁定 owner PR 通道）**：用真实 dispatch 验证 target=A、target=B、缺省 target（应拒绝）、目标身份不匹配（应拒绝）、候选改动 `freezeHashes`（应拒绝）；记录 run URL 与退出状态。E3 只验证“候选通过 + 未写回 + 更新记录正确”，实际 anchor 更新留给 07 前的 owner PR。
9. **本票一个 PR**；不修改 A/B 冻结交付、Manifest、Anchor；不改变 Evidence CI 的 required check。

### 独立验收项：`freezeHashes` 不得被普通更新改写（03 Q3/Q8）

B 的 `freeze-sha256.txt` 是 112 文件冻结快照的身份依据，**不是普通基线更新目标**。

- 正常 B 更新 dispatch 的候选若改动 `freeze-sha256.txt` ⇒ 拒绝或 FAIL，不能借“更新 Manifest/Anchor”顺带替换冻结哈希清单。
- 不得借普通 dispatch 重新冻结 112 文件快照；未来若确需重新冻结，必须另立裁定与新的冻结版本。
- 06 必须有 E2/E3 证据：候选改动 `freezeHashes` 被拦截；未改动时正常候选可通过；该规则不授予普通 PR 任何写权限。
- 08 的 AC 矩阵必须单列此项，不能用其他 AC 通过抵消。

### 03 裁定输入（2026-11-01）

- **Q3**：owner PR + 只读 dispatch；`baseline` 必填；diff 白名单；非目标字节相等；不自动写回；更新记录字段如 §5。
- **Q6**：dispatch 使用 05 的 `scripts/check-baseline-updates.mjs` wrapper；旧 `check-manifest-updates.mjs` 零改动。
- **Q7**：B 更新日志为 Markdown 追加；初始 freeze 条目 A 兼容字段；新字段可选。
- **Q8**：`freeze-sha256.txt` 从可信 Base 读取；B 的 112 文件按 required 验证；候选不得改写该文件。
- **Q9**：06 依赖 05（05 引入 Registry）；dispatch 的 workflow、Registry、脚本均来自受保护 base。

### 研究输入（02）

- 研究推荐沿用 P0-03 的 **owner PR 改目标文件 + 只读 `workflow_dispatch` 验证候选**；dispatch 不写 base，失败时 base 完全不变，候选 PR 合并是原子的。
- 工作流自动写回会引入新的写权限 actor，且“提交成功后再检查失败”会留下已生效的坏状态；与本图 Out of scope 的“自动更新基线”冲突，除非 03 明确选择并另行授权。
- 更新记录建议：dispatch artifact 的 `baseline-update-meta.json` + PR/commit 作为完整记录；目标更新日志按 A 现有字段追加，新增字段（`operator`/`commitSha` 等）只能可选，不能破坏 A 旧条目。
- 目标隔离：候选 diff 仅允许目标基线三件 + registry 目标 entry；非目标基线三件与 registry 非目标 entry 必须与 base 字节相等。

## 验收标准

- 无权限用户不能执行基线更新；未指定目标或目标身份不匹配时拒绝执行。
- 更新 A 不改变 B，更新 B 不改变 A。
- 更新失败不产生部分写入。
- 更新后 Evidence CI 可以验证新基线（07 票真实 PR 验证）。
- 普通 PR 不能通过改 workflow 参数/脚本绕过权限限制。
- 正常 B 更新候选若改动 `freeze-sha256.txt` ⇒ 拒绝/FAIL；未改动时可通过；E2/E3 有证据。
- 候选 diff 只允许目标基线三件 + Registry 目标 entry；非目标基线与非目标 entry 字节相等，否则拒绝。
- dispatch 不写回 base；更新记录包含 `github.actor_id`/`triggering_actor`，不使用 actor allowlist。
- 旧 `check-manifest-updates.mjs` 零改动；使用 05 的 wrapper。
