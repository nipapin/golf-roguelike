import Phaser from 'phaser';
import { AudioSystem } from '../presentation/audio/AudioSystem';
import { getRenderDensity } from '../presentation/design/viewport';
import { CASTLE_ABILITIES, type CastleAbility } from './CastleDefense';

const abilityColors: Record<CastleAbility, number> = {
  HEAL: 0x64e1b0,
  BOMB: 0xff987b,
  ECHO: 0xc498f5,
};

/** A centered, trimmed ability icon with its gold cost; no text abbreviations. */
export function castleAbilityButton(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container | null,
  x: number,
  y: number,
  width: number,
  height: number,
  ability: CastleAbility,
  callback: () => void
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y).setDepth(90).setName(`ability-${ability.toLowerCase()}`);
  const bg = scene.add.graphics();
  const accent = abilityColors[ability];
  const diameter = Math.min(height - 6, 26);
  const iconX = -width / 2 + 16;
  const coinX = width / 2 - 8;
  const priceRight = coinX - 8;

  bg.fillStyle(0x081725, 0.65).fillRoundedRect(-width / 2, -height / 2 + 3, width, height, 10);
  bg.fillStyle(0x294e63);
  bg.fillGradientStyle(0x416c81, 0x35586f, 0x1a334b, 0x13283e, 1);
  bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
  bg.lineStyle(1, 0xd7bd87, 0.7).strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
  bg.lineStyle(1, 0xe1f7ff, 0.25).lineBetween(-width / 2 + 10, -height / 2 + 3, width / 2 - 10, -height / 2 + 3);

  // A small jewel setting separates the icon from the darker button surface.
  bg.fillStyle(0x0d2034, 0.85).fillCircle(iconX, 1, diameter / 2);
  bg.lineStyle(1, accent, 0.85).strokeCircle(iconX, 0, diameter / 2);
  bg.lineStyle(1, 0xfff1d6, 0.3).beginPath().arc(iconX, 0, diameter / 2 - 1.5, 3.7, 5.6).strokePath();
  root.add(bg);

  const icon = scene.add.image(iconX, 0, `cardboard-${ability.toLowerCase()}`).setOrigin(0.5);
  icon.setScale((diameter * 0.88) / Math.max(icon.width, icon.height));
  icon.setName(`ability-${ability.toLowerCase()}-icon`);
  const coin = scene.add.image(coinX, 0, 'coin').setOrigin(0.5).setDisplaySize(12, 12).setName('ability-gold-icon');
  const price = scene.add.text(priceRight, 0, String(CASTLE_ABILITIES[ability].cost), {
    resolution: getRenderDensity(), fontFamily: 'Lilita One', fontSize: '14px', color: '#ffebad',
  }).setOrigin(1, 0.5).setStroke('#132438', 2).setName('ability-gold-price');
  const priceWidth = priceRight - (iconX + diameter / 2 + 2);
  if (price.width > priceWidth) price.setFontSize(14 * priceWidth / price.width);
  root.add([icon, price, coin]);

  root.setSize(width, height).setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains
  );
  if (root.input) root.input.cursor = 'pointer';
  root.on('pointerover', () => root.setScale(1.035));
  root.on('pointerout', () => root.setScale(1));
  root.on('pointerdown', () => root.setScale(0.97));
  root.on('pointerup', () => {
    root.setScale(1);
    AudioSystem.unlock();
    AudioSystem.play('button_tap');
    callback();
  });
  parent?.add(root);
  return root;
}
