// 零成本探针：**画布比例** 是不是 **角色本体比例** 的好代理？
// 动机：`masterRatioMismatch` 判的是「上游给的画布」的长宽比，而票 13 的 Q5 在乎的是
//   「母版里那个角色的头身比」。若一张 1184×864（1.370）的画布里，角色本体的包围盒
//   是 0.667（= canonical 32×48），那这条判据就是**判错了东西**（会误伤）。
import fs from "node:fs"; import path from "node:path"; import { pathToFileURL } from "node:url";
const HERE = import.meta.dirname;
const A = path.resolve(HERE, "../../../../packages/assets/dist");
const { decodePNG } = await import(pathToFileURL(path.join(A, "png.js")).href);
const { dominantOpaqueColor, keyBackground } = await import(pathToFileURL(path.join(A, "import.js")).href);

const bbox = (img, keep) => { // keep(x,y) -> true 表示是前景
  let x0=1e9,y0=1e9,x1=-1,y1=-1,n=0;
  for (let y=0;y<img.height;y++) for (let x=0;x<img.width;x++) {
    if (keep(x,y)) { n++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  }
  return n ? { w: x1-x0+1, h: y1-y0+1, n } : null;
};

const cases = [];
// 第三跑（canonical 32×48 = 0.6667，除 treasure-chest 32×40）
for (const f of fs.readdirSync("raw/key-colour-third-run").filter(x=>x.endsWith(".png")))
  cases.push(["三跑 "+f, "raw/key-colour-third-run/"+f]);
// 第六跑
const B6="raw/run-out-2026-10-10c/wasteland-scavenger-assets";
const P6=path.join(B6, fs.readdirSync(B6).find(d=>d.startsWith("failed-")));
for (const sub of ["authoring/generated","masters"]) {
  const d=path.join(P6,sub); if(!fs.existsSync(d))continue;
  for (const f of fs.readdirSync(d).filter(x=>x.endsWith(".png")).sort())
    cases.push(["六跑 "+sub.split("/")[0]+"/"+f, path.join(d,f)]);
}

console.log("文件".padEnd(42)+"画布        画布比   前景包围盒        盒比    盒/画布");
for (const [label, p] of cases) {
  const img = decodePNG(fs.readFileSync(p));
  const m = dominantOpaqueColor(img);
  const keyed = keyBackground(img, { tolerance: 30, colors: [m.color] });
  // 前景 = 抠完之后还剩的像素。keyed.image 的 alpha 为 0 即被抠掉。
  const ch = keyed.image.channels ?? 4;
  const px = keyed.image.data;
  const W = keyed.image.width, H = keyed.image.height;
  const b = bbox(keyed.image, (x,y)=> px[(y*W+x)*ch + (ch-1)] > 0);
  const cr = img.width/img.height;
  if (!b) { console.log(label.padEnd(42)+"（全被抠掉）"); continue; }
  const br = b.w/b.h;
  console.log(label.padEnd(42)+(img.width+"x"+img.height).padEnd(12)+cr.toFixed(4).padEnd(9)
    +(b.w+"x"+b.h).padEnd(18)+br.toFixed(4).padEnd(8)+(br/cr).toFixed(3)+"  [占图 "+(b.n/(img.width*img.height)*100).toFixed(1)+"%]");
}
