# P0-04 票 05 · Evidence CI 双基线验收（E2 + E3）

- 生成时间：2026-11-01T15:28:41Z（UTC）
- 结论：**PASS**

## 1. Bootstrap（base 旧 workflow）

- owner dispatch：run [41320891133](https://github.com/sihuayin/game-maker/actions/runs/41320891133) · conclusion **success**
- base `main` / base SHA：`77ee10a`；候选 SHA：`fe38ec6`；base workflow 与候选 head 明确区分；候选未自证。

## 2. 实施 PR

- [#14 P0-04-05: dual-baseline evidence CI](https://github.com/sihuayin/game-maker/pull/14) → squash `7cd7cd4`
- checks：`check` / `test` / `typecheck` / `evidence` 全 success。

## 3. E3 真实 PR（新 workflow）

- [#15 post-merge evidence probe](https://github.com/sihuayin/game-maker/pull/15)
- Base SHA：`7cd7cd4`；Head SHA：`55d10f8`；合并为 `8e963c3`
- evidence run：[41321106019](https://github.com/sihuayin/game-maker/actions/runs/41321106019)
- 所有新步骤 success：freeze hash materialize、trust config、A、B、B freeze、aggregate、三份 artifact upload。
- checks：`check` pass 37s · `test` pass 2m19s · `typecheck` pass 51s · `evidence` pass 28s。
- artifacts：`evidence-a-15`（18,077 B）· `evidence-b-15`（18,134 B）· `evidence-aggregate-15`（437 B）。

### Aggregate

```json
{
  "format": "dual-baseline-aggregate/v1",
  "generatedAt": "2026-11-01T15:25:23.750Z",
  "registry": ".scratch/baselines/registry.json",
  "outcomes": {
    "A": "success",
    "B": "success",
    "BFreeze": "success"
  },
  "summaries": {
    "A": "/home/runner/work/_temp/evidence-a/2026-11-01T15-25-23-194Z-test-evidence/summary.json",
    "B": "/home/runner/work/_temp/evidence-b/2026-11-01T15-25-23-432Z-test-evidence/summary.json"
  },
  "reports": {
    "A": "/home/runner/work/_temp/evidence-a/2026-11-01T15-25-23-371Z-delivery-verification/report.json",
    "B": "/home/runner/work/_temp/evidence-b/2026-11-01T15-25-23-616Z-delivery-verification/report.json"
  },
  "freeze": "/home/runner/work/_temp/evidence-b/freeze-verification.json",
  "problems": [],
  "pass": true
}
```

### Freeze snapshot

```json
{
  "format": "freeze-snapshot-verification/v1",
  "generatedAt": "2026-11-01T15:25:23.707Z",
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

## 4. E2 本地模拟

- [本地 E2E 报告](../2026-11-01T15-18-06Z-evidence-ci/report.md)：registry / wrapper / freeze / A / B / aggregate 全 exit 0；`pnpm test` 160 文件 / 2,341 tests；`typecheck` / `check:links` 通过；499 个受保护文件零变化。

## 5. 结论与限制

- 双基线 `evidence` 已在真实 GitHub PR 上实际执行 A、B、112 冻结验证与 aggregate，三份 artifact 均生成且 aggregate PASS。
- 本 probe 是正常 docs-only PR；负向红绿（A/B/Manifest+Anchor/规则篡改）由 07 验证。
- owner-only：owner 仍有 bypass；不声称已证明非管理员无法绕过。
