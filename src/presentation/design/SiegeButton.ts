import Phaser from 'phaser';
import { AudioSystem } from '../audio/AudioSystem';
import { getRenderDensity } from './viewport';

export function siegeButton(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null,
  x: number, y: number, width: number, height: number, label: string, callback: () => void,
  icon?: 'pause' | 'undo') {
  const root = scene.add.container(x, y).setDepth(90);
  const g = scene.add.graphics();
  g.fillStyle(0x091d2b, .6).fillRoundedRect(-width / 2, -height / 2 + 3, width, height, 11);
  g.fillGradientStyle(0x477b92, 0x355669, 0x1a3b54, 0x182d45, 1);
  g.fillRoundedRect(-width / 2, -height / 2, width, height, 11);
  g.lineStyle(1.2, 0xd7bd87, .65).strokeRoundedRect(-width / 2, -height / 2, width, height, 11);
  g.lineStyle(1, 0xe1f7ff, .24).lineBetween(-width / 2 + 12, -height / 2 + 3, width / 2 - 12, -height / 2 + 3);
  if (icon === 'pause') {
    g.fillStyle(0xffe7b5).fillRoundedRect(-7, -9, 4, 18, 1).fillRoundedRect(3, -9, 4, 18, 1);
  } else if (icon === 'undo') {
    g.lineStyle(3, 0xffe7b5).beginPath().moveTo(9, 8).lineTo(9, 2)
      .arc(3, 2, 6, 0, -Math.PI / 2, true).lineTo(-6, -4).strokePath();
    g.fillStyle(0xffe7b5).fillTriangle(-11, -4, -4, -10, -4, 2);
  }
  root.add(g);
  if (!icon) root.add(scene.add.text(0, -1, label, { resolution: getRenderDensity(), fontFamily: 'Lilita One',
    fontSize: '13px', color: '#fff2d1', align: 'center', lineSpacing: 2 }).setOrigin(.5).setStroke('#122534', 2));
  root.setSize(width, height).setInteractive({ useHandCursor: true });
  root.on('pointerover', () => root.setScale(1.025));
  root.on('pointerout', () => root.setScale(1));
  root.on('pointerdown', () => root.setScale(.97));
  root.on('pointerup', () => {
    root.setScale(1);
    AudioSystem.unlock(); AudioSystem.play('button_tap'); callback();
  });
  parent?.add(root);
  return root;
}
