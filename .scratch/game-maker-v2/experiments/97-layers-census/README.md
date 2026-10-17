# 票 97 · 探针（零付费 · 零网络 · 只读已构建的 `dist`）

| 脚本 | 量什么 | 用法 |
| --- | --- | --- |
| `layers-census.mjs` | **盘上有没有任何一对（配方 × 包）会让 `layers` 那一族真的响** —— 9 份配方 × 2 份包全交叉，逐资产调**生产那个函数自己**（`auditAssetSpec`），把报文按「层族 / 其他」分开数 | `node layers-census.mjs` |

⚠️ 读的是 `packages/contracts/dist`（**不是** `src`）—— 改完 `src` 不 `tsc -b` 就重跑，读到的还是旧代码。
