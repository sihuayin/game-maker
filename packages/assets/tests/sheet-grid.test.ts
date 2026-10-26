// 固定网格（票 01）：按格切 ＋ 每格内容校验。
//
// ⚠️ 这两件事**分开测**是故意的：
//   · `sliceGridCells` 只回答「按 cols×rows 切，顺序是不是行优先」—— 4 / 9 / 12 格各一组；
//   · `auditSheetCells` 只回答「这一格该不该收」—— 空格 / 多主体 / 四边框。
//   混在一条集成测试里，任何一条红都说不清是切错了还是判错了。
import { describe, expect, it } from "vitest";
import { auditSheetCells, deriveSheetGrid, emptyImage, sliceGridCells, type RasterImage } from "../src/index.js";

type RGB = readonly [number, number, number];

const COLORS: readonly RGB[] = [
  [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0],
  [255, 0, 255], [0, 255, 255], [128, 64, 0], [64, 128, 0],
  [0, 64, 128], [128, 0, 64], [64, 0, 128], [192, 192, 192],
];

const put = (img: RasterImage, x: number, y: number, c: RGB): void => {
  const o = (y * img.width + x) * 4;
  img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
};

const fillRect = (img: RasterImage, x0: number, y0: number, w: number, h: number, c: RGB): void => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(img, x, y, c);
};

const pixelAt = (img: RasterImage, x: number, y: number): RGB => {
  const o = (y * img.width + x) * 4;
  return [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!];
};

/** 一张 cols×rows 的图：每格中央一块不同的颜色块（用来验行优先顺序）。 */
const markerSheet = (columns: number, rows: number, cellW = 12, cellH = 12): RasterImage => {
  const img = emptyImage(columns * cellW, rows * cellH);
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const i = r * columns + c;
    fillRect(img, c * cellW + 3, r * cellH + 3, cellW - 6, cellH - 6, COLORS[i % COLORS.length]!);
  }
  return img;
};

describe("§ sliceGridCells —— 4 / 9 / 12 格，行优先", () => {
  it.each([[2, 2, 4], [3, 3, 9], [3, 4, 12]])("%i 列 × %i 行 ⇒ %i 格，顺序正确", (columns, rows, count) => {
    const cells = sliceGridCells(markerSheet(columns, rows), { columns, rows });
    expect(cells).toHaveLength(count);
    cells.forEach((cell, i) => {
      // 行优先：第 i 格 = 第 floor(i/cols) 行第 i%cols 列
      expect(pixelAt(cell, cell.width / 2, cell.height / 2), `第 ${i + 1} 格`).toEqual(COLORS[i % COLORS.length]);
    });
  });

  it("⚠️ 上游回来的图**不必整除**：多出来的边缘像素居中让掉，格与格仍然等大", () => {
    // 实测 Gemini 按 aspect 表回尺寸，比请求多/少几像素是常态。
    const img = emptyImage(31, 21);   // 3 列 ⇒ 每格 10，余 1；2 行 ⇒ 每格 10，余 1
    const cells = sliceGridCells(img, { columns: 3, rows: 2 });
    expect(cells).toHaveLength(6);
    for (const c of cells) expect([c.width, c.height]).toEqual([10, 10]);
  });

  it("图比网格还小时**喊出来**，不静默切出 0×0", () => {
    expect(() => sliceGridCells(emptyImage(2, 2), { columns: 3, rows: 3 })).toThrow(/网格/);
  });
});

describe("§ auditSheetCells —— 严格结构（票 01 人裁）", () => {
  const cell = (): RasterImage => emptyImage(16, 16);
  const oneSubject = (c: RGB = COLORS[0]!): RasterImage => {
    const img = cell();
    fillRect(img, 4, 4, 8, 8, c);
    return img;
  };

  it("阳性：每格一个主体、不贴边 ⇒ 零 issue", () => {
    expect(auditSheetCells([oneSubject(), oneSubject(COLORS[1]!)], { columns: 2, rows: 1 })).toEqual([]);
  });

  it("⚠️ 只贴**一条边**不算框 —— 角色画得靠边是构图，不是污染", () => {
    const img = cell();
    fillRect(img, 0, 4, 8, 8, COLORS[2]!);   // 贴左边缘
    expect(auditSheetCells([img], { columns: 1, rows: 1 })).toEqual([]);
  });

  it("空格（零不透明像素）⇒ empty", () => {
    const issues = auditSheetCells([oneSubject(), cell()], { columns: 2, rows: 1 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "empty", index: 1, row: 0, column: 1 });
  });

  it("一格里两个互不相连的主体 ⇒ fragmented（最大块 < 60%）", () => {
    const img = cell();
    fillRect(img, 1, 4, 5, 8, COLORS[0]!);
    fillRect(img, 10, 4, 5, 8, COLORS[1]!);
    const issues = auditSheetCells([img], { columns: 1, rows: 1 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "fragmented", index: 0 });
    if (issues[0]?.kind === "fragmented") expect(issues[0].largestShare).toBeLessThan(0.6);
  });

  it("⚠️ 贴住**四条边**的墨 ⇒ border（黑框 / 画溢出格）", () => {
    const img = cell();
    for (let x = 0; x < 16; x++) { put(img, x, 0, COLORS[3]!); put(img, x, 15, COLORS[3]!); }
    for (let y = 0; y < 16; y++) { put(img, 0, y, COLORS[3]!); put(img, 15, y, COLORS[3]!); }
    fillRect(img, 6, 6, 4, 4, COLORS[0]!);
    const issues = auditSheetCells([img], { columns: 1, rows: 1 });
    expect(issues.map((i) => i.kind)).toEqual(["border"]);
  });
});

describe("§ deriveSheetGrid —— 帧表网格推导（票 13）", () => {
  it("N=4 ⇒ 2×2（近正方形，压 AR 从 4.0 到 1.0）", () => {
    expect(deriveSheetGrid(4)).toEqual({ columns: 2, rows: 2 });
  });
  it("N=6 ⇒ 3×2", () => {
    expect(deriveSheetGrid(6)).toEqual({ columns: 3, rows: 2 });
  });
  it("N=8 ⇒ 4×2（不是 8×1 横条）", () => {
    expect(deriveSheetGrid(8)).toEqual({ columns: 4, rows: 2 });
  });
  it("N=9 ⇒ 3×3", () => {
    expect(deriveSheetGrid(9)).toEqual({ columns: 3, rows: 3 });
  });
  it("N≤2 ⇒ undefined（保持横条 / 旧分块路径）", () => {
    expect(deriveSheetGrid(1)).toBeUndefined();
    expect(deriveSheetGrid(2)).toBeUndefined();
  });
  it("质数 N（3 / 5 / 7）无二维分解 ⇒ undefined（退化横条，已知限制）", () => {
    expect(deriveSheetGrid(3)).toBeUndefined();
    expect(deriveSheetGrid(5)).toBeUndefined();
    expect(deriveSheetGrid(7)).toBeUndefined();
  });
});
