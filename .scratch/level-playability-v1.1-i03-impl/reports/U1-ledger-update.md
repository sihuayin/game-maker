# U1 Ledger 更新记录

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-16 |
| 单元 | U1 |
| U1 产品 PR | #52 · merge `f059afe02264a8b4e8b4b39bd6e0c65bec52f539` |
| Ledger PR | #53 · merge `be1b72a310dd66901df479647485f6e2e9aae73d` |
| pre-update 包 hash | `f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb` |
| post-update 包 hash | `97c8f336ebd7a908cc3360d692e4b70825fa7ec0182b13e36459f769cbef992b` |
| 改动范围 | 仅 `docs/v7.8/移动-I03.md` §12.2 U1 行 |
| 验证 | 去掉 U1 行后 pre/post 整文件 byte-compare equal；`git diff --name-only` 仅包文件；§1–§11 / §13–§17 / §12.1 零改动 |
| 边界 | 只记录 U1 签署；不授权 U2 / U4 / U5 / U3；不开放 `PUBLIC_NB` / `PUBLIC_PU` |
