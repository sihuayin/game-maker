# 玩家角色 · 六帧走路动画（test.png 风格）

2026-09-23 生成。链路：复用 `../style-transfer-from-test-png/stylespec.json`
→ 单次调用 deepseek-v4-pro（`thinking:{type:"disabled"}`，25s）→ 六帧 drawlist → 渲染。

**看动画**：`open anim.html`（循环播放 walk1-4，可调 4/8/12 fps、单帧步进）
**看全帧**：`sheet.png` / `sheet.svg`

## 帧

| 帧 | ops | 包围盒 | 说明 |
|---|---|---|---|
| idle | 14 | 11×26.5 | 站立，手臂垂侧 |
| walk1 | 14 | 13×26.5 | 左腿前、右臂前 |
| walk2 | 14 | 11×26.5 | 过渡（双腿并拢，故变窄） |
| walk3 | 14 | 13×26.5 | 右腿前、左臂前 |
| walk4 | 14 | 11×26.5 | 过渡 |
| jump | 14 | 13×24.5 | 收腿腾空（故变矮） |

walk1→walk4 首尾相接可无缝循环。六帧用色集合完全一致（palette 1-7 全用）。

## 帧间一致性是怎么做到的

**一次调用生成全部六帧**（一个响应里给 `states` 映射），而不是每帧一次调用。
对照实验：上次每帧独立调用时，`player.idle` 与 `player.jump` 画成了两个不同角色
（bbox 11×29 vs 15×24）。单次调用下六帧明显是同一角色。
prompt 里还给了「两帧最小示例」，显式演示「头躯干 ops 原样复用、只改四肢」。
→ 这是票 22 问题 1 的第一个候选策略，**实测有效**。

## 复跑

```bash
SS=$(pwd)/../style-transfer-from-test-png/stylespec.json
SS_PATH=$SS node gen_player.mjs     # → /tmp/an/player.raw.json + 各帧
SS_PATH=$SS node render.mjs         # → /tmp/an/sheet.svg + anim.html
qlmanage -t -s 1600 -o /tmp/an /tmp/an/sheet.svg
open /tmp/an/anim.html
```

## 已知不足（对照票 22）

- 手臂摆动幅度偏小，「与腿反向」只部分兑现
- 无 pixel dithering / 磨损材质 —— drawlist 没有 dither 图元（票 22 问题 2）
- 橙色标识在帧间尺寸略有漂移（idle 小方块 / walk1 宽条）
- 角色仍偏机械感；要更「人」需要更多 op 或曲线
