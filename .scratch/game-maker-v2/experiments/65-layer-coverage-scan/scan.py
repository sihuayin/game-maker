#!/usr/bin/env python3
# 票 65 §7「一处没量的」那把尺子 —— 把「层盖不住世界」那条判据提前到 config 之后，
# 会不会在**今天绿着的链**上误伤的扫描器。
#
# ⚠️ 它**不是**实现，是一把独立重写的尺子（故意不 import 仓里的代码）：
#    规则照 `packages/demo/src/draw.ts:221` 那条 `const w = tileX ? W : nom.w` 逐字复刻，
#    视口取 480×270（`packages/demo/src/world.ts` 的 VIEWPORT 常量）。
#    ⇒ 它与真实现的**一致**本身就是要看的东西（不一致 = 立案现场复现不出来）。
#
# 跑法（仓根）：python3 .scratch/game-maker-v2/experiments/65-layer-coverage-scan/scan.py
# 零付费 · 只读 · 不发一笔上游调用。
import json, glob, os, sys

VP = (480, 270)  # 外壳的视口常量（不是数据）


def rule(cfg, man):
    """返回这份 (config, pack) 上**新判据会报出来的**那几条（空 = 不误伤）。"""
    W = cfg["world"]["size"]
    aid = cfg["scene"]["background"]["asset"]
    a = next((x for x in man.get("assets", []) if x.get("id") == aid), None)
    if a is None:
        return []  # 解不到资源 ⇒ `auditGameConfig` 已经报过了，不是本判据的事
    out = []
    for i, l in enumerate(a.get("layers") or []):
        t = l.get("tileable") or {}
        drawn_w = W["w"] if t.get("x") else a["size"]["w"]
        drawn_h = W["h"] if t.get("y") else a["size"]["h"]
        p = l.get("parallax", 0)
        travel_x, travel_y = max(0, W["w"] - VP[0]), max(0, W["h"] - VP[1])
        cover_x, cover_y = drawn_w - p * travel_x, drawn_h - p * travel_y
        if cover_x < VP[0] or cover_y < VP[1]:
            out.append((i, l.get("name"), p, t, drawn_w, drawn_h, round(cover_x), round(cover_y)))
    return out


def pairs():
    """盘上每一对能对上的 (config 路径, pack manifest 路径)。"""
    for p in sorted(glob.glob("fixtures/**/*.json", recursive=True)):
        try:
            d = json.load(open(p))
        except Exception:
            continue
        if not isinstance(d, dict) or "world" not in d or "scene" not in d:
            continue
        if not (d.get("scene", {}).get("background") or {}).get("asset"):
            continue
        for mp in glob.glob("fixtures/packs/*/*/manifest.json"):
            yield p, mp
    # out/ 树：site.json 自己写着它消费的是哪个 pack 版本
    for sp in sorted(glob.glob("out/*/site/v*/site.json")):
        game = sp.split("/")[1]
        site = json.load(open(sp))
        mp = f"out/{game}/pack/{site.get('pack')}/manifest.json"
        cp = os.path.join(os.path.dirname(sp), "game-config.json")
        if os.path.exists(mp) and os.path.exists(cp):
            yield cp, mp


def main():
    n, hits = 0, []
    for cp, mp in pairs():
        n += 1
        h = rule(json.load(open(cp)), json.load(open(mp)))
        if h:
            hits.append((cp, mp, h))
    print(f"扫了 {n} 个 (config, pack) 对；会新报错的：{len(hits)}")
    for cp, mp, h in hits:
        print(f" * {cp} + {mp}")
        for row in h:
            print(f"     layer[{row[0]}] {row[1]} p={row[2]} tile={row[3]} drawn={row[4]}x{row[5]} -> 剩 {row[6]}x{row[7]}")
    # 立案现场（§7 的复现口径）—— 单列一问一答，不看它是不是 test 的输入
    base = ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger"
    if os.path.exists(base):
        print("\n立案现场复现（13h）：")
        r = rule(json.load(open(base + "/run/v1/game-config.json")), json.load(open(base + "/pack/v1/manifest.json")))
        print(f"  {len(r)} 条")
        for row in r:
            print(f"     layer[{row[0]}] {row[1]} p={row[2]} drawn={row[4]}x{row[5]} -> 剩 {row[6]}x{row[7]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
