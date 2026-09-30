import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CommandError } from "@game-maker/contracts";
import { assembleSite, auditGeometry, buildWorld, SHELL_VERSION, type SiteOptions } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
/** ⚠️ 真产物：票 40 的包 + 票 33 的配置。**不现造**（票 37 立的规矩）。 */
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const CONFIG = path.join(ROOT, "fixtures/game-configs/last-train.json");
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;

/** 每个用例一个临时 out 根 —— 装配器会往里写目录，测试之间不能串味。 */
function harness(over: Partial<Record<string, unknown>> = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gm-site-"));
  const outRoot = path.join(tmp, "out");
  const shellJsPath = path.join(tmp, "shell.js");
  fs.writeFileSync(shellJsPath, "// 外壳 bundle 的替身：装配器只检查它在不在、然后拷一份\n");
  const cfgPath = path.join(tmp, "game-config.json");
  fs.writeFileSync(cfgPath, JSON.stringify({ ...readJson(CONFIG), ...over }, null, 2));
  return { tmp, outRoot, shellJsPath, cfgPath, opts: { packDir: PACK, configPath: cfgPath, shellJsPath, outRoot } as SiteOptions };
}

const siteDirOf = (outRoot: string, n = 1, id = "last-train") => path.join(outRoot, id, "site", `v${n}`);
const configOf = (over: Partial<Record<string, unknown>>) => ({ ...readJson(CONFIG), ...over });

describe("装配：三份数据 + 一份共用 bundle", () => {
  it("产出 index.html / shell.js / site.json / game-config.json，且 site.json 自带出处", () => {
    const h = harness();
    const r = assembleSite(h.opts);
    const dir = siteDirOf(h.outRoot);
    expect(fs.readdirSync(dir).sort()).toEqual(["game-config.json", "index.html", "shell.js", "site.json"]);
    // ⚠️ 站点**自己说明自己是怎么来的**（票 18 / 票 32 裁决 6）——
    //   外壳版本 + 消费的包版本 + **哪一份配置**（2026-09-29 加：一个外壳带两种玩法，
    //   外壳读不到这个名字就得靠猜文件名，而那正是下面那条「拷错了」探测要防的东西）。
    //   ⚠️ 版本号**不写死** —— 外壳一改它就得改（票 32 裁决 6），写死只会让每次改外壳都要来改测试。
    expect(readJson(path.join(dir, "site.json"))).toEqual({
      shell: SHELL_VERSION, pack: "v2", config: "game-config.json",
    });
    expect(fs.readFileSync(path.join(dir, "shell.js"), "utf8")).toBe(fs.readFileSync(h.shellJsPath, "utf8"));
    expect(r.data.siteVersion).toBe(1);
    expect(r.data.serveRoot).toBe("last-train");
  });

  it("**绝不覆盖**：装配两次就是 v1 与 v2，v1 原样还在", () => {
    const h = harness();
    assembleSite(h.opts);
    const r2 = assembleSite(h.opts);
    expect(r2.data.siteVersion).toBe(2);
    expect(fs.existsSync(siteDirOf(h.outRoot, 1))).toBe(true);
    expect(fs.existsSync(siteDirOf(h.outRoot, 2))).toBe(true);
  });

  it("包拷进 out 树；**同一个版本不重复拷**（R6：换包不重建的落点）", () => {
    const h = harness();
    const r1 = assembleSite(h.opts);
    expect(r1.data.packCopied).toBe(true);
    expect(fs.existsSync(path.join(h.outRoot, "last-train", "pack", "v2", "manifest.json"))).toBe(true);
    const r2 = assembleSite(h.opts);
    expect(r2.data.packCopied).toBe(false);
  });

  it("回报的路径一律相对 outRoot（票 30）—— 不许出现绝对路径", () => {
    const h = harness();
    const r = assembleSite(h.opts);
    expect(r.artifacts[0]!.path).not.toMatch(/^\//);
    expect(String(h.outRoot)).not.toBe(r.data.siteDir);
  });

  it("起服务的根要写在回报里 —— 根指到 site 里面就是 404，而 Phaser 静默失败（票 03）", () => {
    const h = harness();
    const r = assembleSite(h.opts);
    expect(r.summary.join("\n")).toMatch(/HTTP server 的根必须是 last-train\//);
  });
});

describe("硬失败：校验不过**不产出站点**（票 30 的坑不踩第二次）", () => {
  const fails = (h: ReturnType<typeof harness>): CommandError => {
    let caught: unknown;
    try { assembleSite(h.opts); } catch (e) { caught = e; }
    expect(caught, "应当抛 CommandError").toBeInstanceOf(CommandError);
    return caught as CommandError;
  };

  it("引用了包里没有的资源 → invalid，且**一个目录都没写**", () => {
    const h = harness();
    const cfg = configOf({});
    (cfg.entities as Record<string, unknown>[])[0]!.asset = "__没有__";
    fs.writeFileSync(h.cfgPath, JSON.stringify(cfg));
    const e = fails(h);
    expect(e.kind).toBe("invalid");
    expect(e.message).toMatch(/包里没有资源/);
    expect(fs.existsSync(path.join(h.outRoot, "last-train", "site")), "校验不过就不该有站点目录").toBe(false);
  });

  it("game-config 不过 schema → invalid", () => {
    const h = harness();
    fs.writeFileSync(h.cfgPath, JSON.stringify({ format: "game-config/v9" }));
    expect(fails(h).kind).toBe("invalid");
  });

  it("**第四族**：不平铺的层给了非零视差 → 硬失败（票 40 算过：盖不住）", () => {
    // 天空是唯一不平铺的层。给它 0.3 的视差 ⇒ 镜头走到尽头时屏幕上只剩 192px，而视口要 480px。
    const h = harness();
    const manifest = readJson(path.join(PACK, "manifest.json"));
    const sky = (manifest.assets as Record<string, unknown>[]).find((a) => a.id === "bg-dusk-halt")!;
    (sky.layers as Record<string, unknown>[])[0]!.parallax = 0.3;
    const pack2 = path.join(h.tmp, "pack");
    fs.cpSync(PACK, pack2, { recursive: true });
    fs.writeFileSync(path.join(pack2, "manifest.json"), JSON.stringify(manifest, null, 2));
    const e = fails({ ...h, opts: { ...h.opts, packDir: pack2 } });
    expect(e.message).toMatch(/盖不住世界/);
    expect(e.message).toMatch(/不平铺的层只有 parallax = 0/);
  });

  it("**第五族**：HUD 摆到屏幕外 → 硬失败（世界宽 1440，屏幕只有 480）", () => {
    // x = 1000 过得了**世界**校验（1000+72 ≤ 1440），却在 480 宽的屏幕外。
    const h = harness({
      hud: { panel: { asset: "hud-lost-slots", at: { x: 1000, y: 262 }, size: { w: 72, h: 32 } },
             pip: { asset: "hud-pip", at: { x: 12, y: 250 }, step: { x: 20, y: 0 } } },
    });
    const e = fails(h);
    expect(e.message).toMatch(/hud\.panel/);
    expect(e.message).toMatch(/屏幕空间/);
    expect(e.message).toMatch(/尺子是\*\*视口\*\*不是 world\.size/);
  });

  it("**一次报全** —— 别让人改一条跑一次", () => {
    const h = harness();
    const cfg = configOf({});
    (cfg.entities as Record<string, unknown>[])[0]!.asset = "__没有__";
    (cfg.entities as Record<string, unknown>[])[1]!.asset = "__也没有__";
    fs.writeFileSync(h.cfgPath, JSON.stringify(cfg));
    const e = fails(h);
    expect(e.message.match(/包里没有资源/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("警告：有解释余地的不判死刑", () => {
  it("盒子探出世界的**左/上**边 → 警告，不是硬失败（票 48 有意留给本票判的）", () => {
    // 一个锚点 {x:.5} 的东西摆在 x = 0 ⇒ 盒子伸到 -20。
    // 远端越界（右边/下边）是硬失败，**近端**只是被裁掉一角 —— 可能是有意的（从画面外伸进来的东西）。
    const h = harness();
    const cfg = configOf({});
    (cfg.entities as Record<string, unknown>[])[3]!.at = { x: 0, y: 250 };   // luggage
    fs.writeFileSync(h.cfgPath, JSON.stringify(cfg));
    const r = assembleSite(h.opts);          // ← 不抛
    expect((r.data.warnings as string[]).join("\n")).toMatch(/探出了世界的左边\/上边/);
  });

  it("正常的 last-train 配置：**一条警告都没有**", () => {
    const h = harness();
    expect(assembleSite(h.opts).data.warnings).toEqual([]);
  });
});

describe("输入不对时给的是**用法错**（2），不是产物不合法（4）", () => {
  it("不是一个资源包目录 / 没有外壳 bundle", () => {
    const h = harness();
    try { assembleSite({ ...h.opts, packDir: h.tmp }); } catch (e) { expect((e as CommandError).kind).toBe("usage"); }
    try { assembleSite({ ...h.opts, shellJsPath: path.join(h.tmp, "__没有__") }); } catch (e) {
      expect((e as CommandError).kind).toBe("usage");
      expect((e as CommandError).message).toMatch(/先跑 pnpm --filter @game-maker\/demo bundle/);
    }
  });
});

/**
 * 票 50：**最远的那一层必须画满**。
 *
 * ⚠️ 这条的依据是一组**量出来的对比**，而它当场证伪了最自然的那个检查：
 *   `fixtures/packs/last-train/v2`（所有东西都建在它上面）的 `wall` 只有 **42%**、`ground` 只有 **14%** ——
 *   因为**墙本来就只占中间那带、上面留给天**。⇒「所有层都必须满」会拒掉它。
 *   而 `out/last-train-image/pack/v2` 的 `sky`（**最远那层**）只有 **68%** —— 那才是洞。
 */
describe("背景的两条：最远层**必须满**、其余层**不许满**（票 50 + 2026-09-30）", () => {
  // ⚠️ 第一个参数是 **manifest**、第二个才是 config —— 我在这儿写反过一次（传了两份 config），
  //   于是 `buildWorld` 拿到一个过不了 schema 的「包」，产出**空背景**，检查**永远不触发**，
  //   而「画满 ⇒ 通过」那条会**假通过**。测试里最容易骗过自己的就是这种：
  //   断言的是「没有报错」，而它没报错是因为**它根本没跑**。
  const world = () => buildWorld(readJson(path.join(PACK, "manifest.json")), readJson(CONFIG), { packBase: "" });
  const layer = (frame: string, ratio: number) =>
    ({ asset: "bg-dusk-halt", frame, w: 480, h: 270, opaque: Math.round(129600 * ratio), ratio });
  const FARTHEST = "bg-dusk-halt.sky";

  it("最远层画满 ⇒ 通过（**哪怕别的层只有 14%** —— 那是设计，不是洞）", () => {
    // 这一条就是「所有层都必须满」会挂掉的地方 —— 它钉的是**判据的边界**。
    const issues = auditGeometry(world(), [
      layer(FARTHEST, 1), layer("bg-dusk-halt.wall", 0.42), layer("bg-dusk-halt.ground", 0.14),
    ]);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("最远层没画满 ⇒ 硬失败，且说得清「它后面没有别的层」", () => {
    const issues = auditGeometry(world(), [
      layer(FARTHEST, 0.682), layer("bg-dusk-halt.wall", 0.617), layer("bg-dusk-halt.ground", 0.609),
    ]);
    const e = issues.filter((i) => i.severity === "error");
    expect(e).toHaveLength(1);
    expect(e[0]!.where).toBe("scene.background[0]");
    expect(e[0]!.message).toMatch(/最远的那一层没画满/);
    expect(e[0]!.message).toMatch(/68\.2%/);
    expect(e[0]!.message).toMatch(/只有最远这层必须满/);
  });

  it("⚠️ **其余层一个透光的地方都没有 ⇒ 硬失败** —— 它把后面全挡住，背景等于只有一层", () => {
    // ⚠️ 这一条是补的另半边：上面那条只查了一个方向，于是留下一个**正好反过来**的洞。
    //   而它有两种成因，**两种都会让「最远层画满」那条假通过**：
    //     · 抠图底色没抠掉（模型画的不是提示词里那个纯色 ⇒ `keyBackground` 一个像素都删不掉）；
    //     · 每层都把整张场景画了一遍（每层的提示词里塞的都是整张场景的描述 —— 那处缝在契约里）。
    //   ⚠️ 界凭什么不是拍的一个数：17 个包 · 126 张生图原图 · 两个上游实测，
    //   **抠掉 0 像素的只有 3 张**，其次最低的一档是 **3.5%**，而真包的近层按设计停在 14%/42%。
    const issues = auditGeometry(world(), [
      layer(FARTHEST, 1), layer("bg-dusk-halt.wall", 1), layer("bg-dusk-halt.ground", 1),
    ]);
    const e = issues.filter((i) => i.severity === "error");
    expect(e.map((i) => i.where)).toEqual(["scene.background[1]", "scene.background[2]"]);
    expect(e[0]!.message).toMatch(/一个透光的地方都没有/);
    expect(e[0]!.message).toMatch(/抠图底色没抠掉/);
    expect(e[0]!.message).toMatch(/每层都画了整张场景/);
    // ⚠️ 这条要的是「**别满**」，不是「要满」—— 说反了就会把真包的 14% 也拒掉
    expect(e[0]!.message).toMatch(/别满/);
    // ⚠️ 而**旧那条在这份数据上一条都不响** —— 这正是那个洞：抠图失败会让每层看起来都是满的。
    expect(e.map((i) => i.message).join("\n")).not.toMatch(/最远的那一层没画满/);
  });

  it("⚠️ 近层**差一点点**不满（0.998）⇒ 放行 —— 界是 `FILLED`，不是「比 1 小就算」", () => {
    const issues = auditGeometry(world(), [
      layer(FARTHEST, 1), layer("bg-dusk-halt.wall", 0.998), layer("bg-dusk-halt.ground", 0.14),
    ]);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("⚠️ **只有一层**的背景：那条「不许满」不适用（没有后面可挡）", () => {
    // 判据只对 `background[1..]` 生效 —— 单层背景里那一层既是最远、也是唯一。
    const issues = auditGeometry(world(), [layer(FARTHEST, 1)]);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("⚠️ **没有 coverage.json 就不查** —— 老包都不带它，那不是错", () => {
    // 与 ledger.json 同一条规矩（票 45）：磁盘上已有的包必须照常通过。
    expect(auditGeometry(world(), undefined).filter((i) => i.severity === "error")).toEqual([]);
    expect(auditGeometry(world(), []).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("覆盖率**对不上帧名**（比如包换了）⇒ 不误报", () => {
    const issues = auditGeometry(world(), [layer("别的背景.sky", 0.1)]);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});
