# I01-06 测试矩阵与证据要求

Type: task
Status: open
Owner: —
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
