# 原型：第一版塔防提示词（票 05）

⚠️ **这是用完即弃的一手证据，不在 main 上。**它存在的理由是：下一张票（真的去写 `compileTdGame`）
需要一个**跑过一次的**起点，而 main 只保留**验过的结论**。

| 文件 | 是什么 |
|---|---|
| `prompt.mjs` | 第一版提示词 + 那个骨架（`tdConfigExample`）。**改了三次**：见下 |
| `run.mjs` | 跑一次：调上游 → 解析 → 过 schema → `auditTdConfig` → 打印地图 |
| `diagnose.mjs` | 定位「编译出来的那一关为什么打不赢」 |
| `winnable.mjs` | 手写那关 vs 编译那关，同一个几何玩家跑一遍 |
| `td-config.json` | **模型真产出的那一份**（第二次跑，schema 全过） |
| `compiled.png` | 它的站点在无头 Chrome 里的截图 |

跑法（在原仓库根）：

```sh
node scripts/…   # 见票 05 的 Answer；这些脚本读 fixtures/ 与 packages/*/dist
```

⚠️ `diagnose.mjs` / `winnable.mjs` 里那份玩家是**票 02 决定的复现版**（与 `probe/td-sweep.mjs` 同款），
不是出货的那一个 —— 真换落地时一起改。
