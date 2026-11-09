# I01-03 逐帧几何判据与负例矩阵

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I01-03](../issues/03-i01-03-frame-geometry-predicate.md) |
| 依据 | [I01-02 可信输入契约](02-trusted-input-contract.md)；[`移动-I01-需求.md`](../../../docs/v7.8/移动-I01-需求.md) §2.1/§2.3 |
| 性质 | **判据冻结，不是实施授权**；授权在 [I01-R1](../issues/08-i01-r1-authorization.md) |
| 修改产品目录 | **否** |

## 0. 结论摘要

- **判据**：每个被引用帧必须同时满足：帧存在；`sourceSize` 精确等于 `asset.size`；`anchor` 存在且在 `1e-9` 容差内等于 `asset.anchor`；`rotated === false`；`trimmed === false`。
- **schema 优先**：`AtlasJson.safeParse` 先跑；schema 拒绝 ⇒ `atlas-json-invalid`，不进入帧级检查。
- **schema 默认值是契约**：`rotated` / `trimmed` 缺失按 `false` 通过；只有显式 `true` 报 unsupported。
- **失败闭集 10 个**（I01-02 的 8 个 + 本票新增 2 个）。
- **全有或全无**：任一失败 ⇒ 整份 `TrustedAtlasInput` 不可消费。
- **真实语料**：`last-train/v2` 9 个资产、14 个动画帧全部通过；player anchor 固定为 `{0.5, 0.95}`。

## 1. 决策表

| 问题 | 裁定 | 冻结内容 |
| --- | --- | --- |
| Q1 anchor 相等 | A | 容差 `1e-9`，独立具名常量 `ANCHOR_EQUAL_EPSILON` |
| Q2 rotated / trimmed | A | 非 `false` ⇒ IE；新增两个 code |
| Q3 多帧 `sourceSize` | A | 每个被引用帧都必须是 `asset.size` |
| Q4 幽灵帧 / 计数 | A | 不纳入本票判据 |
| Q5 `files[]` 重复路径 | A | 相同 checksum 去重；冲突或缺失失败 |
| Q6 跨资产同名帧 | A | 按 `(assetId, frameName)` 分别验证 |
| Q7 失败累积 | A | 全量、去重、稳定排序 |
| Q8 schema 边界 | A | schema 优先；默认值是契约 |

## 2. 失败 code 闭集（10）

```ts
type TemporalInputFailureCode =
  | "atlas-file-missing"
  | "atlas-checksum-mismatch"
  | "atlas-json-invalid"
  | "frame-missing"
  | "frame-source-size-mismatch"
  | "frame-anchor-missing"
  | "frame-anchor-mismatch"
  | "asset-unverified"
  | "frame-rotated-unsupported"
  | "frame-trimmed-unsupported";
```

这仍是**内部结果类型**，不是 `ConfigIssue.code`；不触碰持久化契约。

## 3. 判据边界（Q8）

**先 schema，后帧级判据。** Schema 拒绝的 Atlas JSON 不进入几何检查。

| 输入情况 | 阶段 | 结果 |
| --- | --- | --- |
| `rotated` 缺失 | schema 默认 `false` | 通过该项 |
| `trimmed` 缺失 | schema 默认 `false` | 通过该项 |
| `rotated: true` | 帧级 | `frame-rotated-unsupported` |
| `trimmed: true` | 帧级 | `frame-trimmed-unsupported` |
| `rotated` / `trimmed` 类型非法 | schema | `atlas-json-invalid` |
| `sourceSize` 缺失或结构非法 | schema | `atlas-json-invalid` |
| `sourceSize` 与 `asset.size` 不一致 | 帧级 | `frame-source-size-mismatch` |
| `anchor` 缺失 | 帧级 | `frame-anchor-missing` |
| `anchor` 越界或结构非法 | schema | `atlas-json-invalid` |
| `anchor` 合法但超 `1e-9` | 帧级 | `frame-anchor-mismatch` |
| 帧不存在 | 帧级 | `frame-missing` |
| 资产在 manifest 中找不到 | 范围解析 | `asset-unverified` |

- `.default(false)` 是冻结读契约的一部分；不得把「缺失」单独判为 unsupported。
- 帧级 code **只描述结构合法输入中的几何或能力不匹配**；不得用帧级 code 替代 schema 错误。

## 4. 逐帧真值表

对每个在范围内的 `asset.frames[]` 帧，依次检查：

1. 该帧在对应 atlas 的 `frames` 记录中存在 ⇒ 否则 `frame-missing`。
2. `sourceSize.w === asset.size.w` 且 `sourceSize.h === asset.size.h`（精确整数相等）⇒ 否则 `frame-source-size-mismatch`。
3. `anchor !== undefined` ⇒ 否则 `frame-anchor-missing`。
4. `|anchor.x − asset.anchor.x| ≤ ANCHOR_EQUAL_EPSILON` 且 `|anchor.y − asset.anchor.y| ≤ ANCHOR_EQUAL_EPSILON` ⇒ 否则 `frame-anchor-mismatch`。
5. `rotated === false` ⇒ 否则 `frame-rotated-unsupported`。
6. `trimmed === false` ⇒ 否则 `frame-trimmed-unsupported`。

```ts
const ANCHOR_EQUAL_EPSILON = 1e-9;   // 只用于 anchor 相等；不复用门宽 ε
```

- 该常量与 `acceptance.ts:288-293` 的 `sameAnchor` 同口径；文档注明来源。
- 不允许用 `FALLBACK_ANCHOR` 补齐缺失 anchor。

## 5. Atlas 文件绑定

1. 按 `atlases[].meta` 确定 JSON 路径；同一路径只处理一次。
2. 在 `manifest.files[]` 中查该路径：
   - 缺失 ⇒ `atlas-file-missing`；
   - 重复且 checksum 相同 ⇒ 合并为一条；
   - 重复且 checksum 不同 ⇒ `atlas-checksum-mismatch`。
3. `digest(bytes) === files[].checksum` ⇒ 否则 `atlas-checksum-mismatch`（detail 带期望 / 实际字节数）。
4. `AtlasJson.safeParse(JSON.parse(bytes))` ⇒ 失败一律 `atlas-json-invalid`。
5. **同一份 bytes** 用于 digest 与解析；函数不二次读盘。
6. `AtlasEntry.checksum` 是 PNG 的 sha256，**不得**用于 JSON 校验。

`PackPath` 已禁止绝对路径、`..`、空段与非 POSIX 字符（`assetpack.ts:62-66`）；读取器按包根 join 即可，不额外自造路径规则。

## 6. 身份与范围

- 验证键：`(assetId, frameName)`。
- 跨资产同名帧**允许**：分别验证；若两个资产的 `size` 不同，其中一个自然因 `sourceSize` 不符失败。
- 单资产内部帧名重复仍由 `assetpack.ts` 的 schema 拒绝。
- **幽灵帧**（不属于任何资产的帧）不产生失败。
- `Object.keys(atlas.frames).length` 与 `atlases[].frames` 不符**不**产生失败；那是 acceptance 的整洁性判据。

## 7. 失败累积

- 遍历所有可检查目标，不首错即停。
- 去重键：`(code, atlasPath, assetId, frameName)`。
- 按同一键稳定排序；不依赖对象属性遍历顺序。
- 失败结果**不包含**任何可供时序分析消费的几何。

## 8. 负例矩阵

| 层 | 负例 | 预期 |
| --- | --- | --- |
| 文件绑定 | 路径不在 `files[]` | `atlas-file-missing` |
| 文件绑定 | checksum 不同 | `atlas-checksum-mismatch` |
| 文件绑定 | 重复路径冲突 | `atlas-checksum-mismatch` |
| 文件绑定 | 同一路径重复且相同 | 去重，不失败 |
| JSON | 非法 JSON | `atlas-json-invalid` |
| JSON | schema 拒绝（`sourceSize` 缺失 / `rotated` 类型非法 / `anchor` 越界） | `atlas-json-invalid` |
| JSON | `rotated` / `trimmed` 缺失 | 按 `false` 通过 |
| 帧 | 引用帧不存在 | `frame-missing` |
| 几何 | `sourceSize` 不等 | `frame-source-size-mismatch` |
| 几何 | `anchor` 缺失 | `frame-anchor-missing` |
| 几何 | `anchor` 超 `1e-9` | `frame-anchor-mismatch` |
| 几何 | `rotated: true` | `frame-rotated-unsupported` |
| 几何 | `trimmed: true` | `frame-trimmed-unsupported` |
| 身份 | 资产在 manifest 中找不到 | `asset-unverified` |
| 累积 | 多个资产同时失败 | 全量、去重、稳定排序 |
| 身份 | 跨资产同名帧 | 分别验证，不因重名失败 |
| 范围 | 无关幽灵帧 / 计数不符 | 不产生本票失败 |
| 正向 | `last-train/v2` 9 资产 / 14 帧 | 全部通过；player anchor `{0.5, 0.95}` |

## 9. TOCTOU

- 判据函数只接收一次 `bytes`；digest 与解析消费同一对象，不二次读盘。
- 可执行证明（读取一次、替换后不影响已持有字节）归 [I01-06](../issues/06-i01-06-test-matrix.md)；本票只冻结「不得二次读盘」这一约束。

## 10. 边界

**包含**：逐帧判据、schema 边界、失败闭集、文件绑定、身份规则、累积排序、负例矩阵。

**不包含**：I-02 时序算法、I-03 coverage、`atlas-json.ts` 修改、`ConfigIssue.code`、acceptance 行为、既有测试断言、新依赖。

## 11. 停止条件

- 需要修改 `atlas-json.ts` / `assetpack.ts` 或任何白名单外文件；
- 需要 schema 之外的原始键检查；
- 需要修改既有测试文件或断言；
- 真实语料出现系统性误判且无法在不改契约的前提下区分。

## 12. 事实来源

- `AtlasFrame` schema（`rotated` / `trimmed` 默认、`anchor` 可选、`sourceSize` 必填）：`packages/contracts/src/atlas-json.ts:28-48`。
- `sameAnchor` 容差：`packages/assets/src/acceptance.ts:288-293`。
- `sourceSize` 无条件比对：`packages/assets/src/acceptance.ts:306`。
- `PackPath`：`packages/contracts/src/assetpack.ts:62-66`。
- `buildAtlas` 写 `rotated/trimmed = false`：`packages/assets/src/atlas.ts:79-80`。
- manifest `size` 取第 0 帧：`packages/assets/src/pack.ts:1216-1218`。
