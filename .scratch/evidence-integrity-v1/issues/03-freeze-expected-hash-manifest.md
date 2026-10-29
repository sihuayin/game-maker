# 冻结期望哈希清单（唯一信任锚）

Type: task
Status: open
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
