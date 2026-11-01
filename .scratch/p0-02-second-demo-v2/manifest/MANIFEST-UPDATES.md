# MANIFEST-UPDATES

只追加。最后一条 `- newSha256:` 必须等于当前 `final-manifest.json` 的**原始文件字节** SHA-256；
`scripts/check-manifest-updates.mjs` 会在普通 PR 的 evidence job 与 owner 基线更新 dispatch 中检查这一点。

本文件不是密码学意义上的不可篡改日志；历史仍由 git、受保护分支与人工审查负责。

## 2026-11-01 · freeze P0-02 Second Demo V2 baseline

- reason: initial freeze of the P0-02 Second Demo V2 delivery evidence
- subject: wasteland-scavenger-recipe v1 / site v1 / shell 2
- oldSha256: none (initial freeze)
- newSha256: sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab
- evidence: 231 files (137 required / 94 optional), 6 records, 3 roots; freeze snapshot 112 files (freeze-sha256.txt)
- verifiedBy: p0-04-dual-baseline-ci 票 04 / 2026-11-01
- recordedIn: p0-04-dual-baseline-ci 票 04 / 2026-11-01
- baselineId: p0-02-second-demo-v2
