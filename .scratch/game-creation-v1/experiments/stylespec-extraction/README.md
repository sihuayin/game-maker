# 参考图 → StyleSpec：**产物 A 的入口**（票 15）

> ⚠️ **这不是管线代码。** R11 把这一步定成「人在 Claude Code 会话里的**一次交互提取**」，
> 管线只消费产出的 `stylespec.json` 文件。所以这个目录是可复跑的**操作记录**，
> 不是 `packages/` 里的一个功能 —— 别把它直接接进自动化。

## 为什么是人做而不是管线做

两条腿，都还站着：

1. **条款**：千问 Token Plan 明确只许「编程/智能体工具中**交互式**使用」，
   不可用于「自动化脚本、自定义应用程序后端或任何非交互式批量调用场景」（[票 34](../../issues/34-wan-quota-facts.md)）。
   Claude Code 会话里让模型看图、产出 StyleSpec，**正是条款点名的允许场景**。
2. **视觉上游本来也不稳**：同一份 prompt 有时通有时不通，provider 换过三次
   （qwen3.8-max → 千问 → deepseek-flash）。把它编进管线等于把产物 A 的可用性
   绑在一个每天在变的东西上。

推论：**产物 A 的入口是「一条命令 + 一次人工提取」，不是全自动。** 这是设计，不是缺口。

## 操作流程

```bash
cd .scratch/game-creation-v1/experiments/stylespec-extraction

# 1. 确认上游活着（鉴权不校验，必须发真实请求才知道）
node probe_thinking.mjs ../../../../fixtures/reference/test.png

# 2. 提取（默认 thinking 关；加 `thinking` 打开）。跑 5 次看稳定性
node make_counterexample.mjs                                   # 造反例图（下面第 3 步要用）
node multi_and_counter.mjs                                     # 反例 + 多图

# 3. 人眼看一眼结果，挑一份，**规范化色板为小写**，写进 fixtures/
node -e '…'   # 见「落盘」一节
```

环境变量：`ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`。

## 配方（每条都有实测依据）

| 项 | 值 | 依据 |
|---|---|---|
| 端点 | `POST {BASE}/v1/messages` | 唯一能收图的路；`/v1/chat/completions` 看不到图（票 01） |
| model 字段 | `deepseek-v4-pro` | 写什么都行，**一律被路由**；回包里的 `model` 才是真的。2026-09-23 是 `qwen3.8-max`，2026-09-25 是 `deepseek-flash` |
| 图片 | base64，**放在文本块之前** | 票 01 |
| JSON | **纯文本 JSON**，不用 `tool_choice` | 强制 JSON 只有 1/3 通过（票 01） |
| `max_tokens` | 6000 | 1500 会被推理吃光 |
| `thinking` | **`{"type":"disabled"}`** | 见下：更快**且**更稳 |
| 超时 | ≥ 180 s | 最坏见过 136 s（票 01） |

### thinking 开关：关掉它，又快又稳

| | 中位延迟 | 解析成功 | 规范化后过 schema |
|---|---|---|---|
| **thinking 关**（5 次） | **2.9 s** | 5/5 | **5/5** |
| thinking 开（3 次） | 12.5 s | 3/3 | 2/3 |
| 实验当时（2026-09-23） | 61 s | — | — |

**20 倍提速，而且更稳。** 这条推翻了「视觉路径要 61 s」的记录 —— 那个数字是
**thinking 开着**的结果，而开关一直是有的。建议所有视觉调用点都带这个开关。

## 两个必须知道的坑

### ① 原样输出**过不了契约**，必须先规范化小写

`PaletteSchema` 要求小写 `#rrggbb`（票 24），而模型**几乎总是回大写**：

```
原样过 schema   1/5
规范化后过schema 5/5
```

**不做这一步，80% 的提取会被拒。** 这不是模型的错 —— 契约要求一个规范形式是对的
（一个色值两种拼写，checksum 就不稳）。

### ② `confidence` 会被漏掉，而它是**没有默认值的必填项**

`StyleSpecSchema` 里其它字段都有 `.default()`，只有 `id` 和 `confidence` 是裸的。
8 次里漏了 1 次（thinking 开时的第 2 次），**规范化也救不回来**。
它自报 0.85–0.95，**与提取质量无关** —— 票 01 就发现「含幻觉色板时同样报 0.92」。
**别把它当判据。**

## 产出物

| 文件 | 作用 |
|---|---|
| `prompt.mjs` | **prompt 全文**（单一来源，两个脚本共用） |
| `extract.mjs` | 跑 N 次提取，每次做**原样 + 规范化**两次 schema 校验，落盘 |
| `probe_thinking.mjs` | thinking 开关探测 |
| `multi_and_counter.mjs` | 多图语义 + 反例验证 |
| `make_counterexample.mjs` | 生成那张一次性霓虹反例图（**可复跑**，用仓库自己的 PNG 编码器） |
| `dominant.mjs` | 用**仓库自己的解码器**算参考图的真实占比色（判据，不是自证） |
| `check_colors.mjs` | 一组 hex 在不在图里 |
| `out/runs.nothink-5x.json` / `out/runs.thinking-3x.json` | 稳定性原始数据 |
| `out/multi_and_counter.json` | 多图 / 反例原始数据 |

## 落盘

**产物是 `fixtures/style-spec.json`（纯 StyleSpec）+ `fixtures/style-spec.provenance.json`（来源）。**
provenance 放兄弟文件而不是塞进 style-spec.json —— 塞进去会被 Zod 静默剥掉
（`StyleSpecSchema` 不是 `.strict()`），和票 24 把 version/createdAt 挂在包级一个道理。
