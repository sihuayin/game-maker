// **塔防外壳的渲染层**（薄）。
//
// ⚠️ **它没有玩法**。出怪、索敌、伤害、减速、经济、胜负**全部**在 `td/sim.ts` 里，
//   而那是个纯函数 —— 所以这个玩法可以在 vitest 里零浏览器地测
//   （这正是加塔防时对「外壳薄到没什么可测的」那条判据的交代）。
//   这一层只做三件事：**把状态铺成精灵 · 把点击收成动作 · 每帧推进一次模拟**。
//
// ⚠️ **`?auto=1` 不是作弊码**，是**探针的参考玩家**：它把 `autoPlay()` 产出的动作
//   喂给**同一个** `advance()`，与鼠标点出来的走的是同一条路。无头浏览器截不出「点击」，
//   而一张静止的截图必须能证明「建塔 → 出怪 → 交火 → 结算」这条链真的转过。
//   断言也不靠看像素：过程里把 `data-td-state` 写在 `<html>` 上，探针读那个。
//
// ⚠️ **alpha 是这里唯一的表现手段**，不用 `setTint` —— 染色会产出色板之外的颜色，
//   而「颜色 ∈ 色板」在这套资源上是构造上成立的（票 36）。alpha 混合在契约里是
//   **说明白了的**那一种（`composited`，票 36 的裁决），所以受击闪一下用 alpha。
import Phaser from "phaser";
import { BURST_MS, FIXED_DT_MS, advance, autoPlay, createSim, enemyPos, simSnapshot, type TdAction, type TdState } from "../../td/sim.js";
import { formatIssue, type TdWorldDescription } from "../../td/world.js";

const PLACEHOLDER = "__td_placeholder__";
const DEPTH_TILE = 0, DEPTH_SLOT = 5, DEPTH_CORE = 8, DEPTH_TOWER = 15, DEPTH_ENEMY = 20, DEPTH_FX = 30, DEPTH_HUD = 40;
/** 敌人按「走得远近」分层，走得远的画在上面（否则远处的会从近处的身体里穿出来）。 */
const DEPTH_ENEMY_SPAN = 400;
/** 受击闪一下的透明度。**不染色**，理由见文件头。 */
const HIT_ALPHA = 0.55;

export function createTdScene(world: TdWorldDescription): new () => Phaser.Scene {
  const VW = world.viewport.w, VH = world.viewport.h;

  return class TdScene extends Phaser.Scene {
    private state: TdState = createSim(world);
    private pending: TdAction[] = [];
    private selected: string | null = null;

    private enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
    private towerSprites = new Map<string, Phaser.GameObjects.Image>();
    private projSprites = new Map<number, Phaser.GameObjects.Image>();
    private burstSprites = new Map<number, Phaser.GameObjects.Sprite>();
    private slotImages = new Map<string, Phaser.GameObjects.Image>();
    private slotRings = new Map<string, Phaser.GameObjects.Image>();
    private buttonArt = new Map<string, Phaser.GameObjects.Image>();
    private readout: Phaser.GameObjects.Text[] = [];
    private lastPublished = "";

    constructor() { super({ key: "td" }); }

    preload(): void {
      for (const a of world.atlases) this.load.atlas(a.key, a.image, a.json);
    }

    create(): void {
      for (const i of world.issues) console.warn(formatIssue(i));
      console.log(`[shell] 塔防 v${world.shellVersion} · 视口 ${VW}×${VH} · 场地 ${world.arena.cols}×${world.arena.rows} 格 · ` +
        `${world.waves.length} 波 · ${world.slots.length} 插槽 · ${world.arena.tiles.length} 块砖`);
      this.makePlaceholderTexture();
      this.cameras.main.setBackgroundColor("#000000");

      this.drawArena();
      this.drawCore();
      this.drawSlots();
      this.buildAnims();
      this.drawHud();
      this.sync();

      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onClick(p.worldX, p.worldY));

      // 探针的参考玩家：把这段游戏时间**先算完**再画第一帧。
      // 于是截图里是**一个确定的时刻**，而不是「跑了几秒算几秒」。
      const q = new URLSearchParams(globalThis.location?.search ?? "");
      if (q.get("auto") === "1") this.fastForward(Number(q.get("ms") ?? 18000));

      // ⚠️ **第一帧之前先报一次状态**。`update()` 会不会在截图之前跑到，取决于
      //   无头 Chrome 在 `--virtual-time-budget` 里发了几次 rAF —— 而那是**不可靠的**：
      //   同一个站点两次跑，一次有快照一次没有。探针的判据不能建在一个会飘的东西上。
      this.publish();
    }

    update(_t: number, delta: number): void {
      const actions = this.pending;
      this.pending = [];
      this.state = advance(this.state, delta, actions, world);
      this.sync();
      this.publish();
    }

    // ── 以下全是「铺开」，没有判断 ────────────────────────────────────────────

    private makePlaceholderTexture(): void {
      if (this.textures.exists(PLACEHOLDER)) return;
      const t = this.textures.createCanvas(PLACEHOLDER, 8, 8);
      if (!t) return;
      const ctx = t.getContext();
      ctx.fillStyle = "#ff00ff"; ctx.fillRect(0, 0, 8, 8);
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, 4, 4); ctx.fillRect(4, 4, 4, 4);
      t.refresh();
    }

    /** 坏数据要**显形**：品红/黑棋盘 + 原位标签，游戏继续。 */
    private placeholder(x: number, y: number, w: number, h: number, label: string, depth: number): void {
      this.add.image(x, y, PLACEHOLDER).setOrigin(0, 0).setDepth(depth).setDisplaySize(Math.max(1, w), Math.max(1, h));
      this.add.text(x + 1, y + 1, label, { fontSize: "7px", color: "#ffffff", backgroundColor: "#000000c0" }).setDepth(depth + 1);
    }

    private img(d: { missing: boolean; atlas?: string; frame?: string; anchor?: { x: number; y: number } },
                x: number, y: number, w: number, h: number, label: string, depth: number): Phaser.GameObjects.Image | null {
      if (d.missing) { this.placeholder(x, y, w, h, label, depth); return null; }
      return this.add.image(x, y, d.atlas!, d.frame!).setOrigin(d.anchor!.x, d.anchor!.y).setDepth(depth);
    }

    private drawArena(): void {
      for (const t of world.arena.tiles) this.img(t.draw, t.box.x, t.box.y, t.box.w, t.box.h, "砖", DEPTH_TILE);
    }

    private drawCore(): void {
      const c = world.core;
      this.img(c.draw, c.box.x, c.box.y, c.box.w, c.box.h, "柜台", DEPTH_CORE);
    }

    private drawSlots(): void {
      for (const s of world.slots) {
        const go = this.img(s.draw, s.box.x, s.box.y, s.box.w, s.box.h, s.id, DEPTH_SLOT);
        if (go) this.slotImages.set(s.id, go);
        const r = world.slotActive.draw;
        if (!r.missing) {
          const ring = this.add.image(s.at.x, s.at.y, r.atlas, r.frame)
            .setOrigin(r.anchor.x, r.anchor.y).setDepth(DEPTH_SLOT + 1).setVisible(false);
          this.slotRings.set(s.id, ring);
        }
      }
    }

    private buildAnims(): void {
      for (const e of world.enemies) {
        if (e.draw.missing || e.frames.length === 0) continue;
        const key = `td-${e.id}`;
        if (!this.anims.exists(key))
          this.anims.create({ key, frames: e.frames.map((f) => ({ key: e.draw.missing ? "" : e.draw.atlas, frame: f })), frameRate: 6, repeat: -1 });
      }
    }

    private txt(x: number, y: number, s: string, size = "8px"): Phaser.GameObjects.Text {
      return this.add.text(x, y, s, { fontSize: size, color: "#ead8a6" }).setDepth(DEPTH_HUD + 2);
    }

    private drawHud(): void {
      const panel = world.hud.panel;
      const p = panel.draw;
      if (p.missing) this.placeholder(panel.box.x, panel.box.y, panel.box.w, panel.box.h, "HUD", DEPTH_HUD);
      else {
        // 九宫格：边界值由图集 JSON 的每帧 `scale9Borders` 带进来，Phaser 零参数自动读。
        // ⚠️ **判据是渲染器，不是「工厂在不在」**（2026-09-29 实测）：Phaser 在 Canvas 构建里
        //   也注册 `nineslice` 工厂，而**Canvas 渲染器画不出 NineSlice** ——
        //   对象进了显示列表、几何全对、`visible=true`，就是**一个像素都不画**，控制台一声不吭。
        //   第一版判 `typeof this.add.nineslice === "function"`，于是无头 Chrome（Canvas 回退）
        //   下整条顶栏不见 —— 正是本项目最怕的那种「看起来在跑，其实是空的」的失败。
        const s9 = (this.textures.getFrame(p.atlas, p.frame)?.customData as { scale9Borders?: unknown } | undefined)?.scale9Borders;
        const canNine = this.game.renderer.type === Phaser.WEBGL;
        if (s9 && !canNine)
          console.warn("[warning] hud.panel: 这个渲染器不支持九宫格（Canvas 回退）—— 面板退回普通拉伸");
        const go = s9 && canNine
          ? this.add.nineslice(panel.box.x, panel.box.y, p.atlas, p.frame, panel.box.w, panel.box.h)
          : this.add.image(p.at.x, p.at.y, p.atlas, p.frame);
        go.setOrigin(p.anchor.x, p.anchor.y).setDepth(DEPTH_HUD);
        // ⚠️ 普通 image 那一路**必须自己拉伸** —— 它画的是资源的原生尺寸（96×26），
        //   不拉的话顶栏只盖住左上角一小块，而读数文字会压在砖上读不出来。
        if (!(s9 && canNine)) go.setDisplaySize(panel.box.w, panel.box.h);
      }

      for (const d of [world.hud.icons.scrap, world.hud.icons.life])
        if (!d.missing) this.add.image(d.at.x, d.at.y, d.atlas, d.frame).setOrigin(d.anchor.x, d.anchor.y).setDepth(DEPTH_HUD + 1);

      // 三行读数：位置是数据，**顺序是外壳的约定**（契约里写着）
      for (let i = 0; i < 3; i++) {
        const at = { x: world.hud.readout.at.x + i * world.hud.readout.step.x, y: world.hud.readout.at.y + i * world.hud.readout.step.y };
        this.readout.push(this.txt(at.x, at.y, ""));
      }

      // 机关按钮：**条数 = 机关种类数**（派生），位置来自配置
      for (const b of world.hud.buttons) {
        const spec = world.towers.find((t) => t.id === b.towerId);
        const go = this.img(b.draw, b.box.x, b.box.y, b.box.w, b.box.h, b.towerId, DEPTH_HUD);
        if (go) this.buttonArt.set(b.towerId, go);
        this.txt(b.at.x + 3, b.at.y + 2, spec?.name ?? b.towerId, "7px");
        this.txt(b.at.x + 3, b.at.y + 11, `${spec?.cost ?? 0}`, "7px");
      }
      const sb = world.hud.start;
      this.img(sb.draw, sb.box.x, sb.box.y, sb.box.w, sb.box.h, "开波", DEPTH_HUD);
      this.txt(sb.at.x + 4, sb.at.y + 8, "开波", "7px");
    }

    private sync(): void {
      const s = this.state;

      // ── 敌人 ──────────────────────────────────────────────────────────────
      const liveEnemies = new Set<number>();
      for (const e of s.enemies) {
        liveEnemies.add(e.id);
        const spec = world.enemies.find((x) => x.id === e.enemyId);
        if (!spec || spec.draw.missing) continue;
        const at = enemyPos(world, e);
        let sp = this.enemySprites.get(e.id);
        if (!sp) {
          sp = this.add.sprite(at.x, at.y, spec.draw.atlas, spec.draw.frame)
            .setOrigin(spec.draw.anchor.x, spec.draw.anchor.y);
          this.enemySprites.set(e.id, sp);
          if (spec.frames.length > 1 && this.anims.exists(`td-${spec.id}`)) sp.play(`td-${spec.id}`);
        }
        sp.setPosition(at.x, at.y);
        sp.setAlpha(e.flashUntil > s.ms ? HIT_ALPHA : 1);
        sp.setDepth(DEPTH_ENEMY + Math.round((e.dist / Math.max(1, world.path.total)) * DEPTH_ENEMY_SPAN));
      }
      for (const [id, sp] of this.enemySprites) if (!liveEnemies.has(id)) { sp.destroy(); this.enemySprites.delete(id); }

      // ── 机关 ──────────────────────────────────────────────────────────────
      const built = new Set(s.towers.map((t) => t.slotId));
      for (const t of s.towers) {
        if (this.towerSprites.has(t.slotId)) continue;
        const spec = world.towers.find((x) => x.id === t.towerId);
        const slot = world.slots.find((x) => x.id === t.slotId);
        if (!spec || !slot || spec.draw.missing) continue;
        this.towerSprites.set(t.slotId, this.add.image(slot.at.x, slot.at.y, spec.draw.atlas, spec.draw.frame)
          .setOrigin(spec.draw.anchor.x, spec.draw.anchor.y).setDepth(DEPTH_TOWER));
      }
      for (const [id, sp] of this.towerSprites) if (!built.has(id)) { sp.destroy(); this.towerSprites.delete(id); }
      // 建了塔的插槽就把空插槽的图藏起来（不然机器下面还压着一个检修口）
      for (const [id, go] of this.slotImages) go.setVisible(!built.has(id));

      // ── 抛射物：位置由模拟给的 from/to 插出来 ─────────────────────────────
      const liveProj = new Set<number>();
      for (const p of s.projectiles) {
        liveProj.add(p.id);
        const spec = world.towers.find((x) => x.id === p.towerId);
        if (!spec?.projectile || spec.projectile.draw.missing) continue;
        const d = spec.projectile.draw;
        let sp = this.projSprites.get(p.id);
        if (!sp) {
          sp = this.add.image(p.from.x, p.from.y, d.atlas, d.frame).setOrigin(d.anchor.x, d.anchor.y).setDepth(DEPTH_FX);
          this.projSprites.set(p.id, sp);
        }
        const k = Math.min(1, p.tMs / p.durMs);
        sp.setPosition(p.from.x + (p.to.x - p.from.x) * k, p.from.y + (p.to.y - p.from.y) * k);
      }
      for (const [id, sp] of this.projSprites) if (!liveProj.has(id)) { sp.destroy(); this.projSprites.delete(id); }

      // ── 开火特效：按 id 复用精灵，帧由「播了多久」决定 ────────────────────
      const liveBursts = new Set<number>();
      for (const b of s.bursts) {
        liveBursts.add(b.id);
        const spec = world.towers.find((t) => t.fx !== undefined && t.attack === "aoe");
        const fx = spec?.fx;
        if (!fx || fx.draw.missing || fx.frames.length === 0) continue;
        const d = fx.draw;
        let sp = this.burstSprites.get(b.id);
        if (!sp) {
          sp = this.add.sprite(b.at.x, b.at.y, d.atlas, fx.frames[0]!).setOrigin(d.anchor.x, d.anchor.y).setDepth(DEPTH_FX - 1);
          this.burstSprites.set(b.id, sp);
        }
        const k = Math.max(0, Math.min(1, (s.ms - b.startMs) / BURST_MS));
        sp.setFrame(fx.frames[Math.min(fx.frames.length - 1, Math.floor(k * fx.frames.length))]!);
      }
      for (const [id, sp] of this.burstSprites) if (!liveBursts.has(id)) { sp.destroy(); this.burstSprites.delete(id); }

      // ── 选中态 ────────────────────────────────────────────────────────────
      for (const [id, ring] of this.slotRings) ring.setVisible(this.selected !== null && !built.has(id));
      for (const [id, go] of this.buttonArt) go.setAlpha(this.selected === null || this.selected === id ? 1 : 0.65);

      // ── 读数 ──────────────────────────────────────────────────────────────
      const lines = [`${s.scrap}`, `${s.lives}`, `${Math.min(s.wave + 1, world.waves.length)}/${world.waves.length}`];
      if (s.phase === "won") lines[2] = "守住了";
      if (s.phase === "lost") lines[2] = "被抢空";
      this.readout.forEach((t, i) => t.setText(lines[i] ?? ""));
    }

    /** 把状态写在 `<html data-td-state>` 上 —— 探针断言读它，比截图可靠。 */
    private publish(): void {
      const json = JSON.stringify(simSnapshot(this.state));
      if (json === this.lastPublished) return;
      this.lastPublished = json;
      (globalThis as { document?: Document }).document?.documentElement?.setAttribute("data-td-state", json);
    }

    // ── 输入：只把点击**翻译成动作**，判断全在纯层 ─────────────────────────

    private onClick(x: number, y: number): void {
      if (this.state.phase === "won" || this.state.phase === "lost") return;
      const inside = (b: { x: number; y: number; w: number; h: number }) =>
        x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

      for (const b of world.hud.buttons)
        if (inside(b.box)) { this.selected = this.selected === b.towerId ? null : b.towerId; return; }
      if (inside(world.hud.start.box)) { this.pending.push({ kind: "start-wave" }); return; }

      for (const s of world.slots) {
        if (!inside(s.box) && Math.hypot(x - s.at.x, y - s.at.y) > 10) continue;
        const built = this.state.towers.find((t) => t.slotId === s.id);
        if (built) { if (built.level === 0) this.pending.push({ kind: "upgrade", slotId: s.id }); return; }
        if (this.selected) this.pending.push({ kind: "build", slotId: s.id, towerId: this.selected });
        return;
      }
    }

    /**
     * 探针用的参考玩家：把 `ms` 毫秒的游戏时间**先算完**。
     * ⚠️ 走的是**同一个** `advance()` 与**同一个** `autoPlay()` —— 没有第二条代码路径。
     */
    private fastForward(ms: number): void {
      const steps = Math.max(0, Math.floor(ms / FIXED_DT_MS));
      for (let i = 0; i < steps; i++) this.state = advance(this.state, FIXED_DT_MS, autoPlay(this.state, world), world);
      console.log(`[shell] 参考玩家先跑了 ${ms}ms → ${JSON.stringify(simSnapshot(this.state))}`);
    }
  };
}
