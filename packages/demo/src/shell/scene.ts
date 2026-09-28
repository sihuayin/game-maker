// 薄渲染层（票 32 裁决 4 的下一半）。
//
// ⚠️ **判据是它薄到没什么可测的** —— 所有判断都在 `buildWorld` 里做完了，这里只把那份
//   描述**铺开**：摆精灵、喂碰撞盒、刷 HUD、同步相机。**这里不许出现「如果数据是 X 就 Y」**。
//
// ⚠️ 唯一的例外是**能力探测**（这个帧有没有九宫格数据、这个纹理建没建过）——
//   那是渲染器自己的事，与数据无关。
import Phaser from "phaser";
import { formatIssue, type Box, type Drawn, type WorldDescription } from "../world.js";

/** 占位符的纹理名。**品红/黑棋盘** —— 票 32 裁决 3 要的是「刺眼」，不是好看。 */
const PLACEHOLDER = "__placeholder__";
const DEPTH_BG = 0, DEPTH_ENTITY = 10, DEPTH_PLAYER = 20, DEPTH_HUD = 30;

export function createScene(world: WorldDescription): new () => Phaser.Scene {
  const VW = world.viewport.w, VH = world.viewport.h;

  return class ShellScene extends Phaser.Scene {
    private player?: Phaser.Physics.Arcade.Sprite;
    private solids?: Phaser.Physics.Arcade.StaticGroup;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private keys?: Record<string, Phaser.Input.Keyboard.Key>;
    private hazards: { sprite: Phaser.GameObjects.Image; start: number; axis: "x" | "y"; distance: number; periodMs: number; t0: number }[] = [];
    private pickups: Phaser.GameObjects.Image[] = [];
    private gate?: Phaser.GameObjects.Image;
    private pips: Phaser.GameObjects.GameObject[] = [];
    private collected = 0;
    private won = false;

    constructor() { super({ key: "shell" }); }

    preload(): void {
      // ⚠️ 路径全部是**相对本站点目录**的（票 03 实测：写死就是 404，而 Phaser 静默失败）
      for (const a of world.atlases) this.load.atlas(a.key, a.image, a.json);
    }

    create(): void {
      // ⚠️ **坏数据要让「坏了」自己显形**（票 32 裁决 3）—— 先把它全喊出来
      for (const i of world.issues) console.warn(formatIssue(i));
      console.log(`[shell] v${world.shellVersion} · 视口 ${VW}×${VH} · 世界 ${world.worldSize.w}×${world.worldSize.h} · ${world.atlases.length} 张图集`);

      this.makePlaceholderTexture();
      this.solids = this.physics.add.staticGroup();

      // 背景：远 → 近（`layers` 的顺序就是远到近）
      world.background.forEach((l, i) => this.addBackgroundLayer(l, DEPTH_BG + i));

      // 地形（看不见的碰撞）
      for (const t of world.terrain) this.addSolid(t);

      // 实体
      for (const e of world.entities) this.addEntity(e);

      // 玩家
      this.addPlayer();

      // HUD
      this.addHud();

      // 相机：水平跟随 + clamp 到世界（票 32 裁决 2）。垂直不动 ——
      // 世界高 = 视口高时，clamp 天然把 scrollY 钉在 0
      const cam = this.cameras.main;
      cam.setBounds(0, 0, world.worldSize.w, world.worldSize.h);
      if (this.player) cam.startFollow(this.player, false, 1, 1);

      this.cursors = this.input.keyboard?.createCursorKeys();
      this.keys = this.input.keyboard?.addKeys("A,D,W,S,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    }

    update(_time: number, delta: number): void {
      this.advanceHazards(delta);
      if (!this.player) return;
      const m = world.player.move;
      const left = this.cursors?.left.isDown || this.keys?.A?.isDown;
      const right = this.cursors?.right.isDown || this.keys?.D?.isDown;
      const jump = this.cursors?.up.isDown || this.cursors?.space.isDown || this.keys?.W?.isDown || this.keys?.SPACE?.isDown;

      this.player.setVelocityX(left ? -m.speed : right ? m.speed : 0);
      const onFloor = this.player.body?.blocked.down ?? false;
      if (jump && onFloor) this.player.setVelocityY(-m.jumpVelocity);

      // 动画：**显式映射**（票 09 裁决 10）—— 名字全来自 config，壳不猜
      const want = !onFloor ? "jump" : (left || right) ? "run" : "idle";
      if (world.player.anims[want] && this.player.anims.currentAnim?.key !== want) this.player.play(want, true);
    }

    // ── 以下全是「铺开」，没有判断 ──────────────────────────────────────────

    /** 棋盘纹理只建一次。⚠️ 这是**渲染能力**，不是数据。 */
    private makePlaceholderTexture(): void {
      if (this.textures.exists(PLACEHOLDER)) return;
      const t = this.textures.createCanvas(PLACEHOLDER, 8, 8);
      if (!t) return;
      const ctx = t.getContext();
      ctx.fillStyle = "#ff00ff"; ctx.fillRect(0, 0, 8, 8);
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, 4, 4); ctx.fillRect(4, 4, 4, 4);
      t.refresh();
    }

    private addBackgroundLayer(l: WorldDescription["background"][number], depth: number): void {
      const d = l.draw;
      if (d.missing) { this.addPlaceholder(d, depth, l.parallax); return; }
      const go = l.tileX || l.tileY
        ? this.add.tileSprite(l.box.x, l.box.y, l.box.w, l.box.h, d.atlas, d.frame).setOrigin(0, 0)
        : this.add.image(d.at.x, d.at.y, d.atlas, d.frame).setOrigin(d.anchor.x, d.anchor.y);
      go.setDepth(depth).setScrollFactor(l.parallax);
    }

    private addPlaceholder(d: Extract<Drawn, { missing: true }>, depth: number, scrollFactor = 1): Phaser.GameObjects.TileSprite {
      const ts = this.add.tileSprite(d.x, d.y, Math.max(1, d.w), Math.max(1, d.h), PLACEHOLDER).setOrigin(0, 0);
      ts.setDepth(depth).setScrollFactor(scrollFactor);
      this.add.text(d.x + 2, d.y + 2, `${d.label}\n${d.reason}`, {
        fontSize: "8px", color: "#ffffff", backgroundColor: "#000000c0", wordWrap: { width: Math.max(40, d.w - 4) },
      }).setDepth(depth + 100).setScrollFactor(scrollFactor);
      return ts;
    }

    private addSolid(b: Box): void {
      const r = this.add.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, 0x000000, 0);
      this.solids!.add(r);
    }

    private addEntity(e: WorldDescription["entities"][number]): void {
      const d = e.draw;
      if (d.missing) { this.addPlaceholder(d, DEPTH_ENTITY); return; }

      // ⚠️ 用 `sprite` 不用 `image` —— 带帧的实体要能 `play`（`Sprite extends Image`）
      const sprite = this.add.sprite(d.at.x, d.at.y, d.atlas, d.frame).setOrigin(d.anchor.x, d.anchor.y).setDepth(DEPTH_ENTITY);
      // 若资源是 animation：用**清单给的帧名**建一个动画并播上（壳不解析帧名的含义）
      if (e.frames && e.frames.length > 1) {
        const key = `${e.id}#play`;
        if (!this.anims.exists(key))
          this.anims.create({ key, frames: e.frames.map((f) => ({ key: d.atlas, frame: f })), frameRate: 8, repeat: -1 });
        sprite.play(key);
      }

      switch (e.kind) {
        case "solid": this.addSolid(e.box); break;
        case "pickup": {
          this.physics.add.existing(sprite, true);
          this.pickups.push(sprite);
          this.physics.add.overlap(this.playerOrStub(), sprite, () => this.collect(sprite));
          break;
        }
        case "hazard": {
          this.physics.add.existing(sprite, true);
          this.hazards.push({ sprite, start: e.motion?.axis === "y" ? d.at.y : d.at.x, axis: e.motion?.axis ?? "x", distance: e.motion?.distance ?? 0, periodMs: e.motion?.periodMs ?? 1000, t0: 0 });
          this.physics.add.overlap(this.playerOrStub(), sprite, () => this.hitHazard());
          break;
        }
        case "goal": {
          this.physics.add.existing(sprite, true);
          this.gate = sprite;
          this.physics.add.overlap(this.playerOrStub(), sprite, () => this.tryWin());
          break;
        }
        case "decor": break;
      }
    }

    /** ⚠️ 玩家可能还没建（占位符顶上时）—— overlap 需要一个对象，先用一个空的静态体顶着。 */
    private stub?: Phaser.GameObjects.Rectangle;
    private playerOrStub(): Phaser.GameObjects.GameObject {
      if (this.player) return this.player;
      if (!this.stub) {
        this.stub = this.add.rectangle(0, 0, 1, 1, 0, 0);
        this.physics.add.existing(this.stub, true);
      }
      return this.stub;
    }

    private addPlayer(): void {
      const d = world.player.draw;
      if (d.missing) { this.addPlaceholder(d, DEPTH_PLAYER); return; }
      // ⚠️ **不自己 setOrigin** —— 图集每帧的 `anchor` 会被 Phaser 逐帧设成 origin
      //   （`Frame.customPivot` → `setCurrentFrame`，实测于 phaser@3.90）。
      //   这里设一次初值只是为了第一帧动画还没跑起来时不闪。
      const s = this.physics.add.sprite(world.player.at.x, world.player.at.y, d.atlas, d.frame).setOrigin(d.anchor.x, d.anchor.y).setDepth(DEPTH_PLAYER);
      const b = world.player.box;
      s.body!.setSize(b.w, b.h, false);
      s.setGravityY(world.player.move.gravity);
      this.player = s;
      for (const [action, frames] of Object.entries(world.player.anims)) {
        if (frames.length === 0) continue;
        if (!this.anims.exists(action))
          this.anims.create({ key: action, frames: frames.map((f) => ({ key: d.atlas, frame: f })), frameRate: action === "run" ? 10 : 6, repeat: -1 });
      }
      if (world.player.anims.idle) s.play("idle");
      if (this.solids) this.physics.add.collider(s, this.solids);
    }

    private addHud(): void {
      const p = world.hud.panel;
      if (p.missing) { this.addPlaceholder(p, DEPTH_HUD, 0); }
      else {
        // ⚠️ 九宫格：边界值由**图集 JSON 的每帧 `scale9Borders`** 带进来
        //   （票 25 定的家），Phaser 零参数自动读。探测走 `Frame.customData` ——
        //   那是 JSONHash 解析器抄进来的**原始每帧 JSON**，不是我们自己记的第二份。
        const s9 = (this.textures.getFrame(p.atlas, p.frame)?.customData as { scale9Borders?: unknown } | undefined)?.scale9Borders;
        // ⚠️ `nineslice` 这个工厂**只在 WebGL 构建里注册**（票 25 查过 Phaser 源码：`仅 WebGL`）。
        //   Canvas 回退下它是 `undefined` —— 直接调用就是一个 TypeError，而**壳不许崩**
        //   （裁决 3 的精神：环境不完美也要起得来，只是要说出来）。
        const canNine = typeof (this.add as { nineslice?: unknown }).nineslice === "function";
        if (s9 && !canNine)
          console.warn("[warning] hud.panel: 这个渲染器不支持九宫格（Phaser 的 nineslice 仅 WebGL）—— 面板退回普通拉伸");
        const go = s9 && canNine
          ? this.add.nineslice(p.at.x, p.at.y, p.atlas, p.frame, p.w, p.h)
          : this.add.image(p.at.x, p.at.y, p.atlas, p.frame);
        go.setOrigin(p.anchor.x, p.anchor.y).setDepth(DEPTH_HUD).setScrollFactor(0);
      }
      for (const pip of world.hud.pips) {
        const d = pip.draw;
        if (d.missing) continue;                       // 槽位画不出来就少画一个，不打断
        const go = this.add.image(d.at.x, d.at.y, d.atlas, d.frame)
          .setOrigin(d.anchor.x, d.anchor.y).setDepth(DEPTH_HUD + 1).setScrollFactor(0).setVisible(false);
        this.pips.push(go);
      }
    }

    // ── 玩法：三条写死的规则（票 32 的成分清单）────────────────────────────

    private advanceHazards(delta: number): void {
      for (const h of this.hazards) {
        h.t0 += delta;
        if (h.distance <= 0 || h.periodMs <= 0) continue;
        // 单程 distance、周期 periodMs 的往返：三角波
        const phase = (h.t0 % h.periodMs) / h.periodMs;
        const k = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        const p = h.start + k * h.distance;
        const b = h.sprite.body as Phaser.Physics.Arcade.StaticBody;
        if (h.axis === "x") b.reset(p + b.halfWidth, b.center.y); else b.reset(b.center.x, p + b.halfHeight);
        h.sprite.setPosition(b.center.x, b.center.y);
      }
    }

    private collect(sprite: Phaser.GameObjects.Image): void {
      if (!sprite.active) return;
      sprite.setActive(false).setVisible(false);
      (sprite.body as Phaser.Physics.Arcade.StaticBody | null)?.enable && ((sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false);
      this.collected += 1;
      this.refreshPips();
    }

    private refreshPips(): void {
      this.pips.forEach((p, i) => (p as Phaser.GameObjects.Image).setVisible(i < this.collected));
    }

    /** 碰到危险物 → **退回起点、计数保留**（票 09 裁决 12；无血量）。 */
    private hitHazard(): void {
      if (!this.player || this.won) return;
      this.player.setPosition(world.player.at.x, world.player.at.y).setVelocity(0, 0);
    }

    private tryWin(): void {
      if (this.won || this.collected < world.objective.pickupCount) return;
      this.won = true;
      this.add.text(VW / 2, VH / 2, "到达终点", { fontSize: "16px", color: "#ffffff", backgroundColor: "#000000c0" })
        .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 10);
    }
  };
}
