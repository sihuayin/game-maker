// 读 (manifest, game-config) → **场景描述** —— 纯函数，**零 Phaser、零 DOM**（票 32 裁决 4）。
//
// ⚠️ **它是外壳可测的全部理由**（票 32 裁决 4，与票 21 的「零 DOM 依赖」、
//   票 38 的「生成器是注入的端口」同一条纪律）。渲染层只把这份描述铺开 ——
//   于是「数据对不对」全部可以在 vitest 里零浏览器地测出来。
//
// ⚠️ **必须「不抛」**（票 32 §3 的四条判据：出画布 · 不抛 · 占位符可见 · 控制台有警告）。
//   所以它收的是**没解析过的 JSON**，自己 defensively 解析 —— 调用方给它一份垃圾也只会
//   得到一份「全是占位符」的描述，而不是一个异常。这正是对冲票 03 那条实测：
//   **Phaser 的 loader 静默返回空且不报错** —— 不主动查，坏数据是不显形的。
import {
  entityBox, parseAssetPack, parseGameConfig, resolvePackRef, FALLBACK_ANCHOR,
  type AssetPackManifest, type GameConfig,
} from "@game-maker/contracts";

/** 视口 = **外壳常量**（票 32 裁决 1）。于是 1 交付像素 = 1 屏幕像素字面成立。 */
export const VIEWPORT = { w: 480, h: 270 } as const;

/**
 * 外壳版本号（票 32 裁决 6）。`site` 装配时把它写进 `site.json` ——
 * **站点产物不在 git 里**（Q9），拷走之后必须自己说明自己是怎么来的。
 * ⚠️ 改外壳就必须改它（票 18 的「绝不覆盖」靠这个数说话）。
 */
export const SHELL_VERSION = "1";

/**
 * 屏幕**底色**（票 50）—— 什么都没有画的地方透过去是什么。
 *
 * ⚠️ 它一直是**黑**，但一直是**「默认值碰巧的结果」**：canvas 什么都不画就是黑，
 *   而没有人做过这个决定。给它一个名字，是为了让「这是选的」变成事实。
 * ⚠️ **它是外壳的常量，不是数据** —— 与 `VIEWPORT` 同一条规矩（票 32 裁决 1）：
 *   让「这个世界长什么样」漏进一个声称与游戏无关的外壳，是另一种错。
 *   ⇒ 要换就改这个常量、升一次外壳版本（票 32 裁决 6 已经给了那条路）。
 * ⚠️ 它**不解决**「最远那层没画满」：那件事由装配期拦下（见 [[票 50]]），
 *   底色只是让「透过去」变成一个**选过的**颜色。
 */
export const BACKDROP = "#000000";

export type Vec = { x: number; y: number };
export type Size = { w: number; h: number };
export type Box = { x: number; y: number; w: number; h: number };

/** 与控制台警告同源。⚠️ 用与 `ConfigIssue` **同一个形状** —— 「哪里 + 怎么了」拆两个字段。 */
export type Issue = { severity: "error" | "warning"; where: string; message: string };

/** 一份要加载的图集。 ⚠️ `key` 用图集的**图片路径**：它是包内唯一的，且能被放进 URL。 */
export type AtlasToLoad = { key: string; json: string; image: string };

/** 一个**画不出来**的位置。壳在原位画品红/黑棋盘 + 打控制台警告，**游戏继续**（裁决 3）。 */
export type Missing = {
  missing: true;
  x: number; y: number; w: number; h: number;
  /** 画在占位符上的短标签（资源 id / 动作名）。 */
  label: string;
  /** 为什么画不出来 —— 与 `issues` 里那条同一个来源。 */
  reason: string;
};

/** 画得出来的东西：在哪一帧、摆在哪、**锚点是什么**。 */
export type Draw = {
  /** ⚠️ **显式 `false`，不是可选字段** —— 可选的话成功时读出来是 `undefined`，
   *  调用方分不清「明确地好」与「没设过」。判别式要能一眼分开。 */
  missing: false;
  atlas: string;
  frame: string;
  /** 锚点落点的世界坐标（**不是左上角** —— 见下面 `anchorOf` 的说明）。 */
  at: Vec;
  /** Phaser 的 origin。**逐帧来自资源**，壳不自己算。 */
  anchor: Vec;
  w: number; h: number;
};

export type Drawn = Draw | Missing;

/** 背景的一层。⚠️ 视差与可平铺**住在包里**（票 09 裁决 6），这里只是把它搬运过来。 */
export type BackgroundLayer = {
  draw: Drawn;
  parallax: number;
  tileX: boolean; tileY: boolean;
  /** 要铺的矩形（世界像素，左上角）。**纯函数算好的 —— 壳不做几何。** */
  box: Box;
};

export type EntityDesc = {
  id: string;
  kind: "solid" | "pickup" | "hazard" | "goal" | "decor";
  /** 碰撞/摆放盒（世界像素，左上角）。**由 `at` 与锚点推出来**，不是 `at` 本身。 */
  box: Box;
  draw: Drawn;
  /** 若资源是 animation：逐帧名（壳拿去建 Phaser 动画）。 */
  frames?: string[];
  motion?: { axis: "x" | "y"; distance: number; periodMs: number };
};

export type PlayerDesc = {
  draw: Drawn;
  /** 动作名 → 帧名列表（**显式映射**，票 09 裁决 10）。 */
  anims: Record<string, string[]>;
  at: Vec;
  box: Box;
  /** 手感。⚠️ 默认值只有一处来源（票 09 裁决 11）—— 由契约的 `playerMoveOf` 给。 */
  move: { speed: number; jumpVelocity: number; gravity: number };
};

export type HudDesc = {
  /**
   * HUD 的摆放。⚠️ **盒子一并给出来**（与 `BackgroundLayer` 同款）——
   *   HUD 是**屏幕空间**的，装配期要拿这个盒子对**视口**（不是 `world.size`）校验，
   *   而那两处必须用**同一个盒子**，否则「校验过的」与「画出来的」又是两份。
   */
  panel: { draw: Drawn; box: Box };
  /** 一个拾取物一个槽 —— 槽位数 = `pickupCount`（**同一个数**，票 09 裁决 8）。 */
  pips: { draw: Drawn; at: Vec; box: Box }[];
};

export type WorldDescription = {
  shellVersion: string;
  viewport: Size;
  /** 世界尺寸。相机 clamp 到它（票 32 裁决 2）。没 config 时 = 视口。 */
  worldSize: Size;
  atlases: AtlasToLoad[];
  issues: Issue[];
  background: BackgroundLayer[];
  terrain: Box[];
  entities: EntityDesc[];
  player: PlayerDesc;
  hud: HudDesc;
  objective: { gate: string; pickupCount: number };
};

/** 未知资源时的占位尺寸。可见即可 —— 它的岗位是「让坏了显形」，不是好看。 */
const FALLBACK_SIZE: Size = { w: 32, h: 32 };


const isVec = (v: unknown): v is Vec =>
  typeof v === "object" && v !== null &&
  typeof (v as Vec).x === "number" && typeof (v as Vec).y === "number";

/**
 * 取**资源级**的锚点。
 *
 * ⚠️ **`at` 是「锚点落在哪」，不是「左上角在哪」** —— 这条由资源包**自己**定死：
 *   角色的锚点是 `{x:.5, y:.95}`（**脚**），世界里的道具是 `{x:.5, y:1}`（底边中心），
 *   HUD 面板是 `{x:0, y:1}`（左下角），小方块是 `{x:0,y:0}`（左上角）。
 *   所以**一条规则管全部**：`at` 是锚点落点，盒子由「锚点 + 尺寸」推出来。
 *   ⚠️ 「玩家是特例」不是特例 —— 票 09 那句「锚点落在这一点上（角色的**脚**在这里）」
 *   只是这条通则在玩家身上的**一个例子**。
 *
 * ⚠️ **这里拿的是 manifest 上那一份（资源级），不是图集 JSON 里的逐帧那一份。**
 *   两者是**有意分开**的，而且分工不同：
 *   · **碰撞盒**用资源级锚点 + **标称尺寸**（manifest 的 `size`）—— 盒子的存在理由就是「稳定」，
 *     逐帧变化的盒子会让角色在播放动画时抖。
 *   · **绘制**用逐帧锚点 + 帧的真实尺寸 —— 那是 Phaser 自己做的
 *     （图集 JSON 的每帧 `anchor` → `Frame.customPivot` → `setCurrentFrame` 逐帧 `setOrigin`，
 *     实测于 phaser@3.90 源码，**外壳一行代码都不写**，票 25 的那条判据成立）。
 *   于是「跳起来收腿」这类逐帧锚点差异（票 40 量过 `jump2` −2.6px）**画得出来**，
 *   而碰撞盒不跟着抖。当前包每一帧的锚点都相同，两者恰好一致。
 */
function anchorOf(manifest: AssetPackManifest | null, assetId: string): Vec {
  const a = manifest?.assets.find((x) => x.id === assetId)?.anchor;
  return isVec(a) ? { x: a.x, y: a.y } : FALLBACK_ANCHOR;
}

/**
 * ⚠️ **盒子不在这里算** —— 用的是 `@game-maker/contracts` 的 `entityBox`。
 *   同一个公式曾经在三个地方各写一份（契约的校验器、这里的纯层、还有一份在票 48 之前），
 *   而「校验过的盒子」与「画出来的盒子」差一点点，正是**静默**糊掉像素的那种错。
 */
const boxAt = entityBox;

/**
 * 把一个引用解成「画得出来 / 画不出来」。
 *
 * ⚠️ 画不出来时**仍然给一个盒子** —— 占位符必须落在原位（票 32 裁决 3 的「出画布」）。
 *   尺寸取不出来就用兜底尺寸，锚点取不出来就用兜底锚点：**宁可位置差一点，不可什么都没有**。
 */
function resolveDraw(
  manifest: AssetPackManifest | null, at: Vec, ref: { asset: string; anim?: string },
  issues: Issue[], where: string, label: string, sizeOverride?: Size,
): Drawn {
  const res = manifest ? resolvePackRef(ref, manifest) : { ok: false as const, error: `没有资源包` };
  if (!res.ok) {
    issues.push({ severity: "error", where, message: `${label}：${res.error} —— 原位画占位符，游戏继续` });
    const size = sizeOverride ?? FALLBACK_SIZE;
    const anchor = anchorOf(manifest, ref.asset);
    return { missing: true, label, reason: res.error, ...boxToXYWH(boxAt(at, size, anchor)) };
  }
  const atlas = res.asset.atlasId;
  const image = manifest!.atlases.find((x) => x.id === atlas)?.image ?? atlas;
  // 背景那一支返回的是**全部帧**（层），没有「当前帧」这回事 —— 由调用方逐层取用
  const frame = res.frames[0];
  const size = sizeOverride ?? res.asset.size;
  const anchor = anchorOf(manifest, ref.asset);
  return {
    missing: false,
    atlas: image, frame: frame?.name ?? ref.asset,
    at: { x: at.x, y: at.y }, anchor, w: size.w, h: size.h,
  };
}

const boxToXYWH = (b: Box) => ({ x: b.x, y: b.y, w: b.w, h: b.h });

/** 兜底：连 config 都没有时，玩家也得有个盒子，否则渲染层没法把相机挂上去。 */
function fallbackPlayer(issues: Issue[]): PlayerDesc {
  const at: Vec = { x: 0, y: VIEWPORT.h };
  const box = boxAt(at, FALLBACK_SIZE, FALLBACK_ANCHOR);
  issues.push({ severity: "error", where: "player", message: `没有 game-config（或它不过 schema）—— 玩家用占位符顶上` });
  return {
    draw: { missing: true, label: "player", reason: "没有 game-config", ...boxToXYWH(box) },
    anims: {}, at, box, move: { speed: 90, jumpVelocity: 330, gravity: 900 },
  };
}

/**
 * **本票的中心**：把「一个资源包 + 一份 game-config」读成「一幅画 + 一堆盒子」。
 *
 * ⚠️ **它绝不抛** —— 传 `undefined`、传垃圾、传一份过不了 schema 的 config，
 *   都只会得到一份「全是占位符」的描述 + 一堆 `issues`。零数据也必须起得来（裁决 3）。
 *
 * @param manifest 资源包 manifest 的**原始 JSON**（未解析）
 * @param config   game-config 的**原始 JSON**（未解析）
 * @param opts.packBase 包内 `delivery/` 所在的**相对 URL 前缀**（票 03 实测：路径写死就是 404，
 *        而 Phaser 的 loader **静默失败**）
 */
export function buildWorld(
  manifest: unknown, config: unknown, opts: { packBase?: string } = {},
): WorldDescription {
  const issues: Issue[] = [];
  const base = opts.packBase ?? "";

  // ── 解析（失败**不抛**，只记 issue）──────────────────────────────────────
  const mp = parseAssetPack(manifest ?? {});
  const pack: AssetPackManifest | null = mp.ok ? mp.value : null;
  if (!mp.ok) for (const e of mp.errors.slice(0, 4)) issues.push({ severity: "error", where: "manifest", message: e });

  const cp = parseGameConfig(config ?? {});
  const cfg: GameConfig | null = cp.ok ? cp.value : null;
  if (!cp.ok) for (const e of cp.errors.slice(0, 6)) issues.push({ severity: "error", where: "game-config", message: e });

  // ── 要加载的图集 ────────────────────────────────────────────────────────
  const atlases: AtlasToLoad[] = (pack?.atlases ?? []).map((a) => ({
    key: a.image, json: `${base}${a.meta}`, image: `${base}${a.image}`,
  }));

  if (!pack) {
    return {
      shellVersion: SHELL_VERSION, viewport: { ...VIEWPORT }, worldSize: { ...VIEWPORT },
      atlases: [], issues,
      background: [], terrain: [], entities: [],
      hud: { panel: { draw: hudFallback("没有资源包"), box: { x: 0, y: 0, w: VIEWPORT.w, h: VIEWPORT.h } }, pips: [] },
      player: fallbackPlayer(issues), objective: { gate: "", pickupCount: 0 },
    };
  }
  if (!cfg) {
    return {
      shellVersion: SHELL_VERSION, viewport: { ...VIEWPORT }, worldSize: { ...VIEWPORT },
      atlases, issues,
      background: [], terrain: [], entities: [],
      hud: { panel: { draw: hudFallback("没有 game-config"), box: { x: 0, y: 0, w: VIEWPORT.w, h: VIEWPORT.h } }, pips: [] },
      player: fallbackPlayer(issues), objective: { gate: "", pickupCount: 0 },
    };
  }

  const W = cfg.world.size.w, H = cfg.world.size.h;

  // ── 背景：**一个资源 = 一摞层**（第 i 层 = 第 i 帧，票 24 的 Layer）────────
  const background: BackgroundLayer[] = [];
  {
    const ref = { asset: cfg.scene.background.asset };
    const res = resolvePackRef(ref, pack);
    if (!res.ok) {
      issues.push({ severity: "error", where: "scene.background", message: `${res.error} —— 原位画占位符，游戏继续` });
      background.push({
        draw: { missing: true, label: ref.asset, reason: res.error, x: 0, y: 0, w: VIEWPORT.w, h: VIEWPORT.h },
        parallax: 0, tileX: false, tileY: false, box: { x: 0, y: 0, w: VIEWPORT.w, h: VIEWPORT.h },
      });
    } else {
      const layers = res.asset.layers ?? [];
      const image = pack.atlases.find((x) => x.id === res.asset.atlasId)?.image ?? res.asset.atlasId;
      // ⚠️ 层数与本资源帧数应当一一对应（票 24 的 `Layer` 注释）—— 对不上就是包坏了，报出来
      if (layers.length !== res.frames.length)
        issues.push({
          severity: "error", where: "scene.background",
          message: `资源 "${ref.asset}" 有 ${layers.length} 层却有 ${res.frames.length} 帧 —— 层与帧必须一一对应（第 i 层 = 第 i 帧）`,
        });
      const n = Math.max(layers.length, 1);
      for (let i = 0; i < n; i++) {
        const layer = layers[i];
        const frame = res.frames[i];
        if (!frame) {
          issues.push({ severity: "error", where: `scene.background[${i}]`, message: `第 ${i} 层没有对应的帧` });
          continue;
        }
        const parallax = layer?.parallax ?? 0;
        const tileX = layer?.tileable?.x ?? false, tileY = layer?.tileable?.y ?? false;
        const anchor = anchorOf(pack, ref.asset);
        // ⚠️ 层的尺寸用**资源的标称尺寸**（manifest 的 `size`）—— 各帧真实尺寸只住在图集 JSON 里，
        //   而纯函数读不到它（那是运行时要加载的东西）。当前包 `trimmed: false`，两者一致。
        // ⚠️ **可平铺的层铺满整个世界宽**：视差 p 的层要盖住宽 W 的世界，
        //   铺到 W 就恒成立（`(W−V)(1−p) ≥ 0`，p ≤ 1 恒真）—— 这条是算出来的，不是拍的
        const nom = res.asset.size;
        const w = tileX ? W : nom.w, h = tileY ? H : nom.h;
        background.push({
          draw: {
            missing: false,
            atlas: image, frame: frame.name,
            at: { x: 0, y: 0 }, anchor, w: nom.w, h: nom.h,
          },
          parallax, tileX, tileY, box: boxAt({ x: 0, y: 0 }, { w, h }, anchor),
        });
      }
    }
  }

  // ── 地形（看不见的碰撞）与实体（看得见的）──────────────────────────────
  const terrain: Box[] = cfg.terrain.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));

  const entities: EntityDesc[] = cfg.entities.map((e) => {
    const draw = resolveDraw(pack, e.at, { asset: e.asset, ...(e.anim ? { anim: e.anim } : {}) },
      issues, `entity "${e.id}"`, e.asset, e.body);
    const size = e.body ?? assetSize(pack, e.asset) ?? FALLBACK_SIZE;
    const anchor = anchorOf(pack, e.asset);
    const res = resolvePackRef({ asset: e.asset, ...(e.anim ? { anim: e.anim } : {}) }, pack);
    return {
      id: e.id, kind: e.kind, box: boxAt(e.at, size, anchor), draw,
      ...(res.ok && res.frames.length > 1 ? { frames: res.frames.map((f) => f.name) } : {}),
      ...(e.motion ? { motion: e.motion } : {}),
    };
  });

  // ── 玩家 ────────────────────────────────────────────────────────────────
  const playerSize = assetSize(pack, cfg.player.asset) ?? FALLBACK_SIZE;
  const playerAnchor = anchorOf(pack, cfg.player.asset);
  const anims: Record<string, string[]> = {};
  for (const [action, anim] of Object.entries(cfg.player.anims)) {
    const r = resolvePackRef({ asset: cfg.player.asset, anim }, pack);
    if (r.ok) anims[action] = r.frames.map((f) => f.name);
    else issues.push({ severity: "error", where: `player.anims.${action}`, message: r.error });
  }
  // ⚠️ **不能拿 `{ asset }` 去解玩家本体** —— 它按定义有多个动画，那样必然撞上
  //   「必须指明 anim」（票 41 抓到过同一个坑：把「这个 id 是不是 animation」
  //   与「这个引用画的是哪一帧」当成了一回事）。
  //   这里要的只是「动画跑起来之前别空着」，所以拿**第一个解得动的动作**当起点 ——
  //   真帧由渲染层的动画接管。
  const seedAction = (anims.idle ? "idle" : Object.keys(anims)[0]) as keyof typeof cfg.player.anims | undefined;
  const seedRef = seedAction
    ? { asset: cfg.player.asset, anim: cfg.player.anims[seedAction] }
    : { asset: cfg.player.asset };
  const player: PlayerDesc = {
    draw: resolveDraw(pack, cfg.player.at, seedRef, issues, "player", cfg.player.asset),
    anims, at: cfg.player.at, box: boxAt(cfg.player.at, playerSize, playerAnchor),
    move: cfg.player.move ?? DEFAULT_MOVE,
  };

  // ── HUD ─────────────────────────────────────────────────────────────────
  const pickups = cfg.entities.filter((e) => e.kind === "pickup").length;
  const panelSize = cfg.hud.panel.size;
  const hudPanel = resolveDraw(pack, cfg.hud.panel.at, { asset: cfg.hud.panel.asset },
    issues, "hud.panel", cfg.hud.panel.asset, panelSize);
  const pipSize = assetSize(pack, cfg.hud.pip.asset) ?? FALLBACK_SIZE;
  const pipAnchor = anchorOf(pack, cfg.hud.pip.asset);
  const pips = Array.from({ length: pickups }, (_, i) => {
    const at = { x: cfg.hud.pip.at.x + i * cfg.hud.pip.step.x, y: cfg.hud.pip.at.y + i * cfg.hud.pip.step.y };
    return {
      draw: resolveDraw(pack, at, { asset: cfg.hud.pip.asset }, issues, `hud.pip[${i}]`, cfg.hud.pip.asset),
      at, box: boxAt(at, pipSize, pipAnchor),
    };
  });

  // 终点实体在不在 —— 校验期已挡过，这里只再确认一次（坏数据要显形）
  if (!cfg.entities.some((e) => e.id === cfg.objective.gate && e.kind === "goal"))
    issues.push({ severity: "error", where: "objective.gate", message: `找不到 id 为 "${cfg.objective.gate}" 的 goal 实体` });

  return {
    shellVersion: SHELL_VERSION, viewport: { ...VIEWPORT }, worldSize: { w: W, h: H }, atlases, issues,
    background, terrain, entities, player,
    hud: { panel: { draw: hudPanel, box: boxAt(cfg.hud.panel.at, panelSize, anchorOf(pack, cfg.hud.panel.asset)) }, pips },
    objective: { gate: cfg.objective.gate, pickupCount: pickups },
  };
}

const DEFAULT_MOVE = { speed: 90, jumpVelocity: 330, gravity: 900 } as const;

function assetSize(pack: AssetPackManifest | null, id: string): Size | null {
  return pack?.assets.find((a) => a.id === id)?.size ?? null;
}

function hudFallback(reason: string): Missing {
  return { missing: true, label: "hud.panel", reason, x: 0, y: 0, w: VIEWPORT.w, h: VIEWPORT.h };
}

/** 把 issues 拼成人类读的行 —— 与壳打控制台警告**同一份**。 */
export const formatIssue = (i: Issue): string => `[${i.severity}] ${i.where}: ${i.message}`;
