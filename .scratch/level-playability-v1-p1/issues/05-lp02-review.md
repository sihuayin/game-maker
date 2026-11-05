# LP-02 复核：空间判据可靠性与误报

Type: grilling
Status: open
Owner: —
Blocked by: 04
Map: ../map.md

## Question

HITL 复核 [LP-02 空间可达性判据](04-lp02-spatial.md)（PRD §4.3 / §6.3 第二次强制复核）。本票由用户裁定。

### 必须裁定

1. 每条空间判据是否有确定性证据链：失败目标、几何输入、判定规则、为何足以证明阻断。
2. 冻结语料与 39 例矩阵的空间结果是否可解释？新增误报是否逐条根因分析？
3. 合法复杂布局是否存在被简单几何启发式误杀的情况？
4. 是否通过复核。**通过后允许创建 Draft PR**；不通过则硬停，裁定修复、缩小范围或放弃。

### 输出

- 本票 `## Answer`：逐条判据裁定 + 误报结论 + Draft PR 创建记录（若通过）。
- 更新 `../map.md` 的 Decisions so far；必要时调整后续票据。

### 通过标准

- 空间判据可靠、无明显误报；Draft PR 仅在通过后创建。

## Context

- 实现：`523881d`；票据 Answer 在 [04-lp02-spatial.md](04-lp02-spatial.md)。
- 生产夹具：`packages/contracts/tests/fixtures/playability-matrix.json`（23 例）；测试：`packages/contracts/tests/playability-spatial.test.ts`（42 例）。
- 语料证据：[evidence/04-lp02-spatial.json](../evidence/04-lp02-spatial.json)（20 唯一 config；0 阻断 / 2 gate-missing / 18 层内无阻断；对既有 reachability 新增 0、修复 0）。
- **必须逐项裁定的三处矩阵修正**（详见 LP-02 Answer）：#19 `spawn-deep-terrain` 按 LP-00 复核降级；#4 `wall-100` 的 `signal` 是 GATE 不是 PICKUP；#12 `chest-range-rescues` 的 gate 实际不可达，chest 才被 range 救回。
- **待裁定**：mid-air touch-only（只在不落地的弧线上碰到）目前可能被报 UNREACHABLE；是补降级、还是保留为已知限制。
