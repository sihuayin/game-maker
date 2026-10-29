# 冻结期望哈希清单（唯一信任锚）

Type: task
Status: resolved
Blocked by: 02

## Question

基于票 02 的审计结果，生成并**人工审查**一份随 git 固定的期望哈希清单（Q6 / Q9 / Q12 的形状），
作为正式校验器的唯一期望值来源。清单至少包含：

- `format`（清单格式版本）；
- `roots`：交付根（快照 / 工作区）与继承证据根（FA-04 / FA-05 / FA-06 / 06-attempts / 09 补审）的**封闭**标识符映射；
- `subject`：packId / packVersion / siteVersion / shellVersion / manifestChecksum / configChecksum；
- `files[]`：`root` + `path` + `role` + `required` + `sha256`；
- `records[]`：需要解析身份与一致性的报告（qa-report、review-record、capture、materials、supplement、两份 attempt、evidence.json、consistency.json、regression.json）。

规则：清单未列出但根内存在的文件不报错；被引用却不在清单 ⇒ `reference-invalid`；`required:false` 缺失不阻断、
存在则校验哈希与可解析性；记录不得自行声明未登记的新 root。

审查点：必需范围是否覆盖 `07` 的 27 项 + PRD 新增项；`08-goal.png` / `09-final.png` 同字节这类事实如何登记；
审计发现的 schema 差异**如何纳入清单**（如实记录 vs 排除并说明）——不得修改历史记录或放宽身份规则来凑通过。

完成判据：清单文件入库（随提交固定）、内容经用户审查、记录生成来源与每一条的纳入理由；
校验器日后只读它、绝不自动更新。产物：`.scratch/evidence-integrity-v1/manifest/expected-hashes.json` + 审查记录。

## Draft (awaiting review)

已生成草案（2026-10-29）：

- 清单：`.scratch/evidence-integrity-v1/manifest/expected-hashes.json`
  sha256 `6efd248c2b53576ac993c21e0a2731b367b778f4f4c00a2b7578ce59f493fdf2`
- 生成器（一次性、`--force` 才覆盖）：`.scratch/evidence-integrity-v1/tools/build-manifest.mjs`
- 规模：191 个文件（147 required / 44 optional），约 18.4 MB；13 条 records（11 条要求身份）。
- 覆盖校验：materials 44/44、FA-05 evidence 36/36、06 attempt 18/18 全部在清单内；`*.log` 0 条。

按 D1–D12 的落法：

| 项 | 落法 |
|---|---|
| D1 playtest 双来源 | 交付内 `playtest/v2/result.json`（harness v1）required，用于 `playable-smoke` 重导；06 两份 attempt（harness v2）18 文件 required，作额外证据 |
| D4 outRoot | `roots.out = ../../fpvs-v1-final/work`；`delivery.*` 相对路径直接解析 |
| D5 work 枚举 | work 树 41 条（含 playtest v1/v2、rejections）显式列出 |
| D6 reference | 14 文件（去 chrome.log 后 13）`required:false` |
| D7 重复截图 | 9 张全 required；「8 个不同字节」交给一致性检查 |
| D9 reviewedAt | 不作身份/必需项 |
| D10 consistency | `identity:false`，按文件哈希 + reportSha256 校验 |
| D12 日志 | `*.log` 全部排除；regression 用 `.txt` + `.exit` |

required 分组：protected 50 · delivery 2 · playtest 8 · visual-record 3 · visual-shot 9 · visual-material 32 ·
acceptance-record 8 · acceptance-evidence 4 · regression 9 · playtest-attempt 18 · visual-supplement 2 ·
identity 1 · freeze-manifest 1（hashes.json 经 evidence 36 进入 required）。
optional：snapshot-run 16 · reference 13 · playtest-historical 12 · rejections 3。

待用户审查确认后置 `resolved` 并随 git 固定；不覆盖、不自动更新。

## Answer

**已收口（2026-10-29，用户审查批准）。**

- 清单：`.scratch/evidence-integrity-v1/manifest/expected-hashes.json`
  sha256 `6efd248c2b53576ac993c21e0a2731b367b778f4f4c00a2b7578ce59f493fdf2`
- 规模：191 个文件（147 required / 44 optional），18,374,540 bytes；13 条 records（11 条要求身份）。
- `roots`（9）：`out` / `snapshot` / `reference` / `artifacts` / `fa04` / `fa05` / `fa06` / `runs` / `gp`，全部相对清单文件解析。
- 覆盖自检：materials 44/44、FA-05 evidence 36/36、06 attempt 18/18；`*.log` 0 条。
- 用户确认：保留 `hashes.json` 为 required（经 evidence 36）；snapshot run / playtest v1 / rejections 维持 optional。
- D1–D12 落法见上节 Draft；D1 = 交付内 playtest v2（harness v1）重导 `playable-smoke` + 06 两份（harness v2）作额外必需证据。
- 生成器：`.scratch/evidence-integrity-v1/tools/build-manifest.mjs`（一次性；默认拒绝覆盖，`--force` 才重建）。
- 信任锚：随本次 git 提交固定；正式校验器只读清单、**绝不自动更新**。

## Revision（2026-10-29，票 04 实施时）

- 实施 `site` 六项重导出时发现清单漏了**交付侧** `out/<packId>/site/v1/` 的四个站点文件
  （原清单只登记了 snapshot 受保护站点；work 站点从未逐条列出）。
- 生成器补 `addAll(walk(OUT_WORK/site))`，用 `--force` 重新冻结：
  **195 文件（151 required / 44 optional）**，sha256
  `c168ba6c874b917db0faa2320e0b74d03522fca67f008c0de89ba581c01ed797`。
- 清单的 roots / subject / records / D1–D12 规则不变；这是**完成度修正**（把交付侧站点纳入证据），
  不是规则变更。旧 sha `6efd248c…` 作废。

## Revision 2（2026-10-29，票 06 负向测试时）

- `qa-report.delivery.evidence` 引用了 `chrome.log` 等日志；按 Q6「被引用但未列入清单 ⇒ reference-invalid」，
  以及 D12 的允许做法，把 `*.log` 以 **`required:false`** 纳入清单（28 条，role=`log`）：
  只做本地核对，**不在 git 信任边界内**（`.gitignore` 的 `*.log` 仍不入库）。
- 重新冻结：**223 文件（151 required / 72 optional）**，sha256
  `ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd`。
- roots / subject / records / D1–D12 规则不变；新增的只有「可选日志」这一类。
