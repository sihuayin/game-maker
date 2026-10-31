# P0-03：交付证据可信性与 CI 自动验收

Labels: wayfinder:map
Tracker: local-markdown
Effort: p0-03-evidence-trust

> 本图 2026-10-30 开、**2026-10-31 关闭**。输入：`docs/v7.6/演示.md`（P0-03 PRD，只读，原文不改）。
> **终点形态（用户 2026-10-30 裁定 Q1 = a）**：**承载执行** —— 在 `main` 上真正落成可信交付证据门禁，达到 E2/E3 收口，而不是停在审计报告或方案。
> **Q1–Q21 已全部收敛**；逐字记录见 [rulings-2026-10-30.md](rulings-2026-10-30.md)。本图不再增加信任模型选项。
> **结构**：8 张实施票（00–06 + 08 绿基线前置）+ 1 张研究票（07）；00 是 03 的平台前置，07 是 03/04/05 的事实前置，08 是 03 的绿基线前置。

## Destination

在 `main` 上落成一条**普通 PR 无法伪造**的交付证据可信门禁：

1. **可信执行逻辑来自受保护 base**：workflow、CLI、验收脚本、Manifest、摘要都由 base 提供；PR head 只作为不可信证据数据。
2. **普通 PR 强制清单恒等**：`PR Manifest == base Manifest` 且 `PR SHA-256 == base SHA-256`；随后由 base 逻辑验证 PR head 的 151 个 required 证据。
3. **负向能力可证**：N01–N17 覆盖篡改、双重篡改、缺失、身份错配、路径逃逸、符号链接等；每个反例验证具体失败原因，而不只是非零退出码。
4. **门禁实际生效**：四项 required checks 在真实 GitHub PR 上运行；Repository ruleset 实际启用；owner bypass 边界明确；真实红绿 PR 留下完整证据。
5. **基线更新独立**：普通 PR 不能改自己的验收标准；基线更新只走 owner 专用、可追溯通道。
6. **冻结基线复核**：FPVS-V1 的 223 文件 / 151 required 在新锚点下正式复核；人工视觉审核仍由人确认。
7. **约束**：全程零付费、零生产交付修改、零历史证据覆盖。

## Notes

### 权威与输入

- PRD（只读）：`docs/v7.6/演示.md`。
- 三轮裁定（冻结输入）：[rulings-2026-10-30.md](rulings-2026-10-30.md)。
- 前序已完成能力（不重写）：[`evidence-integrity-v1`](../evidence-integrity-v1/map.md) —— 223 文件清单、校验器、`verify-delivery`、`pnpm test:evidence`、18 个负向用例、2026-10-29 正式 `pass`。
- 领域词汇：`CONTEXT.md` 是唯一权威；本图不新增同义词，决策不写进词汇表。

### 已核实事实（2026-10-30，只读）

| 事实 | 值 |
|---|---|
| 当前分支 / HEAD | `main` / `66f3a74`；工作区仅 `docs/v7.6/演示.md` 未跟踪 |
| 正式基线 Manifest | `.scratch/evidence-integrity-v1/manifest/expected-hashes.json` |
| 完整 SHA-256 | `ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd` |
| 可信锚点文件 | `.scratch/evidence-integrity-v1/manifest/expected-hashes.sha256`（`sha256:<完整 SHA-256>`；已随 PR #3 入库） |
| Manifest 规模 | 61,616 B；223 文件（151 required / 72 optional）；13 records；9 roots |
| optional 日志 | 28 条 `role=log` 被 `.gitignore` 忽略；required 151 条全部入库 |
| 仓库 | public；默认分支 `main`；token 有 `admin`；唯一 collaborator 是 `sihuayin` |
| GitHub Actions | 已启用；**3 个 workflow（ci / evidence / baseline-update）**；默认 workflow 权限 `read`；无 secrets |
| CI 四个 check | `check` / `test` / `typecheck` / `evidence`；app id `15368`；PR #4 全 success（2026-10-31） |
| 基线更新日志 | `.scratch/evidence-integrity-v1/manifest/MANIFEST-UPDATES.md`；最后一条 `newSha256` 由 `scripts/check-manifest-updates.mjs` 校验 |
| 基线更新通道 | `workflow_dispatch baseline-update`（候选只读；artifact 30 天；不自动合并） |
| 保护状态 | **ruleset `26268801` active**（PR + 四项 required checks + 禁 force push/删除；owner `pull_request` bypass）；无 CODEOWNERS |
| 证据 job 体积 | tracked sparse 实测 **51–57 MiB**（evidence-only 53 MiB / 699 文件 / 4.19 s；253 MiB 估算含被忽略的 `out/`） |
| 回归 job 体积 | git 追踪 `.scratch` 约 **1.64 GiB / 8,202 文件**（无 LFS）；runner 上 full checkout 实测 `du -sh .` = **2.2G** |
| `pnpm check` 依赖 | `check-links` 扫描 890 份 md / 3,029 条链接；706 个目标在 `.scratch`；2026-10-31 修复 7 条历史链接后 **exit 0** |
| `pnpm test` 依赖 | 直接读取 `.scratch/playtest-v1/runs`（549 MiB）、`.scratch/asset-integration-v1/runs/2026-10-20f-lurker`（192 MiB）等 |
| 安装/构建 | 不需要 `game-maker.local.json`、不需要私有 registry；`pnpm build` 只写忽略的 `dist/` |
| 平台策略 | public 仓库 `pull_request_target` 自 **2026-12-02** 起默认被 Actions policy 阻断；**policy `10162` 已 active，仅允许 `evidence.yml` 使用 `pull_request_target`（00 票，2026-10-31）** |
| 审计可见性 | 个人账号仓库无组织 audit log API；personal security log 仅 90 天，未证实含 ruleset bypass 事件 |
| 验收运行 | 只读；不联网、不开 Chrome、不调模型；历史 CLI 耗时约 1.2–5.8 s（不含 build） |
| 最终 main / 复核 | `2cf31cbe1d2fee2d9e7cb4f9ec587e376c22a605`；223 文件 / 151 required / 72 optional / 13 records / diagnostics 0 / `trust.anchor=matched`；protected 223 条 diff 0 |

### 信任链（冻结输入）

```
受保护的 base
  ├── workflow
  ├── verify-delivery CLI
  ├── evidence-acceptance 脚本
  ├── expected-hashes.json
  └── expected-hashes.sha256
         │
         ▼
    可信验收执行环境
         │
         ├── 读取 PR head 的证据文件（只读，不执行）
         ├── 比较 PR Manifest 与 base Manifest
         ├── 用 base Manifest + 摘要验证 PR 证据
         └── 输出正式验收报告
```

**禁止**：执行 PR head 的 workflow/脚本/CLI/构建产物；从 PR head 读验收规则/摘要/期望值；把 PR 路径拼进 shell；提供 secrets；授予写权限；让 PR 用自己改过的 Manifest 验证自身。

### 执行规则（Q1–Q18 摘要；全文见 rulings）

- **威胁模型**：防普通 PR 作者；不防仓库管理员、GitHub 管理权限被攻陷、CI 执行环境被攻陷。不引入签名，不宣称管理员级防篡改。
- **Q6/Q14**：普通 PR 的 evidence job 永远要求 `PR Manifest == base Manifest`、`PR SHA-256 == base SHA-256`；基线更新不切换到 PR 自验模式。
- **Q7**：Manifest + 独立摘要文件都从 base 读取；SHA-256 对**原始文件字节**计算，不重新序列化 JSON；摘要格式固定。
- **Q8**：基线更新专用 PR 同时改 Manifest、摘要、追加 `MANIFEST-UPDATES.md`；日志只追加、不是密码学不可篡改日志；CI 只核对一致性，不宣称历史不可伪造。
- **Q9/Q17/Q21**：Repository ruleset 约束非管理员；owner bypass 固定为 `bypass_mode: "pull_request"`，owner 也不能直接 push/force push/删除 main，只能在 PR 上绕过 required checks；不新增 push 审计 workflow。
- **Q20**：追溯口径 = PR + commit/check run + ruleset 前后快照 + 人工记录 + 可取得的 personal security log；**不承诺**完整 organization audit log。报告区分 `normal-pass` / `owner-bypass` / `blocked`。
- **Q19**：public 仓库 `pull_request_target` 自 2026-12-02 起默认阻断；00 票必须在截止日前创建 workflow 级 Actions policy 并用真实 PR 验证；policy 失败不得退回 PR 自验。
- **Q10**：四项 required checks：`check` / `test` / `typecheck` / `evidence`；名称稳定唯一；`evidence` 独立 job，不能被普通测试 job 替代。
- **Q11/Q15**：evidence job 用 sparse（base/head 各约 51–57 MiB tracked；install/build 后另测）；回归 job 全量 checkout；记录 checkout/install/build/test 耗时与磁盘占用；sparse 漏路径要修路径，不得解释成证据失败。
- **Q12**：required 缺失数必须为 0；optional 缺失逐条报告、不失败、不静默；optional 存在但哈希不匹配仍按既有规则处理。
- **Q13**：扩展正式 `verify-delivery`，增加可选 `--expected-manifest-sha` 与 `trust.anchor`；不传时向后兼容；锚点失败必须使正式验收失败；可信期望值只由 base 侧提供。
- **Q16**：owner 自己创建红/绿 PR；红色 PR 记录 required check 失败 + `mergeable_state=blocked`；明确 owner 仍有 bypass；第二非管理员账号是可选升级，不是前置条件。
- **Q18**：新增 `docs/adr/0001-evidence-trust-boundary.md`；`CONTEXT.md` 保持纯词汇表。

### 票与依赖

| 票 | 内容 | 类型 | Blocked by | 证据档位 |
|---|---|---|---|---|
| [01 可信锚点与正式报告](issues/01-trusted-anchor-and-report.md) | 摘要文件、`--expected-manifest-sha`、`--base-manifest`、`trust.anchor` | task | — | E2 + E3 |
| [02 N01–N17 负向测试](issues/02-negative-test-matrix.md) | 映射现有用例，补锚点/双重篡改/重复记录缺口 | task | 01 | E2（+ N06/N07 E3） |
| [00 Actions Event Policy](issues/00-actions-event-policy.md) | workflow 级允许 `pull_request_target`（HITL） | task | — | E3（真实 PR run） |
| [03 CI Workflow](issues/03-ci-workflow.md) | base-only trusted evidence、evidence sparse、回归全量、artifact | task | 00, 01, 02, 08 | E2 + E3（真实 run） |
| [04 Repository ruleset](issues/04-repository-ruleset.md) | required checks、PR 限制、owner bypass（HITL） | task | 03 | E3（API/实测） |
| [05 基线更新与架构文档](issues/05-baseline-update-and-adr.md) | owner 专用更新、更新日志、ADR | task | 01, 03 | E2 + E3（dispatch dry-run） |
| [06 真实 PR 与最终复核](issues/06-real-pr-and-final-review.md) | 红绿 PR、冻结基线复核、最终报告（HITL） | task | 01–05 | E3 |
| [07 GitHub 机制核实](issues/07-github-trust-mechanics.md) | Actions/ruleset/checkout 事实 | research | — | 研究文档 |
| [08 绿基线前置](issues/08-preflight-green-baseline.md) | 修复 7 条既有断裂链接，使 `pnpm check` 绿 | task | — | E2（check-links exit 0） |

### 证据分级与工作树纪律

- E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径 + 身份）。本图收口要求 E2 + E3。
- 只在 `main` 增量实现；不改 `fixtures/`、`game-maker.local.json`；不 `reset`/`clean`；不提交/推送除非单独授权。
- 测试产物只写 `out/` 或本 effort 目录；历史 `run/vN` / `pack/site/vN` / 报告零改动。
- 验收失败只报告，不自动修复证据、不回写 Manifest、不自动更新基线。

## Decisions so far

<!-- 索引：每张关闭票一行，gist + 链接；详情只在票里 -->

- [Actions Event Policy](issues/00-actions-event-policy.md)：**已收口** —— 占位 `evidence.yml` 已由 PR #1 合并（merge commit `6f0a8dc`）；policy `10162` active，仅允许 `.github/workflows/evidence.yml` 使用 `pull_request_target`；探测 PR #2 触发 run `41160053128` / job `124415401898`，结论 `success`（3s）；探测 PR 未合并。证据：`runs/2026-10-31-policy-snapshot/`。限制：其他 workflow 的负向阻断在 evaluate 模式下暂不可观测，12-02 后复验。
- [可信锚点与正式报告](issues/01-trusted-anchor-and-report.md)：**已收口** —— `trust.anchor` 报告块 + `--expected-manifest-sha` / `--base-manifest`；摘要/字节不匹配 ⇒ `status=fail` / exit 1 / `anchor.*` 诊断；无锚点时向后兼容。E2：156 文件 / 2297 用例 + typecheck 全绿；E3：223 文件正例 `matched`（exit 0，151 required，diagnostics 0，2s），反例 `mismatch`（exit 1，2 条 anchor 诊断）。锚点文件已随 PR #3 入库。
- [N01–N17 负向测试矩阵](issues/02-negative-test-matrix.md)：**已收口** —— N01–N17 全部映射；补 N03/N06/N07/N15；`expectFailure` 让 21 处失败断言检查 exitCode/status；`pnpm test` 156 文件 / 2303 用例 + typecheck 全绿；E3 N06 真实 223 文件 Manifest 篡改 ⇒ exit 1 / anchor mismatch；E3 N07 隔离 fixture 双重篡改 ⇒ 文件 verified 但 anchor mismatch。矩阵：[negative-test-matrix.md](negative-test-matrix.md)。
- [绿基线前置](issues/08-preflight-green-baseline.md)：**已收口** —— 共修正 7 条相对链接（6 条本地 + CI clean checkout 发现的 1 条 `out/` 构建产物链接）；`check-links` exit 0（890 文档 / 3,029 链接）；CI `check` job 通过；证据/交付/历史结论零改动。
- [Repository ruleset](issues/04-repository-ruleset.md)：**已收口** —— ruleset `26268801` active；`~DEFAULT_BRANCH`；`deletion`/`non_fast_forward`/`pull_request(0 approvals)`/`required_status_checks(strict, check+test+typecheck+evidence, app 15368)`；owner `User/1635996 + pull_request` bypass（API `pull_requests_only`）；`require_extra_approval_for_unattributed_changes=false`。临时分支直接推 main 被 GH013 拒绝，main SHA 保持 `a56e4e4`。证据 `runs/2026-10-31-ruleset/`。
- [CI Workflow](issues/03-ci-workflow.md)：**已收口** —— `ci.yml`（check/test/typecheck 全量）+ base-only `evidence.yml` 落地；PR #3 merge `bf9ef87`，cache hotfix PR #5 merge `a56e4e4`。真实探测 PR #4（closed）四项全 success：check 38s / test 2m9s / typecheck 1m13s / evidence 28s；artifact summary 223 文件 / 151 required / diagnostics 0 / `trust.anchor.result=matched`；check run IDs `124522696113` / `124522696007` / `124522696232` / `124522691383`，app id `15368`。
- [基线更新与架构文档](issues/05-baseline-update-and-adr.md)：**已收口** —— ADR + `MANIFEST-UPDATES.md` + `check-manifest-updates.mjs`；普通 evidence job 校验 base 日志；owner `baseline-update` dispatch（run `41205281023`，29s，candidate/base `e44c62a`，223 文件，`mode=baseline-update` matched）；探测 PR #7 四项全绿且日志检查通过。`--anchor-mode baseline-update` 已落地。
- [真实 PR 与最终复核](issues/06-real-pr-and-final-review.md)：**已收口 · 目的地到达** —— 红 PR #8 篡改 qa-report ⇒ evidence FAILURE / `mergeable_state=BLOCKED`（check run `124554574052`），未合并；绿 PR #9 四项 success / `CLEAN`，合并为 `2cf31cb`；最终复核 223 文件 / 151 required / diagnostics 0 / anchor matched / protected 223 条 diff 0；与 2026-10-29 历史 pass 一致，仅新增 `trust.anchor`。报告：[final-report.md](final-report.md) · [final-verdict.json](final-verdict.json)。
- [GitHub Actions / Ruleset 机制核实](issues/07-github-trust-mechanics.md)：**已收口** —— `pull_request_target` check 可关联 head 并满足 required check（fork/同仓库一致）；base/head 双 checkout 与 `allow-unsafe-pr-checkout` 写法确认；`workflow_dispatch` 不能当 required check；ruleset payload 与 7 天 bootstrap 确认，owner 推荐 `pull_request` bypass；sparse 实测 51–57 MiB（非 253 MiB）。**两个冲突**：public 仓库 12-02 起默认阻断 `pull_request_target`，需显式 Actions policy；个人仓库无 audit log API，Q17 可追溯口径需改为 PR/commit/check/ruleset 快照 + 人工记录。全案：[research/github-trust-mechanics.md](research/github-trust-mechanics.md)。

## Not yet specified

（无）—— 06 收口，目的地到达；无 open ticket。

## Out of scope

- 签名、外部时间戳、仓库外锚；对管理员/GitHub 管理权限/CI 执行环境被攻陷的防御（Q3 未选）。
- P0-02 阶段 B 第二个独立 Demo、付费生成、生图、任何模型调用。
- 重写 `evidence-integrity-v1` 的校验器或 Manifest；修改已有验收阈值。
- 把 28 条 optional 日志改为 required 或从清单移除（Q12 保持 optional）。
- 回归 job 的 sparse 优化（Q15 选择全量 checkout）。
- 额外 push 审计 workflow（Q17 不新增）。
- 完整 GitHub organization audit log / 转 org / 付费审计方案（Q20 不承诺）。
- 平台 policy 失败时退回 PR 自验（Q19 明确禁止）。
- 第二非管理员账号演示作为前置条件（Q16 仅可选升级）。
- 自动修复证据、回写 Manifest、自动更新基线。
- 将人工视觉审核自动化；把证据完整性通过解释为游戏全部功能验收。
