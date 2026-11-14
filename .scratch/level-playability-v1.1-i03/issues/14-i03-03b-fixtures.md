# I03-03B 几何 probe 固定夹具矩阵

Type: grilling
Status: resolved
Owner: claude (I03-03B session 2026-11-14)
Blocked by: 04
Map: ../map.md
Class: I-03 / DECISION

## Question

几何 probe 的**固定夹具矩阵**是什么？必须覆盖 hazard / player / graph 三个分项的正例与负例，并明确每个夹具的预期 `coverage.geometry` 结果与 failure code。

### 必须裁定

- 正例夹具：静态 solid / terrain、hazard frame、player 多帧动画、goal / pickup frame、chest / danger body、图割相关 graph；
- 负例夹具：缺 atlas / 缺帧、anchor 不符、trimmed / rotated、body size 不符、player 动画帧尺寸不符、body offset 不符、hash 不符；
- 矩阵：夹具 id × 几何分项 × 预期 coverage（checked / partial / not-checked）× 失败码；
- 固定夹具的来源（内存 / scratch；不新增产品 JSON fixture，不把 19 关全语料搬进 probe）；
- 正例全部 checked、负例全部 partial / geometry-untrusted，且不得出现假 checked；
- 夹具与 I03-03A 的格式一一对应；可复跑。

### 禁止

- 用抽样 / 单帧代替逐帧覆盖；
- 把 negative 夹具静默跳过；
- 新增产品 fixture / 依赖 / 公共 API。

### 验收

夹具矩阵表、预期 coverage / failure code、正负例覆盖、未覆盖项。

## Answer

**Q1=A / Q2=A / Q3=A / Q4=A / Q5=A。** 本票冻结**夹具设计、覆盖对象、负例变异与预期结果**；不授权 probe 或夹具实现，不修改产品 fixture，不开放公共能力。

> 逐行 fixture manifest（每个 frame / body 的 expected 值、hash、变异配方）由 **I03-03B2** 继续冻结；独立复核清单由 **I03-03C** 冻结。两者完成前，probe 实现不得开始。

### 0. 冻结结论

| 题 | 选择 | 结论 |
| --- | --- | --- |
| Q1 | A | `last-train/v2` 真实 pack + scratch v4 归一化副本；原始 fixture 只读 |
| Q2 | A | hazard 2 帧 / player 8 帧 + spawn body / graph terrain + luggage solid + player box；逐行，不抽样 |
| Q3 | A | 10 个 geometry failure code 各一个具名负例；environment / nondeterministic / probe-not-run 不造几何夹具 |
| Q4 | A | 正例全 checked；missing-evidence ⇒ partial；geometry-mismatch ⇒ 不得 checked + untrusted；environment / nondeterministic ⇒ partial |
| Q5 | A | scratch `geometry-probe/fixtures/`；每份副本记录输入 hash / 变异说明 / 产物 hash；可确定性重建 |

### 1. 基底与归一化（Q1）

- 基底：`fixtures/packs/last-train/v2`（真实 Atlas JSON / PNG / 帧数据）。
- scratch 副本：`.scratch/level-playability-v1.1-i03/evidence/geometry-probe/fixtures/last-train-v4/`。
- 只在 scratch 副本内做 `assetpack/v2 → v4` 归一化；原始 `fixtures/packs/last-train` **只读**。
- 必须记录：
  - 原始基底文件 hash（manifest + 每个 atlas JSON/PNG）；
  - **归一化变换**（逐字段：`format`、`provenance` 等）与变换脚本 / 命令；
  - 归一化产物 hash。
- **不能只记录转换后的 hash**；必须能从冻结的 v2 基底 + 记录的变换独立重建 v4 副本。

### 2. 正例覆盖矩阵（Q2）

| 分项 | 正例对象 | 必须记录 |
| --- | --- | --- |
| hazard | `hazard-sweeping-carriage` 的 `sweep1` / `sweep2` 两帧 | size、anchor、frame bounds、runtime frame / sprite bounds |
| player | `player-traveler` 的 `idle1..2` / `run1..4` / `jump1..2` 八帧 + spawn body | 每帧几何 + body size / offset / bounds / foot |
| graph | `terrain#0`、`luggage` solid、player box | solid 几何、玩家盒、图割输入几何 |

- 每帧、每个 body 一行，**不得抽样**。
- 不增加 goal / pickup：它们不属于本轮 geometry gate 的必需分项。
- 正例清单一旦冻结，probe 实现后**不得**根据结果删减失败对象。

### 3. 负例矩阵（Q3）

| 失败码 | 负例类型 | 变异主变量 |
| --- | --- | --- |
| `atlas-missing` | 缺失 Atlas | 删除 / 不提供 atlas 文件 |
| `frame-missing` | 缺失指定帧 | 从 atlas 删除一个帧 |
| `frame-size-mismatch` | 帧尺寸不匹配 | 改 frame `sourceSize` / `spriteSourceSize` |
| `anchor-mismatch` | anchor 不匹配 | 改 frame anchor |
| `trimmed` | 帧被裁切 | `trimmed=true` |
| `rotated` | 帧被旋转 | `rotated=true` |
| `atlas-hash-mismatch` | Atlas 输入 hash 不匹配 | 改 atlas 字节 / 提供不同字节 |
| `body-size-mismatch` | body 尺寸不匹配 | 改 body size（harness / scratch config） |
| `body-offset-mismatch` | body offset 不匹配 | 改 body offset（harness override） |
| `graph-solid-mismatch` | solid 几何不匹配 | 改 scratch graph / solid 输入 |

- **每个负例只改变一个主要变量**；不得同时改多个错误，避免失败码归因不明确。
- `environment-mismatch` / `nondeterministic` **不伪造几何夹具**；由 I03-03C 的 review-only 检查承担。
- `probe-not-run` 是执行缺失，不是几何变异；也不伪造资产夹具。
- 新增失败码 / 负例类型必须 STOP + HITL；不得自由扩展闭集。

### 4. 预期 Coverage / Summary（Q4）

| 夹具结果类别 | 受影响分项 | 预期分项状态 | 预期 summary |
| --- | --- | --- | --- |
| 正例全部通过 | 全部 | `checked` | `all-checked` |
| missing-evidence（`atlas-missing` / `probe-not-run`） | 受影响分项 | `partial` | `partial` |
| geometry-mismatch（其余 9 个负例） | 受影响分项 | 不得 `checked`（`partial`） | `untrusted` |
| environment / nondeterministic | 无法确认的分项 | `partial` | `partial` |

两条冻结约束：

1. 一个分项**不能**因为其他夹具通过，就忽略自身负例；负例必须逐分项对齐。
2. 负例**不能**通过改变 summary 的聚合方式出现虚假 `checked`；`checked` 只能来自该分项全部 required rows 通过 + 独立复核。

### 5. 存储与变异（Q5）

```text
.scratch/level-playability-v1.1-i03/
└── evidence/
    └── geometry-probe/
        ├── fixtures/
        │   ├── last-train-v4/
        │   └── negative/
        │       ├── atlas-missing/
        │       ├── frame-missing/
        │       ├── frame-size-mismatch/
        │       ├── anchor-mismatch/
        │       ├── trimmed/
        │       ├── rotated/
        │       ├── atlas-hash-mismatch/
        │       ├── body-size-mismatch/
        │       ├── body-offset-mismatch/
        │       └── graph-solid-mismatch/
        └── ...
```

- 每份副本记录：输入 hash、变异说明、产物 hash。
- 原始产品 fixture 只读；probe 只读夹具，**不允许运行期间修补 / 覆盖夹具**。
- 变异副本必须能从冻结基底 + 记录的变异**确定性重建**；不得手工编辑最终证据后宣称通过。

### 6. 三条额外验收约束

1. **正例完整性**：正例清单先冻结；probe 实现后不得删减失败对象，也不得反向挑选容易通过的样本。
2. **负例隔离性**：每个负例只改变一个主要变量；多变量错误会破坏失败码归因。
3. **变异可复现性**：同一基底 + 同一变异 ⇒ 相同语义内容与 hash；不得直接手工编辑最终证据。

### 7. 边界

- 不授权 probe / 夹具实现；不修改 `fixtures/packs/**` / 产品 fixture / Runtime / `profile.ts` / `graph.ts`。
- 不开放 `PUBLIC_NB` / `PUBLIC_PU`；不改变 publish rejection。
- 全部进入 I-03 授权包；I03-09 组装时必须把 §1–§6 写入几何 probe 夹具章节。
- 正例矩阵 / 负例矩阵 / 预期结果只是**设计**，不是已实现的 probe。

### 8. 下游

- **I03-03B2**：冻结逐行 fixture manifest（每个 frame / body 的 expected 值、hash、变异配方）。
- **I03-03C**：冻结独立复核清单；最终 `checked` 的必要条件。
- **I03-04 / I03-05**：等待 B2 / C 完成后再判定几何准入。
- **I03-06**：可并行，不依赖夹具实现。
- **I03-07 / I03-08 / I03-09**：白名单、验收矩阵、授权包组装。
