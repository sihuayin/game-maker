# 02. Stage A · 理解层单跑（create，不带 --yes）

Type: task
Status: resolved
Owner: main session · 2026-10-22
Blocked by: 01
Map: ../map.md

## Question

在 Stage A 预算获批后，跑理解层：`create` 不带 `--yes`，到清单为止停下。
产出：run 目录、recipe、`imageCalls` 精确数、drawlist 数、ambiguity、ledger（文本 usage）。

## 边界

- 只跑 `create`；零生图调用。
- 任何失败（契约 / frames / import / 上游）⇒ 保存现场、停；不自动重试 / 不换模型。
- 不提交、不推送。

## Answer（Stage A 失败 · 2026-10-22）

**结果：exit 4，停在 `recipe`（`plan-assets`）。未进入 Stage B，零生图调用。**

### 命令与结果

```bash
node packages/cli/dist/cli.mjs create \
  --style fixtures/e2e/wasteland-platformer/style.png \
  --intent fixtures/e2e/wasteland-platformer/intent.md \
  --out .scratch/p0-final-v1/runs/2026-10-22-real --json
```

- 退出码 **4**；五步进度全部打出（`visual-world` / `intent` / `design` / `character-dna` / `recipe`）。
- 失败现场：`.scratch/p0-final-v1/runs/2026-10-22-real/.failed-2026-10-22T08-18-36-700Z/`。
- 已产出：`visual-world.json`（16 色）、`game-intent.json`、`game-design.json`（2 关 / 1 敌人 / 1 资源）、
  `character-dna.json`（2 角色）、`intent.md`、`style.png`。**没有 recipe。**

### 错误原文

> 工具被调了，但入参是空的或用不了（拿到 object）—— ⚠️ 票 27 第 1 发实测过这一档：上游烧了 1135 个输出 token，入参没了。**这不是模型不听话、也不是坏 JSON**，是数据丢了。

### 账（异常携带）

| step | attempts | failures | model | usage | ms |
|---|---|---|---|---|---|
| `plan-assets` | **3** | `empty-input` ×3 | **deepseek-flash** | 217 in / 2461 out | 30240 |

- 生图调用：**0**；生图费用：**$0**。
- Stage A 请求数：失败那一发 3 次往返 + 前四步各至少 1 发 ⇒ 约 **7**，在 ≤15 内。
- 墙钟：约 **90 s**，在 15 分钟内。

### 诊断观察（E1，未修）

1. **模型名漂移**：`planAssets` 的请求体写的是 `deepseek-v4-pro`，账上回报的模型是 **`deepseek-flash`**。
   文本上游是 `cc-switch`（`127.0.0.1:15721`）；日志显示转发到
   `https://api.deepseek.com/anthropic/v1/messages`，`model=deepseek-flash`。
2. **系统性而非偶发**：同一发 **3/3** 都是 `empty-input`；不是 schema / 内容校验失败，是工具入参丢失。
   与票 27 记的「上游烧了输出 token、入参没了」同一档。
3. **账不完整（真实诊断缺口）**：前四步的 ledger 在 `runUnderstanding` 的局部数组里，
   失败时**没有挂到异常上、也没有 run ledger 可落盘**（`writeRunLedger` 只在成功后写）。
   ⇒ 异常里只有 `plan-assets` 一发；CLI 自身的前四步消耗**未记录**。本轮不修。
   > **2026-10-22 补记（cc-switch 上游日志对账）**：`proxy_request_logs` 里 Stage A 窗口内
   > `request_model=deepseek-v4-pro` 共 **7 发**，合计 **14,835 in / 11,830 out**、费用 **$0.018797**；
   > 最后一发 217/2461 与异常账逐字吻合。⇒ 实际文本花费约 **$0.019**，CLI 的 ledger 缺口仍在。
4. 生图代理 `9098→7890` 只在运行前验证过连通（免费 403 = 已到 Google），**没有生图请求**。

### 处置选项（需你裁定）

- **A. 原样重试一次 Stage A**：新授权 ≤15 文本请求、0 生图、15 分钟。风险：3/3 已系统性失败，盲重试大概率重复。
- **B. 先修文本上游**：在 `cc-switch` 里换到能可靠返回强制工具调用的模型 / 提供方，再重跑 Stage A。
  这是**你的账号侧操作**，不动仓库、不动 `game-maker.local.json`；零付费预检可先做。
- **C. 接受阻塞**：P0-FINAL 记为未完成；P0 维持「非 E2E 12/12；`CAP-E2E-01` 未完成」。
  最小补充条件 = 一个能稳定返回 `emit_asset_recipe` 工具入参的文本上游。

➡️ **建议 B**：3/3 同档失败更像上游/模型能力问题，不是网络抖动；先修上游再花第二次理解层的钱。
若你更想快速验证是否偶发，再选 A（我会记为一次新的、显式的重试，不隐藏）。

### 边界

- 未自动重试、未换模型、未改代码 / 契约 / config、未进入 Stage B、未提交 / 未推送。
- 临时代理进程已停止（pid 已记录在 `preflight/proxy.pid`）。

## Answer（Stage A 重跑 · 2026-10-22 · R12 拒绝）

**结果：exit 4，卡在 `compile-design` 的 R12。文本上游已修复，这是新的语义阻塞。**

### 命令与结果

```bash
node packages/cli/dist/cli.mjs create \
  --style fixtures/e2e/wasteland-platformer/style.png \
  --intent fixtures/e2e/wasteland-platformer/intent.md \
  --out .scratch/p0-final-v1/runs/2026-10-22-stage-a-rerun --json
```

- 进度：`visual-world` ✓ → `intent` ✓ → `design` ✗。3 步全 HTTP 200、`model=deepseek-v4-pro`、零 `empty-input`。
- 拒绝：R12 `intent-mechanic-missing` ×2 —— 意图机制「开启宝箱」（`open-chest`）「躲避危险」（`avoid-danger`）
  在设计层没有对家（外壳封闭机制仅 `run/jump/gravity/collide-terrain/collect-pickup/moving-platform/hazard-contact/reach-goal`）。
- 现场：`.scratch/p0-final-v1/runs/2026-10-22-stage-a-rerun/.failed-2026-10-22T14-45-55-457Z/`
  （含 `design-attempts.json` / `game-intent.json` / `visual-world.json`）。

### 账（重跑）

| step | attempts | model | usage | 费用 |
|---|---|---|---|---|
| visual-world | 1 | deepseek-v4-pro | 2632/1838 | $0.0029952 |
| intent | 1 | deepseek-v4-pro | 3198/639 | $0.0017262 |
| compile-design | 1 | deepseek-v4-pro | 4784/1041 | $0.0026844 |
| **合计** | | | | **$0.0074058** |

### 结论

- **文本上游已修复**（`text-upstream-v1` 收口），`empty-input` 不再复现。
- **新阻塞 = R12**：意图 fixture 要的「宝箱 / 躲避危险」超出外壳能表达的机制，R12 在生图前正确拒绝（不悄悄做丢）。
- **最终裁定（用户 2026-10-22 · 选 A）**：记作 P0-FINAL 的真实阻塞；不重试、不换 provider 掩盖；
  flash vs v4-pro 差异留待后续只读调查。

## 收尾（2026-10-24）

本票 resolve：Stage A 两次失败，真实阻塞 = R12 `intent-mechanic-missing`。结论见 [04](04-verdict.md)。
