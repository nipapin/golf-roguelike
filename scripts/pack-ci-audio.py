#!/usr/bin/env python3
"""Render game-specific derivatives of Chequered Ink's 400 Sounds Pack.

Usage: python scripts/pack-ci-audio.py /path/to/extracted/400-sounds-pack
Requires ffmpeg, ffprobe, numpy. Original WAVs stay outside the repository.
"""
import hashlib
import json
import pathlib
import re
import subprocess
import sys

import numpy as np

RATE = 48000
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = pathlib.Path(sys.argv[1])
OUTPUT = ROOT / 'public/audio/ci-v1'
# filename: (maximum duration, RMS target dBFS, [(source WAV, weight, rate)])
SOUNDS = {
    'card-1': (.35, -23, [('Card and Board/card_draw_1.wav', 1, 1)]),
    'card-2': (.28, -23, [('Card and Board/card_draw_2.wav', 1, 1)]),
    'card-3': (.35, -23, [('Card and Board/card_draw_3.wav', 1, 1)]),
    'shuffle': (.65, -22, [('Card and Board/card_fan_2.wav', 1, 1)]),
    'step-1': (.3, -23, [('Footsteps/foley_footstep_gravel_1.wav', 1, 1)]),
    'step-2': (.3, -23, [('Footsteps/foley_footstep_gravel_2.wav', 1, 1)]),
    'arrow': (.3, -20, [('Other/elastic_twang.wav', .7, 1.1), ('Combat and Gore/swipe.wav', .3, 1.2)]),
    'sword': (.35, -19, [('Weapons/sword_light.wav', 1, 1)]),
    'strike': (.35, -18, [('Combat and Gore/punch_2.wav', .8, 1), ('Materials/cardboard_hit.wav', .4, 1)]),
    'wall-hit': (.45, -16, [('Materials/cardboard_hit.wav', .8, .9), ('Weapons/harsh_thud.wav', .6, .9)]),
    'armor': (.35, -19, [('Weapons/sword_clash_2.wav', 1, 1)]),
    'reload': (.4, -21, [('Weapons/weapon_equip_short.wav', 1, 1)]),
    'deploy': (.4, -21, [('Weapons/weapon_pick_up.wav', 1, 1.2)]),
    'combo': (.3, -20, [('Match Three/match_xylophone_1.wav', 1, 1)]),
    'crit': (.55, -18, [('Weapons/weapon_upgrade.wav', .8, 1), ('Weapons/sword_clash.wav', .25, 1)]),
    'heal': (.75, -18, [('Items/heart_collect.wav', 1, 1)]),
    'gold': (.45, -19, [('Items/coins_gather_quick.wav', 1, 1)]),
    'wild': (.85, -19, [('Musical Effects/vibraphone_chime_quick.wav', 1, 1)]),
    'echo': (.7, -20, [('Materials/glass_ping_small.wav', .5, 1), ('Match Three/match_xylophone_1.wav', .5, .85)]),
    'red-joker': (.8, -18, [('Items/heart_collect.wav', .8, .9), ('Musical Effects/vibraphone_chime_positive.wav', .35, 1)]),
    'black-joker': (.7, -18, [('Weapons/weapon_upgrade.wav', .7, .85), ('Materials/metal_clang.wav', .35, .9)]),
    'click': (.16, -23, [('Other/controller_button_press.wav', 1, 1)]),
    'invalid': (.25, -22, [('UI/cancel.wav', 1, 1)]),
    'win': (3.15, -19, [('Musical Effects/brass_level_complete.wav', 1, 1)]),
    'lose': (3.5, -20, [('Musical Effects/grand_piano_defeated.wav', 1, 1.1)]),
}


def decode(path, rate):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-ar', str(RATE),
                                   '-ac', '1', '-f', 'f32le', '-'])
    x = np.frombuffer(raw, dtype='<f4').copy()
    active = np.flatnonzero(abs(x) > .004)
    if len(active):
        x = x[max(0, active[0] - 240):min(len(x), active[-1] + 1440)]
    if rate != 1:
        x = np.interp(np.arange(0, len(x), rate), np.arange(len(x)), x)
    peak = max(float(np.max(abs(x))), .0001)
    return x / peak


def measure(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1',
                                   '-ar', str(RATE), '-f', 'f32le', '-'])
    x = np.frombuffer(raw, dtype='<f4')
    result = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af',
                             'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-'],
                            capture_output=True, text=True, check=True)
    loudness = json.loads(re.search(r'\{\s*"input_i".*?\}', result.stderr, re.S)[0])
    return {'duration': round(len(x) / RATE, 4),
            'rms_dbfs': round(float(20 * np.log10(np.sqrt(np.mean(x*x)))), 2),
            'true_peak_dbtp': float(loudness['input_tp']),
            'integrated_lufs': None if loudness['input_i'] == '-inf' else float(loudness['input_i'])}


OUTPUT.mkdir(parents=True, exist_ok=True)
manifest = {}
for name, (duration, target, layers) in SOUNDS.items():
    audio = np.zeros(round(duration * RATE))
    end = 0
    sources = []
    for filename, weight, rate in layers:
        path = SOURCE / filename
        x = decode(path, rate)
        length = min(len(audio), len(x))
        audio[:length] += x[:length] * weight
        end = max(end, length)
        sources.append({'path': filename, 'weight': weight, 'rate': rate,
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    audio = audio[:end]
    # Gentle saturation reduces extreme crest factors before peak-bounded RMS matching.
    audio = np.tanh(audio * 1.6) / 1.6
    fade = min(round(.035 * RATE), len(audio) // 2)
    audio[-fade:] *= np.linspace(1, 0, fade)
    audio[:48] *= np.linspace(0, 1, 48)
    gain = min(10**(target / 20) / np.sqrt(np.mean(audio*audio)),
               10**(-2.5 / 20) / np.max(abs(audio)))
    pcm = (audio * gain).astype('<f4').tobytes()
    dest = OUTPUT / f'{name}.mp3'
    def encode(attenuation=1):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE),
                        '-ac', '1', '-i', '-', '-af', f'volume={attenuation}', '-ar', str(RATE),
                        '-ac', '1', '-b:a', '128k', str(dest)], input=pcm, check=True)
    encode()
    stats = measure(dest)
    if stats['true_peak_dbtp'] > -1.5:
        encode(10**((-1.6 - stats['true_peak_dbtp']) / 20))
        stats = measure(dest)
    assert stats['true_peak_dbtp'] <= -1.5, (name, stats)
    manifest[name] = {'sources': sources, 'rms_target_dbfs': target, **stats}
    print(name, stats)
(OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
