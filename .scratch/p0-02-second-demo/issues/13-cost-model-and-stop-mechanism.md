# 调用成本估算与超限停止机制

Type: research
Status: open
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
