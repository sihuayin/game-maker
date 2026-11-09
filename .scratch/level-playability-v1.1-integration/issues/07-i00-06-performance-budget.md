# I00-06 性能取证与预算

Type: task
Status: open
Owner: —
Blocked by: 01
Map: ../map.md
Class: I-00 / EVIDENCE

## Question

P0 的 `4096 visited / 12288 edges / 7–19ms`（A 案）是**单次原型样本**，P0 结论包已明说它不构成生产性能承诺。I-00 需要一个可辩护的预算与超限策略，否则 I-04 的验收无从判定。

### 必须交付

1. **代表性规模**：用 scratch 脚本扫出状态空间随 `world 宽度 × distance × periodMs × dt` 的增长曲线；给出本仓库现有语料（21 份横向 config / 19 个移动 hazard）中的真实量级。
2. **重复运行与方差**：同一输入重复 N 次，记录 `elapsedMs` 分布（不是单点）。
3. **预算建议**：`maxStates` 与 `timeBudgetMs` 的建议值，以及它们应写在契约的哪一层。
4. **超限策略**：预算耗尽必须落 `INSUFFICIENT_EVIDENCE`（P0 已定），但需要明确：整体降级还是逐层降级；降级是否影响 coverage；是否允许部分结果。
5. **墙钟的边界**：时间预算只用于搜索，不得参与物理 / 时序判断（P0 规则）。给出「墙钟不可影响结论」的验证方式。

### 产出

`evidence/06-performance.md` + `scripts/perf-probe.mjs` + 原始输出（JSON / 文本）。

### 边界

零付费、零新依赖、只读产品代码；脚本不进 `package.json`、不进 CI。
