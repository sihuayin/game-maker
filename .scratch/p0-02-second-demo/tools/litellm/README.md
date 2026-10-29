# P0-02 · LiteLLM 零预算验证模板

> 用途：为票 22「LiteLLM 零预算硬拒绝验证」提供**不含密钥**的部署模板。
> 本模板**不是已实测配置**；LiteLLM 版本/字段可能不同，先做 `max_budget=0` 验证。
> 部署在**仓库外**；不改 `game-maker` 生产代码/历史产物。

## 1. 准备（仓库外）

```bash
cp -R .scratch/p0-02-second-demo/tools/litellm ~/litellm-p0-02
cd ~/litellm-p0-02
cp .env.example .env
# 编辑 .env：POSTGRES_PASSWORD / GEMINI_API_KEY / LITELLM_MASTER_KEY
# ⚠️ .env 不要提交、不要贴到对话
```

## 2. 起服务

```bash
docker compose up -d
curl -sS http://127.0.0.1:4000/health/readiness
```

- 若镜像 tag 或字段不兼容，按实际 LiteLLM 版本调整；记录版本。
- `litellm-config.yaml` 里的模型别名沿用本仓现有名字（`gemini-3.5-flash` / `gemini-3.1-flash-lite-image`），映射到 `gemini/gemini-3.6-flash` / `gemini/gemini-3.1-flash-lite-image`。

## 3. 建 `max_budget=0` 的 virtual key

```bash
curl -sS http://127.0.0.1:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "max_budget": 0,
    "max_parallel_requests": 1,
    "models": ["gemini-3.5-flash", "gemini-3.1-flash-lite-image"]
  }'
```

- 返回的 key 只放在你的本地环境变量 `LITELLM_KEY`，**不要贴到对话**。
- 不设 `budget_duration` = lifetime。
- 验证通过后才把 `max_budget` 改到 6（票 23 重新授权后）。

## 4. 零预算 429 验证

```bash
LITELLM_BASE_URL=http://127.0.0.1:4000 \
LITELLM_KEY=<max_budget=0 的 key> \
./verify-zero-budget.sh
```

脚本会分别打：

- `/v1beta/models/gemini-3.5-flash:generateContent`，`x-goog-api-key`
- `/v1beta/interactions`，`x-goog-api-key`

预期：两者都 **429**（`budget_exceeded` 或等价），且 LiteLLM 日志/上游账单显示**上游零调用**。

### 若结果不是 429

| 结果 | 含义 | 动作 |
|---|---|---|
| 401 | LiteLLM 原生 Gemini 端点不接受 `x-goog-api-key` | **停止**；不要改成 Bearer 后假装仓库路径可用——本仓固定发 `x-goog-api-key`；回到票 20 的兜底方案 |
| 404 | 路径/版本不对 | 查 LiteLLM 版本文档；不要猜路径 |
| 200/201 | 预算未生效或请求被转发 | **停止**；立即报告，检查 key 绑定/预算字段 |
| 429 但上游有调用 | 预算在转发后才拒 | **停止**；不满足“转发前硬拒” |

## 5. 验证通过后（不自动授权）

- 在 LiteLLM 日志/DB 里确认两条路径的上游调用数为 0、花费为 0；
- 把证据（HTTP 状态、响应体脱敏、日志、时间、LiteLLM 版本）交给票 22；
- **不要**自动把 `max_budget` 改成 6；票 23 会重新裁定 $6 与付费生图；
- 后续获批运行才用 `max_budget=6`、`max_parallel_requests=1`，并清除 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`。

## 6. 已知未验证项

1. LiteLLM 原生 Gemini 端点是否接受 `x-goog-api-key`（本仓固定发这个头）；
2. `/v1beta/interactions` 的 image 成本是否进入 per-request 预留；
3. 安装版本的模型别名/`model_info.mode` 字段是否与本模板一致；
4. 本地/上游代理链是否影响计量；
5. LiteLLM 的预留是**估算**，不是 provider 账单的精确值。

任何一项不满足，都不进入 $6 授权；按票 23 保持阻塞或换兜底方案。
