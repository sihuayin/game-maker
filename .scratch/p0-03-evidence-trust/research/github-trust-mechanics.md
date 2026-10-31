# GitHub Actions / Ruleset 机制核实（ticket 07 产物）

- 核实日期：2026-10-30
- 仓库快照：`sihuayin/game-maker`，public，默认分支 `main`，HEAD `66f3a74`
- 方式：只读。官方文档（`github/docs` 源 Markdown + docs.github.com）、`actions/checkout` / `actions/upload-artifact` README 与源码、Git 官方文档、GitHub REST/GraphQL 只读 API、本地 `/tmp` 稀疏检出实验。
- 未修改生产代码、仓库设置、workflow、分支保护；未创建/合并 PR；未运行 workflow。
- 证据分级沿用图内定义：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据。本文档自身是 E1/E3 事实汇编。

---

## 结论摘要

1. **`pull_request_target` 的 check run 确实关联 PR head SHA，并能作为 ruleset/分支保护的 required status check。**
   - 官方文档把 `pull_request_target` 列入“可使 checks 出现在 PR 并满足 required checks”的事件白名单；并明确 required checks 不区分事件触发器。
   - 真实 fork PR 实测：`pulumi/examples#3064` 的 `pull_request` run 为 `action_required`，同一 head SHA 上的 `pull_request_target` run 为 `success`，其 check run `comment-on-pr` 挂在 head SHA，且出现在 PR 的 `statusCheckRollup` 中。
   - 同仓库 PR 实测：`AstroNvim/AstroNvim#2902` 的 `pull_request_target` run 的 check suite `head_sha` 等于 PR head SHA。
   - 结论：Q6 的 base-only `pull_request_target` 方案在“能否当 required check”上成立。

2. **必须区分两个 SHA 概念。** `pull_request_target` 的 job 内 `GITHUB_SHA` 是默认分支/base 的最后提交（文档表），但 Actions run / check suite 的 `head_sha` 是 PR head SHA（API 实测）。不要用 `github.sha` 代替显式 base SHA；checkout base 用 `github.event.pull_request.base.sha`，checkout head 用 `refs/pull/<N>/head` 并回验 `rev-parse HEAD == github.event.pull_request.head.sha`。

3. **`pull_request_target` 永远使用 base/default 分支上的 workflow 文件，不受 fork approval 设置影响。** 官方原文：fork approval 设置对 `pull_request_target` 不适用，“will always run, regardless of approval settings”。PR 里修改 workflow 不会被执行。这是 Q6 的安全基础，也意味着 fork PR 会自动消耗 runner（需 concurrency/timeout 限流）。

4. **同仓库 PR 与 fork PR 走同一事件、同一 check 关联逻辑。** 差异只在 checkout fork head 时，`actions/checkout` v7 默认拒绝，必须显式 `allow-unsafe-pr-checkout: true`（且该开关只影响“检出”，不等于执行）。基线与 head 必须分目录、`persist-credentials: false`，且不得在任何步骤执行 head 中的代码。

5. **`workflow_dispatch` 的 check run 不会出现在 PR 上，也不能满足 required check。** 官方文档明确：以 `workflow_dispatch` 在 PR head 分支上触发的 job checks “do not appear in the pull request's checks section. Even if the checks pass for the head commit, they do not satisfy a required status check”。因此 05 票的 dispatch 只能作为 owner 专用基线 dry-run，不能充当普通 PR 门禁。dispatch 必须 `--ref main`，候选 SHA 只作为输入数据；用 `git fetch` + 只读 worktree/对象读取，不执行候选代码。

6. **Ruleset API 精确 payload 已确认**（API 版本 `2026-03-10`）。四条 required checks 用 `context` 名（`check`/`test`/`typecheck`/`evidence`），可加 `integration_id: 15368`（GitHub Actions app，API 实测）。owner 可用 `actor_type: "User", actor_id: 1635996, bypass_mode: "pull_request"`；`pull_request` 模式只允许在 PR 上绕过，留下 PR 轨迹；`always` 会连直接推送/强推/删除一起放开；`exempt` 明确“不产生 bypass audit entry”，应避免。required check 需在仓库近 7 天内成功跑过（文档），04 票前必须 bootstrap 一次真实运行。

7. **sparse-checkout + `filter: blob:none` 只取稀疏路径所需 blob**：actions/checkout 在只设 sparse 时会自动加 `--filter=blob:none`；Git checkout 会批量预取所需缺失 blob。本地实测（`66f3a74`，evidence-only 模式）：**53 MiB / 699 个实际文件 / 4.19 s**；加上 `packages`+`scripts` 后 57 MiB / 5 s。图内 253 MiB 估算包含了工作区里被 `.gitignore` 的 `out/` 未跟踪文件（generic-playtest evidence 工作区 187 MiB，但 git 跟踪仅 5.9 MiB）；CI 全新 checkout 实际更小，约 **51–57 MiB**，不是 253 MiB。仍必须记录 Actions runner 上的真实耗时与 install/build 后磁盘。

8. **平台级限制（最需要主会话处理）：**
   - GitHub 新增默认 Actions policy：**public 仓库的 `pull_request_target` 将在 2026-12-02 被默认策略阻断**，除非仓库有显式允许它的 Actions policy。本仓库 `GET /actions/policies` 返回 `total_count: 0`，即无显式 policy。**必须在 12-02 前创建允许 `pull_request_target` 的 policy，否则 Q6 方案会被平台直接阻断。**（当前为 evaluate 模式。）
   - `actions/checkout` v7 对 fork PR head 的默认拒绝（`allow-unsafe-pr-checkout`）是新实现前置，不改变安全模型，但不加就 checkout 失败。
   - 个人账号仓库没有组织 audit log API；个人 security log 只保留 90 天，且个人事件参考未列出 `repository_ruleset.*` 具体事件。Q17 的“break-glass 可追溯”不能依赖 GitHub audit log，需用 PR-only bypass + API 快照/PR/check 记录补足；这一点需要用户确认可追溯口径。
   - required check 的 **job 级 `if` 跳过会被计为 Success**；证据 job 绝不能加 job 级条件或 path filter，否则会被平凡通过/长期 pending。这是实现级高危点。

---

## 逐项事实（带来源）

### 1. `pull_request_target`：check 关联、required check、fork 一致性、approval

#### 1.1 事件语义与 SHA

官方事件表（github.com/GHES 3.20+）：

| 事件 | `GITHUB_SHA` | `GITHUB_REF` |
|---|---|---|
| `pull_request_target` | Last commit on default branch | Default branch |

来源：<https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target>
（源文件：`github/docs` `content/actions/reference/workflows-and-actions/events-that-trigger-workflows.md`，第 661 行起。）

文档同时说明：该事件“runs in the context of the default branch of the base repository, rather than in the context of the merge commit”，目的是“prevents execution of unsafe code from the head of the pull request”。

**但 Actions run / check suite 的 `head_sha` 是 PR head SHA，不是 `GITHUB_SHA`。** 实测：

- `GET https://api.github.com/repos/AstroNvim/AstroNvim/actions/runs/31040775490`
  - `event: pull_request_target`
  - `head_sha: 44d119c8cbc2b3cc94f2ace9f4a98edcde38867b`（PR #2902 head）
  - `head_branch: audit/2026-07-29-pass-3`
- `GET https://api.github.com/repos/AstroNvim/AstroNvim/check-suites/84195522113`
  - `head_sha: 44d119c...`
  - `latest_check_runs_count: 3`

因此：
- job 内 `github.sha` 不能当作 PR head；checkout head 必须显式用 `github.event.pull_request.head.sha` / `refs/pull/<N>/head`。
- checkout base 用 `github.event.pull_request.base.sha` 最稳，不要依赖 `github.sha` 的默认分支语义。

#### 1.2 能否作为 required status check

官方“Troubleshooting required status checks”明确列出可使 checks 被评估的事件：

> For checks created by workflow jobs to be evaluated for a pull request, the workflow run must be triggered by one of these events: `push`, `pull_request`, `pull_request_review`, `pull_request_target`, `deployment`, `deployment_status`.

并明确反例：

> if a workflow is triggered by `workflow_dispatch` on a pull request's head branch, checks reported by its jobs do not appear in the pull request's checks section. Even if the checks pass for the head commit, they do not satisfy a required status check in a branch ruleset.

来源：<https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks>

同页还说明：
- `workflow_run` **不在**这个白名单里。因此“用 `workflow_run` 在可信 base workflow 里跑完后，再让 PR 等 required check”并不可行：`workflow_run` 产生的 checks 不能满足 required status check。这排除了 Q6 的一个常见替代方案，`pull_request_target` 不是可随意替换的。
- “Required status checks do not take workflow, matrix, or event trigger types into account.”（ruleset 故障排查页亦有同句：<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules#troubleshooting-required-status-checks>）
- “Required checks must pass on the latest commit SHA. Checks from earlier commits don't satisfy the requirement.”
- 成功状态包括 `success`、`skipped`、`neutral`。

**fork PR 实测（E3）：**

- PR：`https://api.github.com/repos/pulumi/examples/pulls/3064`
  - `head.repo.full_name: RaphaelFakhri/examples-2`（fork）
  - `head.sha: 53139c45e13aaf276a43855b13c8a63ea188a20e`
  - `mergeable_state: blocked`
- 同一 head SHA 的两个 run：
  - `GET https://api.github.com/repos/pulumi/examples/actions/runs?head_sha=53139c45e13aaf276a43855b13c8a63ea188a20e`
    - run `40145234629`：`event: pull_request`，`conclusion: action_required`（fork approval）
    - run `40145234535`：`event: pull_request_target`，`conclusion: success`（无需 approval）
- 同一 head SHA 的 check runs：
  - `GET https://api.github.com/repos/pulumi/examples/commits/53139c45e13aaf276a43855b13c8a63ea188a20e/check-runs`
    - `name: comment-on-pr`
    - `status: completed`, `conclusion: success`
    - `head_sha: 53139c...`
    - `app.id: 15368`, `app.slug: github-actions`
    - `details_url: https://github.com/pulumi/examples/actions/runs/40145234535/job/121025035047`（指向 `pull_request_target` run）

**fork PR 的 GraphQL rollup 实测：**

对 `Juanpe/SkeletonView#601`（head repo 为 `TastyHeadphones/SkeletonView`，fork）：

```graphql
query {
  repository(owner:"Juanpe", name:"SkeletonView") {
    pullRequest(number:601) {
      number mergeable mergeStateStatus headRefOid
      commits(last:1) { nodes { commit { statusCheckRollup {
        contexts(first:30) { nodes {
          __typename
          ... on CheckRun { name status conclusion checkSuite { workflowRun { event } } }
        } }
      } } } }
    }
  }
}
```

返回摘要：

- `mergeable: MERGEABLE`, `mergeStateStatus: UNSTABLE`
- `lint`: `FAILURE`，`checkSuite.workflowRun.event = pull_request_target`
- `danger`: `SUCCESS`，`checkSuite.workflowRun.event = pull_request_target`
- 对应 run：`36306160600`，`event: pull_request_target`，`conclusion: failure`，`head_sha: eb48c61...`

即：**fork PR 的 `pull_request_target` check 出现在 PR 的 statusCheckRollup 中**。这是“能作为 required check”的直接证据；同时说明 required check 绑定的是 head SHA 上的 check 结果，不是事件类型。

注意：REST `check-runs` / `check-suites` 响应里的 `pull_requests` 数组实测为空（`[]`），不要用该字段判断是否关联 PR；用 `head_sha`、`details_url` 或 GraphQL `statusCheckRollup` 判断。

#### 1.3 同仓库 PR 与 fork PR 的一致性

- 事件层面：`pull_request_target` 对同仓库 PR 与 fork PR 都触发，均运行在 base/default 分支上下文。
- check 关联层面：两者 check suite `head_sha` 都是 PR head；fork 实测见上，同仓库实测见 AstroNvim #2902。
- approval 层面：见 1.4，均不适用 fork approval。

因此除“checkout fork head 需要 `allow-unsafe-pr-checkout`”外，**不需要也不应该**按 `head.repo.full_name` 分支写不同规则。Q6 的“fork 与同仓库同一规则”可实现。

#### 1.4 workflow 变更是否需要 approval

官方 fork approval 文档原文：

> Workflows triggered by `pull_request_target` events are run in the context of the base branch. Since the base branch is considered trusted, workflows triggered by these events will always run, regardless of approval settings.

来源：<https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks>（复用文本 `data/reusables/actions/workflow-run-approve-public-fork.md`）
仓库设置页：<https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#controlling-changes-from-forks-to-workflows-in-public-repositories>

同时，`pull_request_target` 的 workflow 与未指定 `ref` 的 `actions/checkout` 都来自 base 默认分支：

> `pull_request_target` makes one critical and subtle change: the workflow, and any subsequent `actions/checkout` call that does not specify a `ref`, is taken from the base repository's default branch, not from the pull request.

来源：<https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target>

结论：
- PR 修改 `.github/workflows/*` **不会**改变 `pull_request_target` 运行的内容；不会触发“等待 approval”的 workflow 变更审查。
- 这是好事：普通 PR 无法篡改证据 workflow。
- 但 fork PR 会自动跑 `pull_request_target`（无 approval），会消耗 runner；必须用 `concurrency`、`timeout-minutes`、最小 `permissions` 限流。

#### 1.5 安全边界

官方安全文档：

> Avoid using the `pull_request_target` and `workflow_run` workflow triggers with untrusted pull requests or code content. Workflows that use these triggers must not explicitly check out untrusted code... You must ensure the checked-out code is only ever inspected as data and never executed.

来源：<https://docs.github.com/en/actions/reference/security/secure-use#mitigating-the-risks-of-untrusted-code-checkout>
以及专门文档：<https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target>

`pull_request_target` 的风险点不是“checkout”，而是“checkout 之后的执行步骤”（build/test/install/脚本）。本方案只读取字节、不执行，符合官方建议。

### 2. 同一 workflow 中 base + PR head 双 checkout 的正确写法

#### 2.1 actions/checkout 关键输入（v7.0.1 README）

来源：<https://github.com/actions/checkout/blob/v7.0.1/README.md>

```yaml
repository: ''        # 默认 ${{ github.repository }}
ref: ''               # 分支/tag/SHA；工作流仓库默认取触发事件的 ref/SHA
path: ''              # $GITHUB_WORKSPACE 下的相对目录
persist-credentials: '' # 默认 true；false 时不把 token 持久化到本地 git 配置
filter: ''            # partial clone filter；源码显示会作为 fetch --filter
sparse-checkout: ''   # 换行分隔的 pattern（cone mode 下是目录）
sparse-checkout-cone-mode: '' # 默认 true
fetch-depth: ''       # 默认 1
lfs: ''               # 默认 false
submodules: ''        # 默认 false
allow-unsafe-pr-checkout: '' # 默认 false
```

v7 新增（README “What's new”）：

> checkout now refuses to check out fork pull request code by default when the workflow is triggered by `pull_request_target` or `workflow_run`... set the new `allow-unsafe-pr-checkout: true` input.

源码：
- `src/unsafe-pr-checkout-helper.ts`：只对 fork PR（`pull_request.head.repo.id !== base repo id`）且 ref 命中 `refs/pull/N/(head|merge)` 或 commit 等于 PR head/merge SHA 时抛错。同仓库 PR 不触发。
  <https://github.com/actions/checkout/blob/v7.0.1/src/unsafe-pr-checkout-helper.ts>
- `src/input-helper.ts`：未指定 `ref` 时使用 `github.context.ref` + `github.context.sha`。
  <https://github.com/actions/checkout/blob/v7.0.1/src/input-helper.ts>
- `src/ref-helper.ts`：`refs/pull/N/head` 的 refspec 为 `+refs/pull/N/head:refs/remotes/pull/N/head`；裸 SHA 直接 fetch 该 SHA。
  <https://github.com/actions/checkout/blob/v7.0.1/src/ref-helper.ts>

#### 2.2 推荐写法（base 与 head 分目录、同一 workflow）

```yaml
permissions:
  contents: read

jobs:
  evidence:
    name: evidence          # required check 名必须与此一致
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      # 1) 可信 base：显式 base SHA，仅取 CLI/验收脚本/Manifest
      - uses: actions/checkout@<v7.0.1 的完整 commit SHA>
        with:
          ref: ${{ github.event.pull_request.base.sha }}
          path: base
          persist-credentials: false
          fetch-depth: 1
          sparse-checkout: |
            .scratch/evidence-integrity-v1/manifest
            .scratch/evidence-integrity-v1/scripts
            packages
            scripts

      # 2) 不可信 PR head：只作为数据，独立目录
      - uses: actions/checkout@<v7.0.1 的完整 commit SHA>
        with:
          ref: refs/pull/${{ github.event.pull_request.number }}/head
          path: pr-head
          persist-credentials: false
          fetch-depth: 1
          lfs: false
          submodules: false
          allow-unsafe-pr-checkout: true
          sparse-checkout: |
            .scratch/fpvs-v1-final/work
            .scratch/fpvs-v1-final/artifacts
            .scratch/fpvs-v1-final/runs
            .scratch/generic-playtest-v1/evidence
            .scratch/evidence-integrity-v1/manifest

      # 3) 绑定 head checkout 与事件 head SHA（防 force-push 竞态）
      - name: Bind PR head checkout to event SHA
        env:
          EXPECTED_HEAD: ${{ github.event.pull_request.head.sha }}
        run: test "$(git -C pr-head rev-parse HEAD)" = "$EXPECTED_HEAD"

      # 4) 只用 base 的 CLI 读取 pr-head 数据；不执行 pr-head 内任何文件
      - name: Verify with base CLI
        working-directory: base
        env:
          PR_MANIFEST: ${{ github.workspace }}/pr-head/.scratch/evidence-integrity-v1/manifest/expected-hashes.json
          BASE_MANIFEST: ${{ github.workspace }}/base/.scratch/evidence-integrity-v1/manifest/expected-hashes.json
        run: |
          # 具体参数由 01/03 票决定；关键是 cwd 在 base，PR 路径只作为数据参数
          node scripts/evidence-acceptance.mjs ...
```

要点：
- 两次 checkout 都用**固定的 `path`**（`base` / `pr-head`），不要嵌套，不要 `path: .`。
- head 用 `refs/pull/<N>/head` 而不是 fork 的 `repository:`，这样同仓库与 fork 统一从 base 仓库的 PR ref 读取；不要设置 `repository: ${{ github.event.pull_request.head.repo.full_name }}`。
- `persist-credentials: false`：head 目录的 git 配置不保留 token；base 目录也不需要写权限。
- `allow-unsafe-pr-checkout: true` 只加在 head 的 checkout step，并加注释说明“只作为数据”；base step 不加。
- `fetch-depth: 1` 足够（只需该 commit 的树与 blob）；`lfs: false`、`submodules: false`。
- **所有 `run` 的 `working-directory` 必须是 `base` 或 workspace 根**；绝不 `cd pr-head`。不要 `node pr-head/...`、`pnpm --dir pr-head ...`、`bash pr-head/...`。
- 不要把 PR 的 `title/body/head_ref/branch name` 插入 `run:`；官方 script injection 文档说明这些都是不可信输入：<https://docs.github.com/en/actions/concepts/security/script-injections>。
- 不要把 `pr-head` 加入 `PATH` / `NODE_PATH`；不要让 Node 模块解析从 `pr-head` 找到任何可执行包。
- 证据文件读取必须限制在约定根目录，并拒绝符号链接/路径逃逸（N 系列负向测试覆盖）。

#### 2.3 为什么能保证“不执行 PR 代码”

- workflow 本身来自 base（1.4）。
- base CLI 与验收脚本来自 base checkout。
- head 只被 checkout 到独立目录，且没有任何步骤以该目录为 cwd 或 entrypoint。
- 不运行 `pnpm install/build/test` 于 head；不下载/执行 fork 的 artifact；不 `source` head 文件；不执行 head 的 `.mjs/.js/.sh`。
- `permissions: contents: read`，不引用 secrets；`pull_request_target` 的 token 即使默认有写权限也被显式降为只读。
- 代码/路径注入面：PR 文件名、Manifest 内容、`title/body/head_ref` 都视为数据；路径不拼 shell。
- 残余风险：Git checkout 会解析 head 的 `.gitattributes`（如 `working-tree-encoding`），可能改变工作区字节。建议证据哈希以 Git blob 字节为准，或在 base 侧用 `git -c core.autocrlf=false -c core.eol=lf` 并确认无自定义 filter；此点列入“仍需实验”。

#### 2.4 官方风险模型

`securely-using-pull_request_target` 明确指出：checkout 本身不执行代码，风险在下一步执行；并列出常见 pwn request 形态（checkout head 后 build/test、设置 `repository:` 为 fork、在 checkout 之外 fetch 后运行）。本方案必须逐条避免。

### 3. `workflow_dispatch`：从 base 运行、只读候选 SHA、artifact

#### 3.1 事件语义

来源：<https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch>
<https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow>

关键事实：
- 工作流文件必须存在于**默认分支**，才会有手动触发入口；一旦运行过，可通过 API/CLI 对任意分支或 tag 触发。
- 触发时可指定 `ref` 与 `inputs`；`GITHUB_SHA` 是所选 ref 的最后提交，`GITHUB_REF` 是所选 ref。
- `inputs` 通过 `inputs` 上下文读取；最多 25 个顶层 input，payload 上限 65,535 字符。
- `workflow_dispatch` 产生的 checks **不满足 required check**（见 1.2）。
- 因此 dispatch 必须 `--ref main`，运行 main 上的可信 workflow；候选 SHA 只作为字符串输入。

CLI：
```bash
gh workflow run baseline-verify.yml --ref main -f candidate_sha=<40-hex>
```

#### 3.2 可行写法（候选只读、不执行）

```yaml
on:
  workflow_dispatch:
    inputs:
      candidate_sha:
        description: "40-hex candidate commit"
        required: true
        type: string

permissions:
  contents: read

jobs:
  baseline-verify:
    name: baseline-verify
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@<v7.0.1 完整 SHA>
        with:
          ref: main
          path: base
          persist-credentials: false
          fetch-depth: 1

      - name: Fetch candidate objects only (no execution)
        env:
          CANDIDATE_SHA: ${{ inputs.candidate_sha }}
        run: |
          case "$CANDIDATE_SHA" in
            ''|*[!0-9a-f]*) echo "invalid candidate_sha"; exit 2 ;;
          esac
          test "${#CANDIDATE_SHA}" -eq 40
          git -C base cat-file -e "$CANDIDATE_SHA^{commit}" 2>/dev/null || \
            git -C base fetch --no-tags --depth=1 origin "$CANDIDATE_SHA"
          git -C base worktree add --detach "$RUNNER_TEMP/candidate" "$CANDIDATE_SHA"

      - name: Verify candidate data with base CLI
        working-directory: base
        env:
          CANDIDATE_DIR: ${{ runner.temp }}/candidate
        run: |
          # 只读取 $CANDIDATE_DIR 下的文件；不执行其中任何脚本/构建
          node scripts/evidence-acceptance.mjs ...

      - name: Upload report (always)
        if: always()
        uses: actions/upload-artifact@v7.0.2
        with:
          name: baseline-verify-${{ inputs.candidate_sha }}
          path: ${{ runner.temp }}/report
          retention-days: 30
          if-no-files-found: warn
```

要点：
- `candidate_sha` 必须正则/长度校验后再作为 `git` 参数；通过 `env` 传入，绝不写入 `run: ${{ inputs... }}` 插值。
- `git fetch` 只下载对象；`git worktree add` 只写文件。不要 `pnpm install/build/test`、不要 `node $CANDIDATE_DIR/...`、不要 `source`。
- 候选 checkout 放在 `$RUNNER_TEMP`（runner 控制），不放在 workspace，避免与 base 目录相互污染。
- 候选若是 fork commit 且 base 仓库无法按 SHA fetch，则需要从 fork URL fetch 或先 `refs/pull/N/head`；owner 基线更新 PR 通常同仓库，先按同仓库实现。
- 基线更新场景允许“候选 Manifest/摘要作为期望值”，因为 owner 是信任根；普通 PR 场景绝不允许切换到这种模式（Q14）。两种报告必须在 `trust.anchor.mode` / 报告中明确区分。
- dispatch 的 check 不会成为 PR required check；不要把它写进门禁叙事。
- 可选加固：限制谁能 dispatch（Actions policy 的 actor rule）或使用 environment 审批；但不要用 actor rule 限制 `pull_request_target`（外部 PR 作者无写权限，会被误伤）。

#### 3.3 artifact 输出

来源：<https://github.com/actions/upload-artifact/blob/v7.0.2/README.md>

- `name` 建议包含 `candidate_sha` 或 `run_id/run_attempt`，保证唯一；默认不覆盖同名 artifact。
- `retention-days` 最小 1、最大 90（或仓库设置），30 天合法。
- `if-no-files-found: warn` 确保失败时仍上传已有报告；最好先在失败路径写一个 stub report，避免“失败但无报告”。
- 成功/失败都用 `if: always()` 上传；artifact 内容不要包含 token/secrets。
- upload-artifact 使用 runner 运行时 token，不依赖 `GITHUB_TOKEN` 的写权限；在 `permissions: contents: read` 下可用。

### 4. Repository ruleset API：精确 payload 与语义

#### 4.1 API 与版本

- 端点：`POST /repos/{owner}/{repo}/rulesets`；更新 `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}`；读取 `GET /repos/{owner}/{repo}/rulesets`、`GET /repos/{owner}/{repo}/rulesets/{ruleset_id}`。
- 官方 REST 文档：<https://docs.github.com/en/rest/repos/rules>
- API 版本：`X-GitHub-Api-Version: 2026-03-10`（文档当前示例）。
- 读取规则：`bypass_actors` 只在请求者有 ruleset 写权限时返回（文档 Note：“To prevent leaking sensitive information, the `bypass_actors` property is only returned if the user making the API request has write access to the ruleset.”）。本仓库 token 有 admin（`GET /repos/sihuayin/game-maker` → `permissions.admin: true`）。

#### 4.2 推荐 payload（已验证字段名；创建前仍需 04 票实测）

```json
{
  "name": "p0-03-main-evidence-gate",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [
    {
      "actor_id": 1635996,
      "actor_type": "User",
      "bypass_mode": "pull_request"
    }
  ],
  "conditions": {
    "ref_name": {
      "include": ["~DEFAULT_BRANCH"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "check", "integration_id": 15368 },
          { "context": "test", "integration_id": 15368 },
          { "context": "typecheck", "integration_id": 15368 },
          { "context": "evidence", "integration_id": 15368 }
        ]
      }
    }
  ]
}
```

字段依据：
- `bypass_actors`：`actor_id` 对 `User`/`RepositoryRole`/`Team`/`Integration` 必填；`OrganizationAdmin` 不适用于个人仓库；`actor_type` 枚举 `Integration | OrganizationAdmin | RepositoryRole | Team | DeployKey | User`。来源：REST rules 页面 schema。
- `bypass_mode` 枚举 `always | pull_request | exempt`；`pull_request` 只适用于 branch ruleset，且对 `DeployKey` 不适用；`always` 默认。
- `conditions.ref_name.include` 支持 `~DEFAULT_BRANCH` 与 `~ALL`。
- `required_status_checks` 参数：`required_status_checks[].context` 必填；`integration_id` 可选；`strict_required_status_checks_policy` 必填；`do_not_enforce_on_create` 可选。
- `pull_request` 参数中 `required_approving_review_count`、`dismiss_stale_reviews_on_push`、`require_code_owner_review`、`require_last_push_approval`、`required_review_thread_resolution` 为必填；`allowed_merge_methods` 可选。
- `deletion` / `non_fast_forward` 无 parameters。
- GitHub 自己的 public ruleset 示例（`github/docs`）使用相同结构，required checks 用 `integration_id: 15368`：
  <https://github.com/github/docs/blob/main/.github/rulesets/docs/main-branch-protection.json>

`actor_id` 选择：
- `GET https://api.github.com/users/sihuayin` → `id: 1635996`，`type: User`。
- owner 是个人仓库 admin（`GET /repos/sihuayin/game-maker` → `permissions.admin: true`）。
- 因此 `actor_type: User` + `actor_id: 1635996` 是可直接验证的 owner 标识；比猜测 `RepositoryRole` 数字更稳。GitHub 自己的 ruleset 用 `RepositoryRole` `actor_id: 5`（同上示例），但 5 对应的角色名未在官方 API 文档中给出映射，04 票若要使用必须用响应/实测确认。

`integration_id: 15368`：
- `GET .../commits/53139c.../check-runs` 实测 Actions check run 的 `app.id = 15368`、`app.slug = github-actions`。
- 加 `integration_id` 可防止同名 check 由其他 GitHub App 伪造；若不加则“any source”，但普通 PR 作者无写权限、无法安装 App，威胁模型下也可接受。04 票应在创建后 GET 校验该字段被保留。

#### 4.3 required check 是否必须先运行一次

官方文档：

> A required status check must have completed successfully in the chosen repository during the past seven days.

来源：<https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks>

另：ruleset 故障排查页说明 required check 名格式：

> Workflow: `<job name>`；Reusable workflow: `<job name> / <reusable job name>`；Other checks: `<check name>`。

并且：

> Required status checks do not take workflow, matrix, or event trigger types into account.

来源：<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules#troubleshooting-required-status-checks>

结论：
- 03 票必须先 bootstrap 一次真实运行，产生 `check`/`test`/`typecheck`/`evidence` 四个成功的 check run；04 票再创建 ruleset。否则 UI 可能无候选项，或 required check 永远 pending。
- 四个 job 的 `name:` 必须精确等于上述四个字符串；不要用 matrix（名会带 `(matrix)`），不要把 required job 包进 reusable workflow（名会变成 `caller / called`）。
- **不要给 required job 加 job 级 `if:` 条件**：官方表明确“A job is skipped by a conditional → The job reports Success”。被跳过的 required job 会平凡通过。
- 不要给 required workflow 加 `paths`/`branches` 过滤：workflow 未触发时 required check 保持 pending，会永久阻塞；官方 troubleshooting 明确建议避免。

#### 4.4 owner 在 bypass 列表时的语义

官方文档：

- 可绕过角色包括：“Repository admins, organization owners, and enterprise owners”；还有 maintain/write role、teams、GitHub Apps、Dependabot 等。来源：`data/reusables/repositories/rulesets-bypass-step.md`（docs 页：<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository#granting-bypass-permissions-for-your-branch-or-tag-ruleset>）
- “For pull requests only”：
  > The selected actor is now required to open a pull request to make changes to a repository, creating a clear trail of their changes in the pull request and audit log. The actor can then choose to bypass any branch protections and merge that pull request.
  来源：`data/reusables/repositories/rulesets-branch-tag-bypass-optional-step.md`
- `bypass_mode`：
  > `pull_request` means that an actor can only bypass rules on pull requests... When `bypass_mode` is `exempt`, rules will not be run for that actor and a bypass audit entry will not be created.
  来源：<https://docs.github.com/en/rest/repos/rules>
- 强推限制：
  > If force pushes are blocked, organization owners or repository administrators will be unable to change or rename the default branch unless they are authorized to bypass the ruleset.
  来源：<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#block-force-pushes>

语义结论：
- `bypass_mode: "pull_request"`：owner 不能直接 push/强推/删除 main，但可以在任意 PR 上绕过 required checks 合并。这样每次 break-glass 至少留下 PR、commit、check run 轨迹；**推荐**。
- `bypass_mode: "always"`：owner 可直接 push/强推/删除/绕过 checks；适合真正的紧急通道，但轨迹最弱，且可能无法从个人 audit log 取得记录。
- `bypass_mode: "exempt"`：规则根本不运行且不产生 bypass audit entry；**不要用**。
- 非管理员（无 bypass）受 `pull_request` + `required_status_checks` + `deletion` + `non_fast_forward` 约束；直接推送会被拒。
- owner 是 admin 并不自动等于 bypass；必须显式加入 bypass 列表（文档用“unless they are authorized to bypass the ruleset”表述）。

#### 4.5 user-owned public repo 的 audit log 可见性与保留

- 个人账号**没有组织 audit log API**。组织 audit log API 的文档面向 org/GHEC：<https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization#using-the-audit-log-api>
- 个人账号有 **security log**：
  > The security log lists all actions performed within the last 90 days.
  来源：<https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-security-log>
  可在 Settings → Archives → Security log 查看、搜索、导出（导出同样受 90 天窗口限制）。
- 个人 security log 的事件参考页（<https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/security-log-events>）列出了 `repository_ruleset` **分类**，但抓取到的生成页面未列出 `repository_ruleset.create/update/destroy` 等具体事件；抓取到的组织 audit log 事件参考中，ruleset 只看到 `repository_ruleset.create` / `.destroy` / `.update` 三个配置变更事件，未发现专门的 “ruleset bypass” 事件：<https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/audit-log-events-for-your-organization>
- 组织 audit log 中有 `protected_branch.policy_override`（“A branch protection requirement was overridden by a repository administrator”），但这是 **branch protection** 事件，不是 ruleset bypass 事件。
- API schema 说 `always`/`pull_request` 模式会产生 “bypass audit entry”（相对 `exempt` 不产生），但该 entry 在个人 security log 中是否可见/可导出，官方个人事件页未给出明确条目，**必须 04 票实测**。

结论：Q17 的“break-glass 必须可追溯”不能假设 GitHub audit log 一定提供 ruleset bypass 记录。最低可交付的追溯材料是：
1. ruleset 变更前后 JSON 快照（含 `bypass_actors`，需 admin token）；
2. 每次 break-glass 的 PR 编号、merge commit、head/base SHA、check run ID/结论、run ID；
3. 若是直接 push break-glass，记录 commit、时间、操作者、原因（写入更新日志/runbook）；
4. 明确披露 personal security log 只有 90 天且未验证含 ruleset bypass 事件。

### 5. actions/checkout sparse-checkout + `filter: blob:none`

#### 5.1 是否只拉所需 blob

- Git 官方 `git clone` 文档：
  > `--filter=blob:none` will filter out all blobs (file contents) until needed by Git.
  来源：<https://git-scm.com/docs/git-clone>
- Git partial clone 文档：过滤后的 pack 是不完整的 promisor pack；checkout（unpack-trees）“has been taught to bulk pre-fetch all required missing blobs in a single batch”。
  来源：<https://git-scm.com/docs/partial-clone>
- actions/checkout 源码：若设置了 `sparse-checkout` 且未显式设置 `filter`，会自动把 fetch filter 设为 `blob:none`：
  ```ts
  if (settings.filter) {
    fetchOptions.filter = settings.filter
  } else if (settings.sparseCheckout) {
    fetchOptions.filter = 'blob:none'
  }
  ```
  来源：<https://github.com/actions/checkout/blob/v7.0.1/src/git-source-provider.ts>（第 182–186 行）
- 同一源码随后仍执行 `git sparse-checkout set ...`，然后 `git checkout`；因此 README 中 “filter: Overrides sparse-checkout if set” 的措辞容易误读：源码里 `filter` 只决定 fetch 的 filter，不会取消 sparse checkout。把 `filter: blob:none` 与 `sparse-checkout` 同时写是可行的，但通常不必显式写（sparse 已自动加）。
- 注意：它只保证“不拉稀疏路径之外的 blob”，不是“只拉 Manifest 的 151 个 required 文件”。稀疏路径内的所有 tracked 文件都会被检出并拉 blob。路径越窄越好。

#### 5.2 cone mode 与 `.scratch` pattern 写法

Git 官方 cone mode 规则：

> For any directory specified, all paths below that directory will be included, and any paths immediately under leading directories (including the toplevel directory) will also be included... even if no directories are specified, then the files in the toplevel directory will be included.

来源：<https://git-scm.com/docs/git-sparse-checkout>（INTERNALS — CONE MODE HANDLING）

因此推荐（cone mode，默认）：

```yaml
sparse-checkout: |
  .scratch/fpvs-v1-final/work
  .scratch/fpvs-v1-final/artifacts
  .scratch/fpvs-v1-final/runs
  .scratch/generic-playtest-v1/evidence
  .scratch/evidence-integrity-v1/manifest
  .scratch/evidence-integrity-v1/scripts
```

实际效果（本地实测）：
- 自动包含仓库根文件（`package.json`、`pnpm-lock.yaml`、`tsconfig*.json` 等）；
- 包含 `.scratch/` 下直接文件/目录项、`.scratch/fpvs-v1-final/` 的直接文件（如 `freeze.mjs`、`map.md`）；
- 包含指定目录下任意深度文件；
- 不会包含 `.scratch/playtest-v1/`、`.scratch/asset-integration-v1/` 等未列目录。

若需要精确到单个文件或排除模式，只能用 non-cone mode（`sparse-checkout-cone-mode: false`），但 Git 官方已把 non-cone 标记为 deprecated，且 actions/checkout 的非 cone 实现是直接写 `info/sparse-checkout`。**优先用 cone mode 目录**；不要为了 151 个文件枚举 151 条 pattern（会随 Manifest 漂移）。

#### 5.3 磁盘与耗时测量

在仓库内实测（本地 worktree，避免网络；`66f3a74`）：

| 模式 | 实际文件数 | 磁盘 | apparent bytes | checkout 时间（本地，热对象） |
|---|---:|---:|---:|---:|
| evidence-only（5 个 `.scratch` 目录 + manifest/scripts） | 699 | 53 MiB | 51.2 MiB | 4.19 s |
| evidence + `packages` + `scripts` | 1,043 | 57 MiB | 约 55 MiB | 4.91 s（含 sparse set 0.09 s） |
| 全仓库 tracked | 8,741 | — | 1,708.2 MiB | — |

`git ls-tree` 精确统计：

| 路径 | 文件数 | 字节数 |
|---|---:|---:|
| 上述 evidence 路径集合 | 684 | 51.0 MiB |
| `packages` + `scripts` | 344 | 3.7 MiB |
| `.scratch` 全部 tracked | 8,202 | 1,679.7 MiB |
| 全仓库 tracked | 8,741 | 1,708.2 MiB |

Manifest 侧：
- `expected-hashes.json` 223 个文件，`bytes` 合计 19.3 MiB；151 个 required 合计 18.2 MiB。
- 28 个 optional `role=log` 文件被 `.gitignore` 忽略、未入库；CI 全新 checkout 必然缺这 28 个 optional，按 Q12 应逐条报告、不失败。

**关于图内 253 MiB 估算的修正：**
- 工作区 `du -sh .scratch/generic-playtest-v1/evidence` = 187 MiB，但 `git ls-tree` 该目录 tracked 仅 189 个文件 / 5.9 MiB；差额来自被 `.gitignore` 的 `out/` 文件（本地 522 个实际文件 vs 189 个 tracked）。
- `fpvs-v1-final/{work,artifacts,runs}` 工作区各约 15–16 MiB，与 tracked 接近。
- 253 MiB ≈ 16+16+15+187+manifest，包含忽略文件；**CI 全新稀疏 checkout 实际约 51–57 MiB**（不含 `node_modules`/构建产物）。Q15 的“约 253 MiB”应改为“tracked sparse ≈ 55 MiB；install/build 后另测”。

测量方法（Actions runner 上）：
```bash
# checkout 前
df -h "$GITHUB_WORKSPACE"; du -sh "$GITHUB_WORKSPACE"
# 每个 checkout step 单独命名，便于从 job API 取 step 时间
/usr/bin/time -p du -sh base pr-head
du -sk base pr-head
find base pr-head -type f | wc -l
git -C base count-objects -vH
git -C pr-head count-objects -vH
```
- GitHub REST：`GET /repos/{owner}/{repo}/actions/jobs/{job_id}` 的 `steps[]` 含 `started_at`/`completed_at`，可计算每个 checkout step 墙钟时间。
- 本地/CI 都应同时记录 `du -sk`（块）与 `du -sb`/`stat` 求和（apparent）；APFS/Linux 的块占用不同。
- 网络对照实验：本次在本机 `git clone --filter=blob:none --no-checkout --depth=1` 9.66 s / `.git` 364 KiB；随后 lazy blob fetch 因本机到 GitHub 链路过慢失败（`curl 28 ... less than 1000 bytes/sec`），**不是 GitHub 行为问题**。Actions runner 的实际网络耗时必须由 03 票真实运行测量。

### 6. 会推翻/限制当前方案的事实

#### 6.1 P0：public 仓库 `pull_request_target` 默认策略（2026-12-02 起）

官方 `securely-using-pull_request_target`：

> For public repositories that do not already have an applicable Actions event policy, GitHub adds a default policy that blocks workflows triggered by `pull_request_target`.
> Currently runs in evaluate mode... On December 2, 2026, GitHub will enforce the default policy for affected repositories...
> If the workflow must continue to use `pull_request_target`, create or update an applicable Actions event policy that explicitly allows `pull_request_target`.

来源：<https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target#default-policy-for-pull_request_target>
Actions policy 文档：<https://docs.github.com/en/actions/concepts/about-actions-policies>、<https://docs.github.com/en/actions/how-tos/administer/control-workflow-execution>、<https://docs.github.com/en/rest/actions/policies>

本仓库实测：`GET https://api.github.com/repos/sihuayin/game-maker/actions/policies` → `{"total_count":0,"policies":[]}`，**没有显式 policy**。

可行 payload（**HITL，04 票或新建前置票**）：

```http
POST /repos/sihuayin/game-maker/actions/policies
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2026-03-10
```

```json
{
  "name": "allow-pull-request-target-evidence",
  "enforcement": "active",
  "conditions": {
    "workflow_path": {
      "include": [".github/workflows/evidence.yml"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "restrict_action_events",
      "parameters": {
        "allowed_events": ["pull_request_target", "workflow_dispatch", "push", "pull_request"]
      }
    }
  ]
}
```

说明：
- `restrict_action_events.parameters.allowed_events` 的合法值包含 `pull_request_target`、`workflow_dispatch`、`push`、`pull_request`（REST 文档 schema 已列）。
- 不要加 `restrict_actions_actors` 去只允许 owner：外部 fork PR 作者没有写权限，actor rule 会把 `pull_request_target` 也挡掉。
- 若 policy 只覆盖 evidence workflow，其他 workflow 仍受默认策略影响；本仓库目前只有计划中的 evidence/回归 workflow，按实际路径调整 include。
- 当前 evaluate 模式不会阻断，但 **12-02 后会阻断**；必须在截止日前完成并验证。这个前置不在 Q6–Q18 中，但属于平台新约束。

#### 6.2 actions/checkout v7 fork PR 默认拒绝

见 2.1。不加 `allow-unsafe-pr-checkout: true`，fork PR 的 head checkout 会直接失败。需要 03 票明确写入并解释“只读数据”。

#### 6.3 `workflow_dispatch` check 不能当 required check

见 1.2。05 票的 dispatch 只能作为 owner dry-run/基线验证；不能把 dispatch 成功当作普通 PR 门禁。这与 Q14 一致，但报告/叙事必须区分。

#### 6.4 required job 被条件跳过 = Success

见 4.3。绝对不要在 evidence job 上加 job 级 `if:`。如果为了“仅 fork”或“仅 Manifest 改变时运行”加条件，会让 required check 平凡通过，直接破坏 Q6/Q14。workflow 级 `paths` 过滤则会造成 pending 阻塞。两种都要避免。

#### 6.5 audit log 限制

见 4.5。Q17 的“可追溯”若定义为“GitHub audit log 中能查到每次 bypass”，个人账号仓库可能不成立。建议把可追溯定义改为“PR + merge commit + check run + ruleset 快照 + 人工记录”，并选择 `bypass_mode: "pull_request"`。

#### 6.6 `pull_request_target` 的 `GITHUB_SHA` 是默认分支，不是 PR base 分支

事件表明确是 default branch。若 PR 目标不是默认分支，base-only 可信逻辑与 base Manifest 会对不上。本图只保护 `main`（默认分支），所以可接受；workflow 应加 `branches: [main]`，ruleset 的 `~DEFAULT_BRANCH` 也指向 main。未来若保护其他分支，必须重新评估。

#### 6.7 检查名/事件绑定的歧义

- required check 只按名字匹配，不看事件触发器；同名 check 来自不同 workflow 时可能产生歧义。
- reusable workflow 的 check 名是 `caller / called`；matrix 会带后缀；不要用它们承载四个 required 名。
- 普通 job 的 check 名 = job `name:`（或 job id）。03 票 bootstrap 后用 API 确认实际 `check_runs[].name`，04 票再写 ruleset。

#### 6.8 PR base retarget 的重跑缺口（实现级）

`pull_request_target` 默认只跑 `opened` / `synchronize` / `reopened`。如果 PR 从别的 base 分支 retarget 到 `main`，GitHub 是否触发 `synchronize` 需要实测（PR webhook 的 `edited` action 通常涵盖 base 分支变更，但 `pull_request_target` 的默认 types 不含 `edited`）。若不重跑，旧的 evidence check 仍挂在同一个 head SHA 上，可能被 ruleset 当作已满足，而它比较的是旧 base 的 Manifest。

建议：
- 显式写 `types: [opened, synchronize, reopened, edited]`，并在 job 内断言 `github.event.pull_request.base.ref == 'main'`（或 ruleset 目标分支）；
- 或至少在 03 票实测 retarget 行为后再决定；
- `strict_required_status_checks_policy: true` 可以缓解 base 前进，但不能单独覆盖 retarget 场景，因为 head 可能本来就包含新 base 的提交。

#### 6.9 `.gitattributes` / 符号链接等数据面风险

- PR head 的 `.gitattributes` 可能影响 checkout 后的工作区字节（如 `working-tree-encoding`），导致哈希口径与 Git blob 不一致；不会让篡改通过，但可能造成假失败。
- PR 可在证据路径放符号链接；读取时必须 `lstat`/`O_NOFOLLOW` 并限制根目录，否则可能读取 base 或仓库外文件。N 系列负向测试覆盖。
- 建议证据哈希优先对 Git blob 字节计算，或固定 `core.autocrlf=false`、确认无自定义 filter；此点列入实验。

---

## 对 P0-03 的影响（直接支撑 03/04/05）

### 03（CI Workflow）

必须做：
1. **先创建允许 `pull_request_target` 的 Actions policy**（6.1）；否则 12-02 后 workflow 被平台阻断。建议与 04 一起作为 HITL 前置。
2. evidence workflow 用 `pull_request_target` + `branches: [main]`；建议 `types: [opened, synchronize, reopened, edited]` 并断言 base 为 `main`（防 base retarget 不重跑，见 6.8）；**不要** paths filter；job 名精确为 `evidence`；不要 job 级 `if`。
3. base checkout 显式 `github.event.pull_request.base.sha`；head checkout `refs/pull/<N>/head`；两个 `path`；`persist-credentials: false`；head 加 `allow-unsafe-pr-checkout: true`；`fetch-depth: 1`；`lfs: false`；`submodules: false`。
4. 增加 head SHA 回验（`rev-parse HEAD == github.event.pull_request.head.sha`），防 force-push 竞态。
5. `permissions: contents: read`；不引用 secrets；`concurrency` 按 PR number；`timeout-minutes`。
6. 所有命令 cwd 在 base；绝不执行 pr-head 内文件；路径从 base Manifest/环境变量读取，不拼 shell。
7. 报告 artifact 成功/失败都上传（`if: always()`，`retention-days: 30`，`if-no-files-found: warn`）；失败路径写 stub。
8. 回归 workflow（`pull_request` + `push` main）四个 job 名与 required 名一致；不要 matrix/reusable 包裹 required job。fork PR 的 `pull_request` run 可能 `action_required`（需 approval），这是正常的；不要因此让 `check/test/typecheck` 变成 job 级 skip。
9. 记录 checkout/install/build/test 的 step 时间与磁盘；sparse 实际约 55 MiB（tracked），不是 253 MiB；install/build 后另测。

### 04（Repository ruleset，HITL）

1. 先 bootstrap 一次真实运行，确认四个 check run 名（`check`/`test`/`typecheck`/`evidence`）和 `app.id=15368`。
2. 用 4.2 payload 创建 ruleset；`target: branch`、`enforcement: active`、`~DEFAULT_BRANCH`、`deletion`、`non_fast_forward`、`pull_request`（0 approvals）、`required_status_checks`（strict=true）。
3. owner bypass：优先 `User` + `1635996` + `bypass_mode: "pull_request"`；不要 `exempt`。若确需直接 push break-glass，再评估 `always` 并明确记录人工轨迹。
4. 创建前后 GET 快照；GET 带 admin token 才会返回 `bypass_actors`；保存 ruleset id、JSON、API 版本。
5. 真实红/绿 PR：红色 PR 记录 required check failure + check run id + `mergeable_state=blocked`；绿色 PR 记录四项 success + check run id + `mergeable_state=clean`；明确 owner 仍可 bypass（单账号无法实测非管理员阻断，如实披露）。
6. audit log：记录 personal security log 可见内容/不可见内容；不要声称有完整 audit log；把 PR/commit/check/run 记录作为主证据。

### 05（基线更新与 dispatch）

1. dispatch workflow 必须存在于默认分支；始终 `--ref main`；候选 SHA 通过 `inputs` 传入并正则/长度校验。
2. 用 `git fetch` + `git worktree add` 到 `$RUNNER_TEMP` 读取候选；不执行候选代码；base CLI 只把候选当数据；报告 `trust.anchor.mode=baseline-update` 与普通 PR 区分。
3. artifact 30 天；报告包含 candidate SHA、base workflow SHA/run id、Manifest 摘要、required/optional 结果。
4. dispatch 不能作为 required check；不要把它写进普通 PR 门禁。
5. 可选：用 Actions policy actor rule 或 environment 限制 dispatch 触发者；但不要影响 `pull_request_target` 的外部 PR。

### 01/02 的补充

- 证据哈希口径要明确是 Git blob 字节还是工作区字节；若用工作区，需处理 `.gitattributes` 风险。
- 符号链接/路径逃逸必须在 CLI 层拒绝；checkout 目录本身不提供隔离保证。

---

## 与 Q6–Q17 假设的冲突

| 假设 | 核实结果 | 是否推翻 | 需要谁处理 |
|---|---|---|---|
| Q6：base-only `pull_request_target` 可作可信门禁 | 成立；check 可关联 head 并满足 required check；fork/同仓库一致；无 approval | 否，但新增两个平台前置：Actions event policy（12-02 截止）+ checkout fork 开关 | 主会话决定放 03/04 或新票；用户需知晓 12-02 截止 |
| Q14：普通 PR Manifest/摘要必须等于 base | 成立；base SHA 显式 checkout 即可；注意不要把 base 写成 `github.sha` | 否 | 03 实现 |
| Q6/Q14：evidence job 一定执行 | 若加 job 级 `if`，GitHub 会把它当 Success；若 paths 过滤，会 pending | **实现级高危**，不推翻模型但会破坏门禁 | 03 实现必须禁止条件/过滤 |
| Q17：owner 在 bypass 列表；break-glass 可追溯 | ruleset 支持 User bypass；`pull_request` 模式留 PR 轨迹；但个人仓库 audit log 只有 90 天且未证实含 ruleset bypass 事件 | **部分冲突**：不能承诺 GitHub audit log 级别可追溯 | 需用户确认“可追溯”的口径；建议 PR-only bypass + 人工记录 |
| Q11/Q15：evidence sparse 约 253 MiB | 实际 tracked sparse 约 51–57 MiB；253 MiB 含被忽略的 `out/` 工作区文件 | 否，估算需修正 | 03/11 记录真实值 |
| Q10：四个 required check 名稳定 | 可行；但 check 名格式受 job name/reusable/matrix 影响；必须先 bootstrap 一次成功运行 | 否，需实现约束 | 03/04 |
| Q5/Q14：`workflow_dispatch` 用于基线验证 | 可行；但 dispatch checks 不满足 required check、不出现在 PR | 否，必须区分叙事 | 05 |
| Q17：不新增 push 审计 workflow | 仍然可行；但 break-glass 追溯依赖 PR/人工记录，不能依赖 audit log | 否 | 04/用户确认 |

**需要用户/主会话明确裁定的两点：**
1. **12-02 前的 Actions event policy**：是否把“创建允许 `pull_request_target` 的 repo Actions policy”放入 03 或 04，作为 HITL 前置。
2. **Q17 “break-glass 可追溯”的定义**：接受“PR + merge commit + check run + ruleset 快照 + 人工记录”，还是要求 GitHub audit log（个人仓库可能不满足）。

---

## 仍需实验验证的点

1. **Actions runner 上的真实 sparse 耗时/磁盘**：base + head 两次 checkout、`pnpm install`、`pnpm build`、`pnpm test:evidence` 后的 `du -sk`/`du -sb`；用 `jobs/{job_id}.steps` 计算 step 墙钟。本机网络实验失败，不能代替。
2. **四个 check 名的真实产出**：bootstrap 后 `GET /commits/{head}/check-runs` 确认 `name`、`app.id=15368`、`conclusion`；确认没有 matrix/reusable 后缀。
3. **ruleset API POST 的实际响应**：`bypass_actors` 是否保留 `User/1635996/pull_request`；required checks 是否接受四个 context；`~DEFAULT_BRANCH` 是否按预期解析；是否要求 context 先存在。
4. **owner bypass 实测**：owner 直接 push 是否被 `pull_request` 模式阻断；红 PR required failure 时 `mergeable_state` 与 merge 按钮；owner 是否仍能 bypass 合并；`always` 与 `pull_request` 的差异。非管理员阻断无第二账号，如实披露。
5. **personal security log**：创建/更新 ruleset、bypass 合并/直接 push 是否产生 `repository_ruleset.*` / bypass 条目；是否可搜索/导出；90 天窗口外的处理。
6. **Actions policy**：创建后 `pull_request_target` 是否正常；12-02 后默认策略是否仍影响未覆盖的 workflow；include 路径是否能精确覆盖 evidence workflow。
7. **fork PR head checkout**：`refs/pull/N/head` + `allow-unsafe-pr-checkout: true` 在 v7.0.1 的实际行为；force-push 竞态下 `rev-parse HEAD` 回验是否按预期失败。
8. **`.gitattributes`/working-tree-encoding**：是否影响 evidence 文件哈希；是否需要改为 Git blob 字节口径；符号链接/路径逃逸在 CLI 中的拒绝。
9. **base retarget**：PR 从其他分支 retarget 到 `main` 时，`pull_request_target` 是否以 `edited` 触发并重跑；旧 check 是否会残留为 required 成功。
10. **artifact**：fork `pull_request_target` 下 upload-artifact 是否可用、配额/保留、失败路径 stub 是否上传。
11. **required check 添加时机**：ruleset API 是否允许未运行过的 context；UI 是否必须近 7 天成功运行；7 天窗口对低频 workflow 的影响。

---

## 附：关键只读命令与响应索引

### 事件 / check 关联

```bash
# fork PR 的两个 run
gh api 'repos/pulumi/examples/pulls/3064' \
  --jq '{number,head:.head.repo.full_name,head_sha:.head.sha,mergeable_state}'
gh api 'repos/pulumi/examples/actions/runs?head_sha=53139c45e13aaf276a43855b13c8a63ea188a20e' \
  --jq '.workflow_runs[] | [.id,.event,.conclusion,.head_sha] | @tsv'
# 期望：pull_request -> action_required；pull_request_target -> success
gh api 'repos/pulumi/examples/commits/53139c45e13aaf276a43855b13c8a63ea188a20e/check-runs' \
  --jq '.check_runs[] | {name,conclusion,head_sha,app_id:.app.id,details_url}'
# 期望：comment-on-pr success，app_id 15368，details_url 指向 pull_request_target run

# fork PR 的 GraphQL rollup（SkeletonView #601）
gh api graphql -f query='query { repository(owner:"Juanpe", name:"SkeletonView") { pullRequest(number:601) { mergeStateStatus headRefOid commits(last:1){nodes{commit{statusCheckRollup{contexts(first:30){nodes{__typename ... on CheckRun {name conclusion checkSuite{workflowRun{event}}}}}}}}}}}}'
# 期望：lint FAILURE / danger SUCCESS，workflowRun.event 均为 pull_request_target

# 同仓库 PR（AstroNvim #2902）
gh api repos/AstroNvim/AstroNvim/actions/runs/31040775490 \
  --jq '{event,conclusion,head_sha,head_branch}'
gh api repos/AstroNvim/AstroNvim/check-suites/84195522113 \
  --jq '{head_sha,latest_check_runs_count}'
```

### 仓库现状（只读）

```bash
gh api repos/sihuayin/game-maker \
  --jq '{visibility,default_branch:.default_branch,permissions,owner_id:.owner.id}'
gh api repos/sihuayin/game-maker/actions/permissions/workflow
# {"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}
gh api repos/sihuayin/game-maker/actions/policies
# {"total_count":0,"policies":[]}
gh api repos/sihuayin/game-maker/rulesets
# []
gh api users/sihuayin --jq '{id,login,type}'
# {"id":1635996,"login":"sihuayin","type":"User"}
```

### 本地稀疏检出实验（只读，产物在 /tmp）

```bash
# evidence-only：53 MiB / 699 files / 4.19 s
git worktree add --no-checkout /tmp/wt HEAD
cd /tmp/wt
git sparse-checkout set \
  .scratch/fpvs-v1-final/work \
  .scratch/fpvs-v1-final/artifacts \
  .scratch/fpvs-v1-final/runs \
  .scratch/generic-playtest-v1/evidence \
  .scratch/evidence-integrity-v1/manifest \
  .scratch/evidence-integrity-v1/scripts
/usr/bin/time -p git checkout --force HEAD
du -sh .; find . -path ./.git -prune -o -type f -print | wc -l
```

精确字节：
```bash
git ls-tree -r -l HEAD -- <paths> | awk '{s+=$4;n++} END{printf "%d files %.1f MiB\n",n,s/1048576}'
```

---

## 来源 URL 索引

官方文档：
- `pull_request_target` 事件：<https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target>
- `workflow_dispatch` 事件：<https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch>
- 安全使用 `pull_request_target`：<https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target>
- Actions 安全加固 / 不可信 checkout：<https://docs.github.com/en/actions/reference/security/secure-use#mitigating-the-risks-of-untrusted-code-checkout>
- 脚本注入：<https://docs.github.com/en/actions/concepts/security/script-injections>
- fork workflow approval：<https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks>
- 仓库 Actions fork 设置：<https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#controlling-changes-from-forks-to-workflows-in-public-repositories>
- 手动运行 workflow：<https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow>
- required status checks 故障排查：<https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks>
- status checks 参考：<https://docs.github.com/en/pull-requests/reference/status-checks>
- ruleset 故障排查：<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules#troubleshooting-required-status-checks>
- ruleset 可用规则：<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets>
- 创建 ruleset（含 bypass）：<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository>
- ruleset 概览：<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets>
- REST rules：<https://docs.github.com/en/rest/repos/rules>
- Actions policies 概念：<https://docs.github.com/en/actions/concepts/about-actions-policies>
- 控制 workflow 执行：<https://docs.github.com/en/actions/how-tos/administer/control-workflow-execution>
- REST Actions policies：<https://docs.github.com/en/rest/actions/policies>
- 个人 security log：<https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-security-log>
- 个人 security log 事件：<https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/security-log-events>
- 组织 audit log API/保留：<https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization#using-the-audit-log-api>
- 组织 audit log 事件：<https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/audit-log-events-for-your-organization>

Action / Git 一手源码：
- actions/checkout v7.0.1 README：<https://github.com/actions/checkout/blob/v7.0.1/README.md>
- actions/checkout unsafe 检查：<https://github.com/actions/checkout/blob/v7.0.1/src/unsafe-pr-checkout-helper.ts>
- actions/checkout fetch/sparse：<https://github.com/actions/checkout/blob/v7.0.1/src/git-source-provider.ts>
- actions/checkout refspec：<https://github.com/actions/checkout/blob/v7.0.1/src/ref-helper.ts>
- actions/upload-artifact v7.0.2：<https://github.com/actions/upload-artifact/blob/v7.0.2/README.md>
- Git partial clone：<https://git-scm.com/docs/partial-clone>
- Git sparse checkout：<https://git-scm.com/docs/git-sparse-checkout>
- Git clone `--filter=blob:none`：<https://git-scm.com/docs/git-clone>
- GitHub 自己的 ruleset 示例：<https://github.com/github/docs/blob/main/.github/rulesets/docs/main-branch-protection.json>

只读 API 证据：
- fork PR：<https://api.github.com/repos/pulumi/examples/pulls/3064>
- fork head runs：<https://api.github.com/repos/pulumi/examples/actions/runs?head_sha=53139c45e13aaf276a43855b13c8a63ea188a20e>
- fork head check runs：<https://api.github.com/repos/pulumi/examples/commits/53139c45e13aaf276a43855b13c8a63ea188a20e/check-runs>
- 同仓库 PR run：<https://api.github.com/repos/AstroNvim/AstroNvim/actions/runs/31040775490>
- 同仓库 check suite：<https://api.github.com/repos/AstroNvim/AstroNvim/check-suites/84195522113>
- 本仓库工作流权限：<https://api.github.com/repos/sihuayin/game-maker/actions/permissions/workflow>
- 本仓库 Actions policies：<https://api.github.com/repos/sihuayin/game-maker/actions/policies>
- 本仓库 rulesets：<https://api.github.com/repos/sihuayin/game-maker/rulesets>
- owner：<https://api.github.com/users/sihuayin>
