# I01-02 可信输入契约与 brand 机制

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I01-02](../issues/02-i01-02-trusted-input-contract.md) |
| 依据 | [`map.md`](../map.md) Q1–Q12；[I01-01 文件计划](01-file-plan.md)；[`移动-I01-需求.md`](../../../docs/v7.8/移动-I01-需求.md) `sha256:05c6c72a…` |
| 性质 | **决策记录，不是实施授权**；授权在 [I01-R1](../issues/08-i01-r1-authorization.md) |
| 修改产品目录 | **否** |

## 0. 结论摘要

- **全有或全无**：可信输入是一个判别联合；不可信时不携带任何可消费几何。
- **验证范围**：`config.player.asset` + 配置实际引用的 `hazard` / `pickup` / `goal` 资产，且只验这些资产的 `frames[]`。background / UI / decor / 未被引用的资产**不在范围**。
- **一次调用验整包**：按 `atlases[].meta` 路径去重；每份 JSON 的 SHA 来自 `files[]`；哈希与 `AtlasJson.safeParse` 消费**同一份 bytes**。
- **brand**：模块私有 `unique symbol`，唯一生产者是 `verifyTemporalInput`，不导出铸造工厂；运行时守卫拒绝普通对象。
- **digest 注入**：`(bytes: Uint8Array) => string`，返回完整 `sha256:<hex>`；生产只允许 `assets/src/ops.ts` 提供真实实现。
- **失败分类**：闭集 code + 显式 `verified` 表；查不到 = 未验证，不回落默认值；不新增 `ConfigIssue.code`。闭集由 [I01-03](03-frame-geometry-predicate.md) 扩到 **10** 个（新增 rotated / trimmed unsupported）。
- **入口**：`auditPlayabilityTemporal` 只接受 branded 值；没有 geometry / hitbox / body / 尺寸 / 垂直规避参数。
- **Q8**：`verifyTemporalInput` 经 `api.ts` 导出并标 `@internal`；生产调用者由架构测试限制为 `assets/src/ops.ts`。**`@internal` 不是包级访问控制**。

## 1. 决策表

| 问题 | 裁定 | 冻结内容 |
| --- | --- | --- |
| Q1 验证范围 | A | player + 配置引用的 hazard / pickup / goal；排除 background / UI / decor / 未引用资产 |
| Q2 失败表达 | A | 判别联合；不抛异常；不可信时无部分几何 |
| Q3 读取与 checksum | A | 一次调用验全部相关 Atlas；按路径去重；SHA 来自 `files[]` |
| Q4 brand | A | 模块私有 Symbol + `isTrustedAtlasInput`；不导出铸造工厂 |
| Q5 digest | A | 完整 `sha256:<hex>`；生产仅 `assets/src/ops.ts` |
| Q6 失败分类 | A | 闭集 code + 显式 `verified` 表；不动 `ConfigIssue.code` |
| Q7 入口消费 | A | 只认 branded 输入；无几何 / 规避声明通道；伪造对象 ⇒ IE |
| Q8 barrel 矛盾 | A | `api.ts` 导出 + `@internal` 标注 + 架构测试限制调用者；不改白名单 |

## 2. 内部契约

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

type TemporalInputFailure = {
  readonly code: TemporalInputFailureCode;
  readonly atlasPath?: string;
  readonly assetId?: string;
  readonly frameName?: string;
  readonly detail: string;
};

type FrameGeometry = {
  readonly assetId: string;
  readonly atlasId: string;
  readonly frameName: string;
  readonly sourceSize: { readonly w: number; readonly h: number };
  readonly anchor: { readonly x: number; readonly y: number };
};

type VerifiedFile = {
  readonly path: string;
  readonly bytes: number;
  readonly checksum: string;
};

type TrustedAtlasInput = {
  readonly [trustedBrand]: true;              // 模块私有 unique symbol，不导出
  readonly frames: ReadonlyMap<string, FrameGeometry>;  // 键 `assetId/frameName`
  readonly assets: ReadonlySet<string>;
  readonly files: readonly VerifiedFile[];    // 追溯到已校验字节
};

type TemporalInputResult =
  | { readonly ok: true; readonly value: TrustedAtlasInput }
  | { readonly ok: false; readonly failures: readonly TemporalInputFailure[] };

type VerifyTemporalInputInput = {
  readonly manifest: AssetPackManifest;
  /** 调用方从 GameConfig 推导出的资产 id 集合。 */
  readonly assetIds: readonly string[];
  /** 每个相关 Atlas JSON 的路径与字节；按 path 去重。 */
  readonly atlases: readonly { readonly path: string; readonly bytes: Uint8Array }[];
  /** 生产只允许真实 sha256；测试可注入。 */
  readonly digest: (bytes: Uint8Array) => string;
};

declare function verifyTemporalInput(input: VerifyTemporalInputInput): TemporalInputResult;
declare function isTrustedAtlasInput(x: unknown): x is TrustedAtlasInput;
```

- 失败**累积返回**，不是首错即停。
- `verified` 表以 `(assetId, frameName)` 为键；缺失 = 未验证，**不允许默认值补齐**。
- `assetIds` 中某个资产在 manifest 里找不到 ⇒ `asset-unverified`。
- 范围资产引用的 atlas 未出现在 `atlases` 入参 ⇒ `atlas-file-missing`。
- 同一路径重复且字节不同 ⇒ 该路径报 `atlas-checksum-mismatch`。

## 3. 生产路径（单向）

```
packages/assets/src/ops.ts
    │  readFileSync 一次 → createHash("sha256")
    │
    ▼
packages/contracts/src/playability/temporal-input.ts
    │  verifyTemporalInput({ manifest, assetIds, atlases, digest })
    │    ├─ 每个路径：digest(bytes) === files[].checksum
    │    ├─ AtlasJson.safeParse(同一份 bytes)
    │    └─ 逐帧 sourceSize / anchor
    │  → 模块私有 Symbol 铸造 TrustedAtlasInput
    ▼
packages/contracts/src/playability/temporal.ts
    │  auditPlayabilityTemporal(...) 运行时 isTrustedAtlasInput 守卫
    ▼
packages/pipeline（create-game / publish-gate）
```

约束：

- Symbol 与铸造逻辑只在 `temporal-input.ts` 内；**没有** `mintTrustedAtlasInput` 之类的导出。
- `verifyTemporalInput` 经 `api.ts` 导出；文件头标 `@internal`。**它不会阻止其他包 import**——真正限制调用者的是架构测试与代码审查。不得描述为包级访问控制或安全隔离。
- 生产调用者只能是 `packages/assets/src/ops.ts`；测试可直接调用并注入 digest，但不得成为额外生产入口。
- 运行时 brand 是误用防护，**不是同进程内的密码学安全边界**。

## 4. 验证语义

1. **同一份字节**：`digest` 与 `AtlasJson.safeParse` 消费同一个 `bytes` 对象；函数不二次读盘。
2. **checksum 来源**：只认 `manifest.files[]` 中 `atlases[].meta` 路径那一条。`AtlasEntry.checksum` 是 PNG 的 sha256（`pack.ts:1171`），**不得**校验 JSON。
3. **几何判据**（Q12=A）：每个在范围内的 `asset.frames[]` 帧必须存在；`sourceSize == asset.size`；`anchor` 必须存在且 `== asset.anchor`。任一失败 ⇒ 整份输入不可信。
4. **全有或全无**：范围内任一必需帧失败，`TrustedAtlasInput` 不可消费；不存在「部分资产可用」的分支。
5. **排除项**：background / UI / decor / 未被配置引用的资产不进入校验集合；它们失败不影响本输入。

## 5. 伪造声明的证明范围（Q7）

I-01 的测试只能证明以下五条，**不能**声称「系统拒绝了一个现存的垂直规避参数」：

1. `auditPlayabilityTemporal` 的签名里没有 geometry / hitbox / body / 尺寸 / 垂直规避声明参数。
2. 普通对象即使包含这些字段，也没有可信 brand。
3. 运行时 `isTrustedAtlasInput` 拒绝该对象。
4. stub 在 brand 校验**之后**执行。
5. 伪造对象不能得到任何确定性时序结论。

当前代码不存在 `verticalEvasionImpossible`；I-02 / I-03 才可能引入调用方声称。本阶段证明的是**不存在调用方直接注入可信几何的通道**。

## 6. 真实语料

- `fixtures/packs/last-train/v2`：9 个资产、14 个动画帧，在 Q12=A 的严格判据下**零不符**；全部帧有 `anchor`，`sourceSize` 与 manifest `size` 一致，帧 anchor 与 `asset.anchor` 一致。
- player 的真实 anchor 是 `{0.5, 0.95}`；**必须保留真实值**，不得替换为 `FALLBACK_ANCHOR`。
- 正向语料通过**不豁免** anchor 缺失、`sourceSize` 不一致等负向测试。
- `fixtures/packs/counter-siege` 没有 `manifest.json`，**不是有效真实包证据**，不得自行补造。

## 7. 边界

**包含**：可信输入判别联合、整包多 Atlas 一次验证、严格逐帧几何、运行时 brand 与守卫、digest 注入与调用者限制、失败分类与负向测试、真实语料与架构证据。

**不包含**：I-02 时序算法、I-03 coverage 集成、公共 API 扩张（除 `api.ts` 的 `@internal` 导出）、持久化 schema、新依赖。

## 8. 停止条件

- 需要修改 `packages/contracts/package.json`、`src/index.ts` 或任何白名单外文件；
- 需要第 5 项公共面加法；
- 需要修改既有测试文件；
- `assets/src/ops.ts` 的实现无法在不越界的前提下完成读取与 SHA-256。

## 9. 事实来源

- `Anchor` schema：`packages/contracts/src/assetpack.ts:73,175`。
- `FALLBACK_ANCHOR`：`packages/contracts/src/game-config.ts:140`。
- `AtlasJson`：`packages/contracts/src/atlas-json.ts:59-62`。
- `AtlasEntry.checksum` 是 PNG sha256：`packages/assets/src/pack.ts:1171`。
- `files[]` 与交叉引用：`packages/contracts/src/assetpack.ts:298-332`。
- frame 源：`packages/contracts/src/playability/profile.ts:51-55`。
- 公开路径：`packages/contracts/src/index.ts:150`。
