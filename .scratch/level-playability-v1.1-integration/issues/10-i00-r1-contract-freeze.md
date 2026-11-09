# I00-R1 输入输出契约冻结 [HARD BLOCK]

Type: grilling
Status: resolved
Owner: 用户裁定 · 2026-11-09
Blocked by: 09
Map: ../map.md
State: SIGNED（2026-11-09）
Class: I-00 / DECISION

## Question

基于 I00-01～06、I00-10 的证据与 I00-07 的验证矩阵，裁定并冻结最终输入输出契约。**未通过不得冻结契约，后续票保持 blocked。**

### 必须裁定

1. **输入契约**：字段、类型、可选性、权威来源、来源验证规则。至少覆盖 PRD §6.1 的七类输入（GameConfig / AssetPackManifest / Runtime Geometry Profile / Hazard 运动描述 / 时间相位 / `lagMs` / 分析范围）。
2. **运动模型**：单 X 轴 hazard 的精确语义（三角波、往返整周期、`t=0` 含义、相位是否当自由变量），以及模型外的判定（一律 IE）。
3. **三态判定规则**：什么条件产出 `NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE`；正宽度永久封锁门的形式化定义；垂直规避的处理方式。
4. **证据与审计格式**：PRD §6.2 的七项解释要素在现有 `PlayabilityEvidence` 内的落法；若需扩展，扩展面与授权类别。
5. **coverage 规则**：`partial` 是否、以及在哪一层压成 `INSUFFICIENT_EVIDENCE`；与 V1 既有语义的兼容性（PRD §3.4 禁止回退）。
6. **降级矩阵**：所有必须落 IE 的情形，逐条列出。

### 产出

裁定记录 + 契约草案 `evidence/r1-contract.md`；最终并入 `docs/v7.8/移动-I00.md`（在 R3 发布）。

### 硬边界

- PRD 三态语义与 G-01～G-07 不得放宽。
- 若某项裁定要求修改 PRD，先走 HITL 修改权威输入并重算哈希。

## Answer（部分裁定 — 未签署）

用户 2026-11-09 裁定：**Q1、Q2、Q3、Q4、Q6 通过；Q5 有条件通过（运动模型冻结，网格不等式待证）。R1 保持 BLOCKED，不签署通过。**

### 已接受

**Q1 — G-01 采用 (a) 审计时读取 Atlas JSON。** 冻结要求：

1. 审计前执行 `verifyPack`。
2. 从已验证的 Manifest 取得 Atlas 记录与 SHA-256。
3. 对**实际读取的 Atlas 字节**校验 SHA-256 与 Manifest 一致。
4. 用**这份已校验的字节**解析，逐帧比对 `sourceSize`、`anchor` 等几何字段。
5. 读取、哈希校验、几何比对必须使用**同一份字节**——禁止「先 verifyPack，再重新读一个可能被替换的文件」。**TOCTOU 裂缝必须关闭。**
6. 缺失帧、缺失 anchor、尺寸不一致、哈希不一致、验收后文件被改写 ⇒ `INSUFFICIENT_EVIDENCE`。

不采用 acceptance 报告作为唯一证据；不扩展 Manifest 契约。

**Q2 — G-02 采用 (iii)。** 核心 API 的 `lagMs` **必填、无隐式默认**；`auditConfigPipeline` 用单一具名常量提供 200ms；两档为 16.67ms / 200ms；**两档结论不一致 ⇒ `INSUFFICIENT_EVIDENCE`**。核心 API 每次只接受一个 `lagMs`，两档由上层编排分别调用并比较——核心 API 内部不得藏第二个默认值。证据记录两档输入与各自结果。不得复用 `mechanic.ts:62` 的 `FRAME_MARGIN_MS`。

**Q3 — G-06 采用 (c) 新增内存内 `coverage.temporal`。** `coverage.spatial` 行为一字不改，不得因它恒为 partial 而使 9 个既有案例回归。移动 Hazard 的机制判定必须检查 `coverage.temporal`：未完成可信证据检查 ⇒ 机制层 IE；完成才允许进入时序判定。`temporal = checked` 只表示所需输入与模型检查完成，**不代表已证明可通行**。**新增优先级规则**：时序层证据不足不得被顶层聚合成 `NO_PROVEN_BLOCKER`——须有覆盖 `api.ts:87-92` 顶层聚合路径的明确测试。不新增持久化 verdict、不新增 `ConfigIssue.code`。

**Q4 — 证据结构做内存内加法。** 新增可选字段 `model` / `lag` / `degradation` / `limits`；不改 `ConfigIssue`、不加 `code`、不新增持久化 schema、不引入落盘证据链。冻结文档与未来能力声明必须写明：「可审计」指测试、冻结契约、scratch 原始证据与审计过程可复核，**不是生产运行结果可持久化追溯**。

**Q5 — 运动模型部分冻结。** 单 X 轴、三角波、`periodMs` 为往返整周期、`t=0` 在 `at`、相位当自由变量、唯一未定量为 `T_arr`、U9 存在时允许覆盖完整相位、`lagMs` 与相位正交。**网格不等式方向不冻结**（见 B1）。

**Q5 补充 — PRD FR-07 映射（精确版）**：相位可作为自由变量分析；只有当 `T_arr` 无法确定**且不存在经过验证的可达安全等待格 U9** 时，才因相位不确定降级为 IE。U9 成立必须证明它**在当前模型下可达、可等待、且等待过程本身安全**——不能因为地图上有一个空格就认定 U9 成立。

**Q6 — 三态形式化通过，附 G-04 限定。**

| 结果 | 必要条件 |
| --- | --- |
| `PROVEN_UNPLAYABLE` | 门区恒覆盖 + 所有参与判定的几何 `checked` + 图割证明不连通 + 已排除当前支持模型内的合法规避路径 |
| `NO_PROVEN_BLOCKER` | 连续时间验证过的安全 witness + 两档 lag 结论一致 |
| `INSUFFICIENT_EVIDENCE` | 其余所有情况 |

禁止规则：BFS 无解 / 预算耗尽 / 采样未撞 ≠ PU；NB ≠ 可玩保证；任一必要几何证据未 `checked` 不得输出确定性结论。

### 阻塞项（R1 未签署的原因）

- **B1 网格采样不等式的方向**：`maxSpeed · periodMs / N ≥ xStep` 与直觉相反，必须用反例与推导确认后才能冻结。见 [B1](15-b1-grid-sampling-inequality.md)。
- **B2 G-04 的证明边界**：必须把「受支持模型内的图割不连通」与「模型外垂直规避无法排除时降级 IE」写成正式契约条文，且不接受调用方布尔标记。见 [B2](16-b2-vertical-evasion-contract.md)。

### 授权状态

- 未授权任何生产修改。
- 未授权 I-01 执行。
- B1 / B2 关闭后，Q1–Q6 合并为 R1 最终裁定，**不再新增 HITL 票**。

---

## 阻断项关闭（2026-11-09）

- **B1 已关闭**：[`evidence/b1-grid-sampling.md`](../evidence/b1-grid-sampling.md)。结论：`≥` 方向成立（`N ≤ floor(maxSpeed·periodMs/xStep)`），它是**能力约束**——违反只产生 IE，不产生错误结论；不存在 `v_hazard·dt ≤ xStep` 的安全性约束（解析求交负责可靠性）。
- **B2 已关闭**：[`evidence/b2-vertical-evasion-boundary.md`](../evidence/b2-vertical-evasion-boundary.md)。G-04 的六条证明义务、门区构造、降级与禁止条文已成文；新增「hop 采样加倍不变性」作为 PU 的硬性验证义务。

**契约草案**：[`evidence/r1-contract.md`](../evidence/r1-contract.md)（待签署）。

`State: READY-TO-SIGN` —— B1/B2 的实质结论与用户预设不同（方向未反），签署前需用户确认。

---

## 签署（2026-11-09）

用户确认：**接受 B1 结论，签署 R1**。

- B1 结论接受：`maxSpeed · periodMs / N ≥ xStep` 为**能力约束**（违反只产生 IE）；不引入 `v_hazard · dt ≤ xStep`。
- 契约以 [`evidence/r1-contract.md`](../evidence/r1-contract.md) 为准，经 R3 并入 `docs/v7.8/移动-I00.md`。
- 本签署**不等于**实施授权；公共面改动仍需 I00-R2 白名单裁定与独立实施授权。

`State: SIGNED`。
