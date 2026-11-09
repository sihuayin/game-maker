# I01-03 逐帧几何判据与负例矩阵

Type: grilling
Status: resolved
Owner: amber
Blocked by: —
Map: ../map.md
Class: I-01 / DECISION

## Question

把 Q12=A 落成可执行的逐帧几何判据，并给出一组会让它变红的负例。

### 必须裁定

1. **判据真值表**：对每个「被引用帧」：
   - 帧必须存在于对应 atlas JSON；
   - `sourceSize.w == asset.size.w` 且 `sourceSize.h == asset.size.h`；
   - `anchor` 必须存在；
   - `anchor.x == asset.anchor.x` 且 `anchor.y == asset.anchor.y`（精确相等还是有容差？I-00 只给了 `ε` 用于门宽，不用于几何相等）。
   任一不满足 ⇒ 该资产不可信 ⇒ 时序入口返回 `INSUFFICIENT_EVIDENCE`。
2. **验证范围（已由 [I01-02](02-i01-02-trusted-input-contract.md) 裁定）**：`config.player.asset` + 配置引用的 `hazard` / `pickup` / `goal` 资产；排除 background / UI / decor / 未引用资产。本票不再重开范围，只把范围落成可执行的帧清单。
3. **checksum 绑定（已由 [I01-02](02-i01-02-trusted-input-contract.md) 裁定）**：JSON 字节绑定 `files[]` 中 `atlases[].meta` 那一条；`AtlasEntry.checksum` 是 PNG 的 sha256，**不得**拿来校验 JSON。本票只需写清多张 atlas 共用同一 JSON 时的去重与失败口径。
4. **多帧尺寸不一致**：manifest `size` 只取第 0 帧（`pack.ts:1216-1218`）。若第 1..n 帧 `sourceSize` 与 `asset.size` 不同，按 Q12=A 一律 IE；确认这是否会误伤合法包（用现有语料取证）。
5. **边界**：缺帧、幽灵帧、重复帧名、帧名跨资产重复、`meta` 路径逃逸（`../`）、JSON 顶层多余字段。
6. **负例矩阵**：至少覆盖需求 §2.3 的六类，每条写清输入、期望结果、证据落点。

### 产出

`../evidence/03-frame-geometry-predicate.md`，含真值表与负例矩阵。**不修改任何生产文件。**

### 停止条件

- 现有语料中合法的多帧资源会因 Q12=A 被系统性误判，且无法在不改 I-00 契约的前提下区分；
- 需要修改 `assetpack.ts` / `atlas-json.ts` 等白名单外文件。

## Answer

判据与负例矩阵：[`evidence/03-frame-geometry-predicate.md`](../evidence/03-frame-geometry-predicate.md)。

- **Q1–Q8 全部 A**。
- 每帧判据：帧存在；`sourceSize` 精确等于 `asset.size`；`anchor` 存在且在 `1e-9` 容差内等于 `asset.anchor`（`ANCHOR_EQUAL_EPSILON`，不复用门宽 `ε`）；`rotated === false`；`trimmed === false`。
- **schema 优先**：任何 schema 拒绝 ⇒ `atlas-json-invalid`；帧级 code 只处理结构合法输入。`rotated` / `trimmed` 缺失按冻结默认 `false` 通过；只有显式 `true` 才报 unsupported。
- **失败闭集 10 个**：新增 `frame-rotated-unsupported`、`frame-trimmed-unsupported`。
- **文件绑定**：`files[]` 按路径去重；相同 checksum 合并，冲突报 `atlas-checksum-mismatch`，缺失报 `atlas-file-missing`；JSON 的 digest 只认 `files[]`，`AtlasEntry.checksum` 是 PNG。
- **身份**：键为 `(assetId, frameName)`；跨资产同名帧分别验证；幽灵帧与 atlas 帧计数不纳入本票。
- **累积**：全量、按 `(code, atlasPath, assetId, frameName)` 去重并稳定排序；失败结果不含可消费几何。
- 真实语料：`last-train/v2` 9 资产 / 14 帧全部通过；player anchor 固定 `{0.5, 0.95}`。
- 不修改 `atlas-json.ts` / `assetpack.ts` / `acceptance.ts` / 既有测试；不构成实施授权。
