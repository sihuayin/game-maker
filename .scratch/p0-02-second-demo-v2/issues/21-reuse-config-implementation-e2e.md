# config 复用实施与零付费 E2E

Type: task
Status: resolved
Blocked by: （无）

## Question

按票 20 的裁定，实施 `--reuse-config` 并完成零付费 `pack v2 → config 复用 → QA → site → delivery` E2E。

### 最低不变量

1. **先红**：
   - `BuildInput` 没有 `reuseConfig`；`build` CLI 不认识 `--reuse-config`；
   - 现有 build 在 config 阶段总会调用 `compileRuntime`（文本上游）。
2. **实施**：
   - `BuildInput` 增加可选 `reuseConfig`；`runBuild` 在 pack 完成后、config 编译前读取；
   - 解析：`parseGameConfig` 必须成功；`auditReferences(config, 新 pack manifest)` 必须无 error；
   - 失败 → `CommandError("invalid")`（exit 4），不跑 QA/site、不写 delivery；
   - 成功 → 跳过 `compileRuntime`，原子写入 `run/vN/game-config.json`，继续 QA/site/delivery；
   - CLI `build <runDir> --reuse-config <game-config.json>`（路径按 cwd 解析）；`pack` 不加；
   - 不改公共 schema、不扩 MCP、不加依赖。
3. **测试**：
   - config 解析失败 → exit 4；asset reference error → exit 4；不产生 QA/site/delivery；
   - 复用成功时不调用文本上游（注入会抛的 transport/fetch）；
   - CLI flag 解析与透传；
   - 现有 build/QA/site 测试不回归。
4. **零付费 E2E**：
   - 独立副本；本地 fail-closed text/image stub；
   - `build <副本>/run/v1 --reuse-from <冻结 pack/v1> --reuse-config <副本>/run/v1/game-config.json --out <副本根>`；
   - 期望：pack v2 → config 复用 → QA → site → delivery 全链完成；ledger 无调用；stub **无 POST**；
   - 记录命令、cwd、退出码、耗时、身份、delivery checks/verdict、历史零改动；零付费。
5. **回归**：目标测试 + `pnpm test` + `pnpm typecheck`；不改历史。
6. **边界**：阶段 B 仍 BLOCKED；本票不授权付费/生图。

### 产物

代码 + 测试 + `research/21-reuse-config-e2e.md` + 本 effort `runs/21-*`。未获票 20 批准前不开工。

## Answer

**2026-10-30 实施收口；零付费 E2E 通过。** 证据：[research/21-reuse-config-e2e.md](../research/21-reuse-config-e2e.md)。

- `BuildInput.reuseConfig` + `build --reuse-config` 落地；pack 后读取，`parseGameConfig` + `auditReferences` 校验，失败 exit 4 不跑 QA/site；成功跳过 `compileRuntime` 并原子写入 run config。
- 测试：`parseReusedConfig` 正例/坏 schema/缺 asset 引用、CLI flag；全量 `pnpm test` **156 文件 / 2284 tests** 全绿；`pnpm typecheck` exit 0。
- 零付费 E2E：独立副本 + fail-closed stub；**exit 0 / 6s / stub 0 POST**；`pack v3 → config 复用（sha 455d…）→ QA 7/7 pass → site v3 → delivery incomplete`（build 段按预期）。
- 历史：旧 work / 冻结快照 / 阶段 A freeze 哈希未变；零付费、未提交。
- 限制：母版为票 19 诊断变体（import + 重采样）；config 为复用，不是重新生成；阶段 B 仍 BLOCKED。
- 下一步：[阶段 B 启动裁定（dry-run 后）](../issues/22-stage-b-gate-after-dry-run.md)（HITL）。
