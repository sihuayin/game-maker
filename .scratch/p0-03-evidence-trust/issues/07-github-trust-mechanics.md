# GitHub Actions / Ruleset 机制核实（研究）

Type: research
Status: resolved
Blocked by: —

## Question

在写任何 workflow / ruleset 之前，核实以下 GitHub 行为，给出可引用的官方文档与只读 API 证据：

1. `pull_request_target` 的 check run 是否关联到 PR head SHA，是否能作为分支保护/ruleset 的 required status check；对 fork PR 与同仓库 PR 是否一致；workflow 变更是否要求额外批准。
2. 在一个 workflow 中分别 checkout base SHA 与 PR head SHA 的正确写法（`actions/checkout` 的 `ref`、`path`、`persist-credentials`、`sparse-checkout`、`filter: blob:none`）；如何确保不执行 PR 代码。
3. `workflow_dispatch` 从 base/ref 运行时，如何接收并只读获取候选 commit SHA；如何避免执行候选代码；artifact 输出方式。
4. Repository ruleset API：required status checks、bypass actors（owner）、禁止 force push/删除、required PR 的精确 payload；required check 是否必须先运行一次；owner 在 bypass 列表时的实际语义；user-owned public repo 的 audit log 可见性与保留。
5. `actions/checkout` sparse-checkout 是否只拉取所需 blob；对 `.scratch` 子树的 pattern 写法；如何测量 checkout 后磁盘占用与实际耗时。
6. 任何会推翻当前方案的限制（例如 `pull_request_target` 对 fork 的 check 关联、token 权限、workflow approval）。

产物：`research/github-trust-mechanics.md`（本 effort 目录），只读调查，不改生产代码、不改仓库设置；结论要能直接支撑 03/04/05 的票面决策。若发现与 Q6–Q17 假设冲突，明确写出并标注需要用户重新裁定。

## Answer

**已收口（2026-10-30）**。研究文件：[research/github-trust-mechanics.md](../research/github-trust-mechanics.md)。

关键结论：

1. `pull_request_target` 的 check run 关联 PR head SHA，可作为 ruleset/branch protection 的 required status check；fork PR 与同仓库 PR 走同一事件/关联逻辑。**Q6 的 base-only 方案在“能否当 required check”上成立。**
2. base checkout 用 `github.event.pull_request.base.sha`；head 用 `refs/pull/<N>/head`，并回验 `rev-parse HEAD == github.event.pull_request.head.sha`。fork head 需要 `allow-unsafe-pr-checkout: true`，只作为数据、不执行。
3. `workflow_dispatch` 的 check 不出现在 PR、不能满足 required check；它只能做 owner 专用 dry-run，不能当普通 PR 门禁。
4. Ruleset payload 已确认：`deletion`、`non_fast_forward`、`pull_request`（0 approvals）、`required_status_checks`（strict=true，四个 context，`integration_id: 15368`）。required check 需近 7 天内成功跑过；owner 推荐 `User/1635996 + bypass_mode: "pull_request"`，不要 `exempt`。
5. sparse + `blob:none` 只取所需 blob；evidence-only 本地实测 **53 MiB / 699 文件 / 4.19 s**，加 `packages`+`scripts` 后 57 MiB。图内 253 MiB 估算含被 `.gitignore` 的 `out/` 工作区文件，CI 全新 checkout 实际约 **51–57 MiB**。
6. **冲突 1（P0）**：public 仓库的 `pull_request_target` 自 **2026-12-02** 起被默认 Actions policy 阻断；本仓库 `GET /actions/policies` 为空，必须在截止日前创建显式允许 policy。
7. **冲突 2**：个人账号仓库没有组织 audit log API；personal security log 仅 90 天，且未证实含 ruleset bypass 事件。Q17 的“break-glass 可追溯”不能依赖 audit log，最低口径应为 PR + merge commit + check run + ruleset 快照 + 人工记录。
8. **实现级高危**：required job 不能加 job 级 `if`（跳过会被计为 Success），不能加 `paths` 过滤（会长期 pending）；`pull_request_target` 建议 `types: [opened, synchronize, reopened, edited]` 并断言 base 为 `main`。

**待用户重新裁定**：12-02 前的 Actions policy 归属；Q17 “可追溯”的口径。
