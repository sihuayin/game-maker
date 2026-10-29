# 寻找可硬限额的计量网关

Type: research
Status: resolved
Blocked by: （无）

## Question

零付费研究：寻找并核实一个能对 A 的 Gemini 文本/生图调用提供**可验证硬限额**的路径，使单次运行不会超过授权金额。

至少评估：

1. 官方 Google Cloud/Gemini 的 quota、Prepay、spend cap：能否按项目/API key 设置**按次硬拒绝**，延迟多大，如何不花钱验证；
2. 第三方计量网关/代理：是否支持按请求/按金额硬拒、预算耗尽即 402/403、可审计账单；与 Gemini API 的兼容性；
3. 本地代理（如当前 `127.0.0.1:15721`）是否具备计量/硬限能力；若没有，明确说明；
4. 每种方案：用户需要提供什么（主机名、凭据存在性、控制台设置），是否需要改生产代码，残留风险，是否满足“下一次调用前就能阻止超支”。

不调用付费 API、不读/输出密钥；只读文档与本地配置的非密钥字段。

产物：`.scratch/p0-02-second-demo/research/20-metering-gateway.md`。

## Answer

**已收口（2026-10-29，零付费、零密钥输出、零生产修改）。** 详见 [../research/20-metering-gateway.md](../research/20-metering-gateway.md)。

- **没有 provider 强制的严格 $6 路径**：Prepay（~10 分钟 overage）、spend cap（月度、非即时、超支照常计费）、AI Studio spend cap（实验性、~10 分钟）都不满足；Gemini RPD 配额按 project、官方只记录“申请增加”，Cloud Quota override 未获 `generativelanguage.googleapis.com` 的文档支持，且官方写 “rate limits are not guaranteed”。
- **最接近严格的外部网关 = LiteLLM Proxy（自托管）**：key `max_budget=6`（lifetime）、预请求 429、per-request 预留（含 image）、原生 Gemini `:generateContent` 与 `/v1beta/interactions`、精确模型；先用 `max_budget=0` 做零付费 429 验证（`x-goog-api-key` 鉴权未验证）。
- **零代码 SaaS = OpenRouter（非严格）**：lifetime per-key cap、超限 403；但 image 不在在飞预留，且本仓生图 `/images/generations` 与 PNG 输出未验证。**只有用户明确接受“cap 设 $5.80 以吸收在飞缺口”时**才可考虑（绝对花费 ≤$5.84）；它不是零超射方案。
- **Cloudflare** 生图不在定价目录（$0 盲区）；**Vercel** 官方称 soft cap；**Portkey/Helicone/Requesty/Kong** 不适用；**CC Switch 15721** 只是日志/用量估算/failover，无预算执行。
- **兜底 = effort-local 计量代理**（转发前预留 + 402，临时 cwd 配置副本，不改生产代码）；它和 LiteLLM 一样是网关侧记账，不是 provider 保证。
- **票 21 的最小输入**：LiteLLM 的 `max_budget=0 → 429` 证据 + `x-goog-api-key` 鉴权/两条路径结果 + 最终预算值；或 OpenRouter key cap/模型目录 + 生图路由/PNG 的验证结果；或自建代理的 HITL 批准与实现票。若只接受 provider 强制，保持 BLOCKED。
