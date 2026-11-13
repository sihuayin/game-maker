# U5-06 性能证据

Type: task
Status: open
Owner: —
Blocked by: 06
Map: ../map.md
Class: U5 / EVIDENCE

## Task

创建 `.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs`，产出 AC-13 性能证据。**只作证据，不作 CI 墙钟门禁。**

### 允许文件

- `.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs`（新建）
- `.scratch/level-playability-v1.1-u5/evidence/`、`reports/`
- `packages/contracts/src/playability/temporal*.ts`（仅在基准暴露语义缺陷时修改，并逐项说明）
- `packages/contracts/tests/playability-temporal*.test.ts`（同上）

### 必须完成

1. 脚本路径冻结：`.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs`；语料以 `.scratch/level-playability-v1/corpus/inventory.json` 为准，记录 SHA-256。
2. 输出：p50 / max `states`、`edges`、`cuts`；`wallMs`；`phaseGridCapped` 分布与实际 `N` 分布；跨进程确定性签名；Node 版本、OS、CPU。
3. 禁止把 P0 代理数值冒充 I-02 生产预算；禁止用重跑 / 扩预算 / 切换算法掩盖失败。
4. 写证据 `.scratch/level-playability-v1.1-u5/evidence/06-performance.md`（命令、环境、语料 hash、原始输出摘要）。
5. 语义预算上限仍由 `playability-temporal-budget.test.ts` 确定性验收；本票不改 CI workflow。

### 禁止

- 把墙钟阈值作为通过条件或 CI 门禁；
- 新增依赖 / 产品文件 / 白名单外修改；
- 用性能数值改写证明结论。

### 验收

基准脚本可复跑；证据含分布与跨进程签名；语料 SHA 记录；不改变 CI 门禁。

## Answer

（resolved 时填写）
