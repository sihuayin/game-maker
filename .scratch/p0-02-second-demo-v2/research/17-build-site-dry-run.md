# 票 17 · 零付费 buildAndSite dry run 证据

- 日期：2026-10-30
- 票：[零付费 buildAndSite 壳级 dry run](../issues/17-zero-paid-build-site-dry-run.md)
- 结论：**dry run 已尝试，但零付费 buildAndSite 无法完成** —— `build` 会重新生成资产；所有上游请求被本地 fail-closed stub 以 503 拒绝，零付费、零真实 provider 调用。需要复用路径（新票 18）才能继续。

## 1. 环境与护栏

- 原始环境检测到 `ANTHROPIC_BASE_URL=http://127.0.0.1:15721`（本地代理，正是要避开的路径）；token 存在但未回显。
- 本次运行用本地 stub 覆盖 text 与 image：
  - text：`ANTHROPIC_BASE_URL=http://127.0.0.1:18766`、`ANTHROPIC_AUTH_TOKEN=stub`
  - image：`GAME_MAKER_IMAGE_BASE_URL=http://127.0.0.1:18766`、`GAME_MAKER_IMAGE_API_KEY=stub`、`GAME_MAKER_IMAGE_PROTOCOL=openai`
  - CLI 提示 `环境变量与 game-maker.local.json 同时存在 —— 以环境变量为准`。
- stub：`.scratch/p0-02-second-demo-v2/tools/zero-paid-stub.mjs`，记录请求（不记录 auth）并返回 503。
- 实际 provider/endpoint：**没有任何真实 provider 被调用**；所有请求都到 `http://127.0.0.1:18766`。

## 2. 运行

独立副本：`work/ticket17-dry-run/wasteland-scavenger-recipe/`

```
node packages/cli/dist/cli.mjs build \
  .scratch/p0-02-second-demo-v2/work/ticket17-dry-run/wasteland-scavenger-recipe/run/v1 \
  --out .scratch/p0-02-second-demo-v2/work/ticket17-dry-run
```

- 退出码 **1**；耗时 **1s**；日志 `runs/ticket17-build.log`。
- 失败：`资产 "scavenger-hero" 的母版 "master-scavenger-hero" 没造出来（上游返回 HTTP 503…）`；失败即止。
- 失败现场：`…/wasteland-scavenger-recipe/failed-2026-10-30T05-12-23-196Z/`（`ledger.json`、`authoring/visual-world.json`）。

## 3. 上游尝试（全部 503，零付费）

`runs/ticket17-upstream-attempts.jsonl`：

| 请求 | 次数 |
|---|---|
| `GET /health`（连通性自检） | 1 |
| `POST /images/edits` | 15 |
| `POST /v1/messages` | 8 |
| **合计** | **24** |

- 全部返回 `503 zero-paid dry run: upstream access refused`。
- 没有发往官方 Gemini/OpenAI 或任何付费端点；没有使用真实密钥。
- ledger 记录的 7 次调用是**发往 stub 的尝试**，不是已付费调用。

## 4. 为什么不能零付费完成

- `build` 的 `packAssets` 总会重新生成资源：
  - 6 个 `source.kind="image"` 资产 → 生图；
  - 2 个 `source.kind="drawlist"` 资产 → 文本生成 drawlist。
- 代码里已有 `pack.ts` 的 `reuseFrom`（复用已有 drawlist/generated，零文本/生图调用），但 **`packAssets` 与 CLI `build` 没有暴露它**。
- 主资产 `source` 只实现 `image` / `drawlist`；`import` 仅用于 `authoring` 母版，不能直接用来构造一个全 import 的新 Demo。
- 因此：冻结副本 + 现有资源无法在现有壳级命令下完成零付费 buildAndSite。

## 5. 历史与零付费

- 独立副本；冻结快照/旧 work/阶段 A freeze 哈希全部未变。
- 未调用任何真实上游；未使用真实密钥；零付费。
- 未提交、未推送。

## 6. 下一步

新建 [零付费 buildAndSite：复用已有资源的路径](../issues/18-zero-paid-build-reuse-path.md)（grilling / HITL）：

- (a) 在 `packAssets` 暴露 `reuseFrom`，`build` 增加 `--reuse-from <packDir>`（推荐）；
- (b) 为主资产增加 `import` 支持；
- (c) effort-local 脚本直接调 `buildAssetPack({reuseFrom})` + 手工 site/delivery；
- (d) 保持 blocked。
