# 票 27 的探针：`tool_choice` 到底有多可靠

**七发请求。** 第 1~5 发是**同一发真实请求 × 5**，量的是**率**（票 25 只量了「能不能」，n=1）；
第 6、7 发各隔离一件事。原始响应在 `raw/`。
跑法：`node .scratch/game-maker-v2/experiments/tool-choice-probe/run.mjs`（凭据从环境读，**不落盘**）。

## 结果

| # | 做法 | 结果 |
|---|---|---|
| 1~5 | 真参考图 `halt-dusk.png` + **VisualWorldSpec 全 14 键**的 tool schema + `tool_choice:{type:"tool"}`，`max_tokens=8000` | **4/5 成功**。5 发全 HTTP 200、`blocks=[tool_use]`、`stop_reason=tool_use`、~6~9s。 |
| 6 | `strict: true`（小 schema，合法 strict 形状） | HTTP 200 · 工具被调 · input 合 schema。⚠️ **只证明「被接受」，不证明「被实现」** |
| 7 | `output_config: {format:{type:"json_schema",…}}` | HTTP 200 · **返回的是一整段散文**（968 字符，`stop=max_tokens`）—— 参数被**收下并静默忽略** |

### ⚠️ 第 1 发是这七发里最要紧的一发

```
stop_reason = "tool_use"    blocks = [tool_use]    output_tokens = 1135
toolUse[0].input = {}        ← 空对象
```

**上游烧了 1135 个输出 token，回来的 `input` 是空的。** 它**不是**「模型不听话」（那样会没有 `tool_use` 块），
也不是「模型吐了坏 JSON」（那样 `input` 不会是合法对象）。它是**代理把工具入参丢了** —— 一种
**静默的数据丢失**，而退出码、`stop_reason`、块类型三项**看起来全部正常**。

⇒ 三条结论，全部写进票 27 的答案：

1. **`stop_reason === "tool_use"` 不是成功信号。** 唯一的成功判据是**入参过 Zod**。
2. **重采样是承重的，不是保险。** 首发 80% ⇒ 重试一次 96%、两次 99.2%。
3. **Q4(ii) 那个 `failure` 闭集当场就抓到了东西**（`no-tool-use` 之外还要有 `empty-input` 这一档）。

### ⚠️ 第 7 发说明：HTTP 200 什么都证明不了

代理**接受**它不认识的参数并**静默忽略**。所以第 6 发那个 `strict: true`「被接受」**几乎肯定也是被忽略**
（小 schema + 强模型本来就会合规，没有判别力）。**⇒ `strict` 和 `output_config.format` 都不能依赖。**

### 另外两条

- **六发工具响应全是 `blocks=[tool_use]`、`textLen=0`** ⇒ **「剥围栏」这七发里一次都没用上**
  （票 25 的 ② 也没用上）。它现在是 0/7。
- **`servedModel` 仍是 `deepseek-flash`**，而请求的是 `deepseek-v4-pro` —— 代理换模型这条**又一次**成立。

## 没量到的

- **`input={}` 是系统性的还是偶发的**，这一发分不出来（n=1 的失败）。要分辨得再花请求，
  而**票 08 的账（Q4 刚定的 `failure` 字段）本来就会量它**，且免费。
- `max_tokens` 的**真天花板**：五发里最大的输出 1660 token，都没撞上限。14 键的 `VisualWorldSpec`
  实测在 **1100~1700 输出 token** 量级 —— 票 25 记的「天花板没量到」现在有了一个**下界**。
