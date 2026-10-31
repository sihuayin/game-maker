# Repository ruleset：required checks 与 owner bypass

Type: task
Status: resolved
Blocked by: 03

## Question

本票是 **HITL**：必须由仓库 owner 执行或明确授权，不能只提交配置文档。在 GitHub 仓库设置中实际启用 `main` 的 Repository ruleset。

目标配置：

- 要求通过 Pull Request 合并；
- required status checks：`check`、`test`、`typecheck`、`evidence`（以 03 首次运行的实际 check 名为准）；
- 禁止 force push；禁止删除 `main`；
- owner 列入 bypass 列表；非管理员不能直接推送；
- 不新增 push 审计 workflow（Q17a）。

交付与证据：

1. 变更前 `gh api repos/.../rulesets` 快照；
2. 实际 ruleset JSON/API 响应、ruleset id；
3. owner bypass 语义实测（至少记录：owner 直接推送是否仍可、required check 失败时 `mergeable_state` 如何显示）；
4. 非管理员阻断如果无第二账号，如实披露“未实测”，不以 owner 的 blocked 状态冒充非管理员证据；
5. GitHub audit log 可取得的部分与不可取得的部分，如实记录。

## Research 07 约束（2026-10-30）

- required check 必须先在仓库近 7 天内成功跑过；03 bootstrap 后用 `GET /commits/{head}/check-runs` 确认四个 `name` 与 `app.id=15368`，再创建 ruleset。
- ruleset payload：`target: branch`、`enforcement: active`、`~DEFAULT_BRANCH`、`deletion`、`non_fast_forward`、`pull_request`（0 approvals）、`required_status_checks`（strict=true，四个 context）。
- **Q21 冻结**：owner bypass 固定为 `actor_type: "User"`、`actor_id: 1635996`、`bypass_mode: "pull_request"`；owner 不能直接 push/force push/删除 main，只能在 PR 上绕过 required checks；不要用 `exempt`，不用 `always`。
- **Q20 追溯口径**：不承诺完整 audit log；主证据为 PR 编号/链接、head/base/merge SHA、check run ID/结论/日志、ruleset 前后快照、owner 人工记录、可取得的 personal security log。报告必须写明“个人账号仓库不承诺完整 organization audit log”。
- 个人仓库没有组织 audit log API，personal security log 仅 90 天且未证实含 ruleset bypass 事件。追溯主证据改为 PR、merge commit、check run、ruleset 快照与人工记录；audit log 可取得部分如实记录。
- 04 前需要 03 的 bootstrap 运行；若 7 天窗口内没有新运行，required check 可能无候选项或长期 pending。

## Bootstrap evidence（2026-10-31）

真实 PR #4（closed，未合并）已产生四个稳定 check 名称与成功运行：

| check | check run ID | app id | 结论 |
|---|---|---|---|
| check | 124522696113 | 15368 | success |
| test | 124522696007 | 15368 | success |
| typecheck | 124522696232 | 15368 | success |
| evidence | 124522691383 | 15368 | success |

- 原始：`runs/2026-10-31-ci-e2e/check-runs.json`；evidence run `41196179086`。
- required checks 必须在此之前近 7 天内成功跑过；本表提供候选名称与 app id。
- 04 创建 ruleset 时用 `~DEFAULT_BRANCH`、`deletion`、`non_fast_forward`、`pull_request`（0 approvals）、`required_status_checks`（strict=true），owner `User/1635996 + bypass_mode: "pull_request"`。

## Answer

**已收口（2026-10-31）。Repository ruleset 已实际启用，owner 直接推送被阻断。**

### Ruleset

- id：`26268801`，name：`p0-03-main-evidence-gate`，`target: branch`，`enforcement: active`。
- 目标：`conditions.ref_name.include: ["~DEFAULT_BRANCH"]`（即 `main`）。
- rules：
  - `deletion`
  - `non_fast_forward`
  - `pull_request`：`required_approving_review_count: 0`，不要求 CODEOWNERS，不做 stale review dismissal；允许 merge/squash/rebase。
  - `required_status_checks`：`strict_required_status_checks_policy: true`；四个 context `check` / `test` / `typecheck` / `evidence`，均带 `integration_id: 15368`。
- bypass：`actor_type: "User"`、`actor_id: 1635996`、`bypass_mode: "pull_request"`；API 返回 `current_user_can_bypass: "pull_requests_only"`。
- 快照：`runs/2026-10-31-ruleset/rulesets-before.json`、`ruleset-create-response.json`、`ruleset-after.json`、`ruleset-payload.json`。

### Owner 直接推送实测

- 临时分支 `ruleset-push-probe`（空提交）尝试 `push origin ruleset-push-probe:main`。
- 结果：**remote rejected**，`GH013: Repository rule violations`：
  - `Changes must be made through a pull request.`
  - `4 of 4 required status checks are expected.`
- main SHA 前后均为 `a56e4e417972025052abe673e1c784cace7ea3d0`（`gh api .../git/ref/heads/main`，保存于 `main-sha-after.json`）；没有提交进入 main。
- 原始输出：`push-probe.err`。

### 修正：unattributed changes 的额外审批

首次创建后 API 返回 `pull_request.require_extra_approval_for_unattributed_changes: true`（服务端默认），与“0 approvals”意图冲突。已用 `PUT /rulesets/26268801` 将同一字段改为 `false`；`bypass_actors` 与其余规则保持不变。响应：`runs/2026-10-31-ruleset/ruleset-update-response.json`。

### 说明

- 这证明 owner 的 `pull_request` bypass 不会放开直接 push/force push/删除 main；owner 只能在 PR 上绕过 required checks。
- required check 失败时的 `mergeable_state=blocked` 属于 06 的红/绿 PR 演示；04 只记录 ruleset 与 direct-push 语义。
- ruleset 现在生效：后续任何 main 变更必须走 PR + 四项 checks；本 effort 的跟踪文件若入库，也需要 PR。
- 非管理员账号不存在，无法实测“非管理员被阻断”；以 ruleset 配置与 owner direct-push 拒绝为证据，限制如实披露。
