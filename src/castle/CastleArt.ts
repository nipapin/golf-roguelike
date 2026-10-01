import type Phaser from 'phaser';
import { cardboardArt } from './CardboardArt';
export function castleArt(scene: Phaser.Scene, x: number, y: number, scale = 1) {
  return scene.add.container(x, y, [cardboardArt(scene, 'castle', 0, 0, 158)]).setScale(scale);
}
export function weaponArt(scene: Phaser.Scene, mortar: boolean) {
  return scene.add.container(0, 0, [
    scene.add.ellipse(0, 2, 36, 10, 0x152b31, 0.25),
    cardboardArt(scene, mortar ? 'mortar' : 'turret', 0, 5, 58),
  ]);
}
