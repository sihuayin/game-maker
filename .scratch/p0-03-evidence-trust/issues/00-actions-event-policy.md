# Actions Event Policy：允许 evidence.yml 使用 pull_request_target（HITL）

Type: task
Status: resolved
Blocked by: —

## Question

本票是 **HITL**：必须由仓库 owner 执行或明确授权。在 **2026-12-02** 平台默认策略生效前，为 public 仓库创建 **workflow 级** Actions event policy，只允许 `.github/workflows/evidence.yml` 使用 `pull_request_target`；不得把“API 返回成功”当作平台行为已验证。

1. 读取并保存当前 `GET /actions/policies` 快照（当前 `total_count: 0`）。
2. 创建 policy（参考 research 07 §6.1）：
   - `enforcement: active`；
   - `conditions.workflow_path.include: [".github/workflows/evidence.yml"]`；
   - `rules[].type: restrict_action_events`，`allowed_events` 至少包含 `pull_request_target`（可含 `workflow_dispatch` / `push` / `pull_request`）；
   - 不扩大到所有 workflow 或所有事件类型。
3. 真实 PR 触发 evidence workflow，证明 GitHub 接受该事件并运行；保存 policy 配置、workflow run ID、触发 PR、执行结果。
4. 验证其他 workflow 没有因此获得不必要的 `pull_request_target` 权限。
5. 若 policy 无法精确限定到目标 workflow，或实际运行未被允许：**暂停并重新裁定**，不得退回 PR 自验。
6. 若 policy 的 include 路径要求 workflow 先存在，可先落一个最小占位 `.github/workflows/evidence.yml`（不执行任何 PR 代码），再由 03 补全；顺序仍为 00 → 03。

## Answer

**已收口（2026-10-31）。**

### 完成内容

- **只读快照**：创建前 `GET /actions/policies` 为 `{"total_count":0,"policies":[]}`；保存于 `runs/2026-10-31-policy-snapshot/policies-before.json`。
- **占位 workflow**：PR #1 已合并（squash，merge commit `6f0a8dc`）；`.github/workflows/evidence.yml` 的 job 名为 `evidence`，只 echo 事件上下文，不 checkout、不读取、不执行任何 PR 代码。
- **Actions policy**：id `10162`，name `p0-03-evidence-pull-request-target`，`enforcement: active`，`conditions.workflow_path.include: [".github/workflows/evidence.yml"]`，`rules[].restrict_action_events.allowed_events: ["pull_request_target"]`。
- **真实运行**：探测 PR #2（已关闭、未合并）触发 `pull_request_target`；run `41160053128`、job `evidence` `124415401898`、conclusion `success`、3s；日志与 JSON 已保存。
- **范围验证**：policy include 精确到 `evidence.yml`；仓库当前只有这一个 workflow，因此不存在其他 workflow 获得 `pull_request_target` 权限。默认策略目前仍是 evaluate 模式（2026-12-02 前），所以“其他 workflow 被阻断”的负向行为今天不可观测；报告已披露。
- 未修改证据、交付或历史报告；探测 PR 未合并，分支已删除。

### 产物

- `.scratch/p0-03-evidence-trust/runs/2026-10-31-policy-snapshot/`：`policies-before.json`、`policy-10162.json`、`policies-after.json`、`run-41160053128.json`、`run-41160053128.log`、`pr-2.json`。
- PR #1：merged；PR #2：closed。
- 占位 workflow 是临时的；**03 必须用真正的 trusted evidence workflow 替换**，路径保持 `.github/workflows/evidence.yml`，policy `10162` 继续适用。

### 限制

- 同仓库 PR 的真实运行已证明事件被接受；fork PR 行为由 research 07 的官方文档与外部实测支撑，本票未用第二账号做 fork 运行。
- 负向“其他 workflow 被阻断”无法在 evaluate 模式下实测；范围由 policy include 精确性保证，2026-12-02 后需复验。
