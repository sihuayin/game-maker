# U5-06 性能证据

Type: task
Status: resolved
Owner: claude (U5-06 session 2026-11-13)
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

**完成。** 冻结路径脚本已创建并复跑；记录语料 SHA / freeze、环境、两档分布、`phaseGridCapped` / N 分布与 3 进程确定性摘要。**只作证据，不接 CI，不改变任何语义预算或证明结论。**

| 项 | 结果 |
| --- | --- |
| 脚本 | `.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs`（冻结路径） |
| 输出 | `.scratch/level-playability-v1.1-u5/evidence/06-performance.json` |
| 语料 | inventory SHA `sha256:ba1d051a…f74f`；freeze `sha256:25e6c891…983d`；usable 150 / unique pairs 96 / unique configs 20；实际分析 20；解析排除 0 |
| 环境 | Node v22.23.2 · Darwin 24.6.0 · arm64 · Apple M4 · 10 cores · 16 GiB |
| 历史语料 | **20 / 20 `insufficient-evidence`，全部在输入 / 几何阶段早退**；states / edges / cuts p50=max=0；`N` 分布 `{"0":20}`；`phaseGridCapped` 0；预算触顶 0；wallMs p50 1 / max 4（第一档） |
| 关键发现 | 19 关历史语料在 I-02 模型下不进入相位网格 / 搜索；不能用来证明生产搜索预算分布。完成报告必须原样写明 |
| Synthetic sanity | `synthetic-nb`：nb-candidate，N=4，states 76 / edges 64 / segments 64 / witness 44 转移·1251 B；`synthetic-pu`：pu-candidate，N=4，states 114 / edges 111 / segments 111；仅作脚本 sanity，不冒充生产语料 |
| 跨进程 | 父 + 2 子共 3 进程摘要 `sha256:2909f2b3…7aac`，三次相同；`equal: true` |
| 命令 | `pnpm build` 0；`pnpm typecheck` 0；架构断言 65 / 65；预算 26 / 26；bench 退出码 0；`pnpm test` 176 files / 2877 tests，退出码 0 |

### 已知限制

- 历史语料全部早退，搜索分布为 0；synthetic 世界只作 sanity，不是生产预算证据。
- `wallClockMs` 依赖环境，不构成通过条件；不接 CI 门禁。
- `hopSamplesChecked` 仍为 0（U5-02 已知缺口）；U4 图割 / hop 的耗时只体现在 synthetic PU 的总 `wallMs`。
- 不得用重跑 / 扩预算 / 换算法掩盖失败；语义结论仍由 `playability-temporal.test.ts` / `playability-temporal-budget.test.ts` 承担。
- F 已按增量裁定 08 使用 `none` + `no-permanent-gate`。

证据：[`../evidence/06-performance.md`](../evidence/06-performance.md)、[`../evidence/06-performance.json`](../evidence/06-performance.json)。本票未推送 / 建 PR / 合并。
