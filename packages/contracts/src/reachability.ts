// **可达性** —— `03 §22` 那条冒烟（`boot → spawn → goal`），票 06 的 `reachability`（票 18 落地）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、它为什么是**一条判据**，而不是「难度」那种观察
//
//   `CONTEXT.md` 的门槛是「**精确可算 + 错了一定不是设计**」。终点够不到**错的一定不是设计**
//   —— 没有哪一种设计意图能把「这一关走不通」变成对的。所以它够得上判据。
//   ⚠️ 而**难度**、**路线好不好**、**危险物躲不躲得开**一律不在里面（那些是观察，本函数不报）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、⚠️ **模型一律往「玩家更强」那一侧偏** —— 那是这条判据唯一的正当性来源
//
//   每一条规则都只**高估**玩家的能力：
//     · 带 `motion` 的实心体按**整段行程**算（「它某一刻在那儿」就够玩家踩上去）；
//     · `hazard` **当空气**（把危险物当墙会把「冲过去」误判成不可达 —— 票 18 的裁决：
//       误伤一条判据比漏报贵）；
//     · **下落不设限**（世界有多深就能掉多深，且掉了不会死）；
//     · 落点取弧线的**下降段**（比上升段给的时间更多）。
//   ⇒ 可达集是**上界** ⇒ 「**不在里面**」才是可靠的那半句话。
//   ⚠️ 反过来，「在里面」什么都不保证 —— 本判据**只报不可达**，从不报「可达」。
//
//   它**能**抓：宽过一次跳跃的沟 · 高过跳跃顶点的墙 · 被围死的终点 / 拾取物。
//   它**抓不到**：要贴边、要连续蹬墙、要绕顶的精细路线 —— 那些会报成「可达」，
//     而那正是**安全**的那一侧。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、⚠️ 出生点非法时不报（**归 `auditGameConfig` 的自洽族**）
//
//   「出生点卡在 solid 里」是一条**硬失败**，而它住 `auditGameConfig`（另有其判据）。
//   本函数遇到它**不报任何东西** —— 报「全都够不到」是把一次拒绝说第二遍，
//   而且会把人指到一个**不存在的出路**上。同一条纪律：`pack` 先炸的检查，QA 不重写。
import { FALLBACK_ANCHOR, entityBox, maxJumpHeight, playerMoveOf } from "./game-config.js";
import type { ConfigIssue, GameConfig } from "./game-config.js";
import type { AssetPackManifest } from "./assetpack.js";

type Rect = { x: number; y: number; w: number; h: number };

/**
 * **这一关通不通** —— 从出生点出发，终点与每一个拾取物够不够得到。
 *
 * @returns 逐条**够不到**的实体（`where` 是 `entity "<id>"`，与 `auditGameConfig` 同一套人话）；
 *          一条都没有 = 通。⚠️ 它**不是**一份可达性报告，只报那半边坏消息。
 */
export function auditReachability(config: GameConfig, manifest: AssetPackManifest): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const { w: W, h: H } = config.world.size;
  const move = playerMoveOf(config);

  const sizeOf = (id: string | undefined): { w: number; h: number } | null =>
    (id ? manifest.assets.find((a) => a.id === id)?.size : undefined) ?? null;
  const anchorOf = (id: string | undefined) =>
    (id ? manifest.assets.find((a) => a.id === id)?.anchor : undefined) ?? FALLBACK_ANCHOR;

  // ⚠️ 玩家资源解不到就**什么都不报** —— 那是**引用族**的事（票 18 的裁决：本族只吃引用族
  //   之外的这一条，而「资源解不到」已经在 `auditReferences` 里报过一次了）。
  const pSize = sizeOf(config.player.asset);
  if (pSize === null) return out;
  const pAnchor = anchorOf(config.player.asset);

  // ── 实心体：**只有它们挡路**（地形一律实心；实体里只有 `solid` 算实心）─────────
  const solids: Rect[] = config.terrain.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
  for (const e of config.entities) {
    if (e.kind !== "solid") continue;
    const s = e.body ?? sizeOf(e.asset);
    if (s === null) continue;
    const b = entityBox(e.at, s, anchorOf(e.asset));
    if (!e.motion) { solids.push(b); continue; }
    // ⚠️ **整段行程**（见文件头二）：它扫过的那一整条都算「踩得上」。
    const d = e.motion.distance;
    solids.push(e.motion.axis === "x"
      ? { x: Math.min(b.x, b.x + d), y: b.y, w: b.w + Math.abs(d), h: b.h }
      : { x: b.x, y: Math.min(b.y, b.y + d), w: b.w, h: b.h + Math.abs(d) });
  }

  // ── ⚠️ 状态是**脚点**（盒子底边的中点），不是 `at` 那个锚点 ────────────────────
  //
  //   `at` 是「**资源锚点**落在哪」，而锚点是**渲染原点**：角色那个是 `{x:.5, y:.95}`
  //   —— 落在 `at` 上的是**身高 95% 那一点**，于是「站在地面线上的写法」把盒子**埋进土里
  //   2.4px**（`last-train` 的出生点就是：`at.y = 250`，地面顶边也是 250）。
  //   ⇒ 本函数一律用**脚点**说话：脚下那个点落在哪，盒子就长在它上面。
  //   ⚠️ 出生点因此要**落位**（见下面 `seed`）：埋进土里的那个点在真游戏里由物理引擎推出去，
  //     这里用「出生点附近最近的那些落脚点」把它接上 —— 那是**宽**的那一侧。
  const footOf = (at: { x: number; y: number }, size: { w: number; h: number }, anchor: { x: number; y: number }) => ({
    x: at.x + (0.5 - anchor.x) * size.w,
    y: at.y + (1 - anchor.y) * size.h
  });

  // ── 格子：整数坐标已经把「采样」这件事免掉了（交付态坐标 1:1、整数）──────────
  //
  //   ⚠️ **一个实心体直接把自己的 y 区间刷进它覆盖的那些列**，而不是逐格去问它 ——
  //   逐格问是 `(W+1)×(H+1)×实心体数`：一个 6000px 宽、撒了 300 块砖的关卡当场要 1 秒
  //   （实测）。刷区间是 `Σ 实心体的面积`，快两个数量级。
  const stride = H + 1;
  const blocked = new Uint8Array((W + 1) * stride);
  for (const s of solids) {
    // 盒子撞进 s 的内部 ⟺ 脚点落在这个开区间里（**贴着不算撞**，所以两端都是开的）
    const x0 = Math.max(0, Math.floor(s.x - pSize.w / 2) + 1);
    const x1 = Math.min(W, Math.ceil(s.x + s.w + pSize.w / 2) - 1);
    const y0 = Math.max(0, Math.floor(s.y) + 1);
    const y1 = Math.min(H, Math.ceil(s.y + s.h + pSize.h) - 1);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) blocked[x * stride + y] = 1;
  }
  const freeAt = new Uint8Array((W + 1) * stride);
  for (let x = 0; x <= W; x++)
    for (let y = 0; y <= H; y++) {
      const i = x * stride + y;
      // ⚠️ 「站得住」= 这里自由，且**再往下一点点就撞**。
      //   ⚠️ **世界的底不是地板** —— 地板是 `terrain`（`CONTEXT.md`：「地面线」）。
      //     曾经在这条上加过「`y >= H` 也算站得住」（想着「掉下去不会死」），而它当场
      //     把**每一条沟都变成可通行的**：掉进坑、沿坑底走、再爬上来 ——
      //     于是 last-train 挖一条 200px 的沟，判据一声不响（实测）。
      //     「下落不设限」说的是**不会摔死**，不是「世界的底下有一层看不见的地板」。
      freeAt[i] = blocked[i] === 0 && y + 1 <= H && blocked[i + 1] === 1 ? 1 : 0;
    }

  /** 逐列的落脚点（BFS 的候选集）。 */
  const cols: number[][] = [];
  for (let x = 0; x <= W; x++) {
    const ys: number[] = [];
    for (let y = 0; y <= H; y++) if (freeAt[x * stride + y] === 1) ys.push(y);
    cols.push(ys);
  }

  // ── 靶子：终点那一个 + **每一个** pickup（victory 是「捡齐 N 件再到达终点」）──────
  const gate = config.entities.find((e) => e.kind === "goal" && e.id === config.objective.gate);
  const targets = [
    ...config.entities.filter((e) => e.kind === "pickup").map((e) => ({ id: e.id, at: e.at })),
    ...(gate ? [{ id: gate.id, at: gate.at }] : [])
  ];
  // ⚠️ 「够到」在物理上没有一个利落的定义（盒子的哪一部分碰到算碰到），而**宽松是对的**：
  //   一个身位之内就算够到。
  const covered = targets.map(() => false);
  const covers = (x: number, y: number): void => {
    for (const [i, t] of targets.entries())
      if (!covered[i] && Math.abs(x - t.at.x) <= pSize.w && Math.abs(y - t.at.y) <= pSize.h) covered[i] = true;
  };
  const allCovered = () => covered.every(Boolean);

  // ── 一次跳跃的上界 ─────────────────────────────────────────────────────
  const apex = maxJumpHeight(move);
  // 飞得最久的那一次（掉到世界的底）：`t = (v0 + √(v0² + 2gH)) / g` ⇒ 水平最多跑这么远。
  const maxT = (move.jumpVelocity + Math.sqrt(move.jumpVelocity ** 2 + 2 * move.gravity * H)) / move.gravity;
  const maxDx = Math.ceil(move.speed * maxT);

  /**
   * 从落脚点 A 跳到 B：能不能到，顺路把经过的靶子划掉。
   *
   * ⚠️ 弧线按**真正的抛物线**扫（`h(t) = v0·t − g·t²/2`），水平按**匀速插值** ——
   *   而水平方向本来由玩家自己控（只要 `|dx/dt| ≤ speed` 就是一条真的轨迹）⇒ 这是一条
   *   **真会发生的**轨迹，不是示意图。贴着地面走那一趟因此也由它承担（两条边都在地面上时
   *   弧线几乎是平的）✓。
   */
  const hop = (ax: number, ay: number, bx: number, by: number): boolean => {
    const dh = ay - by;                                    // 正 = B 更高
    if (dh > apex) return false;                           // 高过跳跃顶点
    if (dh < -H) return false;                             // 比世界还深（不该发生，兜一下）
    const disc = move.jumpVelocity ** 2 - 2 * move.gravity * dh;
    if (disc < 0) return false;
    const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;   // ⚠️ **下降段**那一次（更宽）
    if (Math.abs(bx - ax) > move.speed * t) return false;            // 水平够不着
    // ⚠️ 60Hz 采样就够：水平那一维是**线性插值**的（准确），只有「撞没撞」靠采样 ——
    //   而盒子有 32px 宽，1.5px 一步漏不掉东西。120Hz 只是把最坏情况从 0.5s 拖到 1s。
    const n = Math.max(6, Math.min(120, Math.ceil(t * 60)));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const tt = t * f;
      const x = Math.round(ax + (bx - ax) * f);
      const y = Math.round(ay - (move.jumpVelocity * tt - (move.gravity * tt * tt) / 2));
      if (y < 0 || y > H || x < 0 || x > W) continue;      // 出世界的采样点不参与判决
      if (blocked[x * stride + y] === 1) return false;     // 弧线撞进实心体
      covers(x, y);                                        // ⚠️ **飞过去也算够到**
    }
    return true;
  };

  // ── 出发点：**出生点附近够得着的那些落脚点**（见上面 `footOf` 那段）────────────
  //
  //   ⚠️ 三个方向都是**宽**的：横向一个身位、纵向只要**在脚点之下**（掉下去本来就会落在那儿）
  //   或**高出一个身高**（那 2.4px 的「埋进土里」）。
  const spawn = footOf(config.player.at, pSize, pAnchor);
  const seen = new Uint8Array((W + 1) * stride);
  const queue: { x: number; y: number }[] = [];
  const seedAt = (x: number, y: number) => {
    const i = x * stride + y;
    if (seen[i] === 1) return;
    seen[i] = 1;
    queue.push({ x, y });
    covers(x, y);
  };
  for (let x = Math.max(0, Math.round(spawn.x - pSize.w)); x <= Math.min(W, Math.round(spawn.x + pSize.w)); x++)
    for (const y of cols[x]!)
      if (y >= spawn.y - pSize.h) seedAt(x, y);

  // ⚠️ **附近一个落脚点都没有 ⇒ 本判据不报**（见文件头三）：那是**出生点非法**，
  //   归 `auditGameConfig` 的自洽族；在这里报「全都够不到」会把人指到一个不存在的出路上。
  if (queue.length === 0) return out;
  covers(Math.round(spawn.x), Math.round(spawn.y));

  for (let head = 0; head < queue.length && !allCovered(); head++) {
    const { x: ax, y: ay } = queue[head]!;
    for (let dx = -maxDx; dx <= maxDx; dx++) {
      const bx = ax + dx;
      if (bx < 0 || bx > W) continue;
      for (const by of cols[bx]!) {
        if (seen[bx * stride + by] === 1) continue;
        if (Math.abs(dx) > maxDx) continue;
        if (!hop(ax, ay, bx, by)) continue;
        seen[bx * stride + by] = 1;
        queue.push({ x: bx, y: by });
      }
    }
  }

  for (const [i, t] of targets.entries()) {
    if (covered[i]) continue;
    out.push({
      severity: "error",
      where: `entity "${t.id}"`,
      message: `够不到 —— 从出生点出发，用**最宽的能力上界**都到不了它（跳跃顶点 ${apex.toFixed(1)}px · 跑速 ${move.speed}px/s · ` +
        "危险物当空气 · 下落不设限）。⚠️ 这条只报「到不了」：没有哪一种设计意图能把「走不通」变成对的。" +
        "要去的地方：地形 / 这一关的布局（不是再抽一次奖）。"
    });
  }
  return out;
}
