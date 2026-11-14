# I03-03A 几何 probe 证据格式与 hash

Type: grilling
Status: open
Owner: —
Blocked by: 04
Map: ../map.md
Class: I-03 / DECISION

## Question

几何 probe 的**机器可读证据格式**是什么？它必须让 I03-03 的两层证据（构建期 Atlas / PNG + 运行时 Phaser probe）可复跑、可比较、可独立复核，且不把 probe 数字写成公共 API 或 CI 门禁。

### 必须裁定

- JSON schema / version / 顶层字段（命令、环境、夹具 id、几何分项、expected / actual、pass / fail、failure code、raw hash）；
- 构建期与运行时两段的字段如何分列；
- 环境字段（Node / OS / arch / Phaser version / 浏览器 / headless）；
- 逐帧 / 逐 body 比较的字段与单位（box / size / anchor / offset / foot）；
- 失败码闭集（缺 atlas / 缺帧 / anchor 不符 / trimmed / rotated / body size 不符 / body offset 不符 / hash 不符 / probe 未运行）；
- 确定性：相同夹具 / 环境 ⇒ 语义字段逐字节一致；时间戳 / 主机字段排除；
- 原始证据路径、hash 链与退出码；E3 格式；
- 格式如何供 `coverage.geometry` 分项与 NB/PU 准入读取；
- **不新增公共字段 / 依赖 / 持久化 schema；probe 数字不作 CI 门禁**。

### 禁止

- 把 probe 结果写成公共 Verdict / 公共 coverage；
- 用墙钟阈值当通过条件；
- 把未运行 / 不完整比较写成 checked。

### 验收

JSON schema 草案、字段表、失败码闭集、确定性规则、正 / 负例、下游消费点。

## Answer

（resolved 时填写）
