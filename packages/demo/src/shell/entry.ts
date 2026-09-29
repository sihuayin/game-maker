// 站点入口 —— `index.html` 引的就是这一份 bundle。
//
// ⚠️ **它是经典 script，不是 module**：票 03 实测 module script 会撞 CORS
//   （HTML 规范要求 module script 走 CORS），而这里根本不需要模块的语义。
//   IIFE 少一整个失败模式，对「起个 http server 就能玩」这条验收是净赚。
//
// ⚠️ **一份 bundle 带两种玩法**（2026-09-29 加塔防）。它这样分派：
//   读 `site.json` 的 `config` 字段 → 取那份配置 → 看它的 `format` → 选场景。
//   **不是两个 bundle**，理由见 `draw.ts` 的 `SHELL_VERSION` 注释
//   （`CONTEXT.md` 两处写着「所有站点共用同一份、逐字节相同」）。
//
// 它只做四件事：**读数据 → 认格式 → 把数据交给纯函数 → 起 Phaser**。没有游戏逻辑。
import Phaser from "phaser";
import { GAME_CONFIG_FORMAT, TD_CONFIG_FORMAT } from "@game-maker/contracts";
import { SHELL_VERSION, VIEWPORT } from "../draw.js";
import { buildWorld } from "../world.js";
import { buildTdWorld } from "../td/world.js";
import { createScene } from "./scene.js";
import { createTdScene } from "./td/scene.js";

/** ⚠️ 取不到返回 `undefined`、**不抛** —— 「零数据也必须起得来」（票 32 裁决 3）。 */
async function getJson(url: string): Promise<unknown> {
  try {
    const r = await fetch(url);
    if (!r.ok) return undefined;
    return (await r.json()) as unknown;
  } catch {
    return undefined;
  }
}

/** 认不出来时的兜底场景 —— **不能是白屏**（票 32 裁决 3 的精神：坏了要说出来）。 */
function createErrorScene(lines: string[]): new () => Phaser.Scene {
  return class ErrorScene extends Phaser.Scene {
    constructor() { super({ key: "error" }); }
    create(): void {
      for (const l of lines) console.error(`[error] ${l}`);
      this.cameras.main.setBackgroundColor("#000000");
      lines.forEach((l, i) => this.add.text(4, 6 + i * 11, l, { fontSize: "8px", color: "#ead8a6", wordWrap: { width: VIEWPORT.w - 8 } }));
    }
  };
}

async function main(): Promise<void> {
  const site = (await getJson("./site.json")) as { shell?: string; pack?: string; config?: string } | undefined;

  // ⚠️ 外壳版本对不上要**说出来** —— 站点产物不在 git 里（Q9），拷错版本必须自己显形
  if (site?.shell !== undefined && site.shell !== SHELL_VERSION)
    console.warn(`[shell] site.json 说外壳是 v${site.shell}，而手上这份是 v${SHELL_VERSION} —— 站点与外壳对不上，先怀疑拷错了`);
  if (site === undefined)
    console.warn("[shell] 读不到 site.json —— 按「包在同级 ../../pack/」猜一个路径继续");

  // 包根（manifest 在那儿，图集在 `<包根>delivery/` 下）
  const packBase = typeof site?.pack === "string" ? `../../pack/${site.pack}/` : "../../pack/";
  const manifest = await getJson(`${packBase}manifest.json`);
  if (manifest === undefined) console.warn(`[shell] 读不到资源包 manifest（试的是 ${packBase}manifest.json）`);

  // ⚠️ 配置文件名**来自 `site.json`**（008：外壳不该靠猜文件名）——
  //   老站点没有这个字段，回落到 `game-config.json`。
  const configFile = typeof site?.config === "string" ? site.config : "game-config.json";
  const config = await getJson(`./${configFile}`);
  const format = (config as { format?: unknown } | undefined)?.format;

  // **全部判断都在纯层做完**，下面只剩铺开
  const scenes =
    format === TD_CONFIG_FORMAT ? [createTdScene(buildTdWorld(manifest, config, { packBase }))]
    : format === GAME_CONFIG_FORMAT ? [createScene(buildWorld(manifest, config, { packBase }))]
    : [createErrorScene([
        `认不出这份配置的格式（读到的是 ${JSON.stringify(format)}）。`,
        `认得的：${GAME_CONFIG_FORMAT}（横版）· ${TD_CONFIG_FORMAT}（塔防）。`,
        `配置文件名：./${configFile}；site.json 里写的是 ${JSON.stringify(site?.config ?? null)}。`,
        "⚠️ 多半是 site.json 与站点目录里的配置对不上 —— 重新装配一次站点。",
      ])];

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: VIEWPORT.w,
    height: VIEWPORT.h,
    // 1 交付像素 = 1 纹理像素，屏幕上整数倍放大（票 32 裁决 1）
    pixelArt: true,
    scale: { mode: Phaser.Scale.NONE, zoom: 2, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: scenes,
  });
}

void main();
