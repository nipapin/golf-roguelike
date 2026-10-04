import type Phaser from 'phaser';
import { isShakeReduced } from '../presentation/juice/fxSettings';

/** The five chain rewards use the same dark/light gemstones as the magic core. */
export class CastleRewardCard {
  readonly root: Phaser.GameObjects.Container;
  private light: Phaser.GameObjects.Image;
  private count: Phaser.GameObjects.Text;
  private value = -1;
  constructor(private scene: Phaser.Scene, index: number, x: number, y: number,
    width: number, _height: number, _compact: boolean, onClick: () => void) {
    this.root = scene.add.container(x, y).setDepth(85).setName(`chain-gem-${index + 1}`);
    const size = Math.min(36, width - 8);
    const dark = scene.add.image(0, 0, 'core-diamond-inactive').setDisplaySize(size, size).setTint(0x526477);
    this.light = scene.add.image(0, 0, 'core-diamond-active').setDisplaySize(size, size).setAlpha(0);
    this.count = scene.add.text(size * .37, size * .36, '', { fontFamily: 'Lilita One', fontSize: '10px', color: '#fff0bc' })
      .setOrigin(.5).setStroke('#152a35', 3);
    this.root.add([dark, this.light, this.count]);
    this.root.setSize(width, 40).setInteractive({ useHandCursor: true }).on('pointerup', onClick);
    this.root.on('pointerover', () => this.root.setScale(1.08));
    this.root.on('pointerout', () => this.root.setScale(1));
    this.setState(true, 0);
  }
  setState(_unlocked: boolean, count: number): void {
    if (this.value === count) return;
    this.value = count;
    this.scene.tweens.killTweensOf(this.light);
    this.scene.tweens.add({ targets: this.light, alpha: count > 0 ? 1 : 0, duration: isShakeReduced() ? 0 : 160 });
    this.count.setVisible(count > 1).setText(`×${count}`);
  }
  pulse(): void {
    this.scene.tweens.killTweensOf(this.root);
    this.root.setScale(isShakeReduced() ? 1 : 1.18);
    this.scene.tweens.add({ targets: this.root, scale: 1, duration: 220, ease: 'Sine.out' });
  }
}
