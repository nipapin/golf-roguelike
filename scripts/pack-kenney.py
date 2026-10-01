"""Pack rendered sprites and silence-trimmed audio. Requires Pillow and ffmpeg.
Usage: python scripts/pack-kenney.py PACK_ROOT PUBLIC_DIR
See docs/KENNEY_ASSETS.md for source downloads and licenses.
"""
import sys
from PIL import Image
from pathlib import Path
import json, subprocess, shutil
root=Path(sys.argv[1]); dest=Path(sys.argv[2]); art=dest/'assets/kenney'; art.mkdir(parents=True,exist_ok=True)
for name in ['castle','turret','mortar','battlefield']:
 Image.open(root/'renders'/f'{name}.png').save(art/f'{name}.webp',quality=94,method=6)
for kind,keys in [('orc',['c_orc','c_goblin','c_reaper2','c_ogre','c_reaper1']),('human',['c_angel1','c_angel2'])]:
 frames=[Image.open(root/'renders'/f'{kind}-{state}-{i}.png') for state,count in [('idle',4),('walk',8),('attack',4),('hurt',2),('dead',4)] for i in range(count)]
 sheet=Image.new('RGBA',(8*160,3*160))
 for i,im in enumerate(frames):sheet.paste(im,((i%8)*160,(i//8)*160))
 sheet.save(art/f'{kind}.webp',quality=94,method=6)
 for key in keys:
  data={'frames':{f'{key}_{i:03}':{'frame':{'x':(i%8)*160,'y':(i//8)*160,'w':160,'h':160},'rotated':False,'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':160,'h':160},'sourceSize':{'w':160,'h':160}} for i in range(22)},'meta':{'image':kind+'.webp','size':{'w':1280,'h':480},'scale':'1'}}
  (art/f'{key}.json').write_text(json.dumps(data,separators=(',',':')))
licenses=art/'licenses';licenses.mkdir(exist_ok=True)
for pack in ['castle','tower','dungeon','casino','rpg','scifi']:shutil.copy(root/pack/'License.txt',licenses/f'{pack}.txt')
audio=dest/'audio'
sources=[('kenney-card-slide-1','casino/Audio/card-slide-1.ogg',.28),('kenney-card-slide-2','casino/Audio/card-slide-2.ogg',.28),('kenney-card-slide-3','casino/Audio/card-slide-3.ogg',.28),('kenney-card-shuffle','casino/Audio/card-shuffle.ogg',1.0),('kenney-step-1','rpg/Audio/footstep00.ogg',.35),('kenney-step-2','rpg/Audio/footstep01.ogg',.35),('orc-growl','orcs/ORC GROWL.wav',1.3),('orc-hit','orcs/ORC GRUNT.wav',.45),('orc-death','orcs/ORC DIES.wav',.7),('laser-blast','scifi/Audio/laserLarge_000.ogg',1.1),('mortar-shot','mortar-shot.wav',.65),('turret-shot','turret-shot.wav',.2)]
for name,source,duration in sources:
 path=root/source
 if not path.exists() and name=='orc-hit':path=next((root/'orcs').glob('ORC GRUNT*'))
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-af',f'silenceremove=start_periods=1:start_threshold=-40dB,loudnorm=I=-18:TP=-2:LRA=7,afade=t=out:st={max(0,duration-.04)}:d=0.04','-t',str(duration),'-ar','44100','-ac','1','-b:a','96k',str(audio/f'{name}.mp3')],check=True)
subprocess.run(['ffmpeg','-v','error','-y','-i',str(root/'music.ogg'),'-af','loudnorm=I=-19:TP=-2:LRA=10','-ar','44100','-ac','2','-b:a','96k',str(audio/'heartfelt-battle.mp3')],check=True)
print('Rendered assets and 13 audio files ready')
