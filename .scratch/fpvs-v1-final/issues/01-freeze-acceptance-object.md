# FA-01 冻结验收对象

Type: task
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md
Blocked by: —

## Question

创建本轮验收的**只读快照**与**可写工作区**，记录可复核的版本身份与哈希；**不启动通关脚本开发**。

1. **源**：`.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe/`
   （`pack/v1`、`run/v1/game-config.json`、`run/v1/qa-report.json`、`site/v1` 及相关输入）。
   以当前字节为准，不重跑生成、不重跑构建。
2. **只读快照**：复制到 `.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/`，
   复制完成后设为只读（如 `chmod -R a-w`），并记录只读证明。
3. **可写工作区**：另建 `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/`，
   从快照复制，供 `playtest` 写 `run/v<N>/playtest/v<K>/` 与 `qa-report.json`；
   每次写入回指快照身份。**快照本身零写入**（这是本票必须先裁定的边界：
   `playtest` 的写回与「快照只读」的张力不能靠目录命名解决）。
4. **身份记录** `artifacts/identity.json`：原始路径、快照路径、`site.json` 三元组
   （shell / pack / config）、config 路径、pack 版本、site 版本、参考图路径、游戏意图来源、
   qa-report / playtest 报告位置、冻结时间。
5. **哈希清单** `artifacts/hashes.json`：覆盖验收所需文件（至少 site 目录、config、pack
   manifest/ledger/delivery 图集与 authoring 必要文件、qa-report、历史 playtest 报告）。
   每条记录 `{ path, relativePath, bytes, sha256 }`；缺失文件显式记 `missing`，不得静默跳过；
   清单要能回答「哪些文件参与验收、哪些不参与」。
6. **校验**：快照与源逐文件字节一致；`site-integrity` 可复核；源目录与快照均未被修改；
   工作区身份与快照一致。
7. **审计产出** `research/freeze-audit.md`：快照清单、哈希算法与覆盖规则、缺失项、身份结论、
   只读/工作区边界。

边界：只读源与快照；不改 `packages/`、`fixtures/`、`game-maker.local.json`；不跑 Chrome；不写最终报告。

## Answer（冻结 · 2026-10-27）

**冻结完成。**

- **只读快照**：`artifacts/wasteland-scavenger-recipe/`，66 文件，`chmod -R a-w`，0 个可写条目；
  `touch` 被拒绝。
- **可写工作区**：`work/wasteland-scavenger-recipe/`，66 文件，可写。
- **历史参考**：`artifacts/reference/`，14 文件（playtest-v1 attempt-v1 + prior delivery stage-c）。
- **身份**：`artifacts/identity.json` —— `pack/v1` · `site/v1` · shell 2；manifest 原始 sha256
  与 qa-report `subject.manifestChecksum` 一致；run config 与 site config 同字节；
  历史试玩 `identity` 与快照一致。
- **哈希**：`artifacts/hashes.json` —— 80 条（快照 66 + 参考 14）；24 项关键检查全命中，`missing` 为空。
- **校验**：snapshot vs source 66/66 一致（`diff -rq` 空）；work vs snapshot 66/66 一致；
  source before/after 哈希一致；快照/参考只读、工作区可写。
- **审计**：`research/freeze-audit.md`；复跑脚本 `freeze.mjs`。

**新发现（转 FA-01D / FA-02）**：work 的 `run/v1/qa-report.json` 是 QA 层报告、**没有 `delivery`**；
`game-maker playtest` 会以「身份不明的交付」拒绝。FA-02 前必须初始化**本轮** delivery 信封，
不得继承历史 stage-c 的 `visual-review: pass`。

→ 解除 FA-01B / FA-01D 阻塞；FA-01C 仍被 FA-01B 阻塞。
