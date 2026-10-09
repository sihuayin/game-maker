# E2E fixture：`wasteland-platformer`

`docs/v2/03-claude-code.md` §27 那个 fixture。链的**终点判据**就跑在这个目录上：

```bash
game-maker create --style fixtures/e2e/wasteland-platformer/style.png \
                  --intent fixtures/e2e/wasteland-platformer/intent.md
```

| 文件 | 是什么 |
|---|---|
| `intent.md` | **逐字节**取自 §27 那个 ```text 块（含它自己的硬换行与 `-` 列表） |
| `style.png` | ⚠️ **借的** `fixtures/reference/halt-dusk.png`，见下 |
| `README.md` | 本文件 —— **§27 的目录树里没有它**，是我们加的（见「为什么多一个文件」） |

## ⚠️ `style.png` 与 `intent.md` 是**有意错配**的 —— 这是考点，不是疏忽

- **`style.png` 画的是**：黄昏的山间列车小站（三层横向带：天空 / 候车室内景 / 站台），
  一套冷调黄昏、扁平色块、极简像素的视觉世界。
- **`intent.md` 要的是**：横版**废土**寻宝 —— 拾荒者、废弃城市、宝箱、资源、敌人。

**两者不该对上。** 这张 fixture 考的正是那个真问题：
**模型会跟着图走，还是跟着文本走，还是把两者缝合？**
错配让答案**看得见** —— 配一张废土图，这条判据就退化成「反正都对」。
（票 23 的票面 §1 点名了这一点：「错配是**好事**」。）

⇒ 判读这个 fixture 的产物时：产物**应该**带着黄昏小站的色板与形状语言（跟图），
而**题材内容**应该来自文本（拾荒者 / 废土 / 宝箱）。两边打架的地方才是信息。

## ⚠️ 为什么多一个文件

§27 的目录树只列了 `style.png` 与 `intent.md`。本 README 是**票 23 加的第 3 个文件** ——
因为「借 `halt-dusk.png` ⇒ **必须明说这是在测错配**」是票面自己下的规矩，
而**只有写在 fixture 里**，下一个打开这个目录的人才看得见（写在票里、写在提交信息里都看不见）。
⚠️ 它**不进** `create` 的输入，也不改变 `out/<gameId>/` 的产物清单 —— §28 那本账不受影响。

## `style.png` 的出处

逐字节就是 `fixtures/reference/halt-dusk.png`（sha256 两边相同）：

```text
76ed648ec71dfffe3274dc16ab0d8ab1d242502511db947ce630ee75a47f89d0
```

它是**程序化生成**的（不是模型画的、不是截图）—— 生成脚本、18 色色板、
「为什么是这张」与它的已知局限全在 `fixtures/reference/halt-dusk.provenance.json`。
⚠️ 那个 provenance 里记的是**它作为 fixture 参考图（R6）**的身份；
**本目录借它来考错配，是第二个用途**，两者的理由不一样。
