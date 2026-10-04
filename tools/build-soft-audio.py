"""Build restrained, recorded cues from the downloaded licensed source packs.

Sources live in .local/audio-sources (not redistributed). Requires ffmpeg/ffprobe.
Music OGGs are copied byte-for-byte separately to preserve YannZ's metadata.
"""
import array
import hashlib
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / '.local/audio-sources'
OUTPUT = ROOT / 'public/audio/soft-v1'
OUTPUT.mkdir(parents=True, exist_ok=True)
CUES = {
    'laser': (SOURCES / 'scifi/Audio/laserLarge_000.ogg', 5200, .052),
    'sword': (SOURCES / 'rpg/Audio/knifeSlice.ogg', 6000, .052),
    'step-1': (SOURCES / 'rpg/Audio/footstep04.ogg', 4200, .04),
    'step-2': (SOURCES / 'rpg/Audio/footstep06.ogg', 4200, .04),
    'reload': (SOURCES / 'rpg/Audio/metalLatch.ogg', 5400, .046),
    'deploy': (SOURCES / 'rpg/Audio/cloth1.ogg', 5200, .04),
    'arrow': (ROOT / 'public/audio/ci-v1/arrow.mp3', 5600, .045),
    'turret': (ROOT / 'public/audio/ci-v1/gun.mp3', 3800, .05),
    'mortar': (ROOT / 'public/audio/ci-v1/bomb.mp3', 4200, .065),
    'wall-hit': (ROOT / 'public/audio/ci-v1/wall-hit.mp3', 3800, .055),
}
manifest = {}
for name, (source, cutoff, target) in CUES.items():
    data = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(source), '-ac', '1',
        '-ar', '48000', '-af', f'highpass=f=65,lowpass=f={cutoff}', '-f', 'f32le', '-'])
    samples = array.array('f', data)
    peak = max(abs(v) for v in samples)
    rms = math.sqrt(sum(v * v for v in samples) / len(samples))
    gain = min(target / max(rms, .00001), .5 / max(peak, .00001), 4)
    fade_in, fade_out = 240, 2400
    for i in range(len(samples)):
        envelope = min(1, i / fade_in, (len(samples) - 1 - i) / fade_out)
        samples[i] *= gain * max(0, envelope)
    output = OUTPUT / (name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', '48000', '-ac', '1',
        '-i', '-', '-codec:a', 'libmp3lame', '-b:a', '128k', str(output)], input=samples.tobytes(), check=True)
    manifest[name] = {'source': source.relative_to(ROOT).as_posix(),
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'lowpassHz': cutoff,
        'gain': gain, 'durationSeconds': len(samples) / 48000,
        'peakBeforeEncoding': max(abs(v) for v in samples),
        'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest()}
(OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'Built {len(CUES)} recorded cues in {OUTPUT}')
