#!/usr/bin/env python3
"""P1: materialize the 11 negative mutation recipes from the frozen manifest.

Reads `fixtures/manifest.json` (frozen at sha256:dd880628...) and writes one
deterministic JSON file per negative recipe under `fixtures/recipes/`.
This script does not modify the manifest or any product fixture.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "fixtures"
MANIFEST = OUT / "manifest.json"
RECIPES = OUT / "recipes"

EXPECTED_CODES = [
    "frame-missing", "frame-size-mismatch", "anchor-mismatch", "trimmed",
    "rotated", "atlas-hash-mismatch", "atlas-missing", "body-size-mismatch",
    "body-offset-mismatch", "body-bounds-mismatch", "graph-solid-mismatch",
]


def dump(value) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
negatives = manifest["negative"]
codes = [n["code"] for n in negatives]
assert codes == EXPECTED_CODES, codes
assert len(negatives) == 11, len(negatives)

RECIPES.mkdir(parents=True, exist_ok=True)
for negative in negatives:
    (RECIPES / f"{negative['code']}.json").write_text(dump(negative), encoding="utf-8")
print(f"wrote {len(negatives)} recipes to {RECIPES}")
