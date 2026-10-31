# P0-03 最终验收报告：交付证据可信性与 CI 自动验收

- 日期：2026-10-31
- 验收 main：`2cf31cbe1d2fee2d9e7cb4f9ec587e376c22a605`（绿色 PR #9 合并）
- 说明：本报告随文档提交入库；后续文档提交不改变本次验收结论。
- 最终结论：**PASS · 目的地到达**
- 范围：FPVS-V1 冻结交付（223 文件 / 151 required / 72 optional / 13 records）；不重新生成 Demo、不调用付费服务。

## 1. 真实红/绿 PR

### 红 PR #8（closed，未合并）

- head：`570ec5c5e8c8a96f88fe01cbdaa4fc873ccb2d21`；篡改 `out:wasteland-scavenger-recipe/run/v1/qa-report.json` 一个字节。
- checks：`evidence` **FAILURE**（check run `124554574052`，23s）；`check` success（`124554573425`）、`test` success（`124554573420`）、`typecheck` success（`124554573263`）。
- `mergeable_state=BLOCKED`；PR 已关闭，分支删除。
- evidence artifact：`status=fail` / exit 1 / 9 diagnostics；`file.hash-mismatch` 定位到 `out:wasteland-scavenger-recipe/run/v1/qa-report.json`；expected `dc20e301…` / actual `ab60ed1f…`；锚点本身 matched（Manifest 未变）。
- 证据：`runs/2026-10-31-red-pr/`。

### 绿 PR #9（merged）

- head：`95f85b442a2a5e1a43ffa28ba9b941d3aa21f62e`；良性文档新增。
- checks 全 success：`check` 43s（`124555213186`）、`test` 2m13s（`124555213199`）、`typecheck` 1m6s（`124555212999`）、`evidence` 27s（`124555212654`）；app id `15368`。
- `mergeable_state=CLEAN`；squash 合并为 `2cf31cbe1d2fee2d9e7cb4f9ec587e376c22a605`。
- 证据：`runs/2026-10-31-green-pr/`。

**结论**：普通 PR 改证据 → evidence 必红且阻断；良性 PR → 四项 required checks 全绿并可正常合并。owner 的 `pull_request` bypass 没有被用来把红 PR 变绿。

## 2. Ruleset 与基线更新通道

- ruleset `26268801`（`p0-03-main-evidence-gate`）：`~DEFAULT_BRANCH`；`deletion`、`non_fast_forward`、`pull_request`（0 approvals）、`required_status_checks`（strict，`check` / `test` / `typecheck` / `evidence`，app `15368`）。
- owner bypass：`User/1635996` + `bypass_mode: "pull_request"`；`current_user_can_bypass: "pull_requests_only"`。
- owner 直接推 main 实测：GH013 拒绝（`Changes must be made through a pull request` + `4 of 4 required status checks are expected`），main SHA 未变。
- 基线更新 dispatch：run `41205281023`，29s success；candidate/base 均为 `e44c62a`；223 文件；`mode=baseline-update`；matched；artifact 已保存。
- 普通 evidence job 校验 base `MANIFEST-UPDATES.md` 最后一条 `newSha256`；探测 PR #7 中该步骤通过。
- 证据：`runs/2026-10-31-ruleset/`、`runs/2026-10-31-baseline-update-dispatch/`、`runs/2026-10-31-log-probe/`。

## 3. 冻结基线最终复核（绿 PR 合并后）

- 正式命令：`scripts/evidence-acceptance.mjs --manifest … --expected-manifest-sha … --base-manifest …`。
- 结果：**pass / exit 0 / 223 文件（151 required / 72 optional）/ 13 records / diagnostics 0**；六项 declared=recomputed；`trust.anchor.result=matched`（digest+base，expected=actual=base=`sha256:ba7a485b…36fd`，`byteEqual=true`）。
- required 非 verified：**0**；本地 optional-missing：**0**。
- 受保护文件：223 个 manifest 条目逐文件 SHA-256 前后 **diff 0**；原始交付、历史报告未被修改。
- 与 2026-10-29 历史正式验收对比：同为 pass / 223 / 151 required / 13 records / diagnostics 0 / 六项一致；差异仅为本次报告新增 `trust.anchor` 块，证据零变化。
- 干净 checkout 的 CI evidence artifact：optional-missing **27** 条，均为 `role=log`，逐条列在 artifact report 中，未导致失败；required 缺失 0。
- 证据：`runs/2026-10-31-final-acceptance-post-green/`；历史对照 `../evidence-integrity-v1/runs/2026-10-29T05-04-57Z-final-acceptance/`。

### 干净 checkout 的 optional-missing（27 条）

`fa05:regression/test.log`、`fa05:regression/typecheck.log`、`fa06:free-acceptance/probe/chrome.log`、`fa06:self-test-run/chrome.log`、`fa06:self-test-run/report/attempt-v1/chrome.log`、`gp:06-attempt-1/attempt-v1/chrome.log`、`gp:06-attempt-2/attempt-v1/chrome.log`、`gp:07-acceptance/probe/chrome.log`、`gp:07-regression/acceptance.log`、`gp:07-regression/playtest.log`、`gp:07-regression/test.log`、`gp:07-regression/typecheck.log`、`gp:self-test-run/chrome.log`、`gp:self-test-run/report/attempt-v1/chrome.log`、`out:wasteland-scavenger-recipe/run/v1/playtest/v1/chrome.log`、`out:wasteland-scavenger-recipe/run/v1/playtest/v2/chrome.log`、`reference:playtest-v1/attempt-v1/chrome.log`、`runs:2026-10-27-gate-stop/harness-clear-patroller-2-after-fix-v2/attempt-v1/chrome.log`、`runs:2026-10-27-gate-stop/harness-clear-patroller-2-after-fix/attempt-v1/chrome.log`、`runs:2026-10-27-gate-stop/harness-clear-patroller-2/attempt-v1/chrome.log`、`runs:2026-10-27-gate-stop/harness-real/attempt-v1/chrome.log`、`runs:2026-10-28-acceptance/harness-1/attempt-v1/chrome.log`、`runs:2026-10-28-acceptance/harness-2/attempt-v1/chrome.log`、`runs:2026-10-28-acceptance/harness-determinism/attempt-v1/chrome.log`、`runs:2026-10-28-acceptance/harness-determinism/attempt-v2/chrome.log`、`runs:2026-10-28-acceptance/harness-final/attempt-v1/chrome.log`、`runs:2026-10-28-acceptance/harness-final/attempt-v2/chrome.log`。

## 4. DoD 1–9

| # | 要求 | 判定 | 证据 |
|---|---|---|---|
| 1 | 可信执行逻辑来自受保护 base，PR head 只作为数据 | MET | 03/06；红 PR evidence 用 base 逻辑失败 |
| 2 | 普通 PR 无法改 Manifest/摘要/逻辑获得 PASS | MET | 03 ruleset + anchor；红 PR #8 BLOCKED |
| 3 | 151 required 全在且哈希匹配；required 缺失 0 | MET | 最终复核 151/151，required 非 verified 0 |
| 4 | optional 缺失逐条报告、不静默 | MET | CI 27 条逐项列出，未致失败；本地 0 |
| 5 | N01–N17 矩阵完成，锚点攻击真实失败 | MET | 02 票；`pnpm test` 156/2307；E3 N06/N07 |
| 6 | 四项 required checks 在真实 GitHub PR 生效 | MET | 绿 PR #9 四项 success，app 15368 |
| 7 | Ruleset 实际启用，owner bypass 边界明确 | MET | ruleset 26268801；direct push GH013 拒绝 |
| 8 | 基线更新只走 owner 专用、可追溯通道 | MET | 05 dispatch `41205281023`；日志 + ADR；普通 PR 改 Manifest 会失败 |
| 9 | 真实红/绿证据完整，冻结基线复核完成 | MET | 红 #8 BLOCKED；绿 #9 CLEAN+merged；最终复核 pass |

## 5. 人工视觉审核边界

- `visual-review` 检查 pass；机器只校验记录完整性、subject、材料引用与交付声明一致，不重新判断画面美观、风格、动画自然度或体验。
- 本阶段没有新增人工视觉结论，也没有把机器检查映射成人工审核通过。

## 6. 预算与约束

- 模型调用 **0**；生图调用 **0**；付费 E2E **0**；新增付费服务 **0**；新增依赖 **0**。
- 未修改冻结 Demo 的 pack/site/runtime/config/资源；未覆盖历史验收记录；未自动修复证据或回写 Manifest。
- 所有新报告写入 `.scratch/p0-03-evidence-trust/runs/`；历史 `run/vN`、`pack/site/vN` 与报告零改动。

## 7. 已知限制

- 威胁模型不防御仓库管理员、GitHub 管理权限被攻陷或 CI 执行环境被攻陷；owner 仍可用 `pull_request` bypass 合并任意 PR，但 direct push 已阻断。
- 个人账号仓库没有完整 organization audit log；追溯以 PR、commit、check run、ruleset 快照与人工记录为准。
- 只有一个冻结 Demo；本阶段通过不等于第二个独立 Demo 的完整生成能力。
- 28 条 optional 日志在干净 checkout 中可能缺失（本次 CI 27 条），逐项报告、不失败；它们不构成 required 基线证据。
- baseline-update dispatch 的 dry-run candidate 与 base 相同，未真正改变基线；真实更新仍需 owner 专用 PR + dispatch + bypass 合并。
- Actions 仍提示 `setup-node@v4` / `upload-artifact@v4` / `pnpm/action-setup@v4` 的 Node 20 deprecation；不影响本次运行。
- 证据完整性通过 ≠ 五态真实 E2E、机制覆盖或人工视觉质量全部完成；人工视觉结论仍由人负责。

## 8. 产物索引

- 红 PR：`runs/2026-10-31-red-pr/`（`pr.json`、`check-runs.json`、`evidence-fail.log`、artifact summary/report）
- 绿 PR：`runs/2026-10-31-green-pr/`（`pr.json`、`merged.json`、`check-runs.json`）
- 最终复核：`runs/2026-10-31-final-acceptance-post-green/`（summary、report、protected before/after/diff）
- Ruleset：`runs/2026-10-31-ruleset/`
- 基线更新 dispatch：`runs/2026-10-31-baseline-update-dispatch/`
- 日志检查探测：`runs/2026-10-31-log-probe/`
- 负向矩阵：`negative-test-matrix.md`
- 裁定原文：`rulings-2026-10-30.md`
- 地图：`map.md`
