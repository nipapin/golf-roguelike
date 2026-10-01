import Phaser from 'phaser';
/** Vector geometry stays sharp at any screen density. */
export function castleArt(scene: Phaser.Scene, x: number, y: number, scale = 1) {
  const root = scene.add.container(x, y).setScale(scale);
  const g = scene.add.graphics();
  const block = (bx: number, by: number, w: number, h: number, color: number) => {
    g.fillStyle(color).fillRoundedRect(bx, by, w, h, 4);
    g.lineStyle(3, 0x211631).strokeRoundedRect(bx, by, w, h, 4);
  };
  g.fillStyle(0x201735, 0.35).fillEllipse(0, 3, 120, 20);
  block(-43, -88, 86, 86, 0x8c8ec7);
  block(-55, -114, 30, 110, 0xc5c3e8);
  block(25, -114, 30, 110, 0xc5c3e8);
  for (const side of [-55, 25])
    for (let i = 0; i < 3; i++) block(side + i * 10 - 1, -125, 9, 20, 0xe2dcf5);
  for (let i = 0; i < 6; i++) block(-27 + i * 10, -97, 9, 17, 0xc5c3e8);
  g.lineStyle(2, 0x686a9d, 0.65);
  for (let row = 0; row < 4; row++) {
    g.lineBetween(-22, -72 + row * 15, 22, -72 + row * 15);
    g.lineBetween(row % 2 ? -9 : 9, -72 + row * 15, row % 2 ? -9 : 9, -57 + row * 15);
  }
  block(-14, -40, 28, 40, 0x342541);
  g.fillStyle(0xeaa951).fillRoundedRect(-10, -36, 20, 36, 8);
  g.lineStyle(2, 0x8c552e).lineBetween(0, -34, 0, -2);
  for (const wx of [-46, 33]) block(wx, -94, 12, 25, 0x3b385d);
  g.fillStyle(0x8cf4ff).fillRect(-43, -91, 5, 17).fillRect(36, -91, 5, 17);
  g.lineStyle(3, 0x211631).lineBetween(0, -90, 0, -158);
  root.add(g);
  const flag = scene.add
    .triangle(13, -144, 0, 0, 26, 8, 0, 18, 0x5ce4ea)
    .setStrokeStyle(2, 0x211631);
  root.add(flag);
  scene.tweens.add({
    targets: flag,
    scaleX: 0.82,
    duration: 750,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
  return root;
}
export function weaponArt(scene: Phaser.Scene, mortar: boolean) {
  const root = scene.add.container(0, 0),
    g = scene.add.graphics();
  g.fillStyle(0x201735, 0.3).fillEllipse(0, 3, 30, 10);
  g.fillStyle(0x9a81bd).fillRoundedRect(-13, -12, 26, 16, 4);
  g.lineStyle(3, 0x211631).strokeRoundedRect(-13, -12, 26, 16, 4);
  g.fillStyle(mortar ? 0x63d8e6 : 0xffd567).fillCircle(0, -17, 10);
  g.lineStyle(3, 0x211631).strokeCircle(0, -17, 10);
  g.fillStyle(0x434369).fillRoundedRect(
    mortar ? -15 : -27,
    mortar ? -30 : -22,
    mortar ? 12 : 28,
    11,
    3
  );
  g.lineStyle(3, 0x211631).strokeRoundedRect(
    mortar ? -15 : -27,
    mortar ? -30 : -22,
    mortar ? 12 : 28,
    11,
    3
  );
  root.add(g);
  return root;
}
