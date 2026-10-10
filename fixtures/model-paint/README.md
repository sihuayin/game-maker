# `model-paint/` —— **模型真实交付的底色**（票 37 的真图回归）

这 5 张是**已付费**的生图接口真跑产出的原图，原封不动地拷进来 —— 不是重画的、不是合成的、
不是桩。它们的用处只有一个：把「模型到底交付了什么颜色」这件事，从一个**测试环境里假设的**
行为，变成一条**用真字节跑得出来**的判据。

## 每一张的来历

| 本目录文件名 | 原文件 | 哪一跑 | 那张图是什么 |
| --- | --- | --- | --- |
| `a-normal-master.png` | `authoring/masters/p-scavenger-master.png` | `master-first-shot`（2026-10-07，A-normal） | 角色母版，832×1248，1 格 |
| `a-normal-idle.png` | `authoring/generated/p-scavenger-idle.idle.png` | 同上 | 母版派生出的 idle，832×1248，1 格 |
| `third-run-scavenger-idle.png` | `scavenger-idle.idle.png` | 第三次真跑（2026-10-09） | 多帧动画，1184×864，2 格 |
| `third-run-treasure-chest.png` | `treasure-chest.png` | 同上 | 单帧道具，896×1152，1 格 |
| `third-run-master-enemy.png` | `master-enemy.png` | 同上 | 角色母版，832×1248，1 格 |

原始现场（**不要**改，那是证据）：

- `.scratch/game-maker-v2/experiments/master-first-shot/raw/out/A-normal/`
- `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/key-colour-third-run/`（读数在同目录
  `measured-2026-10-09.txt`，量法在 `measure-key-colour.mjs`）

⚠️ **为什么必须拷一份进来**：第三次真跑那些 `*.png` 在 `.gitignore` 里，而原现场会被**下一次**
真跑整个删掉（`run.mjs` 开头的 `rmSync(OUT)`）—— 第二次真跑那 10 张就是这么没的。
一份躺在 `fixtures/` 里的副本是唯一能活过下一次跑的证据。

## ⚠️ 上游依赖（票 37 的 Q5 边界第 4 条 —— 必须写明）

这些颜色是 **`gemini-2.5-flash-image`** 在 **2026-10-09** 那两跑里交付的。
**换模型 / 换供应商 ⇒ 偏移会变 ⇒ 这 5 张的读数会与实际脱节。**

那时的处置**不是**把断言放宽到「怎么画都算过」（那就又回到「三道闸全绿而规则是错的」），
而是：**重量一批真图、把这 5 张换掉**，让 fixture 始终是「现在这个上游真交付的样子」。

## 这 5 张共同说明的一件事

提示词里逐字写的是 `#ff00ff`（占位洋红，`keyColorFor(palette)` 在本轮色板下的返回值），
**5 张一张都没交付它**：按 `#ff00ff` 在容差 30 下抠，**5 张全是 0 像素**；
画面里离它最近的像素也差 L1 131~192。

而每张图**自己内部**极稳 —— 众数色（也就是模型真铺的那个底）在容差 30 下覆盖
**67.7%~80.9%** 的不透明像素。⇒ 「一张图一个底色」这个形状成立，
错的从来只是「那个底色 = 我们声明的那个」。
