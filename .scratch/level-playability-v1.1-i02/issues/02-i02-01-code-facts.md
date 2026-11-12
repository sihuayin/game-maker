# I02-01 代码事实与 I-01 能力核对

Type: research
Status: resolved
Owner: research subagent · 2026-11-10
Blocked by: 01
Map: ../map.md
Class: I-02 / EVIDENCE

## Question

用只读调查核对 I-01 已钉死的代码事实与 I-02 将要落位的接口，输出带 `file:line` 的事实清单。**只记录事实，不做设计裁定。**

### 必须回答

1. `packages/contracts/src/playability/temporal.ts`：`TemporalAnalyzer` 的精确签名、`stubTemporalAnalyzer`、`auditPlayabilityTemporal`、`resolveTwoLagResults` 的行为、`TEMPORAL_LAG_MS` / `TEMPORAL_LAG_BASELINE_MS` 的定义。
2. `temporal-input.ts`：`TrustedAtlasInput` 保证什么、不保证什么；I-01 是否逐帧校验 `sourceSize` / `anchor` / `rotated` / `trimmed`；TOCTOU 是否由「只收字节」关闭；失败码清单。
3. `packages/assets/src/ops.ts` 的 `runTemporalAudit`：读盘范围、同步/不抛约束、结果丢弃策略、三处生产调用方。
4. `packages/contracts/src/playability/mechanic.ts`：`moving-hazard-phase` gap 的位置与生成条件；`auditPlayability` 的三层聚合现状。
5. `graph.ts` / `reach.ts` / `profile.ts`：`forbiddenBoxes` 语义、`hopSamples` 的 `n = clamp(6,120,ceil(t*60))` 与 `Math.round` 位置、`GeometryCoverage` 的来源、`runtimeEntityGeometry` 对 hazard 的 `frame` / `partial` 规则。
6. 测试基础设施：`pnpm test`、`packages/contracts/tests/playability-*.test.ts` 的命名与夹具模式；`playability-temporal-input.test.ts` 已覆盖与未覆盖的内容。
7. 语料：`.scratch/level-playability-v1/corpus/inventory.json` 的 21 configs / 19 moving 口径；I-00 的 `perf-probe.mjs` 是否可直接复用。
8. 现有 fixtures / packs 能否构造 I-02 的 A–J 场景；哪些必须新建 pack（`fixtures/packs/**` 属「需单独裁定」）。
9. 任何与 I-00 冻结条文或 I-02 需求文档不一致的代码事实（只登记，不裁定）。

### 输出

`evidence/01-code-facts.md`，含 `file:line`、命令、退出码与限制说明；修改产品目录必须为「否」。

### 下游

I02-02、I02-03、I02-04、I02-05、I02-D2。

## Answer

证据全文：[`evidence/01-code-facts.md`](../evidence/01-code-facts.md)（E1 `file:line`、E2 测试与退出码、E3 语料复算均在文内；原始日志在 `evidence/logs/`）。**修改产品目录：否**（`git diff -- packages docs fixtures` 为空）。

- **I-01 的保证边界**：`verifyTemporalInput` 逐帧校验 `sourceSize`（精确相等）、`anchor`（`1e-9` 绝对容差，缺失即失败）、`rotated` / `trimmed`（`true` 即失败），10 个失败码；TOCTOU 只对 Atlas JSON 由「只收 bytes」关闭，**PNG、manifest 本身、Runtime hitbox 不在链路内**；I-00 §6.1 要求的 Phaser overlap 直接证据仍缺（C-11）。
- **入口与结果形状**：`TemporalAnalyzer` 只有 `config/manifest/lagMs/trustedInput`（`temporal.ts:39-44`），没有 `FixedRuntimeProfile`、`T_arr`、预算、phase；`TemporalAuditResult` 只有 `applicable/verdict/degradation`，**无法承载 witness / proof / stats / diagnostics**（C-04、C-10）。
- **生产仍是 stub**：`mechanic.ts:119` 对任一移动 Hazard 无条件 `addGap("moving-hazard-phase")` 并置 `mechanic=partial`；`api.ts:86-92` 顶层 `PU>IE>NB` ⇒ 当前移动 Hazard 关卡恒 IE。架构测试 T-58 / T-61（`playability-temporal-input.test.ts:589-596,612-615`）把生产 `analyze` 钉死为 `stubTemporalAnalyzer`（C-03、C-09）。
- **几何 coverage**：`runtimeEntityGeometry` 不接收 `TrustedAtlasInput`，hazard / 玩家 / graph 恒 `partial`（`profile.ts:97,113`；`graph.ts:97`），与 I-00 §7.2「参与判定几何 checked」之间缺少接线（C-01）。
- **图与 hop**：`forbiddenBoxes` = 不可穿越、不提供支撑（`graph.ts:125-133`）；`hopSamples` 的 `n=max(6,min(120,ceil(t*60)))` 固定、坐标 `Math.round`（`graph.ts:237,242-243`），没有采样密度参数或加倍对比 API ⇒ 加倍不变性必须在 `graph.ts` 外复制或改 `graph.ts`（C-07）。
- **三角波**：运行时实现只在 `packages/demo/src/hazard.ts:14-19`（白名单禁止修改）；contracts 的 `playability/**` 没有对应函数（C-06）。
- **测试与语料**：`playability-temporal-input.test.ts` 65 条覆盖输入信任链；未覆盖连续时间算法、`runTemporalAudit` 运行时行为、no-motion 入口、生产两档不一致、`coverage.temporal`、预算、A–J。语料 21 configs / 31 hazards / 19 moving（独立重算一致）；I-00 的 `perf-probe.mjs` 绑定 P0 离散模型与 21/19 硬断言，只能复用扫语料/输出骨架，不能原样复用。
- **冲突登记（不裁定）**：C-01～C-14，其中 C-01 几何 partial、C-02 公共 Contract 张力、C-06 三角波位置、C-07 hop 参数化、C-09 stub 架构测试、C-10 结果形状、C-13 P0 `verticalEvasionImpossible` 与 I-00 拒绝条款直接冲突，是后续 D1/D2/D4/D6/D9 的必答项。完整表见证据 §9。

**限制**：未运行 I-02 算法（不存在）；未运行 `perf-probe`（依赖 P0 模型且会写输出）；`inventory.json` 生成于 `main@fa17c14`，本票只重算计数未重跑生成器；未运行 `pnpm check`。
