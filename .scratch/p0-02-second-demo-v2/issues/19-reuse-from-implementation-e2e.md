# 复用路径实施与零付费 E2E

Type: task
Status: resolved
Blocked by: （无）

## Question

按票 18 的裁定，实施 `reuseFrom` 生产路径并完成零付费 `build → site → delivery` E2E。

### 最低不变量

1. **先红**：
   - `packAssets` 没有 `reuseFrom` 选项；
   - CLI `build` / `pack` 不认识 `--reuse-from`；
   - 现有测试无法证明复用时不调用 text/image。
2. **实施**：
   - `PackOptions` 增加可选 `reuseFrom`，透传给 `buildAssetPack`；
   - `BuildInput` 增加可选 `reuseFrom`，`runBuild` 传给 `packAssets`；
   - `build` 与 `pack` CLI 接受 `--reuse-from <packDir>`，并透传；
   - 身份护栏：`<packDir>/manifest.json` 必须存在且 `id === recipe.id`；版本可不同；缺失/不符 → exit 4，禁止生成；
   - 不改公共 schema、不扩 MCP、不加依赖。
3. **测试**：
   - 复用时注入「调用即抛」的 text/image 生成器，证明零调用；
   - 缺 drawlist/generated 文件 → 抛；
   - 源 manifest 缺失 / id 不匹配 → exit 4；
   - `build` / `pack` CLI 的 flag 解析与透传；
   - 现有 `pack-reuse-threshold` 等测试不回归。
4. **零付费 E2E**：
   - 独立副本；本地 fail-closed text/image stub（记录请求、返回 503）；
   - `build <副本>/run/v1 --reuse-from <冻结 pack/v1> --out <副本根>`；
   - 期望：pack v2 / config / QA / site / delivery 完成；ledger 无调用；stub 无 POST；
   - 记录命令、cwd、退出码、耗时、身份（pack/site/config/shell）、delivery checks/verdict、失败现场（若有）；
   - 冻结快照/旧 work/历史零改动；零付费。
5. **回归**：目标测试 + `pnpm test` + `pnpm typecheck`；不修改历史。
6. **边界**：阶段 B 仍 BLOCKED；本票不授权任何付费调用或生图。

### 产物

代码 + 测试 + `research/19-reuse-from-e2e.md` + 本 effort `runs/19-*`。未获票 18 批准前不开工。

## Answer

**2026-10-30 实施收口；E2E 在 config 编译处被阻塞。** 证据：[research/19-reuse-from-e2e.md](../research/19-reuse-from-e2e.md)。

- `reuseFrom` 已接入 `PackOptions` / `BuildInput` / `runBuild` / `buildAndSite` / `build` / `pack`；源包 manifest 必须 `id === recipe.id`，否则 exit 4。
- 测试：packAssets 零调用 + id/缺 manifest 负例 7 tests、CLI flag 1 test；全量 `pnpm test` **156 文件 / 2283 tests** 全绿；`pnpm typecheck` exit 0。
- 零付费 E2E：主资产 reuseFrom 成功（pack v2 生成，0 上游请求）；母版需 import + 按 24×32 重采样（诊断变体）；随后 config 编译调用 `compileRuntime`，1 次文本请求被 stub 503，build exit 3，**零付费**。
- 根因：`runBuild` 总会重新编译 config；没有 config 复用选项。
- 下一步：[零付费 build：复用已有 config](../issues/20-zero-paid-build-config-reuse.md)（HITL）。
