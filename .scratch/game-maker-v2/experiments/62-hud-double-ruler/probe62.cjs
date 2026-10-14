// 票 62 探针：「hud.panel 被两把尺子各判一次」—— **是不是重复报告**、**各管哪一半**
// 免费：只 require 已构建的 packages/contracts/dist + fixtures 里那份**真包**（last-train v2）。
// 不碰网络、不跑管线、零付费、源码一个字节没动。
const path = require("path");
const fs = require("fs");
const ROOT = "/Volumes/shy/some-projects/game-maker";
const c = require(path.join(ROOT, "packages/contracts/dist/index.js"));

const out = [];
const say = (s = "") => { out.push(s); console.log(s); };

const VIEWPORT = { w: 480, h: 270 };   // packages/demo/src/draw.ts:15 —— 外壳的常量

// ── 夹具：**真包**（fixtures/packs/last-train/v2），锚点按需改写 ────────────
const rawPack = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/packs/last-train/v2/manifest.json"), "utf8"));
const manifestWithAnchor = (id, anchor) => {
  const m = JSON.parse(JSON.stringify(rawPack));
  m.assets.find((a) => a.id === id).anchor = anchor;
  return c.parseAssetPack(m).value;
};

const cfgWith = ({ at, size, world }) => ({
  format: "game-config/v1",
  world: { size: world },
  scene: { background: { asset: "bg-dusk-halt" } },
  player: { asset: "player-traveler", anims: { idle: "idle", run: "run", jump: "jump" }, at: { x: 40, y: 250 } },
  terrain: [{ x: 0, y: 250, w: world.w, h: 20 }],
  entities: [
    { id: "suitcase-1", kind: "pickup", at: { x: 300, y: 240 }, asset: "pickup-suitcase" },
    { id: "suitcase-2", kind: "pickup", at: { x: 340, y: 240 }, asset: "pickup-suitcase" },
    { id: "suitcase-3", kind: "pickup", at: { x: 380, y: 240 }, asset: "pickup-suitcase" },
    { id: "signal", kind: "goal", at: { x: 400, y: 230 }, asset: "signal-endlight", anim: "red" },
  ],
  hud: { panel: { asset: "hud-lost-slots", at, size }, pip: { asset: "hud-pip", at: { x: 12, y: 250 }, step: { x: 20, y: 0 } } },
  objective: { kind: "collect-then-reach", gate: "signal" },
});

/** 两把尺子各跑一次，只留 `hud.panel` 那些条目。 */
const both = (cfg, manifest) => ({
  world: c.auditGameConfig(cfg, manifest).filter((i) => i.where === "hud.panel"),
  screen: c.auditScreenSpace(VIEWPORT, c.gameHudScreenItems(cfg, manifest, { lineHeight: 10 }))
    .filter((i) => i.where === "hud.panel"),
});
const show = (r) => {
  for (const i of r.world) say(`    【世界尺】${i.where}: ${i.message}`);
  for (const i of r.screen) say(`    【视口尺】${i.where}: ${i.message}`);
  if (r.world.length === 0 && r.screen.length === 0) say("    （两条都静）");
};

// 盒子 → 需要的 `at`。anchor `{x,y}` 时 box.x = at.x − ax·w，box.y = at.y − ay·h
const atFor = (box, size, anchor) => ({
  x: box.x + anchor.x * size.w, y: box.y + anchor.y * size.h,
});

const CENTER = { x: 0.5, y: 0.5 };
const BL = { x: 0, y: 1 };   // 左下角 —— 契约注释对 HUD 面板的断言

say("=== ① 复现第十二跑：真包 + 中心锚点 + 骨架示例那一格 ===");
{
  const size = { w: 72, h: 32 };
  const at = atFor({ x: -28, y: 246, ...size }, size, CENTER);
  const m = manifestWithAnchor("hud-lost-slots", CENTER);
  const cfg = cfgWith({ at, size, world: { w: 1440, h: 270 } });
  say(`  anchor 改成中心 ${JSON.stringify(CENTER)} ⇒ 书面的 at ${JSON.stringify(at)} ⇒ 盒 ${JSON.stringify({ x: -28, y: 246, ...size })}`);
  show(both(cfg, m));
}

say("");
say("=== ② 三条**只违反一处**的盒子 —— 看每把尺子各响在哪一个析取项上 ===");
say("（W=1440 H=270 · 视口 480×270 ⇒ **两把尺子的 y 上界是同一个数**）");
{
  const size = { w: 72, h: 32 };
  const rows = [
    ["只违反 y 上界（盒 (100,250) 72×32 ⇒ y+h=278>270；x 完全合法）", { x: 100, y: 250 }],
    ["只违反 x 下界（盒 (-28,200) ⇒ x<0；y+h=232≤270）", { x: -28, y: 200 }],
    ["只违反 x 上界（盒 (420,200) ⇒ x+w=492>480；而 492≤1440 世界不管）", { x: 420, y: 200 }],
    ["完全合法（盒 (100,100)）", { x: 100, y: 100 }],
  ];
  for (const [label, box] of rows) {
    const at = atFor(box, size, CENTER);
    const m = manifestWithAnchor("hud-lost-slots", CENTER);
    const cfg = cfgWith({ at, size, world: { w: 1440, h: 270 } });
    say(`  · ${label}`);
    show(both(cfg, m));
  }
}

say("");
say("=== ③ 世界**比视口小**时（W=400 < 视口 480）：世界尺多说了什么？ ===");
{
  const size = { w: 72, h: 32 };
  const at = atFor({ x: 350, y: 100, ...size }, size, CENTER);
  const m = manifestWithAnchor("hud-lost-slots", CENTER);
  const cfg = cfgWith({ at, size, world: { w: 400, h: 270 } });
  say("  盒 (350,100) 72×32 ⇒ x+w=422（> 世界 400，≤ 视口 480）");
  show(both(cfg, m));
}

say("");
say("=== ④ 包含关系：世界 ≥ 视口 时，「世界尺响 ⇒ 视口尺响」恒成立吗（网格扫描）===");
{
  const size = { w: 72, h: 32 };
  const m = manifestWithAnchor("hud-lost-slots", CENTER);
  let violations = 0, worldOnly = 0, screenOnly = 0, tested = 0;
  for (let x = -80; x <= 500; x += 10) {
    for (let y = -10; y <= 300; y += 10) {
      const at = atFor({ x, y, ...size }, size, CENTER);
      if (at.x < 0 || at.y < 0) continue;   // 契约本身的 `at` 不许负（PointShape 非负）
      const cfg = cfgWith({ at, size, world: { w: 1440, h: 270 } });
      const r = both(cfg, m);
      const w = r.world.length > 0, s = r.screen.length > 0;
      tested++;
      if (w && !s) { worldOnly++; violations++; }
      if (s && !w) screenOnly++;
    }
  }
  say(`  合法 \`at\` 的盒子里试了 ${tested} 个：世界尺响而视口尺不响 = **${worldOnly}** 个`);
  say(`  视口尺响而世界尺不响 = **${screenOnly}** 个（这些就是「只有视口尺管得住」的：负 x / 负 y / 右边 480~1440 那一段）`);
}

say("");
say("=== ⑤ 同一个 HUD 家族里，谁被两把尺子判过？（`gameHudScreenItems` 的产物 vs `inWorld` 的调用点）===");
{
  const size = { w: 72, h: 32 };
  const m = manifestWithAnchor("hud-lost-slots", CENTER);
  const cfg = cfgWith({ at: { x: 8, y: 262 }, size, world: { w: 1440, h: 270 } });
  const items = c.gameHudScreenItems(cfg, m, { lineHeight: 10 });
  say(`  视口尺那一份清单：${items.map((i) => i.where).join(" · ")}`);
  say(`  世界尺那一份调用点（源码 game-config.ts:386-389）：terrain[i] · entity "…" · player.at · **hud.panel**`);
  say(`  ⇒ 家族里的 \`hud.pip[…]\` **从来不进世界尺** —— panel 是家族里唯一被判两次的那个`);
}

say("");
say("=== ⑥ 若不判 `hud.panel` 了，世界尺其余三个调用点会不会被牵动？ ===");
{
  const size = { w: 72, h: 32 };
  const m = manifestWithAnchor("hud-lost-slots", CENTER);
  const cfg = cfgWith({ at: { x: 8, y: 262 }, size, world: { w: 1440, h: 270 } });
  // 把 player 与一个实体**真的**推出世界（不只是挪一挪）
  cfg.player.at = { x: 1440, y: 250 };
  cfg.entities.push({ id: "far", kind: "solid", at: { x: 1430, y: 240 }, asset: "prop-luggage-pile", body: { w: 40, h: 40 } });
  const r = c.auditGameConfig(cfg, m).filter((i) => /世界之外/.test(i.message));
  say(`  世界尺今天还在说谁：${r.map((i) => i.where).join(" · ") || "（无）"}`);
  say(`  ⇒ 这三个都是**世界空间**的东西（地形 / 实体 / 玩家），**没有视口尺的替身** ——`);
  say(`     删掉 hud.panel 那一行**只动这一行**，它们一个不受牵动`);
}

say("");
say("=== ⑦ 世界比视口窄，在盘上是真实情形还是假想？（扫 fixtures/ + out/ 的 world.size）===");
{
  const roots = ["fixtures", "out"];
  let n = 0, narrow = 0;
  const found = [];
  const scan = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) scan(p);
      else if (e.name.endsWith(".json")) {
        let d; try { d = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
        const ws = d && d.world && d.world.size;
        if (ws && typeof ws.w === "number" && d.format === "game-config/v1") {
          n++;
          if (ws.w < VIEWPORT.w || ws.h < VIEWPORT.h) { narrow++; found.push(`${p} 世界 ${ws.w}×${ws.h}`); }
        }
      }
    }
  };
  for (const r of roots) scan(path.join(ROOT, r));
  say(`  扫到 ${n} 份 game-config/v1；其中世界**比视口小**（< ${VIEWPORT.w}×${VIEWPORT.h}）的有 **${narrow}** 份`);
  for (const f of found.slice(0, 8)) say(`    · ${f}`);
  if (narrow === 0 && n > 0) say(`  ⇒ ③ 那一格在盘上**一次都没出现过** —— 世界尺多说的那半句，今天没有真实样本`);
}


say("");
say("=== ⑧ 「世界尺」全仓有几份实现、各查几边 ===");
{
  const size = { w: 72, h: 32 };
  const m = manifestWithAnchor("hud-lost-slots", CENTER);
  const at = atFor({ x: -28, y: 200, ...size }, size, CENTER);      // 合法的非负 `at`
  const cfg = cfgWith({ at, size, world: { w: 1440, h: 270 } });
  const r = both(cfg, m);
  say(`  实测：盒 (-28,200) 72×32（\`at\` 非负、由锚点算出负 x）⇒ 世界尺${r.world.length ? "**响**" : "**静**"} · 视口尺${r.screen.length ? "**响**" : "静"}`);
  say("  源码对照 —— 三份 `inWorld`，三种语义：");
  say("    · contracts/game-config.ts:382（横版 config）  `x+w>W || y+h>H`            ← **不查负数**");
  say("    · contracts/td-config.ts:445（塔防 config）    `x<0||y<0||x+w>W||y+h>H`    ← 查，**硬失败**");
  say("    · demo/td/site.ts:41（塔防装配）               上界硬失败；负数**警告**     ← 查，**警告**");
  say("  ⇒ 不只「同一个 HUD 被两把尺子判」，连**「世界尺」自己都漂了三份**");
}

say("");
say("=== ⑨ 删掉 `inWorld(\"hud.panel\", …)` 会让哪几处断言变红？（逐条喂真输入）===");
{
  const size = { w: 72, h: 32 };
  const m = manifestWithAnchor("hud-lost-slots", BL);           // 与 game-config.test.ts 的夹具同一个锚点
  const rows = [
    ["game-config.test.ts:259", { x: 8, y: 271 }],
    ["game-config.test.ts:265", { x: 1440, y: 262 }],
    ["reachability.test.ts:196", { x: 9999, y: 262 }],
    ["gameplay.test.ts:113", { x: 9999, y: 262 }],
  ];
  for (const [label, at] of rows) {
    const cfg = cfgWith({ at, size, world: { w: 1440, h: 270 } });
    const r = both(cfg, m);
    say(`  · ${label}  at=${JSON.stringify(at)} ⇒ 世界尺${r.world.length ? "响" : "静"} · 视口尺${r.screen.length ? "响" : "静"}`);
  }
  say("  ⇒ 四处断的都是**世界尺**；删掉那一行它们会红 —— 而**视口尺对同一份输入照样响**");
  say("     （断言要改的是**找错了家**，不是判据没了）");
}

fs.writeFileSync(path.join(__dirname, "raw-output.txt"), out.join("\n") + "\n");
