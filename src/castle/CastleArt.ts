import type Phaser from 'phaser';
import { cardboardArt } from './CardboardArt';
import { exportedFrame, exportedSprite, siegeArtConfig } from './ExportedArt';
export function castleArt(scene: Phaser.Scene, x: number, y: number, scale = 1) {
  if (!scene.textures.exists('ae-castle'))
    return scene.add.container(x, y, [cardboardArt(scene, 'castle', 0, 0, 158)]).setScale(scale);
  const config = siegeArtConfig.castle;
  const ratio = config.displayHeight / config.frameHeight;
  const facade = scene.add.sprite(0, 0, 'ae-castle', exportedFrame(0))
    .setOrigin(0.5, 1).setScale(ratio).play('ae-castle-idle');
  const castle = scene.add.container(x, y, [facade]).setScale(scale).setDepth(config.depths.facade);
  const layers = [
    ['castle-gate', config.depths.gate],
    ['castle-cover', config.depths.cover],
    ['castle-gate-cover', config.depths.gateCover],
  ] as const;
  const images = layers.map(([key, depth]) => scene.add.image(x, y, `ae-${key}`,
    key === 'castle-gate-cover' ? facade.frame.name : undefined)
    .setOrigin(0.5, 1).setDepth(depth));
  const gateCover = images[2];
  const sync = () => {
    // Follow the actual facade frame, including pauses and loop wraparound.
    // A separate animation clock could expose a seam between the two halves.
    if (gateCover.frame.name !== facade.frame.name) gateCover.setFrame(facade.frame.name);
    for (const image of images) image.setPosition(castle.x, castle.y)
      .setScale(ratio * castle.scaleX, ratio * castle.scaleY)
      .setRotation(castle.rotation).setAlpha(castle.alpha).setVisible(castle.visible);
  };
  sync();
  scene.events.on('postupdate', sync);
  castle.once('destroy', () => {
    scene.events.off('postupdate', sync);
    images.forEach(image => image.destroy());
  });
  return castle;
}
export function castleMount(castle: Phaser.GameObjects.Container,
  kind: keyof typeof siegeArtConfig.castle.mounts) {
  const config = siegeArtConfig.castle;
  const [x, y] = config.mounts[kind];
  const ratio = config.displayHeight / config.frameHeight;
  return castle.getWorldTransformMatrix().transformPoint(
    (x - config.frameWidth / 2) * ratio, (y - config.frameHeight) * ratio,
  );
}
export function weaponArt(scene: Phaser.Scene, mortar: boolean) {
  const id = mortar ? 'cannon' : 'turret';
  if (scene.textures.exists(`ae-${id}`)) {
    const body = exportedSprite(scene, id, 0, 0, 58).play(`ae-${id}-reveal`);
    return scene.add.container(0, 0, [body]).setData('body', body);
  }
  return scene.add.container(0, 0, [
    scene.add.ellipse(0, 2, 36, 10, 0x152b31, 0.25),
    cardboardArt(scene, mortar ? 'mortar' : 'turret', 0, 5, 58),
  ]);
}
