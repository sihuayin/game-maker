# Baseline Update 双基线通道

Type: task
Status: open
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
4. **更新语义（按 03 裁定）**：
   - 若 03 选择 owner PR 通道：dispatch 验证候选并产出更新记录/候选 artifact，实际写入由 owner 通过 PR 完成；PR 只改目标基线的 Manifest/Anchor/日志，不动另一套基线。
   - 若 03 选择自动写回：必须原子更新目标 Anchor 与更新日志，失败不得留下半更新状态，且不得授予普通 PR 写权限。
5. **更新记录**：操作者、目标基线、旧摘要、新摘要、提交 SHA、时间、运行 ID、结果；A/B 各自可追溯。
6. **隔离**：更新 A 不改变 B 的 Manifest/Anchor/日志，更新 B 不改变 A；用 E2 测试或 E3 前后哈希证明。
7. **权限**：无写权限用户不能 dispatch；普通 PR 不能通过修改 workflow 参数或脚本绕过；PR head 的 workflow/registry 不被执行。
8. **E3**：用真实 dispatch 验证 target=A、target=B、缺省 target（应拒绝）、目标身份不匹配（应拒绝）；记录 run URL 与退出状态。若 03 选择 owner PR 通道，E3 只验证“候选通过 + 未写回 + 更新记录正确”，实际 anchor 更新留给 07 前的 owner PR。
9. **本票一个 PR**；不修改 A/B 冻结交付、Manifest、Anchor；不改变 Evidence CI 的 required check。

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
