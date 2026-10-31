# 真实 PR 红绿演示与冻结基线最终复核

Type: task
Status: resolved
Blocked by: 01, 02, 03, 04, 05

## Question

本票是 **HITL 收口票**：必须等真实 PR 红绿演示完成后才能关闭；本地模拟、workflow 文件存在或静态检查通过都不够。

1. **红色 PR**（owner 自己）：
   - 在分支中篡改一个 required 证据文件（或同时篡改 Manifest+摘要，验证双重篡改）；
   - 记录 PR 编号、`evidence` check run ID、失败日志、`mergeable_state=blocked`；
   - 明确记录 owner 仍可 admin bypass；该证据只证明 required check 生效，不证明管理员无法绕过；
   - 不合并，保留可追溯链接。
2. **绿色 PR**：良性改动（如 docs），四项 required checks 全绿，记录 check run IDs、`mergeable_state=clean`、日志；合并或关闭均可，但报告说明选择。
3. **基线更新通道 dry-run**：用与 base 相同的候选 commit 或隔离 fixture 触发 `workflow_dispatch`，证明受信 workflow 能验证候选而不执行候选代码；不改变真实基线。
4. **冻结基线复核**：
   - 用 `verify-delivery --expected-manifest-sha <base digest> --base-manifest <base manifest>` 对 223 文件/151 required 清单跑正式验收；
   - required missing=0；optional missing 逐条列出；文件/身份/一致性/六项重算与历史 2026-10-29 `pass` 对比；
   - 差异必须解释（新增 `trust.anchor`、无证据变化等）；
   - 运行前后受保护文件 SHA-256 不变；报告独立保存、不覆盖历史。
5. **Q21 结果分类**：报告必须区分 `normal-pass`（四项 required checks 正常通过）、`owner-bypass`（owner 在 PR 上绕过规则）、`blocked`（门禁阻止合并）；`owner-bypass` 绝不能映射为正常验收 PASS。
6. **Q20 追溯集合**：PR 编号/链接、PR head SHA、base SHA、merge commit SHA、check 名称/run ID/结论/日志、ruleset 前后快照、owner 人工记录、可取得的 personal security log；报告明确“个人账号仓库不承诺完整 organization audit log”。
7. **Q19 证据**：00 票的 policy 配置、真实 PR run ID、触发 PR、执行结果；若 policy 未被平台接受，不得用 PR 自验替代。
8. **最终报告**：DoD 1–9 逐项判定；已知限制（owner 仅 PR bypass、audit log 可见性、单 Demo、optional logs、无签名、owner 是信任边界一部分）；全程零付费、零生产交付修改。

## Answer

**已收口（2026-10-31）。最终结论：PASS · 目的地到达。**

- 最终报告：[final-report.md](../final-report.md)
- 机器可读结论：[final-verdict.json](../final-verdict.json)
- 最终 main：`2cf31cbe1d2fee2d9e7cb4f9ec587e376c22a605`（绿 PR #9 合并）

### 红/绿 PR

- **红 PR #8**（closed，未合并）：篡改 `out:wasteland-scavenger-recipe/run/v1/qa-report.json`；`evidence` FAILURE（check run `124554574052`，23s），其余三项 success；`mergeable_state=BLOCKED`；artifact `status=fail` / 9 diagnostics / `file.hash-mismatch` 定位到该文件；锚点 matched（Manifest 未变）。未使用 owner bypass 把它变绿。
- **绿 PR #9**（merged）：良性文档新增；四项 success（check `124555213186` 43s / test `124555213199` 2m13s / typecheck `124555212999` 1m6s / evidence `124555212654` 27s，app `15368`）；`mergeable_state=CLEAN`；squash 合并为 `2cf31cb`。

### 冻结基线最终复核（绿 PR 合并后）

- `scripts/evidence-acceptance.mjs --manifest … --expected-manifest-sha … --base-manifest …`：**pass / exit 0 / 223 文件（151 required / 72 optional）/ 13 records / diagnostics 0**；六项一致；`trust.anchor.result=matched`（digest+base，expected=actual=base=`ba7a485b…36fd`，byteEqual=true）。
- required 非 verified **0**；本地 optional-missing **0**；CI 干净 checkout optional-missing **27** 条（均为 `role=log`），逐条在 artifact report 中列出，不失败。
- 223 个 manifest 条目逐文件 SHA-256 前后 **diff 0**；与 2026-10-29 历史 pass 对比：计数/诊断/六项一致，差异仅为新增 `trust.anchor` 块。
- 证据：`runs/2026-10-31-final-acceptance-post-green/`。

### DoD 1–9

全部 MET：可信 base-only 逻辑；普通 PR 不能改自身期望值；151 required 全在且匹配；optional 逐条报告；N01–N17 完成；四项 required checks 真实生效；ruleset + owner bypass 边界实测；基线更新仅 owner 通道；真实红/绿 + 冻结复核完成。

### 限制

管理员/GitHub 管理权限/CI 环境被攻陷不防御；个人账号无完整 audit log；单 Demo；optional 日志可能缺失；dispatch dry-run 未真正改基线；Node 20 deprecation；证据完整性通过 ≠ 人工视觉质量或全部功能验收。
