# P0-04 票 04 · B 独立 Anchor 与更新日志

- 生成时间：2026-11-01T14:40:33Z（UTC）
- 结论：**PASS**
- 机器可读：`facts.json`

## 1. 独立复算

| 方法 | 结果 |
|---|---|
| 期望值 | `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab` |
| `shasum -a 256` | `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab` |
| Node `crypto` 原始字节 | `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab` |
| Python `hashlib` 原始字节 | `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab` |
| 一致 | **True** |

被计算文件：`.scratch/p0-02-second-demo-v2/manifest/final-manifest.json`（66,336 B）；计算方式：对**原始文件字节**做 SHA-256，不重新序列化 JSON。
冻结来源：commit `21632ef62e5d043f98baa834a14a40aa38dff064`；B `final-report.md` 记录的代码基线为 `f0411e676309fede8f20b79d9f8e44e5ac479ef6`（生成时工作树未提交，冻结文件由 21632ef 入库）。

## 2. 新建文件

- `.scratch/p0-02-second-demo-v2/manifest/expected-hashes.sha256`：72 B，格式合法 **True**，与 Manifest 匹配 **True**。
- `.scratch/p0-02-second-demo-v2/manifest/MANIFEST-UPDATES.md`：954 B，`newSha256` 条目 1 条，最后一条匹配 **True**。

## 3. 现有脚本校验（旧脚本零改动）

| 用例 | 期望退出 | 实际退出 | 结果 |
|---|---|---|---|
| B_positive | 0 | 0 | PASS |
| A_positive | 0 | 0 | PASS |
| B_log_vs_A_manifest | 1 | 1 | PASS |
| missing_log | 1 | 1 | PASS |
| invalid_digest | 1 | 1 | PASS |
| empty_log | 1 | 1 | PASS |
| duplicate_entries_current_behavior | n/a | 0 | 记录现状（严格重复校验由 05 wrapper 负责） |

A 原调用与 B 新日志调用均使用同一个 `scripts/check-manifest-updates.mjs`；脚本文件未修改。

## 4. verify-delivery（A/B，带 Anchor）

- **A**：exit=0 · status=pass · diagnostics=0 · trust={"mode": "digest", "source": "cli", "expectedSha256": "sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd", "actualSha256": "sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd", "result": "matched"}
  - 报告：`cli-a/2026-11-01T14-40-36-330Z-delivery-verification/report.json`
- **B**：exit=0 · status=pass · diagnostics=0 · trust={"mode": "digest", "source": "cli", "expectedSha256": "sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab", "actualSha256": "sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab", "result": "matched"}
  - 报告：`cli-b/2026-11-01T14-40-36-459Z-delivery-verification/report.json`

## 5. 回归

| 命令 | 退出 | 耗时 |
|---|---|---|
| `pnpm test` | 0 | 34256 ms |
| `pnpm typecheck` | 0 | 14856 ms |

## 6. 零改动

- 受保护文件快照：120 个（A 三件、B Manifest/spec、freeze-sha256、final-report/verdict、112 冻结文件）；变化：**无**。
- 未修改 B Manifest、B `freeze/`、A 文件或任何交付证据。

## 7. 说明

- 现有脚本只校验最后一条 `newSha256`；重复字段/多日志严格 schema 由 05 的 `scripts/check-baseline-updates.mjs` wrapper 实现（03 Q6）。
- B Anchor 单行 `sha256:<64 hex>`；B 更新日志为 Markdown 追加，初始 freeze 条目使用 A 兼容字段 + `baselineId`（03 Q7）。
