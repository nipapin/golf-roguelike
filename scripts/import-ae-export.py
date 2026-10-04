"""Pack the supplied AE grids into lossless, padded Phaser multi-atlases.

Run from any directory: python scripts/import-ae-export.py
Source PNGs/JSON are never modified. Requires Pillow.
"""
import argparse
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PADDING = 2
MAX_PAGE = 2048


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=ROOT.parent / "game-assets/export")
    args = parser.parse_args()
    source = args.source.resolve()
    output = ROOT / "public/assets/ae-export"
    output.mkdir(parents=True, exist_ok=True)
    # archer.json is the complete supplied catalog (also contains knight/turret).
    catalog = json.loads((source / "archer.json").read_text(encoding="utf-8-sig"))
    castle = next(asset for asset in catalog if asset["key"] == "castle")
    # This foreground sheet is a synchronized copy of the castle animation.
    catalog = [asset for asset in catalog if asset["key"] != "castle-gate-cover"]
    catalog.append({**castle, "key": "castle-gate-cover", "file": "castle-gate-cover.png"})
    assets, warnings = {}, []
    for asset in catalog:
        key = asset["key"]
        sheet = Image.open(source / asset["file"]).convert("RGBA")
        fw, fh = asset["frameWidth"], asset["frameHeight"]
        if sheet.width % fw or sheet.height % fh:
            raise ValueError(f"{key}: image dimensions must be multiples of the cell size")
        columns = sheet.width // fw
        count = columns * (sheet.height // fh)
        animations = {name.replace("shoot", "attack"): dict(config)
                      for name, config in asset["animations"].items()}
        # The supplied cannon has 40 cells, but its idle references 39..58.
        # Retain the valid, fully assembled frame; do not invent missing motion.
        for name, animation in animations.items():
            if animation["end"] >= count:
                if name != "idle" or animation["start"] >= count:
                    raise ValueError(f"{key}/{name}: frame outside 0..{count - 1}")
                warnings.append(f"{key}/{name}: {animation['start']}..{animation['end']} requested; "
                                f"only {count} cells supplied; using frame {animation['start']}.")
                animation["end"] = animation["start"]
        if "reveal" in animations:
            if animations["reveal"]["repeat"] != 0:
                warnings.append(f"{key}/reveal: repeat normalized to 0 (deployment plays once).")
            animations["reveal"]["repeat"] = 0
        if "idle" not in animations:
            frame = animations.get("reveal", animations.get("walk"))["end"]
            animations["idle"] = {"start": frame, "end": frame, "frameRate": 30, "repeat": -1}
        for name, animation in animations.items():
            if not 0 <= animation["start"] <= animation["end"] < count:
                raise ValueError(f"{key}/{name}: invalid range")
        used = sorted({i for a in animations.values() for i in range(a["start"], a["end"] + 1)})
        page_cols = MAX_PAGE // (fw + 2 * PADDING)
        page_rows = MAX_PAGE // (fh + 2 * PADDING)
        if not page_cols or not page_rows:
            raise ValueError(f"{key}: cell exceeds the atlas page limit")
        capacity = page_cols * page_rows
        textures, bounds = [], []
        for page_id, start in enumerate(range(0, len(used), capacity)):
            indices = used[start:start + capacity]
            cols = min(page_cols, len(indices))
            rows = math.ceil(len(indices) / cols)
            page = Image.new("RGBA", (cols * (fw + 4), rows * (fh + 4)))
            frames = []
            for offset, index in enumerate(indices):
                sx, sy = (index % columns) * fw, (index // columns) * fh
                tile = sheet.crop((sx, sy, sx + fw, sy + fh))
                if tile.getbbox():
                    bounds.append(tile.getbbox())
                x = (offset % cols) * (fw + 4) + PADDING
                y = (offset // cols) * (fh + 4) + PADDING
                page.paste(tile, (x, y))
                # Extrude edge pixels into the gutter to prevent sampling adjacent frames.
                for delta in (1, 2):
                    page.paste(tile.crop((0, 0, 1, fh)), (x - delta, y))
                    page.paste(tile.crop((fw - 1, 0, fw, fh)), (x + fw - 1 + delta, y))
                    page.paste(tile.crop((0, 0, fw, 1)), (x, y - delta))
                    page.paste(tile.crop((0, fh - 1, fw, fh)), (x, y + fh - 1 + delta))
                frames.append({"filename": f"frame-{index:04}", "rotated": False, "trimmed": False,
                               "frame": {"x": x, "y": y, "w": fw, "h": fh},
                               "spriteSourceSize": {"x": 0, "y": 0, "w": fw, "h": fh},
                               "sourceSize": {"w": fw, "h": fh}})
            filename = f"{key}-{page_id}.webp"
            page.save(output / filename, lossless=True, exact=True, method=6)
            textures.append({"image": filename, "size": {"w": page.width, "h": page.height},
                             "frames": frames})
        dump(output / f"{key}.json", {"textures": textures})
        box = [min(b[0] for b in bounds), min(b[1] for b in bounds),
               max(b[2] for b in bounds), max(b[3] for b in bounds)]
        assets[key] = {"key": f"ae-{key}", "atlas": f"/assets/ae-export/{key}.json",
                       "frameWidth": fw, "frameHeight": fh, "frameCount": count,
                       "bounds": box, "animations": animations}
        print(f"{key}: {count} cells, {len(used)} used, {len(textures)} pages <= {MAX_PAGE}px")
    for name in ("background", "castle-cover", "castle-gate"):
        Image.open(source / f"{name}.png").save(output / f"{name}.webp", lossless=True, exact=True, method=6)
    manifest = {"assets": assets, "warnings": warnings}
    dump(ROOT / "src/castle/exportedArt.json", manifest)
    dump(output / "manifest.json", manifest)
    for warning in warnings:
        print("NOTE:", warning)


if __name__ == "__main__":
    main()
