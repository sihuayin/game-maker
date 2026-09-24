# 实验脚本（2026-09-23，票 22 的前身实验）

可复跑。依赖环境变量 `ANTHROPIC_BASE_URL` 与 `ANTHROPIC_AUTH_TOKEN`
（本地 CC Switch 代理），且**直连 github 之外的网络需走系统代理** ——
脚本本身打的是 `$ANTHROPIC_BASE_URL`，不受影响。

中间产物写到 `/tmp/gen/`（`ref.b64`、`stylespec.json`、各 drawlist、`view.html`、`sheet.svg`）。

## 运行顺序

```bash
mkdir -p /tmp/gen
base64 -i fixtures/reference/test.png | tr -d '\n' > /tmp/gen/ref.b64   # 参考图 base64（~1.4MB）
node step1_stylespec.mjs    # 参考图 → StyleSpec        （qwen3.8-max 视觉，~61s）
node step2_assets.mjs       # StyleSpec → 6 份 drawlist （deepseek-v4-pro，关 thinking，5 路并行 ~8s）
node sheet.mjs              # drawlist → 联系表 sheet.svg
qlmanage -t -s 1400 -o /tmp/gen /tmp/gen/sheet.svg       # macOS 转 PNG 供人眼看
open /tmp/gen/view.html     # 可交互对比页
```

## 各文件

| 文件 | 作用 |
|---|---|
| `step1_stylespec.mjs` | 视觉提取 StyleSpec。走 `/v1/messages`（唯一能收图的路）。**thinking 未关**，故 61s |
| `step2_assets.mjs` | 文本生成 drawlist。走 `/v1/chat/completions` + `thinking:{type:"disabled"}`。含 schema 校验、包围盒/圆润度统计、SVG 渲染、view.html 生成 |
| `sheet.mjs` | 把 6 份 drawlist 拼成联系表 SVG（供人眼判断风格迁移） |
| `probe_reason.mjs` | **thinking 开关的四路对照实验** —— `thinking:{type:"disabled"}` 结论的证据来源 |

## 已知的坑（重跑前必读）

- `step2_assets.mjs` 里 `thinking:{type:"disabled"}` **不能删**。删掉后推理 token 会
  吃光 100% 输出预算，content 为空（实测 max_tokens=8000 时 reasoning=8000）
- 关掉 thinking 后模型**会加 markdown 围栏**，且 JSON 形状纪律下降
  （会把 ops 包进 `"drawlist"` 键）—— 所以脚本里有剥围栏 + 形状归一化 + few-shot 示例，三者都别删
- `dbg.mjs` / `probe2.mjs` 是一次性调试脚本，**故意未归档**
