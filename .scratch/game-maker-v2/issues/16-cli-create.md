# 16. CLI `create`：`--style` + `--intent`，以及唯一的检查点

Type: grilling
Status: open
Owner: —
Blocked by: 15
Map: ../map.md
> `docs/v2/03-claude-code.md` §26。CLI 是**薄壳** —— 只解析参数、渲染结果。

## Question

§26 要：

```bash
game-maker create --style ./style.png --intent "做一个废土横版寻宝游戏"
game-maker create --style ./style.png --intent ./intent.md
```

### 1. `--intent` 收两种东西

裸文本 vs 文件路径。要答判定规则（存在同名文件时的歧义），以及**失败时**的退出码
（参数错是 `2`，而「那段文本解析不出意图」是 `1` 还是 `4`）。
今天的退出码表在 `cli.ts:29`：`0` ok · `1` fail · `2` usage · `3` upstream · `4` 产物/清单不合法。

### 2. 检查点的 CLI 表面（承票 15 §2）

R9 + Q10b：在清单处停一次，`--yes` 跳过。要答：
- **停的时候打什么**？必须让「要不要花这笔钱」这个问题**看得见**（今天 `pack` 的
  生图条数已经在 `--json` 里报，`README_zh.md` 记着「清单里有 image 资源时，这一步才是花钱的那一步」）。
- **是交互式问，还是打印后退出、要人再跑一条命令**？
  ⚠️ 后者对 **MCP** 与**脚本**友好得多，而 CLI 今天**没有任何交互式输入**（读一遍 `cli.ts` 就成立）。
- 停了之后**怎么续**？（`--from recipe` 那种形式，见 Q10 的选项 (c)——R9 选了 (b)，
  但要答「续」的入口长什么样；否则这个检查点就是一条死路。）

### 3. 与既有命令的关系

`derive` / `pack` / `compile-game` / `compile-td-game` / `site` / `verify` / `inspect`
**七条一条都不许删**（`03 §31`，且 `README_zh.md` 的 CLI 参考在卖它们）。
要答：`create` 与它们**共用**哪些实现（本质上是把 `derive → pack → compile → site` 串起来，
只是**输入**从「需求 + StyleSpec」变成「图 + 文本」）。

### 4. 判据

- `game-maker create` **不带任何可选参数**能跑（`--yes` 除外，且 `--yes` 也要能跑）。
- `--help` 里能看到它，且 `docs`（`README.md` / `README_zh.md`）同步更新 ——
  ⚠️ `pnpm check:links` 会查相对链接（`scripts/check-links.mjs`）。

## Answer

（待解）
