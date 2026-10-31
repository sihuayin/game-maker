# MANIFEST-UPDATES

只追加。最后一条 `- newSha256:` 必须等于当前 `expected-hashes.json` 的**原始文件字节** SHA-256；
`scripts/check-manifest-updates.mjs` 会在普通 PR 的 evidence job 与 owner 基线更新 dispatch 中检查这一点。

本文件不是密码学意义上的不可篡改日志；历史仍由 git、受保护分支与人工审查负责。

## 2026-10-29 · freeze FPVS-V1 baseline

- reason: initial freeze of the frozen FPVS-V1 delivery evidence
- subject: wasteland-scavenger-recipe v1 / site v1 / shell 2
- oldSha256: none (initial freeze)
- newSha256: sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd
- evidence: 223 files (151 required / 72 optional), 13 records, 9 roots
- verifiedBy: evidence-integrity-v1 票 03 / 2026-10-29
- recordedIn: p0-03-evidence-trust 票 05 / 2026-10-31
