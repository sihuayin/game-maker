# I03 实施执行协议（I03-IMPL-01）

| 项 | 值 |
| --- | --- |
| 票 | I03-IMPL-01 执行协议与授权拓扑 |
| 日期 | 2026-11-15 |
| 状态 | **FROZEN**（Q1–Q6 = A） |
| Authority | `docs/v7.8/移动-I03.md` · 签署前 `sha256:2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` / 签署后 `sha256:f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb`（SIGNED，amber 2026-11-15） |
| 审查依据 | `reports/I03-review.md` · `sha256:40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09`（PASS 23/23）；F2 修正 `evidence/10-f2-correction.md` · `sha256:17ea5f9137b9dbf3dbf7ab715fc26e598c0ee419ff94794a9b974584086a8c2a` |
| 适用 | I-03 实施 U1 → U2 → U4 → U5 → U3；每单元独立 branch / PR / 复核 / 授权 |
| 不适用 | 本协议不授权任何单元；不开放 `PUBLIC_NB` / `PUBLIC_PU`；不改产品代码 |

> **本协议是执行会话的硬约束，不是新的授权包。** 任何与已签署授权包冲突的地方，以授权包为准并 STOP + HITL。

## 0. 术语

| 术语 | 含义 |
| --- | --- |
| **Unit（单元）** | 授权包 §11.1 的 U1 / U2 / U4 / U5 / U3；固定顺序执行 |
| **Incremental authorization** | 用户对**恰好一个单元**的签署授权；单元签署完成后耗尽，不隐含下一单元 |
| **Implementation SHA** | 单元 PR 在 `main` 上的 merge commit |
| **Review gate** | 单元合并前的 fresh 独立复核；PASS 只表示证据支持该单元 |
| **Ledger update** | 单元合并后对授权包 §12.2 目标行的一次 docs-only 行政更新 |
| **Rollback target** | 单元分支切出时的 `main` SHA（单元实施前基线） |
| **STOP** | 授权包 §11.3 的 12 条触发之一；停下当前单元并交回用户 |
| **Docs-only exception** | 唯一允许修改已签署包的例外：§12.2 目标单元行 |

**不变量（每个单元、每次复核、每次 Ledger 更新都必须保持）**：

- `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；公共能力不开放。
- I-02 的 `publicCapability="BLOCKED"` / `publicResult=null` 不被改写。
- 发布拒稿行为不变；无新增 `throw` / 退出码变化。
- 无白名单外修改、无新依赖、无 gate / 证据基线变化。
- 上一单元签署并完成 Ledger 更新后，下一单元才可授权。

## 1. 分支 / PR 拓扑（Q6=A）

固定次序（每个单元重复）：

1. **授权 docs PR**：从更新后的 `main` 建 `wayfinder/i03-impl-auth-uX`；新增 `reports/UX-incremental-authorization.md`；用户签署；docs-only PR 合入 `main`。
2. **单元分支**：从含授权记录的更新后 `main` 建 `wayfinder/level-playability-v1.1-i03-uX`；实现 + 测试 + 证据；独立复核；用户在单元票签署完成；单元 PR 合入 `main`（merge commit）。
3. **Ledger docs-only PR**：从更新后的 `main` 建 `wayfinder/i03-impl-ledger-uX`；仅改 §12.2 目标行；验证；用户或授权 docs-only 会话；docs-only PR 合入 `main`。
4. 下一单元回到步骤 1。

约束：

- 不设长期 integration branch；单元分支不层层堆叠；不直接 push `main`。
- 每个单元 PR 必须在上一单元签署 + Ledger 更新之后才可切分支。
- 地图 / 票 docs 变更与单元代码 PR 分离。
- 本协议/地图自身的 docs-only PR 是 charting 交付，不属于单元代码推送。

## 2. 逐单元增量授权（Q1=A）

**路径**：`.scratch/level-playability-v1.1-i03-impl/reports/UX-incremental-authorization.md`（例：`01-u1-incremental-authorization.md`）。

**必含字段**：

| 字段 | 内容 |
| --- | --- |
| 记录类型 | 增量实施授权；独立记录；不改授权包正文 |
| 单元 / 范围 | 仅该单元；对应授权包 §11.1 / §11.2 |
| 用户签署 | 签署人、日期、指令原文 |
| 授权依据 | 上一单元签署 + Ledger 更新的 SHA；授权包 hash；相关复核报告 |
| 允许文件 | 授权包 §11.2 的**精确路径**；不得扩张 |
| 禁止 / 不放行 | 其他单元、白名单外文件、新依赖、gate 变化、能力开放、推送 / 合并（除本单元 PR 流程） |
| 前置条件 | 基线 `main` SHA；修改前不变量快照已记录；独立复核输入包模板已就绪 |
| 证据 / 回滚 | 复核报告路径、证据目录、回滚目标 SHA、演练要求（U4/U5/U3） |
| 失效 | 单元签署完成即耗尽；STOP 时退回；不隐含下一单元 |

**时机**：授权 docs PR 合入 `main` **之前**，不得切单元分支或修改产品代码。用户签署后，授权记录随 docs PR 合入；单元分支从含该记录的 `main` 切出。

**变更**：任何扩范围 / 白名单外需求 ⇒ 新授权记录 + STOP + HITL；不得在单元内自行扩权。

## 3. 独立复核（Q2=A）

**复核人**：fresh **subagent / 独立会话**，未参与该单元实现；不得读实现报告、PR draft、map/tickets（复核票除外）、作者总结 / PASS 结论 / 调试笔记。

**输入包**：`.scratch/level-playability-v1.1-i03-impl/reports/UX-review-input.md`，只含：

- 授权包 hash、授权记录路径、base / head SHA、diff range；
- 改动文件清单（逐文件核对授权白名单）；
- 测试命令、退出码、原始输出摘要；
- 证据路径与 hash；
- 修改前 / 后不变量快照；
- 环境（OS / Node / pnpm / 时间）；
- **不含**作者结论、PASS 声明、实现建议。

**复核报告**：`.scratch/level-playability-v1.1-i03-impl/reports/UX-review.md`，含：

- 复核人、日期、环境、输入 / 输出 hash；
- diff scope、授权包 hash 现场复算；
- 逐项 `PASS / FAIL / NOT_RUN`（不得用总通过率替代）；
- 命令与退出码；
- 至少 **2 条自选关键断言** 及选择理由；
- 未覆盖项 / 限制；
- 独立签署。

**结论**：required 项全部 PASS 才可写 PASS；任一 FAIL / NOT_RUN ⇒ 不得合并单元 PR。复核 PASS 只表示证据支持该单元，不授权下一单元、不开放能力。

## 4. 单元 PR（Q3=A）

**标题**：`I03-UX: <unit title>`。

**PR body 必含**：

- 授权记录链接、授权包 hash、单元 brief 链接；
- diff scope / 逐文件白名单核对；
- 测试命令、退出码（定向 + 全量 `pnpm test` + `tsc -b` + `check:deps`）；
- 证据路径 / hash；
- 独立复核报告链接与结论；
- 修改前 / 后不变量快照；
- 回滚目标 SHA + 演练证据（U4/U5/U3）或文档化回滚（U1/U2）；
- 明确：`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；下一单元未授权。

**合并条件**：单元测试 + 全量测试 + 类型检查 + 依赖守卫全绿；独立复核 PASS；用户签署单元完成；无未解决 STOP。合并方式 **merge commit**（保留单元 commit 与回滚目标）。

**合并后**：执行 §5 的 docs-only Ledger 更新；否则下一单元不得授权。

## 5. docs-only Ledger 更新（Q5=A + Q10=A）

**允许**：

- 文件：仅 `docs/v7.8/移动-I03.md`。
- 章节：仅 §12.2 Authorization Ledger 的**目标单元行**。
- 字段：`增量授权状态 / 实施 SHA / 复核证据路径+hash / 批准人 / 日期 / 回滚目标 SHA / 回滚演练证据 / 备注`。
- 执行者：用户或用户明确授权的 **docs-only 会话**；实现会话不得执行。
- 时机：单元 PR 合并 + 用户签署完成之后；一次 commit + docs-only PR → `main`。
- 证据：记录包文件 **pre/post SHA-256** 与精确 diff。

**锁住**：§1–§11、§13–§17、§12.1、任何已签署结论、产品代码、其他 docs 文件。

**验证**（在 docs-only 会话内执行）：

```bash
# 1) 只允许包文件变化
git diff --name-only <base>..HEAD
# 2) 只允许 §12.2 目标行变化：去掉目标行后整文件 byte-compare
python3 - <<'PY'
from pathlib import Path
import hashlib, sys
pre, post, unit = Path(sys.argv[1]).read_text(), Path(sys.argv[2]).read_text(), sys.argv[3]
def strip(text):
    return "\n".join(l for l in text.splitlines() if not l.startswith(f"| {unit} |"))
def sha(t):
    return hashlib.sha256(t.encode()).hexdigest()
assert strip(pre) == strip(post), "only the target Ledger row may change"
print("OK; pre", sha(pre), "post", sha(post))
PY
```

- 若 `git diff --name-only` 不是仅包文件，或 strip 后不相等 ⇒ **STOP + HITL**，不得合并。
- 签署前内容 hash `2f89d572…` 仍是签署对象；Ledger 更新是签署后的行政记录。

## 6. 证据 / 不变量 / 回滚 / STOP（Q4=A）

**证据目录**：`.scratch/level-playability-v1.1-i03-impl/evidence/UX/`：

- E1 源码 / 契约 `file:line`；
- E2 测试名 + 断言 + 退出码；
- E3 scratch 复跑（命令、路径、计数、原始输出摘要）；
- 原始日志 / hash；不得手工编辑后宣称通过。

**不变量快照**：

- `evidence/UX/invariant-before.txt` / `invariant-after.txt`；
- 固定检查：`publicCapability="BLOCKED"`、`publicResult=null`、NB / PU gate `BLOCKED`、发布拒稿基线（现有 `auditPlayability` / `playabilityIssues` 行为）；
- 必须同时保存修改前与修改后，不得只凭修改后状态推断行为未变；
- 命令、退出码、hash 一并记录。

**回滚**：

- 回滚目标 = 单元分支切出时的 `main` SHA；写入授权记录 / 单元 PR。
- **U1 / U2**：文档化回滚目标 + 命令；不要求演练。
- **U4 / U5 / U3**：必须在 **scratch worktree / drill branch** 上演练：`git revert` 单元 commit，跑该单元相关测试（必要时全量 `pnpm test`），保留日志 / 退出码 / hash。演练分支状态**不是**交付状态。
- **正式回滚**：逆序 `U3 → U5 → U4 → U2 → U1`；记录 SHA / 命令 / 证据。

**STOP**：

- 授权包 §11.3 的 12 条任一触发 ⇒ 立即停止当前单元；**不合并单元 PR**；写 `evidence/UX/UX-stop.md`（触发条、证据、受影响文件、需要的用户裁定）；单元票保持 open；交回用户。
- 不得自行缩范围 / 扩白名单 / 改 gate / 改证据基线。
- 若 STOP 暴露新的决策，另开地图票；不在地图内自行解决。

## 7. 单元 brief 必含清单（Q6=A）

`I03-IMPL-02..06` 的每份 brief 必须逐项覆盖：

1. **Scope**：单元范围、前置单元、授权包 §11.1 依赖。
2. **Allowed files**：授权包 §11.2 的精确路径 + 禁止扩张。
3. **Implementation slices / commits**：建议的 commit 切分；测试名 / 断言。
4. **Evidence**：E1/E2/E3 计划、命令、路径。
5. **Review input**：输入包内容、报告路径、fresh reviewer 要求。
6. **Invariant**：before/after 快照的命令与内容。
7. **Rollback**：目标 SHA、演练要求（U4/U5/U3）或文档化回滚（U1/U2）。
8. **STOP**：单元特定触发 + 标准 12 条。
9. **No-code statement**：brief 本身不写代码；执行另开独立会话 / 分支 / PR。
10. **Capability boundary**：`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；不产公共 Verdict；`publicCapability` / `publicResult` 不变。
11. **Dependency**：对上一单元 API / 语义的依赖；不得新增依赖 / 白名单外修改。

## 8. 交接

执行会话的阅读顺序：

1. `docs/v7.8/移动-I03.md`（已签署授权包；以签署前 hash `2f89d572…` 对应的内容为签署对象）；
2. 本协议；
3. 该单元 brief（`issues/02..06`）；
4. 该单元授权记录（`reports/UX-incremental-authorization.md`）。

执行会话**不读**其他单元的作者总结 / 实现报告 / 复核结论；单元之间只通过已合并的 `main` 代码与授权包语义衔接。

## 9. 验收与关闭（I03-IMPL-07）

- 验收按授权包 §10：AC-01–AC-21（required 19；AC-11 / AC-15 phase-1 `NOT_RUN`）、G1–G11、N1–N18、T-55–T-65、LP-06 / LP-07、全量 vitest / build / check:deps / check:links。
- 报告固定路径：`.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md`。
- 退出码 `0 / 1 / 2`；整体 `PASS` 只在全部 required AC PASS 时成立；无 FAIL 但有 required `NOT_RUN` ⇒ `INCOMPLETE`；不得用通过率替代。
- 正常关闭：U1–U5 全部独立复核 + 用户签署；Ledger 完整；测试 / 类型检查 / 依赖守卫全绿；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；`publicResult=null`；拒稿行为不变；无未解决 STOP。
- 中止关闭：逆序回滚全部已落地单元；Ledger 记录原因 / 实际回滚 SHA / 最终验证。
- **关闭 ≠ 开放**：验收全绿不改变任何能力状态。

## 10. 变更控制

- 修改本协议：新地图票或用户显式授权的修订；不得静默编辑。
- 与授权包冲突：授权包优先；STOP + HITL。
- 本协议不授权任何单元；每个单元必须有自己的增量授权记录与 Ledger 更新。
