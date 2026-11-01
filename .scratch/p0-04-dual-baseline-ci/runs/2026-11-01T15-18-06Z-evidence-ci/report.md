# P0-04 票 05 · Evidence CI 双基线验收（本地 E2E）

- 生成时间：2026-11-01T15:18:19Z（UTC）
- 结论：**PASS**
- 说明：本报告是 **base=head 的本地 E2E 模拟**；真实 GitHub PR E3 在 05 合并后用临时正常 PR 执行。

## 结果

| 步骤 | 退出 | 耗时 |
|---|---|---|
| build | 0 | 4216 ms |
| registry | 0 | 73 ms |
| updateLogs | 0 | 70 ms |
| freeze | 0 | 94 ms |
| verifyA | 0 | 1193 ms |
| verifyB | 0 | 149 ms |
| aggregate | 0 | 37 ms |
| test | 0 | 29887 ms |
| typecheck | 0 | 11383 ms |
| links | 0 | 6644 ms |

## Aggregate

- pass：**True**
- outcomes：`{"A": "success", "B": "success", "BFreeze": "success"}`
- summaries：`{"A": "/Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T15-18-06Z-evidence-ci/evidence-a/2026-11-01T15-18-26-357Z-test-evidence/summary.json", "B": "/Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T15-18-06Z-evidence-ci/evidence-b/2026-11-01T15-18-27-554Z-test-evidence/summary.json"}`
- reports：`{"A": "/Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T15-18-06Z-evidence-ci/evidence-a/2026-11-01T15-18-27-515Z-delivery-verification/report.json", "B": "/Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T15-18-06Z-evidence-ci/evidence-b/2026-11-01T15-18-27-666Z-delivery-verification/report.json"}`

## 零改动

- 受保护文件快照 499 个（A/B 全部清单文件、Manifest、Anchor、更新日志、registry、112 冻结文件）：变化 **无**。

## 产物

- aSummary: `.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T15-18-06Z-evidence-ci/evidence-a/2026-11-01T15-18-26-357Z-test-evidence/summary.json`
- aReport: `.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T15-18-06Z-evidence-ci/evidence-a/2026-11-01T15-18-27-515Z-delivery-verification/report.json`
- bSummary: `.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T15-18-06Z-evidence-ci/evidence-b/2026-11-01T15-18-27-554Z-test-evidence/summary.json`
- bReport: `.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T15-18-06Z-evidence-ci/evidence-b/2026-11-01T15-18-27-666Z-delivery-verification/report.json`
- bFreeze: `.scratch/p0-04-dual-baseline-ci/runs/2026-11-01T15-18-06Z-evidence-ci/evidence-b/freeze-verification.json`
