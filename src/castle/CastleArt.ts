import Phaser from 'phaser';
/** Kenney models rendered under directional light, with live ground shadows. */
export function castleArt(scene: Phaser.Scene, x: number, y: number, scale = 1) {
  const root = scene.add.container(x, y).setScale(scale);
  root.add(scene.add.ellipse(0, 1, 112, 20, 0x152b31, 0.24));
  root.add(scene.add.image(0, 9, 'castle-kenney').setDisplaySize(168, 168).setOrigin(0.5, 1));
  return root;
}
export function weaponArt(scene: Phaser.Scene, mortar: boolean) {
  const root = scene.add.container(0, 0);
  root.add(scene.add.ellipse(0, 2, 36, 10, 0x152b31, 0.25));
  root.add(
    scene.add
      .image(0, 5, mortar ? 'mortar-kenney' : 'turret-kenney')
      .setDisplaySize(58, 58)
      .setOrigin(0.5, 1)
  );
  return root;
}
