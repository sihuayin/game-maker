# I03-00 基线证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-i03` |
| base | `wayfinder/level-playability-v1.1-i02` @ `2b57f2a`（U5 已合并） |
| charting commit | `417cf00`（`docs(wayfinder): chart I-03 authorization-package effort`） |
| 工作区 | 开工前干净；产品目录 `packages/` / `fixtures/` 相对 `2b57f2a` **零 diff** |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（`shasum -a 256 docs/v7.8/移动-I02.md`，与已签署版本一致） |
| 前沿裁定 | [`reports/00-frontier-ruling.md`](../reports/00-frontier-ruling.md)（amber · 2026-11-13） |
| 地图 | [`map.md`](../map.md)（`Status: open · 2026-11-13 开图`） |

## 输入基线（I-02 / U5）

| 输入 | 状态 / 证据 |
| --- | --- |
| U5 完成报告 | [U5-completion.md](../../level-playability-v1.1-i02/reports/U5-completion.md)：D9 组装、预算 / 确定性 / A–J / 双档 / 性能 / LP 回归完成 |
| U5 最终审计 | [U5-final-audit.md](../../level-playability-v1.1-i02/reports/U5-final-audit.md)：AC-08～AC-13 **全部 PASS**，无 FAIL / NOT_RUN |
| U5-SIGN | [11-u5-sign.md](../../level-playability-v1.1-u5/issues/11-u5-sign.md)：用户 amber 2026-11-13 签署 U5；范围仅 U5 |
| 公共能力 | `PUBLIC_NB` / `PUBLIC_PU` 仍 **BLOCKED**；`publicCapability="BLOCKED"`、`publicResult=null` |
| 几何 | `geometryCoverage` 三份恒 `partial` / `unverified`；Runtime body 未验证 |
| 模型闭合 | `movementModelClosure="not-proven-air-control"`；空中水平控制未闭合 |
| F | `certificate.kind="none"` + IE `no-permanent-gate`（增量裁定 08） |
| 历史语料 | 20/20 唯一 config 全部 IE 早退；搜索分布为 0 |
| `hopSamplesChecked` | 仍为 0（U4 六键输出边界未暴露逐弧计数） |
| U4 独立预算 | 未实现（`maxStates` / `maxEdges` 按 D5 只属 U2） |
| 同一输入 lag 不一致 | 未找到真实世界；合并函数用两个完整但结论不同的单档结果测试 |
| `perLagResults` | 由内部 `TemporalTwoLagInternalResult` 的 `first` / `second` 提供；D9 未扩字段 |

## 当前公共面事实

- `PlayabilityCoverage` 只有 `spatial` / `mechanic` / `completion`；**没有 `temporal`**。
- `PlayabilityEvidence` 只有 `judgmentId / target / detail / witness / coverage / assetId? / expected? / actual?`；**没有 `model / lag / degradation / limits`**。
- `assets/src/ops.ts` 仍使用 `stubTemporalAnalyzer`；`publish-gate` 只消费 `auditPlayability`，**不消费时序结果**。
- I-02 `temporal.ts` 的内部入口 `analyzeTemporalInternal` / `analyzeTemporalInternalTwoLag` 不在公共 barrel。

## 本票产出

| 文件 | 性质 |
| --- | --- |
| `docs/v7.8/移动-I03.md` | **DRAFT 骨架**：§0–§13；未决章节只留占位；未签署 |
| `.scratch/level-playability-v1.1-i03/evidence/00-baseline.md` | 本证据 |
| `.scratch/level-playability-v1.1-i03/issues/01-i03-00-init.md` | 本票 |

`docs/v7.8/移动-I03.md` 的 Authorization Ledger 骨架：

| 单元 / 能力 | 状态 |
| --- | --- |
| I-03 授权包 | DRAFT（未签署） |
| `PUBLIC_NB` | BLOCKED |
| `PUBLIC_PU` | BLOCKED |
| I-03 实施 | NOT_AUTHORIZED |

- 未填入任何未决结论；未修改 `packages/**`、`fixtures/**`、I-02 原文、U5 结果。
- 未推送 / 建 PR / 合并。

## 结论

I03-00 完成：分支 / base / 授权包 SHA / 输入基线 / 台账 / 包骨架 / 证据就绪；产品目录零 diff；未授权任何实施或公共能力。**I03-01 为下一 frontier 票。**
