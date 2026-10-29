# LiteLLM 零预算硬拒绝验证

Type: task
Status: claimed
Blocked by: （无）

## Question

HITL/零付费：在仓库外部署 LiteLLM + Postgres，并验证它能在转发上游之前硬拒：

1. 部署：LiteLLM + Postgres 在仓库外；不改 `game-maker` 生产代码/历史产物；提供 endpoint 主机名（**不传输/输出密钥**）。
2. 配置：`max_budget=0`、`max_parallel_requests=1`；先不设 $6。
3. 用仓库实际请求格式分别验证：
   - 文本：原生 Gemini `${baseUrl}/models/<model>:generateContent`，`x-goog-api-key`；
   - 生图：原生 Gemini `${baseUrl}/interactions`，`x-goog-api-key`；
   - 预期：LiteLLM 在**转发前**返回 `429`（`budget_exceeded` 或等价），上游完全未收到请求。
4. 证据：命令、HTTP 状态、响应体（脱敏）、LiteLLM 日志、上游零调用证据、时间；不记录密钥。
5. 若任一协议/路径无法硬拒、`x-goog-api-key` 不兼容、或存在绕过网关的路径：**立即保持阻塞**，不进入下一阶段。

产物：`.scratch/p0-02-second-demo/research/22-litellm-zero-budget.md`（含证据与结论）。验证成功**不自动授权** $6 或付费生图；需票 23 重新裁定。

## Comments

- **2026-10-29 模板已准备**：`.scratch/p0-02-second-demo/tools/litellm/` 内含 `litellm-config.yaml`、`docker-compose.yml`、`.env.example`、`verify-zero-budget.sh`、`README.md`。**未部署、未验证**；等待用户在仓库外部署并提供 endpoint 主机名（不传密钥）。

- **2026-10-29 探测**：`http://127.0.0.1:4000/health/readiness` → HTTP 000；`docker ps` 无 litellm 容器。**等待用户在仓库外部署**；未做任何付费调用。已补 `repo-config.template.json` 与 README §7（验证通过后的 repo 侧配置模板，不含密钥）。
