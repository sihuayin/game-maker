# 基线更新与架构文档：owner 专用更新流程 + 更新日志 + ADR

Type: task
Status: resolved
Blocked by: 01, 03

## Question

把“基线更新”从普通 PR 门禁中分离，并记录信任模型。

1. **ADR**：`docs/adr/0001-evidence-trust-boundary.md`，按 Q18 的六段（Context / Threat model / Decision / Rejected alternatives / Why not signatures / Consequences）；只记架构决策，不写成实施说明书；`CONTEXT.md` 不改词汇表职责。
2. **更新日志**：`MANIFEST-UPDATES.md`（只追加）；每条含日期、原因、subject、旧 SHA、新 SHA、验证方式/执行者；首条记录当前基线（223 文件，sha `ba7a485b…36fd`，2026-10-29 冻结）。
3. **owner 专用基线更新通道**：
   - 专用 PR 同时改 Manifest、摘要、追加日志；
   - 普通 `evidence` job 按设计失败，不允许切换到 PR 自验模式；
   - `workflow_dispatch` 从受保护 base/ref 运行可信 workflow，输入候选 commit SHA；base 提供逻辑，候选只作为数据；验证新 Manifest/摘要/日志/证据，产物保存，不自动合并；
   - owner 审阅 + 合并（或明确记录的 break-glass）；合并后新 base 才成为普通 PR 的可信基线；
   - `workflow_dispatch` 不得执行候选 PR 的 workflow/脚本/CLI。
4. **普通 PR 的日志一致性**：CI 校验 base 日志最后一条 `newSha` 与 base Manifest 一致；此检查只提供审计一致性，不宣称日志不可伪造。
5. **文档区分**“普通 PR 门禁”与“基线更新通道”；报告中不得把基线更新成功解释为普通门禁豁免。

## Research 07 约束（2026-10-30）

- **Q21**：真正改变 base 必须通过 PR 合并；owner 也不能直接 push/force push/删除 main。`bypass_mode: "pull_request"` 只允许在 PR 上绕过 required checks。
- dispatch workflow 必须在默认分支；始终 `workflow_dispatch` `--ref main`；候选 SHA 通过 `inputs` 传入并做格式/长度校验。
- 候选只读：`git fetch` + `git worktree add` 到 `$RUNNER_TEMP`，base CLI 只把候选当数据；**不执行**候选中的 workflow/脚本/CLI/构建产物。
- dispatch 产生的 check 不出现在 PR、不能满足 required check；它只能作为 owner 专用 dry-run/基线验证，不能写进普通 PR 门禁叙事。
- 报告标记 `trust.anchor.mode=baseline-update`，包含 candidate SHA、base workflow SHA/run id、Manifest 摘要、required/optional 结果；artifact 30 天。
- 可选：用 Actions policy actor rule 或 environment 限制谁可 dispatch；不要用 actor rule 限制 `pull_request_target`，否则会误伤外部 PR。

## Answer

**已收口（2026-10-31）。**

### 落地内容

- `docs/adr/0001-evidence-trust-boundary.md`：Context / Threat model / Decision / Rejected alternatives / Why not signatures / Consequences；`CONTEXT.md` 未改。
- `.scratch/evidence-integrity-v1/manifest/MANIFEST-UPDATES.md`：只追加；首条记录 2026-10-29 冻结基线（223 文件 / 151 required / 13 records / newSha256 `ba7a485b…36fd`）。
- `scripts/check-manifest-updates.mjs`：取日志最后一条 `- newSha256:`，与 Manifest 原始字节 SHA-256 比较；缺失/格式错/不一致 ⇒ exit 1。
- `.github/workflows/evidence.yml`：普通 PR 的 evidence job 新增 **base Manifest update log** 检查（读 base 的日志与清单）。
- `.github/workflows/baseline-update.yml`：owner 专用 `workflow_dispatch`；从 base 运行可信 workflow/CLI/script，候选 commit 只读；校验候选 Manifest、摘要、日志、证据；artifact 30 天；不自动合并。
- `verify-delivery` / `evidence-acceptance` 新增 `--anchor-mode baseline-update`（与普通 PR 的 `digest+base` 区分）；报告 `trust.anchor.mode=baseline-update`。
- 新增 pipeline/CLI 测试：baseline-update 匹配、baseline-update 不接受 base、digest+base 必须给 base。

### 真实运行

- PR #6 合并为 `e44c62a`；四项 checks 全绿（check 40s / test 1m32s / typecheck 56s / evidence 27s，evidence 使用 base 旧 workflow）。
- baseline-update dispatch：run [`41205281023`](https://github.com/sihuayin/game-maker/actions/runs/41205281023)，**29s success**；candidate/base SHA 均为 `e44c62a`；artifact summary：`status=pass` / `anchorMode=baseline-update` / `trust.anchor.mode=baseline-update` / 223 文件 / matched。产物：`runs/2026-10-31-baseline-update-dispatch/`。
- 探测 PR #7（closed，未合并）：四项 checks 全绿（check 44s / test 2m8s / typecheck 1m3s / evidence 34s）；evidence 日志显示 **base Manifest update log** 步骤通过（`✅ MANIFEST-UPDATES：最后一条 newSha256 与当前 Manifest 一致`），artifact summary `pass` / `digest+base` / 223 文件。产物：`runs/2026-10-31-log-probe/`。

### 本地验证

- `pnpm test`：156 文件 / **2307 用例通过**；`pnpm typecheck` / `pnpm check` 全绿。
- baseline-update 模式本地正式脚本：223 文件 / exit 0 / `anchorMode=baseline-update` / matched / 1.6s。
- 坏日志测试：最后一条 newSha256 改错 ⇒ exit 1。

### 限制

- dispatch dry-run 的 candidate 与 base 相同，验证了通道但不改变真实基线；真正基线更新仍需 owner 专用 PR + dispatch + PR 合并（普通 evidence job 会按设计失败，owner 用 `pull_request` bypass 合并）。
- 更新日志不是密码学不可篡改日志；历史仍由 git、ruleset 与人工审查负责。
- Actions 仍有 Node 20 deprecation 提示；不影响运行。
