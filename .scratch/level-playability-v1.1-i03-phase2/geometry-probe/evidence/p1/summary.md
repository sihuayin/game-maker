# P1 证据摘要：probe 契约冻结与夹具物化

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-17 |
| 分支 | `wayfinder/i03-phase2-probe-evidence` |
| base `main` | `324ca13166662b309069c43599047a5c1d9b692f`（PR #80 授权记录合入后） |
| P1 授权 | [`reports/P1-incremental-authorization.md`](../../../reports/P1-incremental-authorization.md)（SIGNED 2026-11-17，amber） |
| P1 brief | [`issues/02-p1-probe-fixtures.md`](../../../issues/02-p1-probe-fixtures.md) |
| fixtures / scripts commit | `8a0bb6758efa9d71148ac67c0dd0e5253306e061` |
| 状态 | 实施与证据完成；**独立复核与用户签署待办**；P1 尚未闭合 |

> 本摘要只记录 P1 物化事实。P1 不实现 probe、不运行浏览器、不开放 `PUBLIC_NB` / `PUBLIC_PU`，
> 也不修改任何产品文件。

## 1. 物化布局

```
geometry-probe/
├── contract/I03-03A-probe-format.md      # I03-03A 契约冻结副本
├── fixtures/
│   ├── source/last-train-v2/**           # 产品 pack 只读完整副本（32 文件）
│   ├── last-train-v4/
│   │   ├── manifest.json                 # v4 归一化 manifest
│   │   └── delivery/atlas.*.{json,png}   # 8 个所需 delivery 副本
│   ├── manifest.json                     # 冻结 probe manifest（14 正例 / 11 负例）
│   ├── normalization.json
│   └── recipes/*.json                    # 11 个负例配方
├── scripts/build-fixtures.py             # Phase-2 副本（见 §5 路径说明）
├── scripts/materialize-recipes.py        # 从冻结 manifest 物化 11 个配方
└── evidence/p1/**                        # 本摘要、命令、两次重建、hash
```

## 2. 冻结输入 / 产物 hash

| 项 | hash | 判定 |
| --- | --- | --- |
| 源 pack tree | `sha256:570535deff5c2f4e1626b2680a4b555f631e51d6d87721507a0a1f6e2feb7383` | 与冻结值一致 |
| 源 manifest | `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` | 与冻结值一致 |
| v4 归一化 manifest | `sha256:19f4da6fb9bf25b96b48b96e2e44bb1773ad0c1222dc865f72e77a56fc85cb98` | 与冻结值一致 |
| probe manifest | `sha256:dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b` | **与冻结值逐字节一致** |
| normalization.json | `sha256:e88f5a350a8cb596884b46cd0ffe8620691ab22cf8004e8b6e41eed0ec70d227` | 与冻结值一致 |
| I03-03A 契约副本 | `sha256:f22bbde58ffbb0d78a6c77d417de4af10a3ddf93757752fbb8c0eca59840983d` | 与源文件一致 |
| build-fixtures.py | `sha256:79cf09e61ad24a3f4693b2ad31895bf63ab15387f9dc2a604c02ee719d922761` | Phase-2 副本 |
| materialize-recipes.py | `sha256:c525e03962748abe5ecb9d7e2f8c03a5a2fe8d310a34e42b5e6324df9be78182` | P1 新增 |

完整逐文件 hash 见 [`SHA256SUMS`](SHA256SUMS)；tree hash 见 [`tree-hashes.txt`](tree-hashes.txt)。

## 3. 正例 / 负例计数

| 项 | 值 | 判定 |
| --- | --- | --- |
| 正例行 | **14**：hazard 2 / player 9（8 帧 + body 1）/ graph 3 | PASS |
| 负例 | **11**：10 `geometry-mismatch` + 1 `missing-evidence` | PASS |
| `body-bounds-mismatch` | 存在，`class=geometry-mismatch` | PASS |
| 旧 10 负例口径 | 未使用 | PASS |

负例 code：`frame-missing` · `frame-size-mismatch` · `anchor-mismatch` · `trimmed` · `rotated` ·
`atlas-hash-mismatch` · `atlas-missing` · `body-size-mismatch` · `body-offset-mismatch` ·
`body-bounds-mismatch` · `graph-solid-mismatch`。

## 4. 确定性重建

| 动作 | 命令 | 退出码 |
| --- | --- | ---: |
| rebuild 1 | `python3 geometry-probe/scripts/build-fixtures.py` | 0 |
| rebuild 2 | 同上 | 0 |
| 字节对比 | `diff -r evidence/p1/rebuild-1 evidence/p1/rebuild-2` | 0（空输出） |

两次重建输出（manifest / normalization / v4 manifest）逐字节一致，见 [`rebuild-diff.txt`](rebuild-diff.txt)。
命令与退出码完整记录见 [`commands.log`](commands.log)，验证结果见 [`verify.log`](verify.log)。

## 5. 路径说明与脚本 diff

冻结 manifest 内部记录了 I03-03B2 当时的证据路径
（`.scratch/level-playability-v1.1-i03/evidence/geometry-probe/...`），这些字符串参与 `dd880628…`
的字节构成。Phase-2 把同一份字节物化到 `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/`，
因此 Phase-2 副本：

1. 把 `ROOT` 从 `parents[5]` 调为 `parents[4]`（布局浅一层）；
2. 用常量 `RECORDED` 保留冻结 manifest 中的原始记录路径字符串；
3. 修正 docstring 的旧「10 negative」口径为「11 negative」。

语义与输出字节不变：重建 manifest 仍为 `dd880628…`。完整 diff 见 [`script-diff.txt`](script-diff.txt)。

## 6. 产品零改动

| 检查 | 结果 |
| --- | --- |
| `git status --porcelain -- packages fixtures` | 空 |
| `git diff --stat -- packages fixtures` | 空 |
| 原始产品 fixture 写入 | 无（只读复制） |

## 7. STOP 检查

| STOP 条件 | 结果 |
| --- | --- |
| manifest ≠ `dd880628…` | 未触发（逐字节一致） |
| 负例回退旧 10 个口径 | 未触发（11 个） |
| 缺 `body-bounds-mismatch` | 未触发 |
| 正例 ≠ 14 / 负例 ≠ 11 | 未触发 |
| 两次重建不一致 | 未触发 |
| 修改原始产品 fixture / 副本进产品 package | 未触发 |
| 白名单外文件进入 audit 提交 | 未触发（提交只含 `geometry-probe/**`） |

## 8. 本单元未做

- 未实现 probe、未启动浏览器、未产生 P2/P3 证据。
- 未消费 probe 输出、未改 `coverage.geometry`、未改公共 Verdict / gate。
- 未开放 `PUBLIC_NB` / `PUBLIC_PU`。
- 未做独立复核与用户签署；P1 闭合、P2 启动均待后续流程。
