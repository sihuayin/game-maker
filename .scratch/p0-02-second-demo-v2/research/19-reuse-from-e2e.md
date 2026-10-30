# 票 19 · 复用路径实施与零付费 E2E 证据

- 日期：2026-10-30
- 票：[复用路径实施与零付费 E2E](../issues/19-reuse-from-implementation-e2e.md)
- 上游裁定：[票 18](../issues/18-zero-paid-build-reuse-path.md) · `rulings-2026-10-29.md` 第 11 节
- 结论：**`reuseFrom` 生产接线与测试完成；零付费 E2E 在 config 编译处被阻塞** —— pack 复用已做到 0 上游调用，但 `runBuild` 总会调用 `compileRuntime`（文本上游）。新增 [config 复用决策票](../issues/20-zero-paid-build-config-reuse.md)。

## 1. 实现

- `PackOptions.reuseFrom`：`packAssets` 校验源包 `manifest.json` 存在且 `id === recipe.id`（版本可不同），缺失/不符 → `CommandError("invalid")`（exit 4，生成前拒绝）；透传给 `buildAssetPack`。
- `BuildInput.reuseFrom`：`runBuild` 透传给 `packAssets`。
- `buildAndSite` / CLI `build`、`pack`：新增 `--reuse-from <packDir>`（`parseArgs` 已登记）。
- 不改公共 schema、不扩 MCP、不加依赖。

## 2. 测试

| 测试 | 结果 |
|---|---|
| `packages/assets/tests/pack-reuse-threshold.test.ts` | 7 tests（新增 packAssets 零调用、id 不符、缺 manifest；原 buildAssetPack 复用不回归） |
| `packages/cli/tests/reuse-from.test.ts` | 1 test（build/pack flag 解析） |
| 全量 `pnpm test` | **156 文件 / 2283 tests** 全绿 |
| `pnpm typecheck` | exit 0 |

## 3. 零付费 E2E 尝试

独立副本：`work/ticket19-reuse-e2e2/`；冻结源：`freeze/.../pack/v1`；本地 fail-closed stub 记录请求并返回 503。

### 3.1 原始冻结 recipe（母版仍为 image）

- `build --reuse-from freeze/pack/v1` 在 pack 阶段调用母版生成：6 次 `POST /images/edits`（2 个母版 × 3 次重试）全部 503；exit 1；零付费。
- 说明：`reuseFrom` 复用 drawlist/generated，但 **authoring 母版**的 `source.kind:"image"` 仍走生成；冻结包已有母版。

### 3.2 母版改为 import（绝对路径）

- recipe schema 拒绝：`authoring[0].source.ref: 必须是相对路径`；0 次上游调用。

### 3.3 母版改为 import（相对路径，原图 896×1200）

- 母版比例校验拒绝：896×1200（0.747）vs canonical 24×32（0.750），差 0.4%；0 次上游调用。

### 3.4 母版按 24×32 重采样 + 相对 import + reuseFrom

- pack 阶段 **成功**：8 个资产全部复用；`outRoot/wasteland-scavenger-recipe/pack/v2` 已生成；上游请求 **0**。
- 随后 `config` 阶段调用 `compileRuntime`：1 次 `POST /v1/messages`（17854 bytes）被 stub 503；build exit **3**；零付费。
- 失败现场：`…/failed-2026-10-30T05-21-58-189Z/`。
- 证据：`runs/ticket19-build-3.log`、`runs/ticket19-upstream-attempts-3.jsonl`。

## 4. 根因

- `runBuild` 在 pack 之后**总是**调用 `compileRuntime` 从 design+pack 重新编译 config（文本上游）。
- `build` 没有「复用已有 config」的选项；冻结 run 里已有 `run/v1/game-config.json`。
- 因此：**零付费 buildAndSite 还差 config 复用**；pack 复用本身已成立。

## 5. 历史与零付费

- 独立副本；冻结快照/旧 work/阶段 A freeze 哈希未变。
- 所有上游请求只到本地 stub；零真实 provider、零付费、未使用真实密钥。
- 未提交、未推送。

## 6. 下一步

[零付费 build：复用已有 config](../issues/20-zero-paid-build-config-reuse.md)（grilling / HITL）：

- (a) `build --reuse-config <game-config.json>`（或同 run 自动复用）跳过 `compileRuntime`，校验 config 的资产 id 都在新 pack 里；
- (b) 扩展 `--reuse-from` 自动复用同 run 的 config；
- (c) replay stub 返回已有 config（会产生 1 次 stub POST，违反票 18 的「stub 无 POST」证据标准）；
- (d) 保持 blocked。
