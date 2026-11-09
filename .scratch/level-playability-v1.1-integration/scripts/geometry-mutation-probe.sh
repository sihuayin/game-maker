#!/usr/bin/env bash
# I00-02 · 几何证据传递性反例实验（全部在临时目录，绝不改 fixtures/packs）。
#
#   bash .scratch/level-playability-v1.1-integration/scripts/geometry-mutation-probe.sh
#
# 对 fixtures/packs/last-train/v2 的四份副本做四种「就地改写」，再用
# geometry-provenance-probe.mjs 各跑一遍：
#
#   pack-a   只改 atlas JSON（manifest.files[] 不更新）
#   pack-b   改 atlas JSON + 更新 manifest.files[]（内部一致，但几何与标称不符）
#   pack-c2  atlas JSON 与 manifest.asset.size 一起改（完全自洽的另一种几何声明）
#   pack-d   删掉某帧的 atlas anchor + 更新 files[]（锚点检查是条件式）
#
# 只依赖 node 与仓库现有文件；不写仓库内任何被跟踪文件。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROBE="$ROOT/.scratch/level-playability-v1.1-integration/scripts/geometry-provenance-probe.mjs"
SRC="$ROOT/fixtures/packs/last-train/v2"
TMP="$(mktemp -d /tmp/gm-i00-02.XXXXXX)"
ATLAS_REL="delivery/atlas.animations.json"

cp -R "$SRC" "$TMP/pack-a"
cp -R "$SRC" "$TMP/pack-b"
cp -R "$SRC" "$TMP/pack-c2"
cp -R "$SRC" "$TMP/pack-d"

# A：只改 atlas，不动 manifest.files[]
node -e '
const fs=require("fs"); const p=process.argv[1];
const j=JSON.parse(fs.readFileSync(p,"utf8"));
j.frames["hazard-sweeping-carriage.sweep1"].sourceSize={w:32,h:24};
fs.writeFileSync(p,JSON.stringify(j));' "$TMP/pack-a/$ATLAS_REL"

# B：改 atlas + 刷新 files[]（manifest 的几何声明不变）
node -e '
const fs=require("fs"),crypto=require("crypto"); const dir=process.argv[1], rel=process.argv[2];
const p=dir+"/"+rel;
const j=JSON.parse(fs.readFileSync(p,"utf8"));
j.frames["hazard-sweeping-carriage.sweep1"].sourceSize={w:32,h:24};
fs.writeFileSync(p,JSON.stringify(j));
const m=JSON.parse(fs.readFileSync(dir+"/manifest.json","utf8"));
const e=m.files.find(f=>f.path===rel); e.bytes=fs.statSync(p).size; e.checksum="sha256:"+crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
fs.writeFileSync(dir+"/manifest.json",JSON.stringify(m,null,2));' "$TMP/pack-b" "$ATLAS_REL"

# C2：atlas 与 manifest.asset.size 一起改成 32×24，并刷新 files[] —— 完全自洽
node -e '
const fs=require("fs"),crypto=require("crypto"); const dir=process.argv[1], rel=process.argv[2];
const p=dir+"/"+rel;
const j=JSON.parse(fs.readFileSync(p,"utf8"));
for (const [name,f] of Object.entries(j.frames)) {
  if (!name.startsWith("hazard-sweeping-carriage.")) continue;
  f.frame.w=32; f.frame.h=24;
  f.spriteSourceSize={x:0,y:0,w:32,h:24};
  f.sourceSize={w:32,h:24};
}
j.frames["hazard-sweeping-carriage.sweep2"].frame.y=24;
fs.writeFileSync(p,JSON.stringify(j));
const m=JSON.parse(fs.readFileSync(dir+"/manifest.json","utf8"));
const e=m.files.find(f=>f.path===rel); e.bytes=fs.statSync(p).size; e.checksum="sha256:"+crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
m.assets.find(a=>a.id==="hazard-sweeping-carriage").size={w:32,h:24};
fs.writeFileSync(dir+"/manifest.json",JSON.stringify(m,null,2));' "$TMP/pack-c2" "$ATLAS_REL"

# D：删掉某帧的 atlas anchor + 刷新 files[]（acceptance 的 anchor 对账是条件式）
node -e '
const fs=require("fs"),crypto=require("crypto"); const dir=process.argv[1], rel=process.argv[2];
const p=dir+"/"+rel;
const j=JSON.parse(fs.readFileSync(p,"utf8"));
delete j.frames["hazard-sweeping-carriage.sweep1"].anchor;
fs.writeFileSync(p,JSON.stringify(j));
const m=JSON.parse(fs.readFileSync(dir+"/manifest.json","utf8"));
const e=m.files.find(f=>f.path===rel); e.bytes=fs.statSync(p).size; e.checksum="sha256:"+crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
fs.writeFileSync(dir+"/manifest.json",JSON.stringify(m,null,2));' "$TMP/pack-d" "$ATLAS_REL"

run() {
  local label="$1" dir="$2"
  echo "===== $label ====="
  set +e
  node "$PROBE" "$dir"
  local code=$?
  set -e
  echo "EXIT=$code"
}

run "original (fixtures/packs/last-train/v2)" "$SRC"
run "pack-a (atlas only)" "$TMP/pack-a"
run "pack-b (atlas + files[])" "$TMP/pack-b"
run "pack-c2 (atlas + manifest.size + files[])" "$TMP/pack-c2"
run "pack-d (drop frame anchor + files[])" "$TMP/pack-d"

echo
echo "临时副本保留在：$TMP"
