"""Package generated sheets without modifying their pixels; write Phaser atlases."""
import json
import shutil
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT.parent / 'game-assets' / 'generated-animations-v1'
PUBLIC = ROOT / 'public' / 'assets' / 'generated-animations-v1'


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main_character_box(alpha):
    """Locate the principal silhouette; ignore disconnected neighboring slivers.

    Only atlas coordinates change. PNG pixels are never modified.
    """
    width, height = alpha.size
    data = bytes(alpha.get_flattened_data())
    seen = bytearray(width * height)
    components = []
    for start, value in enumerate(data):
        if value <= 64 or seen[start]:
            continue
        seen[start] = 1
        queue = deque([start])
        count, left, top, right, bottom = 0, width, height, 0, 0
        while queue:
            index = queue.popleft()
            x, y = index % width, index // width
            count += 1
            left, top, right, bottom = min(left, x), min(top, y), max(right, x+1), max(bottom, y+1)
            for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                if 0 <= nx < width and 0 <= ny < height:
                    neighbor = ny * width + nx
                    if not seen[neighbor] and data[neighbor] > 64:
                        seen[neighbor] = 1
                        queue.append(neighbor)
        components.append((count, (left, top, right, bottom)))
    if not components:
        raise ValueError('empty silhouette')
    components.sort(reverse=True)
    size, box = components[0]
    left, top, right, bottom = box
    # A sheet frame must contain one principal connected character. Detached
    # slices at either edge belong to adjacent cells, not to this character.
    return max(0, left-2), max(0, top-2), min(width, right+2), min(height, bottom+2)


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    inputs = json.loads((DEST / 'generation-inputs.json').read_text(encoding='utf-8'))
    catalog = []
    for asset in inputs:
        key = asset['key']
        columns, row_count = asset.get('columns', 4), asset.get('rows', 4)
        frame_count = columns * row_count
        file = f'{key}.png'
        shutil.copy2(asset['source'], DEST / file)
        with Image.open(DEST / file) as image:
            width, height = image.size
            if image.mode != 'RGBA' or image.getchannel('A').getextrema() != (0, 255):
                raise ValueError(f'{key}: expected transparent RGBA output')
            # Generated rows can deviate from a perfectly uniform grid. Choose
            # clear horizontal gaps near nominal boundaries to retain feet.
            alpha = image.getchannel('A')
            rows = [0]
            for row in range(1, row_count):
                target = round(row * height / row_count)
                scores = []
                for y in range(max(rows[-1]+1, target-60), min(height, target+61)):
                    count = sum(value > 128 for value in alpha.crop((0, y, width, y+1)).get_flattened_data())
                    scores.append((count, abs(y-target), y))
                rows.append(min(scores)[2])
            rows.append(height)
            virtual_width = (width+columns-1)//columns
            virtual_height = max(rows[i+1]-rows[i] for i in range(row_count))
            frames = {}
            for index in range(frame_count):
                col, row = index % columns, index // columns
                left, right = round(col * width / columns), round((col + 1) * width / columns)
                top, bottom = rows[row], rows[row+1]
                if not image.getchannel('A').crop((left, top, right, bottom)).getbbox():
                    raise ValueError(f'{key}: empty frame {index}')
                l, t, r, b = main_character_box(alpha.crop((left, top, right, bottom)))
                frames[f'frame-{index:04d}'] = {
                    'frame': {'x': left+l, 'y': top+t, 'w': r-l, 'h': b-t},
                    'rotated': False, 'trimmed': True,
                    'spriteSourceSize': {'x': l, 'y': virtual_height-(bottom-top)+t, 'w': r-l, 'h': b-t},
                    'sourceSize': {'w': virtual_width, 'h': virtual_height},
                }
            atlas = {'frames': frames, 'meta': {'image': file, 'size': {'w': width, 'h': height}, 'scale': '1'}}
        dump(DEST / f'{key}.atlas.json', atlas)
        animations = {
            action: {'start': span[0], 'end': span[1], 'frameRate': span[2], 'repeat': span[3]}
            for action, span in asset['animations'].items()
        }
        for action, replacement in asset.get('animationOverrides', {}).items():
            animations[action] = {'start': replacement['start'], 'end': replacement['end'],
                                 'frameRate': replacement['frameRate'], 'repeat': replacement['repeat'],
                                 'asset': replacement['asset']}
        catalog.append({'key': key, 'title': asset['title'], 'file': file,
                        'atlas': f'{key}.atlas.json', 'columns': columns, 'rows': row_count,
                        'hidden': asset.get('hidden', False),
                        'sheetWidth': width, 'sheetHeight': height, 'rowBoundaries': rows,
                        'animations': animations})
        print(f'{key}: {width}x{height}, {frame_count} nonempty frames, transparent RGBA')
    dump(DEST / 'animations.json', catalog)
    dump(DEST / 'prompts.json', [{'key': a['key'], 'prompt': a['prompt']} for a in inputs])
    for file in DEST.iterdir():
        if file.name != 'generation-inputs.json' and file.is_file():
            shutil.copy2(file, PUBLIC / file.name)


if __name__ == '__main__':
    main()
