# 只读审计：基线 A/B 身份、冻结不变性与路径安全

Type: task
Status: resolved
Blocked by: —

## Question

在接入双基线 CI 前，对 P0-04 的两套基线做一次**只读**审计，确认它们可以被独立、可信地验收。任何身份、数量或哈希不一致都判 FAIL，并**停止全图**；不得在审计中顺手修复冻结内容。

### 输入（只读）

- 基线 B：`.scratch/p0-02-second-demo-v2/manifest/final-manifest.json`、`freeze/`、`freeze-sha256.txt`、`final-report.md`。
- 基线 A：`.scratch/evidence-integrity-v1/manifest/expected-hashes.json`、`expected-hashes.sha256`、`MANIFEST-UPDATES.md`。
- 现有可信配置：`.github/workflows/evidence.yml`、`.github/workflows/baseline-update.yml`、`scripts/evidence-acceptance.mjs`、`scripts/check-manifest-updates.mjs`、`docs/adr/0001-evidence-trust-boundary.md`。

### 必须覆盖的检查（PRD §4 P0-04-01）

1. Manifest 存在、JSON 有效、`format=delivery-evidence-manifest/v1`。
2. 231 文件 / 137 required / 94 optional / 6 records 与正式记录一致。
3. 112 文件冻结快照与正式清单的身份关系。**已知差异**：freeze 比清单 `out` root 多 2 个文件 —— `run/v1/playtest/v1/chrome.log`、`run/v1/playtest/v2/chrome.log`。必须查明它们是什么、为何未入清单、是否属于交付证据，不能静默忽略；清单中“列了但磁盘没有”的文件也必须为零。
4. 所有 Manifest 路径处于 3 个 root（`fa04` / `oldWork` / `out`）内；检查路径穿越（`..`、绝对路径）、重复路径、大小写冲突、符号链接逃逸；root 解析后必须仍在仓库内。
5. 逐文件存在且 SHA-256 与清单一致；逐条记录缺失或哈希不匹配的文件。required 缺失/不匹配 ⇒ FAIL；optional 缺失按既有规则报告，不静默。
6. 基线 A 零变化：223 文件（151 required / 72 optional）/ 13 records；Manifest 原始字节摘要 `sha256:ba7a485b…36fd`；Anchor 文件匹配；`MANIFEST-UPDATES.md` 最后一条 `newSha256` 与 Manifest 一致；A 的交付文件无变化。
7. 记录 B Manifest 原始字节摘要 `sha256:07866e0e…b9ab` 的完整值、计算对象、计算命令与时间。
8. 不重新生成正式 Manifest、不修改冻结文件、不写回任何交付物、不改 Anchor/更新日志。

### 产出

在 `.scratch/p0-04-dual-baseline-ci/runs/<UTC 时间戳>-baseline-audit/` 写：

- `report.md`：基线身份、Manifest 路径、数量统计、Required/Optional、冻结快照关联、SHA-256 结果、路径安全检查、与 A 的隔离情况、2 个 chrome.log 的解释、PASS/FAIL 结论。
- `facts.json`：机器可读的数量、摘要、差异列表、命令与退出码。

运行前后不得修改仓库内任何文件（本 effort 的 `runs/` 除外）；不提交、不推送。

## 验收标准

- 所有统计与正式冻结记录一致；231/137/94/6 逐项核对。
- 112 快照与 231 清单的关系有明确解释，2 个 chrome.log 有结论（交付证据 / 非交付运行日志 / 需单独报告），不是“忽略”。
- 路径安全检查无未解释的穿越、重复、大小写冲突或符号链接逃逸。
- Manifest 列出的所有文件存在且 SHA-256 匹配；任何身份或哈希不一致 ⇒ FAIL。
- A 的 Manifest、Anchor、更新日志、223 文件零变化。
- 审计报告包含命令、退出码、路径与结论；FAIL 时停止全图，不进入 03。

## Answer

**结论：PASS（2026-11-01）。** 01 硬门槛通过；未发现身份或哈希不一致，未修改任何冻结文件。03 及后续可进入。

- 运行目录：[2026-11-01T12-28-50Z-baseline-audit](../runs/2026-11-01T12-28-50Z-baseline-audit/)
- PR：[#11](https://github.com/sihuayin/game-maker/pull/11)
- 人工报告：[report.md](../runs/2026-11-01T12-28-50Z-baseline-audit/report.md) · 机器可读：[facts.json](../runs/2026-11-01T12-28-50Z-baseline-audit/facts.json)
- 审计 HEAD：`25985daf618aa845d5ee0667b92a16e6edaad53e`；审计脚本只写本目录，证据/配置在审计前后哈希零变化。

### 1. 身份与统计（全部 verified）

| 项 | 基线 A | 基线 B |
|---|---|---|
| Manifest | `.scratch/evidence-integrity-v1/manifest/expected-hashes.json` | `.scratch/p0-02-second-demo-v2/manifest/final-manifest.json` |
| 原始字节 SHA-256 | `sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd` | `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab` |
| 大小 | 61,616 B | 66,336 B |
| 文件 / required / optional | 223 / 151 / 72 | 231 / 137 / 94 |
| records | 13 | 6 |
| roots | 9 | 3 |
| 逐文件校验 | 223 / 223 verified | 231 / 231 verified |

- A：Anchor = `sha256:ba7a…36fd`；更新日志最后一条 `newSha256` 与 Manifest 一致；223 文件零变化。
- B：实测摘要与 `final-verdict.json`、`final-report.md` 记录一致；`final-manifest.json` 仍为 66,336 B。
- 两套 Manifest 均通过 `delivery-evidence-manifest/v1` 结构检查（root 已登记、records ⊆ files、无重复路径）。

### 2. 冻结快照 112 与正式清单 231 的关系

- 冻结快照：**112** 文件；`freeze-sha256.txt` **112** 条；逐文件哈希 0 不一致 / 0 缺失 / 0 多余。
- 清单 `out` root：**110** 文件 = 109 required + 1 optional；与快照共享文件 0 哈希不一致；“清单列了但磁盘没有” = 0。
- 差异 2 个：`run/v1/playtest/v1/chrome.log`（2,374 B）与 `run/v1/playtest/v2/chrome.log`（10,655 B）。
  - 两者都是**旧 playtest attempt 的 Chrome 运行日志**（首条非空行 `DevTools listening on …`），被 `final-spec.json` 的 `out` 目录条目 `excludeExt: [".log"]` 排除。
  - 成功 attempt 的 `run/v1/playtest/v3/chrome.log` 由 spec 显式列为 `role=playtest`、`required=false`（optional）。
  - 两个 v1/v2 日志由 `freeze-sha256.txt` 固定，但该文件本身不在 231 清单或 Anchor 内。**05 必须显式处理或记录这一覆盖缺口**（已写入 03 的裁定输入与 05 的必须完成项）。

### 3. 路径安全

- A/B 所有 root 均解析到仓库内；无绝对路径、`..`、未规范化路径、重复 `root:path`、清单内大小写冲突、Unicode NFC 冲突、磁盘目录大小写冲突、符号链接组件。
- 结论：路径安全 **PASS**。

### 4. A 零变化

- 223 文件逐条 SHA-256 全部匹配；Manifest 原始字节摘要 = Anchor = 更新日志最后一条。
- 审计前后对 A/B 全部证据、两份 Manifest、Anchor、更新日志、workflow、脚本、ADR 的哈希快照：**0 变化**。
- `git status` 的唯一变化是本次审计 `runs/` 下新增的 4 个 CLI 报告文件；无 tracked 文件变化。

### 5. A/B 隔离

- 绝对路径重叠 **73**：双方 required **28**（`fa04`）；A required / B optional **30**（A `out` ↔ B `oldWork`）；双方 optional **15**；重叠文件哈希 0 不一致。
- B 独占 required **109**（`out`/freeze）。07 的 A/B 负向样本必须使用各自独占 required 路径，否则无法证明“不相互掩盖”。
- A 的 `fa04` 与 B 的 `fa04` 是同一目录（28 个双方 required）；A 不能只靠 `fa04` 样本证明 A 的独立性。

### 6. CLI 复验（E3）

- A：exit 0 · status=`pass` · diagnostics=0 · `trust.mode=digest` / `result=matched`；报告 `cli/A/2026-11-01T12-30-35-…Z-delivery-verification/report.json`。
- B：exit 0 · status=`pass` · diagnostics=0（尚无 Anchor，符合 04 前的状态）；报告 `cli/B/…/report.json`。
- CLI 构建物包含最新 `--anchor-mode baseline-update` 代码；完整命令、退出码、stdout/stderr 见 `facts.json` → `commands` 与 `cli-*.log`。

### 7. 警告（不构成 FAIL）

1. 冻结快照 2 个 `chrome.log` 不在 231 清单；`freeze-sha256.txt` 未被 Anchor 钉住 —— 05/08 必须显式处理。
2. B 尚无独立 Anchor 与更新日志（预期：04 创建）。
3. B `final-verdict.json` / `final-report.md` 称 optional 含“旧 work 94 个文件”；实测 `oldWork=93` + `v3/chrome.log=1` = 94 optional。总数正确，措辞不精确；08 应改用精确表述。
4. A/B 物理证据部分重叠（73 路径，28 个双方 required）；08 必须披露。

### 8. 门槛结论

**PASS。** 01 硬门槛解除：03（registry 裁定）现在 unblocked；04 仍等待 03；没有冻结对象需要修复，不触发“停止全图”。
