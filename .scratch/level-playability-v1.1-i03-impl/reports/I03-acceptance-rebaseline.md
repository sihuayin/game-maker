# I-03 验收基线重冻结记录

| 项 | 值 |
| --- | --- |
| 依据 | `.scratch/level-playability-v1.1-i03-impl/reports/I03-acceptance-baseline-rebaseline-authorization.md`（用户裁定：授权重冻结基线；接受 INCOMPLETE 关闭） |
| 日期 | 2026-11-17 |
| Base | `d4d95b0`（main，重冻结授权合入后） |
| 环境 | macOS / Darwin arm64 · Node v22.23.2 · pnpm 10.7.1 |
| 范围 | 仅 LP-06/07 tracked 证据；无产品 / 契约 / gate 改动 |

## 1. 命令

| 命令 | 退出码 |
| --- | ---: |
| `pnpm build` | 0 |
| `node .scratch/level-playability-v1-p1/acceptance-corpus.mjs` | 0 |
| `node .scratch/level-playability-v1-p1/acceptance-matrix.mjs` | 0 |

## 2. 重冻结文件与 hash

| 文件 | 旧 SHA-256 | 新 SHA-256 |
| --- | --- | --- |
| `.scratch/level-playability-v1-p1/evidence/06-corpus-regression.json` | `4bd950265dbb843f57c311890a7dbe64344aab461c99e5548f939e5a3cefbd94` | `1d5db74e3371a48253f80348165bf3c7fd026b316348d0b514faca88ad5aeabc` |
| `.scratch/level-playability-v1-p1/evidence/06-matrix-acceptance.json` | `21161ea83c50d996cae07e546fc11f34a31eeeb878f018f60ce2592a6d0e68d7` | `fdc77aada4c89f70f96117dd9071709f34d15f83f501a74942240bff7c3174ef` |

语义 hash（canonical JSON、sorted keys、去顶层 `generatedAt`）：

| 项 | 旧 | 新 |
| --- | --- | --- |
| LP-06 | `sha256:533b78b9df79bcb1b651fa702a390f3dca59f84666945442b7613c0baceb5a4f` | `sha256:071ae5d58502984374ae0c3c20748571303a1675cb43ef9da1f45456682bb4c3` |
| LP-07 | `sha256:59064484…` | `sha256:5c7d9391b27e45beeaca113d61bdf37d9aae216dfb266815bd0115d0401d1665` |

新语义 hash 与最终验收会话的 U3 后复跑值逐项一致（LP-06 `071ae5d5…`、LP-07 `5c7d9391…`）。

## 3. 组成不变量

- LP-06：usable configs 150 / unique configs 20 / unique pairs 96 / evaluated pairs 96 / evaluated configs 20 / unique content pairs 31。
- LP-07：39 case；矩阵来源不变。
- LP-06 历史语料仍 **20 unique configs / 96 pairs / 19 个 x 轴移动 Hazard**。

## 4. 边界

- 仅重冻结 tracked 证据；未修改 `packages/**`、`fixtures/**`、授权包、Ledger、AC 文本、gate。
- 公共 temporal 路径仍由 U4/U2 接管为 IE（AC-07 复核 PASS）；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`。
- AC-10 / AC-12 / AC-14 仍为 required `NOT_RUN`；验收整体预期 `INCOMPLETE`。
