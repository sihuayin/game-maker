# 调用成本估算与超限停止机制

Type: research
Status: resolved
Blocked by: （无）

## Question

为下一轮预算授权提供可核实的成本模型与停止机制（不改生产代码、不调用付费上游、不读取/输出密钥）：

1. 以冻结 run 的 ledger 为基准核对调用结构：
   - `create` checkpoint：**5 次文本调用**，文本 token 36,522；
   - `build`：**3 次文本调用 + 14 次生图调用**（master ×2 / image ×12），文本 token 23,920；
   - 合计：**8 次文本 + 14 次生图**，文本 token 60,442；
   - 模型：文本 requested `gemini-3.5-flash` / served `gemini-3.6-flash`；生图 requested `gemini-3.1-flash-lite-image`。
2. 查一手价格：文本 input/output/reasoning token 单价、生图单次单价。若模型是代理/自定义、没有公开价格，明确说明，并要求用户提供价格表；不得猜测。
3. 给出 checkpoint / build / 全量三档成本估算（含 worst case），列出假设与不确定性。
4. 评估超限前停止机制（不改生产代码）：
   - provider 侧硬限额（首选）；
   - effort 侧 watcher：轮询 run ledger，在两次调用之间终止进程；说明能否保证“下一次调用不超限”的边界；
   - 若两者都无法保证，明确说“不能提供可靠护栏”，不要假装可以。
5. 不读取 `game-maker.local.json` 内容；只确认 provider 配置是否存在。

产物：`.scratch/p0-02-second-demo/research/13-cost-model.md`。

## Answer

**已收口（research，2026-10-29）。** 详见 [research/13-cost-model.md](../research/13-cost-model.md)。

- **价格可核实，端点未核实**：官方一手价（USD）已查到——`gemini-3.6-flash` $0.75 in / $3.75 out（含 thinking；2027 起翻倍），`gemini-3.1-flash-lite-image` $0.0336/张 1K 图；requested 3.5→served 3.6 是**官方弃用路由**。唯一缺口是 `baseUrl` 是否官方（本票不读配置），需用户在票 14 给主机名。
- **三档（若官方端点）**：checkpoint **≈$0.073**（结构最坏 $1.28）；build **≈$0.535**（结构最坏 $3.04）；全量（冻结 run 复现）**≈$0.608**；A（16 图）**≈$0.68**。**生图占 77%**；文本 8 次共 60,442 tokens 只有 $0.138。
- **最坏情况**：ledger 的 22 条不是往返数；重试折叠进 `attempts`，结构性最坏 **31 文本 + 56 生图 = 87 趟 / ≈$4.32**（A 16 图单元 = 64 趟 ≈$4.59；若背景拆层到 24 单元 = 96 趟 ≈$5.67）。
- **停止机制**：**不能提供“下一次调用不超限就停”的可靠动态护栏**——run ledger 只在阶段末落盘，build 期间不可见、默认并发 4/3。可行的**有界超射止损** = 监视 pack staging 目录逐张落盘的图 + `--concurrency-image 1`（超射 1–2 张）；**保证不超授权**只能靠 Prepay 余额（$0→402，~10 分钟延迟）/ 静态上限 ≥ 最坏 / checkpoint 两段闸。
- **票 14 最小输入**：端点主机名 + 计价档、provider 硬上限（Prepay / 月度 spend cap）及不花钱的验证方式、金额与覆盖阶段（含一次失败 run）、付费生图批准、`unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN` 确认（本会话检测到已设置）、重试政策。推荐 **Prepay $2.00 + checkpoint 闸**，或 **checkpoint 后按实际清单重算的静态上限（16 图 ≈$4.59；24 图 ≈$5.67）+ staging 止损**。
- **“22 次调用”不是货币上限**：条目数 ≠ 往返数（87）≠ token 量 ≠ 金额；也不覆盖 A 的清单差异、失败 run 沉没成本、官方/中转价差。
