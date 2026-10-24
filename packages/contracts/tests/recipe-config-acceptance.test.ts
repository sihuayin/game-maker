// recipe-config-gap-v1 票 06 · 免费验收（Q2a）：config 业务校验**全过**。
//
// compile-runtime 那三批业务校验，对一份**合法配置**零硬失败：
//   ① auditGameConfig（引用族 + 自洽族）② auditScreenSpace（HUD 屏幕空间）③ auditLayerCoverage（层盖住世界）。
// 这是票 04/05 修复的**正向证明**：hudUiGate 放行的 ui、kind 锁放行的 solid→sprite，都过这三批校验 ——
// 修复没有「把合法配置也误伤」。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_HUD_LINE_HEIGHT, auditGameConfig, auditLayerCoverage, auditScreenSpace, backgroundLayerEntries,
  gameHudScreenItems, parseAssetPack, parseGameConfig, type AssetPackManifest, type GameConfig,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const MANIFEST = (() => {
  const r = parseAssetPack(JSON.parse(readFileSync(`${ROOT}/fixtures/packs/last-train/v2/manifest.json`, "utf8")));
  if (!r.ok) throw new Error(r.errors.join("；"));
  return r.value as AssetPackManifest;
})();
const CONFIG = (() => {
  const r = parseGameConfig(JSON.parse(readFileSync(`${ROOT}/fixtures/game-configs/last-train.json`, "utf8")));
  if (!r.ok) throw new Error(r.errors.join("；"));
  return r.value as GameConfig;
})();
const VP = { w: 480, h: 270 } as const;

describe("§免费验收 · config 业务校验全过（recipe-config-gap-v1 票 06）", () => {
  it("合法配置（last-train）过三批业务校验，零硬失败", () => {
    const issues = [
      ...auditGameConfig(CONFIG, MANIFEST),
      ...auditScreenSpace(VP, gameHudScreenItems(CONFIG, MANIFEST, { lineHeight: DEFAULT_HUD_LINE_HEIGHT })),
      ...auditLayerCoverage(VP, CONFIG.world.size,
        backgroundLayerEntries(CONFIG.scene.background.asset, CONFIG.world.size, MANIFEST.assets)),
    ];
    const hard = issues.filter((i) => i.severity === "error");
    expect(hard, hard.map((i) => `${i.where}: ${i.message}`).join("\n")).toEqual([]);
  });
});
