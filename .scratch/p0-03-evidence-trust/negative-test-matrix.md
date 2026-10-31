# P0-03-02 · N01–N17 负向测试矩阵

> 测试入口：`packages/pipeline/tests/evidence-integrity.test.ts`（pipeline）与
> `packages/cli/tests/evidence.test.ts`（正式 CLI 薄壳）。
> 所有 pipeline 用例都在 `mkdtemp` 隔离 fixture 中运行；不修改冻结 FPVS-V1 交付、不写历史 run、不调用模型/网络。
> `expectFailure(report, status)` 统一断言 `exitCode=1` + 报告 `status`；每个用例另行断言具体结果/诊断/定位。
> 原始文件只读性由 N17 的全量哈希前后比对覆盖；重复执行确定性由 N16 覆盖。

## 矩阵

| ID | 场景 | 测试（文件 / 用例） | 操作 | 预期退出码 / 状态 | 失败分类 / 定位 | 来源 |
|---|---|---|---|---|---|---|
| N01 | 正常基线 | pipeline · `完整未变化的证据 → pass，六项声明与重算一致` | 未变化的 fixture | 0 / pass | diagnostics 0；六项 declared=recomputed | 既有 |
| N02 | 文件内容篡改 | pipeline · `内容篡改 → hash-mismatch / fail` | 改 `site/v1/index.html` 字节 | 1 / fail | `file.hash-mismatch`；`site/v1/index.html` | 既有 |
| N03 | Playtest 篡改 | pipeline · `N03 Playtest 报告篡改 → hash-mismatch / fail，定位到 playtest result` | 在 `playtest/v2/result.json` 末尾追加空格（JSON 仍合法） | 1 / fail | `file.hash-mismatch`；`playtest/v2/result.json` | **新增** |
| N04 | 文件删除 | pipeline · `必需文件缺失 → missing / blocked` | 删 `run/v1/game-config.json` | 1 / blocked | `file.missing`；`run/v1/game-config.json` | 既有 |
| N05 | 文件不可读 | pipeline · `不可读（目录冒充文件）→ unreadable / blocked` | 用目录替换 `site/v1/index.html` | 1 / blocked | `file.unreadable`；`site/v1/index.html` | 既有 |
| N06 | Manifest 篡改 | pipeline · `N06 Manifest 篡改（可信摘要未变）→ anchor mismatch / fail`；E3 见下 | 改 Manifest 期望哈希，可信摘要保持原值 | 1 / fail | `anchor.manifest-digest`；actual ≠ expected；`anchor.base-manifest` | **新增 + E3** |
| N07 | 双重篡改 | pipeline · `N07 证据 + Manifest 同时篡改（可信摘要未变）→ 文件 verified 但 anchor mismatch / fail`；E3 见下 | 改证据字节并把 Manifest 期望哈希同步改成新值；可信摘要保持原值 | 1 / fail | `anchor.manifest-digest`；被改文件在改后清单下 `verified` | **新增 + E3** |
| N08 | 身份错配 | pipeline · `身份不符 → mismatch / fail`；`身份字段缺失 → missing / blocked` | 改 review record 的 `subject.packVersion` / 删 `subject` | 1 / fail 或 blocked | identity `mismatch` / `missing`；`fa04:review-record.json` | 既有 |
| N09 | Playtest 摘要错配 | pipeline · `报告引用错 attempt → reference-invalid / fail` | 把 `delivery.playtest.report` 指向 v1 attempt | 1 / fail | `references.report`；qa-report / playtest 引用 | 既有 |
| N10 | 人工审核错配 | pipeline · `审核材料集合不一致 → fail`；`身份不符 → mismatch / fail` | 改 review 材料集合 / subject | 1 / fail | `visual.materials.collection` / identity `mismatch`；review record | 既有 |
| N11 | 结论过期 | pipeline · `结论过期：声明 pass，当前必需证据失效 → 不再 pass` | 删 site index，保留历史 `declared=pass` | 1 / 非 pass | `declared=pass`，`recomputed` 非 pass，最终 `status` 非 pass | 既有（已补 exitCode） |
| N12 | 路径逃逸 | pipeline · `路径逃逸 → path-invalid / fail` | 清单条目 `../escape.txt` | 1 / fail | `file.path-invalid`；`../escape.txt` | 既有 |
| N13 | 绝对路径 | pipeline · `绝对路径引用 → path-invalid / fail` | 清单条目使用绝对路径 | 1 / fail | `file.path-invalid`；绝对路径 | 既有 |
| N14 | 符号链接逃逸 | pipeline · `指向 root 外的符号链接 → path-invalid / fail`；`悬空符号链接 → path-invalid / fail`；`root 内合法符号链接 → verified` | root 外链接 / 悬空链接 / root 内合法链接 | 1 / fail；合法链接 verified | `file.path-invalid`；链接路径 | 既有 |
| N15 | Manifest 重复记录 | pipeline · `N15 Manifest 重复文件/记录 → 正式入口拒绝（invalid）`；CLI · `重复文件清单 ⇒ invalid 4，且不写报告` | 复制 file / record 条目 | pipeline 抛 `invalid`；CLI 4 | `文件重复` / `记录重复`；不产出正式报告 | **新增 + CLI** |
| N16 | 重复运行 | pipeline · `重复执行结果一致（除 generatedAt）` | 同一输入跑两次 | 0 / 一致 | 除 `generatedAt` 外报告全等 | 既有 |
| N17 | 原始证据只读 | pipeline · `只读性：校验前后 fixture 全量哈希不变` | 校验前后对整个 fixture 逐文件 SHA-256 | 0 / 不变 | 全量哈希相等 | 既有 |

## E3：N06 / N07 走正式 CLI

### N06（真实 223 文件基线，Manifest 篡改）

- 输入：真实清单的临时副本，roots 改为绝对路径；把一个 `files[*].sha256` 改成全零；证据未动；可信摘要 = 原 Manifest 的 `sha256:ba7a485b…36fd`。
- 命令：`verify-delivery --manifest <temp> --expected-manifest-sha <原摘要> --base-manifest <原清单> --out … --json`
- 结果：**exit 1 / status fail / `trust.anchor.result=mismatch`**；诊断含 `anchor.manifest-digest`、`anchor.base-manifest`、`file.hash-mismatch`。
- 产物：`runs/2026-10-31-n06-n07/n06/summary.json` 与报告目录。

### N07（隔离 fixture，证据 + Manifest 双重篡改）

- 输入：单文件 fixture；先改证据字节，再把 Manifest 期望哈希同步改为新值；可信摘要 = 原 Manifest 摘要。
- 结果：**exit 1 / status fail / `trust.anchor.result=mismatch`**；被改文件在改后 Manifest 下 `status=verified`（证明只靠文件↔清单比对发现不了），锚点诊断 `anchor.manifest-digest` 命中。
- 产物：`runs/2026-10-31-n06-n07/n07-clean/summary.json` 与报告目录。
- 说明：曾尝试复制真实 `out` root 做 N07；由于复制后 root 路径变化触发材料自述路径诊断，改为隔离 fixture，避免把“复制导致的环境差异”混进结论。真实基线 N06 已证明同一机制在 223 文件上生效。

## 运行结果

- `pnpm test`：**156 文件 / 2303 用例通过**（新增 5 个 pipeline 用例 + 1 个 CLI 用例；`expectFailure` 让 21 处失败断言同时检查 exitCode/status）。
- `pnpm typecheck`：全包通过。
- `pnpm check`：仍红，仅由 08 票的 6 条既有断裂链接导致；与本票无关。
