# ADR 0001：交付证据的信任边界

- 状态：accepted
- 日期：2026-10-31
- 决策来源：P0-03 三轮裁定（`Q1–Q21`）

## Context

普通 PR 作者可以修改 PR 中的任意文件，包括 workflow、CLI、验收脚本、Manifest 和证据。
如果 CI 运行 PR 自带的验收逻辑，或让 PR 修改自己的期望哈希，SHA-256 只能证明“文件与当前清单一致”，不能证明“清单来自可信基线”。

## Threat model

防御对象是**普通 PR 作者**：可以提交任意 PR 内容，但不能修改受保护分支、仓库保护设置或可信 CI 的执行逻辑。

明确不防御：仓库管理员恶意修改、GitHub 管理权限被攻陷、CI 执行环境被攻陷，以及可信基线与保护规则同时被有权人员篡改。

## Decision

- 受保护 base 提供 workflow、CLI、验收脚本、Manifest 和摘要。
- PR head 只作为不可信证据数据被读取，不执行其中的 workflow、脚本、CLI 或构建产物。
- 普通 PR 的 evidence job 要求 `PR Manifest == base Manifest` 且 `PR SHA-256 == base SHA-256`，再由 base 逻辑验证 PR head 的证据。
- 基线更新走 owner 专用、可追溯的通道；普通 PR 不允许用自己修改的期望值验证自身。

## Rejected alternatives

- **PR workflow 自验**：PR 可以修改 workflow/CLI 并伪造通过。
- **仅依赖 CODEOWNERS**：审查是重要兜底，但不是技术门禁；单人仓库还无法自批。
- **PR 自带 Manifest 自验**：同时改证据与 Manifest 即可绕过。
- **workflow_run 替代 pull_request_target**：其 check 不能满足 required status check。

## Why not signatures

当前信任根是受保护的 GitHub base 与仓库规则。引入签名基础设施会扩大实现与密钥管理范围，却不解决管理员或可信 CI 环境被攻陷的问题；在单仓库、零付费阶段不值得。

## Consequences

- 普通 PR 不能修改自己的验收标准；基线更新必须走 owner 通道。
- owner 仍是信任边界的一部分；`bypass_mode: "pull_request"` 只允许在 PR 上绕过 required checks，不能直接 push/force push/删除 `main`。
- 个人账号仓库没有完整 organization audit log；追溯以 PR、commit、check run、ruleset 快照和人工记录为准。
- 证据完整性通过不等于游戏全部功能、机制覆盖或人工视觉审核已完成。
