# 零付费 buildAndSite：复用已有资源的路径

Type: grilling
Status: resolved
Blocked by: 17

## Question

HITL：票 17 证明 `build` 在冻结副本上会重新生成 image/drawlist，现有壳级命令无法零付费完成 buildAndSite。请裁定复用路径：

- (a) **暴露 `reuseFrom`**：`packAssets` 接受 `reuseFrom` 并传给 `buildAssetPack`；`build` 增加 `--reuse-from <packDir>`（或等价的显式复用开关）；复用已有 drawlist/generated 时不调用文本/生图；补 CLI/生成器测试与零付费 E2E。属于 CLI/接口变更，需要本票批准。
- (b) **为主资产增加 `import` 支持**：扩展 `AssetSource` 与 pack 构建器，使新 Demo 可直接引用已有 PNG；范围更大，涉及契约。
- (c) **effort-local 脚本**：直接调 `buildAssetPack({reuseFrom})`，再手工 site/delivery；不改变生产 CLI，但不算壳级 E2E。
- (d) 保持 blocked，不再推进零付费 buildAndSite。

已知事实（票 17）：

- `pack.ts` 的 `reuseFrom` 已存在：复用 `authoring/drawlist/<frame>.json` 与 `authoring/generated/<...>.png`，缺文件即抛，拒绝重发；复用的图/指令不计入 `imageCalls`/`ledger`。
- `packAssets` 的 `PackOptions` 没有 `reuseFrom`；`build` CLI 没有对应 flag。
- 主资产 `source.kind` 只有 `image` / `drawlist`；`import` 只在 `authoring` 母版分支实现。
- 票 17 的上游尝试全部被本地 stub 拒绝，零付费；冻结证据未变。

约束：

- 不得修改冻结快照/旧 work/历史交付；不得调用任何付费上游。
- 若选 (a)/(b)，需在本票明确批准对应的 CLI/契约变更；未批准则退回不扩接口的备选。
- 零付费 E2E 必须验证 ledger 无真实调用，并记录实际 provider/endpoint（预期不调用）。

## Answer

**2026-10-30 HITL 收口。** 逐字裁定见 [rulings-2026-10-29.md 第 11 节](../rulings-2026-10-29.md)。

### 裁定

| 项 | 决定 |
|---|---|
| Q1 复用路径 | **(a) 暴露现有 `reuseFrom`** |
| 批准范围 | `PackOptions` / `BuildInput` / `packAssets` / `runBuild` + `build` / `pack` CLI 的 `--reuse-from <packDir>` |
| 身份校验 | 源 pack manifest 必须存在且 `id === recipe.id`；版本可不同；缺失/不符 → exit 4，禁止生成 |
| 零付费护栏 | 本地 fail-closed text/image stub；断言 ledger 无调用、stub 无 POST |
| 写入边界 | 只写独立副本或本 effort；不改冻结快照/旧 work/历史 |
| Q3 E2E | 只做零付费 `build → site → delivery`；成功后阶段 B 仍需新的 HITL 启动裁定 |
| 本轮授权 | 仅上述接口/CLI 变更；不改公共 schema、不扩 MCP、不授权付费服务或生图 |

### 下一步

新建 [复用路径实施与零付费 E2E](../issues/19-reuse-from-implementation-e2e.md)（task）。阶段 B 仍 **BLOCKED**。
