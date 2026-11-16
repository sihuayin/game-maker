# I03-IMPL-04 U4 独立复核重审报告（证据归档修复）

> 复核人：**fresh 独立复核会话**（未参与 U4 实现；本次只重审原 FAIL 项）
> 日期：**2026-11-16**
> 环境：Darwin 24.6.0 arm64 · Node **v22.23.2** · pnpm **10.7.1**
> 仓库：`/Volumes/shy/some-projects/game-maker`
> 当前 HEAD：`078b3746d42859436f79af27dd87860e1bc40792`（`wayfinder/level-playability-v1.1-i03-u4`）
> 产品 code/test head：`9b21f2ddd6a663d1c5bba78e33f830a4d97f8c1c`（未变）

## 1. 重审结论

**原 FAIL 项（证据日志未纳管）→ PASS。无新 FAIL / NOT_RUN。**

结合前次代码 / 测试行为复核（`reports/U4-review.md`），**U4 无剩余阻断项，独立复核结论为 PASS**。

- 本 PASS 只表示 U4 证据足以支持该单元。
- **不授权** U5 / U3，**不开放** `PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施。
- 本次只重审证据归档修复；产品代码 / 测试未变，前次行为复核结论继续有效。

## 2. 修复提交

| 提交 | 内容 | 父提交 |
| --- | --- | --- |
| `98f6bfe2ba12dbfcb2c6ed5eb712cf553a492913` | 保留首份 FAIL 复核报告 `reports/U4-review.md` | `ec98d73` |
| `078b3746d42859436f79af27dd87860e1bc40792` | `git add -f` 两个被 ignore 的证据日志 | `98f6bfe` |

- 首份 FAIL 报告 SHA-256（从 `98f6bfe` 复算）：`7db8472f31f622238a0da9f69fb4794462925d9646cf1c029afe9e9dc2080ffb`，与首份报告一致，内容未被改写。
- `078b374` 只新增 `evidence/U4/commands.log`、`evidence/U4/rollback-drill.log`，无产品代码 / 授权包 / 既有证据内容变化。

## 3. 独立验证命令与输出摘要

### 3.1 两个日志已入库且可读

```bash
git ls-tree -r --name-only 078b374 -- .scratch/level-playability-v1.1-i03-impl/evidence/U4
```

输出包含全部 7 个文件：

```text
.scratch/level-playability-v1.1-i03-impl/evidence/U4/SHA256SUMS
.scratch/level-playability-v1.1-i03-impl/evidence/U4/commands.log
.scratch/level-playability-v1.1-i03-impl/evidence/U4/invariant-after.txt
.scratch/level-playability-v1.1-i03-impl/evidence/U4/invariant-before.txt
.scratch/level-playability-v1.1-i03-impl/evidence/U4/rollback-drill.log
.scratch/level-playability-v1.1-i03-impl/evidence/U4/targeted-test-output.txt
.scratch/level-playability-v1.1-i03-impl/evidence/U4/test-output.txt
```

```bash
git show 078b374:.scratch/level-playability-v1.1-i03-impl/evidence/U4/commands.log | head -5
git show 078b374:.scratch/level-playability-v1.1-i03-impl/evidence/U4/rollback-drill.log | head -5
```

两者均可读，首行分别为 `# I03-U4 evidence commands`、`# U4 rollback drill`。

提交内 blob 的 SHA-256：

| 文件 | 提交内 blob SHA-256 | 与 `SHA256SUMS` |
| --- | --- | --- |
| `commands.log` | `5c7266a95e3e8264a54342eaacaea0075293a8927ccf398c01ab3cddb02892e4` | 一致 |
| `rollback-drill.log` | `8b945a5aefac27275bcb7746509db1753ea6b867ca62255cdf3581e95cd867e4` | 一致 |
| `SHA256SUMS` | `89bc177cf60e15ab18254a4594bc92d99e18ed24e1453c1bf4b0e52ba5fe77aa` | 与修复前一致（未改动） |

### 3.2 不依赖作者工作区的干净恢复校验

使用 `git archive` 从 `078b374` 提取证据到临时空目录（不读取作者工作区的未跟踪文件）：

```bash
rm -rf /tmp/u4-rerun-clean && mkdir -p /tmp/u4-rerun-clean
git archive 078b374 .scratch/level-playability-v1.1-i03-impl/evidence/U4 | tar -x -C /tmp/u4-rerun-clean
cd /tmp/u4-rerun-clean/.scratch/level-playability-v1.1-i03-impl/evidence/U4
shasum -a 256 -c SHA256SUMS
```

输出：

```text
invariant-before.txt: OK
invariant-after.txt: OK
targeted-test-output.txt: OK
test-output.txt: OK
commands.log: OK
rollback-drill.log: OK
EXIT=0
```

**6/6 OK**，退出码 0；干净目录中 7 个证据文件全部存在，`commands.log` / `rollback-drill.log` 不再依赖作者工作区。

### 3.3 远端 audit 分支与 diff scope

```bash
git ls-remote origin wayfinder/i03-u4-evidence
```

输出：

```text
078b3746d42859436f79af27dd87860e1bc40792	refs/heads/wayfinder/i03-u4-evidence
```

```bash
git diff --name-status 9b21f2d..078b374
```

仅 9 个 `.scratch` 路径，全部为新增：

```text
A .scratch/level-playability-v1.1-i03-impl/evidence/U4/SHA256SUMS
A .scratch/level-playability-v1.1-i03-impl/evidence/U4/commands.log
A .scratch/level-playability-v1.1-i03-impl/evidence/U4/invariant-after.txt
A .scratch/level-playability-v1.1-i03-impl/evidence/U4/invariant-before.txt
A .scratch/level-playability-v1.1-i03-impl/evidence/U4/rollback-drill.log
A .scratch/level-playability-v1.1-i03-impl/evidence/U4/targeted-test-output.txt
A .scratch/level-playability-v1.1-i03-impl/evidence/U4/test-output.txt
A .scratch/level-playability-v1.1-i03-impl/reports/U4-review-input.md
A .scratch/level-playability-v1.1-i03-impl/reports/U4-review.md
```

- `git diff --name-only 9b21f2d..078b374 | grep -v '^\.scratch/'`：**无输出**（无产品代码 / fixtures / 依赖变化）。
- `git diff --name-status ec98d73..078b374`：只新增 `commands.log`、`rollback-drill.log`、`reports/U4-review.md`；既有证据文件与 `SHA256SUMS` 内容未变。
- 远端产品分支 `origin/wayfinder/level-playability-v1.1-i03-u4` 仍为 `9b21f2d`，未被证据 commit 推进。
- 工作树 `git status --short`：干净（除本重审报告外）。

## 4. 原 FAIL 项逐条关闭

| 原 FAIL 子项 | 重审结果 | 依据 |
| --- | --- | --- |
| 两个日志未进入 git ref | **PASS** | `git ls-tree -r 078b374` 含两文件；`git show` 可读 |
| `SHA256SUMS` 引用未入库文件 / fresh clone 不可复核 | **PASS** | `git archive` 干净目录 `shasum -c` 6/6 OK |
| 回滚演练记录不可复核 | **PASS** | `rollback-drill.log` 已入库；其 blob hash 与 `SHA256SUMS` 一致；日志内容含 revert / 全量测试 / exit 0 |
| 修复可能夹带产品代码或证据内容变化 | **PASS** | `9b21f2d..078b374` 只含 `.scratch`；`ec98d73..078b374` 仅新增两日志与首份报告；`SHA256SUMS` 未变 |
| 远端 audit 分支未更新 | **PASS** | `git ls-remote origin wayfinder/i03-u4-evidence` = `078b374` |

## 5. 新 FAIL / NOT_RUN

- **无新 FAIL。**
- **无新 NOT_RUN。**
- 范围说明：本次重审只针对证据归档修复；产品 code/test head 仍为 `9b21f2d`，因此未重复执行前次已完成的定向 / 全量 / build / deps / links 命令。前次行为复核结论（含首跑超时 flake 的逐项定位）继续有效。

## 6. 独立签署

- 复核人：**fresh 独立复核会话（未参与 U4 实现）**
- 日期：**2026-11-16**
- 结论：**原 FAIL 项转 PASS；U4 无剩余阻断项，独立复核结论 PASS（仅限 U4）。**
- 本签署不授权 U5 / U3，不开放 `PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施。
- 复核人未修改产品代码、授权包、证据内容、地图或票；仅写本重审报告。
