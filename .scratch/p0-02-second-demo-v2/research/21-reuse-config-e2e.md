# 票 21 · config 复用实施与零付费 E2E 证据

- 日期：2026-10-30
- 票：[config 复用实施与零付费 E2E](../issues/21-reuse-config-implementation-e2e.md)
- 上游裁定：[票 20](../issues/20-zero-paid-build-config-reuse.md) · `rulings-2026-10-29.md` 第 12 节
- 结论：**`--reuse-config` 落地；零付费 `pack v3 → config 复用 → QA → site → delivery` E2E 通过（exit 0 / 6s / stub 0 POST）**。阶段 B 仍 BLOCKED；需新的 HITL 启动裁定。

## 1. 实现

- `BuildInput.reuseConfig?: string`。
- `runBuild`：pack 完成后、config 编译前读取复用 config；`parseReusedConfig(raw, newPackManifest)`：
  - `parseGameConfig` 必须成功；
  - `auditReferences(config, manifest)` 必须无 error；
  - 失败 → `CommandError("invalid")`（exit 4），不跑 QA/site、不写 delivery；
  - 成功 → 跳过 `compileRuntime`，原子写入 `run/vN/game-config.json`。
- CLI `build --reuse-config <game-config.json>`（路径按 cwd 解析）；`pack` 不加。
- 不改公共 schema、不扩 MCP、不加依赖。

## 2. 测试

| 测试 | 结果 |
|---|---|
| `packages/pipeline/tests/create-game.test.ts` | 新增 `parseReusedConfig` 正例/坏 schema/缺 asset 引用；51 tests |
| `packages/cli/tests/reuse-from.test.ts` | 新增 `--reuse-config` flag 解析 |
| 全量 `pnpm test` | **156 文件 / 2284 tests** 全绿 |
| `pnpm typecheck` | exit 0 |

## 3. 零付费 E2E

独立副本：`work/ticket21-reuse-config-e2e/`（继承票 19 的母版 import + 24×32 重采样诊断变体）。
冻结源：`freeze/.../pack/v1`；复用 config：副本的 `run/v1/game-config.json`。

```
node packages/cli/dist/cli.mjs build \
  .scratch/p0-02-second-demo-v2/work/ticket21-reuse-config-e2e/wasteland-scavenger-recipe/run/v1 \
  --out .scratch/p0-02-second-demo-v2/work/ticket21-reuse-config-e2e \
  --reuse-from .scratch/p0-02-second-demo-v2/freeze/wasteland-scavenger-recipe/pack/v1 \
  --reuse-config .scratch/p0-02-second-demo-v2/work/ticket21-reuse-config-e2e/wasteland-scavenger-recipe/run/v1/game-config.json
```

- 退出码 **0**；耗时 **6s**；日志 `runs/ticket21-build.log`。
- 上游 stub：**0 次 POST**（`runs/ticket21-upstream-attempts.jsonl` 为空）。
- 链路：
  - `pack v3`（8 资源，复用冻结包；0 上游）；
  - `config` 复用：写入的 config sha256 `sha256:455d9c7f…7dcd`，与冻结 config 完全相同；未调用 `compileRuntime`；
  - `QA`：7/7 条跑过、0 error、2 warnings，裁决 pass；
  - `site v3`：三族 + 几何 + HUD 屏幕空间校验全过；
  - `delivery`：`asset-pack/config/qa/site = pass`，`playable-smoke/visual-review = incomplete`，`verdict = incomplete`（build 段按预期；playtest/视觉不在本票范围）。
- 身份：`delivery.pack = wasteland-scavenger-recipe v3`（manifestChecksum `712e213e…5af1`）；`delivery.site = v3 / shell 2`；config file 指向 run/v1。
- 历史：旧 work 95/95、冻结快照 66/66、阶段 A freeze 112/112 哈希未变；零付费；未提交。

## 4. 已知限制

- E2E 的母版是票 19 的诊断变体（import + 24×32 重采样）；生产 `reuseFrom` 目前只复用 drawlist/generated，不自动复用母版。
- E2E 复用已有 config，不是重新生成；这证明壳级 `build → site → delivery` 链路，不等于新 Demo 的完整生成。
- 阶段 B 仍 BLOCKED；预算、硬护栏、付费授权未定。

## 5. 下一步

[阶段 B 启动裁定（零付费 buildAndSite E2E 后）](../issues/22-stage-b-gate-after-dry-run.md)（grilling / HITL）。
