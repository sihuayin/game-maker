# 零付费核验 provider 端点、计价与护栏

Type: task
Status: open
Blocked by: （无）

## Question

只做零付费核验，不调用任何 provider API、不输出/记录密钥：

1. 从配置中提取**非密钥字段**：`baseUrl` 主机名、`protocol`、文本模型；生图 `baseUrl` 主机名、`protocol`、模型；只输出 host/model/protocol 与“key 是否存在”的布尔值，绝不输出 key 内容。
2. 确认环境覆盖：`ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 是否存在；`resolveTextTransport` 在什么情况下会切到 anthropic/deepseek；给出执行前必须的清理命令（不读取值）。
3. 判断端点是否为官方 Gemini API（核验标准：`generativelanguage.googleapis.com` 或官方文档列出的主机）；若是代理/中转，列出需要用户提供的价格字段。
4. 评估可用支出限制：
   - 官方 Prepay / spend cap 的实际延迟与超额风险；
   - 是否存在能严格阻止单次运行超过 $6.00 的机制；
   - 若没有，评估 effort 侧止损（staging 目录 + `--concurrency-image 1` + checkpoint 闸）能否把超射压到可接受范围，并给出结论“不足以满足本票要求”或“足够，条件是……”。
5. 输出结论：**$6.00 硬护栏是否可建立**；若不可，列出最小替代方案或“保持阻塞”。

产物：`.scratch/p0-02-second-demo/research/18-provider-verification.md`（含命令、退出码、脱敏输出）。
