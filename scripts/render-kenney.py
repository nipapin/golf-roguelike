"""Render Kenney CC0 GLB assets into mobile sprite sheets (Blender 4.3+).
Usage: blender -b -t 4 --python scripts/render-kenney.py -- PACK_ROOT OUTPUT_DIR
Pack sources and licenses: docs/KENNEY_ASSETS.md. No WebGL/3D runtime needed.
"""
import bpy, sys, math, pathlib, random
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]; root=pathlib.Path(args[0]); out=pathlib.Path(args[1]);out.mkdir(parents=True,exist_ok=True)
def clear(w=512,h=512,transparent=True):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=True
 s.render.resolution_x=w;s.render.resolution_y=h;s.render.resolution_percentage=100;s.render.film_transparent=transparent
 s.world.color=(.28,.35,.44);s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA'
 bpy.ops.object.light_add(type='AREA',location=(-4,-6,8));light=bpy.context.object;light.data.energy=900;light.data.shape='DISK';light.data.size=4
 bpy.ops.object.light_add(type='AREA',location=(5,3,5));bpy.context.object.data.energy=450;bpy.context.object.data.color=(.6,.78,1);bpy.context.object.data.size=5
 return s
def model(pack,name,location=(0,0,0),scale=1,angle=0):
 path=next((root/pack).rglob(name+'.glb'));before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(path));objects=set(bpy.context.scene.objects)-before
 roots=[o for o in objects if o.parent not in objects]
 for o in roots:o.location=location;o.scale*=scale;o.rotation_euler.z+=angle
 return objects
def camera(pos,target,scale):
 bpy.ops.object.camera_add(location=pos);c=bpy.context.object;c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=scale;bpy.context.scene.camera=c
 return c
def render(name):
 bpy.context.scene.render.filepath=str(out/name);bpy.ops.render.render(write_still=True)
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;return m
def box(loc,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;o.data.materials.append(mat);return o
# An assembled castle, rather than a vector placeholder.
clear(640,640)
for x in [-.95,.95]:
 model('castle','tower-square-base',(x,0,0));model('castle','tower-square-mid-windows',(x,0,1));model('castle','tower-square-top-roof-high',(x,0,2))
model('castle','tower-square-base',(0,.8,0),1.05);model('castle','tower-square-mid-windows',(0,.8,1),1.05);model('castle','tower-square-top-roof-high',(0,.8,2.05),1.05)
for x in [-.55,.55]:model('castle','wall-half',(x,-.25,0),1,math.pi/2)
model('castle','wall-narrow-gate',(0,-.5,0),1,math.pi/2);model('castle','gate',(0,-.5,.05),1,math.pi/2)
model('castle','flag',(0,.8,3.1),.9)
camera((-5,-8,5),(0,.15,1.6),4.8);render('castle.png')
for name,source in [('turret','weapon-turret'),('mortar','weapon-cannon')]:
 clear(256,256);model('tower',source,angle=-math.pi/2);camera((-4,-6,3),(0,0,.32),1.6);render(name+'.png')
# Compact diorama battlefield: modeled trees/rocks, real cast shadows and sunlit road.
s=clear(1280,560,False);s.world.color=(.4,.56,.7)
green=material('grass',(.25,.46,.26));sand=material('road',(.62,.47,.30));edge=material('edge',(.42,.31,.19))
box((0,0,-.15),(30,25,.25),green)
box((0,-2,-.005),(22,1.9,.04),edge);box((0,-2,.02),(22,1.6,.04),sand)
random.seed(24)
for i in range(22):
 x=random.uniform(-5.2,5.2);y=random.uniform(.5,2.8);model('castle','tree-large' if i%3 else 'tree-small',(x,y,0),random.uniform(.5,.85),random.uniform(0,6))
for i in range(12):model('castle','rocks-small',(random.uniform(-5,5),random.uniform(-.3,2),0),random.uniform(.5,1.4))
for x in [-4,-2,2,4]:model('castle','ground-hills',(x,2.4,-.02),1.2)
camera((0,-12,8),(0,-.1,0),5.5);render('battlefield.png')
# Authored Mini Dungeon skeleton animations, baked to atlases for Phaser.
for kind,file in [('orc','character-orc'),('human','character-human')]:
 s=clear(160,160);s.cycles.samples=8
 objects=model('dungeon',file,angle=-math.pi/3)
 rig=next(o for o in objects if o.type=='ARMATURE')
 if rig.animation_data:
  for track in rig.animation_data.nla_tracks:track.mute=True
 camera((0,-4,1.5),(0,0,.38),1.05)
 variants=[('idle','idle',4),('walk','walk',8),('attack','attack-melee-right',4),('hurt','emote-no',2),('dead','die',4)]
 for state,action,count in variants:
  rig.animation_data.action=next(a for a in bpy.data.actions if a.name==action+'_'+file)
  lo,hi=rig.animation_data.action.frame_range
  for frame in range(count):
   s.frame_set(int(lo+(hi-lo)*frame/(count if state in ['idle','walk'] else max(1,count-1))))
   render(f'{kind}-{state}-{frame}.png')
