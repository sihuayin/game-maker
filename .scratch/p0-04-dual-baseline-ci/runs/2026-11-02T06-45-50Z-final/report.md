# P0-04 最终复核（08）

- 生成时间：2026-11-02T06:45:51Z（UTC）
- 结论：**PASS**

## 基线

- A：223 / 151 / 72 / 13 records / 9 roots · `sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd`
- B：231 / 137 / 94 / 6 records / 3 roots · `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab`
- B optional by root：`{"oldWork": 93, "out": 1}`
- A/B overlap：`{"count": 73, "bothRequired": 28, "aRequiredBOptional": 30, "aOptionalBRequired": 0, "bothOptional": 15}`

## 命令

| 步骤 | 退出 | 耗时 |
|---|---|---|
| registry | 0 | 124 ms |
| updateLogs | 0 | 71 ms |
| freeze | 0 | 51 ms |
| verifyA | 0 | 271 ms |
| verifyB | 0 | 145 ms |
| aggregate | 0 | 49 ms |
| test | 0 | 34251 ms |
| typecheck | 0 | 13199 ms |
| links | 0 | 6827 ms |

## 零改动

- 受保护文件 501 个；变化：**无**。

## Freeze

```json
{
  "format": "freeze-snapshot-verification/v1",
  "generatedAt": "2026-11-02T06:45:53.582Z",
  "baselineId": "p0-02-second-demo-v2",
  "hashList": ".scratch/p0-02-second-demo-v2/freeze-sha256.txt",
  "freezeRoot": ".scratch/p0-02-second-demo-v2/freeze/wasteland-scavenger-recipe",
  "count": 112,
  "verified": 112,
  "missing": [],
  "mismatched": [],
  "extra": [],
  "pass": true
}
```

## Aggregate

```json
{
  "format": "dual-baseline-aggregate/v1",
  "generatedAt": "2026-11-02T06:45:54.050Z",
  "registry": ".scratch/baselines/registry.json",
  "outcomes": {
    "A": "success",
    "B": "success",
    "BFreeze": "success"
  },
  "summaries": {
    "A": "/Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-02T06-45-50Z-final/evidence-a/2026-11-02T06-45-53-650Z-test-evidence/summary.json",
    "B": "/Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-02T06-45-50Z-final/evidence-b/2026-11-02T06-45-53-883Z-test-evidence/summary.json"
  },
  "reports": {
    "A": "/Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-02T06-45-50Z-final/evidence-a/2026-11-02T06-45-53-844Z-delivery-verification/report.json",
    "B": "/Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-02T06-45-50Z-final/evidence-b/2026-11-02T06-45-53-991Z-delivery-verification/report.json"
  },
  "freeze": "/Volumes/shy/some-projects/game-maker/.scratch/p0-04-dual-baseline-ci/runs/2026-11-02T06-45-50Z-final/freeze-verification.json",
  "problems": [],
  "pass": true
}
```

