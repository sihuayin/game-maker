# I03-03B 几何 probe 固定夹具矩阵

Type: grilling
Status: open
Owner: —
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

（resolved 时填写）
