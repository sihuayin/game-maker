# I00-R1 输入输出契约冻结 [HARD BLOCK]

Type: grilling
Status: claimed
Owner: —
Blocked by: 09
Map: ../map.md
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
