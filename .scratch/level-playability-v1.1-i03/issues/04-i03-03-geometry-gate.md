# I03-03 几何 / Runtime hitbox 证据 gate

Type: grilling
Status: resolved
Owner: claude (I03-03 session 2026-11-14)
Blocked by: 01, 02
Map: ../map.md
Class: I-03 / DECISION

## Question

把 `coverage.geometry` 从 `partial` 提升到 `checked` 需要哪些证据、由谁产生、如何验证？NB 与 PU 是否共用同一 gate？

### 必须裁定

- Runtime body / 帧几何 / atlas 元数据 / Phaser hitbox 一致性的证据来源；
- 现有 `profile.ts` / `graph.ts` coverage 的边界，哪些可复用、哪些必须新增证据；
- 证据采集方式（运行时 probe / atlas JSON / 构建期校验 / 截图对照）及其可信度；
- 失败 / 缺失时的 `coverage` 与 `degradation`；
- 该 gate 如何阻断 `PUBLIC_NB` 与 `PUBLIC_PU`；
- 是否允许修改 Runtime / `graph.ts` / `profile.ts`；若需要，必须作为独立授权项列出。

### 禁止

- 把 manifest 标称尺寸当 Runtime hitbox 证明；
- 用接线成功替代几何 `checked`；
- 未经授权修改 Runtime / 只读几何模块。

### 验收

几何证据 gate 表：证据 / 产生者 / 验证方式 / 失败降级 / 对 NB/PU 的阻断；未闭合项显式列出。

## Answer

**Q1=A / Q2=A / Q3=A / Q4=A / Q5=A。** 全部进入 I-03 授权包；**不授权生产实施、不开放 `PUBLIC_NB` / `PUBLIC_PU`、不改变现有 publish rejection 行为、不授权修改 `profile.ts` / `graph.ts`。**

> 本票只冻结几何覆盖状态、证据来源与 NB/PU 准入边界；probe 的具体证据格式、固定夹具矩阵与独立复核标准由新票 I03-03A / I03-03B / I03-03C 继续冻结，之后才谈实现。

### 0. 冻结结论

| 题 | 选择 | 结论 |
| --- | --- | --- |
| Q1 | A | 新增 `coverage.geometry?: CoverageState` 汇总；三份明细留在 `model.geometryCoverage` |
| Q2 | A | 两层证据缺一不可：构建期 Atlas / PNG 校验 + 运行时 Phaser probe |
| Q3 | A | 按几何分项准入：NB 需要 hazard + player（涉及图割再 + graph）；PU 需要三份全 checked + I-00 六条件 |
| Q4 | A | `partial` 只是覆盖状态，不新增 degradation；probe 证明不一致 / 不可信才用 `geometry-untrusted` |
| Q5 | A | probe 用现有 Phaser、放 `.scratch` 或现有 demo / assets、只读可复跑；core 几何需改动 ⇒ STOP + HITL |

### 1. 公共 `coverage.geometry`（Q1）

```ts
// PlayabilityCoverage 的加法字段；与 spatial / mechanic / completion 同一取值域。
export type CoverageState = "checked" | "partial" | "not-checked";
export type PlayabilityCoverage = {
  readonly spatial: CoverageState;
  readonly mechanic: CoverageState;
  readonly completion: CoverageState;
  readonly temporal?: TemporalCoverageState;   // I03-01 / I03-02
  readonly geometry?: CoverageState;           // 本票
};
```

汇总规则：

- 三份分项（`model.geometryCoverage.hazard / player / graph`）**全部** `checked` ⇒ `coverage.geometry = "checked"`；
- 三份全部 `not-checked` ⇒ `coverage.geometry = "not-checked"`；
- 其余组合（任一 `partial`，或 checked / not-checked 混合）⇒ `coverage.geometry = "partial"`；
- **汇总值不能替代 NB/PU 各自的分项准入判断**；它只是公共层的一个可读摘要。
- 不新增时序几何的其他公共细分维度；三份明细继续在 `model.geometryCoverage`。

### 2. `checked` 的两层证据（Q2）

**缺一不可：**

1. **构建期 Atlas 证据**
   - Atlas JSON / PNG 的逐帧 `sourceSize`、`anchor`、`trimmed`、`rotated` 与 manifest 一致；
   - 使用与 manifest `files[]` 同一份字节 + SHA-256；TOCTOU 规则照 I-00 §3.1；
   - 缺帧 / anchor 缺失 / 哈希不符 / rotated / trimmed ⇒ 该分项不得 `checked`。

2. **运行时 Phaser probe**
   - 读取实际 frame / body bounds、anchor、offset；
   - 在固定夹具上逐项比较 `runtimeEntityGeometry` / `runtimePlayerGeometry` 的 box / size / anchor / foot；
   - probe 未运行、证据不完整或无法比较 ⇒ **不得**推断 `checked`；该分项保持 `partial` / `not-checked`。

**边界**：`verifyTemporalInput` 只支持 Atlas **元数据**可信，**不足以**证明 Runtime 碰撞几何一致；不能拿它单独把几何分项提升为 `checked`。

### 3. NB / PU 的几何准入粒度（Q3）

| 能力 | 必需几何分项 |
| --- | --- |
| NB witness | `hazard` + `player` |
| NB 中涉及图割的证明 | 额外要求 `graph` |
| PU | `hazard` + `player` + `graph` 全部 `checked`，并满足 I-00 六条件 |

- `coverage.geometry` 是汇总状态，**不是**所有能力共用的单一布尔门槛。
- 每个能力按自己实际消费的几何分项判断；NB 不被无关的 graph 证据过度阻塞，PU 不因缺少 hazard / graph 证据获得准入。

### 4. 证据不足 / probe 失败的降级（Q4）

- 任一分项 `partial` ⇒ 汇总 `coverage.geometry = partial`；
- 对应 NB / PU 几何准入不通过；公共 Verdict 保持 `INSUFFICIENT_EVIDENCE`；
- **仅仅缺少证据**不新增 `geometry-partial` degradation；
- probe 发现实际几何与模型不一致 / 输入不可信 ⇒ 记录 `geometry-untrusted`，并保持 IE；
- **区分**：`partial` 是覆盖状态；`geometry-untrusted` 是有负面证据支持的降级原因。

### 5. probe 位置与白名单（Q5）

- 使用现有 Phaser，**不新增依赖**；
- probe 放在 `.scratch` 或现有 demo / assets 层；只读、确定性、可复跑；
- 产出机器可读 JSON + hash 证据（格式见 I03-03A）；
- `profile.ts` / `graph.ts` **保持只读**；
- 若 probe 证明必须修改 core 几何才能使模型与 Runtime 一致 ⇒ **STOP + HITL**；不得借 I-03 顺带修正几何语义。

### 6. 四个状态不可混用

1. **时序分析已接线**：I-02 内部结果可以被 I-03 消费。
2. **几何覆盖已检查**：相应分项具有两层验证证据。
3. **证据准入通过**：对应能力消费的几何分项全部满足要求。
4. **公共能力开放**：仍须独立复核和显式授权。

`coverage.geometry = checked` 只表示第 2 层；不表示第 3 层或第 4 层。`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`。

### 7. 新票（本轮毕业的雾）

- **I03-03A** 几何 probe 证据格式与 hash；
- **I03-03B** 固定夹具矩阵（正 / 负例、覆盖分项、预期 coverage）；
- **I03-03C** 几何证据独立复核标准。

I03-04 / I03-05 的几何准入都依赖这三张票；I03-06 可并行。

### 8. 边界

- 全部进入 I-03 授权包；I03-09 必须把 §1–§6 转录进几何覆盖 / NB/PU 准入章节。
- 不授权生产实施；不修改 `profile.ts` / `graph.ts` / Runtime；不新增依赖。
- 不开放 `PUBLIC_NB` / `PUBLIC_PU`；不改变现有 publish rejection。
- 不把 `coverage.geometry = checked` 当作 NB/PU 已准入或公共能力已开放。

### 9. 下游

- **I03-03A / B / C**：probe 格式、夹具、独立复核；完成前不进入几何准入实现。
- **I03-04 / I03-05**：按分项几何准入；三张 probe 票全部完成后才能判定 NB/PU 的几何门。
- **I03-06**：发布门消费规则，与几何 probe 并行。
- **I03-07**：逐文件白名单必须明确 probe 所在层与 `mechanic.ts` / `api.ts` 的最小改动。
- **I03-08**：把 §2–§4 转成验收矩阵与负向场景。
- **I03-09**：组装授权包；不得把未来实施写成已实施。
