# 冻结 FPVS-V1 基线重验与只读性证据

Type: task
Status: resolved
Blocked by: 03, 05, 06

## Question

对未变化的冻结 FPVS-V1 交付执行正式基线重验（AC-01 / Phase 3）：

1. 运行 `pnpm test:evidence`（或用固定清单直接跑 `verify-delivery`），产出**新的**运行目录报告，不覆盖历史。
2. 断言：必需证据全部识别、哈希核验通过、身份与引用关系通过、人工审核记录被正确读取（不重判）、
   Playtest 报告与 `delivery` 摘要一致、`declared` 与 `recomputed` 一致（均为 `pass`）。
3. 运行前后对受保护文件做快照比对：快照 66 文件、`pack/site` 50 文件、FA-04/05/06/09 证据、qa-report —— 断言零变化。
4. 与 `07-verify-inherited.mjs` 的 27 项结果**交叉比较**，逐条解释任何差异；不得为匹配旧结果跳过校验。
5. 记录命令、退出码、耗时、读取规模、报告路径与清单 SHA-256。

失败时的处理：如实记录差异（E3），不修改原始证据、不回写清单、不降阈值；若重算结论不是 `pass`，
把失败项定位到文件/引用/规则，并交由票 08 决定结论。产物写入 `.scratch/evidence-integrity-v1/runs/<timestamp>-baseline/`。

## Answer

**已收口（2026-10-29）。** 基线重验证据：`.scratch/evidence-integrity-v1/runs/2026-10-29T04-58-19Z-baseline/`（baseline.json / baseline.md / snapshot-before/after / 07-inherited-copy / CLI 报告）。

### 命令与结果

- `pnpm build` → exit 0。
- `node scripts/evidence-acceptance.mjs --out .scratch/evidence-integrity-v1/runs/2026-10-29T04-58-19Z-baseline` → **exit 0**，
  清单 `.scratch/evidence-integrity-v1/manifest/expected-hashes.json`
  （**223 文件 / 151 required / 72 optional**，sha256 `ba7a485b195f…36fd`，20,207,992 bytes）。
- CLI 报告：`.scratch/evidence-integrity-v1/runs/2026-10-29T04-58-19Z-baseline/2026-10-29T04-58-45-516Z-delivery-verification/report.json`
  （sha256 `80575d82…e711`）；**status=pass · declared=pass · recomputed=pass · 六项全 match · 13 records · diagnostics=0**；
  耗时 **5,766 ms**（本机、冷缓存；机器/IO 相关）。
- 07 交叉验证：原样复制脚本到 `.scratch/evidence-integrity-v1/scripts/07-verify-inherited-copy.mjs`，
  仅把输出改到 `EI_OUT`（**不写回历史证据**）⇒ **27/27 pass**，
  check id 集合与既有 `07-inherited-verification.json` 完全一致。

### 只读性

运行前后对 **312 个受保护文件**做逐文件 sha256，**零变化**：
snapshot 66 · pack/site 50 · reference 14 · FA-04 29 · FA-05 10 · FA-06 162 · 06 attempts 28 · 09 2 · work qa-report 1。
证据目录（`.scratch/fpvs-v1-final` / `.scratch/generic-playtest-v1`）`git status` 零改动。

### 与 07 的差异（已逐条解释）

- 07 的 27 项覆盖身份/材料/截图/站点/FA-05/FA-06/06 attempt/50 文件快照/09 补审；新校验器独立重算同一批证据，
  并额外校验路径安全、引用解析、可选日志、六项 declared↔recomputed。
- 07 的 `snapshot.50-files` 用冻结时的 before/after 快照比较；本票的只读快照覆盖 312 文件，前后一致。
- 07 的 `supplement.fa04-unmodified` 由补述哈希核对；新校验器用三方哈希 + 材料集合再做一遍。
- 两者结论一致（27/27、diagnostics=0、六项全 match），**没有需要解释的矛盾**。

### 已知限制

- 单 Demo；视觉结论只校验记录完整性，不重判人工判断。
- 清单中 `*.log` 为 `required:false`，不在 git 信任边界内。
- 本票不重跑浏览器/QA；六项检查由当前证据重导出。
- 耗时 5,766 ms 为本机冷缓存读数，不作为性能门槛。
