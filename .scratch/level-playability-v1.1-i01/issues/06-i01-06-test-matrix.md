# I01-06 测试矩阵与证据要求

Type: task
Status: resolved
Owner: amber
Blocked by: 03, 04, 05
Map: ../map.md
Class: I-01 / DELIVERABLE

## Question

设计 I-01 的测试矩阵与证据格式，使「输入可信度」和「两档降级」都能被会红的测试证明，而不是靠现状空转。

### 必须交付

1. **新测试文件**：`packages/contracts/tests/playability-temporal-input.test.ts` 的用例清单，至少覆盖需求 §2.3：
   - 正常 Atlas 读取与 SHA 校验；
   - SHA 不匹配、文件缺失、JSON 无效；
   - 逐帧几何缺失或不一致（`sourceSize`、`anchor` 缺省、anchor 不符）；
   - 文件替换及 TOCTOU；
   - `lagMs` 缺失、非法值、两档结果不一致；
   - 伪造 hitbox / body / 尺寸 / 垂直规避声明不能获得确定性结论。
2. **夹具策略**：如何构造临时 pack。优先运行时临时目录，**不改 `fixtures/packs/**`**；若必须新增仓库内夹具，标记 `STOP → I-00 R2`。
3. **非空洞证明**：每条用例必须说明它为什么在「新通道未被消费」时会红。特别是「伪造声明」类用例，不能因为移动 Hazard 本来就是 IE 而自动变绿。
4. **架构测试**：contracts 源码不得 import `node:fs` / `node:crypto`；唯一 brand 铸造路径的测试。
5. **既有测试零改动**：列出验证命令与预期结果；明确不修改 `playability-api.test.ts` / `config-audit.test.ts` / `publish-gate.test.ts`。
6. **语料复跑**：LP-06 / LP-07 scratch 语料的命令、输入路径、基线结果与容差。说明它们是 scratch 脚本，不是 vitest。
7. **证据格式**：定义 E1 / E2 / E3 在本阶段的具体落点，以及授权包需要附哪些命令输出。

### 产出

`../evidence/06-test-matrix.md`。**不修改任何生产文件。**

### 收口条件

- 每条验收标准都有对应用例；
- 每条用例都有「为什么会红」的论证；
- 夹具策略不越白名单。

## Answer

测试矩阵与证据格式：[`evidence/06-test-matrix.md`](../evidence/06-test-matrix.md)。

- **唯一新增测试文件**：`packages/contracts/tests/playability-temporal-input.test.ts`；既有测试零改动，包括 `playability-api.test.ts` / `config-audit.test.ts` / `publish-gate.test.ts`。`publish-gate.test.ts:193` 的 `GOOD_CONFIG` 自带移动 Hazard，已事实上穿过新接线，不需要只增用例。
- **夹具零新增**：正向只读真包 `fixtures/packs/last-train/v2`（manifest + `animations` / `sprites` 两个 atlas JSON）；负向在内存改 JSON，并把 `files[]` 重绑到改后字节的真实 sha256，确保触达目标失败码（否则一律撞 `atlas-checksum-mismatch`，测试假绿）；TOCTOU 用 `mkdtempSync(os.tmpdir())` 临时副本，不写 `fixtures/packs/**`。
- **矩阵 65 条**，覆盖需求 §2.3 六类：正向 / 验证范围、文件与 checksum、逐帧几何（含 `1e-9` 容差两侧）、累积去重与全有或全无、TOCTOU 同字节、brand 与伪造声明、`lagMs` 非法矩阵与两档组合表、适用性与 scope、架构扫描。
- **非空洞关键**：负向断言精确失败码而非只断言 `ok:false`；伪造声明用例配两条阳性对照（真 brand + analyzer 返回 PU / NB），证明入口确实派发，堵住「移动 Hazard 本来就是 IE」导致恒 IE 入口也能变绿的假阳性。
- **架构测试**：contracts 源码无 `node:fs` / `node:crypto`；`verifyTemporalInput` / `auditPlayabilityTemporal` 生产调用者只允许 `assets/src/ops.ts`；生产 `analyze` 只允许 `stubTemporalAnalyzer`；`runTemporalAudit` 三处接线各一次且同步；常量唯一。
- **语料复跑**：`acceptance-corpus.mjs` / `acceptance-matrix.mjs` 是 scratch 脚本，不是 vitest；基线 96 配对 `36/36/24`、矩阵 `19/9/11`、零新增误报、零容差。
- **两条残余限制必须进 R1**：(1) 生产读取器 `readTrustedAtlasInput` 无独立单元测试（assets 无测试位、contracts 不能 import assets）；(2) 三处接线丢弃结果，「已消费」只能结构证明，不能运行时观察。
- 本票只收口测试设计；不构成 I-01 实施授权。
