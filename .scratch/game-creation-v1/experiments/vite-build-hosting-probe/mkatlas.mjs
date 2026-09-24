import zlib from 'node:zlib';
import fs from 'node:fs';

function crc32(buf){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}
let crc=0xFFFFFFFF;for(const b of buf)crc=t[(crc^b)&0xFF]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0}

function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
const td=Buffer.concat([Buffer.from(type,'ascii'),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([len,td,c])}

function png(w,h,rgba){
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4)}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

const W=128,H=64;
const px=Buffer.alloc(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;
  const inA = x<64;
  px[i]   = inA ? 220 : 40;
  px[i+1] = inA ? 60  : 180;
  px[i+2] = inA ? 60  : 90;
  px[i+3] = (x%32<2||y%32<2) ? 0 : 255; // transparent grid lines
}
const out=process.argv[2];
fs.mkdirSync(out.replace(/\/[^/]+$/,''),{recursive:true});
fs.writeFileSync(out, png(W,H,px));
fs.writeFileSync(out.replace(/\.png$/,'.json'), JSON.stringify({
  frames: {
    "hero_0": { frame: {x:0,y:0,w:64,h:64}, rotated:false, trimmed:false, spriteSourceSize:{x:0,y:0,w:64,h:64}, sourceSize:{w:64,h:64} },
    "hero_1": { frame: {x:64,y:0,w:64,h:64}, rotated:false, trimmed:false, spriteSourceSize:{x:0,y:0,w:64,h:64}, sourceSize:{w:64,h:64} }
  },
  meta: { app:"probe", version:"1.0", image:"atlas.png", format:"RGBA8888", size:{w:W,h:H}, scale:"1" }
}, null, 0));
console.log('wrote', out);
