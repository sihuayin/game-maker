# P0-04 票 06 · Baseline Update 双基线通道（E2 + E3）

- 生成时间：2026-11-02T04:30:12Z（UTC）
- 结论：**PASS**

## 1. 实施 PR

- [#17](https://github.com/sihuayin/game-maker/pull/17) → squash `20739d2`

## 2. E3 真实 dispatch

| 场景 | 候选 SHA | 结果 | 证据 |
|---|---|---|---|
| target=A（无操作） | `20739d2` | **success** / meta pass | run [41385937629](https://github.com/sihuayin/game-maker/actions/runs/41385937629) |
| target=B（无操作） | `20739d2` | **success** / meta pass | run [41385962594](https://github.com/sihuayin/game-maker/actions/runs/41385962594) |
| 缺省 target | 20739d2 | **rejected** | HTTP 422 `Required input 'baseline' not provided` |
| 身份不匹配 | `3826713` | **failure** / `registry.identity-mismatch` | run [41388656648](https://github.com/sihuayin/game-maker/actions/runs/41388656648) |
| `freezeHashes` 篡改 | `f76ee66` | **failure** / `candidate.freezeHashes-changed` | run [41388668495](https://github.com/sihuayin/game-maker/actions/runs/41388668495) |
| 合法 B 更新 | `7afe791` | **success** / meta pass | run [41388674222](https://github.com/sihuayin/game-maker/actions/runs/41388674222) |

## 3. 关键字段

- target A/B meta：operator actorId `1635996`，old/new 相同，result pass。
- 合法 B 更新：`sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab` → `sha256:d64c623ee53580f80d3a7c5b38b0bfdf0114f89e0d36c6bb4b48c989a8656b3b`；evidence `success`；result `pass`。
- 身份不匹配：`registry.identity-mismatch`；meta `fail`。
- freeze 篡改：`candidate.freezeHashes-changed`；meta `fail`。
- main 前后均为 `20739d2`，dispatch 未写回。

## 4. E2

- [本地 E2 报告](../2026-11-02T03-43-49Z-baseline-update-e2/report.md)：161 文件 / 2,350 tests；120 个受保护文件零变化。

## 5. 限制

- owner-only dispatch；07 做正式负向 PR。
- 候选分支仅用于 dispatch 验证，不合并；未证明非管理员无法绕过。
