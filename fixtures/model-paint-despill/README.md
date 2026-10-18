# `model-paint-despill/` —— C / C2 探针的原图（票 02 的真图回归）

这 6 张是 **style-migration-v1 的 C / C2 图像探针**里**已付费**的生图接口原图，原封不动拷进来 ——
不是重画的、不是合成的、不是桩。它们的用处只有一个：把「抠底后边缘还留不留品红」这件事，
从一段颜色阈值散文，变成一条**用真字节跑得出来**的判据。

## 每一张的来历

| 本目录文件名 | 原文件 | 哪一跑 | 那张图是什么 |
| --- | --- | --- | --- |
| `c-master.png` | `authoring/masters/master-probe-player.png` | C（2026-10-18e，`failed-2026-10-18T13-33-01-159Z`） | 玩家母版，864×1184，1 格 |
| `c-idle.png` | `authoring/generated/scavenger-actor.idle.png` | 同上 | idle 多帧，1344×768，4 格横排 |
| `c-run.png` | `authoring/generated/scavenger-actor.run.png` | 同上 | run 多帧，1344×768，实测 9 格横排 |
| `c2-master.png` | `authoring/masters/master-probe-player.png` | C2（2026-10-18f，`failed-2026-10-18T13-38-09-030Z`） | 玩家母版，864×1184，1 格 |
| `c2-idle.png` | `authoring/generated/scavenger-actor.idle.png` | 同上 | idle 多帧，1344×768，4 格横排 |
| `c2-run.png` | `authoring/generated/scavenger-actor.run.png` | 同上 | run 多帧，1344×768，**2 行 × 6 格**（正是票 01 的来由） |

原始现场（**不要**改，那是证据）：

- `.scratch/style-migration-v1/runs/2026-10-18e/ruin-scavenger-style-probe/failed-2026-10-18T13-33-01-159Z/`
- `.scratch/style-migration-v1/runs/2026-10-18f/ruin-scavenger-style-probe/failed-2026-10-18T13-38-09-030Z/`

⚠️ **为什么必须拷一份进来**：`.scratch/.../runs/` 不入库，而下一轮真跑会留下新的失败现场；
一份躺在 `fixtures/` 里的副本是唯一能在仓库里活下来的证据。

## 量到的（2026-10-18，零上游，交付版实现）

抠底口径：实测众数色、容差 30（`pack` 的默认）。

| 文件 | 实测众数色 | 按众数色抠掉 | **抠完仍命中品红判据** |
| --- | --- | --- | --- |
| `c-master` | `[212, 32, 139]` | 72.4% | 5,260 px |
| `c-idle` | `[213, 30, 141]` | 81.4% | 11,943 px |
| `c-run` | `[215, 28, 142]` | 89.7% | 7,692 px |
| `c2-master` | `[199, 53, 141]` | 73.1% | 5,201 px |
| `c2-idle` | `[196, 52, 140]` | 76.0% | 9,162 px |
| `c2-run` | `[201, 49, 144]` | 69.1% | 12,116 px |

品红判据（票 02）：
`R > 140 · G < 110 · B > 80 · R−G > 70 · B−G > 35` ⇒ 置透明。

⚠️ **它只认颜色，不猜主体**：判据不读连通块、不读边缘距离、不读「这是不是角色」。
红色/棕色（`B` 低）与它正交 —— 测试用真图上的暖色像素另行钉住「不被删」。

## 上游依赖（与 `model-paint/` 同一条纪律）

这些颜色是 **`gemini-2.5-flash-image`** 在 **2026-10-18** 两跑里交付的。
**换模型 / 换供应商 ⇒ 偏移会变 ⇒ 这 6 张的读数会与实际脱节。**

那时的处置**不是**把断言放宽到「怎么画都算过」，而是：**重量一批真图、把这 6 张换掉**。
