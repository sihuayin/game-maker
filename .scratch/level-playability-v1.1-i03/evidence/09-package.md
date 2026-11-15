# I03-09 授权包组装证据

> **2026-11-14 后续修正（I03-10 F2）**：本文件保留 I03-09 组装时的 audit 快照；授权包 / 审查输入包在 F2 修正后已变更。当前 hash 见 [`10-f2-correction.md`](10-f2-correction.md)。审计表第 7 行的负例计数已按修正记录标为 11。
>

| 项 | 值 |
| --- | --- |
| 票 | I03-09 授权包组装与一致性审计 |
| 日期 | 2026-11-14 |
| 分支 | `wayfinder/level-playability-v1.1-i03` |
| Base | `wayfinder/level-playability-v1.1-i02` @ `2b57f2a` |
| 授权包 | `docs/v7.8/移动-I03.md` |
| 授权包 SHA-256 | `0edf5005d52f50ccbaa52be85f9b4ed34b904aacc6b51d7eec72be6ee2863c14` |
| 授权包 SHA-256（I03-10 F2 修正后） | `2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` |
| 审查输入包 | `.scratch/level-playability-v1.1-i03/reports/09-review-input-package.md`（`sha256:5c6e2be47207944643267dd8713c290727b087c033b641abc7289b05171b5944`） |
| 审查输入包（I03-10 F2 修正后） | `.scratch/level-playability-v1.1-i03/reports/09-review-input-package.md`（`sha256:1227d1f3c78dda382cd4f6c6560740f512ac3fc4a131a33a35b436da5fda7abd`） |
| I-02 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未修改） |

## 1. 组装输入

- 已签署 I-02 授权包（上述 hash）；
- U5 完成报告 / 最终审计 PASS / U5-SIGN（2026-11-13）；
- 前沿裁定 `reports/00-frontier-ruling.md`（Q1=A / Q2=分阶段 / Q3=最小面 / Q4=A）；
- 规划地图 `map.md`；
- 决策票 Answer：I03-00、I03-01、I03-02、I03-03、I03-03A、I03-03B、I03-03B2、I03-03B2a、I03-03C、I03-04、I03-05、I03-06、I03-07、I03-08；
- I03-PU-Air-Control-Closure：**未闭合**，在包中保持条件 5 `BLOCKED`。

## 2. 组装输出

- `docs/v7.8/移动-I03.md`：§0–§17；ASSEMBLED / UNSIGNED；
- `.scratch/level-playability-v1.1-i03/reports/09-review-input-package.md`：审查输入清单，无作者结论；
- 本证据文件。

## 3. 一致性审计

| # | 检查 | 命令 / 方法 | 结果 |
| --- | --- | --- | --- |
| 1 | 无未决占位符 | `grep -n "⏳\|待 I03\|TODO"` | PASS（无命中） |
| 2 | 章节完整 | `grep -n '^## '` | PASS（§0–§17） |
| 3 | 六条冻结边界 | 包 §1.1 逐项核对 | PASS（6/6） |
| 4 | 前沿裁定 Q1–Q4 | 包 §0.3 / §1 / §7 | PASS |
| 5 | NB 三阶段 | 包 §1.2 / §8 | PASS |
| 6 | PU 独立链 + 六条件 + 条件 5 | 包 §1.3 / §9 | PASS |
| 7 | 几何四状态 + 14 正例行 + 11 负例（I03-10 F2 修正） | 包 §1.4 / §6 | PASS |
| 8 | 公共 degradation 13 值 | 解析 `PublicTemporalDegradation` | PASS（13） |
| 9 | Verdict 映射 / 优先级 / 冲突 | 包 §4 | PASS |
| 10 | 发布门闭集 + G1–G11 | 包 §7 | PASS |
| 11 | AC 21 条 / required 19 | `grep -c '^\| AC-[0-9]'` + required 计数 | PASS（21 / 19） |
| 12 | 负向 N1–N18 | `grep -cE '^\| N[0-9]+ \|'` §10.3 | PASS（18） |
| 13 | 单元 / 顺序 / 白名单 | 包 §11 | PASS（U1→U2→U4→U5→U3） |
| 14 | Ledger 空白 + 能力 BLOCKED | 包 §12 | PASS（无预填） |
| 15 | STOP 12 条 + 回滚 | 包 §11.3–§11.5 | PASS |
| 16 | I-02 未修改 | `shasum -a 256 docs/v7.8/移动-I02.md` | PASS（hash 不变） |
| 17 | 产品目录零 diff | `git diff --stat 2b57f2a -- packages fixtures` | PASS（空） |
| 18 | 白名单现有路径存在 | 逐路径 `test -f` | PASS（11/11） |
| 19 | 新增文件尚未存在 | 逐路径 `test -e` | PASS（4/4 absent） |
| 20 | Markdown 链接 | `node scripts/check-links.mjs` | PASS（组装后复跑） |
| 21 | 无实施授权 / 能力开放 | 包 §12 / §13 | PASS（NOT_AUTHORIZED / BLOCKED） |
| 22 | `NOT_RUN` 已披露 | 包 §10.2 / §10.6 | PASS（AC-11 / AC-15；L3 / L4） |

## 4. 未闭合项（显式披露）

- **PU 条件 5**：`BLOCKED`，由 I03-PU-Air-Control-Closure 独立闭合。
- **PU 条件 2**：`BLOCKED`，几何 probe 未实现、I03-03 A/B/C 证据未产出。
- **AC-11**：非 required，phase-1 `NOT_RUN`。
- **AC-15**：非 required，phase-1 `NOT_RUN`。
- **Runtime hitbox equality**：未证；`runtimeBody="unverified"`。
- **LP-06/07**：非 vitest、不在 CI。

## 5. 边界

- 本票未修改 `packages/**` / `fixtures/**` / I-02 原文 / U5 结果。
- 未授权 U1–U5 开工；未开放 `PUBLIC_NB` / `PUBLIC_PU`。
- 未推送、未建 PR、未合并。

## 6. 复跑记录

```bash
node scripts/check-links.mjs   # 组装后复跑
pnpm test                      # 授权包不涉及代码；实施验收时执行
```
