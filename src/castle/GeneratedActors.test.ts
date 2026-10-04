import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { actorDeathDuration, anchorActorAnimations, createGeneratedActorAnimations,
  generatedActorTexture } from './GeneratedActors';
import { createExportedAnimations } from './ExportedArt';

function registeredAnimations() {
  const clips = new Map<string, Phaser.Types.Animations.Animation>();
  const scene = { anims: { exists: (key: string) => clips.has(key),
    create: (clip: Phaser.Types.Animations.Animation) => clips.set(clip.key!, clip) } };
  createGeneratedActorAnimations(scene as unknown as Phaser.Scene);
  createExportedAnimations(scene as unknown as Phaser.Scene);
  return clips;
}

describe('prepared actor animations', () => {
  it('uses complete death clips and preserves the AE ally walk/attack', () => {
    const clips = registeredAnimations();
    expect(clips.get('c_angel1-attack')?.frames).toHaveLength(21);
    expect(clips.get('c_angel1-walk')?.frames).toHaveLength(16);
    expect((clips.get('c_angel2-attack')?.frames as { key: string }[])[0].key).toBe('ae-archer');
    for (const actor of ['c_angel1', 'c_angel2']) {
      expect(clips.get(`${actor}-dead`)?.frames).toHaveLength(8);
      expect(actorDeathDuration(actor)).toBe(800);
    }
    for (const actor of ['c_orc', 'c_goblin', 'c_reaper2', 'c_ogre', 'c_reaper1']) {
      expect(clips.get(`${actor}-dead`)?.frames).toHaveLength(4);
      expect(actorDeathDuration(actor)).toBeCloseTo(2000 / 3);
    }
  });

  it('resolves every generated action frame to its prepared atlas, including eight-frame walk variants', () => {
    const clips = registeredAnimations();
    for (const clip of clips.values()) {
      for (const frame of clip.frames as { key: string; frame: string }[]) {
        if (!frame.key.startsWith('generated-actor-')) continue;
        const atlas = JSON.parse(readFileSync(resolve('public/assets/generated-animations-v1',
          `${frame.key.replace('generated-actor-', '')}.atlas.json`), 'utf8'));
        expect(atlas.frames[frame.frame]).toBeDefined();
      }
    }
    for (const actor of ['c_orc', 'c_goblin', 'c_ogre']) {
      const frames = clips.get(`${actor}-walk`)?.frames as { key: string }[];
      expect(frames).toHaveLength(8);
      expect(frames[0].key).toMatch(/-walk-v2$/);
    }
  });

  it('keeps visible height and ground contact when attack/death switch to another padded sheet', () => {
    const callbacks = new Map<string, () => void>();
    const reference = { x: 75, y: 96, width: 187, height: 189 };
    let scale = 0, origin = [0, 0];
    const sprite = {
      texture: { key: 'ae-knight' },
      frame: { realWidth: 384, realHeight: 384, x: 0, y: 0, width: 384, height: 384 },
      setOrigin: (x: number, y: number) => { origin = [x, y]; return sprite; },
      setScale: (value: number) => { scale = value; return sprite; },
      setData: () => sprite,
      on: (event: string, fn: () => void) => { callbacks.set(event, fn); return sprite; },
    };
    const scene = { textures: { get: () => ({ get: () => reference }) } };
    anchorActorAnimations(scene as unknown as Phaser.Scene,
      sprite as unknown as Phaser.GameObjects.Sprite, 29);
    expect(scale * 384).toBe(29);
    sprite.texture.key = generatedActorTexture('orc');
    sprite.frame = { realWidth: 314, realHeight: 314, ...reference };
    callbacks.get('animationstart')!();
    expect(scale * reference.height).toBeCloseTo(29);
    expect(origin[1] * sprite.frame.realHeight).toBe(reference.y + reference.height);
    expect(origin[0] * sprite.frame.realWidth).toBeCloseTo(reference.x + reference.width / 2);
    sprite.frame = { realWidth: 314, realHeight: 314, x: 58, y: 140, width: 210, height: 116 };
    callbacks.get('animationupdate')!();
    expect(origin[1] * sprite.frame.realHeight).toBeCloseTo(256);
    expect(scale).toBeCloseTo(29 / reference.height);
  });
});
