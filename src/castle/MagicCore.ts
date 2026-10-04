import Phaser from 'phaser';
import { assetUrl } from '../configurator/runtime';
import { isShakeReduced } from '../presentation/juice/fxSettings';

const PARTS = ['ring-inactive', 'ring-active', 'diamond-inactive', 'diamond-active'];

export function preloadMagicCore(scene: Phaser.Scene): void {
  for (const part of PARTS) {
    if (!scene.textures.exists(`core-${part}`))
      scene.load.image(`core-${part}`, assetUrl(`/assets/magic-core/${part}.png`));
  }
}

/** Independent sprites share four textures and keep their pivots across every charge tier. */
export class MagicCore {
  readonly root: Phaser.GameObjects.Container;
  private active: Phaser.GameObjects.Image[] = [];
  private counter: Phaser.GameObjects.Text;
  private charge = -1;
  private unlocked = false;

  constructor(private scene: Phaser.Scene, x: number, y: number, size: number) {
    this.root = scene.add.container(x, y).setDepth(60);
    const radius = size * 0.42;
    const positions = [[0, 0], [0, -radius], [radius, 0], [0, radius], [-radius, 0]];
    positions.forEach(([dx, dy], i) => {
      const part = i ? 'diamond' : 'ring';
      const node = scene.add.container(dx, dy);
      const width = i ? size * 0.28 : size * 0.85;
      const off = scene.add.image(0, 0, `core-${part}-inactive`).setDisplaySize(width, width);
      const on = scene.add.image(0, 0, `core-${part}-active`).setDisplaySize(width, width).setAlpha(0);
      node.add([off, on]);
      this.root.add(node);
      this.active.push(on);
      if (i && !isShakeReduced()) scene.tweens.add({
        targets: node, y: dy - 2, duration: 900 + i * 100, yoyo: true, repeat: -1,
        ease: 'Sine.inOut',
      });
    });
    this.counter = scene.add.text(0, radius + size * 0.12, '', {
      fontFamily: 'Lilita One', fontSize: '11px', color: '#eed7ff',
    }).setOrigin(0.5).setStroke('#211631', 3);
    this.root.add(this.counter);
  }

  setCharge(chain: number, unlocked: boolean): void {
    if (this.charge === chain && this.unlocked === unlocked) return;
    this.charge = chain;
    this.unlocked = unlocked;
    this.root.setVisible(unlocked);
    const ready = Math.floor(chain / 5);
    const current = chain % 5;
    this.active.forEach((image, i) => {
      this.scene.tweens.killTweensOf(image);
      this.scene.tweens.add({ targets: image, alpha: i === 0 ? (ready ? 1 : 0) :
        (ready || current >= i ? 1 : 0), duration: isShakeReduced() ? 0 : 180 });
    });
    this.counter.setText(ready ? `BLAST ×${ready}` : `${current}/5`);
  }

  fire(): void {
    if (!this.unlocked) return;
    this.active.forEach(image => {
      this.scene.tweens.killTweensOf(image);
      image.setAlpha(1);
      this.scene.tweens.add({ targets: image, alpha: 0, duration: 320, delay: 80 });
    });
    this.scene.tweens.killTweensOf(this.root);
    this.root.setScale(1);
    this.scene.tweens.add({ targets: this.root, scale: isShakeReduced() ? 1 : 1.12,
      duration: 100, yoyo: true });
  }
}
