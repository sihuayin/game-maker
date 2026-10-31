# CI Workflow：base-only trusted evidence + 回归全量

Type: task
Status: resolved
Blocked by: 00, 01, 02, 08

## Question

落地 GitHub Actions 工作流，使普通 PR 在真实 GitHub 上执行四项检查，且证据验收的信任链成立。

1. **回归 workflow**（`pull_request` + `push` main）：jobs `check` / `test` / `typecheck`，full checkout（约 1.64 GiB）；记录 checkout/install/build/test 耗时与磁盘占用。
2. **证据 workflow**（`pull_request_target`）：
   - workflow、CLI、验收脚本全部来自 base；显式 checkout `github.event.pull_request.base.sha`；
   - PR head 只作为数据：`persist-credentials: false`，独立目录，sparse-checkout 只取验收源码 + `.scratch/fpvs-v1-final/{work,artifacts,runs}` + `.scratch/generic-playtest-v1/evidence` + `.scratch/evidence-integrity-v1/manifest`；**不执行 PR 中的任何脚本/CLI/构建产物**；
   - 读取 base 的 `expected-hashes.json` 与 `expected-hashes.sha256`；断言 PR Manifest 与 base Manifest 逐字节一致；
   - 用 base CLI 运行 `verify-delivery --manifest <PR head manifest> --expected-manifest-sha <base digest> --base-manifest <base manifest> --out <temp>`；锚点失败 ⇒ job 失败；
   - `permissions: contents: read`，无 secrets；fork PR 与同仓库 PR 同一规则；
   - 不把 PR 路径字符串拼进 shell；路径从可信 manifest/环境变量读取；
   - 报告与 summary 作为 artifact 上传（成功/失败都上传，30 天）。
3. **Check 名称**稳定且唯一：`check` / `test` / `typecheck` / `evidence`；不要矩阵/同名 job 造成 required check 绑定歧义。
4. **Bootstrap**：首次在默认分支上跑通 workflow，为 04 提供可选的 required check 名称；记录一次真实运行 ID。
5. **失败诊断**：job、命令、Manifest 路径/摘要、`report.json`/`report.md`、失败文件/规则、declared/recomputed verdict。

## Research 07 约束（2026-10-30）

- **00 已落地占位 workflow**：`.github/workflows/evidence.yml` 已在 `main`（PR #1，merge `6f0a8dc`），job 名 `evidence`；03 必须用真正的 trusted evidence workflow 替换它，保持路径不变，policy `10162` 继续适用。替换前它只 echo 事件、不 checkout 任何 PR 代码。

- **平台前置（P0）**：public 仓库的 `pull_request_target` 自 **2026-12-02** 起被默认 Actions policy 阻断；本仓库当前无显式 policy。必须在截止日前创建允许 `.github/workflows/evidence.yml` 的 Actions event policy（HITL；由 **00 票**承担，03 依赖 00）。当前 evaluate 模式不阻断，但不能依赖。
- evidence workflow：`on: pull_request_target`，`branches: [main]`，`types: [opened, synchronize, reopened, edited]`；job 名精确为 `evidence`；**不要** job 级 `if`（跳过=Success），**不要** `paths` 过滤（会长期 pending）；job 内断言 `github.event.pull_request.base.ref == 'main'`。
- base checkout：显式 `ref: ${{ github.event.pull_request.base.sha }}`，`path: base`，`persist-credentials: false`；不要用 `github.sha`（`pull_request_target` 的 `GITHUB_SHA` 是默认分支）。
- head checkout：`ref: refs/pull/${{ github.event.pull_request.number }}/head`，`path: pr`，`persist-credentials: false`，`allow-unsafe-pr-checkout: true`（只读数据，不执行）；`fetch-depth: 1`、`lfs: false`、`submodules: false`；回验 `git rev-parse HEAD == github.event.pull_request.head.sha`，防 force-push 竞态。
- sparse：evidence-only 实测 53 MiB / 699 文件 / 4.19 s；加 `packages`+`scripts` 后 57 MiB；记录 runner 上 install/build 后的真实磁盘与 step 时间。
- fork 的 `pull_request` 回归 run 可能 `action_required`（需 approval），这是正常行为；不要因此把 `check`/`test`/`typecheck` 改成 job 级 skip。
- 报告 artifact 用 `if: always()`、30 天、`if-no-files-found: warn`；失败路径写 stub。

## Answer

**已收口（2026-10-31）。真实 CI 已在 GitHub 上跑通。**

### 落地内容

- `.github/workflows/ci.yml`：`check` / `test` / `typecheck` 三个独立 job；`pull_request` + `push main`；full checkout；`test` job 先 `pnpm build` 再 `pnpm test`。
- `.github/workflows/evidence.yml`：`pull_request_target` + `branches: [main]` + `types: [opened, synchronize, reopened, edited]`；job 名精确为 `evidence`；无 job 级 `if`、无 `paths` 过滤。
  - base checkout 显式 `github.event.pull_request.base.sha`；head 用 `refs/pull/<N>/head` + `allow-unsafe-pr-checkout: true` + `persist-credentials: false`，只读数据。
  - head SHA 回验；PR Manifest 与 base Manifest `cmp -s` 恒等；用 base 脚本 + base CLI 跑 `--expected-manifest-sha` + `--base-manifest`；`contents: read`、无 secrets。
  - 报告与 summary 用 `if: always()` 上传，30 天。
- `scripts/evidence-acceptance.mjs` 支持锚点参数并在 summary 记录 `trustAnchor`。

### Bootstrap 时间线

1. PR #3（merge `bf9ef87`）首次运行暴露两个 clean-checkout 问题：`docs/v4/P0-00-capability-gap-audit.md` 指向 gitignored `out/` 构建产物；`test` job 在干净 checkout 下未先 build，109 个测试文件因 `@game-maker/assets` 无 `dist` 失败。已修（`8434bfc`）：链接改到 tracked 运行目录，`test` job 增加 `pnpm build`。
2. PR #3 第二次运行四项全绿：check 53s / test 2m10s / typecheck 1m4s / evidence 2s（evidence 仍是 base 上的占位）。
3. PR #5（merge `a56e4e4`）修复 evidence 的 `setup-node` pnpm cache 路径：base checkout 在 `base/`，cache 必须指向 `base/pnpm-lock.yaml`。
4. 探测 PR #4（closed，未合并）触发真正的 base-only evidence workflow：**四项全绿**，`mergeable_state=CLEAN`。

### 探测 PR #4 的真实结果

| check | 结论 | 耗时 | check run ID | app id |
|---|---|---|---|---|
| check | success | 38s | 124522696113 | 15368 |
| test | success | 2m9s | 124522696007 | 15368 |
| typecheck | success | 1m13s | 124522696232 | 15368 |
| evidence | success | 28s | 124522691383 | 15368 |

- evidence run：[`41196179086`](https://github.com/sihuayin/game-maker/actions/runs/41196179086)；artifact `evidence-4` 已下载到 `runs/2026-10-31-ci-e2e/artifact/`。
- summary：`status=pass` / `exitCode=0` / **223 文件（151 required）** / 13 records / diagnostics 0 / `trust.anchor.result=matched`（digest+base，expected=actual=base=`sha256:ba7a485b…36fd`，`byteEqual=true`）；脚本内 CLI 298ms。
- full checkout 在 runner 上实测 `du -sh .` = **2.2G**；evidence job 的 base+head 均为 sparse，job 总耗时 28s。
- check runs 原始 JSON：`runs/2026-10-31-ci-e2e/check-runs.json`；PR #4 状态：closed / not merged。

### 限制

- Actions 仍提示 `actions/setup-node@v4`、`actions/upload-artifact@v4`、`pnpm/action-setup@v4` 的 Node 20 deprecation；不影响本次运行，后续可单独升级。
- 四项 required checks 目前只是“存在且通过”，尚未被 ruleset 设为 required —— 由 04 收口。
- `evidence` job 的 sparse 磁盘未在 job 内单独 `du`；research 07 实测 tracked sparse 约 51–57 MiB。
- public 仓库 `pull_request_target` 的 2026-12-02 平台默认策略仍由 00 的 policy `10162` 覆盖，需在 12-02 后复验其他 workflow 的负向行为。
