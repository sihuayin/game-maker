#!/usr/bin/env python3
"""I03-03B2: freeze the row-level geometry-probe fixture manifest.

This is a **planning artifact**:
- reads the frozen `fixtures/packs/last-train/v2` and game config;
- writes a v4-normalized manifest under `fixtures/last-train-v4/`;
- enumerates every required positive frame / body row with expected values;
- records 10 negative mutation recipes + input/output hashes;
- does NOT copy binary packs and does NOT implement the probe.

Rebuild:
  python3 .scratch/level-playability-v1.1-i03/evidence/geometry-probe/scripts/build-fixtures.py
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
PACK = ROOT / "fixtures/packs/last-train/v2"
CONFIG = ROOT / "fixtures/game-configs/last-train.json"
HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "fixtures"
NORMALIZED = OUT / "last-train-v4"
MANIFEST_OUT = OUT / "manifest.json"
NORMALIZATION_OUT = OUT / "normalization.json"

def sha_bytes(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()

def sha_file(path: Path) -> str:
    return sha_bytes(path.read_bytes())

def tree_hash(directory: Path) -> str:
    records = []
    for path in sorted(p for p in directory.rglob("*") if p.is_file()):
        records.append(path.relative_to(directory).as_posix() + "\0" + sha_file(path))
    return sha_bytes("\n".join(records).encode("utf-8"))

def entity_box(at, size, anchor):
    return {
        "x": round(at["x"] - anchor["x"] * size["w"]),
        "y": round(at["y"] - anchor["y"] * size["h"]),
        "w": size["w"], "h": size["h"],
    }

def foot_of(at, size, anchor):
    return {
        "x": at["x"] + (0.5 - anchor["x"]) * size["w"],
        "y": at["y"] + (1 - anchor["y"]) * size["h"],
    }

def box_from_foot(foot, size):
    return {
        "x": foot["x"] - size["w"] / 2.0,
        "y": foot["y"] - size["h"],
        "w": size["w"], "h": size["h"],
    }

def load(path: Path):
    return json.loads(path.read_text())

def dump(value) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"

raw_manifest = load(PACK / "manifest.json")
config = load(CONFIG)
atlas = load(PACK / "delivery/atlas.animations.json")

# ── v4 normalization (manifest only; pack files stay in place) ──────────────
normalized = {
    **raw_manifest,
    "format": "assetpack/v4",
    "provenance": {"mode": raw_manifest["provenance"]["mode"]},
}
NORMALIZED.mkdir(parents=True, exist_ok=True)
(NORMALIZED / "manifest.json").write_text(dump(normalized))
normalized_bytes = (NORMALIZED / "manifest.json").read_bytes()

atlas_hashes = {}
for name in ["animations", "backgrounds", "sprites", "ui"]:
    for suffix in ["json", "png"]:
        p = PACK / f"delivery/atlas.{name}.{suffix}"
        atlas_hashes[p.relative_to(PACK).as_posix()] = sha_file(p)

base = {
    "sourcePack": PACK.relative_to(ROOT).as_posix(),
    "sourcePackHash": tree_hash(PACK),
    "sourceManifestHash": sha_file(PACK / "manifest.json"),
    "sourceConfig": CONFIG.relative_to(ROOT).as_posix(),
    "sourceConfigHash": sha_file(CONFIG),
    "normalization": {
        "format": "assetpack/v4",
        "provenance": {"mode": raw_manifest["provenance"]["mode"]},
        "note": "manifest-only normalization; delivery/authoring files stay in the frozen v2 pack",
        "sourceManifestHash": sha_file(PACK / "manifest.json"),
        "normalizedManifestPath": (NORMALIZED / "manifest.json").relative_to(ROOT).as_posix(),
        "normalizedManifestHash": sha_bytes(normalized_bytes),
    },
    "atlasHashes": atlas_hashes,
}

# ── positive rows ───────────────────────────────────────────────────────────
assets = {a["id"]: a for a in raw_manifest["assets"]}
entities = {e["id"]: e for e in config["entities"]}
player = config["player"]
hero = assets[player["asset"]]
hero_size = hero["size"]
hero_anchor = hero.get("anchor", {"x": 0.5, "y": 1})
player_foot = foot_of(player["at"], hero_size, hero_anchor)
player_box = box_from_foot(player_foot, hero_size)

hazard_entity = next(e for e in config["entities"] if e["kind"] == "hazard" and e.get("motion"))
hazard = assets[hazard_entity["asset"]]
hazard_box = entity_box(hazard_entity["at"], hazard["size"], hazard.get("anchor", {"x": 0.5, "y": 1}))

rows = []
for frame in hazard["frames"]:
    name = frame["name"]
    f = atlas["frames"][name]
    rows.append({
        "dimension": "hazard",
        "assetId": hazard["id"],
        "frameName": name,
        "expected": {
            "size": hazard["size"],
            "anchor": hazard.get("anchor", {"x": 0.5, "y": 1}),
            "box": hazard_box,
            "frameBounds": f["frame"],
            "sourceSize": f["sourceSize"],
            "trimmed": f["trimmed"],
            "rotated": f["rotated"],
        },
        "source": "manifest.size/anchor + atlas frame + entityBox",
    })

for name in [f["name"] for f in hero["frames"]]:
    f = atlas["frames"][name]
    rows.append({
        "dimension": "player",
        "assetId": hero["id"],
        "frameName": name,
        "expected": {
            "size": hero_size,
            "anchor": hero_anchor,
            "box": player_box,
            "foot": player_foot,
            "frameBounds": f["frame"],
            "sourceSize": f["sourceSize"],
            "trimmed": f["trimmed"],
            "rotated": f["rotated"],
            "body": {
                "size": hero_size,
                "offset": {"x": 0, "y": 0},
                "bounds": player_box,
                "foot": player_foot,
            },
        },
        "source": "manifest.size/anchor + footOf + boxFromFoot + scene.ts body contract",
    })

terrain = config["terrain"][0]
rows.append({
    "dimension": "graph",
    "bodyId": "terrain#0",
    "expected": {"box": {"x": terrain["x"], "y": terrain["y"], "w": terrain["w"], "h": terrain["h"]}},
    "source": "config.terrain[0]",
})
luggage_entity = entities["luggage"]
luggage = assets[luggage_entity["asset"]]
rows.append({
    "dimension": "graph",
    "bodyId": "luggage",
    "expected": {
        "box": entity_box(luggage_entity["at"], luggage["size"], luggage.get("anchor", {"x": 0.5, "y": 1})),
        "size": luggage["size"],
        "anchor": luggage.get("anchor", {"x": 0.5, "y": 1}),
    },
    "source": "config entity + manifest.size/anchor + entityBox",
})
rows.append({
    "dimension": "graph",
    "bodyId": "player",
    "expected": {"box": player_box, "size": hero_size, "foot": player_foot},
    "source": "runtimePlayerGeometry (footOf + boxFromFoot)",
})

# ── negative mutation recipes (no binary copies) ────────────────────────────
base_manifest_bytes = (NORMALIZED / "manifest.json").read_bytes()
base_manifest = load(NORMALIZED / "manifest.json")
atlas_path = "delivery/atlas.animations.json"
base_atlas_bytes = (PACK / atlas_path).read_bytes()

def update_manifest_json_checksum(manifest, new_bytes):
    for f in manifest["files"]:
        if f["path"] == atlas_path:
            f["checksum"] = sha_bytes(new_bytes)

def mutate_atlas(*, code, cls, mutation, expected, update_checksum):
    a = json.loads(base_atlas_bytes)
    mutation["apply"](a)
    new_atlas = dump(a).encode("utf-8")
    m = json.loads(base_manifest_bytes)
    if update_checksum:
        update_manifest_json_checksum(m, new_atlas)
    new_manifest = dump(m).encode("utf-8")
    return {
        "code": code,
        "class": cls,
        "mutation": {k: v for k, v in mutation.items() if k != "apply"},
        "input": {"atlasPath": atlas_path, "atlasHash": sha_bytes(base_atlas_bytes), "manifestHash": sha_bytes(base_manifest_bytes)},
        "output": {
            "atlasHash": sha_bytes(new_atlas),
            "manifestHash": sha_bytes(new_manifest),
            "manifestChecksumUpdated": update_checksum,
        },
        "expected": expected,
    }

def set_frame_size(a):
    a["frames"]["player-traveler.idle1"]["sourceSize"]["w"] = 33

def set_anchor(a):
    a["frames"]["player-traveler.idle1"]["anchor"]["x"] = 0.55

def set_trimmed(a):
    a["frames"]["player-traveler.idle1"]["trimmed"] = True

def set_rotated(a):
    a["frames"]["player-traveler.idle1"]["rotated"] = True

def delete_frame(a):
    del a["frames"]["player-traveler.idle1"]

def mutate_meta(a):
    a.setdefault("meta", {})["app"] = "i03-negative-atlas-hash-mismatch"

negatives = []
negatives.append(mutate_atlas(
    code="frame-missing", cls="geometry-mismatch",
    mutation={"kind": "delete-frame", "path": atlas_path, "frame": "player-traveler.idle1", "apply": delete_frame},
    expected={"affected": ["player"], "coverage": {"hazard": "checked", "player": "partial", "graph": "checked"}, "summary": "untrusted", "failureCode": "frame-missing"},
    update_checksum=True,
))
negatives.append(mutate_atlas(
    code="frame-size-mismatch", cls="geometry-mismatch",
    mutation={"kind": "set-frame-sourceSize", "path": atlas_path, "frame": "player-traveler.idle1", "field": "sourceSize.w", "before": 32, "after": 33, "apply": set_frame_size},
    expected={"affected": ["player"], "coverage": {"hazard": "checked", "player": "partial", "graph": "checked"}, "summary": "untrusted", "failureCode": "frame-size-mismatch"},
    update_checksum=True,
))
negatives.append(mutate_atlas(
    code="anchor-mismatch", cls="geometry-mismatch",
    mutation={"kind": "set-frame-anchor", "path": atlas_path, "frame": "player-traveler.idle1", "field": "anchor.x", "before": 0.5, "after": 0.55, "apply": set_anchor},
    expected={"affected": ["player"], "coverage": {"hazard": "checked", "player": "partial", "graph": "checked"}, "summary": "untrusted", "failureCode": "anchor-mismatch"},
    update_checksum=True,
))
negatives.append(mutate_atlas(
    code="trimmed", cls="geometry-mismatch",
    mutation={"kind": "set-frame-flag", "path": atlas_path, "frame": "player-traveler.idle1", "field": "trimmed", "before": False, "after": True, "apply": set_trimmed},
    expected={"affected": ["player"], "coverage": {"hazard": "checked", "player": "partial", "graph": "checked"}, "summary": "untrusted", "failureCode": "trimmed"},
    update_checksum=True,
))
negatives.append(mutate_atlas(
    code="rotated", cls="geometry-mismatch",
    mutation={"kind": "set-frame-flag", "path": atlas_path, "frame": "player-traveler.idle1", "field": "rotated", "before": False, "after": True, "apply": set_rotated},
    expected={"affected": ["player"], "coverage": {"hazard": "checked", "player": "partial", "graph": "checked"}, "summary": "untrusted", "failureCode": "rotated"},
    update_checksum=True,
))
negatives.append(mutate_atlas(
    code="atlas-hash-mismatch", cls="geometry-mismatch",
    mutation={"kind": "mutate-atlas-meta-leave-manifest-checksum", "path": atlas_path, "field": "meta.app", "apply": mutate_meta},
    expected={"affected": ["hazard", "player"], "coverage": {"hazard": "partial", "player": "partial", "graph": "checked"}, "summary": "untrusted", "failureCode": "atlas-hash-mismatch"},
    update_checksum=False,
))

negatives.append({
    "code": "atlas-missing", "class": "missing-evidence",
    "mutation": {"kind": "delete-file", "path": atlas_path},
    "input": {"atlasPath": atlas_path, "atlasHash": sha_bytes(base_atlas_bytes), "manifestHash": sha_bytes(base_manifest_bytes)},
    "output": {"atlasHash": None, "manifestHash": sha_bytes(base_manifest_bytes), "manifestChecksumUpdated": False},
    "expected": {"affected": ["hazard", "player"], "coverage": {"hazard": "partial", "player": "partial", "graph": "checked"}, "summary": "partial", "failureCode": "atlas-missing"},
})

def recipe(code, cls, override, affected, coverage):
    value = {
        "code": code, "class": cls,
        "mutation": {"kind": "runtime-override", "override": override},
        "input": {"baseManifestHash": sha_bytes(base_manifest_bytes), "baseAtlasHash": sha_bytes(base_atlas_bytes)},
        "output": {"recipeHash": sha_bytes(dump({"code": code, "override": override}).encode("utf-8"))},
        "expected": {"affected": affected, "coverage": coverage, "summary": "untrusted", "failureCode": code},
    }
    return value

negatives.append(recipe("body-size-mismatch", "geometry-mismatch",
    {"target": "player", "body": {"size": {"w": 34, "h": 48}}}, ["player", "graph"],
    {"hazard": "checked", "player": "partial", "graph": "partial"}))
negatives.append(recipe("body-offset-mismatch", "geometry-mismatch",
    {"target": "player", "body": {"offset": {"x": 1, "y": 0}}}, ["player", "graph"],
    {"hazard": "checked", "player": "partial", "graph": "partial"}))
negatives.append(recipe("graph-solid-mismatch", "geometry-mismatch",
    {"target": "luggage", "box": {"x": 480, "y": 210, "w": 42, "h": 40}}, ["graph"],
    {"hazard": "checked", "player": "checked", "graph": "partial"}))

manifest = {
    "version": "i03-geometry-probe-fixtures/v1",
    "base": base,
    "positive": {
        "fixtureId": "last-train-v4",
        "dimensions": ["hazard", "player", "graph"],
        "rows": rows,
    },
    "negative": negatives,
    "reviewOnly": [
        {"code": "environment-mismatch", "class": "environment", "note": "review-level; do not compare across environments"},
        {"code": "nondeterministic", "class": "nondeterministic", "note": "same environment rerun must be byte-identical"},
    ],
    "noFixture": [
        {"code": "probe-not-run", "note": "execution missing; not a geometry mutation"},
    ],
    "storage": {
        "positive": (NORMALIZED / "manifest.json").relative_to(ROOT).as_posix(),
        "manifest": MANIFEST_OUT.relative_to(ROOT).as_posix(),
        "rebuild": ".scratch/level-playability-v1.1-i03/evidence/geometry-probe/scripts/build-fixtures.py",
        "copies": "not materialized by B2; implementation must materialize from base + recipes",
    },
}
MANIFEST_OUT.write_text(dump(manifest))
NORMALIZATION_OUT.write_text(dump(base["normalization"]))
print("wrote", MANIFEST_OUT)
print("rows", len(rows), "negative", len(negatives), "basePackHash", base["sourcePackHash"])
