# 零付费 build：复用已有 config

Type: grilling
Status: resolved
Blocked by: 19

## Question

HITL：票 19 已让 pack 阶段零付费复用资产，但 `runBuild` 仍会调用 `compileRuntime` 从 design+pack 重新编译 config（文本上游）。冻结 run 里已有 `run/v1/game-config.json`。请裁定 config 复用路径：

- (a) **显式 `--reuse-config <game-config.json>`**：`build` 接受该 flag，跳过 `compileRuntime`，把给定 config 作为本次 run 的 `run/vN/game-config.json`；校验 config 解析为 `game-config/v1`，且其引用的 asset id 都在新 pack manifest 里；不调用文本上游。需要批准 CLI/接口变更。
- (b) **`--reuse-from` 自动复用同 run 的 config**：给了 `--reuse-from` 且 `run/vN/game-config.json` 存在时，自动跳过 config 编译；不新增 flag，但语义把「复用包」扩展到「复用 run」。需要批准。
- (c) **replay stub**：本地 stub 返回已有 config 的文本响应；会产生 1 次 stub POST，违反票 18 的「stub 无 POST」证据标准。
- (d) 保持 blocked，不再推进零付费 buildAndSite。

已知事实（票 19）：

- pack 阶段用 `--reuse-from` 已做到 0 上游请求；母版需 import + 重采样（诊断变体）。
- 冻结 run 的 `game-config.json` 存在；config 引用的 asset id 与新 pack v2 相同。
- `runBuild` 的 config 步骤总会调用 `compileRuntime`；`BuildInput` 没有 config 注入/复用选项。
- 零付费证据标准（票 18）：ledger 无调用、stub 无 POST；不得调用任何付费上游。

约束：

- 不改公共 schema、不扩 MCP、不授权付费服务/生图。
- 不修改冻结快照/旧 work/历史；产物只写独立副本或本 effort。
- 若选 (a)/(b)，需在本票明确批准对应 CLI/接口变更；未批准则退回 (c)/(d)。
- 成功后阶段 B 仍 BLOCKED，需新的 HITL 启动裁定。

## Answer

**2026-10-30 HITL 收口。** 逐字裁定见 [rulings-2026-10-29.md 第 12 节](../rulings-2026-10-29.md)。

### 裁定

| 项 | 决定 |
|---|---|
| Q1 路径 | **(a) 显式 `build --reuse-config <game-config.json>`**；不自动推断 |
| 批准范围 | `BuildInput.reuseConfig` + `build` CLI 的 `--reuse-config` |
| 时序 | pack 完成后、config 编译前读取；跳过 `compileRuntime`；原子写入 `run/vN/game-config.json` |
| 校验 | `parseGameConfig` + `auditReferences(config, 新 pack manifest)`；解析失败或任一 reference error → exit 4，不跑 QA/site、不写 delivery |
| 零付费证据 | ledger 无调用、stub 无 POST；完成 `pack v2 → config 复用 → QA → site → delivery` 全链 |
| Q3 E2E | 只补零付费证据；成功后阶段 B 仍需新的 HITL 启动裁定 |
| 边界 | 不改公共 schema、不扩 MCP、不改冻结快照/旧 work/历史；不授权付费/生图 |

### 下一步

新建 [config 复用实施与零付费 E2E](../issues/21-reuse-config-implementation-e2e.md)（task）。
