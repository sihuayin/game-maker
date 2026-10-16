# 票 78 探针 · `reviewPack` 的接线 —— 它要花一次钱，而「花多少」今天量得出来

**只读 · 零付费 · 零网络**（`reviewPack` 的 `fetch` 是**假的**，一次都发不出去）。一条命令：

```bash
node .scratch/game-maker-v2/experiments/78-reviewpack-wiring/probe78.mjs
```

原始输出逐字留在 [`raw-output.txt`](raw-output.txt)。用的是**出货的** `packages/assets/dist` 与
`packages/contracts/dist`，不是本脚本重写的等价物。

⚠️ 本脚本**一个字节都不写盘**；`reviewPack` 那一发被假 fetch 截下来，**没有网络**。

## 它量四件事

**① 拼联系表是纯的（零网络的一半在这里）**

| 包 | 联系表 | 帧数 | 耗时 |
|---|---|---|---|
| `fixtures/packs/last-train/v2` | **3440×1130px** | 22 | ~25ms |
| `fixtures/packs/counter-siege/v4` | **1370×562px** | 26 | ~27ms |

**② 包里那份 `authoring/stylespec.json` 过不过契约** —— 两个夹具包**都过**
（`StyleSpecSchema`，且 `reviewPack` 要的 5 个键 `identity` / `shapeLanguage` / `material` /
`constraints` / `palette` **一个不缺**）。
⇒ ⭐ **接线不需要再要一个 `--style` 参数** —— 风格规格**就在包里**。

**③ 一次真调用会发出去多少**（拿假 fetch 截下**请求体**量的）

| 包 | `model` | 请求体 | 其中 base64 图 | 提示词 |
|---|---|---|---|---|
| `last-train/v2` | `deepseek-v4-pro` | **40,908 字节** | 40,160（**98%**） | 474 |
| `counter-siege/v4` | `deepseek-v4-pro` | **15,524 字节** | 14,100（**91%**） | 1,144 |

⇒ 「一次视觉调用」的代价**就是上面那 ③**；而 ① 与 ② 免费。

**④ 原图（票 22 要喂的那张）够不够得着** —— 拿两跑真产物（13e / 13h）核的：

```text
包里那份 authoring/visual-world.json 指向 : `style.png`
那个路径在 **包里** 存在吗                : ❌ **不在（悬空）**
那个路径在 **run 目录里** 存在吗           : ✅ 在（2228 字节）
包里 18 / 15 张 png 里有参考图吗          : ❌ **没有** —— 全是交付图集与生成物
```

⇒ ⭐ **对 `packDir` 跑，原图够不着；对 `runDir` 跑（或额外给一个图路径）才够得着。**

## 明确**没**量的

- **改了之后视觉模型会不会真看出差异** —— 那要一次真跑（**票 23**，另出报告 ＋ 逐次明确同意）。
- **那一发值不值那些字节** —— 同上。本探针量的是**代价**，不是**收益**。
- ⚠️ 而「**检查点那一刻没有包**」这一条**不是**本探针量的，是 `ls` 出来的：
  `run-out-2026-10-13d/ruined-city-scavenger/` 下**只有 `run/v1/`**（而那跑到处是 `exit 0` ·
  `create` 未带 `--yes`），有包的那一跑（13e）才多出 `pack/v1/`。
