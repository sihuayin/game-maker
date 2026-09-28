// 站点入口 —— `index.html` 引的就是这一份 bundle。
//
// ⚠️ **它是经典 script，不是 module**：票 03 实测 module script 会撞 CORS
//   （HTML 规范要求 module script 走 CORS），而这里根本不需要模块的语义。
//   IIFE 少一整个失败模式，对「起个 http server 就能玩」这条验收是净赚。
//
// 它只做三件事：**读数据 → 把数据交给纯函数 → 起 Phaser**。没有游戏逻辑。
import Phaser from "phaser";
import { buildWorld, SHELL_VERSION, VIEWPORT } from "../world.js";
import { createScene } from "./scene.js";

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

async function main(): Promise<void> {
  const site = (await getJson("./site.json")) as { shell?: string; pack?: string } | undefined;

  // ⚠️ 外壳版本对不上要**说出来** —— 站点产物不在 git 里（Q9），拷错版本必须自己显形
  if (site?.shell !== undefined && site.shell !== SHELL_VERSION)
    console.warn(`[shell] site.json 说外壳是 v${site.shell}，而手上这份是 v${SHELL_VERSION} —— 站点与外壳对不上，先怀疑拷错了`);
  if (site === undefined)
    console.warn("[shell] 读不到 site.json —— 按「包在同级 ../../pack/」猜一个路径继续");

  // 包根（manifest 在那儿，图集在 `<包根>delivery/` 下）
  const packBase = typeof site?.pack === "string" ? `../../pack/${site.pack}/` : "../../pack/";
  const manifest = await getJson(`${packBase}manifest.json`);
  const config = await getJson("./game-config.json");
  if (manifest === undefined) console.warn(`[shell] 读不到资源包 manifest（试的是 ${packBase}manifest.json）`);

  // **全部判断都在这里做完**，下面只剩铺开
  const world = buildWorld(manifest, config, { packBase });

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: VIEWPORT.w,
    height: VIEWPORT.h,
    // 1 交付像素 = 1 纹理像素，屏幕上整数倍放大（票 32 裁决 1）
    pixelArt: true,
    scale: { mode: Phaser.Scale.NONE, zoom: 2, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: [createScene(world)],
  });
}

void main();
