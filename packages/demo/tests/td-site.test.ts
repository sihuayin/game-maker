import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CommandError, TD_CONFIG_FORMAT } from "@game-maker/contracts";
import {
  SHELL_VERSION, assembleFromConfig, assembleTdSite, auditTdGeometry, buildTdWorld, detectFormat,
  type TdSiteOptions,
} from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
/** ⚠️ **真产物**：跑过完整资源管线的那一份包 + 手写的那一关。**不现造**（票 37 立的规矩）。 */
const PACK = path.join(ROOT, "fixtures/packs/counter-siege/v4");
const CONFIG = path.join(ROOT, "fixtures/td-configs/counter-siege.json");
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;

/** 每个用例一个临时 out 根 —— 装配器会往里写目录，测试之间不能串味。 */
function harness(over: (c: Record<string, never>) => void = () => {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gm-td-"));
  const outRoot = path.join(tmp, "out");
  const shellJsPath = path.join(tmp, "shell.js");
  fs.writeFileSync(shellJsPath, "// 外壳 bundle 的替身：装配器只检查它在不在、然后拷一份\n");
  const cfg = readJson(CONFIG);
  over(cfg as never);
  const cfgPath = path.join(tmp, "td-config.json");
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  return { tmp, outRoot, shellJsPath, cfgPath, opts: { packDir: PACK, configPath: cfgPath, shellJsPath, outRoot } as TdSiteOptions };
}

const siteDirOf = (outRoot: string, n = 1, id = "counter-siege") => path.join(outRoot, id, "site", `v${n}`);

describe("塔防站点的装配：三份数据 + 一份共用 bundle", () => {
  it("产出 index.html / shell.js / site.json / **td-config.json**，且 site.json 自带出处", () => {
    const h = harness();
    const r = assembleTdSite(h.opts);
    const dir = siteDirOf(h.outRoot);
    expect(fs.readdirSync(dir).sort()).toEqual(["index.html", "shell.js", "site.json", "td-config.json"]);
    // ⚠️ `config` 这一项是外壳用来**认出这是哪一种玩法**的（读 format 串），不靠猜文件名
    expect(readJson(path.join(dir, "site.json"))).toEqual({
      shell: SHELL_VERSION, pack: "v4", config: "td-config.json",
    });
    expect(r.data.genre).toBe("tower-defense");
    expect(r.data.serveRoot).toBe("counter-siege");
  });

  it("**绝不覆盖**：装配两次就是 v1 与 v2，v1 原样还在", () => {
    const h = harness();
    assembleTdSite(h.opts);
    expect(assembleTdSite(h.opts).data.siteVersion).toBe(2);
    expect(fs.existsSync(siteDirOf(h.outRoot, 1))).toBe(true);
    expect(fs.existsSync(siteDirOf(h.outRoot, 2))).toBe(true);
  });

  it("包拷进 out 树；**同一个版本不重复拷**", () => {
    const h = harness();
    expect(assembleTdSite(h.opts).data.packCopied).toBe(true);
    expect(assembleTdSite(h.opts).data.packCopied).toBe(false);
  });

  it("⚠️ 输在**中途**只报警告 —— 「人打得赢、它打不赢」的关卡可能是好关卡", () => {
    const h = harness((c) => {
      const cfg = c as unknown as { enemies: { hp: number }[] };
      cfg.enemies.forEach((e) => { e.hp *= 5; });        // 实测：这一档输在第 3 波
    });
    const r = assembleTdSite(h.opts);                     // ← **不抛**
    const w = (r.data.warnings as string[]).join("\n");
    expect(w).toMatch(/没能打完/);
    expect(w).toMatch(/覆盖 \d+%/);                       // 诊断①，带尺子
    expect(w).toMatch(/波次血量/);                         // 诊断②
  });

  it("**校验全过时零警告** —— 真关卡不该带着噪音交付", () => {
    const h = harness();
    expect(assembleTdSite(h.opts).data.warnings).toEqual([]);
  });

  it("起服务的根写在回报里（根指到 site 里面就是 404，而 Phaser 静默失败）", () => {
    const h = harness();
    expect(assembleTdSite(h.opts).summary.join("\n")).toMatch(/HTTP server 的根必须是 counter-siege\//);
  });
});

describe("塔防站点的装配：**校验不过 = 硬失败，不产出站点**", () => {
  const fails = (h: ReturnType<typeof harness>): CommandError => {
    let caught: unknown;
    try { assembleTdSite(h.opts); } catch (e) { caught = e; }
    expect(caught, "应当抛 CommandError").toBeInstanceOf(CommandError);
    return caught as CommandError;
  };

  it("引用解不到 → invalid，且**一个目录都没写**", () => {
    const h = harness((c) => { (c as { towers: { asset: string }[] }).towers[0]!.asset = "__没有__"; });
    const e = fails(h);
    expect(e.kind).toBe("invalid");
    expect(e.message).toMatch(/包里没有资源/);
    expect(fs.existsSync(path.join(h.outRoot, "counter-siege", "site"))).toBe(false);
  });

  it("配置不过 schema → invalid（**不是 usage** —— 它是产物不合法，不是参数写错）", () => {
    const h = harness();
    fs.writeFileSync(h.cfgPath, JSON.stringify({ format: "td-config/v9" }));
    expect(fails(h).kind).toBe("invalid");
  });

  it("配置不是 JSON → invalid（**不是**一个裸的 SyntaxError 从栈里冒出来）", () => {
    const h = harness();
    fs.writeFileSync(h.cfgPath, "{ 这不是 json");
    const e = fails(h);
    expect(e.kind).toBe("invalid");
    expect(e.message).toMatch(/不是合法 JSON/);
  });

  it("找不到配置文件 → usage（**2 与 4 不许揉在一起**）", () => {
    const h = harness();
    let caught: unknown;
    try { assembleTdSite({ ...h.opts, configPath: path.join(h.tmp, "没有这个文件.json") }); } catch (e) { caught = e; }
    expect((caught as CommandError).kind).toBe("usage");
  });

  it("⚠️ **可通关族**：数值刻度整个写反、一开局就被抢空 ⇒ 硬失败，且**一个目录都没写**", () => {
    // 票 11 定的那一步就住在**这里**（与几何族同处）—— 那一步需要模拟器，而它住在 demo。
    const h = harness((c) => {
      const cfg = c as unknown as { enemies: { hp: number }[]; economy: { lives: number } };
      cfg.enemies.forEach((e) => { e.hp *= 20; });
      cfg.economy.lives = 1;
    });
    const e = fails(h);
    expect(e.kind).toBe("invalid");
    expect(e.message).toMatch(/第一波就被抢空了/);
    // ⚠️ 硬失败那条要把**方向**说出来 —— 而那句话是**量出来的**
    expect(e.message).toMatch(/宁可把敌人写弱、把塔写便宜/);
    expect(fs.existsSync(path.join(h.outRoot, "counter-siege", "site"))).toBe(false);
  });

  it("坏消息**一次报全**（别让人改一条跑一次）", () => {
    const h = harness((c) => {
      const t = (c as { towers: { asset: string }[] }).towers;
      t[0]!.asset = "__没有__";
      t[1]!.asset = "__也没有__";
    });
    const e = fails(h);
    expect(e.message).toMatch(/__没有__/);
    expect(e.message).toMatch(/__也没有__/);
  });
});

describe("几何族：**只能落在装配期**的那几条", () => {
  it("HUD 摆到屏幕外 → 硬失败（世界可以比视口宽，而 HUD 活在屏幕空间）", () => {
    const h = harness((c) => {
      const cfg = c as unknown as { world: { size: { w: number } }; arena: { rows: string[] }; hud: { panel: { at: { x: number } } } };
      // 把世界加宽一倍（场地跟着补满），再把面板摆到只有世界放得下、屏幕放不下的地方
      cfg.world.size.w = 960;
      cfg.arena.rows = cfg.arena.rows.map((r) => r.slice(0, -1) + "#".repeat(32) + "#");
      cfg.hud.panel.at.x = 470;                       // 470+480 = 950 ≤ 960（世界过得了）
    });
    let caught: unknown;
    try { assembleTdSite(h.opts); } catch (e) { caught = e; }
    const e = caught as CommandError;
    // ⚠️ 世界那一族放它过去了，**几何族**才拦得住 —— 这正是几何族存在的理由
    expect(e.message).toMatch(/hud\.panel/);
    expect(e.message).toMatch(/屏幕空间/);
    expect(e.message).toMatch(/尺子是\*\*视口\*\*不是 world\.size/);
  });

  it("**场地铺不满世界** → 硬失败（铺不满的地方会透出外壳底色）", () => {
    const w = buildTdWorld(readJson(path.join(PACK, "manifest.json")), readJson(CONFIG), { packBase: "" });
    const broken = { ...w, arena: { ...w.arena, cols: w.arena.cols - 1, tiles: w.arena.tiles.slice(0, -1) } };
    const issues = auditTdGeometry(broken);
    expect(issues.some((i) => i.severity === "error" && /铺不满世界/.test(i.message))).toBe(true);
  });
});

describe("**一个入口，两种玩法**：`site` 按 config 的 format 分派", () => {
  it("认得出塔防", () => {
    expect(detectFormat({ format: TD_CONFIG_FORMAT })).toBe(TD_CONFIG_FORMAT);
  });

  it("读不出 format 就给一个**列得出认得哪几种**的错，而不是一个看不懂的 schema 错", () => {
    const h = harness();
    fs.writeFileSync(h.cfgPath, JSON.stringify({ 忘了写: "format" }));
    let caught: unknown;
    try { assembleFromConfig(h.opts); } catch (e) { caught = e; }
    const e = caught as CommandError;
    expect(e.kind).toBe("usage");
    expect(e.message).toMatch(/认得的/);
    expect(e.message).toMatch(/td-config\/v1/);
    expect(e.message).toMatch(/game-config\/v1/);
  });

  it("不认识的格式 → usage，且把拿到的那一串原样报出来", () => {
    const h = harness();
    fs.writeFileSync(h.cfgPath, JSON.stringify({ format: "shooter-config/v1" }));
    let caught: unknown;
    try { assembleFromConfig(h.opts); } catch (e) { caught = e; }
    expect((caught as CommandError).message).toMatch(/不认识的配置格式 "shooter-config\/v1"/);
  });

  it("塔防那一路走通（分派之后与直接调装配器是同一件事）", () => {
    const h = harness();
    const r = assembleFromConfig(h.opts);
    expect(r.data.genre).toBe("tower-defense");
    expect(fs.existsSync(path.join(siteDirOf(h.outRoot), "td-config.json"))).toBe(true);
  });
});
